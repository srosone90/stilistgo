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
 * Receives connection events from the self-hosted Evolution API on Railway.
 *
 * Evolution API global webhook format:
 *   { event: 'connection.update', instance: '<instanceName>', data: { state: 'open'|'close'|'connecting' } }
 *
 * Instance names are deterministic: user_id.replace(/-/g, '_')
 * so the reverse mapping is: instanceName.replace(/_/g, '-') → user_id.
 *
 * Security: validates X-Api-Key header against EVOLUTION_API_KEY
 * (Evolution API sends its own API key in webhook calls).
 * Always returns 200 to prevent Evolution API retries.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;

    // ── Authentication ────────────────────────────────────────────────────
    const apiKey = process.env.EVOLUTION_API_KEY;
    if (apiKey) {
      const headerKey = req.headers.get('apikey') ?? req.headers.get('x-api-key');
      const secret = process.env.EVOLUTION_WEBHOOK_SECRET;
      const headerSecret = req.headers.get('x-webhook-secret');
      const bodyApiKey = body.apikey as string | undefined;
      // Accept if either the Evolution API key or the webhook secret matches
      const valid =
        headerKey === apiKey ||
        (secret && (headerSecret === secret || bodyApiKey === secret));
      if (!valid) {
        console.warn('[evolution-webhook] autenticazione fallita');
        return NextResponse.json({ ok: false }, { status: 200 });
      }
    }

    // Evolution API event format
    const event = (body.event as string | undefined) ?? (body.type as string | undefined);
    const instanceName = (body.instance as string | undefined) ?? (body.phone_id != null ? String(body.phone_id) : undefined);

    if (!event || !instanceName) {
      return NextResponse.json({ ok: true });
    }

    // Derive salon user_id from instance name (reverse of user_id.replace(/-/g, '_'))
    const userId = instanceName.replace(/_/g, '-');
    const supabase = adminClient();

    if (event === 'connection.update') {
      const data = body.data as Record<string, unknown> | undefined;
      // Evolution API uses 'state', Maytapi legacy used 'status'
      const state = (data?.state as string | undefined) ?? (body.status as string | undefined);

      if (state === 'open') {
        // ownerJid format: "393331234567@s.whatsapp.net"
        const ownerJid = (data?.wuid ?? data?.id ?? data?.ownerJid) as string | undefined;
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

        console.info(`[evolution-webhook] ${instanceName} connesso${phone ? ' — ' + phone : ''}`);

      } else if (state === 'close') {
        await supabase
          .from('admin_tenants')
          .update({ whatsapp_connected: false })
          .eq('user_id', userId);

        console.info(`[evolution-webhook] ${instanceName} disconnesso`);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    console.error('[evolution-webhook] error:', e);
    // Always return 200 so Evolution API doesn't retry
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' });
  }
}
