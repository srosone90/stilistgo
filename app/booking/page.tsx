'use client';

import React, { useState, useMemo } from 'react';
import { CheckCircle2, Clock, Scissors, Sparkles, Flower2, Hand, Zap, Star, ArrowLeft, Calendar, Phone, User, MessageSquare, Mail } from 'lucide-react';

// ─── Service catalogue ─────────────────────────────────────────────────────

const CATEGORIES = [
  {
    id: 'capelli', label: 'Capelli', icon: 'scissors', color: '#818cf8', bg: 'rgba(99,102,241,0.15)',
    items: [
      { id: 'taglio', name: 'Taglio', description: 'Taglio personalizzato su misura', duration: 45 },
      { id: 'piega', name: 'Piega', description: 'Asciugatura e messa in piega', duration: 30 },
      { id: 'permanente', name: 'Permanente', description: 'Ricci duraturi e naturali', duration: 120 },
      { id: 'extension', name: 'Extension', description: 'Allungamento e volume capelli', duration: 180 },
    ],
  },
  {
    id: 'colore', label: 'Colore', icon: 'sparkles', color: '#a78bfa', bg: 'rgba(167,139,250,0.15)',
    items: [
      { id: 'tinta', name: 'Tinta', description: 'Colore uniforme pieno o parziale', duration: 90 },
      { id: 'balayage', name: 'Balayage / Schiaritura', description: 'Effetto luminoso naturale', duration: 150 },
      { id: 'meches', name: 'Méches', description: 'Colpi di luce selettivi', duration: 120 },
    ],
  },
  {
    id: 'trattamenti', label: 'Trattamenti', icon: 'flower', color: '#34d399', bg: 'rgba(52,211,153,0.15)',
    items: [
      { id: 'maschera', name: 'Maschera ristrutturante', description: 'Nutrimento intensivo per capelli danneggiati', duration: 30 },
      { id: 'keratina', name: 'Keratina / Liscio brasiliano', description: 'Anti-crespo e disciplinante', duration: 150 },
      { id: 'anticaduta', name: 'Trattamento anticaduta', description: 'Rinforzo e rivitalizzazione del cuoio capelluto', duration: 45 },
    ],
  },
  {
    id: 'nails', label: 'Nails', icon: 'hand', color: '#f472b6', bg: 'rgba(244,114,182,0.15)',
    items: [
      { id: 'manicure', name: 'Manicure', description: 'Cura completa delle mani', duration: 40 },
      { id: 'pedicure', name: 'Pedicure', description: 'Cura completa dei piedi', duration: 50 },
      { id: 'gel', name: 'Ricostruzione unghie', description: 'Gel, acrilico o semipermanente', duration: 90 },
    ],
  },
  {
    id: 'epilazione', label: 'Epilazione', icon: 'zap', color: '#fbbf24', bg: 'rgba(251,191,36,0.15)',
    items: [
      { id: 'ceretta', name: 'Ceretta corpo', description: 'Gambe, ascelle, bikini', duration: 45 },
      { id: 'sopracciglia', name: 'Sopracciglia', description: 'Definizione e pulizia', duration: 15 },
      { id: 'lip', name: 'Baffetto / Labbro', description: 'Ceretta viso di precisione', duration: 15 },
    ],
  },
  {
    id: 'acconciature', label: 'Acconciature', icon: 'star', color: '#fb923c', bg: 'rgba(251,146,60,0.15)',
    items: [
      { id: 'sposa', name: 'Acconciatura sposa', description: 'Il grande giorno merita il meglio', duration: 120 },
      { id: 'cerimonia', name: 'Acconciatura cerimonia', description: 'Look elegante per ogni evento', duration: 60 },
      { id: 'updo', name: 'Raccolto creativo', description: 'Trecce, chignon e acconciature elaborate', duration: 60 },
    ],
  },
];

const TIMES = [
  '09:00','09:30','10:00','10:30','11:00','11:30',
  '12:00','12:30','14:00','14:30','15:00','15:30',
  '16:00','16:30','17:00','17:30','18:00','18:30',
];

function CatIcon({ id, color, size = 20 }: { id: string; color: string; size?: number }) {
  const props = { size, color };
  if (id === 'scissors') return <Scissors {...props} />;
  if (id === 'sparkles') return <Sparkles {...props} />;
  if (id === 'flower') return <Flower2 {...props} />;
  if (id === 'hand') return <Hand {...props} />;
  if (id === 'zap') return <Zap {...props} />;
  return <Star {...props} />;
}

type Step = 'menu' | 'details' | 'success';

export default function BookingPage() {
  const [step, setStep] = useState<Step>('menu');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [form, setForm] = useState({ clientName: '', clientPhone: '', clientEmail: '', preferredDate: '', preferredTime: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const set = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  const totalDuration = useMemo(() =>
    CATEGORIES.flatMap(c => c.items).filter(i => selectedServices.includes(i.id)).reduce((s, i) => s + i.duration, 0),
    [selectedServices]);

  const selectedNames = useMemo(() =>
    CATEGORIES.flatMap(c => c.items).filter(i => selectedServices.includes(i.id)).map(i => i.name),
    [selectedServices]);

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
          preferredDate: form.preferredDate, preferredTime: form.preferredTime, notes: form.notes,
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
            Abbiamo ricevuto la tua richiesta. Il salone ti contatterà presto per confermare l&apos;appuntamento.
          </p>
          {selectedNames.length > 0 && (
            <div className="rounded-xl p-3 mb-5 text-sm" style={{ background: '#12121a', color: '#71717a' }}>
              {selectedNames.join(' · ')} {totalDuration > 0 && `· ${totalDuration} min`}
            </div>
          )}
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={lbl}><Calendar size={13} className="inline mr-1" />Data *</label>
                <input type="date" value={form.preferredDate} onChange={e => set('preferredDate', e.target.value)} style={inp} min={new Date().toISOString().split('T')[0]} />
              </div>
              <div>
                <label style={lbl}><Clock size={13} className="inline mr-1" />Orario *</label>
                <select value={form.preferredTime} onChange={e => set('preferredTime', e.target.value)} style={inp}>
                  <option value="">— Seleziona —</option>
                  {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
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
        <h1 className="text-2xl font-bold text-white mb-1">I nostri trattamenti</h1>
        <p className="text-sm" style={{ color: '#71717a' }}>Scegli uno o più servizi e prenota online</p>
      </div>

      <div className="max-w-2xl mx-auto px-4 pb-32">
        {/* Category filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-2" style={{ scrollbarWidth: 'none' }}>
          <button onClick={() => setSelectedCategory(null)}
            className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium"
            style={{ background: selectedCategory === null ? 'rgba(99,102,241,0.2)' : '#1c1c27', border: `1px solid ${selectedCategory === null ? 'rgba(99,102,241,0.5)' : '#2e2e40'}`, color: selectedCategory === null ? '#818cf8' : '#71717a', cursor: 'pointer' }}>
            Tutti
          </button>
          {CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => setSelectedCategory(cat.id === selectedCategory ? null : cat.id)}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium"
              style={{ background: selectedCategory === cat.id ? cat.bg : '#1c1c27', border: `1px solid ${selectedCategory === cat.id ? cat.color + '60' : '#2e2e40'}`, color: selectedCategory === cat.id ? cat.color : '#71717a', cursor: 'pointer' }}>
              <CatIcon id={cat.icon} color={selectedCategory === cat.id ? cat.color : '#71717a'} size={13} />
              {cat.label}
            </button>
          ))}
        </div>

        {/* Categories & items */}
        {CATEGORIES.filter(cat => selectedCategory === null || cat.id === selectedCategory).map(cat => (
          <div key={cat.id} className="mb-8">
            {/* Category header */}
            <div className="flex items-center gap-3 mb-3 px-1">
              <div className="p-2 rounded-xl" style={{ background: cat.bg }}>
                <CatIcon id={cat.icon} color={cat.color} size={16} />
              </div>
              <div>
                <h2 className="font-bold text-white">{cat.label}</h2>
              </div>
            </div>
            {/* Items */}
            <div className="space-y-2">
              {cat.items.map(item => {
                const selected = selectedServices.includes(item.id);
                return (
                  <button key={item.id} onClick={() => toggleService(item.id)}
                    className="w-full text-left rounded-2xl p-4 transition-all"
                    style={{ background: selected ? cat.bg : '#1c1c27', border: `1px solid ${selected ? cat.color + '70' : '#2e2e40'}`, cursor: 'pointer', boxShadow: selected ? `0 0 16px ${cat.color}18` : 'none' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white">{item.name}</p>
                        <p className="text-sm mt-0.5 truncate" style={{ color: '#71717a' }}>{item.description}</p>
                        <div className="flex items-center gap-1 mt-2 text-xs" style={{ color: '#71717a' }}>
                          <Clock size={11} /> {item.duration} min
                        </div>
                      </div>
                      <div className="w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center mt-0.5"
                        style={{ borderColor: selected ? cat.color : '#3f3f5a', background: selected ? cat.color : 'transparent' }}>
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
              Prenota {selectedNames.length} {selectedNames.length === 1 ? 'servizio' : 'servizi'} · {totalDuration} min →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

