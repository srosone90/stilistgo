'use client';

import React, { useState } from 'react';
import { Scissors, Lock } from 'lucide-react';
import { useSalon } from '@/context/SalonContext';

export default function OperatorLockScreen({ onUnlock }: { onUnlock: () => void }) {
  const { operators, setActiveOperatorId, verifyOperatorPin, salonConfig } = useSalon();
  const [step, setStep] = useState<'select' | 'pin'>('select');
  const [selectedId, setSelectedId] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  const activeOps = operators.filter(o => o.active);

  function handleSelect(id: string) {
    const op = operators.find(o => o.id === id);
    if (!op) return;
    if (!op.pin) {
      setActiveOperatorId(id);
      onUnlock();
      return;
    }
    setSelectedId(id);
    setStep('pin');
    setPinInput('');
    setPinError(false);
  }

  function handlePinSubmit() {
    if (verifyOperatorPin(selectedId, pinInput)) {
      setActiveOperatorId(selectedId);
      onUnlock();
    } else {
      setPinError(true);
      setPinInput('');
    }
  }

  const selectedOp = operators.find(o => o.id === selectedId);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-6"
      style={{ background: '#0f0f13' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 mb-10">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)' }}
        >
          <Scissors size={22} className="text-white" />
        </div>
        <div>
          <p className="font-bold text-white text-xl leading-tight">
            {salonConfig.salonName || 'Stylistgo'}
          </p>
          <p className="text-sm" style={{ color: '#71717a' }}>
            Chi sta lavorando oggi?
          </p>
        </div>
      </div>

      {step === 'select' ? (
        <div className="w-full max-w-sm space-y-2.5">
          {activeOps.length === 0 ? (
            <p className="text-center text-sm py-8" style={{ color: '#71717a' }}>
              Nessun operatore attivo. Accedi come titolare e crea gli operatori dalla sezione Personale.
            </p>
          ) : (
            activeOps.map(op => (
              <button
                key={op.id}
                onClick={() => handleSelect(op.id)}
                className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-left transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: '#1c1c27',
                  border: `1px solid ${op.color}50`,
                  cursor: 'pointer',
                }}
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0"
                  style={{ background: op.color + '25', color: op.color }}
                >
                  {op.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-white text-sm">{op.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#71717a' }}>
                    {op.pin ? (
                      <>
                        <Lock size={10} style={{ display: 'inline', marginRight: 3 }} />
                        PIN richiesto
                      </>
                    ) : (
                      'Accesso libero'
                    )}
                  </p>
                </div>
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: op.color }} />
              </button>
            ))
          )}

          {/* Link titolare */}
          <p className="text-center text-xs pt-4" style={{ color: '#3f3f5a' }}>
            Sei il/la titolare?{' '}
            <button
              onClick={() => {
                // Imposta nessun operatore e sblocca (il
                // titolare usa il login Supabase già effettuato)
                setActiveOperatorId('');
                onUnlock();
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#6366f1',
                cursor: 'pointer',
                fontSize: 'inherit',
                textDecoration: 'underline',
              }}
            >
              Entra come admin
            </button>
          </p>
        </div>
      ) : (
        <div className="w-full max-w-xs">
          {/* Avatar operatore */}
          <div className="text-center mb-6">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold mx-auto mb-3"
              style={{
                background: (selectedOp?.color || '#6366f1') + '25',
                color: selectedOp?.color || '#6366f1',
              }}
            >
              {selectedOp?.name.charAt(0).toUpperCase()}
            </div>
            <p className="font-semibold text-white text-lg">{selectedOp?.name}</p>
            <p className="text-sm mt-1" style={{ color: '#71717a' }}>
              Inserisci il tuo PIN
            </p>
          </div>

          {/* Input PIN grosso */}
          <input
            type="password"
            maxLength={8}
            value={pinInput}
            onChange={e => {
              setPinInput(e.target.value.replace(/\D/g, ''));
              setPinError(false);
            }}
            onKeyDown={e => e.key === 'Enter' && handlePinSubmit()}
            autoFocus
            placeholder="••••"
            style={{
              background: '#1c1c27',
              border: `2px solid ${pinError ? '#ef4444' : '#2e2e40'}`,
              borderRadius: '14px',
              padding: '16px',
              color: '#f4f4f5',
              fontSize: '28px',
              outline: 'none',
              width: '100%',
              letterSpacing: '0.7em',
              textAlign: 'center',
              transition: 'border-color 0.15s',
            }}
          />
          {pinError && (
            <p className="text-center text-sm mt-2" style={{ color: '#ef4444' }}>
              PIN errato. Riprova.
            </p>
          )}

          <button
            onClick={handlePinSubmit}
            className="w-full mt-4 py-3.5 rounded-xl font-semibold text-white text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)' }}
          >
            Accedi
          </button>

          <button
            onClick={() => {
              setStep('select');
              setPinInput('');
              setPinError(false);
            }}
            className="w-full mt-2 py-2 text-xs"
            style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer' }}
          >
            ← Cambia operatore
          </button>
        </div>
      )}
    </div>
  );
}
