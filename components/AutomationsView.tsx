'use client';

import { useState } from 'react';
import { useSalon } from '@/context/SalonContext';
import { DEFAULT_WHATSAPP_CONFIG } from '@/types/salon';
import type { WhatsAppConfig } from '@/types/salon';
import {
  MessageSquare, CheckCircle, XCircle, Eye, EyeOff,
  Send, RefreshCw, ChevronDown, ChevronUp,
} from 'lucide-react';

/* ─────────────────────────────────────────────
   Small helpers
───────────────────────────────────────────── */
function Section({
  title, children, defaultOpen = true,
}: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-4 text-left"
      >
        <span className="font-semibold text-gray-800">{title}</span>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>
      {open && <div className="px-6 pb-6">{children}</div>}
    </div>
  );
}

function Toggle({
  checked, onChange, label, description,
}: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <div className="flex items-start gap-4 py-3">
      <button
        onClick={() => onChange(!checked)}
        className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ${checked ? 'bg-green-500' : 'bg-gray-300'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`}
        />
      </button>
      <div>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>
    </div>
  );
}

function Input({
  label, value, onChange, type = 'text', placeholder,
}: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
      />
    </label>
  );
}

/* ─────────────────────────────────────────────
   Main View
───────────────────────────────────────────── */
export default function AutomationsView() {
  const ctx = useSalon();

  const { salonConfig, updateSalonConfig, whatsappMessages } = ctx;

  // Local copy of whatsapp config for edits
  const [cfg, setCfg] = useState<WhatsAppConfig>(
    () => salonConfig.whatsapp ?? { ...DEFAULT_WHATSAPP_CONFIG }
  );
  const [showToken, setShowToken] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [testError, setTestError] = useState('');
  const [saved, setSaved] = useState(false);

  function patch(updates: Partial<WhatsAppConfig>) {
    setCfg(prev => ({ ...prev, ...updates }));
    setSaved(false);
  }

  function handleSave() {
    updateSalonConfig({ whatsapp: cfg });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleTest() {
    if (!testPhone || !cfg.phoneNumberId || !cfg.accessToken) {
      setTestError('Inserisci Phone Number ID, Access Token e numero di test.');
      setTestStatus('error');
      return;
    }
    setTestStatus('loading');
    setTestError('');
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumberId: cfg.phoneNumberId,
          accessToken: cfg.accessToken,
          to: testPhone.replace(/\D/g, ''),
          templateName: cfg.reminderTemplate || 'hello_world',
          language: 'it',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTestStatus('ok');
      } else {
        setTestStatus('error');
        setTestError(data.error || 'Errore sconosciuto');
      }
    } catch (e: unknown) {
      setTestStatus('error');
      setTestError(e instanceof Error ? e.message : 'Errore di rete');
    }
  }

  const recentMessages = [...(whatsappMessages ?? [])].reverse().slice(0, 50);

  return (
    <div className="space-y-5 max-w-2xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-green-100">
          <MessageSquare size={22} className="text-green-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-800">Automazioni WhatsApp</h1>
          <p className="text-sm text-gray-500">Meta WhatsApp Cloud API — messaggi automatici ai clienti</p>
        </div>
      </div>

      {/* ── Credenziali ── */}
      <Section title="Connessione WhatsApp Business">
        <div className="space-y-4">
          <Toggle
            checked={cfg.enabled}
            onChange={v => patch({ enabled: v })}
            label="Abilita automazioni WhatsApp"
            description="Invia template approvati via Meta Business API"
          />

          <Input
            label="Phone Number ID"
            value={cfg.phoneNumberId}
            onChange={v => patch({ phoneNumberId: v })}
            placeholder="1234567890123456"
          />

          <label className="block">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Access Token</span>
            <div className="relative mt-1">
              <input
                type={showToken ? 'text' : 'password'}
                value={cfg.accessToken}
                onChange={e => patch({ accessToken: e.target.value })}
                placeholder="EAAxxxxxxx..."
                className="block w-full rounded-lg border border-gray-200 px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <button
                onClick={() => setShowToken(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>

          {/* Test */}
          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Test connessione</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={testPhone}
                onChange={e => setTestPhone(e.target.value)}
                placeholder="+39 333 1234567"
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <button
                onClick={handleTest}
                disabled={testStatus === 'loading'}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:opacity-50"
              >
                {testStatus === 'loading'
                  ? <RefreshCw size={14} className="animate-spin" />
                  : <Send size={14} />}
                Invia test
              </button>
            </div>
            {testStatus === 'ok' && (
              <p className="mt-2 text-sm text-green-600 flex items-center gap-1"><CheckCircle size={14} /> Messaggio inviato con successo!</p>
            )}
            {testStatus === 'error' && (
              <p className="mt-2 text-sm text-red-500 flex items-center gap-1"><XCircle size={14} /> {testError}</p>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleSave}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${saved ? 'bg-green-500 text-white' : 'bg-gray-800 text-white hover:bg-gray-700'}`}
            >
              {saved ? '✓ Salvato' : 'Salva credenziali'}
            </button>
          </div>
        </div>
      </Section>

      {/* ── Automazioni ── */}
      <Section title="Automazioni attive">
        <div className="divide-y divide-gray-50">
          <div className="pb-3">
            <Toggle
              checked={cfg.reminderEnabled}
              onChange={v => patch({ reminderEnabled: v })}
              label="Promemoria appuntamento"
              description="Inviato il giorno prima alle 8:00"
            />
            <Input
              label="Nome template"
              value={cfg.reminderTemplate}
              onChange={v => patch({ reminderTemplate: v })}
              placeholder="appointment_reminder"
            />
          </div>

          <div className="py-3">
            <Toggle
              checked={cfg.birthdayEnabled}
              onChange={v => patch({ birthdayEnabled: v })}
              label="Auguri compleanno"
              description="Inviato la mattina del compleanno"
            />
            <Input
              label="Nome template"
              value={cfg.birthdayTemplate}
              onChange={v => patch({ birthdayTemplate: v })}
              placeholder="birthday_wishes"
            />
          </div>

          <div className="py-3">
            <Toggle
              checked={cfg.postVisitEnabled}
              onChange={v => patch({ postVisitEnabled: v })}
              label="Follow-up post-visita"
              description="Inviato il giorno dopo un appuntamento completato"
            />
            <Input
              label="Nome template"
              value={cfg.postVisitTemplate}
              onChange={v => patch({ postVisitTemplate: v })}
              placeholder="post_visit"
            />
          </div>

          <div className="py-3">
            <Toggle
              checked={cfg.loyaltyEnabled}
              onChange={v => patch({ loyaltyEnabled: v })}
              label="Traguardo fedeltà"
              description="Inviato quando il cliente raggiunge la soglia punti"
            />
            <div className="grid grid-cols-2 gap-3 mt-2">
              <Input
                label="Nome template"
                value={cfg.loyaltyTemplate}
                onChange={v => patch({ loyaltyTemplate: v })}
                placeholder="loyalty_reward"
              />
              <label className="block">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Soglia punti</span>
                <input
                  type="number"
                  value={cfg.loyaltyMilestone}
                  onChange={e => patch({ loyaltyMilestone: parseInt(e.target.value) || 100 })}
                  className="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </label>
            </div>
          </div>

          <div className="pt-3">
            <Toggle
              checked={cfg.bookingConfirmEnabled}
              onChange={v => patch({ bookingConfirmEnabled: v })}
              label="Conferma prenotazione online"
              description="Inviato subito dopo la prenotazione dal sito"
            />
            <Input
              label="Nome template"
              value={cfg.bookingTemplate}
              onChange={v => patch({ bookingTemplate: v })}
              placeholder="booking_confirmed"
            />
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-gray-100 mt-2">
          <button
            onClick={handleSave}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${saved ? 'bg-green-500 text-white' : 'bg-gray-800 text-white hover:bg-gray-700'}`}
          >
            {saved ? '✓ Salvato' : 'Salva impostazioni'}
          </button>
        </div>
      </Section>

      {/* ── Guida template ── */}
      <Section title="Come creare i template su Meta" defaultOpen={false}>
        <ol className="space-y-3 text-sm text-gray-600 list-decimal list-inside">
          <li>Vai su <a href="https://business.facebook.com/wa/manage/message-templates/" target="_blank" rel="noreferrer" className="text-indigo-600 underline">business.facebook.com → WhatsApp → Modelli</a></li>
          <li>Crea un modello per ogni automazione con il nome esatto inserito sopra</li>
          <li>Categoria consigliata: <strong>UTILITY</strong> (approvazione più rapida)</li>
          <li>Lingua: <strong>Italiano (it)</strong></li>
          <li>Attendi l&apos;approvazione Meta (di solito 24-48h)</li>
        </ol>
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800 space-y-1">
          <p className="font-semibold">Variabili supportate nei template:</p>
          <p><code className="bg-amber-100 px-1 rounded">{`{{1}}`}</code> — Nome cliente</p>
          <p><code className="bg-amber-100 px-1 rounded">{`{{2}}`}</code> — Data/ora appuntamento (promemoria) oppure punti raggiunti (fedeltà)</p>
          <p><code className="bg-amber-100 px-1 rounded">{`{{3}}`}</code> — Operatrice / nome salone</p>
        </div>
      </Section>

      {/* ── Log messaggi ── */}
      <Section title={`Log messaggi (${whatsappMessages?.length ?? 0})`} defaultOpen={true}>
        {recentMessages.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">Nessun messaggio inviato ancora.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100">
                  <th className="text-left pb-2">Data</th>
                  <th className="text-left pb-2">Cliente</th>
                  <th className="text-left pb-2">Tipo</th>
                  <th className="text-left pb-2">Template</th>
                  <th className="text-left pb-2">Stato</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentMessages.map(msg => (
                  <tr key={msg.id} className="text-gray-600">
                    <td className="py-2 pr-3 text-xs text-gray-400 whitespace-nowrap">
                      {new Date(msg.sentAt).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-2 pr-3">{msg.clientName}</td>
                    <td className="py-2 pr-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        msg.type === 'reminder' ? 'bg-blue-100 text-blue-700' :
                        msg.type === 'birthday' ? 'bg-pink-100 text-pink-700' :
                        msg.type === 'post_visit' ? 'bg-purple-100 text-purple-700' :
                        msg.type === 'loyalty' ? 'bg-yellow-100 text-yellow-700' :
                        msg.type === 'booking_confirm' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {msg.type === 'reminder' ? 'Promemoria' :
                         msg.type === 'birthday' ? 'Compleanno' :
                         msg.type === 'post_visit' ? 'Post-visita' :
                         msg.type === 'loyalty' ? 'Fedeltà' :
                         msg.type === 'booking_confirm' ? 'Prenotazione' : 'Manuale'}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-xs font-mono text-gray-400">{msg.templateName}</td>
                    <td className="py-2">
                      {msg.status === 'sent'
                        ? <span className="flex items-center gap-1 text-green-600 text-xs"><CheckCircle size={12} /> Inviato</span>
                        : <span className="flex items-center gap-1 text-red-500 text-xs" title={msg.errorMsg}><XCircle size={12} /> Errore</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
