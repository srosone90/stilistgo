import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function genId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      clientName, clientPhone, clientEmail,
      service,                   // display string (legacy)
      serviceIds,                // string[] — new field
      duration,                  // number (minutes) — new field
      operatorId,                // string — new field
      preferredDate, preferredTime,
      notes, salonId,
    } = body;

    if (!clientName || !clientPhone || !preferredDate || !preferredTime) {
      return NextResponse.json({ error: 'Campi obbligatori mancanti.' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const isValidServiceKey = serviceKey?.startsWith('eyJ') || serviceKey?.startsWith('sb_secret_');
    const supabaseKey = (isValidServiceKey ? serviceKey : null) ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Configurazione server non disponibile.' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const bookingId = genId('bk');

    // ── 1. Insert to online_bookings table ───────────────────────────────────
    const { error: onlineErr } = await supabase.from('online_bookings').insert({
      id: bookingId,
      salon_id: salonId || '',
      client_name: clientName,
      client_phone: clientPhone,
      client_email: clientEmail || '',
      service: service || (Array.isArray(serviceIds) ? serviceIds.join(', ') : ''),
      preferred_date: preferredDate,
      preferred_time: preferredTime,
      notes: notes || '',
      status: 'pending',
    });

    if (onlineErr) {
      console.error('Supabase online_bookings error:', onlineErr);
      return NextResponse.json({ error: 'Errore durante il salvataggio. Riprova.' }, { status: 500 });
    }

    // Step 2 (direct salon_data write) removed: the SalonContext auto-import
    // handles importing pending bookings with the correct Client format
    // (firstName / lastName) on the next app load.

    return NextResponse.json({ success: true, id: bookingId });
  } catch (e) {
    console.error('Booking route error:', e);
    return NextResponse.json({ error: 'Errore server.' }, { status: 500 });
  }
}

