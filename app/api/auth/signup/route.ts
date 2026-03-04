import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const { email, password, fullName } = await req.json();

    if (!email || !password || password.length < 6) {
      return NextResponse.json({ error: 'Dati non validi.' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
      process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    let data, error;
    try {
      ({ data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName || '' },
      }));
    } catch (fetchErr: unknown) {
      // Supabase non raggiungibile (DNS non risolto, timeout, ecc.)
      // Restituisce 200 + offline:true → il browser non logga errori HTTP
      const msg = fetchErr instanceof Error ? fetchErr.message : 'Supabase non raggiungibile';
      return NextResponse.json({ offline: true, reason: msg }, { status: 200 });
    }

    if (error) {
      // Controlla se è un errore di rete mascherato da errore Supabase
      const isNetworkError = error.message.includes('fetch') ||
        error.message.includes('network') ||
        error.message.includes('ENOTFOUND') ||
        error.message.includes('DNS') ||
        error.status === 0;
      if (isNetworkError) {
        return NextResponse.json({ offline: true, reason: error.message }, { status: 200 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ user: data!.user }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Errore interno del server';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
