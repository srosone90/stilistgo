'use client';

import React, { useState } from 'react';
import { Scissors, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useSalon } from '@/context/SalonContext';
import { ServiceCategory } from '@/types/salon';

const DEFAULT_COLORS = ['#6366f1', '#a855f7', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];

const inp: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg-input)',
  border: '1px solid var(--border)',
  borderRadius: '12px',
  padding: '13px 16px',
  color: 'var(--text)',
  fontSize: '15px',
  outline: 'none',
};
const lbl: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--muted)',
  marginBottom: '7px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

interface Props {
  onComplete: (operatorId: string) => void;
}

export default function OnboardingWizard({ onComplete }: Props) {
  const { updateSalonConfig, addService, addOperator } = useSalon();

  const [step, setStep] = useState(1);
  const [salonName, setSalonName] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [serviceCategory, setServiceCategory] = useState<ServiceCategory>('Taglio');
  const [servicePrice, setServicePrice] = useState('');
  const [serviceDuration, setServiceDuration] = useState('45');
  const [ownerName, setOwnerName] = useState('');

  const canStep1 = salonName.trim().length >= 2;
  const canStep2 = serviceName.trim().length >= 1 && Number(servicePrice) > 0;
  const canStep3 = ownerName.trim().length >= 2;

  function handleStep1() {
    if (!canStep1) return;
    updateSalonConfig({ salonName: salonName.trim() });
    setStep(2);
  }

  function handleStep2() {
    if (!canStep2) return;
    setStep(3);
  }

  function handleStep3() {
    if (!canStep3) return;

    // Crea il servizio
    addService({
      name: serviceName.trim(),
      category: serviceCategory,
      duration: Math.max(5, parseInt(serviceDuration) || 45),
      price: parseFloat(servicePrice) || 0,
      description: '',
      operatorIds: [],
      active: true,
    });

    // Crea l'operatore titolare
    const opId = addOperator({
      name: ownerName.trim(),
      email: '',
      role: 'owner',
      serviceIds: [],
      color: DEFAULT_COLORS[0],
      commissionRate: 0,
      schedule: [0, 1, 2, 3, 4, 5, 6].map(d => ({
        dayOfWeek: d as 0 | 1 | 2 | 3 | 4 | 5 | 6,
        isWorking: d >= 1 && d <= 6,
        startTime: '09:00',
        endTime: '19:00',
      })),
      active: true,
    });

    onComplete(opId ?? '');
  }

  const steps = [
    { num: 1, label: 'Il salone' },
    { num: 2, label: 'Primo servizio' },
    { num: 3, label: 'Il tuo nome' },
  ];

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center p-6"
      style={{ background: 'var(--bg-page)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 mb-8">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)' }}
        >
          <Scissors size={22} className="text-white" />
        </div>
        <div>
          <p className="font-bold text-white text-xl leading-tight">Benvenuto su Stylistgo</p>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Configurazione rapida — 1 minuto</p>
        </div>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-3 mb-8">
        {steps.map((s, i) => (
          <React.Fragment key={s.num}>
            <div className="flex flex-col items-center gap-1">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all"
                style={{
                  background: step > s.num
                    ? 'rgba(34,197,94,0.2)'
                    : step === s.num
                      ? 'linear-gradient(135deg,#6366f1,#a855f7)'
                      : 'var(--bg-card)',
                  color: step > s.num ? '#4ade80' : step === s.num ? 'white' : 'var(--muted)',
                  border: step < s.num ? '1px solid var(--border)' : 'none',
                }}
              >
                {step > s.num ? <CheckCircle2 size={16} /> : s.num}
              </div>
              <span style={{ fontSize: '10px', color: step === s.num ? 'var(--accent-light)' : 'var(--muted)' }}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 1,
                  background: step > s.num + 1 ? '#4ade80' : 'var(--border)',
                  marginBottom: 16,
                  transition: 'background 0.3s',
                }}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step content */}
      <div
        className="w-full max-w-sm rounded-2xl p-6"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        {step === 1 && (
          <>
            <h2 className="text-white font-bold text-lg mb-1">Come si chiama il tuo salone?</h2>
            <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>Sarà visibile sull'agenda e nei messaggi ai clienti.</p>
            <div className="space-y-4">
              <div>
                <label style={lbl}>Nome del salone</label>
                <input
                  style={inp}
                  placeholder="es. Salone Lucia, Hair Studio Rossi…"
                  value={salonName}
                  onChange={e => setSalonName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleStep1()}
                  autoFocus
                />
              </div>
              <button
                onClick={handleStep1}
                disabled={!canStep1}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)', border: 'none' }}
              >
                Continua <ArrowRight size={16} />
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-white font-bold text-lg mb-1">Aggiungi il tuo primo servizio</h2>
            <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>Potrai aggiungerne altri in seguito dalla sezione Servizi.</p>
            <div className="space-y-4">
              <div>
                <label style={lbl}>Nome servizio</label>
                <input
                  style={inp}
                  placeholder="es. Taglio, Colore, Piega…"
                  value={serviceName}
                  onChange={e => setServiceName(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label style={lbl}>Categoria</label>
                <select
                  style={{ ...inp, cursor: 'pointer' }}
                  value={serviceCategory}
                  onChange={e => setServiceCategory(e.target.value as ServiceCategory)}
                >
                  {(['Taglio','Colore','Trattamento','Piega','Estetica','Nail','Sposa','Altro'] as ServiceCategory[]).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={lbl}>Prezzo (€)</label>
                  <input
                    style={inp}
                    type="number"
                    inputMode="decimal"
                    placeholder="30"
                    min={0}
                    value={servicePrice}
                    onChange={e => setServicePrice(e.target.value)}
                  />
                </div>
                <div>
                  <label style={lbl}>Durata (min)</label>
                  <input
                    style={inp}
                    type="number"
                    inputMode="numeric"
                    placeholder="45"
                    min={5}
                    value={serviceDuration}
                    onChange={e => setServiceDuration(e.target.value)}
                  />
                </div>
              </div>
              <button
                onClick={handleStep2}
                disabled={!canStep2}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)', border: 'none' }}
              >
                Continua <ArrowRight size={16} />
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="text-white font-bold text-lg mb-1">Come ti chiami?</h2>
            <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>Crea il tuo profilo operatore. Potrai aggiungere altri dal personale.</p>
            <div className="space-y-4">
              <div>
                <label style={lbl}>Il tuo nome</label>
                <input
                  style={inp}
                  placeholder="es. Lucia, Marco…"
                  value={ownerName}
                  onChange={e => setOwnerName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleStep3()}
                  autoFocus
                />
              </div>
              <button
                onClick={handleStep3}
                disabled={!canStep3}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)', border: 'none' }}
              >
                Inizia a usare Stylistgo 🎉
              </button>
            </div>
          </>
        )}
      </div>

      {/* Skip link */}
      <button
        onClick={() => onComplete('')}
        className="mt-5 text-xs"
        style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}
      >
        Salta per ora — configuro più tardi
      </button>
    </div>
  );
}
