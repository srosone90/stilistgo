'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import {
  ENTRY_CATEGORIES, ENTRY_SOURCES, ENTRY_METHODS,
  EXPENSE_TYPES, EXPENSE_STATUSES, CATEGORY_ICONS, EXPENSE_TYPE_ICONS,
  EntryCategory, EntrySource, EntryMethod, ExpenseType, ExpenseStatus,
  CashIn, CashOut,
} from '@/types';
import { format } from 'date-fns';

interface EntryFormProps {
  onClose: () => void;
  defaultType?: 'income' | 'expense';
}

const today = format(new Date(), 'yyyy-MM-dd');

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#12121a',
  border: '1px solid #2e2e40',
  borderRadius: '10px',
  padding: '10px 14px',
  color: '#f4f4f5',
  fontSize: '14px',
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 500,
  color: '#71717a',
  marginBottom: '6px',
};

export default function EntryForm({ onClose, defaultType = 'income' }: EntryFormProps) {
  const { addEntry } = useApp();
  const [type, setType] = useState<'income' | 'expense'>(defaultType);
  const [error, setError] = useState('');

  // Income fields
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<EntryCategory>(ENTRY_CATEGORIES[0]);
  const [source, setSource] = useState<EntrySource>(ENTRY_SOURCES[0]);
  const [method, setMethod] = useState<EntryMethod>(ENTRY_METHODS[0]);
  const [notes, setNotes] = useState('');

  // Expense fields
  const [expDate, setExpDate] = useState(today);
  const [expAmount, setExpAmount] = useState('');
  const [supplier, setSupplier] = useState('');
  const [expenseType, setExpenseType] = useState<ExpenseType>(EXPENSE_TYPES[0]);
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<ExpenseStatus>(EXPENSE_STATUSES[0]);
  const [expNotes, setExpNotes] = useState('');

  const validate = (): boolean => {
    if (type === 'income') {
      if (!amount || parseFloat(amount) <= 0) { setError('Inserisci un importo valido maggiore di zero.'); return false; }
      if (!date) { setError('La data è obbligatoria.'); return false; }
    } else {
      if (!expAmount || parseFloat(expAmount) <= 0) { setError('Inserisci un importo valido maggiore di zero.'); return false; }
      if (!expDate) { setError('La data è obbligatoria.'); return false; }
      if (!supplier.trim()) { setError('Il fornitore è obbligatorio.'); return false; }
    }
    setError('');
    return true;
  };

  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      if (type === 'income') {
        await addEntry({ type: 'income', date, amount: parseFloat(amount), category, source, method, notes } as Omit<CashIn, 'id' | 'createdAt'>);
      } else {
        await addEntry({ type: 'expense', date: expDate, amount: parseFloat(expAmount), supplier: supplier.trim(), expenseType, dueDate, status, notes: expNotes } as Omit<CashOut, 'id' | 'createdAt'>);
      }
      onClose();
    } catch {
      setError('Errore nel salvataggio. Riprova.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-lg rounded-2xl shadow-2xl" style={{ background: '#1c1c27', border: '1px solid #2e2e40' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #2e2e40' }}>
          <h2 className="font-bold text-white text-lg">Nuova Voce</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10">
            <X size={20} />
          </button>
        </div>

        {/* Type toggle */}
        <div className="px-6 pt-5">
          <div className="flex rounded-xl overflow-hidden" style={{ background: '#12121a', border: '1px solid #2e2e40' }}>
            <button
              type="button"
              onClick={() => setType('income')}
              className="flex-1 py-2 text-sm font-semibold transition-all"
              style={type === 'income' ? { background: 'rgba(34,197,94,0.2)', color: '#22c55e', border: 'none' } : { background: 'transparent', color: '#71717a', border: 'none' }}
            >
              💰 Entrata
            </button>
            <button
              type="button"
              onClick={() => setType('expense')}
              className="flex-1 py-2 text-sm font-semibold transition-all"
              style={type === 'expense' ? { background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: 'none' } : { background: 'transparent', color: '#71717a', border: 'none' }}
            >
              💸 Uscita
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {type === 'income' ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={labelStyle}>Data *</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} required />
                </div>
                <div>
                  <label style={labelStyle}>Importo (€) *</label>
                  <input type="number" min="0.01" step="0.01" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} style={inputStyle} required />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Categoria *</label>
                <select value={category} onChange={e => setCategory(e.target.value as EntryCategory)} style={inputStyle}>
                  {ENTRY_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_ICONS[c]} {c}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={labelStyle}>Sorgente</label>
                  <select value={source} onChange={e => setSource(e.target.value as EntrySource)} style={inputStyle}>
                    {ENTRY_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Metodo Pagamento</label>
                  <select value={method} onChange={e => setMethod(e.target.value as EntryMethod)} style={inputStyle}>
                    {ENTRY_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Note</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Note opzionali..." rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={labelStyle}>Data *</label>
                  <input type="date" value={expDate} onChange={e => setExpDate(e.target.value)} style={inputStyle} required />
                </div>
                <div>
                  <label style={labelStyle}>Importo (€) *</label>
                  <input type="number" min="0.01" step="0.01" placeholder="0.00" value={expAmount} onChange={e => setExpAmount(e.target.value)} style={inputStyle} required />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Fornitore *</label>
                <input type="text" placeholder="es. L'Oréal, Enel, Affitto..." value={supplier} onChange={e => setSupplier(e.target.value)} style={inputStyle} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={labelStyle}>Tipologia</label>
                  <select value={expenseType} onChange={e => setExpenseType(e.target.value as ExpenseType)} style={inputStyle}>
                    {EXPENSE_TYPES.map(t => <option key={t} value={t}>{EXPENSE_TYPE_ICONS[t]} {t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Stato</label>
                  <select value={status} onChange={e => setStatus(e.target.value as ExpenseStatus)} style={inputStyle}>
                    {EXPENSE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Scadenza</label>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Note</label>
                <textarea value={expNotes} onChange={e => setExpNotes(e.target.value)} placeholder="Note opzionali..." rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
            </>
          )}

          {error && (
            <div className="text-sm py-2 px-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
              ⚠️ {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{ background: '#12121a', color: '#71717a', border: '1px solid #2e2e40' }}>
              Annulla
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60"
              style={{ background: type === 'income' ? 'rgba(34,197,94,0.8)' : 'rgba(239,68,68,0.8)', border: 'none' }}>
              {saving ? 'Salvataggio...' : `Salva ${type === 'income' ? 'Entrata' : 'Uscita'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
