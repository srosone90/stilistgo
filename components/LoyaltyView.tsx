'use client';

import React, { useState, useMemo } from 'react';
import { useSalon } from '@/context/SalonContext';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { Trophy, Star, Award, Crown, Plus, Minus, Search } from 'lucide-react';

const card: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px' };

type Tier = 'bronze' | 'silver' | 'gold' | 'platinum';

function getTier(points: number): Tier {
  if (points >= 1000) return 'platinum';
  if (points >= 500)  return 'gold';
  if (points >= 100)  return 'silver';
  return 'bronze';
}

const TIER_CONFIG: Record<Tier, { label: string; color: string; bg: string; icon: React.ReactNode; min: number; next?: number }> = {
  bronze:   { label: 'Bronzo',   color: '#cd7f32', bg: 'rgba(205,127,50,0.15)',  icon: <Award size={14} />,  min: 0,    next: 100  },
  silver:   { label: 'Argento',  color: '#94a3b8', bg: 'rgba(148,163,184,0.15)', icon: <Star size={14} />,   min: 100,  next: 500  },
  gold:     { label: 'Oro',      color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  icon: <Trophy size={14} />, min: 500,  next: 1000 },
  platinum: { label: 'Platino',  color: 'var(--accent-light)', bg: 'rgba(129,140,248,0.15)', icon: <Crown size={14} />,  min: 1000 },
};

export default function LoyaltyView() {
  const { clients, addLoyaltyPoints, appointments, payments, salonConfig } = useSalon();
  const [search, setSearch] = useState('');
  const [adjustClientId, setAdjustClientId] = useState<string | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [sortBy, setSortBy] = useState<'points' | 'name'>('points');

  const pointsPerEuro = salonConfig.loyaltyPointsPerEuro || 1;

  // Sort and filter clients
  const ranked = useMemo(() => {
    return [...clients]
      .filter(c => {
        const q = `${c.firstName} ${c.lastName}`.toLowerCase();
        return q.includes(search.toLowerCase());
      })
      .sort((a, b) => sortBy === 'points' ? b.loyaltyPoints - a.loyaltyPoints : a.firstName.localeCompare(b.firstName));
  }, [clients, search, sortBy]);

  // Computed stats
  const stats = useMemo(() => {
    const total = clients.reduce((s, c) => s + c.loyaltyPoints, 0);
    const tiers = { bronze: 0, silver: 0, gold: 0, platinum: 0 };
    clients.forEach(c => tiers[getTier(c.loyaltyPoints)]++);
    return { total, tiers, avg: clients.length > 0 ? Math.round(total / clients.length) : 0 };
  }, [clients]);

  // Last payment date for a client
  const lastVisit = (clientId: string): string | null => {
    const p = payments.filter(p => p.clientId === clientId).sort((a, b) => b.date.localeCompare(a.date))[0];
    if (p) return format(parseISO(p.date), 'dd/MM/yyyy', { locale: it });
    const a = appointments.filter(a => a.clientId === clientId && a.status === 'completed').sort((a, b) => b.date.localeCompare(a.date))[0];
    if (a) return format(parseISO(a.date), 'dd/MM/yyyy', { locale: it });
    return null;
  };

  const handleAdjust = (delta: number) => {
    if (!adjustClientId) return;
    const amt = parseInt(adjustAmount) || 0;
    if (amt <= 0) return;
    addLoyaltyPoints(adjustClientId, delta > 0 ? amt : -amt);
    setAdjustClientId(null);
    setAdjustAmount('');
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Programma Fedeltà</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          {pointsPerEuro} punto ogni €1 speso · Gestisci i punti dei tuoi clienti
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div style={card} className="text-center">
          <p className="text-2xl font-bold" style={{ color: 'var(--accent-light)' }}>{stats.total.toLocaleString()}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>Punti totali emessi</p>
        </div>
        <div style={card} className="text-center">
          <p className="text-2xl font-bold" style={{ color: '#22c55e' }}>{stats.avg}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>Media per cliente</p>
        </div>
        {(['platinum', 'gold'] as Tier[]).map(t => (
          <div key={t} style={{ ...card, borderColor: TIER_CONFIG[t].color + '50' }} className="text-center">
            <p className="text-2xl font-bold" style={{ color: TIER_CONFIG[t].color }}>{stats.tiers[t]}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>Clienti {TIER_CONFIG[t].label}</p>
          </div>
        ))}
      </div>

      {/* Tier legend */}
      <div style={card}>
        <p className="text-sm font-semibold text-white mb-3">Livelli fedeltà</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {(Object.entries(TIER_CONFIG) as [Tier, typeof TIER_CONFIG[Tier]][]).map(([key, t]) => (
            <div key={key} className="flex items-center gap-2 rounded-xl px-3 py-2"
              style={{ background: t.bg, border: `1px solid ${t.color}50` }}>
              <span style={{ color: t.color }}>{t.icon}</span>
              <div>
                <p className="text-xs font-semibold" style={{ color: t.color }}>{t.label}</p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  {t.min}+ pt{t.next ? ` / ${t.next} per salire` : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Client ranking */}
      <div style={card}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-white">Classifica clienti</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setSortBy('points')}
              className="text-xs px-2.5 py-1 rounded-lg"
              style={sortBy === 'points' ? { background: 'rgba(99,102,241,0.2)', color: 'var(--accent-light)', border: '1px solid rgba(99,102,241,0.4)' } : { background: 'var(--bg-input)', color: 'var(--muted)', border: '1px solid var(--border)', cursor: 'pointer' }}>
              Per punti
            </button>
            <button onClick={() => setSortBy('name')}
              className="text-xs px-2.5 py-1 rounded-lg"
              style={sortBy === 'name' ? { background: 'rgba(99,102,241,0.2)', color: 'var(--accent-light)', border: '1px solid rgba(99,102,241,0.4)' } : { background: 'var(--bg-input)', color: 'var(--muted)', border: '1px solid var(--border)', cursor: 'pointer' }}>
              Per nome
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca cliente..."
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '10px', padding: '8px 12px 8px 32px', color: 'var(--text)', fontSize: '13px', outline: 'none', width: '100%' }} />
        </div>

        {ranked.length === 0 ? (
          <p className="text-center py-6 text-sm" style={{ color: 'var(--muted)' }}>Nessun cliente trovato.</p>
        ) : (
          <div className="space-y-2">
            {ranked.map((c, idx) => {
              const tier = getTier(c.loyaltyPoints);
              const tc = TIER_CONFIG[tier];
              const visit = lastVisit(c.id);
              return (
                <div key={c.id} className="flex items-center gap-3 rounded-xl px-3 py-3"
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
                  {/* Rank */}
                  {sortBy === 'points' && (
                    <span className="text-xs font-bold w-5 text-center" style={{ color: idx < 3 ? '#f59e0b' : 'var(--border-light)' }}>
                      {idx + 1}
                    </span>
                  )}
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{ background: tc.bg, color: tc.color }}>
                    {c.firstName.charAt(0).toUpperCase()}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white truncate">{c.firstName} {c.lastName}</p>
                      <span className="flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: tc.bg, color: tc.color, border: `1px solid ${tc.color}40` }}>
                        {tc.icon}{tc.label}
                      </span>
                    </div>
                    {visit && <p className="text-xs" style={{ color: 'var(--muted)' }}>Ultima visita: {visit}</p>}
                  </div>
                  {/* Points */}
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-sm" style={{ color: tc.color }}>{c.loyaltyPoints.toLocaleString()} pt</p>
                    {tc.next && (
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>
                        {Math.max(0, tc.next - c.loyaltyPoints)} per {['silver','gold','platinum'].find(t => TIER_CONFIG[t as Tier].min === tc.next) ? TIER_CONFIG[['silver','gold','platinum'].find(t => TIER_CONFIG[t as Tier].min === tc.next) as Tier].label : ''}
                      </p>
                    )}
                  </div>
                  {/* Adjust */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => { setAdjustClientId(c.id); setAdjustAmount('10'); }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: 'var(--accent-light)', cursor: 'pointer' }}>
                      <Plus size={12} />
                    </button>
                    <button onClick={() => { setAdjustClientId(c.id + '_minus'); setAdjustAmount('10'); }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', cursor: 'pointer' }}>
                      <Minus size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Adjust modal */}
      {adjustClientId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-xs rounded-2xl p-6" style={{ background: '#18181f', border: '1px solid var(--border)' }}>
            {(() => {
              const isDeduct = adjustClientId.endsWith('_minus');
              const realId = isDeduct ? adjustClientId.replace('_minus', '') : adjustClientId;
              const client = clients.find(c => c.id === realId);
              return (
                <>
                  <h3 className="font-semibold text-white mb-1">
                    {isDeduct ? '➖ Deduci punti' : '➕ Aggiungi punti'}
                  </h3>
                  <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>{client?.firstName} {client?.lastName}</p>
                  <input
                    type="number" min={1} value={adjustAmount}
                    onChange={e => setAdjustAmount(e.target.value)}
                    autoFocus
                    style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 13px', color: 'var(--text)', fontSize: '16px', outline: 'none', width: '100%', textAlign: 'center' }}
                  />
                  <div className="flex gap-2 mt-4">
                    <button onClick={() => setAdjustClientId(null)}
                      style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: '8px', padding: '9px', fontSize: '13px', cursor: 'pointer' }}>
                      Annulla
                    </button>
                    <button onClick={() => {
                      const amt = parseInt(adjustAmount) || 0;
                      if (amt > 0) {
                        addLoyaltyPoints(realId, isDeduct ? -amt : amt);
                      }
                      setAdjustClientId(null); setAdjustAmount('');
                    }}
                    style={{ flex: 1, background: isDeduct ? 'rgba(239,68,68,0.15)' : 'rgba(99,102,241,0.2)', border: `1px solid ${isDeduct ? 'rgba(239,68,68,0.3)' : 'rgba(99,102,241,0.4)'}`, color: isDeduct ? '#f87171' : 'var(--accent-light)', borderRadius: '8px', padding: '9px', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}>
                      Conferma
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
