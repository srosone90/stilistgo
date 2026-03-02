import { NextRequest, NextResponse } from 'next/server';

interface TemplateComponent {
  type: 'header' | 'body' | 'button';
  parameters: { type: 'text'; text: string }[];
  sub_type?: string;
  index?: number;
}

interface SendPayload {
  phoneNumberId: string;
  accessToken: string;
  to: string;                    // international format: +393331234567
  templateName: string;
  language?: string;             // default: 'it'
  components?: TemplateComponent[];
}

export async function POST(req: NextRequest) {
  try {
    const body: SendPayload = await req.json();

    // Use request creds (test flow) or fall back to platform-level env vars
    const phoneNumberId = body.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || '';
    const accessToken   = body.accessToken   || process.env.WHATSAPP_ACCESS_TOKEN   || '';
    const { to, templateName, language = 'it', components = [] } = body;

    if (!phoneNumberId || !accessToken || !to || !templateName) {
      return NextResponse.json({ error: 'Credenziali WhatsApp non configurate. Aggiungi WHATSAPP_PHONE_NUMBER_ID e WHATSAPP_ACCESS_TOKEN nelle variabili d\'ambiente Netlify.' }, { status: 400 });
    }

    // Normalize phone: ensure +39 prefix for Italian numbers
    const phone = to.startsWith('+') ? to.replace(/\s/g, '') : `+${to.replace(/\s/g, '')}`;

    const metaUrl = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      to: phone,
      type: 'template',
      template: {
        name: templateName,
        language: { code: language },
        components: components.length > 0 ? components : undefined,
      },
    };

    const resp = await fetch(metaUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await resp.json();

    if (!resp.ok) {
      const msg: string = data?.error?.message ?? `HTTP ${resp.status}`;
      console.error('WhatsApp API error:', data);
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    return NextResponse.json({ success: true, messageId: data?.messages?.[0]?.id });
  } catch (e) {
    console.error('WhatsApp send route error:', e);
    return NextResponse.json({ error: 'Errore server.' }, { status: 500 });
  }
}
