import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — Stylistgo',
  description: 'Informativa sul trattamento dei dati personali ai sensi del Regolamento UE 2016/679 (GDPR).',
};

const s = {
  page: { maxWidth: '780px', margin: '0 auto', padding: '40px 24px 80px', fontFamily: 'system-ui,sans-serif', color: '#1a1a2e' } as React.CSSProperties,
  h1: { fontSize: '28px', fontWeight: 800, marginBottom: '6px' } as React.CSSProperties,
  meta: { color: '#6b7280', fontSize: '13px', marginBottom: '36px' } as React.CSSProperties,
  h2: { fontSize: '17px', fontWeight: 700, marginTop: '32px', marginBottom: '8px', color: '#4f46e5' } as React.CSSProperties,
  p: { fontSize: '14px', lineHeight: '1.7', marginBottom: '12px' } as React.CSSProperties,
  back: { display: 'inline-block', marginBottom: '24px', color: '#4f46e5', textDecoration: 'none', fontSize: '14px' } as React.CSSProperties,
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '13px', marginBottom: '16px' },
  th: { background: '#f3f4f6', padding: '8px 12px', textAlign: 'left' as const, fontWeight: 600, borderBottom: '1px solid #d1d5db' },
  td: { padding: '8px 12px', borderBottom: '1px solid #e5e7eb', verticalAlign: 'top' as const },
};

export default function PrivacyPage() {
  return (
    <div style={s.page}>
      <a href="/" style={s.back}>← Torna al gestionale</a>
      <h1 style={s.h1}>Privacy Policy</h1>
      <p style={s.meta}>Versione 1.0 — In vigore dal 1° marzo 2026 | Informativa ai sensi dell&apos;art. 13 e 14 del Reg. UE 2016/679 (GDPR)</p>

      <h2 style={s.h2}>1. Titolare del Trattamento</h2>
      <p style={s.p}>Stylistgo (di seguito «Stylistgo»), nella persona del suo legale rappresentante, è il Titolare del Trattamento per i dati degli utenti della piattaforma (titolari di saloni). Per i dati dei clienti del salone, il Titolare del Trattamento è il singolo salone; Stylistgo agisce come Responsabile del Trattamento.</p>
      <p style={s.p}><strong>Contatto DPO</strong>: privacy@stylistgo.it</p>

      <h2 style={s.h2}>2. Dati Trattati e Finalità</h2>
      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.th}>Categoria</th>
            <th style={s.th}>Dati</th>
            <th style={s.th}>Finalità</th>
            <th style={s.th}>Base Legale</th>
          </tr>
        </thead>
        <tbody>
          {[
            ['Account titolare', 'Email, nome, password (hashed)', 'Autenticazione, fatturazione', 'Esecuzione contratto (art. 6.1.b)'],
            ['Clienti del salone', 'Nome, telefono†, email, dati estetici', 'CRM, appuntamenti, schede tecniche', 'Consenso cliente (art. 6.1.a + 9.2.a)'],
            ['Dati finanziari', 'Incassi, spese, metodi di pagamento', 'Gestione cassa, report', 'Esecuzione contratto'],
            ['Log sicurezza', 'IP, evento, timestamp', 'Sicurezza e audit', 'Legittimo interesse (art. 6.1.f)'],
            ['Cookie tecnici', 'Token sessione, preferenze tema', 'Funzionamento del servizio', 'Necessità tecnica'],
          ].map(([cat, data, fin, base]) => (
            <tr key={cat}>
              <td style={s.td}><strong>{cat}</strong></td>
              <td style={s.td}>{data}</td>
              <td style={s.td}>{fin}</td>
              <td style={s.td}>{base}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={s.p}>† Il campo <em>telefono cliente</em> è cifrato a riposo con AES-256-GCM prima della memorizzazione in database.</p>

      <h2 style={s.h2}>3. Sicurezza e Crittografia</h2>
      <p style={s.p}>Stylistgo adotta le seguenti misure tecniche e organizzative di sicurezza (DPIA condotta il 01/03/2026):</p>
      <ul style={{ ...s.p, paddingLeft: '20px' }}>
        <li><strong>Crittografia a riposo (AES-256-GCM)</strong>: campi sensibili (telefono, note tecniche) cifrati prima della scrittura in database</li>
        <li><strong>Crittografia in transito (TLS 1.3)</strong>: tutta la comunicazione client-server è cifrata</li>
        <li><strong>Row Level Security (RLS)</strong>: ogni salone può accedere esclusivamente ai propri dati tramite policy Postgres native</li>
        <li><strong>Hashing password Argon2/BCrypt</strong>: le password non sono mai memorizzate in chiaro (delegato a Supabase Auth)</li>
        <li><strong>Audit log</strong>: ogni accesso ai dati sensibili è tracciato nella tabella <code>security_events</code></li>
        <li><strong>Backup automatici</strong>: Supabase effettua backup giornalieri con retention 7 giorni (piano Free)</li>
      </ul>

      <h2 style={s.h2}>4. Localizzazione dei Dati</h2>
      <p style={s.p}>Tutti i dati risiedono <strong>esclusivamente su server nell&apos;Unione Europea</strong>:</p>
      <ul style={{ ...s.p, paddingLeft: '20px' }}>
        <li><strong>Supabase</strong> — EU West (Frankfurt, DE) — DPA disponibile su supabase.com/legal/dpa</li>
        <li><strong>Vercel</strong> — Edge functions EU — DPA disponibile su vercel.com/legal/dpa</li>
      </ul>
      <p style={s.p}>Nessun trasferimento di dati al di fuori dell&apos;UE come definito dal Capo V del GDPR.</p>

      <h2 style={s.h2}>5. Conservazione e Cancellazione Automatica</h2>
      <p style={s.p}>In coerenza con il principio di <strong>minimizzazione dei dati</strong> (art. 5.1.c GDPR):</p>
      <ul style={{ ...s.p, paddingLeft: '20px' }}>
        <li>I dati dei clienti del salone <strong>inattivi da 24 mesi</strong> (nessun appuntamento nel periodo) vengono eliminati automaticamente ogni settimana tramite cron job</li>
        <li>I log di sicurezza (<code>security_events</code>) vengono eliminati dopo <strong>180 giorni</strong></li>
        <li>I dati dell&apos;account del titolare del salone sono conservati fino alla richiesta di cancellazione dellaccount o per 10 anni per obblighi fiscali</li>
      </ul>

      <h2 style={s.h2}>6. Diritti degli Interessati</h2>
      <p style={s.p}>Ai sensi degli artt. 15-22 GDPR, i soggetti interessati (clienti del salone) hanno il diritto di:</p>
      <ul style={{ ...s.p, paddingLeft: '20px' }}>
        <li><strong>Accesso</strong> (art. 15): richiedere una copia dei propri dati</li>
        <li><strong>Rettifica</strong> (art. 16): correggere dati inesatti</li>
        <li><strong>Cancellazione / Diritto all&apos;oblio</strong> (art. 17): il titolare del salone può eliminare fisicamente tutti i dati di un cliente tramite il pulsante «Elimina cliente» nel CRM</li>
        <li><strong>Portabilità</strong> (art. 20): esportare i propri dati in formato JSON strutturato tramite il pulsante «Esporta dati» nel CRM</li>
        <li><strong>Opposizione</strong> (art. 21): opporsi al trattamento per finalità di marketing</li>
      </ul>
      <p style={s.p}>Le richieste possono essere inoltrate anche a privacy@stylistgo.it. Risponderemo entro 30 giorni.</p>

      <h2 style={s.h2}>7. Cookie e Tracciamento</h2>
      <p style={s.p}>Stylistgo utilizza <strong>esclusivamente cookie tecnici strettamente necessari</strong> al funzionamento del servizio. Nessun cookie di profilazione, analytics di terze parti o pubblicità comportamentale. Consulta il <a href="/legal/tos" style={{ color: '#4f46e5' }}>Cookie Banner</a> per l&apos;elenco completo.</p>

      <h2 style={s.h2}>8. Modifiche alla Privacy Policy</h2>
      <p style={s.p}>Le modifiche rilevanti saranno comunicate con almeno 30 giorni di preavviso via email. La versione aggiornata sarà sempre disponibile su questa pagina.</p>

      <h2 style={s.h2}>9. Reclami</h2>
      <p style={s.p}>Hai il diritto di presentare reclamo all&apos;Autorità Garante per la Protezione dei Dati Personali (Garante Privacy) — <a href="https://www.garanteprivacy.it" style={{ color: '#4f46e5' }}>www.garanteprivacy.it</a>.</p>
    </div>
  );
}
