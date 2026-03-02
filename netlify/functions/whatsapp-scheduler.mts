/**
 * Netlify Scheduled Function — WhatsApp Automation Engine (UltraMsg)
 * Runs every day at 08:00 UTC (09:00 Rome CET / 10:00 CEST)
 *
 * For each salon with UltraMsg configured and enabled, sends:
 *   - Appointment reminders (tomorrow's appointments)
 *   - Birthday wishes (clients with birthday today)
 *   - Post-visit follow-up (completed appointments yesterday)
 *   - Loyalty milestone notifications
 */
import type { Config } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

// ─── Types ────────────────────────────────────────────────────────────────────
interface WhatsAppConfig {
  enabled: boolean;
  ultraMsgInstanceId: string;
  ultraMsgToken: string;
  reminderEnabled: boolean;
  birthdayEnabled: boolean;
  postVisitEnabled: boolean;
  loyaltyEnabled: boolean;
  loyaltyMilestone: number;
  bookingConfirmEnabled: boolean;
  appointmentConfirmEnabled?: boolean;
  // Custom message templates
  reminderMsg?: string;
  birthdayMsg?: string;
  postVisitMsg?: string;
  loyaltyMsg?: string;
}
interface Client {
  id: string; firstName: string; lastName: string;
  phone: string; birthDate: string; loyaltyPoints: number;
}
interface Appointment {
  id: string; clientId: string; date: string;
  startTime: string; status: string; serviceIds: string[];
}
interface Service { id: string; name: string; }
interface SalonConfig { salonName: string; whatsapp?: WhatsAppConfig; }
interface SalonState {
  salonConfig?: SalonConfig;
  clients?: Client[];
  appointments?: Appointment[];
  services?: Service[];
  whatsappMessages?: WhatsAppLogEntry[];
}
interface WhatsAppLogEntry {
  id: string; type: string; clientId: string; clientName: string;
  phone: string; templateName: string; status: 'sent' | 'failed';
  errorMsg?: string; sentAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().slice(0, 10);
const tomorrowStr = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); };
const yesterdayStr = () => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); };
const todayMMDD = () => { const t = new Date(); return `${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`; };

// ─── Template renderer ────────────────────────────────────────────────────────────────────
function renderTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce((msg, [k, v]) => msg.split(`{${k}}`).join(v), template);
}

const DEFAULT_REMINDER_MSG    = 'Ciao {nome}! 😊 Ti ricordiamo il tuo appuntamento di *{servizio}* domani alle {ora} da {salone}. A presto!';
const DEFAULT_BIRTHDAY_MSG    = 'Tanti auguri {nome}! 🎂🎉 Tutto il team di {salone} ti augura una splendida giornata!';
const DEFAULT_POSTVISIT_MSG   = 'Ciao {nome}! Speriamo tu sia soddisfatta della tua visita da {salone}. ⭐ Ci fa sempre piacere sapere come stai!';
const DEFAULT_LOYALTY_MSG     = 'Complimenti {nome}! 🌟 Hai raggiunto {punti} punti fedeltà da {salone}. Contattaci per scoprire il tuo premio!';

async function sendUltraMsg(instanceId: string, token: string, to: string, message: string): Promise<boolean> {
  const phone = to.replace(/\D/g, '');
  if (!phone) return false;
  try {
    const res = await fetch(`https://api.ultramsg.com/${instanceId}/messages/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token, to: phone, body: message }),
    });
    const data = await res.json();
    return data.sent === true || data.message === 'ok';
  } catch {
    return false;
  }
}

const BUCKET = 'salon-data';

// ─── Main ────────────────────────────────────────────────────────────────────
export default async function handler() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // List all salon state files from Storage bucket
  const { data: fileList, error } = await supabase.storage.from(BUCKET).list('', { limit: 1000 });
  if (error || !fileList) {
    console.error('Scheduler: cannot list storage bucket', error);
    return;
  }

  const today     = todayStr();
  const tomorrow  = tomorrowStr();
  const yesterday = yesterdayStr();
  const mmdd      = todayMMDD();

  const rows = fileList.filter(f => f.name.endsWith('.json'));

  for (const file of rows) {
    const userId = file.name.replace('.json', '');
    let state: SalonState = {};
    try {
      const { data: blob } = await supabase.storage.from(BUCKET).download(file.name);
      if (blob) state = JSON.parse(await blob.text()) as SalonState;
    } catch { continue; }

    const wa = state.salonConfig?.whatsapp;
    if (!wa?.enabled || !wa.ultraMsgInstanceId || !wa.ultraMsgToken) continue;

    const { ultraMsgInstanceId: instanceId, ultraMsgToken: token } = wa;
    const salonName = state.salonConfig?.salonName ?? 'il salone';
    const clients   = state.clients ?? [];
    const apts      = state.appointments ?? [];
    const services  = state.services ?? [];
    const log: WhatsAppLogEntry[] = [...(state.whatsappMessages ?? [])];

    const alreadySent = new Set(log.filter(m => m.sentAt.startsWith(today)).map(m => `${m.type}:${m.clientId}`));

    // ── Promemoria appuntamento ──
    if (wa.reminderEnabled) {
      for (const apt of apts.filter(a => a.date === tomorrow && a.status !== 'cancelled')) {
        const client = clients.find(c => c.id === apt.clientId);
        if (!client?.phone) continue;
        const key = `reminder:${client.id}`;
        if (alreadySent.has(key)) continue;
        const svcNames = services.filter(s => apt.serviceIds.includes(s.id)).map(s => s.name).join(', ') || 'appuntamento';
        const msg = renderTemplate(wa.reminderMsg ?? DEFAULT_REMINDER_MSG, { nome: client.firstName, servizio: svcNames, ora: apt.startTime, salone: salonName });
        const sent = await sendUltraMsg(instanceId, token, client.phone, msg);
        log.push({ id: crypto.randomUUID(), type: 'reminder', clientId: client.id, clientName: `${client.firstName} ${client.lastName}`, phone: client.phone, templateName: 'reminder', status: sent ? 'sent' : 'failed', sentAt: new Date().toISOString() });
        alreadySent.add(key);
      }
    }

    // ── Auguri compleanno ──
    if (wa.birthdayEnabled) {
      for (const client of clients.filter(c => c.birthDate?.slice(5) === mmdd && c.phone)) {
        const key = `birthday:${client.id}`;
        if (alreadySent.has(key)) continue;
        const msg = renderTemplate(wa.birthdayMsg ?? DEFAULT_BIRTHDAY_MSG, { nome: client.firstName, salone: salonName });
        const sent = await sendUltraMsg(instanceId, token, client.phone, msg);
        log.push({ id: crypto.randomUUID(), type: 'birthday', clientId: client.id, clientName: `${client.firstName} ${client.lastName}`, phone: client.phone, templateName: 'birthday', status: sent ? 'sent' : 'failed', sentAt: new Date().toISOString() });
        alreadySent.add(key);
      }
    }

    // ── Post-visita ──
    if (wa.postVisitEnabled) {
      for (const apt of apts.filter(a => a.date === yesterday && a.status === 'completed')) {
        const client = clients.find(c => c.id === apt.clientId);
        if (!client?.phone) continue;
        const key = `post_visit:${client.id}`;
        if (alreadySent.has(key)) continue;
        const msg = renderTemplate(wa.postVisitMsg ?? DEFAULT_POSTVISIT_MSG, { nome: client.firstName, salone: salonName });
        const sent = await sendUltraMsg(instanceId, token, client.phone, msg);
        log.push({ id: crypto.randomUUID(), type: 'post_visit', clientId: client.id, clientName: `${client.firstName} ${client.lastName}`, phone: client.phone, templateName: 'post_visit', status: sent ? 'sent' : 'failed', sentAt: new Date().toISOString() });
        alreadySent.add(key);
      }
    }

    // ── Fedeltà milestone ──
    if (wa.loyaltyEnabled && wa.loyaltyMilestone) {
      for (const client of clients.filter(c => c.loyaltyPoints >= wa.loyaltyMilestone && c.phone)) {
        const key = `loyalty:${client.id}`;
        if (alreadySent.has(key)) continue;
        const msg = renderTemplate(wa.loyaltyMsg ?? DEFAULT_LOYALTY_MSG, { nome: client.firstName, punti: String(client.loyaltyPoints), salone: salonName });
        const sent = await sendUltraMsg(instanceId, token, client.phone, msg);
        log.push({ id: crypto.randomUUID(), type: 'loyalty', clientId: client.id, clientName: `${client.firstName} ${client.lastName}`, phone: client.phone, templateName: 'loyalty', status: sent ? 'sent' : 'failed', sentAt: new Date().toISOString() });
        alreadySent.add(key);
      }
    }

    // Save updated log back to Storage (last 200)
    const updatedState = { ...state, whatsappMessages: log.slice(-200) };
    const blob = new Blob([JSON.stringify(updatedState)], { type: 'application/json' });
    await supabase.storage.from(BUCKET).upload(file.name, blob, { upsert: true, contentType: 'application/json' });
  }

  console.log('WhatsApp scheduler completed for', rows.length, 'salons');
}

export const config: Config = {
  schedule: '0 8 * * *',
};
