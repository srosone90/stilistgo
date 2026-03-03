import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest, getAdminDb } from '@/lib/adminAuth';

type PaymentItem = { name: string; price: number };
type Payment = {
  date: string; total: number; paymentMethod: string;
  cashAmount: number; cardAmount: number; giftCardAmount: number;
  items: PaymentItem[];
};
type GiftCard = { id: string; isActive: boolean; remainingValue: number };
type SalonState = { payments?: Payment[]; giftCards?: GiftCard[] };

export async function GET(req: NextRequest) {
  if (!verifyAdminRequest(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = req.nextUrl.searchParams.get('user_id');
  if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 });

  const db = getAdminDb();
  const { data: salonRow } = await db.from('salon_data').select('state').eq('user_id', userId).single();
  if (!salonRow?.state) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const state = salonRow.state as SalonState;
  const payments = state.payments ?? [];
  const giftCards = state.giftCards ?? [];

  // Monthly revenue — last 12 months
  const now = new Date();
  const monthlyRevenue: Record<string, number> = {};
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyRevenue[key] = 0;
  }
  for (const p of payments) {
    if (!p.date || p.total <= 0) continue;
    const key = p.date.slice(0, 7);
    if (key in monthlyRevenue) monthlyRevenue[key] += p.total;
  }

  // Top services
  const serviceMap: Record<string, { count: number; revenue: number }> = {};
  for (const p of payments) {
    if (p.total <= 0) continue;
    for (const item of p.items ?? []) {
      if (!item.name) continue;
      if (!serviceMap[item.name]) serviceMap[item.name] = { count: 0, revenue: 0 };
      serviceMap[item.name].count++;
      serviceMap[item.name].revenue += item.price ?? 0;
    }
  }
  const topServices = Object.entries(serviceMap)
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // Payment breakdown
  const methodMap: Record<string, number> = {};
  for (const p of payments) {
    if (p.total <= 0) continue;
    methodMap[p.paymentMethod ?? 'cash'] = (methodMap[p.paymentMethod ?? 'cash'] ?? 0) + p.total;
  }
  const paymentBreakdown = Object.entries(methodMap).map(([method, total]) => ({ method, total }));

  // Total revenue (positive payments only)
  const totalRevenue = payments.filter(p => p.total > 0).reduce((s, p) => s + p.total, 0);

  // Gift cards
  const giftCardsCount = giftCards.length;
  const giftCardsActive = giftCards.filter(g => g.isActive).length;

  // Online bookings (last 30 days + pending)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const [{ count: bookings30d }, { count: pendingBookings }] = await Promise.all([
    db.from('online_bookings').select('id', { count: 'exact', head: true })
      .eq('salon_id', userId).gte('created_at', thirtyDaysAgo),
    db.from('online_bookings').select('id', { count: 'exact', head: true })
      .eq('salon_id', userId).eq('status', 'pending'),
  ]);

  return NextResponse.json({
    monthlyRevenue: Object.entries(monthlyRevenue).map(([month, total]) => ({ month, total })),
    topServices,
    paymentBreakdown,
    totalRevenue,
    giftCardsCount,
    giftCardsActive,
    onlineBookings30d: bookings30d ?? 0,
    onlineBookingsPending: pendingBookings ?? 0,
  });
}
