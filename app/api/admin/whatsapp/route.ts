import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!).trim(),
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

// Write whatsapp config into admin_state.salonConfig.whatsapp
// Using admin_state keeps it consistent with other admin writes and avoids
// overwriting the user's state column (which would break timestamp-based sync).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function writeAdminState(supabase: any, user_id: string, adminStatePatch: Record<string, unknown>) {
  // Read current admin_state first so we don't clobber other admin fields
  const { data } = await supabase
    .from('salon_data')
    .select('admin_state')
    .eq('user_id', user_id)
    .maybeSingle();
  const current = (data?.admin_state ?? {}) as Record<string, unknown>;
  const merged = { ...current, ...adminStatePatch };
  await supabase
    .from('salon_data')
    .upsert({ user_id, admin_state: merged, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
}

// PATCH — assign or remove UltraMsg instance for a tenant
export async function PATCH(req: NextRequest) {
  const { user_id, ultraMsgInstanceId, ultraMsgToken } = await req.json();

  if (!user_id) {
    return NextResponse.json({ error: 'user_id obbligatorio' }, { status: 400 });
  }

  const supabase = getAdminClient();

  // Read existing state to preserve other whatsapp fields (enabled, templates, etc.)
  const currentState = await readState(supabase, user_id);
  const currentSalonConfig = (currentState.salonConfig as Record<string, unknown>) ?? {};
  const currentWhatsapp = (currentSalonConfig.whatsapp as Record<string, unknown>) ?? {};

  const updatedWhatsapp = {
    ...currentWhatsapp,
    ultraMsgInstanceId: ultraMsgInstanceId ?? '',
    ultraMsgToken: ultraMsgToken ?? '',
    enabled: (ultraMsgInstanceId && ultraMsgToken) ? (currentWhatsapp.enabled ?? false) : false,
  };

  // Write to admin_state so realtime propagates correctly to the salon client
  await writeAdminState(supabase, user_id, {
    salonConfig: { ...(currentSalonConfig), whatsapp: updatedWhatsapp },
  });

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

  // Read both columns — admin_state takes precedence (written by this API),
  // state is the fallback for tenants who had WA configured before this migration.
  const { data } = await supabase
    .from('salon_data')
    .select('state, admin_state')
    .eq('user_id', user_id)
    .maybeSingle();

  const adminCfg = ((data?.admin_state as Record<string, unknown> | null)?.salonConfig as Record<string, unknown> | undefined);
  const stateCfg = ((data?.state as Record<string, unknown> | null)?.salonConfig as Record<string, unknown> | undefined);
  const whatsapp = ((adminCfg?.whatsapp ?? stateCfg?.whatsapp ?? {}) as Record<string, unknown>);

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
