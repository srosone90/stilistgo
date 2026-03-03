'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSalon } from '@/context/SalonContext';
import { DEFAULT_WHATSAPP_CONFIG } from '@/types/salon';
import type { WhatsAppConfig } from '@/types/salon';
import { getCurrentUser } from '@/lib/supabase';
import {
  MessageSquare, Wifi, WifiOff, RefreshCw,
  CheckCircle2, XCircle, Bell, Cake, ThumbsUp, Star, CalendarCheck, Pencil, ChevronUp, Smartphone,
} from 'lucide-react';

// ── Style helpers ──────────────────────────────────────────────────────────
const card = (extra?: React.CSSProperties): React.CSSProperties => ({
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  padding: '20px',
  ...extra,
});

// ── Toggle row ─────────────────────────────────────────────────────────────
function Toggle({
  checked, onChange, label, description, disabled = false, icon,
}: {
  checked: boolean; onChange: (v: boolean) => void;
  label: string; description?: string; disabled?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '13px 0', opacity: disabled ? 0.4 : 1,
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {icon && (
          <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {icon}
          </div>
        )}
        <div>
          <p style={{ color: 'var(--text)', fontSize: 14, fontWeight: 500, margin: 0 }}>{label}</p>
          {description && <p style={{ color: 'var(--muted)', fontSize: 12, margin: '2px 0 0' }}>{description}</p>}
        </div>
      </div>
      <button
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        style={{
          position: 'relative', flexShrink: 0, width: 44, height: 24,
          borderRadius: 12, border: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          background: checked ? '#22c55e' : 'var(--border-light)',
          transition: 'background 0.2s',
        }}
      >
        <span style={{
          position: 'absolute', top: 3, left: checked ? 23 : 3,
          width: 18, height: 18, borderRadius: '50%', background: 'white',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'left 0.2s',
        }} />
      </button>
    </div>
  );
}
// ── AutomationRow — toggle + editable message template ─────────────────────
function AutomationRow({
  checked, onChange, label, description, disabled = false, icon,
  templateValue, onTemplateChange, vars, last = false,
}: {
  checked: boolean; onChange: (v: boolean) => void;
  label: string; description?: string; disabled?: boolean;
  icon?: React.ReactNode;
  templateValue: string;
  onTemplateChange: (v: string) => void;
  vars: string[];
  last?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: last ? 'none' : '1px solid var(--border)' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 0', opacity: disabled ? 0.4 : 1,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {icon && (
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {icon}
            </div>
          )}
          <div>
            <p style={{ color: 'var(--text)', fontSize: 14, fontWeight: 500, margin: 0 }}>{label}</p>
            {description && <p style={{ color: 'var(--muted)', fontSize: 12, margin: '2px 0 0' }}>{description}</p>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button
            onClick={() => setOpen(o => !o)}
            title="Modifica testo messaggio"
            style={{ background: open ? 'rgba(99,102,241,0.12)' : 'none', border: '1px solid var(--border)', borderRadius: 7, padding: '4px 8px', cursor: 'pointer', color: open ? '#818cf8' : 'var(--muted)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, transition: 'all 0.15s' }}
          >
            {open ? <ChevronUp size={11} /> : <Pencil size={11} />} Testo
          </button>
          <button
            onClick={() => !disabled && onChange(!checked)}
            disabled={disabled}
            style={{
              position: 'relative', flexShrink: 0, width: 44, height: 24,
              borderRadius: 12, border: 'none',
              cursor: disabled ? 'not-allowed' : 'pointer',
              background: checked ? '#22c55e' : 'var(--border-light)',
              transition: 'background 0.2s',
            }}
          >
            <span style={{
              position: 'absolute', top: 3, left: checked ? 23 : 3,
              width: 18, height: 18, borderRadius: '50%', background: 'white',
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'left 0.2s',
            }} />
          </button>
        </div>
      </div>
      {open && (
        <div style={{ paddingBottom: 14, paddingLeft: 44 }}>
          <textarea
            value={templateValue}
            onChange={e => onTemplateChange(e.target.value)}
            rows={3}
            style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', color: 'var(--text)', fontSize: 13, resize: 'vertical', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5, boxSizing: 'border-box' }}
          />
          <p style={{ color: 'var(--muted)', fontSize: 11, margin: '6px 0 5px' }}>Variabili disponibili — clicca per inserire:</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {vars.map(v => (
              <button
                key={v}
                onClick={() => onTemplateChange(templateValue + `{${v}}`)}
                style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 6, padding: '3px 9px', color: '#818cf8', fontSize: 11, cursor: 'pointer' }}
              >
                {`{${v}}`}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
// ── Main ───────────────────────────────────────────────────────────────────
type ConnStatus = 'loading' | 'connected' | 'disconnected' | 'not-configured';

export default function AutomationsView() {
  const { salonConfig, updateSalonConfig, whatsappMessages } = useSalon();

  const [cfg, setCfg] = useState<WhatsAppConfig>(
    () => ({ ...DEFAULT_WHATSAPP_CONFIG, ...salonConfig.whatsapp })
  );
  const [connStatus, setConnStatus] = useState<ConnStatus>('loading');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [saved, setSaved] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [testPhone, setTestPhone] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Fetch credentials directly from DB on mount — never depends on SalonContext timing
  useEffect(() => {
    (async () => {
      try {
        const user = await getCurrentUser();
        if (!user) { setConnStatus('not-configured'); setDebugInfo('no user session'); return; }

        const r = await fetch(`/api/admin/whatsapp?user_id=${user.id}`);
        if (!r.ok) { setConnStatus('not-configured'); setDebugInfo(`api error ${r.status}`); return; }

        const d = await r.json();
        const instanceId: string = d.ultraMsgInstanceId ?? '';
        const token: string = d.ultraMsgToken ?? '';
        setDebugInfo(`db:${d.debug ?? '?'} id:${instanceId ? instanceId.slice(0,12)+'…' : 'empty'}`);

        if (!instanceId || !token) { setConnStatus('not-configured'); return; }

        setCfg(prev => ({ ...prev, ultraMsgInstanceId: instanceId, ultraMsgToken: token }));

        // Check connection status and grab QR if not connected
        const sr = await fetch(`/api/ultramsg/status?instanceId=${instanceId}&token=${token}`);
        const sd = await sr.json();
        setConnStatus(sd.connected ? 'connected' : 'disconnected');
        setQrCode(sd.qrCode ?? null);
      } catch (e) {
        setConnStatus('not-configured');
        setDebugInfo(String(e));
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = useCallback(async () => {
    if (!cfg.ultraMsgInstanceId || !cfg.ultraMsgToken) return;
    setChecking(true);
    try {
      const res = await fetch(`/api/ultramsg/status?instanceId=${cfg.ultraMsgInstanceId}&token=${cfg.ultraMsgToken}`);
      const d = await res.json();
      setConnStatus(d.connected ? 'connected' : 'disconnected');
      setQrCode(d.qrCode ?? null);
    } catch {
      setConnStatus('disconnected');
    } finally {
      setChecking(false);
    }
  }, [cfg.ultraMsgInstanceId, cfg.ultraMsgToken]);

  function patch(updates: Partial<Omit<WhatsAppConfig, 'ultraMsgInstanceId' | 'ultraMsgToken'>>) {
    const next = { ...cfg, ...updates };
    setCfg(next);
    updateSalonConfig({ whatsapp: next });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const recent = [...(whatsappMessages ?? [])].reverse().slice(0, 50);
  const spinStyle: React.CSSProperties = { animation: 'spin 1s linear infinite' };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 0 60px', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 13, background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MessageSquare size={22} style={{ color: '#22c55e' }} />
          </div>
          <div>
            <h1 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 20, margin: 0 }}>Automazioni WhatsApp</h1>
            <p style={{ color: 'var(--muted)', fontSize: 13, margin: '2px 0 0' }}>Messaggi automatici ai tuoi clienti</p>
          </div>
        </div>
        {saved && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#22c55e', fontSize: 13 }}>
            <CheckCircle2 size={14} /> Salvato
          </span>
        )}
      </div>

      {/* ── Debug pill (rimuovere dopo fix) ── */}
      {debugInfo && (
        <div style={{ fontSize: 11, color: 'var(--muted)', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 10px', alignSelf: 'flex-start', fontFamily: 'monospace' }}>
          debug: {debugInfo}
        </div>
      )}

      {/* ── Stato connessione ── */}
      {connStatus === 'loading' && (
        <div style={card({ display: 'flex', alignItems: 'center', gap: 12 })}>
          <RefreshCw size={18} style={{ color: 'var(--muted)', ...spinStyle }} />
          <span style={{ color: 'var(--muted)', fontSize: 14 }}>Verifica connessione WhatsApp…</span>
        </div>
      )}

      {connStatus === 'not-configured' && (
        <div style={{ ...card(), background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <WifiOff size={18} style={{ color: '#f59e0b' }} />
            <p style={{ color: '#fbbf24', fontWeight: 600, fontSize: 14, margin: 0 }}>WhatsApp non ancora attivato</p>
          </div>
          <p style={{ color: 'var(--text-3)', fontSize: 13, lineHeight: 1.6, margin: '0 0 14px' }}>
            Il numero WhatsApp per questo salone non è ancora configurato.
            Puoi già impostare i messaggi che vuoi — partiranno appena attivato.
          </p>
          <a href="mailto:support@stylistgo.it?subject=Attivazione WhatsApp"
            style={{ display: 'inline-block', padding: '8px 18px', borderRadius: 10, background: '#f59e0b', color: 'white', fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>
            Richiedi attivazione
          </a>
        </div>
      )}

      {connStatus === 'connected' && (
        <div style={{ ...card(), background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.25)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Wifi size={18} style={{ color: '#22c55e' }} />
              <div>
                <p style={{ color: '#22c55e', fontWeight: 600, fontSize: 14, margin: 0 }}>WhatsApp connesso ✓</p>
                <p style={{ color: 'var(--muted)', fontSize: 12, margin: '2px 0 0' }}>Istanza: {cfg.ultraMsgInstanceId}</p>
              </div>
            </div>
            <button onClick={refresh} disabled={checking}
              style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 12px', color: 'var(--text-3)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <RefreshCw size={12} style={checking ? spinStyle : {}} /> Aggiorna
            </button>
          </div>

          {/* Messaggio di prova */}
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(34,197,94,0.2)' }}>
            <p style={{ color: 'var(--text)', fontSize: 13, fontWeight: 600, margin: '0 0 10px' }}>📨 Invia messaggio di prova</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="tel"
                placeholder="es. 393331234567 (senza +)"
                value={testPhone}
                onChange={e => { setTestPhone(e.target.value); setTestResult(null); }}
                style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', color: 'var(--text)', fontSize: 13, outline: 'none' }}
              />
              <button
                disabled={testSending || !testPhone.trim()}
                onClick={async () => {
                  setTestSending(true);
                  setTestResult(null);
                  try {
                    const res = await fetch('/api/ultramsg/send', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        instanceId: cfg.ultraMsgInstanceId,
                        token: cfg.ultraMsgToken,
                        to: testPhone.trim(),
                        message: '✅ Messaggio di prova da ' + (salonConfig?.salonName ?? 'il tuo salone') + ' — WhatsApp funziona correttamente!',
                      }),
                    });
                    const d = await res.json();
                    setTestResult(res.ok && !d.error ? { ok: true, msg: 'Inviato!' } : { ok: false, msg: d.error ?? 'Errore invio' });
                  } catch (e) {
                    setTestResult({ ok: false, msg: String(e) });
                  } finally {
                    setTestSending(false);
                  }
                }}
                style={{ background: '#22c55e', color: 'white', border: 'none', borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: testSending || !testPhone.trim() ? 'not-allowed' : 'pointer', opacity: testSending || !testPhone.trim() ? 0.6 : 1, whiteSpace: 'nowrap' }}
              >
                {testSending ? 'Invio…' : 'Invia'}
              </button>
            </div>
            {testResult && (
              <p style={{ marginTop: 8, fontSize: 12, color: testResult.ok ? '#22c55e' : '#f87171' }}>
                {testResult.ok ? '✓' : '✗'} {testResult.msg}
              </p>
            )}
          </div>
        </div>
      )}

      {connStatus === 'disconnected' && (
        <div style={{ ...card(), border: '1px solid rgba(251,191,36,0.3)', background: 'rgba(251,191,36,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <WifiOff size={18} style={{ color: '#fbbf24', flexShrink: 0 }} />
              <div>
                <p style={{ color: '#fbbf24', fontWeight: 600, fontSize: 14, margin: 0 }}>Collega WhatsApp al tuo numero</p>
                <p style={{ color: 'var(--text-3)', fontSize: 12, margin: '3px 0 0', lineHeight: 1.5 }}>
                  Apri WhatsApp → Impostazioni → Dispositivi collegati → Collega dispositivo
                </p>
              </div>
            </div>
            <button onClick={refresh} disabled={checking}
              style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 12px', color: 'var(--text-3)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
              <RefreshCw size={12} style={checking ? spinStyle : {}} /> Aggiorna QR
            </button>
          </div>

          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            {qrCode ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrCode} alt="QR code WhatsApp"
                  style={{ width: 200, height: 200, background: 'white', borderRadius: 12, padding: 8, border: '4px solid white' }} />
                <p style={{ color: 'var(--muted)', fontSize: 12, textAlign: 'center', margin: 0 }}>
                  Il QR scade ogni 45 secondi — clicca &quot;Aggiorna QR&quot; per rigenerarlo
                </p>
              </>
            ) : (
              <button onClick={refresh} disabled={checking}
                style={{ padding: '10px 28px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#6366f1,#818cf8)', color: 'white', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                {checking ? 'Caricamento…' : 'Carica QR code'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Master toggle ── */}
      <div style={card({ display: 'flex', alignItems: 'center', justifyContent: 'space-between' })}>
        <div>
          <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: 15, margin: 0 }}>Automazioni attive</p>
          <p style={{ color: 'var(--muted)', fontSize: 12, margin: '3px 0 0' }}>
            {cfg.enabled ? 'Messaggi inviati ogni mattina alle 9:00' : 'Attiva per iniziare a inviare messaggi'}
          </p>
        </div>
        <button
          onClick={() => patch({ enabled: !cfg.enabled })}
          style={{
            position: 'relative', flexShrink: 0, width: 52, height: 28, borderRadius: 14,
            border: 'none', cursor: 'pointer',
            background: cfg.enabled ? '#22c55e' : 'var(--border-light)',
            transition: 'background 0.2s',
          }}
        >
          <span style={{
            position: 'absolute', top: 4, left: cfg.enabled ? 28 : 4,
            width: 20, height: 20, borderRadius: '50%', background: 'white',
            boxShadow: '0 1px 4px rgba(0,0,0,0.3)', transition: 'left 0.2s',
          }} />
        </button>
      </div>

      {/* ── Messaggi automatici ── */}
      <div style={card({ padding: '4px 20px 4px' })}>
        <p style={{ color: 'var(--text-3)', fontWeight: 600, fontSize: 11, margin: '12px 0 4px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Messaggi automatici
        </p>
        <AutomationRow
          checked={cfg.reminderEnabled} onChange={v => patch({ reminderEnabled: v })}
          label="Promemoria appuntamento" description="Il giorno prima alle 9:00"
          disabled={!cfg.enabled} icon={<Bell size={15} style={{ color: '#818cf8' }} />}
          templateValue={cfg.reminderMsg ?? ''}
          onTemplateChange={v => patch({ reminderMsg: v })}
          vars={['nome', 'servizio', 'ora', 'salone']}
        />
        <AutomationRow
          checked={cfg.birthdayEnabled} onChange={v => patch({ birthdayEnabled: v })}
          label="Auguri di compleanno" description="La mattina del compleanno"
          disabled={!cfg.enabled} icon={<Cake size={15} style={{ color: '#f472b6' }} />}
          templateValue={cfg.birthdayMsg ?? ''}
          onTemplateChange={v => patch({ birthdayMsg: v })}
          vars={['nome', 'salone']}
        />
        <AutomationRow
          checked={cfg.postVisitEnabled} onChange={v => patch({ postVisitEnabled: v })}
          label="Follow-up post-visita" description="Il giorno dopo l'appuntamento"
          disabled={!cfg.enabled} icon={<ThumbsUp size={15} style={{ color: '#34d399' }} />}
          templateValue={cfg.postVisitMsg ?? ''}
          onTemplateChange={v => patch({ postVisitMsg: v })}
          vars={['nome', 'salone']}
        />
        <AutomationRow
          checked={cfg.bookingConfirmEnabled} onChange={v => patch({ bookingConfirmEnabled: v })}
          label="Conferma prenotazione online" description="Subito dopo la prenotazione dal sito"
          disabled={!cfg.enabled} icon={<CalendarCheck size={15} style={{ color: '#60a5fa' }} />}
          templateValue={cfg.bookingConfirmMsg ?? ''}
          onTemplateChange={v => patch({ bookingConfirmMsg: v })}
          vars={['nome', 'data', 'ora', 'salone']}
        />
        <AutomationRow
          checked={cfg.appointmentConfirmEnabled} onChange={v => patch({ appointmentConfirmEnabled: v })}
          label="Conferma appuntamento in agenda" description="Subito quando aggiungi l'appuntamento"
          disabled={!cfg.enabled} icon={<CalendarCheck size={15} style={{ color: '#a78bfa' }} />}
          templateValue={cfg.appointmentConfirmMsg ?? ''}
          onTemplateChange={v => patch({ appointmentConfirmMsg: v })}
          vars={['nome', 'servizio', 'data', 'ora', 'salone']}
        />
        <AutomationRow
          checked={cfg.loyaltyEnabled} onChange={v => patch({ loyaltyEnabled: v })}
          label="Traguardo fedeltà" description="Quando il cliente raggiunge la soglia punti"
          disabled={!cfg.enabled} icon={<Star size={15} style={{ color: '#fbbf24' }} />}
          templateValue={cfg.loyaltyMsg ?? ''}
          onTemplateChange={v => patch({ loyaltyMsg: v })}
          vars={['nome', 'punti', 'salone']}
        />
        {cfg.loyaltyEnabled && cfg.enabled && (
          <div style={{ paddingLeft: 44, paddingBottom: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--muted)', fontSize: 13 }}>
              Soglia punti
              <input
                type="number"
                value={cfg.loyaltyMilestone}
                onChange={e => patch({ loyaltyMilestone: parseInt(e.target.value) || 100 })}
                style={{ width: 80, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 10px', color: 'var(--text)', fontSize: 13, outline: 'none' }}
              />
            </label>
          </div>
        )}
        <p style={{ color: 'var(--text-3)', fontWeight: 600, fontSize: 11, margin: '14px 0 4px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Acquisizione clienti
        </p>
        <AutomationRow
          checked={cfg.newClientAppLinkEnabled ?? false} onChange={v => patch({ newClientAppLinkEnabled: v })}
          label="Invia link app a nuova cliente" description="Subito quando aggiungi una nuova cliente"
          disabled={!cfg.enabled} icon={<Smartphone size={15} style={{ color: '#c084fc' }} />}
          templateValue={cfg.newClientAppLinkMsg ?? ''}
          onTemplateChange={v => patch({ newClientAppLinkMsg: v })}
          vars={['nome', 'salone', 'link']}
          last
        />
      </div>

      {/* ── Log messaggi ── */}
      <div style={card({ padding: 0, overflow: 'hidden' })}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: 14, margin: 0 }}>Log messaggi</p>
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>{whatsappMessages?.length ?? 0} totali</span>
        </div>
        {recent.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: '32px 20px' }}>
            {cfg.enabled ? 'Nessun messaggio ancora — il primo partirà domani mattina.' : 'Attiva le automazioni per iniziare.'}
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Data', 'Cliente', 'Tipo', 'Stato'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--muted)', fontWeight: 500, fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recent.map(msg => (
                  <tr key={msg.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 16px', color: 'var(--muted)', fontSize: 11, whiteSpace: 'nowrap' }}>
                      {new Date(msg.sentAt).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ padding: '10px 16px', color: 'var(--text-2)' }}>{msg.clientName}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{
                        padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 500,
                        background:
                          msg.type === 'reminder' ? 'rgba(99,102,241,0.15)' :
                          msg.type === 'birthday' ? 'rgba(244,114,182,0.15)' :
                          msg.type === 'post_visit' ? 'rgba(52,211,153,0.15)' :
                          msg.type === 'loyalty' ? 'rgba(251,191,36,0.15)' : 'rgba(96,165,250,0.15)',
                        color:
                          msg.type === 'reminder' ? '#818cf8' :
                          msg.type === 'birthday' ? '#f472b6' :
                          msg.type === 'post_visit' ? '#34d399' :
                          msg.type === 'loyalty' ? '#fbbf24' : '#60a5fa',
                      }}>
                        {msg.type === 'reminder' ? 'Promemoria' :
                         msg.type === 'birthday' ? 'Compleanno' :
                         msg.type === 'post_visit' ? 'Post-visita' :
                         msg.type === 'loyalty' ? 'Fedeltà' : 'Prenotazione'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      {msg.status === 'sent'
                        ? <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#22c55e', fontSize: 12 }}><CheckCircle2 size={12} /> Inviato</span>
                        : <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#ef4444', fontSize: 12 }} title={msg.errorMsg}><XCircle size={12} /> Errore</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
