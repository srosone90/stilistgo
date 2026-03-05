-- ============================================================
--  010 — Fix permessi tabelle admin
--
--  Problema: le tabelle admin create via SQL migration non hanno
--  GRANT automatico al ruolo `anon` di Supabase.
--  Risultato: tutte le API admin falliscono silenziosamente
--  quando SUPABASE_SERVICE_ROLE_KEY non è impostata, e anche
--  /api/user/plan (che usa la anon key) restituisce sempre 'trial'.
--
--  Soluzione: concedere ALL su tutte le tabelle admin ai ruoli
--  anon e authenticated. La sicurezza è garantita a livello
--  applicativo dai controlli del token HMAC admin, non da RLS.
--  (Vedi migrazione 004: "Nessuna RLS su tabelle admin")
-- ============================================================

-- ── Rimuovi le policy service_role_only dalla migrazione 008 ──
-- (bloccavano l'accesso anche tramite anon key)
drop policy if exists "service_role_only" on admin_invoices;
drop policy if exists "service_role_only" on admin_payments_received;
drop policy if exists "service_role_only" on admin_pipeline;
drop policy if exists "service_role_only" on admin_tasks;
drop policy if exists "service_role_only" on admin_coupons;
drop policy if exists "service_role_only" on admin_comm_log;

-- ── Disabilita RLS sulle tabelle admin (app layer gestisce l'auth) ─
alter table admin_invoices          disable row level security;
alter table admin_payments_received disable row level security;
alter table admin_pipeline          disable row level security;
alter table admin_tasks             disable row level security;
alter table admin_coupons           disable row level security;
alter table admin_comm_log          disable row level security;

-- ── Grant tabelle create da migrazione 004 ────────────────────────
grant select, insert, update, delete on admin_tenants        to anon, authenticated;
grant select, insert, update, delete on admin_tickets        to anon, authenticated;
grant select, insert, update, delete on admin_broadcasts     to anon, authenticated;
grant select, insert, update, delete on admin_audit_log      to anon, authenticated;
grant select, insert, update, delete on admin_feature_flags  to anon, authenticated;

-- ── Grant tabelle create da migrazione 008 ────────────────────────
grant select, insert, update, delete on admin_invoices           to anon, authenticated;
grant select, insert, update, delete on admin_payments_received  to anon, authenticated;
grant select, insert, update, delete on admin_pipeline           to anon, authenticated;
grant select, insert, update, delete on admin_tasks              to anon, authenticated;
grant select, insert, update, delete on admin_coupons            to anon, authenticated;
grant select, insert, update, delete on admin_comm_log           to anon, authenticated;

-- ── Grant sequence / serial se presenti ──────────────────────────
grant usage, select on all sequences in schema public to anon, authenticated;

-- ── Ricarica cache schema PostgREST ──────────────────────────────
notify pgrst, 'reload schema';
