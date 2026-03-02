import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const instanceId = searchParams.get('instanceId');
  const token = searchParams.get('token');

  if (!instanceId || !token) {
    return NextResponse.json({ connected: false, error: 'instanceId e token obbligatori' }, { status: 400 });
  }

  try {
    const res = await fetch(`https://api.ultramsg.com/${instanceId}/instance/status?token=${token}`);
    const data = await res.json();

    // UltraMsg returns { status: { accountStatus: { substatus: 'connected' | ... } } }
    const substatus = data?.status?.accountStatus?.substatus ?? data?.substatus ?? '';
    const connected = substatus === 'connected';

    return NextResponse.json({ connected, substatus, qrCode: data?.status?.qrCode ?? null });
  } catch (e: unknown) {
    return NextResponse.json({ connected: false, error: e instanceof Error ? e.message : 'Errore' }, { status: 500 });
  }
}
