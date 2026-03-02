'use client';

import { useState } from 'react';
import { useSalon } from '@/context/SalonContext';
import { DEFAULT_WHATSAPP_CONFIG } from '@/types/salon';
import type { WhatsAppConfig } from '@/types/salon';
import {
  MessageSquare, CheckCircle, XCircle, ChevronDown, ChevronUp,
  Eye, EyeOff, Send, RefreshCw, ExternalLink, ArrowRight,
} from 'lucide-react';

/* ─── helpers ─────────────────────────────────────────────────────────────── */
function Section({ title, children, defaultOpen = true }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-4 text-left">
        <span className="font-semibold text-gray-800">{title}</span>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>
      {open && <div className="px-6 pb-6">{children}</div>}
    </div>
  );
}

function Toggle({ checked, onChange, label, description }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; description?: string;
}) {
  return (
    <div className="flex items-start gap-4 py-3">
      <button onClick={() => onChange(!checked)}
        className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ${checked ? 'bg-green-500' : 'bg-gray-300'}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
      <div>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>
    </div>
  );
}

/* wizard steps */
const STEPS = [
  {
    n: 1,
    title: 'Crea il tuo WhatsApp Business Account',
    desc: 'Vai su Impostazioni Business → Account → Account WhatsApp e crea il tuo account personale (non quello di test di StylistGo).',
    action: 'Impostazioni → Account WhatsApp',
    url: 'https://business.facebook.com/settings/whatsapp-business-accounts/',
    note: 'Clicca il pulsante "Aggiungi" in alto a destra. Si apre una procedura guidata: dai un nome al tuo account (es. "Le Ribelle Salon"), seleziona il tuo Business Manager e conferma.',
  },
  {
    n: 2,
    title: 'Aggiungi il numero di telefono',
    desc: 'Una volta creato il tuo account, entra dentro e aggiungi il numero.',
    action: 'WhatsApp Manager → Numeri di telefono',
    url: 'https://business.facebook.com/latest/whatsapp_manager/phone_numbers/',
    note: 'Assicurati di aver selezionato il TUO account (non "Test WhatsApp Business Account") dal menu in alto a destra. Poi clicca "+ Aggiungi numero di telefono". Il numero NON deve essere già attivo su WhatsApp su nessun telefono.',
  },
  {
    n: 3,
    title: 'Copia il Phone Number ID',
    desc: 'Vai su developers.facebook.com → apri la tua app → WhatsApp → Configurazione API.',
    action: 'Apri Configurazione API',
    url: 'https://developers.facebook.com/apps/',
    note: 'Nel menu "Da" seleziona il tuo numero reale (non 15551371087). Copia il campo "ID numero di telefono" (15-16 cifre) e incollalo qui sotto.',
  },
  {
    n: 4,
    title: 'Copia il Token di accesso',
    desc: 'Nella stessa pagina copia il token. Per uno permanente usa gli Utenti di sistema.',
    action: 'Apri Configurazione API',
    url: 'https://developers.facebook.com/apps/',
    note: 'Copia "Token di accesso temporaneo" (scade ogni 24h). Per uno permanente: menu sinistra → Impostazioni → Avanzate → Utenti di sistema → Aggiungi → tipo Admin → Genera token → spunta whatsapp_business_messaging.',
  },
];

/* ─── main ─────────────────────────────────────────────────────────────────── */
export default function AutomationsView() {
  const { salonConfig, updateSalonConfig, whatsappMessages } = useSalon();

  const [cfg, setCfg] = useState<WhatsAppConfig>(
    () => salonConfig.whatsapp ?? { ...DEFAULT_WHATSAPP_CONFIG }
  );

  // Credentials are edited locally and only saved on explicit button press
  const [localPhoneId, setLocalPhoneId] = useState(cfg.phoneNumberId);
  const [localToken, setLocalToken]     = useState(cfg.accessToken);
  const [credSaved, setCredSaved]       = useState(false);

  const [saved, setSaved]         = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [testError, setTestError]   = useState('');
  const [wizardOpen, setWizardOpen] = useState(!cfg.phoneNumberId);
  const [editCreds, setEditCreds]   = useState(false);

  // Save toggles/settings immediately (NOT credentials)
  function patch(updates: Partial<Omit<WhatsAppConfig, 'phoneNumberId' | 'accessToken'>>) {
    const next = { ...cfg, ...updates };
    setCfg(next);
    updateSalonConfig({ whatsapp: next });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  // Save credentials explicitly
  function saveCredentials() {
    const next = { ...cfg, phoneNumberId: localPhoneId.trim(), accessToken: localToken.trim() };
    setCfg(next);
    updateSalonConfig({ whatsapp: next });
    setCredSaved(true);
    setEditCreds(false);
    setWizardOpen(false);
    setTimeout(() => setCredSaved(false), 2000);
  }

  function clearCredentials() {
    const next = { ...cfg, phoneNumberId: '', accessToken: '', enabled: false };
    setCfg(next);
    setLocalPhoneId('');
    setLocalToken('');
    updateSalonConfig({ whatsapp: next });
    setWizardOpen(true);
    setEditCreds(false);
  }

  async function handleTest() {
    if (!testPhone) {
      setTestError('Inserisci un numero di telefono di test.');
      setTestStatus('error');
      return;
    }
    const phoneId = localPhoneId.trim() || cfg.phoneNumberId;
    const token   = localToken.trim()   || cfg.accessToken;
    if (!phoneId || !token) {
      setTestError('Inserisci Phone Number ID e Token prima di testare.');
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
          phoneNumberId: phoneId,
          accessToken: token,
          to: testPhone.replace(/\s/g, ''),
          templateName: 'hello_world',
          language: 'en_US',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTestStatus('ok');
      } else {
        setTestStatus('error');
        setTestError(data.error ?? 'Errore sconosciuto');
      }
    } catch (e: unknown) {
      setTestStatus('error');
      setTestError(e instanceof Error ? e.message : 'Errore di rete');
    }
  }

  const isConnected = Boolean(cfg.phoneNumberId && cfg.accessToken);
  const recentMessages = [...(whatsappMessages ?? [])].reverse().slice(0, 50);

  return (
    <div className="space-y-5 max-w-2xl mx-auto pb-12">

      {/* header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-green-100">
            <MessageSquare size={22} className="text-green-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Automazioni WhatsApp</h1>
            <p className="text-sm text-gray-500">1.000 messaggi gratuiti al mese per questo salone</p>
          </div>
        </div>
        {saved && (
          <span className="text-xs text-green-600 flex items-center gap-1">
            <CheckCircle size={13} /> Salvato
          </span>
        )}
      </div>

      {/* connection status */}
      {isConnected ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle size={18} />
              <div>
                <p className="font-semibold text-sm">WhatsApp Business connesso</p>
                <p className="text-xs text-green-600 font-mono mt-0.5">ID: {cfg.phoneNumberId}</p>
              </div>
            </div>
            <button
              onClick={() => setEditCreds(v => !v)}
              className="text-xs text-indigo-600 font-semibold hover:text-indigo-800 border border-indigo-200 rounded-lg px-3 py-1.5"
            >
              {editCreds ? 'Chiudi' : 'Modifica credenziali'}
            </button>
          </div>
          {editCreds && (
            <div className="px-6 pb-5 border-t border-gray-100 space-y-3 pt-4">
              <div>
                <label className="text-xs text-gray-500">Phone Number ID</label>
                <input type="text" value={localPhoneId}
                  onChange={e => setLocalPhoneId(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Token di accesso</label>
                <div className="relative mt-1">
                  <input type={showToken ? 'text' : 'password'} value={localToken}
                    onChange={e => setLocalToken(e.target.value)}
                    className="block w-full rounded-lg border border-gray-200 px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  <button onClick={() => setShowToken(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showToken ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <button onClick={clearCredentials}
                  className="text-xs text-red-500 hover:text-red-700 underline">
                  Cancella credenziali
                </button>
                <button onClick={saveCredentials}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700">
                  Salva credenziali
                </button>
              </div>
              {credSaved && <p className="text-xs text-green-600 flex items-center gap-1"><CheckCircle size={12}/> Salvato</p>}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-6 py-4 flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm text-amber-800">WhatsApp non configurato</p>
            <p className="text-xs text-amber-600 mt-0.5">Segui la guida qui sotto per attivare i messaggi automatici</p>
          </div>
          <button
            onClick={() => setWizardOpen(o => !o)}
            className="text-xs text-amber-700 font-semibold hover:text-amber-900 flex items-center gap-1"
          >
            {wizardOpen ? 'Chiudi guida' : 'Apri guida'} <ArrowRight size={12} />
          </button>
        </div>
      )}

      {/* ── guided wizard ── */}
      {wizardOpen && !isConnected && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <p className="font-semibold text-gray-800">Configurazione guidata — 10 minuti</p>
            <p className="text-xs text-gray-400 mt-0.5">Segui i 4 passi. Ogni passo include un link diretto alla pagina giusta.</p>
          </div>
          <div className="px-6 py-4 space-y-5">
            {STEPS.map((step) => (
              <div key={step.n} className="flex gap-4">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">
                  {step.n}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm text-gray-800">{step.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{step.desc}</p>
                  <a
                    href={step.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 mt-2 text-xs text-indigo-600 font-medium hover:text-indigo-800"
                  >
                    <ExternalLink size={11} /> {step.action}
                  </a>
                  <div className="mt-2 bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-500 border border-gray-100">
                    {step.note}
                  </div>
                </div>
              </div>
            ))}

            <div className="pt-2 border-t border-gray-100 space-y-3">
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Incolla le credenziali qui</p>
              <div>
                <label className="text-xs text-gray-500">Phone Number ID</label>
                <input
                  type="text"
                  value={localPhoneId}
                  onChange={e => setLocalPhoneId(e.target.value)}
                  placeholder="123456789012345"
                  className="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Token di accesso</label>
                <div className="relative mt-1">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={localToken}
                    onChange={e => setLocalToken(e.target.value)}
                    placeholder="EAAxxxxxxx..."
                    className="block w-full rounded-lg border border-gray-200 px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                  <button onClick={() => setShowToken(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showToken ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* test */}
              <div className="pt-2">
                <p className="text-xs text-gray-500 mb-2">Testa la connessione inviando un messaggio a te stesso:</p>
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
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium disabled:opacity-50"
                  >
                    {testStatus === 'loading' ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                    Test
                  </button>
                </div>
                {testStatus === 'ok' && (
                  <p className="mt-2 text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle size={13} /> Connessione riuscita! Ora attiva le automazioni qui sotto.
                  </p>
                )}
                {testStatus === 'error' && (
                  <p className="mt-2 text-xs text-red-500 flex items-center gap-1">
                    <XCircle size={13} /> {testError}
                  </p>
                )}
              </div>

              {localPhoneId.trim() && localToken.trim() && (
                <button
                  onClick={saveCredentials}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
                >
                  Salva e attiva automazioni
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── automations toggles ── */}
      {isConnected && (
        <>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-4 flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-800">Automazioni attive</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {cfg.enabled ? 'I messaggi vengono inviati automaticamente ogni mattina alle 9:00' : 'Attiva per iniziare a inviare messaggi'}
              </p>
            </div>
            <button
              onClick={() => patch({ enabled: !cfg.enabled })}
              className={`relative flex-shrink-0 w-14 h-7 rounded-full transition-colors ${cfg.enabled ? 'bg-green-500' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${cfg.enabled ? 'translate-x-7' : 'translate-x-0'}`} />
            </button>
          </div>

          <Section title="Messaggi automatici">
            <div className="divide-y divide-gray-50">
              <Toggle checked={cfg.reminderEnabled} onChange={v => patch({ reminderEnabled: v })}
                label="Promemoria appuntamento" description="Il giorno prima alle 9:00" />
              <Toggle checked={cfg.birthdayEnabled} onChange={v => patch({ birthdayEnabled: v })}
                label="Auguri compleanno" description="La mattina del compleanno" />
              <Toggle checked={cfg.postVisitEnabled} onChange={v => patch({ postVisitEnabled: v })}
                label="Follow-up post-visita" description="Il giorno dopo un appuntamento completato" />
              <Toggle checked={cfg.bookingConfirmEnabled} onChange={v => patch({ bookingConfirmEnabled: v })}
                label="Conferma prenotazione online" description="Subito dopo la prenotazione dal sito" />
              <div className="pt-1">
                <Toggle checked={cfg.loyaltyEnabled} onChange={v => patch({ loyaltyEnabled: v })}
                  label="Traguardo fedelta" description="Quando il cliente raggiunge la soglia punti" />
                {cfg.loyaltyEnabled && (
                  <div className="pl-14 mt-1">
                    <label className="text-xs text-gray-500 flex items-center gap-2">
                      Soglia punti
                      <input type="number" value={cfg.loyaltyMilestone}
                        onChange={e => patch({ loyaltyMilestone: parseInt(e.target.value) || 100 })}
                        className="w-20 rounded-lg border border-gray-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    </label>
                  </div>
                )}
              </div>
            </div>
          </Section>
        </>
      )}

      {/* ── log ── */}
      <Section title={`Log messaggi (${whatsappMessages?.length ?? 0})`}>
        {recentMessages.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">
            {isConnected && cfg.enabled ? 'Nessun messaggio ancora — il primo partira domani mattina.' : 'Configura WhatsApp e attiva le automazioni per iniziare.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100">
                  <th className="text-left pb-2">Data</th>
                  <th className="text-left pb-2">Cliente</th>
                  <th className="text-left pb-2">Tipo</th>
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
                      <span className={[
                        'inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
                        msg.type === 'reminder' ? 'bg-blue-100 text-blue-700' :
                        msg.type === 'birthday' ? 'bg-pink-100 text-pink-700' :
                        msg.type === 'post_visit' ? 'bg-purple-100 text-purple-700' :
                        msg.type === 'loyalty' ? 'bg-yellow-100 text-yellow-700' :
                        msg.type === 'booking_confirm' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-600',
                      ].join(' ')}>
                        {msg.type === 'reminder' ? 'Promemoria' :
                         msg.type === 'birthday' ? 'Compleanno' :
                         msg.type === 'post_visit' ? 'Post-visita' :
                         msg.type === 'loyalty' ? 'Fedelta' :
                         msg.type === 'booking_confirm' ? 'Prenotazione' : 'Manuale'}
                      </span>
                    </td>
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
