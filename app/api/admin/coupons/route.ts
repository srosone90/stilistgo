import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest, getAdminDb } from '@/lib/adminAuth';

const auth = (req: NextRequest) => verifyAdminRequest(req.headers.get('authorization'));

export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = getAdminDb();
  const { data, error } = await db
    .from('admin_coupons')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ coupons: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = getAdminDb();
  const body = await req.json();
  const { data, error } = await db.from('admin_coupons').insert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ coupon: data });
}

export async function PATCH(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = getAdminDb();
  const { id, ...patch } = await req.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const ALLOWED = ['description','discount_pct','discount_eur','applies_to','max_uses','expires_at','active'];
  const safe: Record<string,unknown> = {};
  for (const k of ALLOWED) if (k in patch) safe[k] = patch[k];
  const { error } = await db.from('admin_coupons').update(safe).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = getAdminDb();
  const { id } = await req.json();
  const { error } = await db.from('admin_coupons').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
