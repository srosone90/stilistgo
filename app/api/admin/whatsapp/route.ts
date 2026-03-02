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

  // Fetch current salon_data
  const { data: row, error: fetchErr } = await supabase
    .from('salon_data')
    .select('data')
    .eq('user_id', user_id)
    .single();

  if (fetchErr || !row) {
    return NextResponse.json({ error: 'Tenant non trovato' }, { status: 404 });
  }

  const current = (row.data as Record<string, unknown>) ?? {};
  const currentWhatsapp = (current.salonConfig as Record<string, unknown>)?.whatsapp as Record<string, unknown> ?? {};

  // Merge UltraMsg credentials into existing whatsapp config
  const updatedWhatsapp = {
    ...currentWhatsapp,
    ultraMsgInstanceId: ultraMsgInstanceId ?? '',
    ultraMsgToken: ultraMsgToken ?? '',
    // If credentials removed, also disable
    enabled: (ultraMsgInstanceId && ultraMsgToken) ? (currentWhatsapp.enabled ?? false) : false,
  };

  const updatedData = {
    ...current,
    salonConfig: {
      ...((current.salonConfig as Record<string, unknown>) ?? {}),
      whatsapp: updatedWhatsapp,
    },
  };

  const { error: updateErr } = await supabase
    .from('salon_data')
    .update({ data: updatedData })
    .eq('user_id', user_id);

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
    .select('data')
    .eq('user_id', user_id)
    .single();

  if (error || !row) {
    return NextResponse.json({ error: 'Tenant non trovato' }, { status: 404 });
  }

  const whatsapp = (row.data as Record<string, unknown>)?.salonConfig as Record<string, unknown>;
  const wa = (whatsapp?.whatsapp as Record<string, unknown>) ?? {};

  return NextResponse.json({
    ultraMsgInstanceId: wa.ultraMsgInstanceId ?? '',
    ultraMsgToken: wa.ultraMsgToken ?? '',
    enabled: wa.enabled ?? false,
  });
}
