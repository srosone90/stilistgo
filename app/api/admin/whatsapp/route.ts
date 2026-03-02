import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const BUCKET = 'salon-data';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function readState(supabase: any, user_id: string): Promise<Record<string, unknown>> {
  try {
    const { data, error } = await supabase.storage.from(BUCKET).download(`${user_id}.json`);
    if (error || !data) return {};
    const text = await data.text();
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function writeState(supabase: any, user_id: string, state: Record<string, unknown>) {
  const blob = new Blob([JSON.stringify(state)], { type: 'application/json' });
  await supabase.storage.from(BUCKET).upload(`${user_id}.json`, blob, { upsert: true, contentType: 'application/json' });
}

// PATCH — assign or remove UltraMsg instance for a tenant
export async function PATCH(req: NextRequest) {
  const { user_id, ultraMsgInstanceId, ultraMsgToken } = await req.json();

  if (!user_id) {
    return NextResponse.json({ error: 'user_id obbligatorio' }, { status: 400 });
  }

  const supabase = getAdminClient();
  const state = await readState(supabase, user_id);

  const current = state;
  const currentSalonConfig = (current.salonConfig as Record<string, unknown>) ?? {};
  const currentWhatsapp = (currentSalonConfig.whatsapp as Record<string, unknown>) ?? {};

  const updatedWhatsapp = {
    ...currentWhatsapp,
    ultraMsgInstanceId: ultraMsgInstanceId ?? '',
    ultraMsgToken: ultraMsgToken ?? '',
    enabled: (ultraMsgInstanceId && ultraMsgToken) ? (currentWhatsapp.enabled ?? false) : false,
  };

  const updatedState = {
    ...current,
    salonConfig: {
      ...currentSalonConfig,
      whatsapp: updatedWhatsapp,
    },
  };

  await writeState(supabase, user_id, updatedState);
  return NextResponse.json({ success: true });
}

// GET — fetch current WhatsApp config for a tenant
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const user_id = searchParams.get('user_id');

  if (!user_id) {
    return NextResponse.json({ error: 'user_id obbligatorio' }, { status: 400 });
  }

  const supabase = getAdminClient();
  const state = await readState(supabase, user_id);

  const salonConfig = (state.salonConfig as Record<string, unknown>) ?? {};
  const whatsapp = (salonConfig.whatsapp as Record<string, unknown>) ?? {};

  const instanceId = (whatsapp.ultraMsgInstanceId ?? '') as string;
  const token      = (whatsapp.ultraMsgToken      ?? '') as string;
  const enabled    = (whatsapp.enabled            ?? false) as boolean;

  return NextResponse.json({
    ultraMsgInstanceId: instanceId,
    ultraMsgToken: token,
    enabled,
    debug: instanceId ? 'found' : 'empty',
  });
}
