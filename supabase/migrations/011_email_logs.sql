-- ============================================================
--  EMAIL SYSTEM — tabelle per log, rate limiting e token
--  Esegui nel Supabase SQL Editor oppure via migrate script
-- ============================================================

-- 1) Log di ogni tentativo di invio email (successi e fallimenti)
create table if not exists email_logs (
  id            text        primary key default gen_random_uuid()::text,
  recipient     text        not null,
  type          text        not null
                            check (type in (
                              'signup_confirmation', 'welcome',
                              'password_reset', 'password_changed',
                              'email_change', 'email_change_confirmed'
                            )),
  status        text        not null check (status in ('sent', 'failed')),
  resend_id     text,
  error_message text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_email_logs_recipient
  on email_logs (recipient, created_at desc);

create index if not exists idx_email_logs_status
  on email_logs (status, created_at desc);

-- 2) Rate limiting: registra ogni richiesta per poter contare nell'ultima ora
create table if not exists email_rate_limit_log (
  id          text        primary key default gen_random_uuid()::text,
  email       text        not null,
  action_type text        not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_rate_limit_log
  on email_rate_limit_log (email, action_type, created_at desc);

-- Pulizia automatica: elimina record più vecchi di 24 ore (evita crescita illimitata)
-- Attiva tramite pg_cron nel Supabase dashboard: 0 * * * * DELETE FROM email_rate_limit_log WHERE created_at < now() - interval '24 hours';

-- 3) Token per la verifica del cambio email (gestiti interamente dal nostro codice)
create table if not exists email_change_tokens (
  id         text        primary key default gen_random_uuid()::text,
  user_id    text        not null,
  old_email  text        not null,
  new_email  text        not null,
  token      text        not null unique,
  expires_at timestamptz not null,
  used_at    timestamptz,            -- null = non ancora usato
  created_at timestamptz not null default now()
);

create index if not exists idx_email_change_tokens_token
  on email_change_tokens (token);

create index if not exists idx_email_change_tokens_user
  on email_change_tokens (user_id, created_at desc);

-- Nessuna RLS su queste tabelle: accessibili solo via API route server-side
-- che validano l'identità prima di ogni operazione.
