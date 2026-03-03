'use client';

import React, { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { useSalon } from '@/context/SalonContext';
import { isCashIn, isCashOut, formatCurrency, getTotalIncome, getTotalExpense } from '@/lib/calculations';
import { Transaction, CATEGORY_ICONS, EntryCategory, EXPENSE_TYPE_ICONS, ExpenseType } from '@/types';
import { format, parseISO } from 'date-fns';
import { Trash2, ChevronUp, ChevronDown, FileDown, RotateCcw } from 'lucide-react';
import { exportTransactionsPDF } from '@/lib/pdf';
import { useCombinedTransactions } from '@/lib/useCombinedTransactions';

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, React.CSSProperties> = {
    'Pagato': { background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' },
    'Da Pagare': { background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' },
    'Rateizzato': { background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' },
  };
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={styles[status] || {}}>
      {status}
    </span>
  );
}

export default function TabularView() {
  const { deleteEntry } = useApp();
  const { payments, addPayment } = useSalon();
  const transactions = useCombinedTransactions();

  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [sortField, setSortField] = useState<'date' | 'amount'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [stornoId, setStornoId] = useState<string | null>(null);

  const months = Array.from({ length: 12 }, (_, i) => {
    const m = String(i + 1).padStart(2, '0');
    return m;
  });

  const years = useMemo(() => {
    const s = new Set<string>();
    transactions.forEach(t => s.add(t.date.slice(0, 4)));
    return Array.from(s).sort().reverse();
  }, [transactions]);

  const filtered = useMemo(() => {
    let tx = [...transactions];
    if (filterType !== 'all') tx = tx.filter(t => t.type === filterType);
    if (filterMonth) tx = tx.filter(t => t.date.slice(5, 7) === filterMonth);
    if (filterYear) tx = tx.filter(t => t.date.slice(0, 4) === filterYear);
    if (filterCategory) tx = tx.filter(t => isCashIn(t) ? t.category === filterCategory : (t as any).expenseType === filterCategory);

    tx.sort((a, b) => {
      const av = sortField === 'date' ? a.date : a.amount;
      const bv = sortField === 'date' ? b.date : b.amount;
      return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });

    return tx;
  }, [transactions, filterType, filterMonth, filterYear, filterCategory, sortField, sortDir]);

  const totalIncome = useMemo(() => getTotalIncome(filtered), [filtered]);
  const totalExpense = useMemo(() => getTotalExpense(filtered), [filtered]);

  const toggleSort = (field: 'date' | 'amount') => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const SortIcon = ({ field }: { field: 'date' | 'amount' }) => {
    if (sortField !== field) return <ChevronUp size={13} style={{ color: 'var(--border-light)' }} />;
    return sortDir === 'asc' ? <ChevronUp size={13} style={{ color: '#6366f1' }} /> : <ChevronDown size={13} style={{ color: '#6366f1' }} />;
  };

  const selectStyle: React.CSSProperties = {
    background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px',
    padding: '6px 10px', color: 'var(--text-2)', fontSize: '13px', outline: 'none',
  };

  return (
    <>
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Tabella Movimenti</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>Storico completo di entrate e uscite con filtri avanzati</p>
      </div>

      {/* Filters */}
      <div className="rounded-2xl p-4 flex flex-wrap gap-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <select value={filterType} onChange={e => setFilterType(e.target.value as any)} style={selectStyle}>
          <option value="all">Tutti</option>
          <option value="income">Entrate</option>
          <option value="expense">Uscite</option>
        </select>
        <select value={filterYear} onChange={e => setFilterYear(e.target.value)} style={selectStyle}>
          <option value="">Tutti gli anni</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={selectStyle}>
          <option value="">Tutti i mesi</option>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <button onClick={() => { setFilterType('all'); setFilterMonth(''); setFilterYear(''); setFilterCategory(''); }}
          className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--accent-light)', border: '1px solid rgba(99,102,241,0.3)' }}>
          Reset filtri
        </button>
        <button
          onClick={() => exportTransactionsPDF(filtered, { type: filterType, month: filterMonth, year: filterYear })}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg ml-auto"
          style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}
          title="Esporta la lista attuale in PDF">
          <FileDown size={13} /> Esporta PDF
        </button>
      </div>

      {/* Totals bar */}
      <div className="flex gap-4 text-sm">
        <span style={{ color: '#22c55e' }}>↑ Entrate: <strong>{formatCurrency(totalIncome)}</strong></span>
        <span style={{ color: '#ef4444' }}>↓ Uscite: <strong>{formatCurrency(totalExpense)}</strong></span>
        <span style={{ color: '#6366f1' }}>= Saldo: <strong style={{ color: totalIncome - totalExpense >= 0 ? '#22c55e' : '#ef4444' }}>{formatCurrency(totalIncome - totalExpense)}</strong></span>
        <span style={{ color: 'var(--muted)' }}>{filtered.length} voci</span>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--bg-input)' }}>
              <th className="text-left px-4 py-3 font-medium cursor-pointer select-none" style={{ color: 'var(--muted)' }} onClick={() => toggleSort('date')}>
                <span className="flex items-center gap-1">Data <SortIcon field="date" /></span>
              </th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--muted)' }}>Tipo</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--muted)' }}>Dettaglio</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--muted)' }}>Metodo / Stato</th>
              <th className="text-right px-4 py-3 font-medium cursor-pointer select-none" style={{ color: 'var(--muted)' }} onClick={() => toggleSort('amount')}>
                <span className="flex items-center justify-end gap-1">Importo <SortIcon field="amount" /></span>
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12" style={{ color: 'var(--border-light)' }}>
                  Nessun movimento trovato
                </td>
              </tr>
            ) : (
              filtered.map((t, idx) => (
                <tr key={t.id}
                  style={{ background: idx % 2 === 0 ? 'var(--bg-card)' : '#18181f', borderBottom: '1px solid var(--border)' }}>
                  <td className="px-4 py-3 text-white">{format(parseISO(t.date), 'dd/MM/yyyy')}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={isCashIn(t)
                        ? { background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }
                        : { background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                      {isCashIn(t) ? '▲ Entrata' : '▼ Uscita'}
                    </span>
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-2)' }}>
                    {isCashIn(t) ? (
                      <span>{CATEGORY_ICONS[t.category as EntryCategory]} {t.category}
                        {t.notes && <span className="ml-2 text-xs" style={{ color: 'var(--muted)' }}>— {t.notes}</span>}
                      </span>
                    ) : (
                      <span>{EXPENSE_TYPE_ICONS[(t as any).expenseType as ExpenseType]} {(t as any).supplier}
                        <span className="ml-2 text-xs" style={{ color: 'var(--muted)' }}>{(t as any).expenseType}</span>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isCashIn(t)
                      ? <span className="text-xs" style={{ color: 'var(--muted)' }}>{t.method} · {t.source}</span>
                      : <StatusBadge status={(t as any).status} />
                    }
                    {t.id.startsWith('salon-pay-') && (
                      <span className="ml-2 text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--accent-light)', border: '1px solid rgba(99,102,241,0.2)' }}>Cassa</span>
                    )}
                    {isCashIn(t) ? '+' : '-'}{formatCurrency(t.amount)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {t.id.startsWith('salon-pay-') ? (
                      <button onClick={e => { e.stopPropagation(); setStornoId(t.id); }} title="Storna incasso"
                        style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', color: '#fbbf24', borderRadius: '6px', padding: '4px 7px', cursor: 'pointer', opacity: t.amount < 0 ? 0.4 : 1, pointerEvents: t.amount < 0 ? 'none' : undefined }}
                        disabled={t.amount < 0}>
                        <RotateCcw size={13} />
                      </button>
                    ) : confirmDelete === t.id ? (
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={async () => { await deleteEntry(t.id); setConfirmDelete(null); }}
                          className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(239,68,68,0.8)', color: 'white' }}>
                          Conferma
                        </button>
                        <button onClick={() => setConfirmDelete(null)}
                          className="text-xs px-2 py-1 rounded" style={{ background: 'var(--border)', color: 'var(--muted)' }}>
                          No
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDelete(t.id)} className="opacity-40 hover:opacity-100 transition-opacity p-1 rounded"
                        style={{ color: '#ef4444' }}>
                        <Trash2 size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>

      {/* Storno modal (TabularView) */}
      {stornoId && (() => {
        const SALON_PAY_PREFIX = 'salon-pay-';
        const origPayId = stornoId.startsWith(SALON_PAY_PREFIX) ? stornoId.slice(SALON_PAY_PREFIX.length) : null;
        const orig = origPayId ? payments.find(p => p.id === origPayId) : null;
        if (!orig) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
            <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: '#18181f', border: '1px solid var(--border)' }}>
              <h3 className="font-semibold text-white mb-1 flex items-center gap-2">
                <RotateCcw size={16} style={{ color: '#fbbf24' }} /> Storna incasso
              </h3>
              <p className="text-sm mb-1 mt-2" style={{ color: 'var(--text-3)' }}>
                Cliente: <span className="text-white font-medium">{orig.clientName || '—'}</span>
              </p>
              <p className="text-sm mb-4" style={{ color: 'var(--text-3)' }}>
                Importo: <span style={{ color: '#f87171', fontWeight: 700 }}>-{formatCurrency(orig.total)}</span>
              </p>
              <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
                Verrà registrato un movimento di storno negativo. L&rsquo;incasso originale rimane nello storico.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setStornoId(null)}
                  style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: '8px', padding: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  Annulla
                </button>
                <button onClick={() => {
                    addPayment({
                      appointmentId: orig.appointmentId,
                      clientId: orig.clientId,
                      clientName: orig.clientName,
                      operatorId: orig.operatorId,
                      date: format(new Date(), 'yyyy-MM-dd'),
                      items: orig.items.map(i => ({ ...i, price: -i.price })),
                      subtotal: -orig.subtotal,
                      discountPct: 0,
                      discountEur: 0,
                      total: -orig.total,
                      paymentMethod: orig.paymentMethod,
                      cashAmount: -orig.cashAmount,
                      cardAmount: -orig.cardAmount,
                      giftCardCode: orig.giftCardCode,
                      giftCardAmount: -orig.giftCardAmount,
                      notes: `🔄 Storno di incasso ${orig.id.slice(-6)} del ${orig.date}`,
                    });
                    setStornoId(null);
                  }}
                  style={{ flex: 1, background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.35)', color: '#fbbf24', borderRadius: '8px', padding: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}>
                  Conferma storno
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
