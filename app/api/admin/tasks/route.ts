import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest, getAdminDb } from '@/lib/adminAuth';

const auth = (req: NextRequest) => verifyAdminRequest(req.headers.get('authorization'));

export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = getAdminDb();
  const { searchParams } = new URL(req.url);
  const tenant_id = searchParams.get('tenant_id');
  const status = searchParams.get('status');

  let q = db.from('admin_tasks').select('*').order('due_date', { ascending: true, nullsFirst: false });
  if (tenant_id) q = q.eq('tenant_id', tenant_id);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tasks: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = getAdminDb();
  const body = await req.json();
  const { data, error } = await db.from('admin_tasks').insert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ task: data });
}

export async function PATCH(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = getAdminDb();
  const { id, ...patch } = await req.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const ALLOWED = ['title','description','due_date','assigned_to','status','priority','completed_at'];
  const safe: Record<string,unknown> = {};
  for (const k of ALLOWED) if (k in patch) safe[k] = patch[k];
  if (patch.status === 'done' && !safe.completed_at) safe.completed_at = new Date().toISOString();
  if (patch.status === 'open') safe.completed_at = null;
  const { error } = await db.from('admin_tasks').update(safe).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = getAdminDb();
  const { id } = await req.json();
  const { error } = await db.from('admin_tasks').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
