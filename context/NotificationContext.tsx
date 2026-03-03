'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import { getCurrentUser } from '@/lib/supabase';

// --- Types ------------------------------------------------------------------
export interface AppNotification {
  id: string;
  type: 'new_booking' | 'booking_cancelled' | 'data_sync' | 'info';
  message: string;
  timestamp: string;
  read: boolean;
}

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  /** Increments every time a booking event fires -- use as dep to re-fetch data */
  realtimeBookingTick: number;
  markAllRead: () => void;
  clearNotification: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextValue>({
  notifications: [],
  unreadCount: 0,
  realtimeBookingTick: 0,
  markAllRead: () => {},
  clearNotification: () => {},
  clearAll: () => {},
});

export function useNotifications() { return useContext(NotificationContext); }

// --- Provider ---------------------------------------------------------------
const POLL_INTERVAL_MS = 8_000; // polling cadence

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [realtimeBookingTick, setRealtimeBookingTick] = useState(0);

  // Track already-seen booking IDs so we never fire the same notification twice
  const seenBookingIds   = useRef<Set<string>>(new Set());
  const seenCancelledIds = useRef<Set<string>>(new Set());
  const lastSyncCheck    = useRef<number>(Date.now());

  const channelRef = useRef<RealtimeChannel | null>(null);
  const rt         = useRef<ReturnType<typeof createClient> | null>(null);
  const userIdRef  = useRef<string>('');
  const pollTimer  = useRef<ReturnType<typeof setInterval> | null>(null);
  const mounted    = useRef(true);

  // -- addNotification -------------------------------------------------------
  const addNotification = useCallback((n: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
    if (!mounted.current) return;
    setNotifications(prev => [{
      ...n,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      read: false,
    }, ...prev].slice(0, 60));
  }, []);

  // -- pollNewBookings -- primary mechanism, always active -------------------
  const pollNewBookings = useCallback(async () => {
    const userId = userIdRef.current;
    if (!userId || !rt.current) return;

    try {
      // Check for NEW pending bookings inserted since last poll
      const since = new Date(Date.now() - POLL_INTERVAL_MS * 2).toISOString();
      const { data: newRows } = await rt.current
        .from('online_bookings')
        .select('id, client_name, service, preferred_date, preferred_time, status, created_at')
        .eq('salon_id', userId)
        .eq('status', 'pending')
        .gte('created_at', since)
        .order('created_at', { ascending: false });

      for (const b of (newRows ?? []) as Array<{ id: string; client_name?: string; service?: string; preferred_date?: string; preferred_time?: string }>) {
        if (!seenBookingIds.current.has(b.id)) {
          seenBookingIds.current.add(b.id);
          addNotification({
            type: 'new_booking',
            message: `📅 Nuova prenotazione: ${b.client_name ?? 'Cliente'} – ${b.service ?? ''} · ${b.preferred_date ?? ''} ${b.preferred_time ?? ''}`.trim(),
          });
          setRealtimeBookingTick(t => t + 1);
        }
      }

      // Check for recently cancelled bookings
      const { data: cancelledRows } = await rt.current
        .from('online_bookings')
        .select('id, client_name, service, status, updated_at')
        .eq('salon_id', userId)
        .eq('status', 'cancelled')
        .gte('updated_at', since);

      for (const b of (cancelledRows ?? []) as Array<{ id: string; client_name?: string; service?: string }>) {
        const key = `cancel-${b.id}`;
        if (!seenCancelledIds.current.has(key)) {
          seenCancelledIds.current.add(key);
          addNotification({
            type: 'booking_cancelled',
            message: `❌ Disdetta: ${b.client_name ?? 'Cliente'} ha cancellato ${b.service ?? 'la prenotazione'}.`,
          });
          setRealtimeBookingTick(t => t + 1);
        }
      }
    } catch { /* silently ignore -- next tick will retry */ }
  }, [addNotification]);

  // -- setup -----------------------------------------------------------------
  useEffect(() => {
    mounted.current = true;

    (async () => {
      try {
        const user = await getCurrentUser();
        if (!user || (user.id as string).startsWith('local-') || !mounted.current) return;

        const userId = user.id as string;
        userIdRef.current = userId;

        // Create a DEDICATED realtime client (not the shared Proxy)
        const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
        const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
        if (!supabaseUrl || !supabaseAnon) return;

        rt.current = createClient(supabaseUrl, supabaseAnon, {
          realtime: { reconnectAfterMs: (tries: number) => Math.min(tries * 1000, 10_000) },
        });

        // Inject the user's auth session so RLS policies pass
        try {
          const { getSupabaseClient } = await import('@/lib/supabase');
          const main = getSupabaseClient();
          const { data: { session } } = await main.auth.getSession();
          if (session) {
            await rt.current.auth.setSession({
              access_token: session.access_token,
              refresh_token: session.refresh_token,
            });
          }
        } catch { /* best-effort session copy */ }

        // Start polling fallback FIRST -- guaranteed to work
        // Pre-populate seen IDs so we don't re-notify on stale data
        const { data: existingPending } = await rt.current
          .from('online_bookings')
          .select('id')
          .eq('salon_id', userId);
        for (const row of (existingPending ?? []) as Array<{ id: string }>) seenBookingIds.current.add(row.id);

        const { data: existingCancelled } = await rt.current
          .from('online_bookings')
          .select('id')
          .eq('salon_id', userId)
          .eq('status', 'cancelled');
        for (const row of (existingCancelled ?? []) as Array<{ id: string }>) seenCancelledIds.current.add(`cancel-${row.id}`);

        pollTimer.current = setInterval(pollNewBookings, POLL_INTERVAL_MS);

        // Supabase Realtime as fast path (fires immediately when available)
        const channel = rt.current
          .channel(`notif-${userId}`)
          .on(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            'postgres_changes' as any,
            { event: 'INSERT', schema: 'public', table: 'online_bookings', filter: `salon_id=eq.${userId}` },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (payload: any) => {
              if (!mounted.current) return;
              const b = payload.new as { id?: string; client_name?: string; service?: string; preferred_date?: string; preferred_time?: string };
              if (!b.id || seenBookingIds.current.has(b.id)) return;
              seenBookingIds.current.add(b.id);
              addNotification({
                type: 'new_booking',
                message: `📅 Nuova prenotazione: ${b.client_name ?? 'Cliente'} – ${b.service ?? ''} · ${b.preferred_date ?? ''} ${b.preferred_time ?? ''}`.trim(),
              });
              setRealtimeBookingTick(t => t + 1);
            }
          )
          .on(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            'postgres_changes' as any,
            { event: 'UPDATE', schema: 'public', table: 'online_bookings', filter: `salon_id=eq.${userId}` },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (payload: any) => {
              if (!mounted.current) return;
              const b = payload.new as { id?: string; client_name?: string; service?: string; status?: string };
              if (b.status === 'cancelled' && b.id) {
                const key = `cancel-${b.id}`;
                if (seenCancelledIds.current.has(key)) return;
                seenCancelledIds.current.add(key);
                addNotification({
                  type: 'booking_cancelled',
                  message: `❌ Disdetta: ${b.client_name ?? 'Cliente'} ha cancellato ${b.service ?? 'la prenotazione'}.`,
                });
                setRealtimeBookingTick(t => t + 1);
              }
            }
          )
          .on(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            'postgres_changes' as any,
            { event: 'UPDATE', schema: 'public', table: 'salon_data', filter: `user_id=eq.${userId}` },
            () => {
              if (!mounted.current) return;
              const now = Date.now();
              if (now - lastSyncCheck.current < 60_000) return;
              lastSyncCheck.current = now;
              addNotification({ type: 'data_sync', message: '🔄 Dati aggiornati da un altro dispositivo.' });
            }
          )
          .subscribe((status, err) => {
            if (status === 'SUBSCRIBED') {
              console.log('[Realtime] ✅ Connesso -- notifiche istantanee attive');
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              console.warn('[Realtime] ⚠️ Canale non disponibile -- polling attivo come fallback', err ?? '');
            }
          });

        channelRef.current = channel;
      } catch (e) {
        console.warn('[Notifications] Setup error:', e);
      }
    })();

    return () => {
      mounted.current = false;
      if (pollTimer.current) clearInterval(pollTimer.current);
      if (channelRef.current && rt.current) {
        rt.current.removeChannel(channelRef.current).catch(() => {});
        channelRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markAllRead       = useCallback(() => setNotifications(prev => prev.map(n => ({ ...n, read: true }))), []);
  const clearNotification = useCallback((id: string) => setNotifications(prev => prev.filter(n => n.id !== id)), []);
  const clearAll          = useCallback(() => setNotifications([]), []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, realtimeBookingTick, markAllRead, clearNotification, clearAll }}>
      {children}
    </NotificationContext.Provider>
  );
}
