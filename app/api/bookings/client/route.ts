import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// GET /api/bookings/client?clientPhone=X&salonId=Y
// Returns all bookings for a client (by phone) at a given salon, ordered most-recent first.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientPhone = searchParams.get('clientPhone')?.trim();
  const salonId     = searchParams.get('salonId')?.trim();

  if (!clientPhone || !salonId) {
    return NextResponse.json({ error: 'clientPhone e salonId sono obbligatori.' }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const supabaseKey = serviceKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return NextResponse.json({ error: 'Configurazione server mancante.' }, { status: 500 });

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Normalise phone: try both with and without spaces/dashes to be more resilient
  const { data, error } = await supabase
    .from('online_bookings')
    .select('id, service, preferred_date, preferred_time, status, created_at, notes, client_name')
    .eq('salon_id', salonId)
    .eq('client_phone', clientPhone)
    .order('preferred_date', { ascending: false })
    .order('preferred_time', { ascending: false });

  if (error) {
    console.error('bookings/client GET error:', error);
    return NextResponse.json({ error: 'Errore nel recupero prenotazioni.' }, { status: 500 });
  }

  // Also fetch loyalty points for this client from salon_data
  let loyaltyPoints = 0;
  try {
    const { data: sdRow } = await supabase
      .from('salon_data')
      .select('state')
      .eq('user_id', salonId)
      .maybeSingle();
    const clients = ((sdRow?.state as Record<string, unknown> | null)?.clients) as Record<string, unknown>[] | null;
    const found = clients?.find(c => (c.phone as string) === clientPhone);
    loyaltyPoints = (found?.loyaltyPoints as number) ?? 0;
  } catch { /* non bloccare */ }

  return NextResponse.json({ bookings: data ?? [], loyaltyPoints });
}
