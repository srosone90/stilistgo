/**
 * POST /api/auth/resend-confirmation
 *
 * Rimanda l'email di conferma a un utente che non l'ha ancora confermata.
 * Rate limited via la stessa tabella del reset password (max 3/ora per email).
 *
 * Body: { email: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  checkRateLimit,
  recordRateLimitEvent,
  sendSignupConfirmationEmail,
} from '@/lib/email';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://stylistgo.app').replace(/\/$/, '');

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email } = body as Record<string, unknown>;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email non valida.' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const allowed = await checkRateLimit(normalizedEmail, 'resend_confirmation', 3);
    if (!allowed) {
      return NextResponse.json(
        { error: "Troppi tentativi. Riprova tra un'ora." },
        { status: 429 },
      );
    }

    await recordRateLimitEvent(normalizedEmail, 'resend_confirmation');

    const { data: linkData, error: linkError } = await getAdminClient().auth.admin.generateLink({
      type: 'signup',
      email: normalizedEmail,
      password: '', // richiesto dal tipo ma non usato per regenerare il link
      options: { redirectTo: `${SITE_URL}/login?confirmed=1` },
    });

    if (!linkError && linkData?.properties?.action_link) {
      sendSignupConfirmationEmail(normalizedEmail, linkData.properties.action_link).catch(
        (err) => console.error('[resend-confirmation]', err),
      );
    }

    // Risposta sempre uguale (anti-enumerazione)
    return NextResponse.json(
      { message: 'Email inviata. Controlla la tua casella.' },
      { status: 200 },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Errore interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
