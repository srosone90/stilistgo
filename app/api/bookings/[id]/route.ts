import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// PATCH /api/bookings/[id]
// Body: { action: 'cancel', clientPhone: string }
// Verifies the booking belongs to the given client before updating status.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'ID prenotazione mancante.' }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const { action, clientPhone } = body as { action?: string; clientPhone?: string };

  if (action !== 'cancel') {
    return NextResponse.json({ error: 'Azione non supportata.' }, { status: 400 });
  }
  if (!clientPhone) {
    return NextResponse.json({ error: 'clientPhone richiesto per la verifica.' }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const supabaseKey = serviceKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return NextResponse.json({ error: 'Configurazione server mancante.' }, { status: 500 });

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Fetch the booking first to verify ownership
  const { data: booking, error: fetchErr } = await supabase
    .from('online_bookings')
    .select('id, client_phone, status, preferred_date, preferred_time, service, salon_id, client_name')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr || !booking) {
    return NextResponse.json({ error: 'Prenotazione non trovata.' }, { status: 404 });
  }

  if (booking.client_phone !== clientPhone) {
    return NextResponse.json({ error: 'Non autorizzato.' }, { status: 403 });
  }

  if (booking.status === 'cancelled') {
    return NextResponse.json({ error: 'Già cancellata.' }, { status: 409 });
  }

  const { error: updateErr } = await supabase
    .from('online_bookings')
    .update({ status: 'cancelled' })
    .eq('id', id);

  if (updateErr) {
    console.error('bookings/[id] PATCH error:', updateErr);
    return NextResponse.json({ error: 'Errore durante la cancellazione.' }, { status: 500 });
  }

  // Try to send WA notification to the salon owner (fire-and-forget, best effort)
  try {
    const { data: sdRow } = await supabase
      .from('salon_data')
      .select('state')
      .eq('user_id', booking.salon_id)
      .maybeSingle();
    const salonState = sdRow?.state as Record<string, unknown> | null;
    const salonConf  = salonState?.salonConfig as Record<string, unknown> | null;
    const wa         = salonConf?.whatsapp as Record<string, unknown> | null;
    // Notify salon owner's phone if configured
    const ownerPhone = salonConf?.contactPhone as string | undefined;
    if (wa?.enabled && wa.ultraMsgInstanceId && wa.ultraMsgToken && ownerPhone) {
      const msg = `⚠️ Cancellazione: ${booking.client_name} ha disdetto ${booking.service} del ${booking.preferred_date} alle ${booking.preferred_time}.`;
      await fetch(`https://api.ultramsg.com/${wa.ultraMsgInstanceId}/messages/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: wa.ultraMsgToken as string, to: ownerPhone.replace(/\D/g,''), body: msg }).toString(),
      });
    }
  } catch { /* non bloccare la risposta */ }

  return NextResponse.json({ ok: true });
}
