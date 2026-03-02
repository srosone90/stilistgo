'use client';

import React, { useState } from 'react';
import { Scissors, CheckCircle2, AlertTriangle, Calendar, Clock, Phone, User, Mail, MessageSquare } from 'lucide-react';

const SERVICES = [
  'Taglio capelli',
  'Colore / Tinta',
  'Piega',
  'Trattamento capelli',
  'Manicure',
  'Pedicure',
  'Ceretta',
  'Sopracciglia',
  'Acconciatura sposa',
  'Extension',
  'Balayage / Schiaritura',
  'Permanente',
  'Altro (specifica nelle note)',
];

const TIMES = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
];

const inp: React.CSSProperties = {
  width: '100%', background: '#12121a', border: '1px solid #2e2e40',
  borderRadius: '10px', padding: '11px 14px', color: '#f4f4f5',
  fontSize: '14px', outline: 'none', boxSizing: 'border-box',
};
const lbl: React.CSSProperties = { display: 'block', fontSize: '12px', color: '#71717a', marginBottom: '6px' };

export default function BookingPage() {
  const [form, setForm] = useState({
    clientName: '', clientPhone: '', clientEmail: '',
    service: '', preferredDate: '', preferredTime: '', notes: '',
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const set = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) { setErrorMsg(json.error || 'Errore sconosciuto'); setStatus('error'); return; }
      setStatus('success');
    } catch {
      setErrorMsg('Impossibile inviare la richiesta. Controlla la connessione.');
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#0f0f13' }}>
        <div className="w-full max-w-md text-center rounded-2xl p-8" style={{ background: '#1c1c27', border: '1px solid #2e2e40' }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)' }}>
            <CheckCircle2 size={32} style={{ color: '#22c55e' }} />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Richiesta inviata!</h2>
          <p className="text-sm" style={{ color: '#71717a' }}>
            La tua richiesta di appuntamento è stata ricevuta. Il salone ti contatterà presto per confermare.
          </p>
          <button
            onClick={() => { setForm({ clientName: '', clientPhone: '', clientEmail: '', service: '', preferredDate: '', preferredTime: '', notes: '' }); setStatus('idle'); }}
            className="mt-6 w-full py-3 rounded-xl font-semibold text-white"
            style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)' }}>
            Nuova prenotazione
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ background: '#0f0f13' }}>
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)', boxShadow: '0 0 30px rgba(99,102,241,0.4)' }}>
            <Scissors size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Prenota il tuo appuntamento</h1>
          <p className="text-sm mt-1" style={{ color: '#71717a' }}>
            Compila il modulo e ti contatteremo per confermare.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="rounded-2xl p-6 space-y-4"
          style={{ background: '#1c1c27', border: '1px solid #2e2e40' }}>

          {status === 'error' && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
              <AlertTriangle size={15} /> {errorMsg}
            </div>
          )}

          <div>
            <label style={lbl}><User size={12} style={{ display: 'inline', marginRight: 4 }} />Nome e cognome *</label>
            <input required value={form.clientName} onChange={e => set('clientName', e.target.value)}
              placeholder="es. Mario Rossi" style={inp} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={lbl}><Phone size={12} style={{ display: 'inline', marginRight: 4 }} />Telefono *</label>
              <input required type="tel" value={form.clientPhone} onChange={e => set('clientPhone', e.target.value)}
                placeholder="+39 123 456 7890" style={inp} />
            </div>
            <div>
              <label style={lbl}><Mail size={12} style={{ display: 'inline', marginRight: 4 }} />Email</label>
              <input type="email" value={form.clientEmail} onChange={e => set('clientEmail', e.target.value)}
                placeholder="opzionale" style={inp} />
            </div>
          </div>

          <div>
            <label style={lbl}><Scissors size={12} style={{ display: 'inline', marginRight: 4 }} />Servizio desiderato *</label>
            <select required value={form.service} onChange={e => set('service', e.target.value)} style={inp}>
              <option value="">— Seleziona servizio —</option>
              {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={lbl}><Calendar size={12} style={{ display: 'inline', marginRight: 4 }} />Data preferita *</label>
              <input required type="date" value={form.preferredDate} onChange={e => set('preferredDate', e.target.value)} style={inp}
                min={new Date().toISOString().slice(0, 10)} />
            </div>
            <div>
              <label style={lbl}><Clock size={12} style={{ display: 'inline', marginRight: 4 }} />Ora preferita *</label>
              <select required value={form.preferredTime} onChange={e => set('preferredTime', e.target.value)} style={inp}>
                <option value="">— Seleziona —</option>
                {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={lbl}><MessageSquare size={12} style={{ display: 'inline', marginRight: 4 }} />Note aggiuntive</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3}
              placeholder="Es. capelli lunghi, allergie, richieste specifiche..." style={{ ...inp, resize: 'none' }} />
          </div>

          <button type="submit" disabled={status === 'loading'}
            className="w-full py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)' }}>
            {status === 'loading' ? 'Invio in corso...' : 'Invia richiesta'}
          </button>
        </form>

        <p className="text-center text-xs mt-4" style={{ color: '#3f3f5a' }}>
          Stylistgo — Gestionale salone
        </p>
      </div>
    </div>
  );
}
