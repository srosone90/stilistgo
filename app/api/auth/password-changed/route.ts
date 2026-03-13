import { NextResponse } from 'next/server';
import { sendPasswordChangedEmail } from '@/lib/email';

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email mancante.' }, { status: 400 });
    }
    sendPasswordChangedEmail(email); // fire-and-forget
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Errore interno.' }, { status: 500 });
  }
}
