import { supabase } from './supabase';

// ─── Availability cache ───────────────────────────────────────────────────────
let _available: boolean | null = null;
let _availableTs = 0;

async function isAvailable(): Promise<boolean> {
  const now = Date.now();
  // Re-check every 60s to handle reconnections
  if (_available !== null && now - _availableTs < 60000) return _available;
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`,
      { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! } }
    );
    _available = res.ok;
  } catch {
    _available = false;
  }
  _availableTs = now;
  return _available;
}

// ─── Salon state via server API route (Supabase Storage — no migration needed) ─

export async function dbGetSalonState(userId: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`/api/salon-state?userId=${encodeURIComponent(userId)}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json();
    return json.state ?? null;
  } catch {
    return null;
  }
}

export async function dbSaveSalonState(userId: string, state: Record<string, unknown>): Promise<void> {
  try {
    await fetch(`/api/salon-state?userId=${encodeURIComponent(userId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    });
  } catch {
    // ignore — offline
  }
}

// ─── Online bookings ─────────────────────────────────────────────────────────

export interface OnlineBooking {
  id: string;
  created_at: string;
  client_name: string;
  client_phone: string;
  client_email: string;
  service: string;
  preferred_date: string;
  preferred_time: string;
  notes: string;
  status: 'pending' | 'confirmed' | 'cancelled';
}

export async function dbGetOnlineBookings(): Promise<OnlineBooking[]> {
  if (!await isAvailable()) return [];
  try {
    const { data, error } = await supabase
      .from('online_bookings')
      .select('*')
      .order('created_at', { ascending: false });
    if (error || !data) return [];
    return data as OnlineBooking[];
  } catch {
    return [];
  }
}

export async function dbUpdateBookingStatus(id: string, status: 'confirmed' | 'cancelled'): Promise<void> {
  if (!await isAvailable()) return;
  try {
    await supabase.from('online_bookings').update({ status }).eq('id', id);
  } catch {
    // ignore
  }
}

export async function dbDeleteBooking(id: string): Promise<void> {
  if (!await isAvailable()) return;
  try {
    await supabase.from('online_bookings').delete().eq('id', id);
  } catch {
    // ignore
  }
}
