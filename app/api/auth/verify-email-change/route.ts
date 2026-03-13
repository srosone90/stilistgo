/**
 * GET /api/auth/verify-email-change?token=<hex_token>
 *
 * Verifica il token di cambio email generato da /api/auth/change-email.
 * Se valido (non scaduto, non già usato):
 *  1. Segna il token come usato (invalidazione one-shot)
 *  2. Aggiorna l'email dell'utente in Supabase via Admin API
 *  3. Invia notifica al vecchio indirizzo via Resend
 *  4. Redirige al login con query param email_changed=1
 *
 * Link scade dopo 24 ore e può essere usato una sola volta.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmailChangedNotification } from '@/lib/email';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://app.stylistgo.it').replace(/\/$/, '');

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');

  // Validazione base del token (deve essere esattamente 64 hex chars)
  if (!token || !/^[0-9a-f]{64}$/.test(token)) {
    return NextResponse.redirect(`${SITE_URL}/login?error=invalid_token`);
  }

  try {
    const supabaseAdmin = getAdminClient();
    const now = new Date().toISOString();

    // Cerca il token: deve essere non usato e non scaduto
    const { data: record, error: fetchError } = await supabaseAdmin
      .from('email_change_tokens')
      .select('id, user_id, old_email, new_email, expires_at, used_at')
      .eq('token', token)
      .is('used_at', null)
      .gte('expires_at', now)
      .single();

    if (fetchError || !record) {
      return NextResponse.redirect(`${SITE_URL}/login?error=expired_token`);
    }

    // Segna il token come usato PRIMA di aggiornare l'email (evita double-use)
    const { error: markError } = await supabaseAdmin
      .from('email_change_tokens')
      .update({ used_at: now })
      .eq('id', record.id)
      .is('used_at', null); // double-check atomico

    if (markError) {
      // Token già usato da una richiesta concorrente
      return NextResponse.redirect(`${SITE_URL}/login?error=expired_token`);
    }

    // Aggiorna l'email dell'utente in Supabase
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      record.user_id,
      { email: record.new_email, email_confirm: true },
    );

    if (updateError) {
      console.error('[verify-email-change] updateUserById failed:', updateError.message);
      return NextResponse.redirect(`${SITE_URL}/login?error=update_failed`);
    }

    // Notifica il vecchio indirizzo (fire-and-forget)
    sendEmailChangedNotification(record.old_email, record.new_email).catch((err) =>
      console.error('[verify-email-change] sendEmailChangedNotification failed:', err),
    );

    return NextResponse.redirect(`${SITE_URL}/login?email_changed=1`);
  } catch (err) {
    console.error('[verify-email-change] unexpected error:', err);
    return NextResponse.redirect(`${SITE_URL}/login?error=server_error`);
  }
}
