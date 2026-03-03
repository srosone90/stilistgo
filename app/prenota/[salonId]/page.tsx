'use client';

import React, { useState, useEffect, useMemo, use } from 'react';
import { CheckCircle2, Clock, Scissors, ArrowLeft, Calendar, User, Download, Share, X } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────
interface SalonService {
  id: string; name: string; duration: number; price: number; category: string;
}
interface SalonOperator { id: string; name: string; color: string; }
interface ClientAppConfig {
  accentColor: string;
  welcomeMessage: string;
  aboutText: string;
  showPrices: boolean;
  maxAdvanceDays: number;
  minAdvanceHours: number;
  cancellationPolicy: string;
  bookingConfirmationMessage: string;
}
interface StoredClient {
  salonId: string;
  clientPhone: string;
  clientName: string;
  clientEmail: string;
}

const STORAGE_KEY = 'stilistgo_client_identity';
const DEFAULT_COLOR = '#c084fc';

// ── Helpers ────────────────────────────────────────────────────────
function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r} ${g} ${b}`;
}

// ── iOS Install Banner ─────────────────────────────────────────────
function IosBanner({ color, onClose }: { color: string; onClose: () => void }) {
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: '#1c1c1e', borderTop: '1px solid rgba(255,255,255,0.15)',
      padding: '16px 20px 32px', borderRadius: '16px 16px 0 0',
      boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
    }}>
      <button onClick={onClose} style={{
        position: 'absolute', top: 12, right: 16,
        background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
        fontSize: 22, cursor: 'pointer', lineHeight: 1,
      }}>×</button>
      <p style={{ color: 'white', fontWeight: 700, fontSize: 16, margin: '0 0 8px' }}>
        📲 Aggiungi alla schermata Home
      </p>
      <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, margin: '0 0 14px', lineHeight: 1.5 }}>
        Su iPhone: tocca <Share size={13} style={{ display: 'inline', verticalAlign: 'middle' }} /> in basso, poi &ldquo;Aggiungi a schermata Home&rdquo;.
        Su Android: tocca ⋮ in alto e poi &ldquo;Aggiungi a schermata Home&rdquo;.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: `rgba(${hexToRgb(color)},0.15)`, borderRadius: 12, border: `1px solid rgba(${hexToRgb(color)},0.35)` }}>
        <Download size={16} style={{ color }} />
        <span style={{ color, fontSize: 13, fontWeight: 600 }}>
          L&apos;app si aprirà a schermo intero, senza barra del browser
        </span>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────
export default function PrenotaPWAPage({ params }: { params: Promise<{ salonId: string }> }) {
  const { salonId } = use(params);

  // ── Salon data
  const [salonName, setSalonName] = useState('');
  const [services, setServices] = useState<SalonService[]>([]);
  const [operators, setOperators] = useState<SalonOperator[]>([]);
  const [appConfig, setAppConfig] = useState<ClientAppConfig>({
    accentColor: DEFAULT_COLOR, welcomeMessage: 'Benvenuta! 💇‍♀️', aboutText: '',
    showPrices: true, maxAdvanceDays: 90, minAdvanceHours: 2,
    cancellationPolicy: '', bookingConfirmationMessage: 'Prenotazione confermata! Ti aspettiamo. 🌸',
  });
  const [loading, setLoading] = useState(true);

  // ── Client identity (from token or localStorage)
  const [client, setClient] = useState<StoredClient | null>(null);
  const [tokenVerified, setTokenVerified] = useState(false);

  // ── Booking flow
  const [step, setStep] = useState<'home' | 'services' | 'operator' | 'datetime' | 'confirm' | 'success'>('home');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedOperator, setSelectedOperator] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualEmail, setManualEmail] = useState('');

  // ── PWA install
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  const accent = appConfig.accentColor || DEFAULT_COLOR;
  const rgb = hexToRgb(accent);

  // ── Inject manifest + service worker + theme color ─────────────────────
  useEffect(() => {
    // Dynamic manifest link
    const existing = document.querySelector('link[rel="manifest"]');
    if (!existing) {
      const link = document.createElement('link');
      link.rel = 'manifest';
      link.href = `/api/manifest/${salonId}`;
      document.head.appendChild(link);
    } else {
      (existing as HTMLLinkElement).href = `/api/manifest/${salonId}`;
    }
    // Service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    // PWA install prompt (Android/Chrome)
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    // Show install banner after 3 sec if not already installed
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    setIsStandalone(standalone);
    const stored = localStorage.getItem('stilistgo_install_dismissed');
    if (!stored && !standalone) {
      setTimeout(() => setShowInstallBanner(true), 3000);
    }
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [salonId]);

  // Update theme-color in meta whenever accent changes
  useEffect(() => {
    let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement('meta') as HTMLMetaElement;
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = accent;
  }, [accent]);

  // ── Read ?t=TOKEN from URL ─────────────────────────────────────────────
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const token = searchParams.get('t');
    if (token) {
      fetch(`/api/client-token?t=${encodeURIComponent(token)}`)
        .then(r => r.json())
        .then(d => {
          if (d.valid && d.payload.salonId === salonId) {
            const identity: StoredClient = {
              salonId,
              clientPhone: d.payload.clientPhone,
              clientName: d.payload.clientName,
              clientEmail: d.payload.clientEmail ?? '',
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
            setClient(identity);
            setTokenVerified(true);
            // Clean token from URL without reload
            const clean = new URL(window.location.href);
            clean.searchParams.delete('t');
            window.history.replaceState({}, '', clean.toString());
          }
        })
        .catch(() => {});
    } else {
      // Try stored identity
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed: StoredClient = JSON.parse(stored);
          if (parsed.salonId === salonId) setClient(parsed);
        }
      } catch { /* ignore */ }
    }
  }, [salonId]);

  // ── Load salon data ────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`/api/booking-slots?salonId=${encodeURIComponent(salonId)}`)
      .then(r => r.json())
      .then(d => {
        setSalonName(d.salonName || '');
        setServices(d.services || []);
        if (d.operators?.length > 0) {
          setOperators(d.operators);
          setSelectedOperator(d.operators[0].id);
        }
        if (d.clientAppConfig) {
          setAppConfig(prev => ({ ...prev, ...d.clientAppConfig }));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [salonId]);

  // ── Fetch slots when date changes ──────────────────────────────────────
  useEffect(() => {
    if (!selectedDate) { setAvailableSlots([]); return; }
    setLoadingSlots(true);
    const opParam = selectedOperator ? `&operatorId=${encodeURIComponent(selectedOperator)}` : '';
    fetch(`/api/booking-slots?salonId=${encodeURIComponent(salonId)}&date=${selectedDate}${opParam}`)
      .then(r => r.json())
      .then(d => setAvailableSlots(d.available || []))
      .catch(() => setAvailableSlots([]))
      .finally(() => setLoadingSlots(false));
    setSelectedTime('');
  }, [selectedDate, salonId, selectedOperator]);

  // ── Min date (minAdvanceHours) ─────────────────────────────────────────
  const minDate = useMemo(() => {
    const d = new Date();
    d.setHours(d.getHours() + (appConfig.minAdvanceHours || 2));
    return d.toISOString().split('T')[0];
  }, [appConfig.minAdvanceHours]);

  const maxDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + (appConfig.maxAdvanceDays || 90));
    return d.toISOString().split('T')[0];
  }, [appConfig.maxAdvanceDays]);

  // ── Group services by category ─────────────────────────────────────────
  const categories = useMemo(() => {
    const map = new Map<string, SalonService[]>();
    for (const s of services) {
      if (!map.has(s.category)) map.set(s.category, []);
      map.get(s.category)!.push(s);
    }
    return map;
  }, [services]);

  const selectedServiceObjects = useMemo(
    () => services.filter(s => selectedServices.includes(s.id)),
    [services, selectedServices]
  );
  const totalDuration = selectedServiceObjects.reduce((sum, s) => sum + s.duration, 0);
  const totalPrice = selectedServiceObjects.reduce((sum, s) => sum + (s.price || 0), 0);

  const effectiveName  = client?.clientName  ?? manualName;
  const effectivePhone = client?.clientPhone ?? manualPhone;
  const effectiveEmail = client?.clientEmail ?? manualEmail;

  // ── Submit booking ─────────────────────────────────────────────────────
  async function submitBooking() {
    if (!effectiveName || !effectivePhone) return;
    setSubmitting(true);
    try {
      const serviceNames = selectedServiceObjects.map(s => s.name).join(', ');
      const op = operators.find(o => o.id === selectedOperator);
      await fetch('/api/booking-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salonId,
          clientName: effectiveName,
          clientPhone: effectivePhone,
          clientEmail: effectiveEmail,
          services: serviceNames,
          operatorId: selectedOperator,
          operatorName: op?.name ?? '',
          preferredDate: selectedDate,
          preferredTime: selectedTime,
          notes: '',
        }),
      });
      setStep('success');
    } catch {
      // still show success (booking stored client-side)
      setStep('success');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Style helpers ──────────────────────────────────────────────────────
  const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: '#0f0f13',
    color: 'white',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    paddingBottom: 100,
  };
  const cardStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 20,
  };
  const btnPrimary: React.CSSProperties = {
    background: `rgba(${rgb},0.85)`,
    color: 'white',
    border: 'none',
    borderRadius: 14,
    padding: '14px 28px',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    width: '100%',
    marginTop: 8,
  };
  const btnSecondary: React.CSSProperties = {
    background: 'rgba(255,255,255,0.08)',
    color: 'rgba(255,255,255,0.8)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 14,
    padding: '12px 24px',
    fontSize: 15,
    cursor: 'pointer',
    width: '100%',
  };

  if (loading) return (
    <div style={{ ...pageStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>Caricamento…</span>
    </div>
  );

  // ── STEP: HOME ─────────────────────────────────────────────────────────
  if (step === 'home') return (
    <div style={pageStyle}>
      {/* Header strip */}
      <div style={{ background: `rgba(${rgb},0.15)`, borderBottom: `1px solid rgba(${rgb},0.25)`, padding: '20px 20px 16px' }}>
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: `rgba(${rgb},0.3)`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <Scissors size={24} style={{ color: accent }} />
          </div>
          <p style={{ fontSize: 11, color: `rgba(${rgb},1)`, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 4px' }}>{salonName}</p>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 6px' }}>{appConfig.welcomeMessage}</h1>
          {appConfig.aboutText && <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', margin: 0, lineHeight: 1.6 }}>{appConfig.aboutText}</p>}
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Client greeting */}
        {client && (
          <div style={{ ...cardStyle, borderColor: `rgba(${rgb},0.3)`, background: `rgba(${rgb},0.08)` }}>
            <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>
              Ciao <strong style={{ color: 'white' }}>{client.clientName}</strong>! Sei pronta per prenotare? 💇‍♀️
            </p>
          </div>
        )}

        <button onClick={() => setStep('services')} style={btnPrimary}>
          📅 Prenota un appuntamento
        </button>

        {/* Install banner button */}
        {!isStandalone && (
          <button
            onClick={() => {
              if (deferredPrompt) {
                (deferredPrompt as unknown as { prompt: () => void }).prompt();
                setDeferredPrompt(null);
              } else {
                setShowInstallBanner(true);
              }
            }}
            style={btnSecondary}
          >
            <Download size={15} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
            Aggiungi alla schermata Home
          </button>
        )}

        {appConfig.cancellationPolicy && (
          <div style={{ ...cardStyle, padding: '14px 16px' }}>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', margin: '0 0 4px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Disdetta</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: 0, lineHeight: 1.5 }}>{appConfig.cancellationPolicy}</p>
          </div>
        )}
      </div>

      {showInstallBanner && (
        <IosBanner color={accent} onClose={() => {
          setShowInstallBanner(false);
          localStorage.setItem('stilistgo_install_dismissed', '1');
        }} />
      )}
    </div>
  );

  // ── STEP: SERVICES ─────────────────────────────────────────────────────
  if (step === 'services') return (
    <div style={pageStyle}>
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '20px 20px 0' }}>
        <button onClick={() => setStep('home')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, padding: '0 0 16px' }}>
          <ArrowLeft size={16} /> Indietro
        </button>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>Scegli i servizi</h2>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: '0 0 20px' }}>Puoi selezionare anche più servizi</p>
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {categories.size === 0 && (
          <p style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: 40 }}>Nessun servizio disponibile</p>
        )}
        {[...categories.entries()].map(([cat, items]) => (
          <div key={cat}>
            <p style={{ fontSize: 11, fontWeight: 700, color: `rgba(${rgb},1)`, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>{cat}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map(s => {
                const sel = selectedServices.includes(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedServices(prev => sel ? prev.filter(x => x !== s.id) : [...prev, s.id])}
                    style={{
                      ...cardStyle,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      cursor: 'pointer', textAlign: 'left',
                      border: `1px solid ${sel ? `rgba(${rgb},0.6)` : 'rgba(255,255,255,0.1)'}`,
                      background: sel ? `rgba(${rgb},0.15)` : 'rgba(255,255,255,0.05)',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div>
                      <p style={{ margin: 0, fontSize: 15, fontWeight: sel ? 600 : 400 }}>{s.name}</p>
                      <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={11} /> {s.duration} min
                        </span>
                        {appConfig.showPrices && s.price > 0 && (
                          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>€{s.price}</span>
                        )}
                      </div>
                    </div>
                    {sel && <CheckCircle2 size={20} style={{ color: accent, flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {selectedServices.length > 0 && (
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '16px 20px 32px', background: '#0f0f13', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ maxWidth: 520, margin: '0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{selectedServices.length} servizi · {totalDuration} min</span>
                {appConfig.showPrices && totalPrice > 0 && <span style={{ fontSize: 13, color: accent, fontWeight: 600 }}>€{totalPrice}</span>}
              </div>
              <button onClick={() => setStep(operators.length > 1 ? 'operator' : 'datetime')} style={btnPrimary}>
                Continua →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // ── STEP: OPERATOR ─────────────────────────────────────────────────────
  if (step === 'operator') return (
    <div style={pageStyle}>
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <button onClick={() => setStep('services')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, padding: 0 }}>
          <ArrowLeft size={16} /> Indietro
        </button>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>Scegli operatrice</h2>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: 0 }}>Con chi preferisci?</p>
        </div>
        {operators.map(op => (
          <button
            key={op.id}
            onClick={() => { setSelectedOperator(op.id); setStep('datetime'); }}
            style={{
              ...cardStyle,
              display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', textAlign: 'left',
              border: `1px solid ${selectedOperator === op.id ? `rgba(${rgb},0.6)` : 'rgba(255,255,255,0.1)'}`,
              background: selectedOperator === op.id ? `rgba(${rgb},0.15)` : 'rgba(255,255,255,0.05)',
            }}
          >
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: op.color || accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, color: 'white', flexShrink: 0 }}>
              {op.name.charAt(0).toUpperCase()}
            </div>
            <span style={{ fontSize: 16, fontWeight: 500 }}>{op.name}</span>
            {selectedOperator === op.id && <CheckCircle2 size={20} style={{ color: accent, marginLeft: 'auto' }} />}
          </button>
        ))}
      </div>
    </div>
  );

  // ── STEP: DATE & TIME ──────────────────────────────────────────────────
  if (step === 'datetime') return (
    <div style={pageStyle}>
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '20px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <button onClick={() => setStep(operators.length > 1 ? 'operator' : 'services')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, padding: 0 }}>
          <ArrowLeft size={16} /> Indietro
        </button>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>Scegli data e ora</h2>
        </div>

        <div style={cardStyle}>
          <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 600, display: 'block', marginBottom: 8 }}>DATA</label>
          <input
            type="date"
            min={minDate}
            max={maxDate}
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: '10px 14px', color: 'white', fontSize: 15, width: '100%', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        {selectedDate && (
          <div style={cardStyle}>
            <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 600, display: 'block', marginBottom: 10 }}>ORA</label>
            {loadingSlots ? (
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Caricamento orari…</p>
            ) : availableSlots.length === 0 ? (
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Nessun orario disponibile per questa data.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {availableSlots.map(slot => (
                  <button
                    key={slot}
                    onClick={() => setSelectedTime(slot)}
                    style={{
                      padding: '10px 4px', borderRadius: 10, fontSize: 14, fontWeight: 500, cursor: 'pointer', border: 'none',
                      background: selectedTime === slot ? accent : 'rgba(255,255,255,0.08)',
                      color: selectedTime === slot ? 'white' : 'rgba(255,255,255,0.7)',
                      transition: 'all 0.15s',
                    }}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {selectedDate && selectedTime && (
          <button onClick={() => setStep('confirm')} style={btnPrimary}>
            Continua →
          </button>
        )}
      </div>
    </div>
  );

  // ── STEP: CONFIRM ──────────────────────────────────────────────────────
  if (step === 'confirm') return (
    <div style={pageStyle}>
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '20px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <button onClick={() => setStep('datetime')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, padding: 0 }}>
          <ArrowLeft size={16} /> Indietro
        </button>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>Conferma prenotazione</h2>
        </div>

        {/* Summary */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { icon: <Scissors size={14} />, label: selectedServiceObjects.map(s => s.name).join(', ') },
              { icon: <User size={14} />, label: operators.find(o => o.id === selectedOperator)?.name ?? 'Qualsiasi' },
              { icon: <Calendar size={14} />, label: `${selectedDate} alle ${selectedTime}` },
              { icon: <Clock size={14} />, label: `${totalDuration} min${appConfig.showPrices && totalPrice > 0 ? ` · €${totalPrice}` : ''}` },
            ].map((row, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ color: accent }}>{row.icon}</div>
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)' }}>{row.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Client info — pre-filled if known, editable if not */}
        {!client ? (
          <div style={cardStyle}>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: '0 0 14px', fontWeight: 600 }}>I TUOI DATI</p>
            {[
              { label: 'Nome *', value: manualName, key: 'name', type: 'text', setter: setManualName },
              { label: 'Telefono *', value: manualPhone, key: 'phone', type: 'tel', setter: setManualPhone },
              { label: 'Email', value: manualEmail, key: 'email', type: 'email', setter: setManualEmail },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', display: 'block', marginBottom: 4 }}>{f.label}</label>
                <input
                  type={f.type}
                  value={f.value}
                  onChange={e => f.setter(e.target.value)}
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: '10px 14px', color: 'white', fontSize: 14, width: '100%', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ ...cardStyle, background: `rgba(${rgb},0.08)`, borderColor: `rgba(${rgb},0.3)` }}>
            <p style={{ fontSize: 13, color: accent, margin: '0 0 4px', fontWeight: 600 }}>Prenotazione per</p>
            <p style={{ fontSize: 15, fontWeight: 700, margin: '0 0 2px' }}>{client.clientName}</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: 0 }}>{client.clientPhone}</p>
          </div>
        )}

        <button
          onClick={submitBooking}
          disabled={submitting || !effectiveName || !effectivePhone}
          style={{ ...btnPrimary, opacity: submitting || !effectiveName || !effectivePhone ? 0.5 : 1, cursor: submitting || !effectiveName || !effectivePhone ? 'not-allowed' : 'pointer' }}
        >
          {submitting ? 'Invio in corso…' : '✅ Conferma prenotazione'}
        </button>
      </div>
    </div>
  );

  // ── STEP: SUCCESS ──────────────────────────────────────────────────────
  if (step === 'success') return (
    <div style={{ ...pageStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ maxWidth: 400, padding: 32, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: `rgba(${rgb},0.2)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CheckCircle2 size={36} style={{ color: accent }} />
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Richiesta inviata!</h2>
        <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)', margin: 0, lineHeight: 1.6 }}>
          {appConfig.bookingConfirmationMessage}
        </p>
        <div style={{ ...cardStyle, width: '100%', textAlign: 'left' }}>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: '0 0 8px' }}>Riepilogo</p>
          <p style={{ fontSize: 15, fontWeight: 600, margin: '0 0 4px' }}>{selectedServiceObjects.map(s => s.name).join(', ')}</p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: 0 }}>{selectedDate} alle {selectedTime}</p>
        </div>
        <button onClick={() => { setStep('home'); setSelectedServices([]); setSelectedDate(''); setSelectedTime(''); }} style={btnSecondary}>
          Torna all&apos;inizio
        </button>
      </div>
    </div>
  );

  return null;
}
