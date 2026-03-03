'use client';

import React, { useState, useMemo } from 'react';
import { useSalon } from '@/context/SalonContext';
import { GiftCard } from '@/types/salon';
import { Plus, Search, X, Gift, Send, Copy, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

const EMPTY_FORM: Omit<GiftCard, 'id' | 'createdAt' | 'code'> = {
  clientId: '',
  clientName: '',
  initialValue: 50,
  remainingValue: 50,
  expiryDate: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
  isActive: true,
  recipientPhone: '',
  message: '',
  purchasedByOperatorId: '',
  sentViaWhatsApp: false,
};

export default function GiftCardsView({ newTrigger }: { newTrigger?: number }) {
  const { giftCards, addGiftCard, updateGiftCard, clients, operators, salonConfig } = useSalon();
  const [search, setSearch] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDrop, setShowClientDrop] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [sendingWa, setSendingWa] = useState<string | null>(null);
  const [waResult, setWaResult] = useState<{ id: string; ok: boolean; msg: string } | null>(null);

  React.useEffect(() => { if (newTrigger) openAdd(); }, [newTrigger]);

  function openAdd() { setForm({ ...EMPTY_FORM, expiryDate: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10) }); setClientSearch(''); setShowForm(true); }

  function handleSave() {
    if (form.initialValue <= 0) return;
    addGiftCard({ ...form, remainingValue: form.initialValue });
    setShowForm(false);
  }

  const clientSuggestions = useMemo(() =>
    clients.filter(c => `${c.firstName} ${c.lastName}`.toLowerCase().includes(clientSearch.toLowerCase())).slice(0, 6),
    [clients, clientSearch]
  );

  const filtered = useMemo(() => giftCards.filter(gc => {
    if (filterActive === 'active' && !gc.isActive) return false;
    if (filterActive === 'inactive' && gc.isActive) return false;
    const q = search.toLowerCase();
    return gc.code.toLowerCase().includes(q) || gc.clientName.toLowerCase().includes(q);
  }), [giftCards, filterActive, search]);

  const today = new Date().toISOString().slice(0, 10);

  function copyCode(code: string) {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  async function sendWhatsApp(gc: GiftCard) {
    const wa = salonConfig?.whatsapp;
    if (!wa?.ultraMsgInstanceId || !wa?.ultraMsgToken) {
      setWaResult({ id: gc.id, ok: false, msg: 'WhatsApp non configurato — configuralo nelle Automazioni.' });
      return;
    }
    const phone = gc.recipientPhone || clients.find(c => c.id === gc.clientId)?.phone;
    if (!phone) {
      setWaResult({ id: gc.id, ok: false, msg: 'Numero di telefono non disponibile per questa regalo.' });
      return;
    }
    const salonName = salonConfig?.salonName ?? 'il salone';
    const defaultMsg = `🎁 Ciao ${gc.clientName || 'amica'}! Hai ricevuto una Gift Card da *${salonName}* del valore di *€${gc.initialValue.toFixed(2)}*!\n\nCodice: *${gc.code}*\nValida fino al: ${gc.expiryDate || 'N/D'}${gc.message ? `\n\n${gc.message}` : ''}\n\nA presto! 💇‍♀️`;
    setSendingWa(gc.id);
    try {
      const res = await fetch('/api/ultramsg/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceId: wa.ultraMsgInstanceId, token: wa.ultraMsgToken, to: phone, message: defaultMsg }),
      });
      const data = await res.json();
      if (res.ok) {
        updateGiftCard({ ...gc, sentViaWhatsApp: true });
        setWaResult({ id: gc.id, ok: true, msg: 'Gift Card inviata via WhatsApp!' });
      } else {
        setWaResult({ id: gc.id, ok: false, msg: data.error ?? 'Invio fallito.' });
      }
    } catch {
      setWaResult({ id: gc.id, ok: false, msg: 'Errore di rete.' });
    } finally {
      setSendingWa(null);
      setTimeout(() => setWaResult(null), 4000);
    }
  }

  const stats = {
    total: giftCards.length,
    active: giftCards.filter(g => g.isActive).length,
    totalValue: giftCards.filter(g => g.isActive).reduce((s, g) => s + g.remainingValue, 0),
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Gift Card</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>Crea e invia gift card tramite WhatsApp</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white hover:opacity-80"
          style={{ background: '#6366f1' }}>
          <Plus size={16} />Nuova Gift Card
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>Totali</p>
          <p className="text-2xl font-bold text-white">{stats.total}</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>Attive</p>
          <p className="text-2xl font-bold" style={{ color: '#22c55e' }}>{stats.active}</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>Valore residuo</p>
          <p className="text-2xl font-bold" style={{ color: '#6366f1' }}>€{stats.totalValue.toFixed(2)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 flex-1 rounded-xl px-3 py-2" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <Search size={14} style={{ color: 'var(--muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cerca per codice o cliente…"
            className="flex-1 bg-transparent text-sm outline-none text-white placeholder:text-[var(--muted)]" />
          {search && <button onClick={() => setSearch('')}><X size={14} style={{ color: 'var(--muted)' }} /></button>}
        </div>
        <div className="flex gap-2">
          {(['all', 'active', 'inactive'] as const).map(f => (
            <button key={f}
              onClick={() => setFilterActive(f)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: filterActive === f ? '#6366f1' : 'var(--bg-card)',
                color: filterActive === f ? '#fff' : 'var(--text-2)',
                border: '1px solid var(--border)',
              }}>
              {f === 'all' ? 'Tutte' : f === 'active' ? 'Attive' : 'Scadute'}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-xl p-10 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <Gift size={40} className="mx-auto mb-3" style={{ color: 'var(--muted)' }} />
          <p className="font-medium text-white">Nessuna Gift Card trovata</p>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>Crea la prima con il tasto "Nuova Gift Card"</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(gc => {
            const isExpired = gc.expiryDate && gc.expiryDate < today;
            const usedPct = gc.initialValue > 0 ? ((gc.initialValue - gc.remainingValue) / gc.initialValue) * 100 : 0;
            const isSending = sendingWa === gc.id;
            const result = waResult?.id === gc.id ? waResult : null;
            return (
              <div key={gc.id} className="rounded-xl p-4" style={{
                background: 'var(--bg-card)',
                border: `1px solid ${!gc.isActive || isExpired ? '#ef4444' : 'var(--border)'}`,
              }}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: '#6366f122' }}>
                      <Gift size={18} style={{ color: '#6366f1' }} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => copyCode(gc.code)}
                          className="font-mono text-sm font-bold text-white flex items-center gap-1 hover:opacity-70 transition-opacity"
                          title="Copia codice">
                          {gc.code}
                          {copiedCode === gc.code
                            ? <CheckCircle2 size={13} style={{ color: '#22c55e' }} />
                            : <Copy size={13} style={{ color: 'var(--muted)' }} />}
                        </button>
                        {gc.sentViaWhatsApp && (
                          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#22c55e22', color: '#22c55e' }}>
                            Inviata WA
                          </span>
                        )}
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                        {gc.clientName || 'Generica'} {gc.expiryDate ? `· scade ${gc.expiryDate}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right mr-2">
                      <p className="text-base font-bold text-white">€{gc.remainingValue.toFixed(2)}</p>
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>su €{gc.initialValue.toFixed(2)}</p>
                    </div>
                    <button
                      onClick={() => sendWhatsApp(gc)}
                      disabled={!!sendingWa}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80 disabled:opacity-50"
                      style={{ background: '#25D366', color: '#fff' }}>
                      {isSending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                      WhatsApp
                    </button>
                    <button
                      onClick={() => updateGiftCard({ ...gc, isActive: !gc.isActive })}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
                      style={{
                        background: gc.isActive ? '#ef444420' : '#22c55e20',
                        color: gc.isActive ? '#ef4444' : '#22c55e',
                      }}>
                      {gc.isActive ? 'Disattiva' : 'Attiva'}
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                {gc.initialValue > 0 && (
                  <div className="mt-3">
                    <div className="h-1.5 rounded-full" style={{ background: 'var(--bg-page)' }}>
                      <div className="h-1.5 rounded-full" style={{
                        width: `${usedPct}%`,
                        background: usedPct >= 100 ? '#ef4444' : '#6366f1',
                      }} />
                    </div>
                    <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                      Usati €{(gc.initialValue - gc.remainingValue).toFixed(2)} · Residui €{gc.remainingValue.toFixed(2)}
                    </p>
                  </div>
                )}

                {/* WA result */}
                {result && (
                  <div className="mt-2 flex items-center gap-2 text-xs rounded-lg p-2"
                    style={{ background: result.ok ? '#22c55e22' : '#ef444422', color: result.ok ? '#22c55e' : '#ef4444' }}>
                    {result.ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                    {result.msg}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-lg rounded-2xl p-6 space-y-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white">Nuova Gift Card</h2>
              <button onClick={() => setShowForm(false)}><X size={18} style={{ color: 'var(--muted)' }} /></button>
            </div>

            {/* Client picker */}
            <div className="relative">
              <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Cliente destinatario</label>
              <input value={clientSearch}
                onChange={e => { setClientSearch(e.target.value); setShowClientDrop(true); setForm(f => ({ ...f, clientId: '', clientName: '' })); }}
                onFocus={() => setShowClientDrop(true)}
                placeholder="Cerca cliente (opzionale)…"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none text-white placeholder:text-[var(--muted)]"
                style={{ background: 'var(--bg-page)', border: '1px solid var(--border)' }} />
              {showClientDrop && clientSearch && clientSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-10 rounded-xl mt-1 overflow-hidden"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                  {clientSuggestions.map(c => (
                    <button key={c.id}
                      className="w-full text-left px-3 py-2 text-sm hover:opacity-70 text-white"
                      onClick={() => {
                        const name = `${c.firstName} ${c.lastName}`;
                        setForm(f => ({ ...f, clientId: c.id, clientName: name, recipientPhone: c.phone || '' }));
                        setClientSearch(name);
                        setShowClientDrop(false);
                      }}>
                      {c.firstName} {c.lastName}
                      {c.phone && <span style={{ color: 'var(--muted)' }}> · {c.phone}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Valore (€) *</label>
                <input type="number" min={1} step={5}
                  value={form.initialValue}
                  onChange={e => setForm(f => ({ ...f, initialValue: parseFloat(e.target.value) || 0 }))}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none text-white"
                  style={{ background: 'var(--bg-page)', border: '1px solid var(--border)' }} />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Scadenza</label>
                <input type="date" value={form.expiryDate}
                  onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none text-white"
                  style={{ background: 'var(--bg-page)', border: '1px solid var(--border)', colorScheme: 'dark' }} />
              </div>
            </div>

            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Telefono destinatario (per WhatsApp)</label>
              <input value={form.recipientPhone ?? ''}
                onChange={e => setForm(f => ({ ...f, recipientPhone: e.target.value }))}
                placeholder="+39 333 …"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none text-white placeholder:text-[var(--muted)]"
                style={{ background: 'var(--bg-page)', border: '1px solid var(--border)' }} />
            </div>

            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Messaggio personale (opzionale)</label>
              <textarea value={form.message ?? ''}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                rows={2} placeholder="Auguri! 🎉"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none text-white resize-none placeholder:text-[var(--muted)]"
                style={{ background: 'var(--bg-page)', border: '1px solid var(--border)' }} />
            </div>

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

            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-2 rounded-xl text-sm font-medium"
                style={{ background: 'var(--bg-page)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
                Annulla
              </button>
              <button onClick={handleSave} disabled={form.initialValue <= 0}
                className="flex-1 py-2 rounded-xl text-sm font-medium text-white hover:opacity-80 disabled:opacity-40"
                style={{ background: '#6366f1' }}>
                Crea Gift Card
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
