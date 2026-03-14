-- ============================================================
--  Migration 013 — Evolution API WhatsApp columns
--  Esegui nel Supabase SQL Editor: Dashboard → SQL Editor → Run
-- ============================================================

-- Add WhatsApp connection tracking columns to admin_tenants.
-- These are written by the Evolution webhook and the /api/whatsapp/* routes.

alter table admin_tenants
  add column if not exists whatsapp_connected      boolean     not null default false,
  add column if not exists whatsapp_instance_name  text,
  add column if not exists whatsapp_connected_at   timestamptz,
  add column if not exists whatsapp_phone          text;

-- Index for webhook lookups by instance name
create index if not exists admin_tenants_whatsapp_instance_name_idx
  on admin_tenants (whatsapp_instance_name);
