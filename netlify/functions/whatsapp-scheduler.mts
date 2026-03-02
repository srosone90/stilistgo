/**
 * Netlify Scheduled Function — WhatsApp Automation Engine
 * Runs every day at 08:00 UTC (09:00 Rome / CET, 10:00 CEST)
 *
 * Reads all salon_data with whatsapp enabled, then sends:
 *   - Appointment reminders (for tomorrow's appointments)
 *   - Birthday wishes (clients with birthday today)
 *   - Post-visit follow-up (completed appointments yesterday)
 *   - Loyalty milestone notifications
 */
import type { Config } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

// ─── Types (inline to avoid import issues in Netlify functions) ───────────────
interface WhatsAppConfig {
  enabled: boolean;
  phoneNumberId: string;
  accessToken: string;
  reminderTemplate: string;
  birthdayTemplate: string;
  postVisitTemplate: string;
  loyaltyTemplate: string;
  reminderEnabled: boolean;
  birthdayEnabled: boolean;
  postVisitEnabled: boolean;
  loyaltyEnabled: boolean;
  loyaltyMilestone: number;
}
interface Client { id: string; firstName: string; lastName: string; phone: string; birthDate: string; loyaltyPoints: number; }
interface Appointment { id: string; clientId: string; date: string; startTime: string; status: string; serviceIds: string[]; }
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
  id: string; type: string; clientId: string; clientName: string; phone: string;
  templateName: string; status: 'sent' | 'failed'; errorMsg?: string; sentAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
function tomorrowStr(): string {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}
function yesterdayStr(): string {
  const d = new Date(); d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function sendWhatsApp(phoneNumberId: string, accessToken: string, to: string, templateName: string, params: string[]): Promise<{ ok: boolean; error?: string }> {
  try {
    const phone = to.startsWith('+') ? to.replace(/\s/g, '') : `+${to.replace(/\s/g, '')}`;
    const components = params.length > 0 ? [{
      type: 'body',
      parameters: params.map(p => ({ type: 'text', text: p })),
    }] : [];

    const resp = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'template',
        template: { name: templateName, language: { code: 'it' }, components },
      }),
    });
    const data = await resp.json();
    if (!resp.ok) return { ok: false, error: data?.error?.message ?? `HTTP ${resp.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

function genId(): string {
  return `wa-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export default async function handler() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error('Missing Supabase env vars');
    return new Response('Missing env vars', { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // Fetch ALL salon_data rows (service key bypasses RLS)
  const { data: rows, error } = await supabase.from('salon_data').select('user_id, state');
  if (error) { console.error('Supabase fetch error:', error); return new Response('DB error', { status: 500 }); }

  const today = todayStr();
  const tomorrow = tomorrowStr();
  const yesterday = yesterdayStr();

  let totalSent = 0;
  let totalFailed = 0;

  for (const row of rows ?? []) {
    const state = row.state as SalonState;
    const wa = state?.salonConfig?.whatsapp;
    if (!wa?.enabled || !wa.phoneNumberId || !wa.accessToken) continue;

    const clients = state.clients ?? [];
    const appointments = state.appointments ?? [];
    const services = state.services ?? [];
    const salonName = state.salonConfig?.salonName ?? 'il salone';
    const newLogs: WhatsAppLogEntry[] = [];

    // ── 1. Appointment reminders (tomorrow) ───────────────────────────────
    if (wa.reminderEnabled) {
      const tomorrowApts = appointments.filter(a =>
        a.date === tomorrow && a.status !== 'cancelled' && a.status !== 'no-show'
      );
      for (const apt of tomorrowApts) {
        const client = clients.find(c => c.id === apt.clientId);
        if (!client?.phone) continue;
        const svcNames = apt.serviceIds.map(id => services.find(s => s.id === id)?.name ?? '').filter(Boolean).join(', ') || 'appuntamento';
        const firstName = client.firstName;
        const result = await sendWhatsApp(wa.phoneNumberId, wa.accessToken, client.phone, wa.reminderTemplate || 'appointment_reminder', [firstName, tomorrow, apt.startTime, salonName, svcNames]);
        newLogs.push({ id: genId(), type: 'reminder', clientId: client.id, clientName: `${client.firstName} ${client.lastName}`, phone: client.phone, templateName: wa.reminderTemplate || 'appointment_reminder', status: result.ok ? 'sent' : 'failed', errorMsg: result.error, sentAt: new Date().toISOString() });
        if (result.ok) totalSent++; else totalFailed++;
      }
    }

    // ── 2. Birthday wishes (today) ────────────────────────────────────────
    if (wa.birthdayEnabled) {
      const todayMMDD = today.slice(5); // "MM-DD"
      const birthdayClients = clients.filter(c => c.birthDate?.slice(5) === todayMMDD && c.phone);
      for (const client of birthdayClients) {
        const result = await sendWhatsApp(wa.phoneNumberId, wa.accessToken, client.phone, wa.birthdayTemplate || 'birthday_wishes', [client.firstName, salonName]);
        newLogs.push({ id: genId(), type: 'birthday', clientId: client.id, clientName: `${client.firstName} ${client.lastName}`, phone: client.phone, templateName: wa.birthdayTemplate || 'birthday_wishes', status: result.ok ? 'sent' : 'failed', errorMsg: result.error, sentAt: new Date().toISOString() });
        if (result.ok) totalSent++; else totalFailed++;
      }
    }

    // ── 3. Post-visit follow-up (yesterday completed) ─────────────────────
    if (wa.postVisitEnabled) {
      const completedYesterday = appointments.filter(a => a.date === yesterday && a.status === 'completed');
      // Deduplicate by client (only 1 message per client)
      const seen = new Set<string>();
      for (const apt of completedYesterday) {
        if (seen.has(apt.clientId)) continue;
        seen.add(apt.clientId);
        const client = clients.find(c => c.id === apt.clientId);
        if (!client?.phone) continue;
        const result = await sendWhatsApp(wa.phoneNumberId, wa.accessToken, client.phone, wa.postVisitTemplate || 'post_visit', [client.firstName, salonName]);
        newLogs.push({ id: genId(), type: 'post_visit', clientId: client.id, clientName: `${client.firstName} ${client.lastName}`, phone: client.phone, templateName: wa.postVisitTemplate || 'post_visit', status: result.ok ? 'sent' : 'failed', errorMsg: result.error, sentAt: new Date().toISOString() });
        if (result.ok) totalSent++; else totalFailed++;
      }
    }

    // ── 4. Loyalty milestone ──────────────────────────────────────────────
    if (wa.loyaltyEnabled && wa.loyaltyMilestone > 0) {
      // Find clients AT the milestone (within 0-5 points above, not already notified today)
      const existing = (state.whatsappMessages ?? []);
      const sentTodayIds = new Set(existing.filter(m => m.type === 'loyalty' && m.sentAt?.startsWith(today)).map(m => m.clientId));
      const milestone = wa.loyaltyMilestone;
      const loyaltyClients = clients.filter(c => c.phone && !sentTodayIds.has(c.id) && c.loyaltyPoints >= milestone && c.loyaltyPoints < milestone + 10);
      for (const client of loyaltyClients) {
        const result = await sendWhatsApp(wa.phoneNumberId, wa.accessToken, client.phone, wa.loyaltyTemplate || 'loyalty_reward', [client.firstName, String(client.loyaltyPoints), String(milestone), salonName]);
        newLogs.push({ id: genId(), type: 'loyalty', clientId: client.id, clientName: `${client.firstName} ${client.lastName}`, phone: client.phone, templateName: wa.loyaltyTemplate || 'loyalty_reward', status: result.ok ? 'sent' : 'failed', errorMsg: result.error, sentAt: new Date().toISOString() });
        if (result.ok) totalSent++; else totalFailed++;
      }
    }

    // ── Save new log entries back to salon_data ────────────────────────────
    if (newLogs.length > 0) {
      const allLogs = [...(state.whatsappMessages ?? []), ...newLogs].slice(-200); // keep last 200
      await supabase.from('salon_data').update({ state: { ...state, whatsappMessages: allLogs } }).eq('user_id', row.user_id);
    }
  }

  console.log(`WhatsApp scheduler done: ${totalSent} sent, ${totalFailed} failed`);
  return new Response(`OK: ${totalSent} sent, ${totalFailed} failed`);
}

export const config: Config = {
  schedule: '0 8 * * *', // every day at 08:00 UTC
};
