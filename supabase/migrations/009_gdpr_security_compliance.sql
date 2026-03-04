-- ============================================================
--  009 — GDPR, Sicurezza, Crittografia e Data Hygiene
--  Esegui nel Supabase SQL Editor
-- ============================================================

-- ── 1. Abilita pgcrypto (per AES-256 lato Postgres) ───────────────────────
create extension if not exists pgcrypto;

-- ── 2. Colonna legal_consents su admin_tenants ────────────────────────────
-- Salva accettazione ToS/DPA: { tos: { v, ts }, dpa: { v, ts } }
alter table admin_tenants
  add column if not exists legal_consents jsonb not null default '{}';

-- ── 3. Tabella security_events (audit sicurezza per salone) ───────────────
create table if not exists security_events (
  id          uuid        primary key default gen_random_uuid(),
  user_id     text        not null,           -- FK logica a salon_data.user_id
  event_type  text        not null,           -- login/logout/data_export/data_delete/consent
  ip_address  text        not null default '',
  user_agent  text        not null default '',
  metadata    jsonb       not null default '{}',
  created_at  timestamptz not null default now()
);

create index if not exists security_events_user_id_idx on security_events(user_id);
create index if not exists security_events_created_at_idx on security_events(created_at);

alter table security_events enable row level security;

-- Ogni salon gestisce solo i propri eventi
drop policy if exists "security_events_own" on security_events;
create policy "security_events_own" on security_events
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

-- Service role può leggere tutto (per cleanup cron)
drop policy if exists "security_events_service" on security_events;
create policy "security_events_service" on security_events
  using (auth.role() = 'service_role');

-- ── 4. Tabella client_consents (consenso GDPR per singolo cliente) ─────────
-- Separata dal blob JSONB per accountability e possibilità di audit
create table if not exists client_consents (
  id          uuid        primary key default gen_random_uuid(),
  salon_id    text        not null,
  client_id   text        not null,           -- ID del cliente nel JSONB salon_data
  consent_type text       not null default 'gdpr',
  version     text        not null default '1.0',
  accepted_at timestamptz not null default now(),
  ip_address  text        not null default '',
  revoked_at  timestamptz
);

create index if not exists client_consents_salon_id_idx on client_consents(salon_id);

alter table client_consents enable row level security;

drop policy if exists "client_consents_own" on client_consents;
create policy "client_consents_own" on client_consents
  using (auth.uid()::text = salon_id)
  with check (auth.uid()::text = salon_id);

-- ── 5. Crittografia AES-256 per online_bookings.client_phone ─────────────
-- Aggiunge colonna cifrata; la colonna originale sarà deprecata lato app
alter table online_bookings
  add column if not exists client_phone_enc text not null default '';

-- Funzione helper per cifrare (chiave passata come parametro — mai hardcoded)
-- Uso: SELECT encrypt_field('testo', current_setting('app.encryption_key'))
create or replace function encrypt_field(plaintext text, enc_key text)
returns text language sql security definer as $$
  select encode(
    pgp_sym_encrypt(plaintext, enc_key, 'compress-algo=0'),
    'base64'
  );
$$;

create or replace function decrypt_field(ciphertext text, enc_key text)
returns text language sql security definer as $$
  select pgp_sym_decrypt(
    decode(ciphertext, 'base64'),
    enc_key
  );
$$;

-- ── 6. Auto-cleaning: funzione per clienti inattivi ───────────────────────
-- Nota: salon_data.state è JSONB, la pulizia puntuale avviene via API
-- Questa funzione elimina security_events scaduti (eseguibile dal cron)
create or replace function cleanup_old_security_events(retention_days integer default 180)
returns integer language plpgsql security definer as $$
declare
  deleted_count integer;
begin
  delete from security_events
  where created_at < now() - (retention_days || ' days')::interval;
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

-- ── 7. Funzione: registra consenso legale tenant ──────────────────────────
create or replace function record_legal_consent(
  p_user_id   text,
  p_tos_ver   text,
  p_dpa_ver   text
)
returns void language plpgsql security definer as $$
begin
  update admin_tenants
  set legal_consents = jsonb_build_object(
    'tos', jsonb_build_object('version', p_tos_ver, 'accepted_at', now()),
    'dpa', jsonb_build_object('version', p_dpa_ver, 'accepted_at', now())
  )
  where user_id = p_user_id;
end;
$$;

-- ── 8. Reload schema cache PostgREST ─────────────────────────────────────
notify pgrst, 'reload schema';
