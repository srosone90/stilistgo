'use client';

import React, { useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { useSalon } from '@/context/SalonContext';
import KpiCard from './KpiCard';
import {
  getTotalIncome, getTotalExpense, getOperationalMargin,
  getExpenseIncidence, getTaxFund, getNetProfit,
  getLast6MonthsData, getIncomeByCategory, formatCurrency,
  filterByMonth,
} from '@/lib/calculations';
import { format, parseISO, isToday, isAfter, startOfToday } from 'date-fns';
import { it } from 'date-fns/locale';
import { CATEGORY_ICONS, EntryCategory } from '@/types';
import { FileDown, CalendarDays, Users, Package, AlertTriangle, Clock } from 'lucide-react';
import { exportDashboardPDF } from '@/lib/pdf';
import { useCombinedTransactions } from '@/lib/useCombinedTransactions';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl p-3 text-xs" style={{ background: '#1c1c27', border: '1px solid #2e2e40', color: '#f4f4f5' }}>
        <p className="font-semibold mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color }}>{p.name}: {formatCurrency(p.value)}</p>
        ))}
      </div>
    );
  }
  return null;
};

export default function Dashboard({ showAccounting = true }: { showAccounting?: boolean }) {
  const { settings } = useApp();
  const transactions = useCombinedTransactions();
  const { clients, appointments, products, payments, operators, activeOperatorId, cashSessions } = useSalon();
  const thisMonth = format(new Date(), 'yyyy-MM');
  const monthTx = useMemo(() => filterByMonth(transactions, thisMonth), [transactions, thisMonth]);

  const income = useMemo(() => getTotalIncome(monthTx), [monthTx]);
  const expense = useMemo(() => getTotalExpense(monthTx), [monthTx]);
  const margin = getOperationalMargin(income, expense);
  const incidence = getExpenseIncidence(income, expense);
  const taxFund = getTaxFund(income, settings.taxRate);
  const net = getNetProfit(income, expense, taxFund);

  const chartData = useMemo(() => getLast6MonthsData(transactions, settings.taxRate), [transactions, settings.taxRate]);
  const byCategory = useMemo(() => getIncomeByCategory(monthTx), [monthTx]);
  const topCategories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);

  // ─── Salon KPIs ───────────────────────────────────────────────────────────
  const today = format(new Date(), 'yyyy-MM-dd');
  const todayAppts = useMemo(() =>
    appointments.filter(a => a.date === today && a.status !== 'cancelled' && a.status !== 'no-show'),
    [appointments, today]);
  const completedToday = todayAppts.filter(a => a.status === 'completed').length;
  const scheduledToday = todayAppts.filter(a => a.status !== 'completed').length;

  const upcomingAppts = useMemo(() =>
    appointments
      .filter(a => isAfter(parseISO(a.date), startOfToday()) && a.status !== 'cancelled')
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
      .slice(0, 5),
    [appointments]);

  const lowStockProducts = useMemo(() =>
    products.filter(p => p.active && p.stock <= p.minStock),
    [products]);

  const openCashSession = useMemo(() =>
    cashSessions.find(s => !s.closedAt),
    [cashSessions]);

  const todayRevenue = useMemo(() =>
    payments.filter(p => p.date === today).reduce((sum, p) => sum + p.total, 0),
    [payments, today]);

  const activeOp = operators.find(o => o.id === activeOperatorId);
  const isOwner = !activeOperatorId || !activeOp || activeOp.role === 'owner';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm mt-1" style={{ color: '#71717a' }}>
            {format(new Date(), 'EEEE dd MMMM yyyy', { locale: it })}
          </p>
        </div>
        {showAccounting && (
          <button
            onClick={() => exportDashboardPDF(transactions, settings, format(new Date(), 'MMMM yyyy'), monthTx)}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg"
            style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}
            title="Esporta report mensile in PDF">
            <FileDown size={13} /> Esporta PDF
          </button>
        )}
      </div>

      {/* ─── Salon KPIs ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl p-4" style={{ background: '#1c1c27', border: '1px solid #2e2e40' }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg" style={{ background: 'rgba(99,102,241,0.15)' }}>
              <CalendarDays size={14} style={{ color: '#818cf8' }} />
            </div>
            <span className="text-xs font-medium" style={{ color: '#71717a' }}>Oggi</span>
          </div>
          <p className="text-2xl font-bold text-white">{todayAppts.length}</p>
          <p className="text-xs mt-1" style={{ color: '#71717a' }}>
            {completedToday} completati · {scheduledToday} da fare
          </p>
        </div>
        <div className="rounded-2xl p-4" style={{ background: '#1c1c27', border: '1px solid #2e2e40' }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg" style={{ background: 'rgba(34,197,94,0.15)' }}>
              <Users size={14} style={{ color: '#22c55e' }} />
            </div>
            <span className="text-xs font-medium" style={{ color: '#71717a' }}>Clienti totali</span>
          </div>
          <p className="text-2xl font-bold text-white">{clients.length}</p>
          <p className="text-xs mt-1" style={{ color: '#71717a' }}>
            {clients.filter(c => c.loyaltyPoints > 0).length} con punti fedeltà
          </p>
        </div>
        <div className="rounded-2xl p-4" style={{ background: '#1c1c27', border: '1px solid #2e2e40' }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg" style={{ background: 'rgba(245,158,11,0.15)' }}>
              <Package size={14} style={{ color: '#f59e0b' }} />
            </div>
            <span className="text-xs font-medium" style={{ color: '#71717a' }}>Magazzino</span>
          </div>
          <p className="text-2xl font-bold text-white">{products.filter(p => p.active).length}</p>
          {lowStockProducts.length > 0 ? (
            <p className="text-xs mt-1 flex items-center gap-1" style={{ color: '#f87171' }}>
              <AlertTriangle size={10} /> {lowStockProducts.length} sotto scorta
            </p>
          ) : (
            <p className="text-xs mt-1" style={{ color: '#22c55e' }}>Scorte OK</p>
          )}
        </div>
        <div className="rounded-2xl p-4" style={{ background: '#1c1c27', border: isToday(new Date()) && openCashSession ? '1px solid rgba(34,197,94,0.4)' : '1px solid #2e2e40' }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg" style={{ background: 'rgba(99,102,241,0.15)' }}>
              <Clock size={14} style={{ color: '#818cf8' }} />
            </div>
            <span className="text-xs font-medium" style={{ color: '#71717a' }}>Incasso oggi</span>
          </div>
          <p className="text-2xl font-bold text-white">{formatCurrency(todayRevenue)}</p>
          <p className="text-xs mt-1" style={{ color: openCashSession ? '#22c55e' : '#71717a' }}>
            {openCashSession ? '● Cassa aperta' : 'Cassa chiusa'}
          </p>
        </div>
      </div>

      {/* Prossimi appuntamenti */}
      {upcomingAppts.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: '#1c1c27', border: '1px solid #2e2e40' }}>
          <h3 className="font-semibold text-white mb-3 text-sm">Prossimi appuntamenti</h3>
          <div className="space-y-2">
            {upcomingAppts.map(a => {
              const client = clients.find(c => c.id === a.clientId);
              const op = operators.find(o => o.id === a.operatorId);
              return (
                <div key={a.id} className="flex items-center gap-3 py-1.5 px-2 rounded-lg" style={{ background: '#12121a' }}>
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: op?.color || '#6366f1' }} />
                  <span className="text-xs font-medium text-white flex-1 truncate">
                    {client ? `${client.firstName} ${client.lastName}` : '—'}
                  </span>
                  <span className="text-xs" style={{ color: '#71717a' }}>
                    {format(parseISO(a.date), 'dd/MM', { locale: it })} {a.startTime}
                  </span>
                  {op && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: `${op.color}25`, color: op.color }}>{op.name}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Low stock alert */}
      {lowStockProducts.length > 0 && (
        <div className="rounded-xl px-4 py-3 flex items-start gap-3 text-sm"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Scorte basse: </span>
            {lowStockProducts.slice(0, 4).map(p => p.name).join(', ')}
            {lowStockProducts.length > 4 ? ` e altri ${lowStockProducts.length - 4}` : ''}
          </div>
        </div>
      )}

      {/* ─── Accounting section (owner only) ─── */}
      {showAccounting && (
        <>
          {/* KPI Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard title="Totale Entrate (mese)" value={formatCurrency(income)} icon="💰" color="#22c55e" gradient="#22c55e" />
            <KpiCard title="Totale Uscite (mese)" value={formatCurrency(expense)} icon="💸" color="#ef4444" gradient="#ef4444" />
            <KpiCard
              title="Margine Operativo"
              value={formatCurrency(margin)}
              subValue={`Incidenza spese: ${incidence.toFixed(1)}%`}
              icon="📊" color="#6366f1" gradient="#6366f1"
              trend={margin >= 0 ? 'up' : 'down'}
              trendText={margin >= 0 ? 'Positivo' : 'Negativo'}
            />
            <KpiCard
              title={`Utile Reale (tasse ${settings.taxRate}%)`}
              value={formatCurrency(net)}
              subValue={`Fondo tasse: ${formatCurrency(taxFund)}`}
              icon="🏦" color="#f59e0b" gradient="#f59e0b"
            />
          </div>

          {/* Chart + Categories */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 rounded-2xl p-5" style={{ background: '#1c1c27', border: '1px solid #2e2e40' }}>
              <h3 className="font-semibold text-white mb-4">Andamento Ultimi 6 Mesi</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} barGap={4} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#2e2e40" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `€${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
                  <Bar dataKey="Entrate" fill="#22c55e" radius={[4,4,0,0]} />
                  <Bar dataKey="Uscite" fill="#ef4444" radius={[4,4,0,0]} />
                  <Bar dataKey="Utile Netto" fill="#6366f1" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="rounded-2xl p-5" style={{ background: '#1c1c27', border: '1px solid #2e2e40' }}>
              <h3 className="font-semibold text-white mb-4">Top Categorie (mese)</h3>
              {topCategories.length === 0 ? (
                <p className="text-sm" style={{ color: '#71717a' }}>Nessun dato questo mese</p>
              ) : (
                <div className="space-y-3">
                  {topCategories.map(([cat, val]) => {
                    const pct = income > 0 ? (val / income) * 100 : 0;
                    return (
                      <div key={cat}>
                        <div className="flex justify-between text-xs mb-1">
                          <span style={{ color: '#d4d4d8' }}>{CATEGORY_ICONS[cat as EntryCategory]} {cat}</span>
                          <span className="font-semibold text-white">{pct.toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full" style={{ background: '#2e2e40' }}>
                          <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#6366f1,#a855f7)' }} />
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: '#71717a' }}>{formatCurrency(val)}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {incidence > 0 && (
            <div className="rounded-xl px-4 py-3 flex items-center gap-3 text-sm"
              style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#fbbf24' }}>
              <span className="text-lg">📊</span>
              <span>
                Questo mese le <strong>uscite pesano il {incidence.toFixed(1)}%</strong> sull&apos;incasso totale.
                {incidence > 60 ? ' ⚠️ Attenzione: incidenza spese elevata.' : ' ✅ Situazione nella norma.'}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

