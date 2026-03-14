import { NextRequest, NextResponse } from 'next/server';
import { sendTextMessage } from '@/lib/evolution/evolutionClient';

/**
 * Backward-compatible send route.
 * `instanceId` is repurposed as the Evolution API instance name (= salon user_id
 * with hyphens replaced by underscores). `token` is ignored.
 */
export async function POST(req: NextRequest) {
  try {
    const { instanceId, to, message } = (await req.json()) as {
      instanceId?: string;
      token?: string;
      to?: string;
      message?: string;
    };

    if (!instanceId || !to || !message) {
      return NextResponse.json(
        { success: false, error: 'instanceId, to e message sono obbligatori' },
        { status: 400 },
      );
    }

    const phone = to.replace(/\D/g, '');
    const ok = await sendTextMessage(instanceId, phone, message);

    if (ok) {
      return NextResponse.json({ success: true });
    }
    return NextResponse.json(
      { success: false, error: 'Invio fallito — verifica che WhatsApp sia connesso' },
      { status: 400 },
    );
  } catch (e: unknown) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Errore sconosciuto' },
      { status: 500 },
    );
  }
}
