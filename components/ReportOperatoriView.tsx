'use client';

import React, { useMemo, useState } from 'react';
import { useSalon } from '@/context/SalonContext';
import {
  TrendingUp, Users, Award, ShoppingBag, CalendarX, DollarSign,
  BarChart3, ChevronDown, ChevronUp,
} from 'lucide-react';

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>{label}</p>
      <p className="text-xl font-bold" style={{ color: color ?? 'var(--text-1)' }}>{value}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{sub}</p>}
    </div>
  );
}

// Date range helper
function getRange(period: string): { from: string; to: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (period === 'month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: fmt(from), to: fmt(to) };
  }
  if (period === 'quarter') {
    const qStart = Math.floor(now.getMonth() / 3) * 3;
    const from = new Date(now.getFullYear(), qStart, 1);
    const to = new Date(now.getFullYear(), qStart + 3, 0);
    return { from: fmt(from), to: fmt(to) };
  }
  if (period === 'year') {
    return { from: `${now.getFullYear()}-01-01`, to: `${now.getFullYear()}-12-31` };
  }
  // custom or all
  return { from: '2000-01-01', to: '2099-12-31' };
}

export default function ReportOperatoriView() {
  const { operators, payments, appointments } = useSalon();
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year' | 'all'>('month');
  const [selectedOpId, setSelectedOpId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { from, to } = useMemo(() => getRange(period), [period]);

  const filteredPayments = useMemo(() =>
    payments.filter(p => p.date >= from && p.date <= to),
    [payments, from, to]
  );

  const filteredApts = useMemo(() =>
    appointments.filter(a => a.date >= from && a.date <= to),
    [appointments, from, to]
  );

  const activeOps = operators.filter(o => o.active);

  const stats = useMemo(() => activeOps.map(op => {
    const opPayments = filteredPayments.filter(p => p.operatorId === op.id);
    const opApts = filteredApts.filter(a => a.operatorId === op.id);
    const revenue = opPayments.reduce((s, p) => s + p.total, 0);
    const completed = opApts.filter(a => a.status === 'completed').length;
    const noShow = opApts.filter(a => a.status === 'no-show').length;
    const ticketMedio = opPayments.length > 0 ? revenue / opPayments.length : 0;
    const commission = revenue * ((op.commissionRate ?? 0) / 100);
    const productRevenue = opPayments.reduce((s, p) =>
      s + p.items.filter(i => i.isProduct).reduce((si, i) => si + i.price, 0), 0);
    const serviceRevenue = revenue - productRevenue;
    const topServices: Record<string, number> = {};
    opPayments.forEach(p => p.items.filter(i => !i.isProduct).forEach(i => {
      topServices[i.serviceName] = (topServices[i.serviceName] || 0) + i.price;
    }));
    const topList = Object.entries(topServices).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { op, revenue, completed, noShow, ticketMedio, commission, productRevenue, serviceRevenue, topList, nPayments: opPayments.length };
  }), [activeOps, filteredPayments, filteredApts]);

  const totRevenue = stats.reduce((s, x) => s + x.revenue, 0);

  const displayed = selectedOpId ? stats.filter(s => s.op.id === selectedOpId) : stats;

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Report Operatori</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
            Performance individuale e commissioni
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['month', 'quarter', 'year', 'all'] as const).map(p => (
            <button key={p}
              onClick={() => setPeriod(p)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: period === p ? '#6366f1' : 'var(--bg-card)',
                color: period === p ? '#fff' : 'var(--text-2)',
                border: '1px solid var(--border)',
              }}>
              {p === 'month' ? 'Mese' : p === 'quarter' ? 'Trimestre' : p === 'year' ? 'Anno' : 'Tutto'}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Fatturato totale" value={`€${totRevenue.toFixed(2)}`} color="#6366f1" />
        <StatCard label="Operatori attivi" value={String(activeOps.length)} />
        <StatCard label="Pagamenti periodo" value={String(filteredPayments.length)} />
        <StatCard label="Ticket medio globale"
          value={filteredPayments.length > 0 ? `€${(totRevenue / filteredPayments.length).toFixed(2)}` : '—'} />
      </div>

      {/* Filter by operator */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedOpId(null)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{
            background: !selectedOpId ? '#6366f1' : 'var(--bg-card)',
            color: !selectedOpId ? '#fff' : 'var(--text-2)',
            border: '1px solid var(--border)',
          }}>Tutti</button>
        {activeOps.map(op => (
          <button key={op.id}
            onClick={() => setSelectedOpId(selectedOpId === op.id ? null : op.id)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{
              background: selectedOpId === op.id ? op.color : 'var(--bg-card)',
              color: selectedOpId === op.id ? '#fff' : 'var(--text-2)',
              border: `1px solid ${selectedOpId === op.id ? op.color : 'var(--border)'}`,
            }}>{op.name}</button>
        ))}
      </div>

      {/* Operator cards */}
      <div className="space-y-3">
        {displayed.length === 0 && (
          <div className="rounded-xl p-8 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <BarChart3 size={32} className="mx-auto mb-2" style={{ color: 'var(--muted)' }} />
            <p style={{ color: 'var(--muted)' }}>Nessun dato per il periodo selezionato</p>
          </div>
        )}
        {displayed.map(({ op, revenue, completed, noShow, ticketMedio, commission, productRevenue, serviceRevenue, topList, nPayments }) => {
          const share = totRevenue > 0 ? (revenue / totRevenue) * 100 : 0;
          const isExpanded = expandedId === op.id;
          return (
            <div key={op.id} className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              {/* Card header */}
              <button
                className="w-full flex items-center gap-4 p-4 text-left hover:opacity-80 transition-opacity"
                onClick={() => setExpandedId(isExpanded ? null : op.id)}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0"
                  style={{ background: op.color }}>
                  {op.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-white truncate">{op.name}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: 'var(--bg-page)', color: 'var(--muted)' }}>
                      {op.role}
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-1.5 h-1.5 rounded-full w-full" style={{ background: 'var(--bg-page)' }}>
                    <div className="h-1.5 rounded-full transition-all" style={{ width: `${share.toFixed(1)}%`, background: op.color }} />
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                    {share.toFixed(1)}% del fatturato totale
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold text-white">€{revenue.toFixed(2)}</p>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>{nPayments} pagamenti</p>
                </div>
                <div className="ml-2" style={{ color: 'var(--muted)' }}>
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </button>

              {/* Expanded details */}
              {isExpanded && (
                <div className="px-4 pb-4 space-y-4" style={{ borderTop: '1px solid var(--border)' }}>
                  {/* KPI grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4">
                    <div className="rounded-lg p-3" style={{ background: 'var(--bg-page)' }}>
                      <div className="flex items-center gap-2 mb-1">
                        <Award size={14} style={{ color: '#6366f1' }} />
                        <p className="text-xs" style={{ color: 'var(--muted)' }}>Commissioni</p>
                      </div>
                      <p className="text-base font-bold" style={{ color: '#6366f1' }}>€{commission.toFixed(2)}</p>
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>{op.commissionRate ?? 0}% del fatturato</p>
                    </div>
                    <div className="rounded-lg p-3" style={{ background: 'var(--bg-page)' }}>
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingUp size={14} style={{ color: '#22c55e' }} />
                        <p className="text-xs" style={{ color: 'var(--muted)' }}>Ticket medio</p>
                      </div>
                      <p className="text-base font-bold" style={{ color: '#22c55e' }}>€{ticketMedio.toFixed(2)}</p>
                    </div>
                    <div className="rounded-lg p-3" style={{ background: 'var(--bg-page)' }}>
                      <div className="flex items-center gap-2 mb-1">
                        <Users size={14} style={{ color: '#f59e0b' }} />
                        <p className="text-xs" style={{ color: 'var(--muted)' }}>App. completati</p>
                      </div>
                      <p className="text-base font-bold" style={{ color: '#f59e0b' }}>{completed}</p>
                    </div>
                    <div className="rounded-lg p-3" style={{ background: 'var(--bg-page)' }}>
                      <div className="flex items-center gap-2 mb-1">
                        <CalendarX size={14} style={{ color: '#ef4444' }} />
                        <p className="text-xs" style={{ color: 'var(--muted)' }}>No-show</p>
                      </div>
                      <p className="text-base font-bold" style={{ color: '#ef4444' }}>{noShow}</p>
                    </div>
                    <div className="rounded-lg p-3" style={{ background: 'var(--bg-page)' }}>
                      <div className="flex items-center gap-2 mb-1">
                        <DollarSign size={14} style={{ color: '#8b5cf6' }} />
                        <p className="text-xs" style={{ color: 'var(--muted)' }}>Servizi</p>
                      </div>
                      <p className="text-base font-bold" style={{ color: '#8b5cf6' }}>€{serviceRevenue.toFixed(2)}</p>
                    </div>
                    <div className="rounded-lg p-3" style={{ background: 'var(--bg-page)' }}>
                      <div className="flex items-center gap-2 mb-1">
                        <ShoppingBag size={14} style={{ color: '#06b6d4' }} />
                        <p className="text-xs" style={{ color: 'var(--muted)' }}>Prodotti</p>
                      </div>
                      <p className="text-base font-bold" style={{ color: '#06b6d4' }}>€{productRevenue.toFixed(2)}</p>
                    </div>
                  </div>

                  {/* Top services */}
                  {topList.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold mb-2" style={{ color: 'var(--muted)' }}>TOP SERVIZI</p>
                      <div className="space-y-1.5">
                        {topList.map(([name, val]) => (
                          <div key={name} className="flex items-center gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between text-xs mb-0.5">
                                <span className="truncate text-white">{name}</span>
                                <span style={{ color: 'var(--muted)' }}>€{val.toFixed(0)}</span>
                              </div>
                              <div className="h-1 rounded-full" style={{ background: 'var(--bg-page)' }}>
                                <div className="h-1 rounded-full" style={{
                                  width: `${topList[0][1] > 0 ? (val / topList[0][1]) * 100 : 0}%`,
                                  background: op.color,
                                }} />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
