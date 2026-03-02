import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function timeToMin(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/** Build 30-min slots between openTime and closeTime (e.g. "09:00", "19:00") */
function buildSlots(openTime = '09:00', closeTime = '19:00'): string[] {
  const slots: string[] = [];
  let cur = timeToMin(openTime);
  const end = timeToMin(closeTime);
  while (cur < end) {
    const h = String(Math.floor(cur / 60)).padStart(2, '0');
    const m = String(cur % 60).padStart(2, '0');
    slots.push(`${h}:${m}`);
    cur += 30;
  }
  return slots;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const salonId = searchParams.get('salonId');
  const date = searchParams.get('date');       // yyyy-MM-dd  (optional)
  const operatorId = searchParams.get('operatorId'); // optional filter

  const fallbackSlots = buildSlots();

  if (!salonId) {
    return NextResponse.json({ available: fallbackSlots, salonName: '', services: [], operators: [] });
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

    // ── Salon metadata ──────────────────────────────────────────────────────
    const salonConfig = state?.salonConfig as Record<string, string> | null;
    const salonName: string = salonConfig?.salonName || '';
    const openTime: string = salonConfig?.openTime || '09:00';
    const closeTime: string = salonConfig?.closeTime || '19:00';
    const ALL_SLOTS = buildSlots(openTime, closeTime);

    // ── Services ────────────────────────────────────────────────────────────
    const rawServices = state?.services as { id: string; name: string; duration: number; category: string; active: boolean }[] | null;
    const services = (rawServices ?? []).filter(s => s.active).map(s => ({
      id: s.id, name: s.name, duration: s.duration, category: s.category,
    }));

    // ── Operators ───────────────────────────────────────────────────────────
    const rawOperators = state?.operators as { id: string; name: string; color: string; active: boolean }[] | null;
    const operators = (rawOperators ?? []).filter(o => o.active).map(o => ({
      id: o.id, name: o.name, color: o.color,
    }));

    if (!date) {
      return NextResponse.json({ available: ALL_SLOTS, salonName, services, operators });
    }

    // ── Filter slots by date (and optionally by operator) ───────────────────
    const rawAppts = (state?.appointments as {
      date: string; startTime: string; endTime: string; status: string; operatorId?: string;
    }[] | null) ?? [];

    const dayAppts = rawAppts.filter(a =>
      a.date === date &&
      a.status !== 'cancelled' &&
      a.status !== 'no-show' &&
      // Block if: no operator filter, OR appointment has no operator assigned, OR matches the requested operator
      (!operatorId || !a.operatorId || a.operatorId === operatorId)
    );

    const available = ALL_SLOTS.filter(slot => {
      const slotMin = timeToMin(slot);
      return !dayAppts.some(a => {
        const start = timeToMin(a.startTime);
        const end = timeToMin(a.endTime || a.startTime);
        return slotMin >= start && slotMin < end;
      });
    });

    return NextResponse.json({ available, salonName, services, operators });
  } catch {
    return NextResponse.json({ available: fallbackSlots, salonName: '', services: [], operators: [] });
  }
}

