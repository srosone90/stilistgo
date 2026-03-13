/**
 * POST /api/auth/welcome
 *
 * Invia l'email di benvenuto dopo che l'utente ha confermato il proprio indirizzo.
 * Deve essere chiamata dal frontend quando rileva type=signup nel callback di Supabase
 * (es. dopo il redirect da ?confirmed=1 con un access_token valido nella sessione).
 *
 * Header: Authorization: Bearer <access_token>
 * Body: { salonName?: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendWelcomeEmail } from '@/lib/email';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Non autorizzato.' }, { status: 401 });
    }
    const accessToken = authHeader.slice(7);

    const body = await req.json().catch(() => ({}));
    const salonName = typeof body.salonName === 'string' ? body.salonName : '';

    const {
      data: { user },
      error,
    } = await getAdminClient().auth.getUser(accessToken);

    if (error || !user?.email) {
      return NextResponse.json({ error: 'Sessione non valida.' }, { status: 401 });
    }

    // Fire-and-forget
    sendWelcomeEmail(user.email, salonName).catch((err) =>
      console.error('[welcome] sendWelcomeEmail failed:', err),
    );

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Errore interno del server';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
