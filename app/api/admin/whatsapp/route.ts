import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// PATCH — assign or remove UltraMsg instance for a tenant
export async function PATCH(req: NextRequest) {
  const { user_id, ultraMsgInstanceId, ultraMsgToken } = await req.json();

  if (!user_id) {
    return NextResponse.json({ error: 'user_id obbligatorio' }, { status: 400 });
  }

  // Fetch current salon_data — use `state` column (same column used by the salon app)
  const { data: row, error: fetchErr } = await supabase
    .from('salon_data')
    .select('state')
    .eq('user_id', user_id)
    .maybeSingle();

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  const current = ((row?.state as Record<string, unknown>) ?? {});
  const currentSalonConfig = (current.salonConfig as Record<string, unknown>) ?? {};
  const currentWhatsapp = (currentSalonConfig.whatsapp as Record<string, unknown>) ?? {};

  // Merge UltraMsg credentials into existing whatsapp config
  const updatedWhatsapp = {
    ...currentWhatsapp,
    ultraMsgInstanceId: ultraMsgInstanceId ?? '',
    ultraMsgToken: ultraMsgToken ?? '',
    // If credentials removed, also disable
    enabled: (ultraMsgInstanceId && ultraMsgToken) ? (currentWhatsapp.enabled ?? false) : false,
  };

  const updatedState = {
    ...current,
    salonConfig: {
      ...currentSalonConfig,
      whatsapp: updatedWhatsapp,
    },
  };

  // Use upsert so it works even if the row doesn't exist yet
  const { error: updateErr } = await supabase
    .from('salon_data')
    .upsert({ user_id, state: updatedState }, { onConflict: 'user_id' });

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// GET — fetch current WhatsApp config for a tenant
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const user_id = searchParams.get('user_id');

  if (!user_id) {
    return NextResponse.json({ error: 'user_id obbligatorio' }, { status: 400 });
  }

  const { data: row, error } = await supabase
    .from('salon_data')
    .select('state')
    .eq('user_id', user_id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!row) {
    return NextResponse.json({ ultraMsgInstanceId: '', ultraMsgToken: '', enabled: false, debug: 'no_row' });
  }

  const stateObj = (row.state as Record<string, unknown>) ?? {};
  const stateCfg = ((stateObj.salonConfig as Record<string, unknown>)?.whatsapp as Record<string, unknown>) ?? {};

  const instanceId = (stateCfg.ultraMsgInstanceId ?? '') as string;
  const token      = (stateCfg.ultraMsgToken      ?? '') as string;
  const enabled    = (stateCfg.enabled            ?? false) as boolean;

  return NextResponse.json({
    ultraMsgInstanceId: instanceId,
    ultraMsgToken: token,
    enabled,
    debug: instanceId ? 'found' : 'empty',
  });
}
