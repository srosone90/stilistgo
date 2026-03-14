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

  // Online bookings count per salon — last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data: bookingRows } = await db
    .from('online_bookings')
    .select('salon_id')
    .gte('created_at', thirtyDaysAgo);
  const bookingCountMap = new Map<string, number>();
  for (const r of (bookingRows ?? []) as Array<{ salon_id: string }>) {
    bookingCountMap.set(r.salon_id, (bookingCountMap.get(r.salon_id) ?? 0) + 1);
  }

  const DEFAULT_SALON_NAME = 'Stylistgo';
  const metaMap = new Map((metaRows ?? []).map((m: MetaRow) => [m.user_id, m]));
  const salonDataIds = new Set((salonRows ?? []).map((r: { user_id: string }) => r.user_id));
  const toCreate: { user_id: string; salon_name: string; email: string; full_name: string; registered_at: string }[] = [];

  // ── Helper: build one tenant record ──────────────────────────────────────
  function buildTenant(
    user_id: string,
    state: SalonState,
    updated_at: string,
    meta: MetaRow | undefined,
  ) {
    const cfg = state.salonConfig ?? {};
    const liveSalonName = cfg.salonName?.trim() ?? '';
    const hasRealLiveName = liveSalonName && liveSalonName !== DEFAULT_SALON_NAME;
    const displaySalonName = hasRealLiveName
      ? liveSalonName
      : (meta?.salon_name || liveSalonName || user_id.slice(0, 12));

    return {
      user_id,
      email: cfg.email || meta?.email || '',
      full_name: meta?.full_name ?? '',
      salon_name: displaySalonName,
      plan: meta?.plan ?? 'trial',
      monthly_price: meta?.monthly_price ?? 0,
      trial_ends_at: meta?.trial_ends_at ?? null,
      status: meta?.status ?? 'trial',
      region: meta?.region ?? '',
      sector: meta?.sector ?? 'parrucchiere',
      notes: meta?.notes ?? '',
      csm: meta?.csm ?? '',
      registered_at: meta?.registered_at ?? updated_at,
      last_seen_at: meta?.last_seen_at ?? updated_at,
      // Live metrics from salon_data (may be 0 if no sync yet)
      clients_count: (state.clients ?? []).length,
      appointments_count: (state.appointments ?? []).length,
      operators_count: (state.operators ?? []).length,
      services_count: (state.services ?? []).length,
      last_sync: updated_at,
      // Config extras
      phone: cfg.phone ?? '',
      vat_number: cfg.vatNumber ?? '',
      // Client app & online bookings
      online_bookings_30d: bookingCountMap.get(user_id) ?? 0,
    };
  }

  // ── Tenants with a salon_data record ────────────────────────────────────
  const tenants = (salonRows ?? []).map((row: { user_id: string; state: SalonState; updated_at: string }) => {
    const meta = metaMap.get(row.user_id) as MetaRow | undefined;

    if (!meta) {
      const cfg = (row.state ?? {} as SalonState).salonConfig ?? {};
      toCreate.push({
        user_id: row.user_id,
        salon_name: cfg.salonName ?? row.user_id.slice(0, 12),
        email: cfg.email ?? '',
        full_name: '',
        registered_at: row.updated_at,
      });
    }

    return buildTenant(row.user_id, (row.state ?? {}) as SalonState, row.updated_at, meta);
  });

  // ── Tenants in admin_tenants but with NO salon_data row yet ─────────────
  // These are manually-added or offline users whose app has not synced to cloud.
  for (const meta of (metaRows ?? []) as MetaRow[]) {
    if (!salonDataIds.has(meta.user_id)) {
      tenants.push(buildTenant(meta.user_id, {}, meta.registered_at ?? new Date().toISOString(), meta));
    }
  }

  // Auto-upsert new tenants (fire and forget — errors logged, not fatal)
  if (toCreate.length > 0) {
    db.from('admin_tenants').upsert(toCreate, { onConflict: 'user_id' }).then(({ error }) => {
      if (error) console.error('[GET /api/admin/tenants] auto-upsert error:', JSON.stringify(error));
    });
  }

  // Sync live salon info back to existing admin_tenants records.
  // IMPORTANT: only overwrite salon_name if the tenant has set a real custom name
  // (not empty and not the factory default "Stylistgo"). This prevents the auto-sync
  // from clobbering names that were manually set by the admin.
  const toSync = (salonRows ?? []).flatMap((row: { user_id: string; state: SalonState }) => {
    const cfg2 = ((row.state ?? {}) as SalonState).salonConfig ?? {};
    const meta2 = metaMap.get(row.user_id) as MetaRow | undefined;
    if (!meta2) return []; // will be created via toCreate

    const liveName = cfg2.salonName?.trim() ?? '';
    const liveEmail = cfg2.email?.trim() ?? '';

    // Only propagate a custom name — skip if empty or still the factory default
    const shouldSyncName = liveName && liveName !== DEFAULT_SALON_NAME;
    const shouldSyncEmail = !!liveEmail;

    if (!shouldSyncName && !shouldSyncEmail) return [];

    const newName = shouldSyncName ? liveName : meta2.salon_name;
    const newEmail = shouldSyncEmail ? liveEmail : meta2.email;

    // No change needed
    if (meta2.salon_name === newName && meta2.email === newEmail) return [];

    return [{ user_id: row.user_id, salon_name: newName, email: newEmail }];
  });
  if (toSync.length > 0) {
    db.from('admin_tenants').upsert(toSync, { onConflict: 'user_id' }).then(({ error }) => {
      if (error) console.error('[GET /api/admin/tenants] sync error:', JSON.stringify(error));
    });
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

  // Whitelist only columns that exist in admin_tenants — prevents any unknown field from causing a DB error
  const ALLOWED: string[] = [
    'email', 'full_name', 'salon_name', 'plan', 'monthly_price',
    'trial_ends_at', 'status', 'region', 'sector', 'notes', 'csm',
    'registered_at', 'last_seen_at', 'is_admin',
    'pipeline_stage', 'health_score', 'trial_extended_days',
  ];
  const patchObj = patch as Record<string, unknown>;
  const safe: Record<string, unknown> = {};
  for (const key of ALLOWED) {
    if (key in patchObj) safe[key] = patchObj[key];
  }

  // Use upsert so new tenants (not yet in admin_tenants) are created on first save
  const { error } = await db.from('admin_tenants')
    .upsert({ user_id, ...safe }, { onConflict: 'user_id' });

  if (error) {
    console.error('[PATCH /api/admin/tenants] DB error:', JSON.stringify(error));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

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
  const { error: delErr } = await db.from('admin_tenants').delete().eq('user_id', user_id);
  if (delErr) {
    console.error('[DELETE /api/admin/tenants] DB error:', JSON.stringify(delErr));
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

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
