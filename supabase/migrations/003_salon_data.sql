-- ============================================================
--  ESEGUI QUESTO SQL UNA VOLTA NEL SUPABASE SQL EDITOR
--  Supabase Dashboard → SQL Editor → New Query → Incolla → Run
-- ============================================================

-- 1) Tabella per il sync del gestionale (dati salone per utente)
create table if not exists salon_data (
  user_id    text        primary key,
  state      jsonb       not null default '{}',
  updated_at timestamptz default now()
);

alter table salon_data enable row level security;

-- Owner can read/write their own data
drop policy if exists "salon_data_own" on salon_data;
create policy "salon_data_own" on salon_data
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

-- Public (anon) can READ salon_data — needed for the online booking page
-- to load available time slots. The booking-slots API only exposes
-- appointment times, never client names or personal data.
drop policy if exists "salon_data_public_read" on salon_data;
create policy "salon_data_public_read" on salon_data
  for select using (true);

-- 2) Tabella per le prenotazioni online (richieste dal sito di booking)
-- Add salon_id column in case the table already existed without it
alter table if exists online_bookings add column if not exists salon_id text not null default '';

create table if not exists online_bookings (
  id             text        primary key,
  salon_id       text        not null default '',
  created_at     timestamptz default now(),
  client_name    text        not null,
  client_phone   text        not null,
  client_email   text        not null default '',
  service        text        not null,
  preferred_date text        not null,
  preferred_time text        not null,
  notes          text        not null default '',
  status         text        not null default 'pending'
                             check (status in ('pending', 'confirmed', 'cancelled'))
);

alter table online_bookings enable row level security;

-- Anon INSERT: allowed (clients submit bookings without login)
drop policy if exists "bookings_insert_anon" on online_bookings;
create policy "bookings_insert_anon" on online_bookings
  for insert with check (true);

-- Authenticated users only see/modify their own salon's bookings
drop policy if exists "bookings_read_auth" on online_bookings;
create policy "bookings_read_auth" on online_bookings
  for select using (auth.role() = 'authenticated' and auth.uid()::text = salon_id);

drop policy if exists "bookings_update_auth" on online_bookings;
create policy "bookings_update_auth" on online_bookings
  for update using (auth.uid()::text = salon_id);

drop policy if exists "bookings_delete_auth" on online_bookings;
create policy "bookings_delete_auth" on online_bookings
  for delete using (auth.uid()::text = salon_id);
