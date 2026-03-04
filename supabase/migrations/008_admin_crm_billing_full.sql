-- ============================================================
--  008 — CRM, Billing, Pipeline, Tasks, Coupons, Comm Log
--  Esegui nel Supabase SQL Editor
-- ============================================================

-- ── Fatture emesse ─────────────────────────────────────────
create table if not exists admin_invoices (
  id            uuid        primary key default gen_random_uuid(),
  tenant_id     text        not null,
  number        text        not null,
  amount        numeric     not null default 0,
  plan          text        not null default '',
  period_start  date        not null,
  period_end    date        not null,
  status        text        not null default 'pending',   -- pending/paid/overdue/cancelled
  notes         text        not null default '',
  paid_at       timestamptz,
  created_at    timestamptz not null default now()
);

-- ── Pagamenti ricevuti ─────────────────────────────────────
create table if not exists admin_payments_received (
  id            uuid        primary key default gen_random_uuid(),
  tenant_id     text        not null,
  invoice_id    uuid        references admin_invoices(id) on delete set null,
  amount        numeric     not null default 0,
  method        text        not null default 'bonifico',  -- bonifico/carta/contanti/altro
  reference     text        not null default '',
  date          date        not null default current_date,
  notes         text        not null default '',
  created_at    timestamptz not null default now()
);

-- ── Pipeline vendite ───────────────────────────────────────
create table if not exists admin_pipeline (
  id              uuid        primary key default gen_random_uuid(),
  tenant_id       text,
  company_name    text        not null,
  contact_name    text        not null default '',
  email           text        not null default '',
  phone           text        not null default '',
  stage           text        not null default 'lead',   -- lead/demo/trial/paying/churned
  plan_interest   text        not null default '',
  notes           text        not null default '',
  csm             text        not null default '',
  estimated_mrr   numeric     not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── Task per tenant ────────────────────────────────────────
create table if not exists admin_tasks (
  id            uuid        primary key default gen_random_uuid(),
  tenant_id     text,
  title         text        not null,
  description   text        not null default '',
  due_date      date,
  assigned_to   text        not null default '',
  status        text        not null default 'open',     -- open/done
  priority      text        not null default 'normale',  -- bassa/normale/alta/urgente
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);

-- ── Coupon / codici sconto ─────────────────────────────────
create table if not exists admin_coupons (
  id            uuid        primary key default gen_random_uuid(),
  code          text        unique not null,
  description   text        not null default '',
  discount_pct  numeric     not null default 0,
  discount_eur  numeric     not null default 0,
  applies_to    text        not null default 'all',      -- all/starter/pro/business
  max_uses      integer     not null default 0,          -- 0 = illimitato
  uses_count    integer     not null default 0,
  expires_at    timestamptz,
  active        boolean     not null default true,
  created_at    timestamptz not null default now()
);

-- ── Log comunicazioni ──────────────────────────────────────
create table if not exists admin_comm_log (
  id            uuid        primary key default gen_random_uuid(),
  tenant_id     text        not null,
  type          text        not null default 'email',    -- email/chiamata/sms/nota
  direction     text        not null default 'outbound', -- outbound/inbound
  subject       text        not null default '',
  body          text        not null default '',
  created_by    text        not null default 'admin',
  created_at    timestamptz not null default now()
);

-- ── Colonna stage su admin_tenants (per pipeline CRM) ──────
alter table admin_tenants
  add column if not exists pipeline_stage text not null default 'paying';

-- ── Colonna health_score su admin_tenants ──────────────────
alter table admin_tenants
  add column if not exists health_score integer not null default 50;

-- ── Colonna trial_extended su admin_tenants ────────────────
alter table admin_tenants
  add column if not exists trial_extended_days integer not null default 0;

-- ── RLS: tutte le tabelle admin sono service-role only ─────
alter table admin_invoices          enable row level security;
alter table admin_payments_received enable row level security;
alter table admin_pipeline          enable row level security;
alter table admin_tasks             enable row level security;
alter table admin_coupons           enable row level security;
alter table admin_comm_log          enable row level security;

-- Policy: solo service_role può leggere/scrivere
create policy "service_role_only" on admin_invoices
  for all using (auth.role() = 'service_role');
create policy "service_role_only" on admin_payments_received
  for all using (auth.role() = 'service_role');
create policy "service_role_only" on admin_pipeline
  for all using (auth.role() = 'service_role');
create policy "service_role_only" on admin_tasks
  for all using (auth.role() = 'service_role');
create policy "service_role_only" on admin_coupons
  for all using (auth.role() = 'service_role');
create policy "service_role_only" on admin_comm_log
  for all using (auth.role() = 'service_role');

-- Ricarica cache schema PostgREST
notify pgrst, 'reload schema';
