import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!).trim(),
  );
}

/**
 * POST /api/webhooks/evolution
 *
 * Receives events from Evolution API.
 * Security: verifies that body.apikey === EVOLUTION_WEBHOOK_SECRET.
 * Always responds 200 to prevent Evolution API retries.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;

    // ── Authentication ────────────────────────────────────────────────────
    const secret = process.env.EVOLUTION_WEBHOOK_SECRET;
    if (secret && body.apikey !== secret) {
      // Log but still return 200 to avoid revealing endpoint existence
      console.warn('[evolution-webhook] invalid apikey received');
      return NextResponse.json({ ok: false }, { status: 200 });
    }

    const event = body.event as string | undefined;
    const instanceName = body.instance as string | undefined;

    if (!event || !instanceName) {
      return NextResponse.json({ ok: true });
    }

    // ── Event handlers ────────────────────────────────────────────────────
    if (event === 'CONNECTION_UPDATE') {
      const data = body.data as Record<string, unknown> | undefined;
      const status = data?.state as string | undefined;

      // Reverse the instance name → user_id mapping (underscores → hyphens)
      const userId = instanceName.replace(/_/g, '-');
      const supabase = adminClient();

      if (status === 'open') {
        // WhatsApp connected — extract the phone number from ownerJid if present
        const ownerJid = data?.ownerJid as string | undefined;
        const phone = ownerJid ? ownerJid.split('@')[0] : null;

        await supabase
          .from('admin_tenants')
          .update({
            whatsapp_connected: true,
            whatsapp_connected_at: new Date().toISOString(),
            whatsapp_instance_name: instanceName,
            ...(phone ? { whatsapp_phone: phone } : {}),
          })
          .eq('user_id', userId);

        console.info(`[evolution-webhook] ${instanceName} connected — phone: ${phone ?? 'unknown'}`);
      } else if (status === 'close') {
        await supabase
          .from('admin_tenants')
          .update({ whatsapp_connected: false })
          .eq('user_id', userId);

        console.info(`[evolution-webhook] ${instanceName} disconnected`);
      }
    } else if (event === 'QRCODE_UPDATED') {
      // No action needed — the client polls /api/whatsapp/status for fresh QR
      console.info(`[evolution-webhook] QRCODE_UPDATED for ${instanceName}`);
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    console.error('[evolution-webhook] error:', e);
    // Always return 200 so Evolution API doesn't retry
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' });
  }
}
