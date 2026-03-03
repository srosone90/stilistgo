-- ============================================================
--  007 — Aggiungi is_admin se mancante + reload schema PostgREST
--  Esegui nel Supabase SQL Editor
-- ============================================================

-- Aggiunge la colonna is_admin se non esiste già
alter table admin_tenants
  add column if not exists is_admin boolean not null default false;

-- Ricarica la cache dello schema PostgREST
-- Necessario dopo modifiche strutturali alla tabella
notify pgrst, 'reload schema';
