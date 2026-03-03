'use client';

import React, { useState, useEffect, useMemo, use } from 'react';
import { CheckCircle2, Clock, Scissors, ArrowLeft, Calendar, User, Download, Share, Sparkles, MapPin, History, Phone, Star, X, ChevronRight, Edit2, RefreshCw } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────
interface SalonService { id: string; name: string; duration: number; price: number; category: string; }
interface SalonOperator { id: string; name: string; color: string; }
interface ClientAppConfig {
  accentColor: string; welcomeMessage: string; aboutText: string;
  showPrices: boolean; maxAdvanceDays: number; minAdvanceHours: number;
  cancellationPolicy: string; bookingConfirmationMessage: string;
  contactPhone?: string; contactAddress?: string;
}
interface StoredClient { salonId: string; clientPhone: string; clientName: string; clientEmail: string; }
interface HistoryBooking { id: string; service: string; preferred_date: string; preferred_time: string; status: 'pending' | 'confirmed' | 'cancelled'; created_at: string; notes?: string; }

const STORAGE_KEY = 'stilistgo_client_identity';
const DEFAULT_COLOR = '#c084fc';

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

function lighten(hex: string, amount = 0.3) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lr = Math.round(r + (255 - r) * amount);
  const lg = Math.round(g + (255 - g) * amount);
  const lb = Math.round(b + (255 - b) * amount);
  return `#${lr.toString(16).padStart(2,'0')}${lg.toString(16).padStart(2,'0')}${lb.toString(16).padStart(2,'0')}`;
}

// ── Progress dots ──────────────────────────────────────────────────
function ProgressBar({ step, accent }: { step: string; accent: string }) {
  const steps = ['services', 'operator', 'datetime', 'confirm'];
  const cur = steps.indexOf(step);
  if (cur < 0) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', padding: '12px 0 0' }}>
      {steps.map((_, i) => (
        <div key={i} style={{
          height: 4, borderRadius: 2,
          width: i === cur ? 24 : 8,
          background: i <= cur ? accent : 'rgba(255,255,255,0.15)',
          transition: 'all 0.3s',
        }} />
      ))}
    </div>
  );
}



// ── ICS calendar util ─────────────────────────────────────────────
function generateICS(service: string, date: string, time: string, salon: string, duration: number) {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, m] = time.split(':').map(Number);
  const pad = (n: number) => String(n).padStart(2, '0');
  const dtStart = `${y}${pad(mo)}${pad(d)}T${pad(h)}${pad(m)}00`;
  const end = new Date(y, mo - 1, d, h, m + duration);
  const dtEnd = `${end.getFullYear()}${pad(end.getMonth()+1)}${pad(end.getDate())}T${pad(end.getHours())}${pad(end.getMinutes())}00`;
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Stylistgo//PWA//IT','BEGIN:VEVENT',`DTSTART:${dtStart}`,`DTEND:${dtEnd}`,`SUMMARY:${service} @ ${salon}`,'DESCRIPTION:Prenotato tramite Stylistgo','END:VEVENT','END:VCALENDAR'].join('\r\n');
}
function downloadICS(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Main ───────────────────────────────────────────────────────────
export default function PrenotaPWAPage({ params }: { params: Promise<{ salonId: string }> }) {
  const { salonId } = use(params);

  const [salonName, setSalonName] = useState('');
  const [services, setServices] = useState<SalonService[]>([]);
  const [operators, setOperators] = useState<SalonOperator[]>([]);
  const [appConfig, setAppConfig] = useState<ClientAppConfig>({
    accentColor: DEFAULT_COLOR, welcomeMessage: 'Benvenuta! 💇‍♀️', aboutText: '',
    showPrices: true, maxAdvanceDays: 90, minAdvanceHours: 2,
    cancellationPolicy: '', bookingConfirmationMessage: 'Prenotazione confermata! Ti aspettiamo. 🌸',
  });
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<StoredClient | null>(null);

  const [step, setStep] = useState<'home' | 'services' | 'operator' | 'datetime' | 'confirm' | 'success' | 'history' | 'profile'>('home');
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
  const [notes, setNotes] = useState('');
  const [history, setHistory] = useState<HistoryBooking[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState({ name: '', email: '' });

  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [pwaChecked, setPwaChecked] = useState(false);

  const accent = appConfig.accentColor || DEFAULT_COLOR;
  const rgb = hexToRgb(accent);
  const light = lighten(accent, 0.4);

  // ── PWA setup ──────────────────────────────────────────────────────────
  useEffect(() => {
    const existing = document.querySelector('link[rel="manifest"]');
    if (!existing) {
      const link = document.createElement('link');
      link.rel = 'manifest'; link.href = `/api/manifest/${salonId}`;
      document.head.appendChild(link);
    } else { (existing as HTMLLinkElement).href = `/api/manifest/${salonId}`; }
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    const handler = (e: Event) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches);
    setPwaChecked(true);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [salonId]);

  useEffect(() => {
    let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (!meta) { meta = document.createElement('meta') as HTMLMetaElement; meta.name = 'theme-color'; document.head.appendChild(meta); }
    meta.content = accent;
  }, [accent]);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('t');
    if (token) {
      fetch(`/api/client-token?t=${encodeURIComponent(token)}`).then(r => r.json()).then(d => {
        if (d.valid && d.payload.salonId === salonId) {
          const id: StoredClient = { salonId, clientPhone: d.payload.clientPhone, clientName: d.payload.clientName, clientEmail: d.payload.clientEmail ?? '' };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(id));
          setClient(id);
          const clean = new URL(window.location.href); clean.searchParams.delete('t');
          window.history.replaceState({}, '', clean.toString());
        }
      }).catch(() => {});
    } else {
      try {
        const s = localStorage.getItem(STORAGE_KEY);
        if (s) { const p: StoredClient = JSON.parse(s); if (p.salonId === salonId) setClient(p); }
      } catch { /**/ }
    }
  }, [salonId]);

  useEffect(() => {
    fetch(`/api/booking-slots?salonId=${encodeURIComponent(salonId)}`).then(r => r.json()).then(d => {
      setSalonName(d.salonName || '');
      setServices(d.services || []);
      if (d.operators?.length > 0) { setOperators(d.operators); setSelectedOperator(d.operators[0].id); }
      if (d.clientAppConfig) setAppConfig(prev => ({ ...prev, ...d.clientAppConfig }));
    }).catch(() => {}).finally(() => setLoading(false));
  }, [salonId]);

  useEffect(() => {
    if (!selectedDate) { setAvailableSlots([]); return; }
    setLoadingSlots(true);
    const op = selectedOperator ? `&operatorId=${encodeURIComponent(selectedOperator)}` : '';
    fetch(`/api/booking-slots?salonId=${encodeURIComponent(salonId)}&date=${selectedDate}${op}`)
      .then(r => r.json()).then(d => setAvailableSlots(d.available || [])).catch(() => setAvailableSlots([])).finally(() => setLoadingSlots(false));
    setSelectedTime('');
  }, [selectedDate, salonId, selectedOperator]);

  const minDate = useMemo(() => { const d = new Date(); d.setHours(d.getHours() + (appConfig.minAdvanceHours || 2)); return d.toISOString().split('T')[0]; }, [appConfig.minAdvanceHours]);
  const maxDate = useMemo(() => { const d = new Date(); d.setDate(d.getDate() + (appConfig.maxAdvanceDays || 90)); return d.toISOString().split('T')[0]; }, [appConfig.maxAdvanceDays]);

  const categories = useMemo(() => {
    const map = new Map<string, SalonService[]>();
    for (const s of services) { if (!map.has(s.category)) map.set(s.category, []); map.get(s.category)!.push(s); }
    return map;
  }, [services]);

  const selectedObjs = useMemo(() => services.filter(s => selectedServices.includes(s.id)), [services, selectedServices]);
  const totalDuration = selectedObjs.reduce((n, s) => n + s.duration, 0);
  const totalPrice = selectedObjs.reduce((n, s) => n + (s.price || 0), 0);
  const effectiveName = client?.clientName ?? manualName;
  const effectivePhone = client?.clientPhone ?? manualPhone;
  const effectiveEmail = client?.clientEmail ?? manualEmail;

  async function submitBooking() {
    if (!effectiveName || !effectivePhone) return;
    setSubmitting(true);
    try {
      await fetch('/api/bookings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salonId,
          clientName: effectiveName,
          clientPhone: effectivePhone,
          clientEmail: effectiveEmail,
          service: selectedObjs.map(s => s.name).join(', '),
          serviceIds: selectedObjs.map(s => s.id),
          duration: totalDuration,
          operatorId: selectedOperator,
          preferredDate: selectedDate,
          preferredTime: selectedTime,
          notes,
        }),
      });
    } catch { /**/ } finally { setSubmitting(false); setStep('success'); }
  }

  // Auto-load booking history whenever client identity is set
  useEffect(() => {
    if (!client?.clientPhone) return;
    setHistoryLoading(true);
    setProfileForm({ name: client.clientName, email: client.clientEmail });
    fetch(`/api/bookings/client?clientPhone=${encodeURIComponent(client.clientPhone)}&salonId=${encodeURIComponent(salonId)}`)
      .then(r => r.json())
      .then(d => {
        setHistory(d.bookings ?? []);
        if (typeof d.loyaltyPoints === 'number') setLoyaltyPoints(d.loyaltyPoints);
      })
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, [client, salonId]);

  async function cancelBooking(id: string) {
    if (!client?.clientPhone) return;
    setCancellingId(id);
    try {
      await fetch(`/api/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', clientPhone: client.clientPhone }),
      });
      setHistory(prev => prev.map(b => b.id === id ? { ...b, status: 'cancelled' as const } : b));
    } catch { /**/ } finally { setCancellingId(null); }
  }

  // ── Style helpers ──────────────────────────────────────────────────────
  const page: React.CSSProperties = {
    minHeight: '100vh', color: 'white', paddingBottom: 100,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    background: `radial-gradient(ellipse 80% 50% at 50% -10%, rgba(${rgb},0.28) 0%, transparent 65%), #0d0d14`,
  };
  const glass: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 20,
  };
  const btnMain: React.CSSProperties = {
    width: '100%', padding: '16px', borderRadius: 18, border: 'none',
    background: `linear-gradient(135deg, ${accent}, ${lighten(accent, 0.15)})`,
    color: 'white', fontSize: 16, fontWeight: 700, cursor: 'pointer',
    boxShadow: `0 8px 32px rgba(${rgb},0.4)`, letterSpacing: '0.01em',
  };
  const backBtn: React.CSSProperties = {
    background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
    fontSize: 14, padding: '12px 0', width: 'fit-content',
  };
  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 12, padding: '12px 16px', color: 'white', fontSize: 15,
    width: '100%', outline: 'none', boxSizing: 'border-box',
  };
  const inner: React.CSSProperties = { maxWidth: 520, margin: '0 auto', padding: '0 20px' };

  // ── Loading ────────────────────────────────────────────────────────────
  if (loading || !pwaChecked) return (
    <div style={{ ...page, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 56, height: 56, borderRadius: 18, background: `rgba(${rgb},0.2)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Scissors size={28} style={{ color: accent }} />
      </div>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Caricamento…</p>
    </div>
  );

  // ── INSTALL GATE: visibile quando l'app NON è installata ───────────────
  if (!isStandalone) return (
    <div style={page}>
      {/* Hero */}
      <div style={{ position: 'relative', overflow: 'hidden', padding: '72px 20px 48px' }}>
        <div style={{ position: 'absolute', top: -40, left: '50%', transform: 'translateX(-50%)', width: 340, height: 340, borderRadius: '50%', background: `radial-gradient(circle, rgba(${rgb},0.3) 0%, transparent 70%)`, pointerEvents: 'none' }} />
        <div style={{ ...inner, textAlign: 'center', position: 'relative' }}>
          <div style={{ width: 88, height: 88, borderRadius: 28, margin: '0 auto 22px', background: `linear-gradient(135deg, rgba(${rgb},0.6), rgba(${rgb},0.2))`, border: `2px solid rgba(${rgb},0.4)`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 48px rgba(${rgb},0.3)` }}>
            <Scissors size={40} style={{ color: light }} />
          </div>
          {salonName && <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: accent, margin: '0 0 10px' }}>{salonName}</p>}
          <h1 style={{ fontSize: 28, fontWeight: 900, margin: '0 0 10px', lineHeight: 1.2, letterSpacing: '-0.02em' }}>{appConfig.welcomeMessage}</h1>
          {appConfig.aboutText && <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', margin: 0, lineHeight: 1.7, maxWidth: 320, marginInline: 'auto' }}>{appConfig.aboutText}</p>}
        </div>
      </div>

      <div style={{ ...inner, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ ...glass, textAlign: 'center', padding: '24px 20px', borderColor: `rgba(${rgb},0.25)`, background: `rgba(${rgb},0.06)` }}>
          <p style={{ fontSize: 17, fontWeight: 800, margin: '0 0 6px' }}>Installa l&apos;app per prenotare</p>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', margin: 0, lineHeight: 1.6 }}>Aggiungi l&apos;app alla schermata Home per accedere alle prenotazioni</p>
        </div>

        {/* Android / Chrome / Edge — prompt nativo */}
        {deferredPrompt ? (
          <button
            onClick={() => { (deferredPrompt as unknown as { prompt: () => void }).prompt(); setDeferredPrompt(null); }}
            style={btnMain}
          >
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Download size={18} /> Installa l&apos;app
            </span>
          </button>
        ) : (
          /* iOS Safari — istruzioni manuali */
          <div style={{ ...glass, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>Come installare</p>
            {([
              { n: '1', text: <><strong>iPhone/iPad:</strong> tocca <Share size={13} style={{ display: 'inline', verticalAlign: 'middle', color: accent }} /> in basso nel browser</> },
              { n: '2', text: 'Scorri e tocca "Aggiungi a schermata Home"' },
              { n: '3', text: 'Tocca "Aggiungi" in alto a destra' },
            ] as { n: string; text: React.ReactNode }[]).map(s => (
              <div key={s.n} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ width: 28, height: 28, borderRadius: 9, background: `rgba(${rgb},0.2)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13, fontWeight: 700, color: accent }}>{s.n}</div>
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, paddingTop: 5 }}>{s.text}</span>
              </div>
            ))}
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', margin: '2px 0 0', textAlign: 'center' }}>
              Su Android: Chrome → menu ⋮ → &ldquo;Aggiungi a schermata Home&rdquo;
            </p>
          </div>
        )}
      </div>
    </div>
  );

  // ── HOME ───────────────────────────────────────────────────────────────
  if (step === 'home') return (
    <div style={page}>
      {/* Hero */}
      <div style={{ position: 'relative', overflow: 'hidden', padding: '64px 20px 48px' }}>
        <div style={{ position: 'absolute', top: -40, left: '50%', transform: 'translateX(-50%)', width: 320, height: 320, borderRadius: '50%', background: `radial-gradient(circle, rgba(${rgb},0.3) 0%, transparent 70%)`, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -60, right: -40, width: 180, height: 180, borderRadius: '50%', background: `radial-gradient(circle, rgba(${rgb},0.12) 0%, transparent 70%)`, pointerEvents: 'none' }} />

        <div style={{ ...inner, textAlign: 'center', position: 'relative' }}>
          {/* Salon avatar */}
          <div style={{
            width: 80, height: 80, borderRadius: 26, margin: '0 auto 20px',
            background: `linear-gradient(135deg, rgba(${rgb},0.6), rgba(${rgb},0.2))`,
            border: `2px solid rgba(${rgb},0.4)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 0 40px rgba(${rgb},0.25)`,
          }}>
            <Scissors size={36} style={{ color: light }} />
          </div>

          {salonName && (
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: accent, margin: '0 0 10px' }}>
              {salonName}
            </p>
          )}

          <h1 style={{ fontSize: 30, fontWeight: 900, margin: '0 0 12px', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
            {appConfig.welcomeMessage}
          </h1>

          {appConfig.aboutText && (
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)', margin: 0, lineHeight: 1.7, maxWidth: 340, marginInline: 'auto' }}>
              {appConfig.aboutText}
            </p>
          )}

          {client && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 18, padding: '8px 18px', borderRadius: 40, background: `rgba(${rgb},0.15)`, border: `1px solid rgba(${rgb},0.3)` }}>
              <span style={{ fontSize: 13, color: accent, fontWeight: 600 }}>✨ Ciao, {client.clientName}!</span>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ ...inner, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button onClick={() => setStep('services')} style={btnMain}>
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Calendar size={18} /> Prenota un appuntamento
          </span>
        </button>

        {/* Secondary actions for logged-in clients */}
        {client && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button onClick={() => setStep('history')}
              style={{ padding: '14px 12px', borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'white', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <History size={18} style={{ color: accent }} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>Le mie prenotazioni</span>
              {history.filter(b => b.status === 'pending' || b.status === 'confirmed').length > 0 && (
                <span style={{ fontSize: 11, color: accent }}>{history.filter(b => b.status === 'pending' || b.status === 'confirmed').length} attiv{history.filter(b=>b.status==='pending'||b.status==='confirmed').length===1?'a':'e'}</span>
              )}
            </button>
            <button onClick={() => setStep('profile')}
              style={{ padding: '14px 12px', borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'white', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <User size={18} style={{ color: accent }} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>Il mio profilo</span>
              {loyaltyPoints > 0 && <span style={{ fontSize: 11, color: accent }}>⭐ {loyaltyPoints} punti</span>}
            </button>
          </div>
        )}

        {/* Info cards */}
        {(appConfig.contactAddress || appConfig.cancellationPolicy) && (
          <div style={{ display: 'grid', gridTemplateColumns: appConfig.contactAddress && appConfig.cancellationPolicy ? '1fr 1fr' : '1fr', gap: 10, marginTop: 4 }}>
            {appConfig.contactAddress && (
              <div style={{ ...glass, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <MapPin size={14} style={{ color: accent }} />
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: 0, lineHeight: 1.4 }}>{appConfig.contactAddress}</p>
              </div>
            )}
            {appConfig.cancellationPolicy && (
              <div style={{ ...glass, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>Disdetta</span>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: 0, lineHeight: 1.4 }}>{appConfig.cancellationPolicy}</p>
              </div>
            )}
          </div>
        )}
      </div>


    </div>
  );

  // ── SERVICES ───────────────────────────────────────────────────────────
  if (step === 'services') return (
    <div style={page}>
      <div style={{ ...inner }}>
        <ProgressBar step={step} accent={accent} />
        <button style={backBtn} onClick={() => setStep('home')}><ArrowLeft size={15} /> Indietro</button>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px' }}>Scegli i servizi</h2>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: '0 0 24px' }}>Puoi selezionare anche più servizi</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: selectedServices.length > 0 ? 120 : 0 }}>
          {categories.size === 0 && <p style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '60px 0' }}>Nessun servizio configurato</p>}
          {[...categories.entries()].map(([cat, items]) => (
            <div key={cat}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{ height: 1, flex: 1, background: 'rgba(255,255,255,0.06)' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{cat}</span>
                <div style={{ height: 1, flex: 1, background: 'rgba(255,255,255,0.06)' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {items.map(s => {
                  const sel = selectedServices.includes(s.id);
                  return (
                    <button key={s.id}
                      onClick={() => setSelectedServices(p => sel ? p.filter(x => x !== s.id) : [...p, s.id])}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        cursor: 'pointer', textAlign: 'left', width: '100%',
                        borderRadius: 16, padding: '14px 16px',
                        backdropFilter: 'blur(12px)', transition: 'all 0.15s',
                        border: `1px solid ${sel ? `rgba(${rgb},0.5)` : 'rgba(255,255,255,0.07)'}`,
                        background: sel ? `rgba(${rgb},0.12)` : 'rgba(255,255,255,0.03)',
                        boxShadow: sel ? `inset 3px 0 0 ${accent}` : 'none',
                      }}
                    >
                      <div>
                        <p style={{ margin: 0, fontSize: 15, fontWeight: sel ? 600 : 400, color: sel ? 'white' : 'rgba(255,255,255,0.85)' }}>{s.name}</p>
                        <div style={{ display: 'flex', gap: 10, marginTop: 5 }}>
                          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Clock size={10} /> {s.duration} min
                          </span>
                          {appConfig.showPrices && s.price > 0 && (
                            <span style={{ fontSize: 12, color: sel ? accent : 'rgba(255,255,255,0.38)', fontWeight: sel ? 600 : 400 }}>€{s.price}</span>
                          )}
                        </div>
                      </div>
                      <div style={{
                        width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                        background: sel ? accent : 'rgba(255,255,255,0.08)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: `2px solid ${sel ? accent : 'rgba(255,255,255,0.15)'}`,
                        transition: 'all 0.15s',
                      }}>
                        {sel && <CheckCircle2 size={14} style={{ color: 'white' }} />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedServices.length > 0 && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '0 0 env(safe-area-inset-bottom)', background: 'rgba(13,13,20,0.96)', backdropFilter: 'blur(20px)', borderTop: `1px solid rgba(${rgb},0.2)` }}>
          <div style={{ ...inner, padding: '14px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedObjs.map(s => s.name).join(' + ')}</span>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{totalDuration} min</span>
                {appConfig.showPrices && totalPrice > 0 && <span style={{ fontSize: 14, color: accent, fontWeight: 700 }}>€{totalPrice}</span>}
              </div>
            </div>
            <button onClick={() => setStep(operators.length > 1 ? 'operator' : 'datetime')} style={btnMain}>
              Continua →
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // ── OPERATOR ───────────────────────────────────────────────────────────
  if (step === 'operator') return (
    <div style={page}>
      <div style={{ ...inner }}>
        <ProgressBar step={step} accent={accent} />
        <button style={backBtn} onClick={() => setStep('services')}><ArrowLeft size={15} /> Indietro</button>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px' }}>Con chi preferisci?</h2>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: '0 0 24px' }}>Scegli la tua operatrice</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Qualsiasi */}
          <button onClick={() => { setSelectedOperator(''); setStep('datetime'); }}
            style={{ display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', textAlign: 'left', width: '100%', backdropFilter: 'blur(12px)', borderRadius: 20, padding: '16px 18px', transition: 'all 0.15s', border: `1px solid ${selectedOperator === '' ? `rgba(${rgb},0.5)` : 'rgba(255,255,255,0.07)'}`, background: selectedOperator === '' ? `rgba(${rgb},0.12)` : 'rgba(255,255,255,0.03)' }}>
            <div style={{ width: 48, height: 48, borderRadius: 16, flexShrink: 0, background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🎲</div>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 17, fontWeight: 600 }}>Nessuna preferenza</span>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Prima disponibile</p>
            </div>
            {selectedOperator === '' && <ChevronRight size={20} style={{ color: accent }} />}
          </button>
          {operators.map(op => {
            const sel = selectedOperator === op.id;
            return (
              <button key={op.id} onClick={() => { setSelectedOperator(op.id); setStep('datetime'); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  cursor: 'pointer', textAlign: 'left', width: '100%',
                  backdropFilter: 'blur(12px)', borderRadius: 20, padding: '16px 18px',
                  transition: 'all 0.15s',
                  border: `1px solid ${sel ? `rgba(${rgb},0.5)` : 'rgba(255,255,255,0.07)'}`,
                  background: sel ? `rgba(${rgb},0.12)` : 'rgba(255,255,255,0.03)',
                }}
              >
                <div style={{
                  width: 48, height: 48, borderRadius: 16, flexShrink: 0,
                  background: op.color || accent,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, fontWeight: 800, color: 'white',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                }}>
                  {op.name.charAt(0).toUpperCase()}
                </div>
                <span style={{ fontSize: 17, fontWeight: 600, flex: 1 }}>{op.name}</span>
                {sel && <CheckCircle2 size={22} style={{ color: accent }} />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  // ── DATE & TIME ────────────────────────────────────────────────────────
  if (step === 'datetime') return (
    <div style={page}>
      <div style={{ ...inner }}>
        <ProgressBar step={step} accent={accent} />
        <button style={backBtn} onClick={() => setStep(operators.length > 1 ? 'operator' : 'services')}><ArrowLeft size={15} /> Indietro</button>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px' }}>Quando vieni?</h2>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: '0 0 24px' }}>Scegli data e ora</p>

        <div style={{ ...glass, marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: accent, letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 10 }}>Data</label>
          <input type="date" min={minDate} max={maxDate} value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            style={inputStyle} />
        </div>

        {selectedDate && (
          <div style={{ ...glass }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: accent, letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 14 }}>Orario</label>
            {loadingSlots ? (
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Caricamento orari…</p>
            ) : availableSlots.length === 0 ? (
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>Nessun orario disponibile — prova un&apos;altra data.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {availableSlots.map(slot => {
                  const sel = selectedTime === slot;
                  return (
                    <button key={slot} onClick={() => setSelectedTime(slot)} style={{
                      padding: '11px 4px', borderRadius: 12, fontSize: 14, fontWeight: sel ? 700 : 400,
                      cursor: 'pointer', border: `1px solid ${sel ? accent : 'rgba(255,255,255,0.1)'}`,
                      background: sel ? accent : 'rgba(255,255,255,0.04)',
                      color: sel ? 'white' : 'rgba(255,255,255,0.65)',
                      boxShadow: sel ? `0 4px 16px rgba(${rgb},0.4)` : 'none',
                      transition: 'all 0.15s',
                    }}>
                      {slot}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {selectedDate && selectedTime && (
          <button onClick={() => setStep('confirm')} style={{ ...btnMain, marginTop: 20 }}>
            Continua →
          </button>
        )}
      </div>
    </div>
  );

  // ── CONFIRM ────────────────────────────────────────────────────────────
  if (step === 'confirm') return (
    <div style={page}>
      <div style={{ ...inner }}>
        <ProgressBar step={step} accent={accent} />
        <button style={backBtn} onClick={() => setStep('datetime')}><ArrowLeft size={15} /> Indietro</button>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px' }}>Conferma</h2>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: '0 0 24px' }}>Controlla tutto prima di confermare</p>

        {/* Gradient summary card */}
        <div style={{
          borderRadius: 20, padding: 20, marginBottom: 16,
          background: `linear-gradient(135deg, rgba(${rgb},0.22) 0%, rgba(${rgb},0.06) 100%)`,
          border: `1px solid rgba(${rgb},0.3)`,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { icon: <Scissors size={15} />, text: selectedObjs.map(s => s.name).join(', ') },
              { icon: <User size={15} />, text: operators.find(o => o.id === selectedOperator)?.name ?? 'Qualsiasi' },
              { icon: <Calendar size={15} />, text: new Date(selectedDate + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }) + ' alle ' + selectedTime },
              { icon: <Clock size={15} />, text: `${totalDuration} min${appConfig.showPrices && totalPrice > 0 ? ` · €${totalPrice}` : ''}` },
            ].map((row, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: `rgba(${rgb},0.2)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ color: accent }}>{row.icon}</span>
                </div>
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 1.4 }}>{row.text}</span>
              </div>
            ))}
          </div>
        </div>

        {!client ? (
          <div style={{ ...glass, marginBottom: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', margin: '0 0 16px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>I tuoi dati</p>
            {[
              { label: 'Nome *', value: manualName, type: 'text', set: setManualName },
              { label: 'Telefono *', value: manualPhone, type: 'tel', set: setManualPhone },
              { label: 'Email', value: manualEmail, type: 'email', set: setManualEmail },
            ].map(f => (
              <div key={f.label} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', display: 'block', marginBottom: 6 }}>{f.label}</label>
                <input type={f.type} value={f.value} onChange={e => f.set(e.target.value)} style={inputStyle} />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ ...glass, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: `rgba(${rgb},0.25)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: accent, flexShrink: 0 }}>
              {client.clientName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{client.clientName}</p>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: 0 }}>{client.clientPhone}</p>
            </div>
          </div>
        )}

        {/* Notes */}
        <div style={{ ...glass, marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', display: 'block', marginBottom: 8 }}>Note aggiuntive (opzionale)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Es. allergie, preferenze colore, capelli bagnati…"
            rows={3}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
          />
        </div>

        <button onClick={submitBooking}
          disabled={submitting || !effectiveName || !effectivePhone}
          style={{ ...btnMain, opacity: submitting || !effectiveName || !effectivePhone ? 0.4 : 1 }}>
          {submitting ? 'Invio…' : '✅  Conferma prenotazione'}
        </button>
      </div>
    </div>
  );

  // ── SUCCESS ────────────────────────────────────────────────────────────
  if (step === 'success') return (
    <div style={{ ...page, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ ...inner, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, textAlign: 'center' }}>
        <div style={{ position: 'relative', width: 100, height: 100, marginBottom: 8 }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: `radial-gradient(circle, rgba(${rgb},0.4) 0%, transparent 70%)` }} />
          <div style={{ width: 100, height: 100, borderRadius: '50%', background: `rgba(${rgb},0.15)`, border: `2px solid rgba(${rgb},0.4)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={42} style={{ color: accent }} />
          </div>
        </div>

        <div>
          <h2 style={{ fontSize: 28, fontWeight: 900, margin: '0 0 8px', letterSpacing: '-0.02em' }}>Richiesta inviata!</h2>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)', margin: 0, lineHeight: 1.7, maxWidth: 300, marginInline: 'auto' }}>
            {appConfig.bookingConfirmationMessage}
          </p>
        </div>

        <div style={{ ...glass, width: '100%', textAlign: 'left', borderColor: `rgba(${rgb},0.2)`, background: `rgba(${rgb},0.06)` }}>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 10px' }}>Riepilogo</p>
          <p style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px' }}>{selectedObjs.map(s => s.name).join(', ')}</p>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', margin: 0 }}>
            {new Date(selectedDate + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })} · {selectedTime}
          </p>
        </div>

        <button onClick={() => { setStep('home'); setSelectedServices([]); setSelectedDate(''); setSelectedTime(''); setNotes(''); }}
          style={{ width: '100%', padding: '14px', borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.65)', fontSize: 15, cursor: 'pointer' }}>
          Torna all&apos;inizio
        </button>

        {/* ICS calendar download */}
        <button
          onClick={() => downloadICS(generateICS(selectedObjs.map(s=>s.name).join(', '), selectedDate, selectedTime, salonName, totalDuration), `prenotazione-${selectedDate}.ics`)}
          style={{ width: '100%', padding: '14px', borderRadius: 16, border: `1px solid rgba(${rgb},0.3)`, background: `rgba(${rgb},0.06)`, color: accent, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Calendar size={15} /> Aggiungi al calendario (.ics)
        </button>

        {/* History shortcut */}
        {client && (
          <button onClick={() => { setStep('history'); }}
            style={{ width: '100%', padding: '14px', borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: 'rgba(255,255,255,0.45)', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <History size={14} /> Vedi tutte le mie prenotazioni
          </button>
        )}
      </div>
    </div>
  );

  // ── HISTORY ───────────────────────────────────────────────────────────────
  if (step === 'history') {
    const STATUS_LABEL: Record<string, string> = { pending: '⏳ In attesa', confirmed: '✅ Confermata', cancelled: '❌ Cancellata' };
    const STATUS_COLOR: Record<string, string> = { pending: '#fbbf24', confirmed: '#4ade80', cancelled: '#f87171' };
    const today = new Date().toISOString().split('T')[0];
    return (
      <div style={page}>
        <div style={{ ...inner, paddingBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 24, marginBottom: 8 }}>
            <button style={backBtn} onClick={() => setStep('home')}><ArrowLeft size={15} /> Indietro</button>
            <button onClick={() => {
              if (!client?.clientPhone) return;
              setHistoryLoading(true);
              fetch(`/api/bookings/client?clientPhone=${encodeURIComponent(client.clientPhone)}&salonId=${encodeURIComponent(salonId)}`)
                .then(r => r.json()).then(d => { setHistory(d.bookings??[]); if(typeof d.loyaltyPoints==='number') setLoyaltyPoints(d.loyaltyPoints); })
                .finally(() => setHistoryLoading(false));
            }} style={{ background:'none', border:'none', color: accent, cursor:'pointer', display:'flex', alignItems:'center', gap:4, fontSize:13 }}>
              <RefreshCw size={13} /> Aggiorna
            </button>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px' }}>Le mie prenotazioni</h2>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: '0 0 20px' }}>Storico e prenotazioni attive</p>

          {loyaltyPoints > 0 && (
            <div style={{ ...glass, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14, borderColor: `rgba(${rgb},0.25)`, background: `rgba(${rgb},0.07)` }}>
              <Star size={22} style={{ color: accent, flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{loyaltyPoints} punti fedeltà</p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: 0 }}>Accumulati con le tue visite</p>
              </div>
            </div>
          )}

          {historyLoading ? (
            <p style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '40px 0', fontSize: 14 }}>Caricamento…</p>
          ) : history.length === 0 ? (
            <div style={{ ...glass, textAlign: 'center', padding: '40px 20px' }}>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 15, margin: '0 0 16px' }}>Nessuna prenotazione trovata</p>
              <button onClick={() => setStep('services')} style={{ ...btnMain, fontSize: 14, padding: '12px 24px', width: 'auto' }}>Prenota ora</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {history.map(b => {
                const isFuture = b.preferred_date >= today;
                const canCancel = (b.status === 'pending' || b.status === 'confirmed') && isFuture;
                return (
                  <div key={b.id} style={{ ...glass, borderColor: b.status === 'cancelled' ? 'rgba(255,255,255,0.05)' : `rgba(${rgb},0.15)`, opacity: b.status === 'cancelled' ? 0.55 : 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <p style={{ fontSize: 15, fontWeight: 700, margin: 0, maxWidth: '65%', lineHeight: 1.3 }}>{b.service}</p>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: `${STATUS_COLOR[b.status]}22`, color: STATUS_COLOR[b.status], border: `1px solid ${STATUS_COLOR[b.status]}44`, whiteSpace: 'nowrap' }}>
                        {STATUS_LABEL[b.status] ?? b.status}
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 6 } as React.CSSProperties}>
                      <Calendar size={12} /> {new Date(b.preferred_date + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </p>
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: 0, display: 'flex', alignItems: 'center', gap: 6 } as React.CSSProperties}>
                      <Clock size={12} /> {b.preferred_time}
                    </p>
                    {canCancel && (
                      <button
                        onClick={() => cancelBooking(b.id)}
                        disabled={cancellingId === b.id}
                        style={{ marginTop: 12, width: '100%', padding: '10px', borderRadius: 12, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.07)', color: '#f87171', fontSize: 13, cursor: 'pointer', opacity: cancellingId === b.id ? 0.5 : 1 }}>
                        {cancellingId === b.id ? 'Cancellazione…' : '✕ Disdici prenotazione'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <button onClick={() => setStep('services')} style={{ ...btnMain, marginTop: 20 }}>
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Calendar size={16} /> Nuova prenotazione
            </span>
          </button>
        </div>
      </div>
    );
  }

  // ── PROFILE ───────────────────────────────────────────────────────────────
  if (step === 'profile') {
    function saveProfile() {
      if (!client) return;
      const updated: StoredClient = { ...client, clientName: profileForm.name || client.clientName, clientEmail: profileForm.email };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setClient(updated);
      setStep('home');
    }
    function logout() {
      localStorage.removeItem(STORAGE_KEY);
      setClient(null);
      setHistory([]);
      setLoyaltyPoints(0);
      setStep('home');
    }
    return (
      <div style={page}>
        <div style={{ ...inner, paddingBottom: 40 }}>
          <button style={{ ...backBtn, paddingTop: 24 }} onClick={() => setStep('home')}><ArrowLeft size={15} /> Indietro</button>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px' }}>Il mio profilo</h2>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: '0 0 24px' }}>Modifica i tuoi dati</p>

          {loyaltyPoints > 0 && (
            <div style={{ ...glass, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14, borderColor: `rgba(${rgb},0.25)`, background: `rgba(${rgb},0.07)` }}>
              <Star size={22} style={{ color: accent, flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{loyaltyPoints} punti fedeltà</p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: 0 }}>Accumulati con le tue visite</p>
              </div>
            </div>
          )}

          <div style={{ ...glass, marginBottom: 14 }}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', display: 'block', marginBottom: 6 }}>Nome</label>
              <input value={profileForm.name} onChange={e => setProfileForm(p => ({ ...p, name: e.target.value }))} style={inputStyle} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', display: 'block', marginBottom: 6 }}>Telefono (non modificabile)</label>
              <input value={client?.clientPhone ?? ''} disabled style={{ ...inputStyle, opacity: 0.45, cursor: 'not-allowed' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', display: 'block', marginBottom: 6 }}>Email</label>
              <input type="email" value={profileForm.email} onChange={e => setProfileForm(p => ({ ...p, email: e.target.value }))} style={inputStyle} />
            </div>
          </div>

          <button onClick={saveProfile} style={{ ...btnMain, marginBottom: 10 }}>
            Salva modifiche
          </button>

          <button onClick={logout} style={{ width: '100%', padding: '14px', borderRadius: 16, border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.06)', color: '#f87171', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <X size={14} /> Esci dall&apos;account
          </button>
        </div>
      </div>
    );
  }

  return null;
}
