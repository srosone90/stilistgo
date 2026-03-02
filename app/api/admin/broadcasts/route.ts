import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest, getAdminDb } from '@/lib/adminAuth';

const auth = (req: NextRequest) => verifyAdminRequest(req.headers.get('authorization'));

export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = getAdminDb();
  const { data } = await db.from('admin_broadcasts').select('*').order('created_at', { ascending: false });
  return NextResponse.json({ broadcasts: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  if (!body.title || !body.body) return NextResponse.json({ error: 'title e body required' }, { status: 400 });
  const db = getAdminDb();
  const id = `bc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const { error } = await db.from('admin_broadcasts').insert({
    id,
    title: body.title,
    body: body.body,
    target: body.target ?? 'all',
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await db.from('admin_audit_log').insert({
    id: `al-${Date.now()}`,
    action: 'broadcast_sent',
    target_tenant: '',
    details: { title: body.title, target: body.target ?? 'all' },
  });
  return NextResponse.json({ success: true, id });
}

export async function DELETE(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const db = getAdminDb();
  await db.from('admin_broadcasts').delete().eq('id', id);
  return NextResponse.json({ success: true });
}
