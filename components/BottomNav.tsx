'use client';

import React from 'react';
import { CalendarDays, Banknote, Users, Globe, LayoutDashboard, MoreHorizontal } from 'lucide-react';
import { useNotifications } from '@/context/NotificationContext';

const NAV_ITEMS = [
  { id: 'calendar',  label: 'Agenda',   icon: CalendarDays },
  { id: 'cash',      label: 'Cassa',    icon: Banknote },
  { id: 'clients',   label: 'Clienti',  icon: Users },
  { id: 'bookings',  label: 'Online',   icon: Globe },
  { id: 'dashboard', label: 'Home',     icon: LayoutDashboard },
] as const;

type NavId = typeof NAV_ITEMS[number]['id'];

interface BottomNavProps {
  activeView: string;
  onNavigate: (view: string) => void;
  onMore: () => void;   // opens the full sidebar drawer
}

export default function BottomNav({ activeView, onNavigate, onMore }: BottomNavProps) {
  const { notifications } = useNotifications();
  const newBookingCount = notifications.filter(n => !n.read && n.type === 'new_booking').length;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 md:hidden flex items-center justify-around"
      style={{
        background: 'var(--bg-sidebar)',
        borderTop: '1px solid var(--border)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        height: 60,
      }}
    >
      {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
        const active = activeView === id;
        const showBadge = id === 'bookings' && newBookingCount > 0;
        return (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full relative"
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            aria-label={label}
          >
            <Icon
              size={22}
              style={{ color: active ? 'var(--accent-light)' : 'var(--muted)', transition: 'color 0.15s' }}
            />
            <span
              style={{
                fontSize: 10,
                color: active ? 'var(--accent-light)' : 'var(--muted)',
                fontWeight: active ? 600 : 400,
                transition: 'color 0.15s',
              }}
            >
              {label}
            </span>
            {active && (
              <span
                style={{
                  position: 'absolute',
                  top: 4,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'rgba(99,102,241,0.15)',
                  pointerEvents: 'none',
                }}
              />
            )}
            {showBadge && (
              <span
                style={{
                  position: 'absolute',
                  top: 6,
                  right: '20%',
                  background: '#ef4444',
                  color: 'white',
                  fontSize: 9,
                  fontWeight: 700,
                  borderRadius: 8,
                  padding: '1px 4px',
                  lineHeight: 1.5,
                }}
              >
                {newBookingCount}
              </span>
            )}
          </button>
        );
      })}

      {/* "More" button opens the full sidebar */}
      <button
        onClick={onMore}
        className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full"
        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
        aria-label="Altro"
      >
        <MoreHorizontal size={22} style={{ color: 'var(--muted)' }} />
        <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 400 }}>Altro</span>
      </button>
    </nav>
  );
}
