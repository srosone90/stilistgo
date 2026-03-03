-- ============================================================
--  Aggiorna il CHECK constraint su admin_tenants.plan
--  per rimuovere 'enterprise' e allinearlo ai 4 piani attuali.
--  Esegui nel Supabase SQL Editor.
-- ============================================================

-- 1) Migra eventuali tenant enterprise → business
UPDATE admin_tenants SET plan = 'business' WHERE plan = 'enterprise';

-- 2) Elimina il vecchio constraint
ALTER TABLE admin_tenants DROP CONSTRAINT IF EXISTS admin_tenants_plan_check;

-- 3) Ricrea il constraint con i piani corretti
ALTER TABLE admin_tenants
  ADD CONSTRAINT admin_tenants_plan_check
  CHECK (plan IN ('trial', 'starter', 'pro', 'business'));
