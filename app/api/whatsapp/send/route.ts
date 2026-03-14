import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendTextMessage } from '@/lib/evolution/evolutionClient';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!).trim(),
  );
}

/**
 * POST /api/whatsapp/send
 * Body: { salonId: string; to: string; message: string }
 *
 * Sends a WhatsApp message via Evolution API using the salon's instance.
 */
export async function POST(req: NextRequest) {
  try {
    const { salonId, to, message } = (await req.json()) as {
      salonId?: string;
      to?: string;
      message?: string;
    };

    if (!salonId || !to || !message) {
      return NextResponse.json(
        { success: false, error: 'salonId, to e message sono obbligatori' },
        { status: 400 },
      );
    }

    // Verify instance is connected before sending
    const supabase = adminClient();
    const { data: tenant } = await supabase
      .from('admin_tenants')
      .select('whatsapp_connected, whatsapp_instance_name')
      .eq('user_id', salonId)
      .maybeSingle();

    if (!tenant?.whatsapp_connected) {
      return NextResponse.json(
        { success: false, error: 'WhatsApp non connesso per questo salone' },
        { status: 400 },
      );
    }

    const instanceName = (tenant.whatsapp_instance_name as string | null) ?? salonId.replace(/-/g, '_');
    const phone = to.replace(/\D/g, '');
    const ok = await sendTextMessage(instanceName, phone, message);

    if (ok) {
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ success: false, error: 'Invio fallito — verifica che WhatsApp sia connesso' }, { status: 400 });
  } catch (e: unknown) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Errore sconosciuto' },
      { status: 500 },
    );
  }
}
