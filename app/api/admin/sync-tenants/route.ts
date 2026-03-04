import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest, getAdminDb } from '@/lib/adminAuth';

const auth = (req: NextRequest) => verifyAdminRequest(req.headers.get('authorization'));

/**
 * POST /api/admin/sync-tenants
 * Usa il service role per ottenere la lista reale di auth.users da Supabase,
 * poi rimuove le righe orphane da salon_data e admin_tenants
 * (utenti cancellati da Supabase dashboard che non esistono più in auth).
 */
export async function POST(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY non configurata' }, { status: 500 });
  }

  const { createClient } = await import('@supabase/supabase-js');
  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Ottieni tutti gli utenti reali da auth.users
  const { data: authUsers, error: authErr } = await svc.auth.admin.listUsers({ perPage: 1000 });
  if (authErr) return NextResponse.json({ error: `Auth admin error: ${authErr.message}` }, { status: 500 });

  const realUserIds = new Set((authUsers?.users ?? []).map(u => u.id));

  // 2. Ottieni tutti i user_id in salon_data
  const db = getAdminDb();
  const { data: salonRows } = await db.from('salon_data').select('user_id');
  const allSalonIds = (salonRows ?? []).map((r: { user_id: string }) => r.user_id);

  // 3. Trova orphani (in salon_data ma non in auth.users)
  const orphans = allSalonIds.filter(id => !realUserIds.has(id));

  let removedSalonData = 0;
  let removedAdminTenants = 0;

  for (const id of orphans) {
    const { error: e1 } = await db.from('salon_data').delete().eq('user_id', id);
    if (!e1) removedSalonData++;

    const { error: e2 } = await db.from('admin_tenants').delete().eq('user_id', id);
    if (!e2) removedAdminTenants++;
  }

  return NextResponse.json({
    totalAuthUsers: authUsers?.users?.length ?? 0,
    totalSalonData: allSalonIds.length,
    orphansFound: orphans.length,
    removedSalonData,
    removedAdminTenants,
    orphanIds: orphans,
  });
}
