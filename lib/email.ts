/**
 * lib/email.ts — Modulo email centralizzato per StylistGo (powered by Resend)
 *
 * Tutte le email transazionali passano da qui.
 * Non importare Resend direttamente nelle API route — usa le funzioni esportate.
 *
 * SETUP SUPABASE: disabilita l'invio automatico email da:
 *   Dashboard > Authentication > Providers > Email
 *   → disattiva "Enable Email Confirmations"
 *   Oppure configura un Custom SMTP non funzionante per silenziare le email di Supabase.
 *   Gli utenti vengono creati via Admin API (che non invia email autonomamente).
 */

import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

// ─── Costanti ────────────────────────────────────────────────────────────────
// IMPORTANTE: sostituisci con il tuo dominio verificato su resend.com
const FROM = 'StylistGo <noreply@stylistgo.it>';

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || 'https://app.stylistgo.it'
).replace(/\/$/, '');

// ─── Client factory (lazy, server-side only) ─────────────────────────────────
function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY non impostata');
  return new Resend(key);
}

function getAdminSupabase() {
  const url = (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ''
  ).trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !key) throw new Error('Credenziali Supabase admin non impostate');
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ─── Tipi interni ─────────────────────────────────────────────────────────────
type EmailType =
  | 'signup_confirmation'
  | 'welcome'
  | 'password_reset'
  | 'password_changed'
  | 'email_change'
  | 'email_change_confirmed';

// ─── Logging ──────────────────────────────────────────────────────────────────
async function logEmail(params: {
  recipient: string;
  type: EmailType;
  status: 'sent' | 'failed';
  resendId?: string;
  error?: string;
}): Promise<void> {
  try {
    await getAdminSupabase().from('email_logs').insert({
      id: crypto.randomUUID(),
      recipient: params.recipient,
      type: params.type,
      status: params.status,
      resend_id: params.resendId ?? null,
      error_message: params.error ?? null,
    });
  } catch (e) {
    // Mai bloccare il flusso per un errore di log
    console.warn('[email] logEmail DB write failed:', e);
  }
}

// ─── Rate limiting ────────────────────────────────────────────────────────────
/**
 * Restituisce true se la richiesta è consentita (entro il limite orario).
 * In caso di errore DB, fallisce in modo aperto (consente la richiesta).
 */
export async function checkRateLimit(
  email: string,
  action: string,
  maxPerHour: number,
): Promise<boolean> {
  try {
    const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString();
    const { count, error } = await getAdminSupabase()
      .from('email_rate_limit_log')
      .select('id', { count: 'exact', head: true })
      .eq('email', email.toLowerCase().trim())
      .eq('action_type', action)
      .gte('created_at', oneHourAgo);

    if (error) return true; // fail open
    return (count ?? 0) < maxPerHour;
  } catch {
    return true; // fail open
  }
}

/** Registra un evento di rate-limit (chiamato dopo che il check è passato). */
export async function recordRateLimitEvent(
  email: string,
  action: string,
): Promise<void> {
  try {
    await getAdminSupabase().from('email_rate_limit_log').insert({
      id: crypto.randomUUID(),
      email: email.toLowerCase().trim(),
      action_type: action,
    });
  } catch (e) {
    console.warn('[email] recordRateLimitEvent failed:', e);
  }
}

// ─── Invio con retry ──────────────────────────────────────────────────────────
/**
 * Tenta l'invio fino a 2 volte.
 * In ambiente serverless il retry è sincrono (senza await 30s) per evitare
 * timeout della funzione. Logga sempre il risultato finale nel DB.
 * Non lancia mai eccezioni — il flusso utente non viene mai bloccato.
 */
async function sendEmail(
  type: EmailType,
  to: string,
  subject: string,
  html: string,
  text: string,
): Promise<void> {
  const resend = getResend();
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { data, error } = await resend.emails.send({
        from: FROM,
        to: [to],
        subject,
        html,
        text,
      });

      if (error) {
        lastError = (error as { message?: string }).message ?? 'Resend error';
        continue;
      }

      await logEmail({
        recipient: to,
        type,
        status: 'sent',
        resendId: data?.id ?? undefined,
      });
      return; // successo
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  // Entrambi i tentativi falliti — log silenzioso, non lanciare
  await logEmail({ recipient: to, type, status: 'failed', error: lastError });
  console.error(`[email] sendEmail(${type}) → ${to} fallito: ${lastError}`);
}

// ─── Template helpers ─────────────────────────────────────────────────────────
function baseTemplate(salonName: string, content: string): string {
  const name = salonName || 'StylistGo';
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f5f3ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
          <tr>
            <td style="background:linear-gradient(135deg,#7c3aed 0%,#4f46e5 100%);padding:40px 48px;text-align:center">
              <p style="margin:0;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:-0.5px">${name}</p>
              <p style="margin:6px 0 0;color:#ede9fe;font-size:12px;letter-spacing:0.8px;text-transform:uppercase">Gestionale professionale per saloni</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 48px 32px">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="background:#faf5ff;padding:24px 48px;text-align:center;border-top:1px solid #ede9fe">
              <p style="margin:0;color:#9ca3af;font-size:12px">
                &copy; 2025 StylistGo &middot;
                <a href="https://stylistgo.it" style="color:#7c3aed;text-decoration:none">stylistgo.it</a>
              </p>
              <p style="margin:6px 0 0;color:#9ca3af;font-size:11px">
                Hai ricevuto questa email perché hai un account StylistGo.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function btn(url: string, label: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:28px 0">
    <tr>
      <td>
        <a href="${url}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed 0%,#4f46e5 100%);color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:0.2px">${label}</a>
      </td>
    </tr>
  </table>`;
}

function h1(t: string): string {
  return `<h1 style="margin:0 0 16px;color:#1f2937;font-size:22px;font-weight:700;line-height:1.3">${t}</h1>`;
}

function p(t: string): string {
  return `<p style="margin:0 0 14px;color:#4b5563;font-size:15px;line-height:1.65">${t}</p>`;
}

function hr(): string {
  return `<hr style="border:none;border-top:1px solid #ede9fe;margin:24px 0" />`;
}

function small(t: string): string {
  return `<p style="margin:12px 0 0;color:#9ca3af;font-size:12px;line-height:1.6">${t}</p>`;
}

function urlFallback(url: string): string {
  return `<p style="margin:4px 0 0;color:#9ca3af;font-size:12px;line-height:1.6">
    Se il pulsante non funziona, copia e incolla questo link nel browser:<br/>
    <a href="${url}" style="color:#7c3aed;word-break:break-all">${url}</a>
  </p>`;
}

// ─── Template: conferma iscrizione ────────────────────────────────────────────
function tplSignupConfirmHtml(salonName: string, confirmUrl: string): string {
  return baseTemplate(
    salonName,
    [
      h1('Conferma il tuo indirizzo email'),
      p(`Grazie per esserti registrato${salonName ? ` a <strong>${salonName}</strong>` : ''}!`),
      p('Clicca sul pulsante per attivare il tuo account. Il link è valido <strong>24 ore</strong>.'),
      btn(confirmUrl, 'Conferma email'),
      urlFallback(confirmUrl),
      hr(),
      small('Se non hai creato un account su StylistGo, ignora questa email — non succederà nulla.'),
    ].join(''),
  );
}

function tplSignupConfirmText(salonName: string, confirmUrl: string): string {
  return `Conferma il tuo indirizzo email — ${salonName || 'StylistGo'}

Grazie per esserti registrato! Per attivare il tuo account clicca sul link qui sotto
(valido 24 ore):

${confirmUrl}

Se non hai creato un account, ignora questa email.

— Team StylistGo`;
}

// ─── Template: benvenuto ──────────────────────────────────────────────────────
function tplWelcomeHtml(salonName: string, email: string): string {
  return baseTemplate(
    salonName,
    [
      h1(`Benvenuto su ${salonName || 'StylistGo'}! 🎉`),
      p(`Il tuo account (<strong>${email}</strong>) è attivo e pronto all'uso.`),
      p('Accedi al gestionale per iniziare a gestire appuntamenti, clienti, cassa e molto altro.'),
      btn(`${SITE_URL}/login`, 'Vai al gestionale'),
      hr(),
      small('Per qualsiasi domanda visita <a href="https://stylistgo.it" style="color:#7c3aed">stylistgo.it</a> o contatta il supporto.'),
    ].join(''),
  );
}

function tplWelcomeText(salonName: string, email: string): string {
  return `Benvenuto su ${salonName || 'StylistGo'}!

Il tuo account (${email}) è attivo e pronto all'uso.

Accedi al gestionale: ${SITE_URL}/login

— Team StylistGo`;
}

// ─── Template: reset password ─────────────────────────────────────────────────
function tplPasswordResetHtml(salonName: string, resetUrl: string): string {
  return baseTemplate(
    salonName,
    [
      h1('Reimposta la tua password'),
      p('Hai richiesto di reimpostare la password del tuo account StylistGo.'),
      p('Clicca sul pulsante qui sotto per scegliere una nuova password. Il link è valido <strong>1 ora</strong>.'),
      btn(resetUrl, 'Reimposta password'),
      urlFallback(resetUrl),
      hr(),
      small('Se non hai richiesto il reset della password, ignora questa email — il tuo account è al sicuro.'),
    ].join(''),
  );
}

function tplPasswordResetText(salonName: string, resetUrl: string): string {
  return `Reimposta la tua password — ${salonName || 'StylistGo'}

Hai richiesto di reimpostare la password del tuo account.

Link per il reset (valido 1 ora):
${resetUrl}

Se non hai fatto questa richiesta, ignora l'email.

— Team StylistGo`;
}

// ─── Template: password modificata ───────────────────────────────────────────
function tplPasswordChangedHtml(salonName: string, email: string): string {
  return baseTemplate(
    salonName,
    [
      h1('Password modificata'),
      p(`La password del tuo account <strong>${email}</strong> è stata modificata con successo.`),
      p("Se sei stato tu, non devi fare nulla. Se non riconosci questa modifica, contatta subito il supporto."),
      btn(`${SITE_URL}/login`, 'Vai al gestionale'),
      hr(),
      small('Questa è una notifica automatica di sicurezza. Non condividere mai la tua password.'),
    ].join(''),
  );
}

function tplPasswordChangedText(salonName: string, email: string): string {
  return `Password modificata — ${salonName || 'StylistGo'}

La password del tuo account ${email} è stata modificata con successo.

Se non sei stato tu, contatta subito il supporto su stylistgo.it.

— Team StylistGo`;
}

// ─── Template: verifica cambio email (inviata al NUOVO indirizzo) ─────────────
function tplEmailChangeHtml(salonName: string, newEmail: string, verifyUrl: string): string {
  return baseTemplate(
    salonName,
    [
      h1('Verifica il tuo nuovo indirizzo email'),
      p('Hai richiesto di cambiare il tuo indirizzo email su StylistGo.'),
      p(`Nuovo indirizzo: <strong>${newEmail}</strong>`),
      p('Clicca sul pulsante per confermare. Il link è valido <strong>24 ore</strong>.'),
      btn(verifyUrl, 'Verifica nuovo indirizzo'),
      urlFallback(verifyUrl),
      hr(),
      small("Se non hai richiesto questo cambio, ignora l'email. Il tuo indirizzo attuale rimane invariato."),
    ].join(''),
  );
}

function tplEmailChangeText(salonName: string, newEmail: string, verifyUrl: string): string {
  return `Verifica il tuo nuovo indirizzo email — ${salonName || 'StylistGo'}

Hai richiesto di cambiare il tuo indirizzo email.

Nuovo indirizzo: ${newEmail}

Link di verifica (valido 24 ore):
${verifyUrl}

Se non hai fatto questa richiesta, ignora l'email.

— Team StylistGo`;
}

// ─── Template: cambio email confermato (notifica al VECCHIO indirizzo) ────────
function tplEmailChangedHtml(salonName: string, oldEmail: string, newEmail: string): string {
  return baseTemplate(
    salonName,
    [
      h1('Il tuo indirizzo email è stato aggiornato'),
      p(`L'email collegata al tuo account StylistGo è stata cambiata.`),
      p(`Vecchio indirizzo: <strong>${oldEmail}</strong><br/>Nuovo indirizzo: <strong>${newEmail}</strong>`),
      p("Se non sei stato tu ad effettuare questa modifica, contatta immediatamente il supporto."),
      hr(),
      small('Notifica automatica di sicurezza — stylistgo.it'),
    ].join(''),
  );
}

function tplEmailChangedText(salonName: string, oldEmail: string, newEmail: string): string {
  return `Il tuo indirizzo email è stato aggiornato — ${salonName || 'StylistGo'}

Vecchio indirizzo: ${oldEmail}
Nuovo indirizzo: ${newEmail}

Se non eri tu, contatta subito il supporto su stylistgo.it.

— Team StylistGo`;
}

// ─── API pubblica ─────────────────────────────────────────────────────────────

/** Email di conferma inviata subito dopo la registrazione. */
export async function sendSignupConfirmationEmail(
  to: string,
  confirmUrl: string,
  salonName = '',
): Promise<void> {
  await sendEmail(
    'signup_confirmation',
    to,
    `Conferma la tua email${salonName ? ` — ${salonName}` : ''}`,
    tplSignupConfirmHtml(salonName, confirmUrl),
    tplSignupConfirmText(salonName, confirmUrl),
  );
}

/** Email di benvenuto inviata dopo la conferma dell'indirizzo. */
export async function sendWelcomeEmail(to: string, salonName = ''): Promise<void> {
  await sendEmail(
    'welcome',
    to,
    `Benvenuto${salonName ? ` su ${salonName}` : ' su StylistGo'}!`,
    tplWelcomeHtml(salonName, to),
    tplWelcomeText(salonName, to),
  );
}

/** Email con link sicuro per il reset della password (scade in 1 ora). */
export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
  salonName = '',
): Promise<void> {
  await sendEmail(
    'password_reset',
    to,
    'Reimposta la tua password — StylistGo',
    tplPasswordResetHtml(salonName, resetUrl),
    tplPasswordResetText(salonName, resetUrl),
  );
}

/** Notifica inviata all'utente dopo che la password è stata cambiata. */
export async function sendPasswordChangedEmail(to: string, salonName = ''): Promise<void> {
  await sendEmail(
    'password_changed',
    to,
    'La tua password è stata modificata — StylistGo',
    tplPasswordChangedHtml(salonName, to),
    tplPasswordChangedText(salonName, to),
  );
}

/** Email di verifica inviata al NUOVO indirizzo quando si richiede un cambio email. */
export async function sendEmailChangeVerificationEmail(
  to: string,
  newEmail: string,
  verifyUrl: string,
  salonName = '',
): Promise<void> {
  await sendEmail(
    'email_change',
    to,
    'Verifica il tuo nuovo indirizzo email — StylistGo',
    tplEmailChangeHtml(salonName, newEmail, verifyUrl),
    tplEmailChangeText(salonName, newEmail, verifyUrl),
  );
}

/** Notifica inviata al VECCHIO indirizzo dopo che il cambio email è stato confermato. */
export async function sendEmailChangedNotification(
  oldEmail: string,
  newEmail: string,
  salonName = '',
): Promise<void> {
  await sendEmail(
    'email_change_confirmed',
    oldEmail,
    'Il tuo indirizzo email è stato aggiornato — StylistGo',
    tplEmailChangedHtml(salonName, oldEmail, newEmail),
    tplEmailChangedText(salonName, oldEmail, newEmail),
  );
}
