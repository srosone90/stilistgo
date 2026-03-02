import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest, getAdminDb } from '@/lib/adminAuth';

const auth = (req: NextRequest) => verifyAdminRequest(req.headers.get('authorization'));

export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = getAdminDb();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  let q = db.from('admin_tickets').select('*').order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  const { data } = await q;
  return NextResponse.json({ tickets: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  if (!body.subject) return NextResponse.json({ error: 'subject required' }, { status: 400 });
  const db = getAdminDb();
  const id = `tk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const { error } = await db.from('admin_tickets').insert({
    id,
    tenant_id: body.tenant_id ?? '',
    tenant_name: body.tenant_name ?? '',
    subject: body.subject,
    body: body.body ?? '',
    category: body.category ?? 'domanda',
    priority: body.priority ?? 'normale',
    status: 'aperto',
    assigned_to: body.assigned_to ?? '',
    resolution: '',
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await db.from('admin_audit_log').insert({
    id: `al-${Date.now()}`,
    action: 'ticket_created',
    target_tenant: body.tenant_id ?? '',
    details: { subject: body.subject, category: body.category },
  });
  return NextResponse.json({ success: true, id });
}

export async function PATCH(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, ...patch } = await req.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const db = getAdminDb();
  await db.from('admin_tickets').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const db = getAdminDb();
  await db.from('admin_tickets').delete().eq('id', id);
  return NextResponse.json({ success: true });
}
