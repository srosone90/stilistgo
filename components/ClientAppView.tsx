'use client';

import React, { useState, useEffect } from 'react';
import { useSalon } from '@/context/SalonContext';
import { ClientAppConfig } from '@/types/salon';
import { getCurrentUser } from '@/lib/supabase';
import {
  Smartphone, Copy, Check, Palette, Settings2, MessageSquare,
  MapPin, Phone, Instagram, Facebook, Clock, Eye, Lock, Info, Link2, ExternalLink, UserPlus,
} from 'lucide-react';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://stilistgo.netlify.app';

// ─── Shared UI helpers ────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px',
};

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '10px',
  padding: '10px 14px', color: 'var(--text)', fontSize: '14px', outline: 'none', width: '100%',
};

const textareaStyle: React.CSSProperties = {
  ...{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '10px',
    padding: '10px 14px', color: 'var(--text)', fontSize: '14px', outline: 'none', width: '100%',
    resize: 'vertical' as const, minHeight: 80 },
};

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={cardStyle}>
      <div className="flex items-center gap-2 mb-4">
        {icon && <span style={{ color: 'var(--accent-light)' }}>{icon}</span>}
        <h3 className="font-semibold text-white">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>{label}</label>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange, label, description }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; description?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        {description && <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{description}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200"
        style={{ background: checked ? '#6366f1' : 'var(--border)', flexShrink: 0 }}
      >
        <span
          className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition duration-200"
          style={{ transform: checked ? 'translateX(1.25rem)' : 'translateX(0)' }}
        />
      </button>
    </div>
  );
}

function SaveBtn({ onClick, saved }: { onClick: () => void; saved?: boolean }) {
  return (
    <button onClick={onClick}
      className="mt-3 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
      style={{ background: saved ? 'rgba(34,197,94,0.8)' : 'rgba(99,102,241,0.8)' }}>
      {saved ? <Check size={14} /> : null}
      {saved ? 'Salvato!' : 'Salva modifiche'}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ClientAppView() {
  const { clientAppConfig, updateClientAppConfig } = useSalon();

  const [salonId, setSalonId] = useState('');
  const [idCopied, setIdCopied] = useState(false);
  const [baseLinkCopied, setBaseLinkCopied] = useState(false);
  const [clientPhone, setClientPhone] = useState('');
  const [clientNameInput, setClientNameInput] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');
  const [generatingLink, setGeneratingLink] = useState(false);
  const [clientLinkCopied, setClientLinkCopied] = useState(false);
  useEffect(() => { getCurrentUser().then(u => { if (u) setSalonId(u.id); }); }, []);
  function copySalonId() { navigator.clipboard.writeText(salonId); setIdCopied(true); setTimeout(() => setIdCopied(false), 2000); }
  const baseInstallUrl = salonId ? `${APP_URL}/prenota/${salonId}` : '';
  function copyBaseLink() { navigator.clipboard.writeText(baseInstallUrl); setBaseLinkCopied(true); setTimeout(() => setBaseLinkCopied(false), 2000); }
  async function generateClientLink() {
    if (!clientPhone.trim() || !clientNameInput.trim() || !salonId) return;
    setGeneratingLink(true);
    try {
      const res = await fetch('/api/client-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ salonId, clientPhone: clientPhone.trim(), clientName: clientNameInput.trim() }),
      });
      const d = await res.json();
      if (d.token) setGeneratedLink(`${baseInstallUrl}?t=${d.token}`);
    } catch { /* ignore */ }
    setGeneratingLink(false);
  }
  function copyClientLink() { navigator.clipboard.writeText(generatedLink); setClientLinkCopied(true); setTimeout(() => setClientLinkCopied(false), 2000); }

  // ── Branding ──────────────────────────────────────────────────────────────
  const [branding, setBranding] = useState({
    welcomeMessage: clientAppConfig.welcomeMessage,
    aboutText: clientAppConfig.aboutText,
    accentColor: clientAppConfig.accentColor,
  });
  const [brandingSaved, setBrandingSaved] = useState(false);
  useEffect(() => { setBranding(b => ({ ...b, welcomeMessage: clientAppConfig.welcomeMessage, aboutText: clientAppConfig.aboutText, accentColor: clientAppConfig.accentColor })); }, [clientAppConfig]);
  function saveBranding() {
    updateClientAppConfig(branding);
    setBrandingSaved(true); setTimeout(() => setBrandingSaved(false), 2000);
  }

  // ── Booking Settings ──────────────────────────────────────────────────────
  const [bookingSettings, setBookingSettings] = useState({
    showPrices: clientAppConfig.showPrices,
    requireLoginForBooking: clientAppConfig.requireLoginForBooking,
    maxAdvanceDays: clientAppConfig.maxAdvanceDays,
    minAdvanceHours: clientAppConfig.minAdvanceHours,
  });
  const [bookingSaved, setBookingSaved] = useState(false);
  useEffect(() => {
    setBookingSettings({
      showPrices: clientAppConfig.showPrices,
      requireLoginForBooking: clientAppConfig.requireLoginForBooking,
      maxAdvanceDays: clientAppConfig.maxAdvanceDays,
      minAdvanceHours: clientAppConfig.minAdvanceHours,
    });
  }, [clientAppConfig]);
  function saveBookingSettings() {
    updateClientAppConfig(bookingSettings);
    setBookingSaved(true); setTimeout(() => setBookingSaved(false), 2000);
  }

  // ── Contact ───────────────────────────────────────────────────────────────
  const [contact, setContact] = useState({
    contactPhone: clientAppConfig.contactPhone,
    contactAddress: clientAppConfig.contactAddress,
    instagramHandle: clientAppConfig.instagramHandle,
    facebookUrl: clientAppConfig.facebookUrl,
  });
  const [contactSaved, setContactSaved] = useState(false);
  useEffect(() => {
    setContact({
      contactPhone: clientAppConfig.contactPhone,
      contactAddress: clientAppConfig.contactAddress,
      instagramHandle: clientAppConfig.instagramHandle,
      facebookUrl: clientAppConfig.facebookUrl,
    });
  }, [clientAppConfig]);
  function saveContact() {
    updateClientAppConfig(contact);
    setContactSaved(true); setTimeout(() => setContactSaved(false), 2000);
  }

  // ── Messages ──────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState({
    cancellationPolicy: clientAppConfig.cancellationPolicy,
    bookingConfirmationMessage: clientAppConfig.bookingConfirmationMessage,
  });
  const [messagesSaved, setMessagesSaved] = useState(false);
  useEffect(() => {
    setMessages({
      cancellationPolicy: clientAppConfig.cancellationPolicy,
      bookingConfirmationMessage: clientAppConfig.bookingConfirmationMessage,
    });
  }, [clientAppConfig]);
  function saveMessages() {
    updateClientAppConfig(messages);
    setMessagesSaved(true); setTimeout(() => setMessagesSaved(false), 2000);
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Smartphone size={24} style={{ color: 'var(--accent-light)' }} />
          App Cliente
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          Personalizza l&apos;app di prenotazione per le tue clienti.
        </p>
      </div>

      {/* ── SALON ID ─────────────────────────────────────────────────────── */}
      <Section title="Collegamento App" icon={<Info size={16} />}>
        <p className="text-sm mb-3" style={{ color: 'var(--muted)' }}>
          ID univoco del tuo salone — necessario per collegare l&apos;app.
        </p>
        <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}
          className="flex items-center gap-3">
          <p className="text-xs font-mono flex-1 break-all" style={{ color: 'var(--accent-light)' }}>
            {salonId || '—'}
          </p>
          <button onClick={copySalonId} title="Copia ID"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: idCopied ? '#22c55e' : 'var(--muted)', flexShrink: 0 }}>
            {idCopied ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </div>
      </Section>

      {/* ── INSTALL LINK ──────────────────────────────────────────────────── */}
      <Section title="Link Installazione App" icon={<Link2 size={16} />}>
        {/* Base URL */}
        <p className="text-sm mb-3" style={{ color: 'var(--muted)' }}>
          Questo link apre l&apos;app nel browser e permette di aggiungerla alla schermata Home (PWA).
          Puoi condividerlo ovunque — su Instagram, nei messaggi, sul sito web.
        </p>
        <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}
          className="flex items-center gap-3">
          <p className="text-xs font-mono flex-1 break-all" style={{ color: 'var(--accent-light)' }}>
            {baseInstallUrl || '—'}
          </p>
          <button onClick={copyBaseLink} title="Copia link"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: baseLinkCopied ? '#22c55e' : 'var(--muted)', flexShrink: 0 }}>
            {baseLinkCopied ? <Check size={16} /> : <Copy size={16} />}
          </button>
          {baseInstallUrl && (
            <a href={baseInstallUrl} target="_blank" rel="noreferrer"
              style={{ color: 'var(--muted)', flexShrink: 0 }}>
              <ExternalLink size={15} />
            </a>
          )}
        </div>

        {/* Per-client link */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 4 }}>
          <div className="flex items-center gap-2 mb-2">
            <UserPlus size={14} style={{ color: 'var(--accent-light)' }} />
            <p className="text-sm font-semibold text-white">Link personalizzato per cliente</p>
          </div>
          <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
            Genera un link che riconosce automaticamente la cliente — niente registrazione, apre direttamente il suo profilo.
          </p>
          <div className="flex gap-2 mb-2">
            <input
              style={{ ...inputStyle, flex: 1 }}
              placeholder="Nome cliente"
              value={clientNameInput}
              onChange={e => { setClientNameInput(e.target.value); setGeneratedLink(''); }}
            />
            <input
              style={{ ...inputStyle, flex: 1 }}
              placeholder="Telefono (es. 393331234567)"
              value={clientPhone}
              onChange={e => { setClientPhone(e.target.value); setGeneratedLink(''); }}
              type="tel"
            />
          </div>
          <button
            onClick={generateClientLink}
            disabled={generatingLink || !clientPhone.trim() || !clientNameInput.trim()}
            style={{
              background: 'rgba(99,102,241,0.8)', border: 'none', borderRadius: 10,
              padding: '8px 18px', color: 'white', fontSize: 13, fontWeight: 600,
              cursor: generatingLink || !clientPhone.trim() || !clientNameInput.trim() ? 'not-allowed' : 'pointer',
              opacity: generatingLink || !clientPhone.trim() || !clientNameInput.trim() ? 0.5 : 1,
            }}
          >
            {generatingLink ? 'Generazione…' : '🔗 Genera link'}
          </button>

          {generatedLink && (
            <div style={{ marginTop: 12, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}
              className="flex items-center gap-3">
              <p className="text-xs font-mono flex-1 break-all" style={{ color: '#22c55e' }}>
                {generatedLink}
              </p>
              <button onClick={copyClientLink} title="Copia link"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: clientLinkCopied ? '#22c55e' : 'var(--muted)', flexShrink: 0 }}>
                {clientLinkCopied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--muted)' }}>Come funziona l&apos;installazione</p>
          <ol className="text-xs space-y-1" style={{ color: 'var(--border-light)', paddingLeft: 18 }}>
            <li>La cliente riceve il link (via WhatsApp o SMS)</li>
            <li>Apre il link nel browser del telefono</li>
            <li>iPhone: tocca <strong>Condividi</strong> → &quot;Aggiungi a schermata Home&quot;</li>
            <li>Android: tocca <strong>⋮</strong> → &quot;Aggiungi a schermata Home&quot;</li>
            <li>L&apos;app appare sull&apos;Home come qualsiasi altra app 🎉</li>
          </ol>
        </div>
      </Section>

      {/* ── BRANDING ─────────────────────────────────────────────────────── */}
      <Section title="Aspetto e Testo" icon={<Palette size={16} />}>
        <Field label="Messaggio di benvenuto (mostrato nella schermata Home)">
          <input
            style={inputStyle}
            value={branding.welcomeMessage}
            onChange={e => setBranding(b => ({ ...b, welcomeMessage: e.target.value }))}
            placeholder="es. Benvenuta da Le Ribelle! 💇‍♀️"
          />
        </Field>
        <Field label="Descrizione del salone (mostrata nel profilo e nell'home)">
          <textarea
            style={textareaStyle}
            value={branding.aboutText}
            onChange={e => setBranding(b => ({ ...b, aboutText: e.target.value }))}
            placeholder="Breve descrizione del tuo salone..."
          />
        </Field>
        <Field label="Colore principale app">
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={branding.accentColor}
              onChange={e => setBranding(b => ({ ...b, accentColor: e.target.value }))}
              style={{ width: 48, height: 40, border: 'none', borderRadius: 8, cursor: 'pointer', background: 'none', padding: 2 }}
            />
            <input
              style={{ ...inputStyle, width: 'auto', flex: 1 }}
              value={branding.accentColor}
              onChange={e => setBranding(b => ({ ...b, accentColor: e.target.value }))}
              placeholder="#c084fc"
            />
            <div style={{ width: 36, height: 36, borderRadius: 8, background: branding.accentColor, border: '1px solid var(--border)', flexShrink: 0 }} />
          </div>
          <p className="text-xs mt-1" style={{ color: 'var(--border-light)' }}>
            Usato per pulsanti, schede e icone nell&apos;app. Predefinito: <code>#c084fc</code>
          </p>
        </Field>
        <SaveBtn onClick={saveBranding} saved={brandingSaved} />
      </Section>

      {/* ── BOOKING SETTINGS ─────────────────────────────────────────────── */}
      <Section title="Impostazioni Prenotazione" icon={<Settings2 size={16} />}>
        <Toggle
          checked={bookingSettings.showPrices}
          onChange={v => setBookingSettings(b => ({ ...b, showPrices: v }))}
          label="Mostra prezzi nell'app"
          description="Se disattivato, i prezzi dei servizi vengono nascosti"
        />
        <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
        <Toggle
          checked={bookingSettings.requireLoginForBooking}
          onChange={v => setBookingSettings(b => ({ ...b, requireLoginForBooking: v }))}
          label="Richiedi login per prenotare"
          description="Se disattivato, chiunque può prenotare senza registrarsi"
        />
        <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
        <div className="grid grid-cols-2 gap-4 mt-3">
          <Field label="Max giorni prenotabili in anticipo">
            <input
              type="number" min={1} max={365}
              style={inputStyle}
              value={bookingSettings.maxAdvanceDays}
              onChange={e => setBookingSettings(b => ({ ...b, maxAdvanceDays: Math.max(1, parseInt(e.target.value) || 90) }))}
            />
          </Field>
          <Field label="Ore minime di preavviso">
            <input
              type="number" min={0} max={168}
              style={inputStyle}
              value={bookingSettings.minAdvanceHours}
              onChange={e => setBookingSettings(b => ({ ...b, minAdvanceHours: Math.max(0, parseInt(e.target.value) || 0) }))}
            />
          </Field>
        </div>
        <SaveBtn onClick={saveBookingSettings} saved={bookingSaved} />
      </Section>

      {/* ── CONTACT & SOCIAL ─────────────────────────────────────────────── */}
      <Section title="Contatti e Social" icon={<Phone size={16} />}>
        <div className="grid grid-cols-1 gap-0">
          <Field label="Telefono">
            <div className="relative">
              <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
              <input
                style={{ ...inputStyle, paddingLeft: 34 }}
                value={contact.contactPhone}
                onChange={e => setContact(c => ({ ...c, contactPhone: e.target.value }))}
                placeholder="+39 348 000 0000"
              />
            </div>
          </Field>
          <Field label="Indirizzo">
            <div className="relative">
              <MapPin size={14} className="absolute left-3 top-3" style={{ color: 'var(--muted)' }} />
              <input
                style={{ ...inputStyle, paddingLeft: 34 }}
                value={contact.contactAddress}
                onChange={e => setContact(c => ({ ...c, contactAddress: e.target.value }))}
                placeholder="Via Roma 1, Milano"
              />
            </div>
          </Field>
          <Field label="Instagram (senza @)">
            <div className="relative">
              <Instagram size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
              <input
                style={{ ...inputStyle, paddingLeft: 34 }}
                value={contact.instagramHandle}
                onChange={e => setContact(c => ({ ...c, instagramHandle: e.target.value }))}
                placeholder="leribelle.salon"
              />
            </div>
          </Field>
          <Field label="Facebook (URL pagina)">
            <div className="relative">
              <Facebook size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
              <input
                style={{ ...inputStyle, paddingLeft: 34 }}
                value={contact.facebookUrl}
                onChange={e => setContact(c => ({ ...c, facebookUrl: e.target.value }))}
                placeholder="https://facebook.com/leribelle"
              />
            </div>
          </Field>
        </div>
        <SaveBtn onClick={saveContact} saved={contactSaved} />
      </Section>

      {/* ── MESSAGES ─────────────────────────────────────────────────────── */}
      <Section title="Messaggi" icon={<MessageSquare size={16} />}>
        <Field label="Informativa cancellazione (mostrata prima di confermare)">
          <textarea
            style={textareaStyle}
            value={messages.cancellationPolicy}
            onChange={e => setMessages(m => ({ ...m, cancellationPolicy: e.target.value }))}
          />
        </Field>
        <Field label="Messaggio di conferma prenotazione">
          <textarea
            style={{ ...textareaStyle, minHeight: 60 }}
            value={messages.bookingConfirmationMessage}
            onChange={e => setMessages(m => ({ ...m, bookingConfirmationMessage: e.target.value }))}
          />
        </Field>
        <SaveBtn onClick={saveMessages} saved={messagesSaved} />
      </Section>

      {/* ── NEXT STEPS ───────────────────────────────────────────────────── */}
      <Section title="Come funziona l'app" icon={<Smartphone size={16} />}>
        <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
          Nessun App Store, nessun tecnico. La tua app è già online — basta condividere il link.
        </p>
        <ol className="space-y-4">
          {[
            { n: 1, emoji: '🔗', title: 'Copia il link di installazione', desc: 'Lo trovi nella sezione "Link Installazione App" qui sopra. È il link della tua app personale.' },
            { n: 2, emoji: '📲', title: 'Condividilo alle tue clienti', desc: 'Mandalo su WhatsApp, mettilo in bio su Instagram, stampalo sul biglietto da visita come QR code.' },
            { n: 3, emoji: '👆', title: 'La cliente apre il link', desc: 'Si apre nel browser del telefono. iPhone: tocca Condividi → "Aggiungi a schermata Home". Android: il browser chiede direttamente di installare.' },
            { n: 4, emoji: '🎉', title: 'Hai la tua app!', desc: 'Appare sull\'Home del telefono con il nome del tuo salone. Si apre a schermo intero come una vera app.' },
          ].map(({ n, emoji, title, desc }) => (
            <li key={n} className="flex gap-3 items-start">
              <span className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ background: 'rgba(99,102,241,0.3)', border: '1px solid rgba(99,102,241,0.4)', marginTop: 1 }}>{n}</span>
              <div>
                <p className="text-sm font-semibold text-white mb-0.5">{emoji} {title}</p>
                <p className="text-xs" style={{ color: 'var(--muted)', lineHeight: 1.5 }}>{desc}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-5 rounded-xl p-4 text-xs" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
          💡 <strong style={{ color: '#4ade80' }}>Automazione consigliata:</strong> vai in{' '}
          <strong style={{ color: 'white' }}>Automazioni WhatsApp</strong> e attiva{' '}
          <strong style={{ color: 'white' }}>&quot;Invia link app a nuova cliente&quot;</strong> — il link verrà inviato automaticamente via WhatsApp ogni volta che aggiungi una nuova cliente.
        </div>
      </Section>
    </div>
  );
}
