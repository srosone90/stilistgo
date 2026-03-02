'use client';

import { useState, useEffect, useRef } from 'react';
import { useSalon } from '@/context/SalonContext';
import { DEFAULT_WHATSAPP_CONFIG } from '@/types/salon';
import type { WhatsAppConfig } from '@/types/salon';
import { getCurrentUser } from '@/lib/supabase';
import {
  MessageSquare, CheckCircle, XCircle, ChevronDown, ChevronUp,
  Wifi, WifiOff, RefreshCw,
} from 'lucide-react';

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

function Toggle({ checked, onChange, label, description, disabled }: {
  checked: boolean; onChange: (v: boolean) => void;
  label: string; description?: string; disabled?: boolean;
}) {
  return (
    <div className={`flex items-start gap-4 py-3 ${disabled ? 'opacity-40' : ''}`}>
      <button
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ${checked ? 'bg-green-500' : 'bg-gray-300'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
      <div>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>
    </div>
  );
}

export default function AutomationsView() {
  const { salonConfig, updateSalonConfig, whatsappMessages } = useSalon();

  const [cfg, setCfg] = useState<WhatsAppConfig>(
    () => salonConfig.whatsapp ?? { ...DEFAULT_WHATSAPP_CONFIG }
  );
  const [saved, setSaved] = useState(false);
  const [instanceStatus, setInstanceStatus] = useState<'idle' | 'loading' | 'connected' | 'disconnected'>('idle');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const credLoadedRef = useRef(false);

  // On mount: fetch credentials directly from the API so we never depend on
  // the cloud-sync timing in SalonContext. Once loaded, trigger status check.
  useEffect(() => {
    if (credLoadedRef.current) return;
    credLoadedRef.current = true;
    (async () => {
      try {
        const user = await getCurrentUser();
        if (!user) return;
        const res = await fetch(`/api/admin/whatsapp?user_id=${user.id}`);
        if (!res.ok) return;
        const d = await res.json();
        const instanceId = d.ultraMsgInstanceId ?? '';
        const token = d.ultraMsgToken ?? '';
        if (instanceId && token) {
          setCfg(prev => ({ ...prev, ultraMsgInstanceId: instanceId, ultraMsgToken: token }));
        }
      } catch { /* offline — fall back to cached salonConfig */ }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-sync non-credential fields when salonConfig updates from cloud
  useEffect(() => {
    if (salonConfig.whatsapp) {
      setCfg(prev => ({
        ...salonConfig.whatsapp!,
        // Preserve credentials loaded directly from API (more reliable)
        ultraMsgInstanceId: prev.ultraMsgInstanceId || salonConfig.whatsapp!.ultraMsgInstanceId,
        ultraMsgToken: prev.ultraMsgToken || salonConfig.whatsapp!.ultraMsgToken,
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salonConfig.whatsapp?.ultraMsgInstanceId, salonConfig.whatsapp?.enabled,
      salonConfig.whatsapp?.reminderEnabled, salonConfig.whatsapp?.birthdayEnabled]);

  const isConfigured = Boolean(cfg.ultraMsgInstanceId && cfg.ultraMsgToken);

  function patch(updates: Partial<Omit<WhatsAppConfig, 'ultraMsgInstanceId' | 'ultraMsgToken'>>) {
    const next = { ...cfg, ...updates };
    setCfg(next);
    updateSalonConfig({ whatsapp: next });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function checkStatus() {
    if (!isConfigured) return;
    setInstanceStatus('loading');
    try {
      const res = await fetch(`/api/ultramsg/status?instanceId=${cfg.ultraMsgInstanceId}&token=${cfg.ultraMsgToken}`);
      const data = await res.json();
      setInstanceStatus(data.connected ? 'connected' : 'disconnected');
      setQrCode(data.qrCode ?? null);
    } catch {
      setInstanceStatus('disconnected');
      setQrCode(null);
    }
  }

  useEffect(() => {
    if (isConfigured) checkStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.ultraMsgInstanceId]);

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
            <p className="text-sm text-gray-500">Messaggi automatici ai tuoi clienti</p>
          </div>
        </div>
        {saved && (
          <span className="text-xs text-green-600 flex items-center gap-1">
            <CheckCircle size={13} /> Salvato
          </span>
        )}
      </div>

      {/* stato connessione */}
      {!isConfigured ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-6 py-5">
          <div className="flex items-center gap-3 mb-2">
            <WifiOff size={18} className="text-amber-600" />
            <p className="font-semibold text-amber-800">WhatsApp non ancora attivato</p>
          </div>
          <p className="text-sm text-amber-700">
            Il numero WhatsApp per il tuo salone non è ancora stato configurato.
            Contatta il supporto StylistGo per attivare il servizio. Puoi già configurare
            quali messaggi vuoi ricevere — partiranno appena attivato.
          </p>
          <a
            href="mailto:support@stylistgo.it?subject=Attivazione WhatsApp"
            className="inline-block mt-3 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700"
          >
            Richiedi attivazione
          </a>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              {instanceStatus === 'connected' && (
                <><Wifi size={18} className="text-green-600" />
                <div>
                  <p className="font-semibold text-sm text-green-700">WhatsApp connesso</p>
                  <p className="text-xs text-gray-400 mt-0.5">Istanza: {cfg.ultraMsgInstanceId}</p>
                </div></>
              )}
              {instanceStatus === 'disconnected' && (
                <div style={{ width: '100%' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <WifiOff size={18} className="text-orange-500" />
                    <div>
                      <p className="font-semibold text-sm text-orange-600">Scansiona il QR per attivare WhatsApp</p>
                      <p className="text-xs text-gray-400 mt-0.5">Apri WhatsApp → Impostazioni → Dispositivi collegati → Collega dispositivo</p>
                    </div>
                  </div>
                  {qrCode ? (
                    <div className="flex flex-col items-center gap-2 py-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qrCode} alt="QR WhatsApp" className="rounded-xl border border-gray-100" style={{ width: 200, height: 200, background: 'white', padding: 8 }} />
                      <p className="text-xs text-gray-400">Il QR scade ogni 45 secondi — clicca &quot;Aggiorna&quot; per rigenerarlo</p>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 mb-1">Clicca &quot;Aggiorna&quot; per caricare il QR da scansionare.</p>
                  )}
                </div>
              )}
              {(instanceStatus === 'idle' || instanceStatus === 'loading') && (
                <><RefreshCw size={18} className={`text-gray-400 ${instanceStatus === 'loading' ? 'animate-spin' : ''}`} />
                <p className="text-sm text-gray-500">Verifica connessione…</p></>
              )}
            </div>
            <button
              onClick={checkStatus}
              className="text-xs text-indigo-600 border border-indigo-200 rounded-lg px-3 py-1.5 hover:bg-indigo-50"
            >
              Verifica stato
            </button>
          </div>
        </div>
      )}

      {/* master toggle */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-4 flex items-center justify-between">
          <div>
            <p className="font-semibold text-gray-800">Automazioni attive</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {cfg.enabled
                ? 'I messaggi vengono inviati automaticamente ogni mattina alle 9:00'
                : 'Attiva per iniziare a inviare messaggi automatici'}
            </p>
          </div>
          <button
            onClick={() => patch({ enabled: !cfg.enabled })}
            className={`relative flex-shrink-0 w-14 h-7 rounded-full transition-colors ${cfg.enabled ? 'bg-green-500' : 'bg-gray-300'}`}
          >
            <span className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${cfg.enabled ? 'translate-x-7' : 'translate-x-0'}`} />
          </button>
        </div>
      

      {/* messaggi automatici */}
      <Section title="Messaggi automatici">
          <div className="divide-y divide-gray-50">
            <Toggle
              checked={cfg.reminderEnabled}
              onChange={v => patch({ reminderEnabled: v })}
              label="Promemoria appuntamento"
              description="Il giorno prima alle 9:00"
              disabled={!cfg.enabled}
            />
            <Toggle
              checked={cfg.birthdayEnabled}
              onChange={v => patch({ birthdayEnabled: v })}
              label="Auguri compleanno"
              description="La mattina del compleanno del cliente"
              disabled={!cfg.enabled}
            />
            <Toggle
              checked={cfg.postVisitEnabled}
              onChange={v => patch({ postVisitEnabled: v })}
              label="Follow-up post-visita"
              description="Il giorno dopo un appuntamento completato"
              disabled={!cfg.enabled}
            />
            <Toggle
              checked={cfg.bookingConfirmEnabled}
              onChange={v => patch({ bookingConfirmEnabled: v })}
              label="Conferma prenotazione online"
              description="Subito dopo una prenotazione dal sito"
              disabled={!cfg.enabled}
            />
            <div className="pt-1">
              <Toggle
                checked={cfg.loyaltyEnabled}
                onChange={v => patch({ loyaltyEnabled: v })}
                label="Traguardo fedeltà"
                description="Quando il cliente raggiunge la soglia punti"
                disabled={!cfg.enabled}
              />
              {cfg.loyaltyEnabled && cfg.enabled && (
                <div className="pl-14 mt-1">
                  <label className="text-xs text-gray-500 flex items-center gap-2">
                    Soglia punti
                    <input
                      type="number"
                      value={cfg.loyaltyMilestone}
                      onChange={e => patch({ loyaltyMilestone: parseInt(e.target.value) || 100 })}
                      className="w-20 rounded-lg border border-gray-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                  </label>
                </div>
              )}
            </div>
          </div>
        </Section>

      {/* log messaggi */}
      <Section title={`Log messaggi (${whatsappMessages?.length ?? 0})`} defaultOpen={false}>
        {recentMessages.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">
            {isConfigured && cfg.enabled
              ? 'Nessun messaggio ancora — il primo partirà domani mattina.'
              : 'Attiva le automazioni per iniziare.'}
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
                      {new Date(msg.sentAt).toLocaleString('it-IT', {
                        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td className="py-2 pr-3">{msg.clientName}</td>
                    <td className="py-2 pr-3">
                      <span className={[
                        'inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
                        msg.type === 'reminder'        ? 'bg-blue-100 text-blue-700' :
                        msg.type === 'birthday'        ? 'bg-pink-100 text-pink-700' :
                        msg.type === 'post_visit'      ? 'bg-purple-100 text-purple-700' :
                        msg.type === 'loyalty'         ? 'bg-yellow-100 text-yellow-700' :
                        msg.type === 'booking_confirm' ? 'bg-green-100 text-green-700' :
                                                         'bg-gray-100 text-gray-600',
                      ].join(' ')}>
                        {msg.type === 'reminder'        ? 'Promemoria' :
                         msg.type === 'birthday'        ? 'Compleanno' :
                         msg.type === 'post_visit'      ? 'Post-visita' :
                         msg.type === 'loyalty'         ? 'Fedeltà' :
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
