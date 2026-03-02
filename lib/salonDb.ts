import { supabase } from './supabase';

// ─── Availability cache (reuse from db.ts pattern) ────────────────────────────
let _available: boolean | null = null;

async function isAvailable(): Promise<boolean> {
  if (_available !== null) return _available;
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`,
      { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! } }
    );
    _available = res.ok;
  } catch {
    _available = false;
  }
  return _available;
}

// ─── Salon state (full snapshot per user) ────────────────────────────────────

export async function dbGetSalonState(userId: string): Promise<Record<string, unknown> | null> {
  if (!await isAvailable()) return null;
  try {
    const { data, error } = await supabase
      .from('salon_state')
      .select('state')
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data) return null;
    return data.state as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function dbSaveSalonState(userId: string, state: Record<string, unknown>): Promise<void> {
  if (!await isAvailable()) return;
  try {
    await supabase.from('salon_state').upsert(
      { user_id: userId, state, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  } catch {
    // Ignore — Supabase unavailable or table doesn't exist yet (migration not run)
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
