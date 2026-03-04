/**
 * POST /api/admin/cleanup
 * Eseguita dal cron job (GitHub Actions o cron Supabase).
 * Protetto da Bearer token admin oppure da CRON_SECRET header.
 *
 * Body JSON: {
 *   inactiveClientMonths?: number   // default 24
 *   securityEventDays?: number      // default 180
 * }
 *
 * Risponde: { deletedEvents: number, processedSalons: number, totalClientsRemoved: number }
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/adminAuth';
import { getAdminDb } from '@/lib/adminAuth';

function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = req.headers.get('x-cron-secret');
    if (header === secret) return true;
  }
  return verifyAdminRequest(req.headers.get('authorization'));
}

export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const inactiveMonths: number = Number(body.inactiveClientMonths ?? 24);
  const eventDays: number = Number(body.securityEventDays ?? 180);

  const db = getAdminDb();
  const results = { deletedEvents: 0, processedSalons: 0, totalClientsRemoved: 0 };

  // ── 1. Pulizia security_events ──────────────────────────────────────────
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - eventDays);
    const { data: evDel } = await db
      .from('security_events')
      .delete()
      .lt('created_at', cutoff.toISOString())
      .select('id');
    results.deletedEvents = evDel?.length ?? 0;
  } catch {
    // non-blocking
  }

  // ── 2. Pulizia clienti inattivi da salon_data.state ─────────────────────
  // Legge tutti i saloni, rimuove i clienti senza appuntamenti negli ultimi N mesi
  try {
    const { data: salons } = await db
      .from('salon_data')
      .select('user_id, state');

    if (salons) {
      for (const salon of salons) {
        try {
          const state = salon.state as Record<string, unknown>;
          const clients = (state.clients as { id: string; createdAt: string }[]) ?? [];
          const appointments = (state.appointments as { clientId: string; date: string }[]) ?? [];

          const cutoffDate = new Date();
          cutoffDate.setMonth(cutoffDate.getMonth() - inactiveMonths);

          // Trova clienti con almeno un appuntamento recente
          const activeClientIds = new Set(
            appointments
              .filter(a => a.date && new Date(a.date) >= cutoffDate)
              .map(a => a.clientId)
          );

          const originalCount = clients.length;
          const activeClients = clients.filter(c => {
            // Mantieni il cliente se: ha appuntamento recente O è stato creato recentemente
            if (activeClientIds.has(c.id)) return true;
            if (c.createdAt && new Date(c.createdAt) >= cutoffDate) return true;
            return false;
          });

          const removed = originalCount - activeClients.length;
          if (removed > 0) {
            await db
              .from('salon_data')
              .update({ state: { ...state, clients: activeClients } })
              .eq('user_id', salon.user_id);
            results.totalClientsRemoved += removed;
          }
          results.processedSalons++;
        } catch {
          // salta il salone con errore
        }
      }
    }
  } catch {
    // non-blocking
  }

  return NextResponse.json(results);
}

// GET per health-check del cron
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ ok: true, ts: new Date().toISOString() });
}
