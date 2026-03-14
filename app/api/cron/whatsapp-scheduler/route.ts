/**
 * Vercel Cron Job — WhatsApp Automation Engine (Evolution API / Railway)
 * Schedule defined in vercel.json: every day at 08:00 UTC (09:00 CET / 10:00 CEST)
 *
 * Secured by CRON_SECRET env var — Vercel sends it as Authorization: Bearer <secret>
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ─── Types ────────────────────────────────────────────────────────────────────
interface WhatsAppConfig {
  enabled: boolean;
  reminderEnabled: boolean;
  birthdayEnabled: boolean;
  postVisitEnabled: boolean;
  loyaltyEnabled: boolean;
  loyaltyMilestone: number;
  dormantEnabled?: boolean;
  dormantMsg?: string;
  visitFreqReminderEnabled?: boolean;
  visitFreqReminderMsg?: string;
  reminderMsg?: string;
  birthdayMsg?: string;
  postVisitMsg?: string;
  loyaltyMsg?: string;
}
interface Client {
  id: string; firstName: string; lastName: string;
  phone: string; birthDate: string; loyaltyPoints: number;
  visitFrequency?: string; lastVisitDate?: string;
}
interface Appointment {
  id: string; clientId: string; date: string;
  startTime: string; status: string; serviceIds: string[];
}
interface Service { id: string; name: string; }
interface Payment { id: string; clientId: string; date: string; total: number; }
interface SalonConfig { salonName: string; whatsapp?: WhatsAppConfig; dormientiDays?: number; }
interface SalonState {
  salonConfig?: SalonConfig;
  clients?: Client[];
  appointments?: Appointment[];
  services?: Service[];
  payments?: Payment[];
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

function renderTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce((msg, [k, v]) => msg.split(`{${k}}`).join(v), template);
}

const DEFAULT_REMINDER_MSG  = 'Ciao {nome}! 😊 Ti ricordiamo il tuo appuntamento di *{servizio}* domani alle {ora} da {salone}. A presto!';
const DEFAULT_BIRTHDAY_MSG  = 'Tanti auguri {nome}! 🎂🎉 Tutto il team di {salone} ti augura una splendida giornata!';
const DEFAULT_POSTVISIT_MSG = 'Ciao {nome}! Speriamo tu sia soddisfatta della tua visita da {salone}. ⭐ Ci fa sempre piacere sapere come stai!';
const DEFAULT_LOYALTY_MSG   = 'Complimenti {nome}! 🌟 Hai raggiunto {punti} punti fedeltà da {salone}. Contattaci per scoprire il tuo premio!';
const DEFAULT_DORMANT_MSG   = 'Ciao {nome}! 😊 Sono passati {giorni} giorni dalla tua ultima visita da {salone}. Ci manchi! Ti aspettiamo quando vuoi 💇';
const DEFAULT_VISITFREQ_MSG = 'Ciao {nome}! 💇 È il momento del tuo appuntamento {frequenza} da {salone}. Prenota quando vuoi, ti aspettiamo!';

const VISIT_FREQ_DAYS: Record<string, number> = {
  settimanale: 8, frequente: 21, mensile: 31, regolare: 45, occasionale: 90,
};

function getEffectiveLastVisitDate(client: Client, apts: Appointment[], payments: Payment[]): string | null {
  const payDates = payments.filter(p => p.clientId === client.id).map(p => p.date);
  const aptDates = apts.filter(a => a.clientId === client.id && a.status !== 'cancelled').map(a => a.date);
  const all = [...payDates, ...aptDates].filter(Boolean).sort((a, b) => b.localeCompare(a));
  return all[0] ?? client.lastVisitDate ?? null;
}

function sentWithinDays(log: WhatsAppLogEntry[], type: string, clientId: string, days: number): boolean {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString();
  return log.some(m => m.type === type && m.clientId === clientId && m.sentAt >= cutoffStr);
}

async function sendViaEvolution(instanceName: string, to: string, message: string): Promise<boolean> {
  const base = (process.env.EVOLUTION_API_URL ?? '').replace(/\/$/, '');
  const apiKey = process.env.EVOLUTION_API_KEY ?? '';
  if (!base || !apiKey) return false;
  const number = to.replace(/\D/g, '');
  if (!number) return false;
  try {
    const res = await fetch(`${base}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
      body: JSON.stringify({ number, text: message }),
    });
    if (!res.ok) { console.warn('[Scheduler] invio fallito per', number, '→ status', res.status); return false; }
    return true;
  } catch (err) {
    console.error('[Scheduler] errore di rete per', number, ':', err);
    return false;
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  // Vercel injects Authorization: Bearer <CRON_SECRET> automatically for cron requests.
  // Reject any call that doesn't carry the correct secret.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Supabase env vars mancanti' }, { status: 500 });
  }
  if (!process.env.EVOLUTION_API_URL || !process.env.EVOLUTION_API_KEY) {
    return NextResponse.json({ error: 'Evolution API env vars mancanti' }, { status: 500 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL.trim(),
    process.env.SUPABASE_SERVICE_ROLE_KEY.trim(),
  );

  const { data: rows, error } = await supabase
    .from('salon_data')
    .select('user_id, state')
    .order('updated_at', { ascending: false });

  if (error || !rows) {
    console.error('[Scheduler] cannot read salon_data:', error);
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }

  const { data: tenants } = await supabase
    .from('admin_tenants')
    .select('user_id, whatsapp_connected');

  const connectedSalons = new Set<string>(
    (tenants ?? []).filter(t => t.whatsapp_connected).map(t => t.user_id as string),
  );

  const today     = todayStr();
  const tomorrow  = tomorrowStr();
  const yesterday = yesterdayStr();
  const mmdd      = todayMMDD();

  let totalSent = 0;
  let totalFailed = 0;

  for (const row of rows) {
    const userId = row.user_id as string;
    let state: SalonState = {};
    try { state = (row.state as SalonState) ?? {}; } catch { continue; }

    const wa = state.salonConfig?.whatsapp;
    if (!wa?.enabled) continue;
    if (!connectedSalons.has(userId)) continue;

    const instanceName = userId.replace(/-/g, '_');
    const salonName = state.salonConfig?.salonName ?? 'il salone';
    const clients  = state.clients ?? [];
    const apts     = state.appointments ?? [];
    const services = state.services ?? [];
    const payments = state.payments ?? [];
    const log: WhatsAppLogEntry[] = [...(state.whatsappMessages ?? [])];

    const alreadySent = new Set(log.filter(m => m.sentAt.startsWith(today)).map(m => `${m.type}:${m.clientId}`));

    // ── Promemoria appuntamento ──
    if (wa.reminderEnabled) {
      for (const apt of apts.filter(a => a.date === tomorrow && a.status !== 'cancelled')) {
        const client = clients.find(c => c.id === apt.clientId);
        if (!client?.phone) continue;
        const key = `reminder:${client.id}`;
        if (alreadySent.has(key)) continue;
        const svcNames = services.filter(s => (apt.serviceIds ?? []).includes(s.id)).map(s => s.name).join(', ') || 'appuntamento';
        const msg = renderTemplate(wa.reminderMsg ?? DEFAULT_REMINDER_MSG, { nome: client.firstName, servizio: svcNames, ora: apt.startTime, salone: salonName });
        const sent = await sendViaEvolution(instanceName, client.phone, msg);
        log.push({ id: crypto.randomUUID(), type: 'reminder', clientId: client.id, clientName: `${client.firstName} ${client.lastName}`, phone: client.phone, templateName: 'reminder', status: sent ? 'sent' : 'failed', sentAt: new Date().toISOString() });
        alreadySent.add(key);
        sent ? totalSent++ : totalFailed++;
      }
    }

    // ── Auguri compleanno ──
    if (wa.birthdayEnabled) {
      for (const client of clients.filter(c => c.birthDate?.slice(5) === mmdd && c.phone)) {
        const key = `birthday:${client.id}`;
        if (alreadySent.has(key)) continue;
        const msg = renderTemplate(wa.birthdayMsg ?? DEFAULT_BIRTHDAY_MSG, { nome: client.firstName, salone: salonName });
        const sent = await sendViaEvolution(instanceName, client.phone, msg);
        log.push({ id: crypto.randomUUID(), type: 'birthday', clientId: client.id, clientName: `${client.firstName} ${client.lastName}`, phone: client.phone, templateName: 'birthday', status: sent ? 'sent' : 'failed', sentAt: new Date().toISOString() });
        alreadySent.add(key);
        sent ? totalSent++ : totalFailed++;
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
        const sent = await sendViaEvolution(instanceName, client.phone, msg);
        log.push({ id: crypto.randomUUID(), type: 'post_visit', clientId: client.id, clientName: `${client.firstName} ${client.lastName}`, phone: client.phone, templateName: 'post_visit', status: sent ? 'sent' : 'failed', sentAt: new Date().toISOString() });
        alreadySent.add(key);
        sent ? totalSent++ : totalFailed++;
      }
    }

    // ── Fedeltà milestone ──
    if (wa.loyaltyEnabled && wa.loyaltyMilestone) {
      const milestone = wa.loyaltyMilestone;
      for (const client of clients.filter(c => c.loyaltyPoints >= milestone && c.phone)) {
        const tier = Math.floor(client.loyaltyPoints / milestone);
        const milestoneKey = `loyalty_tier${tier}:${client.id}`;
        if (log.some(m => m.type === 'loyalty' && `loyalty_tier${tier}:${m.clientId}` === milestoneKey)) continue;
        const msg = renderTemplate(wa.loyaltyMsg ?? DEFAULT_LOYALTY_MSG, { nome: client.firstName, punti: String(client.loyaltyPoints), salone: salonName });
        const sent = await sendViaEvolution(instanceName, client.phone, msg);
        log.push({ id: crypto.randomUUID(), type: 'loyalty', clientId: client.id, clientName: `${client.firstName} ${client.lastName}`, phone: client.phone, templateName: 'loyalty', status: sent ? 'sent' : 'failed', sentAt: new Date().toISOString() });
        sent ? totalSent++ : totalFailed++;
      }
    }

    // ── Clienti dormienti ──
    if (wa.dormantEnabled) {
      const dormientiDays = state.salonConfig?.dormientiDays ?? 60;
      for (const client of clients.filter(c => c.phone)) {
        const key = `dormant:${client.id}`;
        if (alreadySent.has(key)) continue;
        const lastVisit = getEffectiveLastVisitDate(client, apts, payments);
        if (!lastVisit) continue;
        const daysSince = Math.floor((Date.now() - new Date(lastVisit).getTime()) / 86400000);
        if (daysSince < dormientiDays) continue;
        if (sentWithinDays(log, 'dormant', client.id, 30)) continue;
        const msg = renderTemplate(wa.dormantMsg ?? DEFAULT_DORMANT_MSG, { nome: client.firstName, giorni: String(daysSince), salone: salonName });
        const sent = await sendViaEvolution(instanceName, client.phone, msg);
        log.push({ id: crypto.randomUUID(), type: 'dormant', clientId: client.id, clientName: `${client.firstName} ${client.lastName}`, phone: client.phone, templateName: 'dormant', status: sent ? 'sent' : 'failed', sentAt: new Date().toISOString() });
        alreadySent.add(key);
        sent ? totalSent++ : totalFailed++;
      }
    }

    // ── Promemoria frequenza visita ──
    if (wa.visitFreqReminderEnabled) {
      for (const client of clients.filter(c => c.phone && c.visitFrequency && VISIT_FREQ_DAYS[c.visitFrequency!])) {
        const key = `visitfreq:${client.id}`;
        if (alreadySent.has(key)) continue;
        const lastVisit = getEffectiveLastVisitDate(client, apts, payments);
        if (!lastVisit) continue;
        const freqDays = VISIT_FREQ_DAYS[client.visitFrequency!]!;
        const daysSince = Math.floor((Date.now() - new Date(lastVisit).getTime()) / 86400000);
        if (daysSince < freqDays) continue;
        if (sentWithinDays(log, 'visitfreq', client.id, Math.max(freqDays - 2, 1))) continue;
        const msg = renderTemplate(wa.visitFreqReminderMsg ?? DEFAULT_VISITFREQ_MSG, { nome: client.firstName, frequenza: client.visitFrequency!, giorni: String(daysSince), salone: salonName });
        const sent = await sendViaEvolution(instanceName, client.phone, msg);
        log.push({ id: crypto.randomUUID(), type: 'visitfreq', clientId: client.id, clientName: `${client.firstName} ${client.lastName}`, phone: client.phone, templateName: 'visitfreq', status: sent ? 'sent' : 'failed', sentAt: new Date().toISOString() });
        alreadySent.add(key);
        sent ? totalSent++ : totalFailed++;
      }
    }

    // Salva log aggiornato (ultimi 200 messaggi)
    const updatedState = { ...state, whatsappMessages: log.slice(-200) };
    const { error: saveErr } = await supabase
      .from('salon_data')
      .upsert({ user_id: userId, state: updatedState, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (saveErr) console.error(`[Scheduler] Errore salvataggio log per ${userId}:`, saveErr);
  }

  console.log(`[Scheduler] ✅ Completato — ✅ ${totalSent} inviati, ❌ ${totalFailed} falliti`);
  return NextResponse.json({ ok: true, sent: totalSent, failed: totalFailed });
}
