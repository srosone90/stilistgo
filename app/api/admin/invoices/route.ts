import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest, getAdminDb } from '@/lib/adminAuth';

const auth = (req: NextRequest) => verifyAdminRequest(req.headers.get('authorization'));

export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = getAdminDb();
  const { searchParams } = new URL(req.url);
  const tenant_id = searchParams.get('tenant_id');

  let q = db.from('admin_invoices').select('*').order('created_at', { ascending: false });
  if (tenant_id) q = q.eq('tenant_id', tenant_id);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invoices: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = getAdminDb();
  const body = await req.json();

  // Auto-generate invoice number: YYYY-NNN
  const year = new Date().getFullYear();
  const { count } = await db.from('admin_invoices').select('*', { count: 'exact', head: true });
  const seq = String((count ?? 0) + 1).padStart(3, '0');
  const number = `${year}-${seq}`;

  const { data, error } = await db.from('admin_invoices').insert({ ...body, number }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invoice: data });
}

export async function PATCH(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = getAdminDb();
  const { id, ...patch } = await req.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const ALLOWED = ['status', 'notes', 'paid_at', 'amount'];
  const safe: Record<string, unknown> = {};
  for (const k of ALLOWED) if (k in patch) safe[k] = patch[k];
  if (patch.status === 'paid' && !safe.paid_at) safe.paid_at = new Date().toISOString();

  const { error } = await db.from('admin_invoices').update(safe).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = getAdminDb();
  const { id } = await req.json();
  const { error } = await db.from('admin_invoices').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
