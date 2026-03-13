-- ============================================================
--  AUTH CONFIG — disabilita le email automatiche di Supabase
--  Consente al nostro codice (Resend) di gestire tutte le email
-- ============================================================

-- Disabilita "Enable email confirmations" (mailer_autoconfirm):
-- false = gli utenti via client signUp() devono confermare l'email
-- Noi usiamo Admin API (createUser) che non invia email autonomamente.
-- Questa riga è per sicurezza, nel caso qualcuno usi signUp() diretto.
UPDATE auth.config
SET
  -- Supabase non invia email: disabilita l'SMTP interno
  -- (lo svuotiamo così ogni tentativo di invio fallisce silenziosamente)
  smtp_host                         = '',
  smtp_port                         = 465,
  smtp_user                         = '',
  smtp_pass                         = '',
  smtp_admin_email                  = '',
  smtp_sender_name                  = 'StylistGo',
  -- Conferma email richiesta (il link viene inviato da noi via Resend)
  mailer_autoconfirm                = false,
  -- Disabilita la conferma del cambio email tramite il flusso Supabase
  -- (gestiamo noi il cambio email con email_change_tokens)
  mailer_secure_email_change_enabled = false
WHERE true;
