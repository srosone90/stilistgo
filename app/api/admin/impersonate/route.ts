import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest, getAdminDb } from '@/lib/adminAuth';

export async function POST(req: NextRequest) {
  if (!verifyAdminRequest(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { user_id } = await req.json();
  if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 });

  const db = getAdminDb();

  // Resolve the tenant's real login email from auth.users via service-role API.
  // We never rely on salonConfig.email because that field is optional and may differ
  // from the actual Supabase account email.
  let email: string | undefined;
  try {
    const { data: authUser, error: authErr } = await db.auth.admin.getUserById(user_id);
    if (!authErr && authUser?.user?.email) {
      email = authUser.user.email;
    }
  } catch { /* fall through */ }

  // Fallback: try salonConfig.email (legacy / edge case)
  if (!email) {
    const { data: salon } = await db.from('salon_data').select('state').eq('user_id', user_id).single();
    email = (salon?.state as { salonConfig?: { email?: string } } | null)?.salonConfig?.email;
  }

  if (!email) return NextResponse.json({ error: 'Email non trovata per questo tenant' }, { status: 404 });

  // Generate magic link using service-role admin auth
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://stylistgo.app';
  const { data, error } = await db.auth.admin.generateLink({
    type: 'magiclink',
    email,
    // ?view=1 tells the app to load data from cloud only and never write back.
    // This prevents the admin browser's localStorage from contaminating the tenant's data.
    options: { redirectTo: `${siteUrl}/?view=1` },
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
