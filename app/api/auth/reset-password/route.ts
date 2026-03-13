/**
 * POST /api/auth/reset-password
 *
 * Avvia il flusso di reset password. Invia un'email via Resend con un link
 * firmato da Supabase (scade in 1 ora). Rate limited: max 3 richieste/ora per email.
 *
 * Body: { email: string }
 * Risponde sempre 200 (anti-enumerazione — non rivela se l'email esiste).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  checkRateLimit,
  recordRateLimitEvent,
  sendPasswordResetEmail,
} from '@/lib/email';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://app.stylistgo.it').replace(/\/$/, '');
const RATE_LIMIT_MAX = 3; // max richieste per ora per email

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

    // Rate limiting: max RATE_LIMIT_MAX richieste per ora
    const allowed = await checkRateLimit(normalizedEmail, 'password_reset', RATE_LIMIT_MAX);
    if (!allowed) {
      return NextResponse.json(
        { error: "Troppi tentativi. Riprova tra un'ora." },
        { status: 429 },
      );
    }

    // Registra l'evento PRIMA di inviare (impedisce race condition)
    await recordRateLimitEvent(normalizedEmail, 'password_reset');

    // Genera link di reset firmato da Supabase (scade in 1h)
    // Se l'email non esiste, generateLink restituisce errore — lo ignoriamo silenziosamente
    const { data: linkData, error: linkError } = await getAdminClient().auth.admin.generateLink({
      type: 'recovery',
      email: normalizedEmail,
      options: {
        redirectTo: `${SITE_URL}/login?type=recovery`,
      },
    });

    if (!linkError && linkData?.properties?.action_link) {
      sendPasswordResetEmail(normalizedEmail, linkData.properties.action_link).catch((err) =>
        console.error('[reset-password] sendPasswordResetEmail failed:', err),
      );
    }
    // Se l'email non esiste (linkError), non riveliamo nulla (anti-enumerazione)

    // Risposta identica sia che l'email esista o meno
    return NextResponse.json(
      { message: "Se l'indirizzo è registrato, riceverai le istruzioni a breve." },
      { status: 200 },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Errore interno del server';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
