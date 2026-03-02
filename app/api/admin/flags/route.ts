import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest, getAdminDb } from '@/lib/adminAuth';

const auth = (req: NextRequest) => verifyAdminRequest(req.headers.get('authorization'));

export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = getAdminDb();
  const { data } = await db.from('admin_feature_flags').select('*').order('created_at');
  return NextResponse.json({ flags: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  if (!body.name) return NextResponse.json({ error: 'name required' }, { status: 400 });
  const db = getAdminDb();
  const id = `flag-${Date.now().toString(36)}`;
  const { error } = await db.from('admin_feature_flags').insert({
    id, name: body.name, description: body.description ?? '',
    enabled_for: body.enabled_for ?? 'all', enabled: body.enabled ?? true,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, id });
}

export async function PATCH(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, ...patch } = await req.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const db = getAdminDb();
  await db.from('admin_feature_flags').update(patch).eq('id', id);
  await db.from('admin_audit_log').insert({
    id: `al-${Date.now()}`,
    action: 'flag_toggled',
    target_tenant: '',
    details: { flag_id: id, ...patch },
  });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const db = getAdminDb();
  await db.from('admin_feature_flags').delete().eq('id', id);
  return NextResponse.json({ success: true });
}
