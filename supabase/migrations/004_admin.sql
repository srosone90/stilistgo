-- ============================================================
--  ADMIN PANEL — TABELLE SAAS
--  Esegui una volta nel Supabase SQL Editor
-- ============================================================

-- 1) Metadata tenant (informazioni SaaS per ogni salone registrato)
create table if not exists admin_tenants (
  user_id       text        primary key,
  email         text        not null default '',
  full_name     text        not null default '',
  salon_name    text        not null default '',
  plan          text        not null default 'trial'
                            check (plan in ('trial','starter','pro','business','enterprise')),
  monthly_price numeric     not null default 0,
  trial_ends_at timestamptz,
  status        text        not null default 'trial'
                            check (status in ('trial','active','suspended','cancelled')),
  region        text        not null default '',
  sector        text        not null default 'parrucchiere',
  notes         text        not null default '',
  csm           text        not null default '',
  registered_at timestamptz not null default now(),
  last_seen_at  timestamptz
);

-- 2) Ticket di supporto
create table if not exists admin_tickets (
  id          text        primary key,
  tenant_id   text        not null default '',
  tenant_name text        not null default '',
  subject     text        not null,
  body        text        not null default '',
  category    text        not null default 'domanda'
                          check (category in ('bug','domanda','feature','altro')),
  priority    text        not null default 'normale'
                          check (priority in ('bassa','normale','alta','urgente')),
  status      text        not null default 'aperto'
                          check (status in ('aperto','in_lavorazione','risolto','chiuso')),
  assigned_to text        not null default '',
  resolution  text        not null default '',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- 3) Broadcast messaggi ai tenant
create table if not exists admin_broadcasts (
  id         text        primary key,
  title      text        not null,
  body       text        not null,
  target     text        not null default 'all',
  created_at timestamptz default now()
);

-- 4) Audit log azioni admin
create table if not exists admin_audit_log (
  id            text        primary key,
  action        text        not null,
  target_tenant text        not null default '',
  details       jsonb       not null default '{}',
  created_at    timestamptz default now()
);

-- 5) Feature flags
create table if not exists admin_feature_flags (
  id          text        primary key,
  name        text        not null,
  description text        not null default '',
  enabled_for text        not null default 'all',
  enabled     boolean     not null default true,
  created_at  timestamptz default now()
);

-- Nessuna RLS su tabelle admin: accessibili solo via API routes server-side
-- che validano il token admin prima di ogni operazione.

-- Seed flag di default
insert into admin_feature_flags (id, name, description, enabled_for, enabled)
values
  ('flag-booking',  'Prenotazione online',    'Abilita la pagina di prenotazione pubblica',   'all',       true),
  ('flag-gamif',    'Gamification',           'Punti fedeltà e badge clienti',                'all',       true),
  ('flag-analysis', 'Analisi avanzata',       'Grafici e report nel gestionale',              'pro',       true),
  ('flag-waitlist', 'Lista d''attesa',        'Modulo lista d''attesa appuntamenti',          'all',       true),
  ('flag-cashdesk', 'Cassa/POS',              'Modulo cassa e pagamenti',                    'starter',   true)
on conflict (id) do nothing;
