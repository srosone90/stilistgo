'use client';

import React, { useState, useMemo } from 'react';
import { useSalon } from '@/context/SalonContext';
import { ClientSubscription, SubscriptionStatus } from '@/types/salon';
import { Plus, Search, X, CreditCard, CheckCircle2, AlertCircle, XCircle, Clock3, ChevronDown } from 'lucide-react';

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  active: 'Attivo', expired: 'Scaduto', exhausted: 'Esaurito', cancelled: 'Annullato',
};
const STATUS_COLORS: Record<SubscriptionStatus, string> = {
  active: '#22c55e', expired: '#f59e0b', exhausted: '#6366f1', cancelled: '#ef4444',
};
const STATUS_ICONS: Record<SubscriptionStatus, React.ReactNode> = {
  active: <CheckCircle2 size={12} />,
  expired: <Clock3 size={12} />,
  exhausted: <AlertCircle size={12} />,
  cancelled: <XCircle size={12} />,
};

const EMPTY_FORM: Omit<ClientSubscription, 'id' | 'createdAt'> = {
  clientId: '', clientName: '', name: '', serviceIds: [],
  totalSessions: 10, usedSessions: 0, price: 0,
  purchaseDate: new Date().toISOString().slice(0, 10),
  expiryDate: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
  status: 'active', notes: '', purchasedByOperatorId: '',
};

export default function AbbonamentiView({ newTrigger }: { newTrigger?: number }) {
  const { subscriptions, addSubscription, updateSubscription, deleteSubscription, useSubscriptionSession, clients, services, operators } = useSalon();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<SubscriptionStatus | 'all'>('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editTarget, setEditTarget] = useState<ClientSubscription | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDrop, setShowClientDrop] = useState(false);

  // Open add modal when FAB trigger fires
  React.useEffect(() => { if (newTrigger) openAdd(); }, [newTrigger]);

  function openAdd() { setForm(EMPTY_FORM); setEditTarget(null); setClientSearch(''); setShowForm(true); }
  function openEdit(sub: ClientSubscription) {
    setForm({ clientId: sub.clientId, clientName: sub.clientName, name: sub.name, serviceIds: sub.serviceIds, totalSessions: sub.totalSessions, usedSessions: sub.usedSessions, price: sub.price, purchaseDate: sub.purchaseDate, expiryDate: sub.expiryDate, status: sub.status, notes: sub.notes || '', purchasedByOperatorId: sub.purchasedByOperatorId || '' });
    setClientSearch(sub.clientName);
    setEditTarget(sub);
    setShowForm(true);
  }

  function handleSave() {
    if (!form.clientId || !form.name.trim()) return;
    if (editTarget) updateSubscription({ ...editTarget, ...form });
    else addSubscription(form);
    setShowForm(false);
  }

  function toggleService(id: string) {
    setForm(f => ({ ...f, serviceIds: f.serviceIds.includes(id) ? f.serviceIds.filter(x => x !== id) : [...f.serviceIds, id] }));
  }

  const filtered = useMemo(() => subscriptions.filter(s => {
    if (filterStatus !== 'all' && s.status !== filterStatus) return false;
    const q = search.toLowerCase();
    return s.clientName.toLowerCase().includes(q) || s.name.toLowerCase().includes(q);
  }), [subscriptions, filterStatus, search]);

  const clientSuggestions = useMemo(() =>
    clients.filter(c => `${c.firstName} ${c.lastName}`.toLowerCase().includes(clientSearch.toLowerCase())).slice(0, 6),
    [clients, clientSearch]
  );

  const today = new Date().toISOString().slice(0, 10);

  // Auto-check expiry on display
  const displaySubs = filtered.map(s => {
    let status = s.status;
    if (status === 'active' && s.expiryDate < today) status = 'expired';
    return { ...s, status };
  });

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Abbonamenti</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>Pacchetti sessioni per i clienti</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white hover:opacity-80"
          style={{ background: '#6366f1' }}>
          <Plus size={16} />Nuovo abbonamento
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(['active', 'expired', 'exhausted', 'cancelled'] as SubscriptionStatus[]).map(s => (
          <button key={s}
            onClick={() => setFilterStatus(filterStatus === s ? 'all' : s)}
            className="rounded-xl p-3 text-left transition-all hover:opacity-80"
            style={{
              background: filterStatus === s ? `${STATUS_COLORS[s]}22` : 'var(--bg-card)',
              border: `1px solid ${filterStatus === s ? STATUS_COLORS[s] : 'var(--border)'}`,
            }}>
            <div className="flex items-center gap-1.5 mb-1" style={{ color: STATUS_COLORS[s] }}>
              {STATUS_ICONS[s]}
              <span className="text-xs font-medium">{STATUS_LABELS[s]}</span>
            </div>
            <p className="text-xl font-bold text-white">
              {subscriptions.filter(x => x.status === s).length}
            </p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <Search size={14} style={{ color: 'var(--muted)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Cerca per cliente o nome pacchetto…"
          className="flex-1 bg-transparent text-sm outline-none text-white placeholder:text-[var(--muted)]" />
        {search && <button onClick={() => setSearch('')}><X size={14} style={{ color: 'var(--muted)' }} /></button>}
      </div>

      {/* List */}
      {displaySubs.length === 0 ? (
        <div className="rounded-xl p-10 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <CreditCard size={40} className="mx-auto mb-3" style={{ color: 'var(--muted)' }} />
          <p className="font-medium text-white">Nessun abbonamento trovato</p>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>Crea il primo abbonamento con il tasto "Nuovo abbonamento"</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displaySubs.map(sub => {
            const remaining = sub.totalSessions - sub.usedSessions;
            const pct = sub.totalSessions > 0 ? (sub.usedSessions / sub.totalSessions) * 100 : 0;
            const subServices = services.filter(s => (sub.serviceIds ?? []).includes(s.id));
            return (
              <div key={sub.id} className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-white">{sub.name}</p>
                      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: `${STATUS_COLORS[sub.status]}22`, color: STATUS_COLORS[sub.status] }}>
                        {STATUS_ICONS[sub.status]}{STATUS_LABELS[sub.status]}
                      </span>
                    </div>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>{sub.clientName}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {sub.status === 'active' && remaining > 0 && (
                      <button
                        onClick={() => useSubscriptionSession(sub.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-white hover:opacity-80"
                        style={{ background: '#22c55e' }}>
                        Usa sessione
                      </button>
                    )}
                    <button onClick={() => openEdit(sub)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-80"
                      style={{ background: 'var(--bg-page)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
                      Modifica
                    </button>
                    <button onClick={() => setConfirmDelete(sub.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium"
                      style={{ background: '#ef444420', color: '#ef4444' }}>
                      ✕
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{ color: 'var(--muted)' }}>{sub.usedSessions} usate / {sub.totalSessions} totali</span>
                    <span style={{ color: STATUS_COLORS[sub.status] }}>{remaining} rimanenti</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: 'var(--bg-page)' }}>
                    <div className="h-2 rounded-full transition-all" style={{
                      width: `${pct}%`,
                      background: pct >= 100 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#22c55e',
                    }} />
                  </div>
                </div>

                {/* Meta row */}
                <div className="flex flex-wrap gap-3 mt-3 text-xs" style={{ color: 'var(--muted)' }}>
                  <span>Acquisto: {sub.purchaseDate}</span>
                  <span>Scadenza: {sub.expiryDate}</span>
                  <span>Valore: €{sub.price.toFixed(2)}</span>
                  {subServices.length > 0 && (
                    <span>Servizi: {subServices.map(s => s.name).join(', ')}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-lg rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white">{editTarget ? 'Modifica abbonamento' : 'Nuovo abbonamento'}</h2>
              <button onClick={() => setShowForm(false)}><X size={18} style={{ color: 'var(--muted)' }} /></button>
            </div>

            {/* Client picker */}
            <div className="relative">
              <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Cliente *</label>
              <input
                value={clientSearch}
                onChange={e => { setClientSearch(e.target.value); setShowClientDrop(true); setForm(f => ({ ...f, clientId: '', clientName: '' })); }}
                onFocus={() => setShowClientDrop(true)}
                placeholder="Cerca cliente…"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none text-white placeholder:text-[var(--muted)]"
                style={{ background: 'var(--bg-page)', border: '1px solid var(--border)' }} />
              {showClientDrop && clientSearch && clientSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-10 rounded-xl mt-1 overflow-hidden"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                  {clientSuggestions.map(c => (
                    <button key={c.id}
                      className="w-full text-left px-3 py-2 text-sm hover:opacity-70 text-white"
                      onClick={() => { const name = `${c.firstName} ${c.lastName}`; setForm(f => ({ ...f, clientId: c.id, clientName: name })); setClientSearch(name); setShowClientDrop(false); }}>
                      {c.firstName} {c.lastName} {c.phone && <span style={{ color: 'var(--muted)' }}>· {c.phone}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Name */}
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Nome pacchetto *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="es. Pacchetto 10 lavaggi"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none text-white placeholder:text-[var(--muted)]"
                style={{ background: 'var(--bg-page)', border: '1px solid var(--border)' }} />
            </div>

            {/* Numeric fields */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Sessioni totali', key: 'totalSessions', min: 1 },
                { label: 'Sessioni usate', key: 'usedSessions', min: 0 },
                { label: 'Prezzo (€)', key: 'price', min: 0, step: 0.5 },
              ].map(({ label, key, min, step }) => (
                <div key={key}>
                  <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>{label}</label>
                  <input type="number" min={min} step={step ?? 1}
                    value={(form as unknown as Record<string, number>)[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: parseFloat(e.target.value) || 0 }))}
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none text-white"
                    style={{ background: 'var(--bg-page)', border: '1px solid var(--border)' }} />
                </div>
              ))}
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Stato</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as SubscriptionStatus }))}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none text-white"
                  style={{ background: 'var(--bg-page)', border: '1px solid var(--border)' }}>
                  {(Object.keys(STATUS_LABELS) as SubscriptionStatus[]).map(s => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Date fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Data acquisto</label>
                <input type="date" value={form.purchaseDate}
                  onChange={e => setForm(f => ({ ...f, purchaseDate: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none text-white"
                  style={{ background: 'var(--bg-page)', border: '1px solid var(--border)', colorScheme: 'dark' }} />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Scadenza</label>
                <input type="date" value={form.expiryDate}
                  onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none text-white"
                  style={{ background: 'var(--bg-page)', border: '1px solid var(--border)', colorScheme: 'dark' }} />
              </div>
            </div>

            {/* Services */}
            <div>
              <label className="block text-xs mb-2" style={{ color: 'var(--muted)' }}>Servizi inclusi (opzionale)</label>
              <div className="flex flex-wrap gap-2">
                {services.filter(s => s.active).map(s => (
                  <button key={s.id}
                    onClick={() => toggleService(s.id)}
                    className="px-3 py-1 rounded-full text-xs font-medium transition-all"
                    style={{
                      background: form.serviceIds.includes(s.id) ? '#6366f1' : 'var(--bg-page)',
                      color: form.serviceIds.includes(s.id) ? '#fff' : 'var(--text-2)',
                      border: `1px solid ${form.serviceIds.includes(s.id) ? '#6366f1' : 'var(--border)'}`,
                    }}>
                    {s.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Operator */}
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Operatore</label>
              <select value={form.purchasedByOperatorId ?? ''}
                onChange={e => setForm(f => ({ ...f, purchasedByOperatorId: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none text-white"
                style={{ background: 'var(--bg-page)', border: '1px solid var(--border)' }}>
                <option value="">— Nessuno —</option>
                {operators.filter(o => o.active).map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Note</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2} placeholder="Note interne..."
                className="w-full rounded-lg px-3 py-2 text-sm outline-none text-white resize-none placeholder:text-[var(--muted)]"
                style={{ background: 'var(--bg-page)', border: '1px solid var(--border)' }} />
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-2 rounded-xl text-sm font-medium"
                style={{ background: 'var(--bg-page)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
                Annulla
              </button>
              <button onClick={handleSave} disabled={!form.clientId || !form.name.trim()}
                className="flex-1 py-2 rounded-xl text-sm font-medium text-white hover:opacity-80 disabled:opacity-40"
                style={{ background: '#6366f1' }}>
                {editTarget ? 'Aggiorna' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="rounded-2xl p-6 space-y-4 max-w-sm w-full" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <p className="font-bold text-white">Eliminare abbonamento?</p>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Questa azione non è reversibile.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2 rounded-xl text-sm font-medium"
                style={{ background: 'var(--bg-page)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
                Annulla
              </button>
              <button onClick={() => { deleteSubscription(confirmDelete!); setConfirmDelete(null); }}
                className="flex-1 py-2 rounded-xl text-sm font-medium text-white"
                style={{ background: '#ef4444' }}>
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
