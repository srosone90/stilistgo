'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { use } from 'react';
import { CheckCircle2, Clock, Scissors, ArrowLeft, Calendar, Phone, User, MessageSquare, Mail, Loader2 } from 'lucide-react';

type Step = 'menu' | 'details' | 'success';

interface SalonService {
  id: string;
  name: string;
  duration: number;
  category: string;
}

// Default hardcoded catalogue used when a salon has no services configured
const DEFAULT_CATEGORIES = [
  { label: 'Capelli',     items: ['Taglio', 'Piega', 'Permanente', 'Extension'] },
  { label: 'Colore',      items: ['Tinta', 'Balayage / Schiaritura', 'Méches'] },
  { label: 'Trattamenti', items: ['Maschera ristrutturante', 'Keratina', 'Trattamento anticaduta'] },
  { label: 'Nails',       items: ['Manicure', 'Pedicure', 'Ricostruzione unghie'] },
];

export default function DynamicBookingPage({ params }: { params: Promise<{ salonId: string }> }) {
  const { salonId } = use(params);

  const [step, setStep] = useState<Step>('menu');
  const [salonName, setSalonName] = useState('');
  const [salonServices, setSalonServices] = useState<SalonService[]>([]);
  const [loadingInfo, setLoadingInfo] = useState(true);

  // Available time slots state
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [form, setForm] = useState({ clientName: '', clientPhone: '', clientEmail: '', preferredDate: '', preferredTime: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Load salon name + services on mount
  useEffect(() => {
    fetch(`/api/booking-slots?salonId=${encodeURIComponent(salonId)}`)
      .then(r => r.json())
      .then(d => {
        setSalonName(d.salonName || '');
        setSalonServices(d.services || []);
      })
      .catch(() => {})
      .finally(() => setLoadingInfo(false));
  }, [salonId]);

  // Fetch available slots whenever date changes
  useEffect(() => {
    if (!form.preferredDate) { setAvailableSlots([]); return; }
    setLoadingSlots(true);
    fetch(`/api/booking-slots?salonId=${encodeURIComponent(salonId)}&date=${form.preferredDate}`)
      .then(r => r.json())
      .then(d => setAvailableSlots(d.available || []))
      .catch(() => setAvailableSlots([]))
      .finally(() => setLoadingSlots(false));
    // Reset time if not in new available slots
    setForm(p => ({ ...p, preferredTime: '' }));
  }, [form.preferredDate, salonId]);

  const set = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  // Build display categories from salon's own services (grouped by category)
  // or fall back to hardcoded defaults
  const categories = useMemo(() => {
    if (salonServices.length > 0) {
      const grouped: Record<string, SalonService[]> = {};
      salonServices.forEach(s => {
        if (!grouped[s.category]) grouped[s.category] = [];
        grouped[s.category].push(s);
      });
      return Object.entries(grouped).map(([label, items]) => ({ label, items }));
    }
    // Default
    return DEFAULT_CATEGORIES.map(cat => ({
      label: cat.label,
      items: cat.items.map(name => ({ id: name, name, duration: 45, category: cat.label })),
    }));
  }, [salonServices]);

  const totalDuration = useMemo(() =>
    salonServices.length > 0
      ? salonServices.filter(s => selectedServices.includes(s.id)).reduce((sum, s) => sum + s.duration, 0)
      : selectedServices.length * 45,
    [salonServices, selectedServices]);

  const selectedNames = useMemo(() => {
    if (salonServices.length > 0) {
      return salonServices.filter(s => selectedServices.includes(s.id)).map(s => s.name);
    }
    return selectedServices;
  }, [salonServices, selectedServices]);

  const toggleService = (id: string) =>
    setSelectedServices(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);

  const handleSubmit = async () => {
    if (!form.clientName || !form.clientPhone || !form.preferredDate || !form.preferredTime) {
      setErrorMsg('Compila tutti i campi obbligatori (*).');
      return;
    }
    setSubmitting(true); setErrorMsg('');
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: form.clientName, clientPhone: form.clientPhone, clientEmail: form.clientEmail,
          service: selectedNames.join(', ') || 'Da concordare',
          preferredDate: form.preferredDate, preferredTime: form.preferredTime,
          notes: form.notes,
          salonId,
        }),
      });
      if (!res.ok) { const j = await res.json(); setErrorMsg(j.error || 'Errore. Riprova.'); setSubmitting(false); return; }
      setStep('success');
    } catch {
      setErrorMsg('Impossibile inviare. Controlla la connessione.');
      setSubmitting(false);
    }
  };

  const inp: React.CSSProperties = { width: '100%', background: '#12121a', border: '1px solid #2e2e40', borderRadius: '12px', padding: '12px 14px', color: '#f4f4f5', fontSize: '15px', outline: 'none', boxSizing: 'border-box' };
  const lbl: React.CSSProperties = { display: 'block', fontSize: '13px', color: '#71717a', marginBottom: '6px', fontWeight: 500 };

  // ─── Success ───────────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'linear-gradient(135deg,#0f0f13,#13131e)' }}>
        <div className="w-full max-w-md text-center rounded-3xl p-10" style={{ background: '#1c1c27', border: '1px solid #2e2e40' }}>
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5"
            style={{ background: 'rgba(34,197,94,0.15)', border: '2px solid rgba(34,197,94,0.4)' }}>
            <CheckCircle2 size={36} style={{ color: '#22c55e' }} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Richiesta inviata!</h2>
          <p className="text-base mb-4" style={{ color: '#a1a1aa' }}>
            Abbiamo ricevuto la tua richiesta. {salonName ? salonName : 'Il salone'} ti contatterà presto per confermare l&apos;appuntamento.
          </p>
          {selectedNames.length > 0 && (
            <div className="rounded-xl p-3 mb-5 text-sm" style={{ background: '#12121a', color: '#71717a' }}>
              {selectedNames.join(' · ')}{totalDuration > 0 && ` · ${totalDuration} min`}
            </div>
          )}
          <p className="text-sm mb-5" style={{ color: '#71717a' }}>
            {form.preferredDate} alle {form.preferredTime}
          </p>
          <button
            onClick={() => { setStep('menu'); setSelectedServices([]); setForm({ clientName: '', clientPhone: '', clientEmail: '', preferredDate: '', preferredTime: '', notes: '' }); }}
            className="w-full py-4 rounded-2xl font-semibold text-white text-base"
            style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)' }}>
            Nuova prenotazione
          </button>
        </div>
      </div>
    );
  }

  // ─── Details step ─────────────────────────────────────────────────────────
  if (step === 'details') {
    return (
      <div className="min-h-screen" style={{ background: 'linear-gradient(135deg,#0f0f13,#13131e)' }}>
        <div className="max-w-lg mx-auto px-4 py-8">
          <button onClick={() => setStep('menu')} className="flex items-center gap-2 mb-6"
            style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', fontSize: 14 }}>
            <ArrowLeft size={16} /> Torna ai trattamenti
          </button>
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white">Completa la prenotazione</h1>
            <p className="text-sm mt-1" style={{ color: '#71717a' }}>
              {selectedNames.length > 0 ? selectedNames.join(' · ') : 'Nessun trattamento selezionato'}
              {totalDuration > 0 && <span style={{ color: '#818cf8' }}> · {totalDuration} min</span>}
            </p>
          </div>
          <div className="rounded-2xl p-5 space-y-4" style={{ background: '#1c1c27', border: '1px solid #2e2e40' }}>
            <div>
              <label style={lbl}><User size={13} className="inline mr-1" />Nome e Cognome *</label>
              <input value={form.clientName} onChange={e => set('clientName', e.target.value)} style={inp} placeholder="Es. Maria Rossi" />
            </div>
            <div>
              <label style={lbl}><Phone size={13} className="inline mr-1" />Telefono *</label>
              <input type="tel" value={form.clientPhone} onChange={e => set('clientPhone', e.target.value)} style={inp} placeholder="+39 333 123 4567" />
            </div>
            <div>
              <label style={lbl}><Mail size={13} className="inline mr-1" />Email (opzionale)</label>
              <input type="email" value={form.clientEmail} onChange={e => set('clientEmail', e.target.value)} style={inp} placeholder="maria@email.com" />
            </div>

            {/* Date — selecting date triggers slot fetch */}
            <div>
              <label style={lbl}><Calendar size={13} className="inline mr-1" />Data *</label>
              <input type="date" value={form.preferredDate} onChange={e => set('preferredDate', e.target.value)} style={inp} min={new Date().toISOString().split('T')[0]} />
            </div>

            {/* Time — only show after date is chosen, only available slots */}
            <div>
              <label style={lbl}>
                <Clock size={13} className="inline mr-1" />Orario *
                {loadingSlots && <Loader2 size={11} className="inline ml-1 animate-spin" style={{ color: '#818cf8' }} />}
              </label>
              {!form.preferredDate ? (
                <div style={{ ...inp, color: '#3f3f5a' }}>Seleziona prima una data</div>
              ) : loadingSlots ? (
                <div style={{ ...inp, color: '#71717a' }}>Caricamento disponibilità…</div>
              ) : availableSlots.length === 0 ? (
                <div style={{ ...inp, color: '#f87171' }}>Nessun orario disponibile in questa data</div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {availableSlots.map(t => (
                    <button key={t} onClick={() => set('preferredTime', t)}
                      className="py-2 rounded-xl text-sm font-medium transition-all"
                      style={{
                        background: form.preferredTime === t ? 'rgba(99,102,241,0.25)' : '#12121a',
                        border: `1px solid ${form.preferredTime === t ? 'rgba(99,102,241,0.6)' : '#2e2e40'}`,
                        color: form.preferredTime === t ? '#818cf8' : '#d4d4d8',
                        cursor: 'pointer',
                      }}>
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label style={lbl}><MessageSquare size={13} className="inline mr-1" />Note (opzionale)</label>
              <textarea rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} style={{ ...inp, resize: 'vertical' }} placeholder="Allergie, preferenze, richieste speciali…" />
            </div>
            {errorMsg && (
              <div className="text-sm rounded-xl px-4 py-3" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
                {errorMsg}
              </div>
            )}
            <button onClick={handleSubmit} disabled={submitting}
              className="w-full py-4 rounded-2xl font-semibold text-white text-base"
              style={{ background: submitting ? '#2e2e40' : 'linear-gradient(135deg,#6366f1,#a855f7)', cursor: submitting ? 'not-allowed' : 'pointer' }}>
              {submitting ? 'Invio in corso…' : 'Invia richiesta'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Menu step ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg,#0f0f13,#13131e)' }}>
      {/* Hero */}
      <div className="text-center pt-10 pb-5 px-4" style={{ background: 'linear-gradient(180deg,rgba(99,102,241,0.12) 0%,transparent 100%)' }}>
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
          style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)', boxShadow: '0 0 40px rgba(99,102,241,0.4)' }}>
          <Scissors size={24} color="white" />
        </div>
        {loadingInfo ? (
          <Loader2 size={20} className="animate-spin mx-auto mb-2" style={{ color: '#818cf8' }} />
        ) : (
          <>
            <h1 className="text-2xl font-bold text-white mb-1">{salonName || 'Prenota online'}</h1>
            <p className="text-sm" style={{ color: '#71717a' }}>Scegli uno o più servizi e prenota online</p>
          </>
        )}
      </div>

      <div className="max-w-2xl mx-auto px-4 pb-32">
        {categories.map(cat => (
          <div key={cat.label} className="mb-8">
            <h2 className="font-bold text-white mb-3 px-1">{cat.label}</h2>
            <div className="space-y-2">
              {cat.items.map(item => {
                const id = (item as SalonService).id ?? item.name;
                const name = item.name;
                const duration = (item as SalonService).duration ?? 45;
                const selected = selectedServices.includes(id);
                return (
                  <button key={id} onClick={() => toggleService(id)}
                    className="w-full text-left rounded-2xl p-4 transition-all"
                    style={{ background: selected ? 'rgba(99,102,241,0.15)' : '#1c1c27', border: `1px solid ${selected ? 'rgba(99,102,241,0.5)' : '#2e2e40'}`, cursor: 'pointer', boxShadow: selected ? '0 0 16px rgba(99,102,241,0.1)' : 'none' }}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white">{name}</p>
                        <div className="flex items-center gap-1 mt-1 text-xs" style={{ color: '#71717a' }}>
                          <Clock size={11} /> {duration} min
                        </div>
                      </div>
                      <div className="w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center"
                        style={{ borderColor: selected ? '#818cf8' : '#3f3f5a', background: selected ? '#818cf8' : 'transparent' }}>
                        {selected && (
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Sticky bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4" style={{ background: 'rgba(15,15,19,0.97)', backdropFilter: 'blur(16px)', borderTop: '1px solid #2e2e40' }}>
        <div className="max-w-2xl mx-auto">
          {selectedServices.length === 0 ? (
            <div className="w-full py-3.5 rounded-2xl text-center text-sm font-medium" style={{ background: '#1c1c27', border: '1px solid #2e2e40', color: '#3f3f5a' }}>
              Seleziona almeno un trattamento per continuare
            </div>
          ) : (
            <button onClick={() => setStep('details')}
              className="w-full py-4 rounded-2xl font-bold text-white text-base transition-all active:scale-95"
              style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)', boxShadow: '0 0 30px rgba(99,102,241,0.4)' }}>
              Prenota {selectedServices.length} {selectedServices.length === 1 ? 'servizio' : 'servizi'}{totalDuration > 0 && ` · ${totalDuration} min`} →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
