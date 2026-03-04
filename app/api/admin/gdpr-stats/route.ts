import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest, getAdminDb } from '@/lib/adminAuth';

const auth = (req: NextRequest) => verifyAdminRequest(req.headers.get('authorization'));

/**
 * GET /api/admin/gdpr-stats
 * Returns consent summary across all tenants.
 */
export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = getAdminDb();

  const { data: tenants, error } = await db
    .from('admin_tenants')
    .select('user_id, legal_consents');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const total = tenants?.length ?? 0;
  const withConsent = tenants?.filter(t => {
    const lc = t.legal_consents as Record<string, unknown> | null;
    return lc && lc.tos && lc.dpa;
  }).length ?? 0;

  return NextResponse.json({
    total,
    withConsent,
    withoutConsent: total - withConsent,
  });
}
