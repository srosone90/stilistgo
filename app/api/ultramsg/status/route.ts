import { NextRequest, NextResponse } from 'next/server';
import { fetchInstance } from '@/lib/evolution/evolutionClient';

/**
 * Backward-compatible status route.
 * `instanceId` is now the Evolution API instance name. `token` is ignored.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const instanceId = searchParams.get('instanceId');

  if (!instanceId) {
    return NextResponse.json({ connected: false, error: 'instanceId obbligatorio' }, { status: 400 });
  }

  try {
    const instance = await fetchInstance(instanceId);
    const connected = instance?.connectionStatus === 'open';
    return NextResponse.json({ connected, substatus: instance?.connectionStatus ?? 'unknown' });
  } catch (e: unknown) {
    return NextResponse.json(
      { connected: false, error: e instanceof Error ? e.message : 'Errore' },
      { status: 500 },
    );
  }
}
