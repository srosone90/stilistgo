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

    // Maytapi uses 'type' instead of 'event'
    const event = (body.type as string | undefined) ?? (body.event as string | undefined);
    // Maytapi phoneId (numeric, sent as number in JSON)
    const phoneId = body.phone_id != null ? String(body.phone_id) : undefined;

    if (!event) {
      return NextResponse.json({ ok: true });
    }

    // ── Event handlers ────────────────────────────────────────────────────
    if (event === 'channel_status' && phoneId) {
      // Maytapi connection status change
      const status = body.status as string | undefined;
      const supabase = adminClient();

      if (status === 'active') {
        const phone = body.phone as string | null | undefined;

        await supabase
          .from('admin_tenants')
          .update({
            whatsapp_connected: true,
            whatsapp_connected_at: new Date().toISOString(),
            ...(phone ? { whatsapp_phone: phone.replace(/\D/g, '') } : {}),
          })
          .eq('whatsapp_instance_name', phoneId);

        console.info(`[maytapi-webhook] phone ${phoneId} connected — ${phone ?? 'unknown'}`);
      } else if (status === 'timeout' || status === 'disconnected') {
        await supabase
          .from('admin_tenants')
          .update({ whatsapp_connected: false })
          .eq('whatsapp_instance_name', phoneId);

        console.info(`[maytapi-webhook] phone ${phoneId} disconnected (${status})`);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    console.error('[waha-webhook] error:', e);
    // Always return 200 so WAHA doesn't retry
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' });
  }
}
