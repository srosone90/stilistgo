import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ensureInstance } from '@/lib/evolution/instanceManager';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!).trim(),
  );
}

/**
 * GET /api/whatsapp/status?salonId=<user_id>
 *
 * Checks (or creates) the Evolution API instance for the salon and returns:
 *   { connected: true }                    — when the instance is open
 *   { connected: false, qrcode: base64 }   — when a QR scan is needed
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const salonId = searchParams.get('salonId');

  if (!salonId) {
    return NextResponse.json({ error: 'salonId obbligatorio' }, { status: 400 });
  }

  // Derive Evolution instance name from the salon user_id
  const instanceName = salonId.replace(/-/g, '_');

  try {
    const result = await ensureInstance(instanceName);

    if (result.connected) {
      return NextResponse.json({ connected: true });
    }

    // Store 'default' as the instance name — WAHA Core always uses the "default" session.
    // The webhook identifies the tenant by whatsapp_instance_name = 'default'.
    const supabase = adminClient();
    await supabase
      .from('admin_tenants')
      .update({ whatsapp_instance_name: 'default' })
      .eq('user_id', salonId);

    return NextResponse.json({
      connected: false,
      qrcode: result.qrcode ?? null,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore sconosciuto' },
      { status: 500 },
    );
  }
}
