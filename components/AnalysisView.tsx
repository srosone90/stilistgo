'use client';

import React, { useMemo, useState } from 'react';
import { useApp } from '@/context/AppContext';
import {
  getLast6MonthsData, getIncomeByCategory, getExpenseByType,
  getIncomeBySource, getIncomeByMethod, formatCurrency,
  filterByMonth, filterByYear, getTotalIncome, getTotalExpense,
} from '@/lib/calculations';
import { CATEGORY_ICONS, EntryCategory, EXPENSE_TYPE_ICONS, ExpenseType } from '@/types';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { format } from 'date-fns';
import { FileDown } from 'lucide-react';
import { exportAnalysisPDF } from '@/lib/pdf';
import { useCombinedTransactions } from '@/lib/useCombinedTransactions';

const COLORS = ['#6366f1', '#a855f7', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl p-3 text-xs" style={{ background: '#1c1c27', border: '1px solid #2e2e40', color: '#f4f4f5' }}>
        <p className="font-semibold mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color || p.fill }}>{p.name}: {formatCurrency(p.value)}</p>
        ))}
      </div>
    );
  }
  return null;
};

const CustomPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export default function AnalysisView() {
  const { settings } = useApp();
  const transactions = useCombinedTransactions();
  const [period, setPeriod] = useState<'month' | 'year'>('month');
  const [selectedYear, setSelectedYear] = useState(format(new Date(), 'yyyy'));
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));

  const filtered = useMemo(() => {
    return period === 'month'
      ? filterByMonth(transactions, selectedMonth)
      : filterByYear(transactions, selectedYear);
  }, [transactions, period, selectedMonth, selectedYear]);

  const chartData = useMemo(() => getLast6MonthsData(transactions, settings.taxRate), [transactions, settings.taxRate]);

  const byCategory = useMemo(() => getIncomeByCategory(filtered), [filtered]);
  const byExpType = useMemo(() => getExpenseByType(filtered), [filtered]);
  const bySource = useMemo(() => getIncomeBySource(filtered), [filtered]);
  const byMethod = useMemo(() => getIncomeByMethod(filtered), [filtered]);

  const catPieData = Object.entries(byCategory).map(([name, value]) => ({ name: `${CATEGORY_ICONS[name as EntryCategory]} ${name}`, value }));
  const expPieData = Object.entries(byExpType).map(([name, value]) => ({ name: `${EXPENSE_TYPE_ICONS[name as ExpenseType]} ${name}`, value }));
  const sourcePieData = Object.entries(bySource).map(([name, value]) => ({ name, value }));
  const methodPieData = Object.entries(byMethod).map(([name, value]) => ({ name, value }));

  const years = useMemo(() => {
    const s = new Set<string>();
    transactions.forEach(t => s.add(t.date.slice(0, 4)));
    return Array.from(s).sort().reverse();
  }, [transactions]);

  const totalInc = getTotalIncome(filtered);
  const totalExp = getTotalExpense(filtered);

  const selectStyle: React.CSSProperties = {
    background: '#12121a', border: '1px solid #2e2e40', borderRadius: '8px',
    padding: '6px 10px', color: '#d4d4d8', fontSize: '13px', outline: 'none',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4 justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Analisi</h1>
          <p className="text-sm mt-1" style={{ color: '#71717a' }}>Grafici e indicatori finanziari</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select value={period} onChange={e => setPeriod(e.target.value as any)} style={selectStyle}>
            <option value="month">Per mese</option>
            <option value="year">Per anno</option>
          </select>
          {period === 'month' ? (
            <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} style={selectStyle} />
          ) : (
            <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} style={selectStyle}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          )}
          <button
            onClick={() => {
              const label = period === 'month' ? selectedMonth : selectedYear;
              exportAnalysisPDF(filtered, label, settings, transactions);
            }}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg"
            style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}
            title="Esporta report analitico in PDF">
            <FileDown size={13} /> Esporta PDF
          </button>
        </div>
      </div>

      {/* 6-month bar chart */}
      <div className="rounded-2xl p-5" style={{ background: '#1c1c27', border: '1px solid #2e2e40' }}>
        <h3 className="font-semibold text-white mb-4">Entrate vs Uscite vs Utile Netto — Ultimi 6 Mesi</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} barGap={4} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="#2e2e40" vertical={false} />
            <XAxis dataKey="month" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
            <Legend wrapperStyle={{ fontSize: 12, color: '#71717a' }} />
            <Bar dataKey="Entrate" fill="#22c55e" radius={[4,4,0,0]} />
            <Bar dataKey="Uscite" fill="#ef4444" radius={[4,4,0,0]} />
            <Bar dataKey="Utile Netto" fill="#6366f1" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Pie charts grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Income by category */}
        <div className="rounded-2xl p-5" style={{ background: '#1c1c27', border: '1px solid #2e2e40' }}>
          <h3 className="font-semibold text-white mb-1">Entrate per Categoria</h3>
          <p className="text-xs mb-4" style={{ color: '#71717a' }}>Totale: {formatCurrency(totalInc)}</p>
          {catPieData.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: '#3f3f5a' }}>Nessun dato</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={catPieData} cx="50%" cy="50%" outerRadius={80} labelLine={false} label={CustomPieLabel} dataKey="value">
                  {catPieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#71717a' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Expense by type */}
        <div className="rounded-2xl p-5" style={{ background: '#1c1c27', border: '1px solid #2e2e40' }}>
          <h3 className="font-semibold text-white mb-1">Uscite per Tipologia</h3>
          <p className="text-xs mb-4" style={{ color: '#71717a' }}>Totale: {formatCurrency(totalExp)}</p>
          {expPieData.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: '#3f3f5a' }}>Nessun dato</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={expPieData} cx="50%" cy="50%" outerRadius={80} labelLine={false} label={CustomPieLabel} dataKey="value">
                  {expPieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#71717a' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Income by source */}
        <div className="rounded-2xl p-5" style={{ background: '#1c1c27', border: '1px solid #2e2e40' }}>
          <h3 className="font-semibold text-white mb-4">Entrate per Sorgente</h3>
          {sourcePieData.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: '#3f3f5a' }}>Nessun dato</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={sourcePieData} cx="50%" cy="50%" outerRadius={70} labelLine={false} label={CustomPieLabel} dataKey="value">
                  {sourcePieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#71717a' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Income by method */}
        <div className="rounded-2xl p-5" style={{ background: '#1c1c27', border: '1px solid #2e2e40' }}>
          <h3 className="font-semibold text-white mb-4">Entrate per Metodo Pagamento</h3>
          {methodPieData.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: '#3f3f5a' }}>Nessun dato</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={methodPieData} cx="50%" cy="50%" outerRadius={70} labelLine={false} label={CustomPieLabel} dataKey="value">
                  {methodPieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#71717a' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
