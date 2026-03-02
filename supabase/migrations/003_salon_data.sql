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

-- RLS: ogni utente legge/scrive solo i propri dati
alter table salon_data enable row level security;

drop policy if exists "salon_data_own" on salon_data;
create policy "salon_data_own" on salon_data
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

-- 2) Tabella per le prenotazioni online (richieste dal sito di booking)
create table if not exists online_bookings (
  id             text        primary key,
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

-- RLS: solo utenti autenticati (titolari) leggono le prenotazioni;
-- le prenotazioni vengono create dal server (anon key) quindi serve INSERT pubblica
alter table online_bookings enable row level security;

drop policy if exists "bookings_read_auth" on online_bookings;
create policy "bookings_read_auth" on online_bookings
  for select using (auth.role() = 'authenticated');

drop policy if exists "bookings_insert_anon" on online_bookings;
create policy "bookings_insert_anon" on online_bookings
  for insert with check (true);

drop policy if exists "bookings_update_auth" on online_bookings;
create policy "bookings_update_auth" on online_bookings
  for update using (auth.role() = 'authenticated');

drop policy if exists "bookings_delete_auth" on online_bookings;
create policy "bookings_delete_auth" on online_bookings
  for delete using (auth.role() = 'authenticated');
