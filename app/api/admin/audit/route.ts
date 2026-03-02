import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest, getAdminDb } from '@/lib/adminAuth';

const auth = (req: NextRequest) => verifyAdminRequest(req.headers.get('authorization'));

export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = getAdminDb();
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get('limit') ?? '50');
  const { data } = await db
    .from('admin_audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  return NextResponse.json({ entries: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  if (!body.action) return NextResponse.json({ error: 'action required' }, { status: 400 });
  const db = getAdminDb();
  await db.from('admin_audit_log').insert({
    id: `al-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    action: body.action,
    target_tenant: body.target_tenant ?? '',
    details: body.details ?? {},
  });
  return NextResponse.json({ success: true });
}
