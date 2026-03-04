import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest, getAdminDb } from '@/lib/adminAuth';

export async function GET(req: NextRequest) {
  if (!verifyAdminRequest(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const db = getAdminDb();

  const [s1, s2] = await Promise.all([
    db.from('salon_data').select('user_id').limit(5),
    db.from('admin_tenants').select('user_id, email').limit(5),
  ]);

  return NextResponse.json({
    salon_data: { count: s1.data?.length ?? 0, error: s1.error?.message ?? null, rows: s1.data },
    admin_tenants: { count: s2.data?.length ?? 0, error: s2.error?.message ?? null, rows: s2.data },
    service_key_present: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    service_key_prefix: process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 10) ?? 'MISSING',
  });
}
