import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest, getAdminDb } from '@/lib/adminAuth';

const auth = (req: NextRequest) => verifyAdminRequest(req.headers.get('authorization'));

/** GET /api/admin/reports?type=csv|summary&month=YYYY-MM */
export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = getAdminDb();
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') ?? 'summary';
  const month = searchParams.get('month') ?? new Date().toISOString().slice(0, 7);

  const { data: tenants } = await db.from('admin_tenants')
    .select('user_id,email,full_name,salon_name,plan,monthly_price,status,registered_at');
  const { data: invoices } = await db.from('admin_invoices')
    .select('*').gte('created_at', `${month}-01`).lt('created_at', nextMonth(month));
  const { data: payments } = await db.from('admin_payments_received')
    .select('*').gte('date', `${month}-01`).lt('date', nextMonth(month));

  const t = (tenants ?? []) as {user_id:string;email:string;full_name:string;salon_name:string;plan:string;monthly_price:number;status:string;registered_at:string}[];
  const inv = (invoices ?? []) as {id:string;tenant_id:string;number:string;amount:number;status:string;plan:string;period_start:string;period_end:string;created_at:string}[];
  const pay = (payments ?? []) as {id:string;tenant_id:string;invoice_id:string;amount:number;method:string;date:string;reference:string}[];

  if (type === 'csv') {
    const rows = inv.map(i => {
      const tenant = t.find(t => t.user_id === i.tenant_id);
      return [
        i.number,
        tenant?.salon_name ?? '',
        tenant?.email ?? '',
        i.plan,
        i.amount,
        i.status,
        i.period_start,
        i.period_end,
        i.created_at.slice(0, 10),
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });
    const csv = ['Numero,Salone,Email,Piano,Importo,Stato,Dal,Al,Data', ...rows].join('\n');
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="fatture-${month}.csv"`,
      },
    });
  }

  // Summary
  const activeTenants = t.filter(x => x.status === 'active').length;
  const trialTenants = t.filter(x => x.status === 'trial').length;
  const mrr = t.filter(x => x.status === 'active').reduce((s, x) => s + (x.monthly_price ?? 0), 0);
  const invoicedTotal = inv.reduce((s, i) => s + i.amount, 0);
  const paidTotal = pay.reduce((s, p) => s + p.amount, 0);
  const pendingTotal = inv.filter(i => i.status === 'pending').reduce((s, i) => s + i.amount, 0);
  const overdueTotal = inv.filter(i => i.status === 'overdue').reduce((s, i) => s + i.amount, 0);

  return NextResponse.json({
    month,
    activeTenants,
    trialTenants,
    mrr,
    arr: mrr * 12,
    invoicedTotal,
    paidTotal,
    pendingTotal,
    overdueTotal,
    invoiceCount: inv.length,
    paymentCount: pay.length,
  });
}

function nextMonth(m: string): string {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo, 1); // first day of next month
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
