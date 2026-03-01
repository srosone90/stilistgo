'use client';

import React, { useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import KpiCard from './KpiCard';
import {
  getTotalIncome, getTotalExpense, getOperationalMargin,
  getExpenseIncidence, getTaxFund, getNetProfit,
  getLast6MonthsData, getIncomeByCategory, formatCurrency,
  filterByMonth,
} from '@/lib/calculations';
import { format } from 'date-fns';
import { CATEGORY_ICONS, EntryCategory } from '@/types';
import { FileDown } from 'lucide-react';
import { exportDashboardPDF } from '@/lib/pdf';
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

export default function Dashboard() {
  const { transactions, settings } = useApp();
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm mt-1" style={{ color: '#71717a' }}>
            Riepilogo economico — {format(new Date(), 'MMMM yyyy')}
          </p>
        </div>
        <button
          onClick={() => exportDashboardPDF(transactions, settings, format(new Date(), 'MMMM yyyy'), monthTx)}
          className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg mt-1"
          style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}
          title="Esporta report mensile in PDF">
          <FileDown size={13} /> Esporta PDF
        </button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Totale Entrate (mese)"
          value={formatCurrency(income)}
          icon="💰"
          color="#22c55e"
          gradient="#22c55e"
        />
        <KpiCard
          title="Totale Uscite (mese)"
          value={formatCurrency(expense)}
          icon="💸"
          color="#ef4444"
          gradient="#ef4444"
        />
        <KpiCard
          title="Margine Operativo"
          value={formatCurrency(margin)}
          subValue={`Incidenza spese: ${incidence.toFixed(1)}%`}
          icon="📊"
          color="#6366f1"
          gradient="#6366f1"
          trend={margin >= 0 ? 'up' : 'down'}
          trendText={margin >= 0 ? 'Positivo' : 'Negativo'}
        />
        <KpiCard
          title={`Utile Reale (tasse ${settings.taxRate}%)`}
          value={formatCurrency(net)}
          subValue={`Fondo tasse: ${formatCurrency(taxFund)}`}
          icon="🏦"
          color="#f59e0b"
          gradient="#f59e0b"
        />
      </div>

      {/* Chart + Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bar chart */}
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

        {/* Category breakdown */}
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

      {/* Incidenza alert */}
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
    </div>
  );
}
