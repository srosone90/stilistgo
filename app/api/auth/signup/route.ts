import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendSignupConfirmationEmail } from '@/lib/email';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://app.stylistgo.it').replace(/\/$/, '');

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function POST(req: NextRequest) {
  try {
    const { email, password, fullName } = await req.json();

    if (!email || !password || password.length < 6) {
      return NextResponse.json({ error: 'Dati non validi.' }, { status: 400 });
    }

    const supabaseAdmin = getAdminClient();

    // Crea l'utente con email_confirm: false — la conferma avviene via Resend
    let data, error;
    try {
      ({ data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: false,
        user_metadata: { full_name: fullName || '' },
      }));
    } catch (fetchErr: unknown) {
      const msg = fetchErr instanceof Error ? fetchErr.message : 'Supabase non raggiungibile';
      return NextResponse.json({ offline: true, reason: msg }, { status: 200 });
    }

    if (error) {
      const isNetworkError =
        error.message.includes('fetch') ||
        error.message.includes('network') ||
        error.message.includes('ENOTFOUND') ||
        error.message.includes('DNS') ||
        error.status === 0;
      if (isNetworkError) {
        return NextResponse.json({ offline: true, reason: error.message }, { status: 200 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Genera il link di conferma firmato da Supabase (token sicuro, scade in 24h)
    // Il link punta a Supabase che verifica il token e redirige a SITE_URL
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'signup',
      email,
      password, // richiesto dal tipo GenerateSignupLinkParams
      options: {
        redirectTo: `${SITE_URL}/login?confirmed=1`,
      },
    });

    if (!linkError && linkData.properties?.action_link) {
      // Fire-and-forget: non bloccare la risposta per l'invio email
      sendSignupConfirmationEmail(email, linkData.properties.action_link).catch((err) =>
        console.error('[signup] sendSignupConfirmationEmail failed:', err),
      );
    } else {
      console.error('[signup] generateLink failed:', linkError?.message);
    }

    return NextResponse.json({ user: data!.user }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Errore interno del server';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
