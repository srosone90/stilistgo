import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Data Processing Agreement (DPA) — Stylistgo',
  description: 'Accordo sul Trattamento dei Dati ai sensi dell\'art. 28 GDPR tra il salone (Titolare) e Stylistgo (Responsabile).',
};

const s = {
  page: { maxWidth: '780px', margin: '0 auto', padding: '40px 24px 80px', fontFamily: 'system-ui,sans-serif', color: '#1a1a2e' } as React.CSSProperties,
  h1: { fontSize: '28px', fontWeight: 800, marginBottom: '6px' } as React.CSSProperties,
  meta: { color: '#6b7280', fontSize: '13px', marginBottom: '36px' } as React.CSSProperties,
  h2: { fontSize: '17px', fontWeight: 700, marginTop: '32px', marginBottom: '8px', color: '#4f46e5' } as React.CSSProperties,
  h3: { fontSize: '14px', fontWeight: 700, marginTop: '16px', marginBottom: '4px' } as React.CSSProperties,
  p: { fontSize: '14px', lineHeight: '1.7', marginBottom: '12px' } as React.CSSProperties,
  back: { display: 'inline-block', marginBottom: '24px', color: '#4f46e5', textDecoration: 'none', fontSize: '14px' } as React.CSSProperties,
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '13px', marginBottom: '16px' },
  th: { background: '#f3f4f6', padding: '8px 12px', textAlign: 'left' as const, fontWeight: 600, borderBottom: '1px solid #d1d5db' },
  td: { padding: '8px 12px', borderBottom: '1px solid #e5e7eb', verticalAlign: 'top' as const },
  box: { background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '16px', marginBottom: '16px', fontSize: '14px', lineHeight: '1.6' } as React.CSSProperties,
};

export default function DpaPage() {
  return (
    <div style={s.page}>
      <a href="/" style={s.back}>← Torna al gestionale</a>
      <h1 style={s.h1}>Data Processing Agreement (DPA)</h1>
      <p style={s.meta}>
        Accordo sul Trattamento dei Dati ai sensi dell&apos;art. 28 GDPR — Versione 1.0 — In vigore dal 1° marzo 2026
      </p>

      <div style={s.box}>
        <strong>Nota:</strong> Il presente DPA viene accettato automaticamente al momento dell&apos;accettazione dei Termini di Servizio Stylistgo. Costituisce parte integrante del contratto di licenza.
      </div>

      <h2 style={s.h2}>1. Parti del Contratto</h2>
      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.th}>Ruolo GDPR</th>
            <th style={s.th}>Soggetto</th>
            <th style={s.th}>Descrizione</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={s.td}><strong>Titolare del Trattamento</strong><br />(Controller)</td>
            <td style={s.td}>Il salone / parrucchiere<br />(Account Stylistgo)</td>
            <td style={s.td}>Determina le finalità e i mezzi del trattamento dei dati dei propri clienti</td>
          </tr>
          <tr>
            <td style={s.td}><strong>Responsabile del Trattamento</strong><br />(Processor)</td>
            <td style={s.td}>Stylistgo</td>
            <td style={s.td}>Tratta i dati per conto del Titolare fornendo la piattaforma gestionale</td>
          </tr>
        </tbody>
      </table>

      <h2 style={s.h2}>2. Oggetto e Durata del Trattamento</h2>
      <p style={s.p}>Stylistgo tratta i dati personali dei clienti del salone esclusivamente per fornire i servizi della piattaforma: gestione appuntamenti, CRM, schede tecniche, report, prenotazioni online. Il trattamento si protrae per tutta la durata dell&apos;abbonamento attivo e cessa entro 90 giorni dalla disdetta, previa consegna di dump completo dei dati su richiesta.</p>

      <h2 style={s.h2}>3. Natura e Finalità del Trattamento</h2>
      <ul style={{ ...s.p, paddingLeft: '20px' }}>
        <li>Memorizzazione e recupero di dati anagrafici e di servizio dei clienti del salone</li>
        <li>Generazione di report e statistiche aggregate per il titolare del salone</li>
        <li>Invio di comunicazioni WhatsApp per conto del salone (previa autorizzazione esplicita)</li>
        <li>Gestione prenotazioni online attraverso widget pubblico</li>
        <li>Backup automatici e disaster recovery</li>
      </ul>

      <h2 style={s.h2}>4. Categorie di Dati e Interessati</h2>
      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.th}>Categoria</th>
            <th style={s.th}>Descrizione</th>
            <th style={s.th}>Speciale cat. (art.9)?</th>
          </tr>
        </thead>
        <tbody>
          {[
            ['Dati anagrafici', 'Nome, cognome, telefono †, email cliente', 'No'],
            ['Dati di trattamento estetico', 'Colori, prodotti, allergie, note tecniche †', 'Sì — dati sulla salute/allergie'],
            ['Dati transazionali', 'Appuntamenti, servizi effettuati, importi', 'No'],
            ['Dati comportamentali', 'Frequenza visite, prodotti acquistati', 'No'],
          ].map(([cat, desc, spec]) => (
            <tr key={cat}>
              <td style={s.td}><strong>{cat}</strong></td>
              <td style={s.td}>{desc}</td>
              <td style={s.td}>{spec}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={s.p}>† Cifrati con AES-256-GCM prima della memorizzazione in database (vedi art. 5).</p>
      <p style={s.p}><strong>Interessati</strong>: clienti dei saloni abbonati alla piattaforma.</p>

      <h2 style={s.h2}>5. Misure di Sicurezza Tecniche e Organizzative</h2>
      <p style={s.p}>Stylistgo implementa le seguenti misure ai sensi dell&apos;art. 32 GDPR:</p>

      <h3 style={s.h3}>5.1 Crittografia</h3>
      <ul style={{ ...s.p, paddingLeft: '20px' }}>
        <li><strong>AES-256-GCM</strong>: campi sensibili (telefono cliente, note tecniche) cifrati a livello applicativo con chiave derivata da HSM env secret prima della persistenza</li>
        <li><strong>TLS 1.3</strong>: tutte le comunicazioni client-server</li>
        <li><strong>Argon2 / BCrypt</strong>: tutte le password, mai memorizzate in chiaro</li>
      </ul>

      <h3 style={s.h3}>5.2 Accesso e Controllo</h3>
      <ul style={{ ...s.p, paddingLeft: '20px' }}>
        <li><strong>Row Level Security (RLS)</strong>: policy Postgres native impediscono l&apos;accesso cross-tenant a livello di database</li>
        <li><strong>Principio del minimo privilegio</strong>: l&apos;applicazione usa chiavi API con scope limitato; accesso service-role solo per operazioni amministrative</li>
        <li><strong>Autenticazione a 2 fattori</strong>: disponibile per tutti gli account</li>
      </ul>

      <h3 style={s.h3}>5.3 Monitoraggio e Auditing</h3>
      <ul style={{ ...s.p, paddingLeft: '20px' }}>
        <li>Log degli eventi di sicurezza in tabella <code>security_events</code> con conservazione di 180 giorni</li>
        <li>Alert automatici per accessi anomali</li>
        <li>Data hygiene cron settimanale per eliminazione automatica dati scaduti</li>
      </ul>

      <h3 style={s.h3}>5.4 Continuità Operativa</h3>
      <ul style={{ ...s.p, paddingLeft: '20px' }}>
        <li>Backup giornalieri automatici (Supabase managed)</li>
        <li>Monitoraggio uptime 24/7</li>
        <li>Piano di risposta agli incidenti con notifica entro 72 ore (art. 33 GDPR)</li>
      </ul>

      <h2 style={s.h2}>6. Sub-Responsabili del Trattamento (Sub-Processor)</h2>
      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.th}>Sub-Processor</th>
            <th style={s.th}>Ruolo</th>
            <th style={s.th}>Localizzazione</th>
            <th style={s.th}>DPA</th>
          </tr>
        </thead>
        <tbody>
          {[
            ['Supabase Inc.', 'Database e autenticazione', 'EU West — Frankfurt, DE', 'supabase.com/legal/dpa'],
            ['Vercel Inc.', 'Hosting applicativo edge', 'EU (Edge nodes)', 'vercel.com/legal/dpa'],
            ['UltraMsg', 'Invio messaggi WhatsApp', 'EU/US', 'ultramsg.com/privacy'],
          ].map(([name, role, loc, dpa]) => (
            <tr key={name}>
              <td style={s.td}><strong>{name}</strong></td>
              <td style={s.td}>{role}</td>
              <td style={s.td}>{loc}</td>
              <td style={s.td}><small>{dpa}</small></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={s.p}>Stylistgo verificherà che ogni nuovo sub-processor garantisca livello di protezione adeguato. Il Titolare sarà informato di eventuali modifiche con 30 giorni di preavviso.</p>

      <h2 style={s.h2}>7. Trasferimenti Internazionali</h2>
      <p style={s.p}>I dati sono <strong>memorizzati esclusivamente nell&apos;UE</strong>. Qualora un sub-processor dovesse effettuare trasferimenti verso paesi terzi, Stylistgo si assicurerà che siano basati su:</p>
      <ul style={{ ...s.p, paddingLeft: '20px' }}>
        <li>Decisione di adeguatezza ex art. 45 GDPR</li>
        <li>Clausole Contrattuali Standard (SCC) adottate dalla Commissione UE ex art. 46.2.c</li>
        <li>Binding Corporate Rules (BCR) ove applicabili</li>
      </ul>

      <h2 style={s.h2}>8. Obblighi del Responsabile (Stylistgo)</h2>
      <p style={s.p}>Stylistgo si impegna a:</p>
      <ul style={{ ...s.p, paddingLeft: '20px' }}>
        <li>Trattare i dati solo su istruzione documentata del Titolare</li>
        <li>Garantire la riservatezza dei dati a tutto il personale autorizzato</li>
        <li>Assistere il Titolare nell&apos;evasione delle richieste degli interessati (DSAR)</li>
        <li>Notificare al Titolare qualsiasi violazione dei dati entro <strong>48 ore</strong> dalla scoperta</li>
        <li>Mettere a disposizione tutte le informazioni necessarie per dimostrare la conformità (art. 28.3.h)</li>
        <li>Cancellare o restituire tutti i dati al termine del servizio</li>
      </ul>

      <h2 style={s.h2}>9. Obblighi del Titolare (Salone)</h2>
      <p style={s.p}>Il Titolare si impegna a:</p>
      <ul style={{ ...s.p, paddingLeft: '20px' }}>
        <li>Raccogliere il consenso esplicito dei propri clienti prima di inserirne i dati in piattaforma</li>
        <li>Fornire ai clienti l&apos;informativa sul trattamento dei dati</li>
        <li>Notificare tempestivamente a Stylistgo eventuali richieste di cancellazione degli interessati</li>
        <li>Non inserire dati di minori di 16 anni senza consenso genitoriale</li>
      </ul>

      <h2 style={s.h2}>10. Diritto all&apos;Oblio e Portabilità</h2>
      <p style={s.p}>Il Titolare può in qualsiasi momento, tramite l&apos;interfaccia del CRM:</p>
      <ul style={{ ...s.p, paddingLeft: '20px' }}>
        <li><strong>Esporta dati (art. 20)</strong>: scarica tutti i dati di un cliente in formato JSON strutturato e leggibile</li>
        <li><strong>Elimina cliente (art. 17)</strong>: cancellazione fisica e irreversibile di tutti i record collegati al cliente (anagrafica, appuntamenti, schede tecniche, transazioni cassa)</li>
      </ul>
      <p style={s.p}>La cancellazione è propagata su tutti i sistemi entro 24 ore.</p>

      <h2 style={s.h2}>11. Durata e Risoluzione</h2>
      <p style={s.p}>Il presente DPA ha la stessa durata del contratto di abbonamento a Stylistgo. In caso di risoluzione, Stylistgo:</p>
      <ul style={{ ...s.p, paddingLeft: '20px' }}>
        <li>Fornisce export completo dei dati entro 30 giorni dalla richiesta</li>
        <li>Cancella definitivamente tutti i dati entro 90 giorni dalla risoluzione</li>
        <li>Rilascia attestazione scritta di avvenuta cancellazione su richiesta</li>
      </ul>

      <h2 style={s.h2}>12. Legge Applicabile e Foro Competente</h2>
      <p style={s.p}>Il presente DPA è regolato dalla legge italiana e dal diritto dell&apos;Unione Europea. Per qualsiasi controversia è competente il Tribunale del luogo di residenza/sede del Titolare del Trattamento.</p>

      <h2 style={s.h2}>13. Contatti</h2>
      <p style={s.p}>Per esercitare i diritti GDPR o per richieste DPA: <strong>privacy@stylistgo.it</strong></p>
    </div>
  );
}
