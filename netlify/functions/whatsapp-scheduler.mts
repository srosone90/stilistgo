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

// ─── Main ────────────────────────────────────────────────────────────────────
export default async function handler() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: rows, error } = await supabase.from('salon_data').select('user_id, data');
  if (error || !rows) {
    console.error('Scheduler: cannot fetch salon_data', error);
    return;
  }

  const today     = todayStr();
  const tomorrow  = tomorrowStr();
  const yesterday = yesterdayStr();
  const mmdd      = todayMMDD();

  for (const row of rows) {
    const state = (row.data ?? {}) as SalonState;
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
        const msg = `Ciao ${client.firstName}! 😊 Ti ricordiamo il tuo appuntamento di *${svcNames}* domani alle ${apt.startTime} da ${salonName}. A presto!`;
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
        const msg = `Tanti auguri ${client.firstName}! 🎂🎉 Tutto il team di ${salonName} ti augura una splendida giornata!`;
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
        const msg = `Ciao ${client.firstName}! Speriamo tu sia soddisfatta della tua visita da ${salonName}. ⭐ Ci fa sempre piacere sapere come stai!`;
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
        const msg = `Complimenti ${client.firstName}! 🌟 Hai raggiunto ${client.loyaltyPoints} punti fedeltà da ${salonName}. Contattaci per scoprire il tuo premio!`;
        const sent = await sendUltraMsg(instanceId, token, client.phone, msg);
        log.push({ id: crypto.randomUUID(), type: 'loyalty', clientId: client.id, clientName: `${client.firstName} ${client.lastName}`, phone: client.phone, templateName: 'loyalty', status: sent ? 'sent' : 'failed', sentAt: new Date().toISOString() });
        alreadySent.add(key);
      }
    }

    // Save updated log (last 200)
    const updatedData = { ...state, whatsappMessages: log.slice(-200) };
    await supabase.from('salon_data').update({ data: updatedData }).eq('user_id', row.user_id);
  }

  console.log('WhatsApp scheduler completed for', rows.length, 'salons');
}

export const config: Config = {
  schedule: '0 8 * * *',
};
