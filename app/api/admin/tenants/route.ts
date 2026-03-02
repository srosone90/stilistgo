import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest, getAdminDb } from '@/lib/adminAuth';

type SalonState = {
  salonConfig?: { salonName?: string; email?: string; phone?: string; vatNumber?: string };
  clients?: unknown[];
  appointments?: unknown[];
  operators?: unknown[];
  services?: unknown[];
};

type MetaRow = {
  user_id: string; email: string; full_name: string; salon_name: string;
  plan: string; monthly_price: number; trial_ends_at: string | null;
  status: string; region: string; sector: string; notes: string; csm: string;
  registered_at: string; last_seen_at: string | null;
};

const auth = (req: NextRequest) => verifyAdminRequest(req.headers.get('authorization'));

/** GET /api/admin/tenants — full tenant list merged with salon_data metrics */
export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = getAdminDb();

  // Read all salon_data (has public read policy — works with anon key too)
  const { data: salonRows } = await db.from('salon_data').select('user_id,state,updated_at').order('updated_at', { ascending: false });
  // Read admin_tenants metadata
  const { data: metaRows } = await db.from('admin_tenants').select('*');

  const metaMap = new Map((metaRows ?? []).map((m: MetaRow) => [m.user_id, m]));
  const toCreate: { user_id: string; salon_name: string; email: string; full_name: string; registered_at: string }[] = [];

  const tenants = (salonRows ?? []).map((row: { user_id: string; state: SalonState; updated_at: string }) => {
    const state = (row.state ?? {}) as SalonState;
    const cfg = state.salonConfig ?? {};
    const meta = metaMap.get(row.user_id) as MetaRow | undefined;

    if (!meta) {
      toCreate.push({
        user_id: row.user_id,
        salon_name: cfg.salonName ?? row.user_id.slice(0, 12),
        email: cfg.email ?? '',
        full_name: '',
        registered_at: row.updated_at,
      });
    }

    return {
      user_id: row.user_id,
      // Always prefer live salon_data over cached admin_tenants for informational fields
      email: cfg.email || meta?.email || '',
      full_name: meta?.full_name ?? '',
      salon_name: cfg.salonName || meta?.salon_name || row.user_id.slice(0, 12),
      plan: meta?.plan ?? 'trial',
      monthly_price: meta?.monthly_price ?? 0,
      trial_ends_at: meta?.trial_ends_at ?? null,
      status: meta?.status ?? 'trial',
      region: meta?.region ?? '',
      sector: meta?.sector ?? 'parrucchiere',
      notes: meta?.notes ?? '',
      csm: meta?.csm ?? '',
      registered_at: meta?.registered_at ?? row.updated_at,
      last_seen_at: meta?.last_seen_at ?? row.updated_at,
      // Live metrics from salon_data
      clients_count: (state.clients ?? []).length,
      appointments_count: (state.appointments ?? []).length,
      operators_count: (state.operators ?? []).length,
      services_count: (state.services ?? []).length,
      last_sync: row.updated_at,
      // Config extras
      phone: cfg.phone ?? '',
      vat_number: cfg.vatNumber ?? '',
    };
  });

  // Auto-upsert new tenants (fire and forget)
  if (toCreate.length > 0) {
    db.from('admin_tenants').upsert(toCreate, { onConflict: 'user_id' }).then(() => {});
  }

  // Sync live salon info (name, email) back to existing admin_tenants records
  const toSync = (salonRows ?? []).flatMap((row: { user_id: string; state: SalonState }) => {
    const cfg2 = ((row.state ?? {}) as SalonState).salonConfig ?? {};
    const meta2 = metaMap.get(row.user_id) as MetaRow | undefined;
    if (!meta2) return []; // will be created via toCreate
    if (!cfg2.salonName && !cfg2.email) return [];
    if (meta2.salon_name === cfg2.salonName && meta2.email === (cfg2.email ?? '')) return [];
    return [{ user_id: row.user_id, salon_name: cfg2.salonName ?? meta2.salon_name, email: cfg2.email ?? meta2.email }];
  });
  if (toSync.length > 0) {
    db.from('admin_tenants').upsert(toSync, { onConflict: 'user_id' }).then(() => {});
  }

  return NextResponse.json({ tenants });
}

/** PATCH /api/admin/tenants — update tenant metadata */
export async function PATCH(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const { user_id, ...patch } = body;
  if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 });

  const db = getAdminDb();
  // Strip computed fields that don't belong in admin_tenants
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { clients_count, appointments_count, operators_count, services_count, last_sync, phone, vat_number, ...safe } = patch;

  await db.from('admin_tenants').upsert({ user_id, ...safe }, { onConflict: 'user_id' });

  // Audit
  await db.from('admin_audit_log').insert({
    id: `al-${Date.now()}`,
    action: 'tenant_updated',
    target_tenant: user_id,
    details: { patch: safe },
  });

  return NextResponse.json({ success: true });
}

/** DELETE /api/admin/tenants — delete tenant metadata (+ optional salon_data) */
export async function DELETE(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { user_id, delete_data } = await req.json();
  if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 });

  const db = getAdminDb();
  // Always delete admin_tenants record
  await db.from('admin_tenants').delete().eq('user_id', user_id);

  // Optionally delete salon_data (full wipe)
  if (delete_data) {
    await db.from('salon_data').delete().eq('user_id', user_id);
  }

  // Audit
  await db.from('admin_audit_log').insert({
    id: `al-${Date.now()}`,
    action: 'tenant_deleted',
    target_tenant: user_id,
    details: { delete_data: !!delete_data },
  });

  return NextResponse.json({ success: true });
}
