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

  // Fast-fail with a clear error if Evolution API is not configured
  if (!process.env.EVOLUTION_API_URL || !process.env.EVOLUTION_API_KEY) {
    console.error('[whatsapp/status] EVOLUTION_API_URL o EVOLUTION_API_KEY non impostati su Vercel');
    return NextResponse.json(
      { connected: false, qrcode: null, error: 'Evolution API non configurata (variabili mancanti)' },
    );
  }

  try {
    const supabase = adminClient();

    const { data: tenant } = await supabase
      .from('admin_tenants')
      .select('whatsapp_instance_name')
      .eq('user_id', salonId)
      .maybeSingle();

    const existingPhoneId = (tenant?.whatsapp_instance_name as string | null) ?? undefined;

    const result = await ensureInstance(salonId, existingPhoneId);

    if (result.connected) {
      return NextResponse.json({ connected: true });
    }

    // Persist deterministic instance name if not yet stored
    if (result.phoneId && result.phoneId !== existingPhoneId) {
      await supabase
        .from('admin_tenants')
        .update({ whatsapp_instance_name: result.phoneId })
        .eq('user_id', salonId);
    }

    if (!result.qrcode) {
      console.error('[whatsapp/status] QR non ottenuto — Railway raggiungibile? URL:', process.env.EVOLUTION_API_URL);
      return NextResponse.json({
        connected: false,
        qrcode: null,
        error: 'Impossibile ottenere il QR. Verifica che Railway sia attivo.',
      });
    }

    return NextResponse.json({
      connected: false,
      qrcode: result.qrcode,
    });
  } catch (e: unknown) {
    console.error('[whatsapp/status] errore:', e);
    return NextResponse.json(
      { connected: false, qrcode: null, error: e instanceof Error ? e.message : 'Errore sconosciuto' },
      { status: 500 },
    );
  }
}
