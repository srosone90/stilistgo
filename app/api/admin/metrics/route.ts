import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest, getAdminDb } from '@/lib/adminAuth';

export async function GET(req: NextRequest) {
  if (!verifyAdminRequest(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const db = getAdminDb();

  const [{ data: tenants }, { data: tickets }, { data: broadcasts }] = await Promise.all([
    db.from('admin_tenants').select('status,plan,monthly_price,registered_at,last_seen_at,trial_ends_at'),
    db.from('admin_tickets').select('status,priority,created_at'),
    db.from('admin_broadcasts').select('created_at'),
  ]);

  const t = tenants ?? [];
  const tk = tickets ?? [];

  const total = t.length;
  const active = t.filter((x: {status:string}) => x.status === 'active').length;
  const trial = t.filter((x: {status:string}) => x.status === 'trial').length;
  const suspended = t.filter((x: {status:string}) => x.status === 'suspended').length;
  const cancelled = t.filter((x: {status:string}) => x.status === 'cancelled').length;
  const mrr = t.filter((x: {status:string}) => x.status === 'active')
    .reduce((sum: number, x: {monthly_price:number}) => sum + (x.monthly_price ?? 0), 0);

  // Tenants by plan
  const byPlan: Record<string, number> = {};
  for (const x of t as {plan:string}[]) {
    byPlan[x.plan] = (byPlan[x.plan] ?? 0) + 1;
  }

  // Registrations per month (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const regByMonth: Record<string, number> = {};
  for (const x of t as {registered_at:string}[]) {
    if (!x.registered_at) continue;
    const d = new Date(x.registered_at);
    if (d < sixMonthsAgo) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    regByMonth[key] = (regByMonth[key] ?? 0) + 1;
  }

  // At-risk: trial expiring in ≤3 days, or no activity in 14 days
  const now = Date.now();
  const atRisk = (t as {status:string;trial_ends_at:string|null;last_seen_at:string|null}[]).filter(x => {
    if (x.status === 'cancelled') return false;
    if (x.trial_ends_at) {
      const diff = new Date(x.trial_ends_at).getTime() - now;
      if (diff > 0 && diff < 3 * 86400000) return true;
    }
    if (x.last_seen_at) {
      const diff = now - new Date(x.last_seen_at).getTime();
      if (diff > 14 * 86400000) return true;
    }
    return false;
  }).length;

  // Tickets
  const openTickets = tk.filter((x: {status:string}) => x.status === 'aperto' || x.status === 'in_lavorazione').length;
  const urgentTickets = tk.filter((x: {status:string;priority:string}) => x.priority === 'urgente' && x.status !== 'risolto' && x.status !== 'chiuso').length;

  return NextResponse.json({
    total, active, trial, suspended, cancelled,
    mrr, arr: mrr * 12,
    byPlan, regByMonth, atRisk,
    openTickets, urgentTickets,
    broadcasts: (broadcasts ?? []).length,
  });
}
