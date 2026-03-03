'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Bell, X, Check, Trash2 } from 'lucide-react';
import { useNotifications, AppNotification } from '@/context/NotificationContext';

const TYPE_ICON: Record<AppNotification['type'], string> = {
  new_booking:       '📅',
  booking_cancelled: '❌',
  data_sync:         '🔄',
  info:              'ℹ️',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'adesso';
  if (m < 60) return `${m} min fa`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h fa`;
  return `${Math.floor(h / 24)} g fa`;
}

export default function NotificationBell() {
  const { notifications, unreadCount, markAllRead, clearNotification, clearAll } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close panel on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function toggle() {
    setOpen(v => !v);
    if (!open && unreadCount > 0) markAllRead();
  }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Bell button */}
      <button
        onClick={toggle}
        title="Notifiche"
        style={{
          position: 'relative', background: 'none', border: 'none', cursor: 'pointer',
          padding: 6, borderRadius: 10, color: 'var(--muted)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'color 0.15s, background 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-card)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2,
            width: 16, height: 16, borderRadius: '50%',
            background: '#ef4444', color: 'white',
            fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1, pointerEvents: 'none',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: 'fixed', top: 'auto', right: 16, marginTop: 8,
          width: 340, maxHeight: '70vh',
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
          zIndex: 9999, overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
              Notifiche {unreadCount > 0 && <span style={{ color: '#ef4444', fontSize: 12 }}>({unreadCount})</span>}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              {notifications.length > 0 && (
                <button onClick={clearAll} title="Cancella tutte"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center' }}>
                  <Trash2 size={13} />
                </button>
              )}
              {unreadCount > 0 && (
                <button onClick={markAllRead} title="Segna tutte come lette"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center' }}>
                  <Check size={13} />
                </button>
              )}
              <button onClick={() => setOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center' }}>
                <X size={13} />
              </button>
            </div>
          </div>

          {/* List */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                <Bell size={28} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.3 }} />
                Nessuna notifica
              </div>
            ) : (
              notifications.map(n => (
                <div key={n.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '11px 14px',
                  borderBottom: '1px solid var(--border)',
                  background: n.read ? 'transparent' : 'rgba(239,68,68,0.04)',
                  transition: 'background 0.15s',
                }}>
                  <span style={{ fontSize: 16, lineHeight: 1.4, flexShrink: 0 }}>{TYPE_ICON[n.type]}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, color: 'var(--text)', margin: '0 0 2px', lineHeight: 1.4, wordBreak: 'break-word' }}>{n.message.replace(/^[📅❌🔄ℹ️]\s*/, '')}</p>
                    <p style={{ fontSize: 11, color: 'var(--muted)', margin: 0 }}>{timeAgo(n.timestamp)}</p>
                  </div>
                  <button onClick={() => clearNotification(n.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 2, flexShrink: 0, display: 'flex', alignItems: 'center', opacity: 0.5 }}>
                    <X size={11} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
