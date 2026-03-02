'use client';

import { useState } from 'react';
import { useSalon } from '@/context/SalonContext';
import { DEFAULT_WHATSAPP_CONFIG } from '@/types/salon';
import type { WhatsAppConfig } from '@/types/salon';
import {
  MessageSquare, CheckCircle, XCircle, ChevronDown, ChevronUp,
} from 'lucide-react';

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

  function patch(updates: Partial<WhatsAppConfig>) {
    const next = { ...cfg, ...updates };
    setCfg(next);
    updateSalonConfig({ whatsapp: next });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  const recentMessages = [...(whatsappMessages ?? [])].reverse().slice(0, 50);

  return (
    <div className="space-y-5 max-w-2xl mx-auto pb-12">
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

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-4 flex items-center justify-between">
        <div>
          <p className="font-semibold text-gray-800">Automazioni attive</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {cfg.enabled ? 'I messaggi vengono inviati automaticamente ogni mattina alle 9:00' : 'Attiva per iniziare a inviare messaggi ai clienti'}
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
          <Toggle
            checked={cfg.reminderEnabled}
            onChange={v => patch({ reminderEnabled: v })}
            label="Promemoria appuntamento"
            description="Inviato il giorno prima alle 9:00"
          />
          <Toggle
            checked={cfg.birthdayEnabled}
            onChange={v => patch({ birthdayEnabled: v })}
            label="Auguri compleanno"
            description="Inviato la mattina del compleanno del cliente"
          />
          <Toggle
            checked={cfg.postVisitEnabled}
            onChange={v => patch({ postVisitEnabled: v })}
            label="Follow-up post-visita"
            description="Inviato il giorno dopo un appuntamento completato"
          />
          <Toggle
            checked={cfg.bookingConfirmEnabled}
            onChange={v => patch({ bookingConfirmEnabled: v })}
            label="Conferma prenotazione online"
            description="Inviato subito dopo una prenotazione dal sito"
          />
          <div className="pt-1">
            <Toggle
              checked={cfg.loyaltyEnabled}
              onChange={v => patch({ loyaltyEnabled: v })}
              label="Traguardo fedelta"
              description="Inviato quando il cliente raggiunge la soglia punti"
            />
            {cfg.loyaltyEnabled && (
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

      <Section title={`Log messaggi (${whatsappMessages?.length ?? 0})`}>
        {recentMessages.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">
            {cfg.enabled ? 'Nessun messaggio ancora inviato — il primo partira domani mattina.' : 'Attiva le automazioni per iniziare.'}
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
                         msg.type === 'loyalty'         ? 'Fedelta' :
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
