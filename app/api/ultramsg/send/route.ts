import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { instanceId, token, to, message } = await req.json();

    if (!instanceId || !token || !to || !message) {
      return NextResponse.json({ success: false, error: 'instanceId, token, to, message sono obbligatori' }, { status: 400 });
    }

    const phone = to.replace(/\D/g, '');

    const res = await fetch(`https://api.ultramsg.com/${instanceId}/messages/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token, to: phone, body: message }),
    });

    const data = await res.json();

    if (data.sent === true || data.message === 'ok') {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false, error: data.error ?? JSON.stringify(data) }, { status: 400 });
    }
  } catch (e: unknown) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : 'Errore sconosciuto' }, { status: 500 });
  }
}
