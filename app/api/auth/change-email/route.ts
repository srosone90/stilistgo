/**
 * POST /api/auth/change-email
 *
 * Avvia il flusso di cambio email per un utente autenticato.
 * Genera un token sicuro (32 byte random, scade in 24h), lo salva nel DB,
 * e invia un'email di verifica al NUOVO indirizzo via Resend.
 * Il cambio diventa effettivo solo dopo la verifica (vedi /api/auth/verify-email-change).
 *
 * Header: Authorization: Bearer <access_token>
 * Body: { newEmail: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmailChangeVerificationEmail } from '@/lib/email';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://app.stylistgo.it').replace(/\/$/, '');
const TOKEN_EXPIRY_HOURS = 24;

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function POST(req: NextRequest) {
  try {
    // Verifica autenticazione
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Non autorizzato.' }, { status: 401 });
    }
    const accessToken = authHeader.slice(7);

    const body = await req.json().catch(() => ({}));
    const { newEmail } = body as Record<string, unknown>;

    if (!newEmail || typeof newEmail !== 'string' || !newEmail.includes('@')) {
      return NextResponse.json(
        { error: 'Indirizzo email non valido.' },
        { status: 400 },
      );
    }

    const supabaseAdmin = getAdminClient();

    // Verifica identità del chiamante tramite il suo access token
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (authError || !user?.email) {
      return NextResponse.json({ error: 'Sessione non valida.' }, { status: 401 });
    }

    const normalizedNewEmail = newEmail.toLowerCase().trim();

    if (normalizedNewEmail === user.email.toLowerCase()) {
      return NextResponse.json(
        { error: 'Il nuovo indirizzo coincide con quello attuale.' },
        { status: 400 },
      );
    }

    // Genera token crittograficamente sicuro (64 hex chars = 256 bit)
    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const token = Array.from(tokenBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 3_600_000).toISOString();

    // Invalida eventuali token precedenti per lo stesso utente (one-at-a-time)
    await supabaseAdmin
      .from('email_change_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('used_at', null);

    // Salva il nuovo token
    const { error: insertError } = await supabaseAdmin.from('email_change_tokens').insert({
      id: crypto.randomUUID(),
      user_id: user.id,
      old_email: user.email,
      new_email: normalizedNewEmail,
      token,
      expires_at: expiresAt,
    });

    if (insertError) {
      console.error('[change-email] insert token failed:', insertError.message);
      return NextResponse.json({ error: 'Errore interno. Riprova.' }, { status: 500 });
    }

    const verifyUrl = `${SITE_URL}/api/auth/verify-email-change?token=${token}`;

    // Invia email di verifica al NUOVO indirizzo (fire-and-forget)
    sendEmailChangeVerificationEmail(normalizedNewEmail, normalizedNewEmail, verifyUrl).catch(
      (err) => console.error('[change-email] sendEmailChangeVerificationEmail failed:', err),
    );

    return NextResponse.json(
      { message: "Abbiamo inviato un'email di verifica al nuovo indirizzo." },
      { status: 200 },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Errore interno del server';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
