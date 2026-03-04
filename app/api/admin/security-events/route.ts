import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest, getAdminDb } from '@/lib/adminAuth';

const auth = (req: NextRequest) => verifyAdminRequest(req.headers.get('authorization'));

/**
 * GET /api/admin/security-events?limit=20
 * Returns recent security events across all users (admin view).
 */
export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = getAdminDb();
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100);

  const { data, error } = await db
    .from('security_events')
    .select('id, user_id, event_type, ip_address, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ events: data ?? [] });
}
