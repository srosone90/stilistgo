import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest, getAdminDb } from '@/lib/adminAuth';

const auth = (req: NextRequest) => verifyAdminRequest(req.headers.get('authorization'));

/** GET /api/admin/salon-data?user_id=xxx — read full salon state for a tenant */
export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user_id = req.nextUrl.searchParams.get('user_id');
  if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 });

  const db = getAdminDb();
  const { data, error } = await db
    .from('salon_data')
    .select('state, updated_at')
    .eq('user_id', user_id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ state: data.state, updated_at: data.updated_at });
}

/** PATCH /api/admin/salon-data — update operators or salonConfig for a tenant */
export async function PATCH(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const { user_id, operators, salonConfig } = body;
  if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 });

  const db = getAdminDb();

  const { data, error: readErr } = await db
    .from('salon_data')
    .select('state')
    .eq('user_id', user_id)
    .maybeSingle();

  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const currentState = (data.state ?? {}) as Record<string, unknown>;
  const newState: Record<string, unknown> = { ...currentState };

  if (operators !== undefined) newState.operators = operators;
  if (salonConfig !== undefined) newState.salonConfig = { ...(currentState.salonConfig as Record<string, unknown> ?? {}), ...salonConfig };

  newState._savedAt = Date.now();

  const { error: writeErr } = await db
    .from('salon_data')
    .update({ state: newState, updated_at: new Date().toISOString() })
    .eq('user_id', user_id);

  if (writeErr) return NextResponse.json({ error: writeErr.message }, { status: 500 });

  await db.from('admin_audit_log').insert({
    id: `al-${Date.now()}`,
    action: 'salon_data_updated',
    target_tenant: user_id,
    details: {
      updated_fields: [operators !== undefined && 'operators', salonConfig !== undefined && 'salonConfig'].filter(Boolean),
    },
  });

  return NextResponse.json({ success: true });
}