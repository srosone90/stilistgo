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
 * Receives events from WAHA (WhatsApp HTTP API).
 * WAHA event format: { event: 'session.status', session: 'default', payload: { status, me } }
 *
 * Security: checks X-Webhook-Secret header against EVOLUTION_WEBHOOK_SECRET.
 * Configure WAHA with: WHATSAPP_HOOK_HEADERS=X-Webhook-Secret:<your-secret>
 * Always responds 200 to prevent WAHA retries.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;

    // ── Authentication ────────────────────────────────────────────────────
    const secret = process.env.EVOLUTION_WEBHOOK_SECRET;
    if (secret) {
      const headerSecret = req.headers.get('x-webhook-secret');
      // Also accept legacy body.apikey for backward compat
      const bodyApiKey = body.apikey as string | undefined;
      if (headerSecret !== secret && bodyApiKey !== secret) {
        console.warn('[waha-webhook] invalid secret received');
        return NextResponse.json({ ok: false }, { status: 200 });
      }
    }

    const event = body.event as string | undefined;
    // WAHA uses 'session' field; Evolution API used 'instance'
    const session = (body.session as string | undefined) ?? (body.instance as string | undefined);

    if (!event) {
      return NextResponse.json({ ok: true });
    }

    // ── Event handlers ────────────────────────────────────────────────────
    if (event === 'session.status') {
      const payload = body.payload as Record<string, unknown> | undefined;
      const status = payload?.status as string | undefined;
      const me = payload?.me as Record<string, unknown> | null | undefined;

      const supabase = adminClient();

      if (status === 'WORKING') {
        const phone = me?.id ? (me.id as string).split('@')[0] : null;

        await supabase
          .from('admin_tenants')
          .update({
            whatsapp_connected: true,
            whatsapp_connected_at: new Date().toISOString(),
            whatsapp_instance_name: session ?? 'default',
            ...(phone ? { whatsapp_phone: phone } : {}),
          })
          .eq('whatsapp_instance_name', session ?? 'default');

        console.info(`[waha-webhook] session ${session} connected — phone: ${phone ?? 'unknown'}`);
      } else if (status === 'STOPPED' || status === 'FAILED') {
        await supabase
          .from('admin_tenants')
          .update({ whatsapp_connected: false })
          .eq('whatsapp_instance_name', session ?? 'default');

        console.info(`[waha-webhook] session ${session} disconnected (${status})`);
      } else if (status === 'SCAN_QR_CODE') {
        // No action needed — client polls /api/whatsapp/status for QR
        console.info(`[waha-webhook] session ${session} waiting for QR scan`);
      }
    } else if (event === 'QRCODE_UPDATED') {
      // Legacy Evolution API event — ignore
      console.info(`[waha-webhook] legacy QRCODE_UPDATED event ignored`);
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    console.error('[waha-webhook] error:', e);
    // Always return 200 so WAHA doesn't retry
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' });
  }
}
