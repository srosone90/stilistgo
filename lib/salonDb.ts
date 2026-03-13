import { supabase } from './supabase';

export async function dbGetSalonState(userId: string): Promise<Record<string, unknown> | null> {
  try {
    const { data, error } = await supabase
      .from('salon_data')
      .select('state, admin_state')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) return null;
    const state = (data?.state as Record<string, unknown>) ?? null;
    if (!state) return null;
    return { ...state, admin_state: data?.admin_state ?? {} };
  } catch {
    return null;
  }
}

export async function dbSaveSalonState(userId: string, state: Record<string, unknown>): Promise<void> {
  try {
    const { data: existing } = await supabase
      .from('salon_data')
      .select('admin_state')
      .eq('user_id', userId)
      .maybeSingle();
    const adminState = (existing?.admin_state ?? {}) as Record<string, unknown>;
    const merged = { ...state };
    if (Array.isArray(adminState.operators) && adminState.operators.length > 0) {
      // Preserve pin and privatePin fields set by the salon owner — admin_state never contains them
      type OpPin = { id: string; pin?: string; privatePin?: string };
      const savedOps = Array.isArray(state.operators) ? (state.operators as OpPin[]) : [];
      merged.operators = (adminState.operators as OpPin[]).map(adminOp => {
        const saved = savedOps.find(o => o.id === adminOp.id);
        return saved ? { ...adminOp, pin: saved.pin, privatePin: saved.privatePin } : adminOp;
      });
    }
    if (adminState.salonConfig) {
      // Preserve ownerPublicPin/ownerPrivatePin set locally — admin_state never contains them
      const localCfg = (state.salonConfig as Record<string, unknown>) ?? {};
      const adminCfg = adminState.salonConfig as Record<string, unknown>;
      merged.salonConfig = {
        ...localCfg,
        ...adminCfg,
        ownerPublicPin: localCfg.ownerPublicPin,
        ownerPrivatePin: localCfg.ownerPrivatePin,
      };
    }
    await supabase
      .from('salon_data')
      .upsert({ user_id: userId, state: merged, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  } catch {
    // ignore - offline
  }
}

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
