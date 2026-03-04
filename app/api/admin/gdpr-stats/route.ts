import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest, getAdminDb } from '@/lib/adminAuth';

const auth = (req: NextRequest) => verifyAdminRequest(req.headers.get('authorization'));

/**
 * GET /api/admin/gdpr-stats
 * Returns consent summary. Resilient if migration 009 hasn't been run yet.
 */
export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = getAdminDb();

  // Total always comes from salon_data (always exists)
  const { data: salonRows } = await db.from('salon_data').select('user_id');
  const total = salonRows?.length ?? 0;

  // legal_consents is added by migration 009 — might not exist yet
  let withConsent = 0;
  try {
    const { data: tenants, error } = await db
      .from('admin_tenants')
      .select('user_id, legal_consents');

    if (!error && tenants) {
      withConsent = tenants.filter(t => {
        const lc = t.legal_consents as Record<string, unknown> | null;
        return lc && lc.tos && lc.dpa;
      }).length;
    }
  } catch {
    // Column doesn't exist yet — migration 009 not run. Return partial data.
  }

  return NextResponse.json({
    total,
    withConsent,
    withoutConsent: total - withConsent,
    migrationPending: withConsent === 0 && total > 0,
  });
}
