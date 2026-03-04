import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest, getAdminDb } from '@/lib/adminAuth';

const auth = (req: NextRequest) => verifyAdminRequest(req.headers.get('authorization'));

export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = getAdminDb();

  const { data: tenants } = await db
    .from('admin_tenants')
    .select('user_id,status,plan,monthly_price,registered_at,last_seen_at,trial_ends_at');

  const t = (tenants ?? []) as {
    user_id: string; status: string; plan: string; monthly_price: number;
    registered_at: string; last_seen_at: string | null; trial_ends_at: string | null;
  }[];

  const now = Date.now();

  // ── MRR Movement (last 12 months) ──────────────────────────────────────────
  const months: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const mrrByMonth = months.map(m => {
    const active = t.filter(x => {
      const reg = x.registered_at ? x.registered_at.slice(0, 7) : '';
      return x.status === 'active' && reg <= m;
    });
    const mrr = active.reduce((s, x) => s + (x.monthly_price ?? 0), 0);
    return { month: m, mrr };
  });

  // ── Churn ──────────────────────────────────────────────────────────────────
  const totalActive = t.filter(x => x.status === 'active').length;
  const totalCancelled = t.filter(x => x.status === 'cancelled').length;
  const churnRate = totalActive + totalCancelled > 0
    ? Math.round((totalCancelled / (totalActive + totalCancelled)) * 100)
    : 0;

  // ── Trial conversion ───────────────────────────────────────────────────────
  const totalTrialEver = t.filter(x => x.plan !== 'trial' || x.status !== 'trial').length + t.filter(x => x.plan === 'trial' && x.status === 'trial').length;
  const converted = t.filter(x => x.plan !== 'trial' || x.status === 'active').length;
  const conversionRate = totalTrialEver > 0 ? Math.round((converted / totalTrialEver) * 100) : 0;

  // ── LTV ────────────────────────────────────────────────────────────────────
  const paying = t.filter(x => x.status === 'active' && x.monthly_price > 0);
  const avgMrr = paying.length > 0 ? paying.reduce((s, x) => s + x.monthly_price, 0) / paying.length : 0;
  const avgLtvMonths = 24; // assume avg 24 month lifespan
  const avgLtv = Math.round(avgMrr * avgLtvMonths);

  // ── Cohort (last 6 months of registrations, % still active) ───────────────
  const sixAgo = new Date(); sixAgo.setMonth(sixAgo.getMonth() - 6);
  const cohorts = months.slice(6).map(m => {
    const registered = t.filter(x => x.registered_at?.slice(0, 7) === m);
    const stillActive = registered.filter(x => x.status === 'active' || x.status === 'trial').length;
    const rate = registered.length > 0 ? Math.round((stillActive / registered.length) * 100) : 0;
    return { month: m, registered: registered.length, active: stillActive, rate };
  });

  // ── At-risk upcoming ───────────────────────────────────────────────────────
  const trialExpiringSoon = t.filter(x => {
    if (!x.trial_ends_at) return false;
    const diff = new Date(x.trial_ends_at).getTime() - now;
    return diff > 0 && diff < 7 * 86400000;
  }).length;

  const inactiveSince30 = t.filter(x => {
    if (!x.last_seen_at) return false;
    return now - new Date(x.last_seen_at).getTime() > 30 * 86400000 && x.status !== 'cancelled';
  }).length;

  // ── Revenue forecast next 3 months (linear extrapolation) ─────────────────
  const last3Mrr = mrrByMonth.slice(-3).map(x => x.mrr);
  const avgGrowth = last3Mrr.length >= 2
    ? (last3Mrr[last3Mrr.length - 1] - last3Mrr[0]) / (last3Mrr.length - 1)
    : 0;
  const lastMrr = last3Mrr[last3Mrr.length - 1] ?? 0;
  const forecast = [1, 2, 3].map(n => {
    const d = new Date(); d.setMonth(d.getMonth() + n);
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return { month: m, mrr: Math.max(0, Math.round(lastMrr + avgGrowth * n)) };
  });

  return NextResponse.json({
    mrrByMonth,
    churnRate,
    conversionRate,
    avgLtv,
    avgMrr: Math.round(avgMrr),
    cohorts,
    trialExpiringSoon,
    inactiveSince30,
    forecast,
    totals: {
      active: totalActive,
      trial: t.filter(x => x.status === 'trial').length,
      cancelled: totalCancelled,
      suspended: t.filter(x => x.status === 'suspended').length,
    },
  });
}
