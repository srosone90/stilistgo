import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clientName, clientPhone, clientEmail, service, preferredDate, preferredTime, notes } = body;

    if (!clientName || !clientPhone || !service || !preferredDate || !preferredTime) {
      return NextResponse.json({ error: 'Campi obbligatori mancanti.' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    // Supabase service_role key is always a JWT starting with "eyJ" — anything else is invalid
    const isValidServiceKey = serviceKey?.startsWith('eyJ');
    const supabaseKey = (isValidServiceKey ? serviceKey : null) ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Configurazione server non disponibile.' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const id = `bk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

    const { error } = await supabase.from('online_bookings').insert({
      id,
      client_name: clientName,
      client_phone: clientPhone,
      client_email: clientEmail || '',
      service,
      preferred_date: preferredDate,
      preferred_time: preferredTime,
      notes: notes || '',
      status: 'pending',
    });

    if (error) {
      console.error('Supabase booking error:', error);
      return NextResponse.json({ error: 'Errore durante il salvataggio. Riprova.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, id });
  } catch (e) {
    console.error('Booking route error:', e);
    return NextResponse.json({ error: 'Errore server.' }, { status: 500 });
  }
}
