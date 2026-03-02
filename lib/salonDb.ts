import { supabase } from './supabase';

// ─── Salon state via Supabase DB (salon_data table, anon key + RLS) ───────────
//
// SQL to run in Supabase SQL Editor (once):
//   create table if not exists salon_data (
//     user_id text primary key,
//     state   jsonb  not null default '{}',
//     updated_at timestamptz default now()
//   );
//   alter table salon_data enable row level security;
//   create policy "own" on salon_data using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);

export async function dbGetSalonState(userId: string): Promise<Record<string, unknown> | null> {
  try {
    const { data, error } = await supabase
      .from('salon_data')
      .select('state')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) return null;
    return (data?.state as Record<string, unknown>) ?? null;
  } catch {
    return null;
  }
}

export async function dbSaveSalonState(userId: string, state: Record<string, unknown>): Promise<void> {
  try {
    await supabase
      .from('salon_data')
      .upsert({ user_id: userId, state, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
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

export async function dbGetOnlineBookings(userId: string): Promise<OnlineBooking[]> {
  try {
    const { data, error } = await supabase
      .from('online_bookings')
      .select('*')
      .eq('salon_id', userId)
      .order('created_at', { ascending: false });
    if (error || !data) return [];
    return data as OnlineBooking[];
  } catch {
    return [];
  }
}

export async function dbUpdateBookingStatus(id: string, status: 'confirmed' | 'cancelled'): Promise<void> {
  try {
    await supabase.from('online_bookings').update({ status }).eq('id', id);
  } catch {
    // ignore
  }
}

export async function dbDeleteBooking(id: string): Promise<void> {
  try {
    await supabase.from('online_bookings').delete().eq('id', id);
  } catch {
    // ignore
  }
}
