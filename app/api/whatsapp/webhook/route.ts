import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/whatsapp/webhook
 * Meta webhook verification challenge.
 * Set WHATSAPP_WEBHOOK_VERIFY_TOKEN in your env to any secret string.
 * In Meta App Dashboard → WhatsApp → Configuration → Webhook URL:
 *   https://yourdomain.com/api/whatsapp/webhook
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const mode      = searchParams.get('hub.mode');
  const token     = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (
    mode === 'subscribe' &&
    token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
  ) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

/**
 * POST /api/whatsapp/webhook
 * Receives inbound Meta events (delivery receipts, read status, etc.)
 * Just acknowledge with 200 — the scheduler handles outbound only.
 */
export async function POST() {
  return NextResponse.json({ received: true }, { status: 200 });
}
