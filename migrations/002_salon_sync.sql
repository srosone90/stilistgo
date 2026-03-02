-- Stylistgo — Migration 002: Salon sync + online bookings
-- Run this in the Supabase Dashboard → SQL Editor

-- ─── Salon state (full JSON snapshot, one row per user) ─────────────────────
create table if not exists salon_state (
  user_id     text          primary key,
  state       jsonb         not null default '{}',
  updated_at  timestamptz   default now()
);

alter table salon_state enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename='salon_state' and policyname='Allow all'
  ) then
    create policy "Allow all" on salon_state for all using (true) with check (true);
  end if;
end $$;

-- ─── Online bookings (public, no auth required to INSERT) ────────────────────
create table if not exists online_bookings (
  id             text          primary key,
  created_at     timestamptz   default now(),
  client_name    text          not null,
  client_phone   text          not null,
  client_email   text          default '',
  service        text          not null,
  preferred_date text          not null,
  preferred_time text          not null,
  notes          text          default '',
  status         text          default 'pending'
                 check (status in ('pending','confirmed','cancelled'))
);

alter table online_bookings enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename='online_bookings' and policyname='Allow all'
  ) then
    create policy "Allow all" on online_bookings for all using (true) with check (true);
  end if;
end $$;
