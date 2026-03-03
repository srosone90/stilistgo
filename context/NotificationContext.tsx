'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/supabase';

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
  /** Increments every time a real-time event fires — use as dependency to re-fetch data */
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

export function useNotifications() {
  return useContext(NotificationContext);
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [realtimeBookingTick, setRealtimeBookingTick] = useState(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const userIdRef = useRef<string>('');

  const addNotification = useCallback((n: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
    setNotifications(prev => [{
      ...n,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      read: false,
    }, ...prev].slice(0, 60));
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const user = await getCurrentUser();
        if (!user || (user.id as string).startsWith('local-') || cancelled) return;
        const userId = user.id as string;
        userIdRef.current = userId;

        // Remove previous channel if any (hot-reload safety)
        if (channelRef.current) {
          await supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        }

        const channel = supabase
          .channel(`notifications-${userId}-${Date.now()}`)
          // ── New online booking ──────────────────────────────────────────────
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'online_bookings', filter: `salon_id=eq.${userId}` },
            (payload) => {
              if (cancelled) return;
              const b = payload.new as { client_name?: string; service?: string; preferred_date?: string; preferred_time?: string };
              addNotification({
                type: 'new_booking',
                message: `📅 Nuova prenotazione: ${b.client_name ?? 'Cliente'} — ${b.service ?? ''} · ${b.preferred_date ?? ''} ${b.preferred_time ?? ''}`.trim(),
              });
              // Bump tick so OnlineBookingsView re-fetches
              setRealtimeBookingTick(t => t + 1);
            }
          )
          // ── Booking cancelled by client ─────────────────────────────────────
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'online_bookings', filter: `salon_id=eq.${userId}` },
            (payload) => {
              if (cancelled) return;
              const b = payload.new as { client_name?: string; service?: string; status?: string };
              if (b.status === 'cancelled') {
                addNotification({
                  type: 'booking_cancelled',
                  message: `❌ Disdetta: ${b.client_name ?? 'Cliente'} ha cancellato ${b.service ?? 'la prenotazione'}.`,
                });
                setRealtimeBookingTick(t => t + 1);
              }
            }
          )
          // ── salon_data modified from another device ─────────────────────────
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'salon_data', filter: `user_id=eq.${userId}` },
            (_payload) => {
              if (cancelled) return;
              addNotification({
                type: 'data_sync',
                message: '🔄 Dati aggiornati da un altro dispositivo.',
              });
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              console.log('[Realtime] Connesso al canale notifiche');
            }
          });

        channelRef.current = channel;
      } catch (e) {
        console.warn('[Realtime] Setup fallito:', e);
      }
    })();

    return () => {
      cancelled = true;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current).catch(() => {});
        channelRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markAllRead   = useCallback(() => setNotifications(prev => prev.map(n => ({ ...n, read: true }))), []);
  const clearNotification = useCallback((id: string) => setNotifications(prev => prev.filter(n => n.id !== id)), []);
  const clearAll      = useCallback(() => setNotifications([]), []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, realtimeBookingTick, markAllRead, clearNotification, clearAll }}>
      {children}
    </NotificationContext.Provider>
  );
}
