import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

// Read salon state from the salon_data TABLE (where the main app stores all data)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function readState(supabase: any, user_id: string): Promise<Record<string, unknown>> {
  try {
    const { data, error } = await supabase
      .from('salon_data')
      .select('state')
      .eq('user_id', user_id)
      .maybeSingle();
    if (error || !data) return {};
    return (data.state as Record<string, unknown>) ?? {};
  } catch {
    return {};
  }
}

// Write salon state back to the salon_data TABLE
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function writeState(supabase: any, user_id: string, state: Record<string, unknown>) {
  await supabase
    .from('salon_data')
    .upsert({ user_id, state, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
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
