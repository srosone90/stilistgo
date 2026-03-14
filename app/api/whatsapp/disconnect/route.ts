import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { disconnectInstance } from '@/lib/evolution/evolutionClient';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!).trim(),
  );
}

/**
 * POST /api/whatsapp/disconnect
 * Body: { salonId: string }
 *
 * Logs out the WhatsApp session for the salon and marks it disconnected in DB.
 */
export async function POST(req: NextRequest) {
  try {
    const { salonId } = (await req.json()) as { salonId?: string };

    if (!salonId) {
      return NextResponse.json({ error: 'salonId obbligatorio' }, { status: 400 });
    }

    const supabase = adminClient();

    // Read the Maytapi phoneId from DB
    const { data: tenant } = await supabase
      .from('admin_tenants')
      .select('whatsapp_instance_name')
      .eq('user_id', salonId)
      .maybeSingle();

    const phoneId = tenant?.whatsapp_instance_name as string | null;
    if (phoneId) await disconnectInstance(phoneId);
    await supabase
      .from('admin_tenants')
      .update({
        whatsapp_connected: false,
        whatsapp_connected_at: null,
        whatsapp_phone: null,
      })
      .eq('user_id', salonId);

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore sconosciuto' },
      { status: 500 },
    );
  }
}
