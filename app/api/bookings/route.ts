import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function genId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
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

    // ── 2. Write appointment into salon_data.state so it appears in calendar ─
    if (salonId) {
      try {
        const { data: salonRow } = await supabase
          .from('salon_data')
          .select('state')
          .eq('user_id', salonId)
          .maybeSingle();

        const state = (salonRow?.state as Record<string, unknown>) ?? {};
        const clients = (state.clients as {
          id: string; name: string; phone: string; email: string; active: boolean; createdAt: string;
        }[]) ?? [];
        const appointments = (state.appointments as Record<string, unknown>[]) ?? [];

        // Find or create client by phone
        let client = clients.find(c => c.phone === clientPhone);
        if (!client) {
          client = {
            id: genId('cl'),
            name: clientName,
            phone: clientPhone,
            email: clientEmail || '',
            active: true,
            createdAt: new Date().toISOString(),
          };
          clients.push(client);
        }

        // Build appointment
        const apptDuration = typeof duration === 'number' && duration > 0 ? duration : 45;
        const endTime = addMinutes(preferredTime, apptDuration);

        const appointment: Record<string, unknown> = {
          id: bookingId,
          clientId: client.id,
          clientName: clientName,
          operatorId: operatorId || '',
          services: Array.isArray(serviceIds) ? serviceIds : [],
          serviceNames: service || '',
          date: preferredDate,
          startTime: preferredTime,
          endTime,
          duration: apptDuration,
          status: 'confirmed',
          notes: notes || '',
          price: 0,
          source: 'online',
          createdAt: new Date().toISOString(),
        };

        appointments.push(appointment);

        const updatedState = { ...state, clients, appointments };

        await supabase
          .from('salon_data')
          .upsert({ user_id: salonId, state: updatedState }, { onConflict: 'user_id' });
      } catch (calErr) {
        // Non-fatal: booking is already saved in online_bookings
        console.error('Failed to write appointment to salon_data:', calErr);
      }
    }

    return NextResponse.json({ success: true, id: bookingId });
  } catch (e) {
    console.error('Booking route error:', e);
    return NextResponse.json({ error: 'Errore server.' }, { status: 500 });
  }
}

