import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// All 30-min slots between 09:00 and 18:30
const ALL_SLOTS: string[] = [];
for (let h = 9; h < 19; h++) {
  ALL_SLOTS.push(`${String(h).padStart(2, '0')}:00`);
  ALL_SLOTS.push(`${String(h).padStart(2, '0')}:30`);
}

function timeToMin(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const salonId = searchParams.get('salonId');
  const date = searchParams.get('date'); // yyyy-MM-dd

  if (!salonId) {
    return NextResponse.json({ available: ALL_SLOTS, salonName: '', services: [] });
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data } = await supabase
      .from('salon_data')
      .select('state')
      .eq('user_id', salonId)
      .maybeSingle();

    const state = data?.state as Record<string, unknown> | null;

    // Always return salon name + services for public display
    const salonConfig = state?.salonConfig as Record<string, string> | null;
    const salonName: string = salonConfig?.name || '';
    const rawServices = state?.services as { id: string; name: string; duration: number; category: string; active: boolean }[] | null;
    const services = (rawServices ?? []).filter(s => s.active).map(s => ({
      id: s.id, name: s.name, duration: s.duration, category: s.category,
    }));

    if (!date) {
      return NextResponse.json({ available: ALL_SLOTS, salonName, services });
    }

    const appointments = (state?.appointments as { date: string; startTime: string; endTime: string; status: string }[] | null) ?? [];
    const dayAppts = appointments.filter(
      a => a.date === date && a.status !== 'cancelled' && a.status !== 'no-show'
    );

    const available = ALL_SLOTS.filter(slot => {
      const slotMin = timeToMin(slot);
      return !dayAppts.some(a => {
        const start = timeToMin(a.startTime);
        const end = timeToMin(a.endTime || a.startTime);
        return slotMin >= start && slotMin < end;
      });
    });

    return NextResponse.json({ available, salonName, services });
  } catch {
    return NextResponse.json({ available: ALL_SLOTS, salonName: '', services: [] });
  }
}
