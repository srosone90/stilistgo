import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest, getAdminDb } from '@/lib/adminAuth';

export async function POST(req: NextRequest) {
  if (!verifyAdminRequest(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { user_id } = await req.json();
  if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 });

  const db = getAdminDb();

  // Get user's email from salon_data
  const { data: salon } = await db.from('salon_data').select('state').eq('user_id', user_id).single();
  const email = (salon?.state as { salonConfig?: { email?: string } } | null)?.salonConfig?.email;
  if (!email) return NextResponse.json({ error: 'Email non trovata per questo tenant' }, { status: 404 });

  // Generate magic link using service-role admin auth
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
  const { data, error } = await db.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${siteUrl}/` },
  });

  if (error || !data?.properties?.action_link) {
    return NextResponse.json(
      { error: error?.message ?? 'Impossibile generare il link' },
      { status: 500 },
    );
  }

  // Audit
  await db.from('admin_audit_log').insert({
    id: `al-${Date.now()}`,
    action: 'tenant_impersonated',
    target_tenant: user_id,
    details: { email },
  });

  return NextResponse.json({ url: data.properties.action_link, email });
}
