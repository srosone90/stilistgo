import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Termini e Condizioni — Stylistgo',
  description: 'Termini e Condizioni del servizio SaaS Stylistgo per saloni di parrucchieri.',
};

const s = {
  wrap: { background: '#ffffff', minHeight: '100vh' } as React.CSSProperties,
  page: {
    maxWidth: '780px', margin: '0 auto', padding: '40px 24px 80px',
    fontFamily: 'system-ui, sans-serif', color: '#111111',
  } as React.CSSProperties,
  h1: { fontSize: '28px', fontWeight: 800, marginBottom: '6px', color: '#111' } as React.CSSProperties,
  meta: { color: '#6b7280', fontSize: '13px', marginBottom: '36px' } as React.CSSProperties,
  h2: { fontSize: '17px', fontWeight: 700, marginTop: '32px', marginBottom: '8px', color: '#4f46e5' } as React.CSSProperties,
  p: { fontSize: '14px', lineHeight: '1.7', marginBottom: '12px', color: '#222' } as React.CSSProperties,
  back: { display: 'inline-block', marginBottom: '24px', color: '#4f46e5', textDecoration: 'none', fontSize: '14px' } as React.CSSProperties,
};

export default function TosPage() {
  return (
    <div style={s.wrap}>
    <div style={s.page}>
      <a href="/" style={s.back}>← Torna al gestionale</a>
      <h1 style={s.h1}>Termini e Condizioni di Servizio</h1>
      <p style={s.meta}>Versione 1.0 — In vigore dal 1° marzo 2026 | Stylistgo S.r.l. (o ditta individuale/persona fisica operante sotto il marchio Stylistgo)</p>

      <h2 style={s.h2}>1. Accettazione dei Termini</h2>
      <p style={s.p}>Attivando un account su Stylistgo o utilizzando il software («il Servizio»), il titolare del salone («Cliente» o «Titolare del Trattamento») accetta integralmente i presenti Termini e Condizioni (T&C) e la Privacy Policy. Se non li accetti, non puoi utilizzare il Servizio.</p>

      <h2 style={s.h2}>2. Descrizione del Servizio</h2>
      <p style={s.p}>Stylistgo è un gestionale SaaS (Software-as-a-Service) rivolto a saloni di parrucchieri, centri estetici e servizi similari. Include: agenda appuntamenti, CRM clienti, cassa/POS, magazzino prodotti, prenotazione online, fatturazione, report e automazioni WhatsApp.</p>

      <h2 style={s.h2}>3. Account e Sicurezza</h2>
      <p style={s.p}>Il Cliente è responsabile della sicurezza delle proprie credenziali. Stylistgo utilizza Supabase Auth con hashing password bcrypt/Argon2. Non condividere le credenziali di accesso. In caso di compromissione sospetta, notifica immediatamente support@stylistgo.it.</p>

      <h2 style={s.h2}>4. Abbonamento e Pagamento</h2>
      <p style={s.p}>Il servizio è erogato su base di abbonamento mensile prepagato. I piani disponibili (Trial, Starter, Pro, Business) e i relativi prezzi sono pubblicati su stylistgo.it/prezzi. L&apos;abbonamento si rinnova automaticamente. Il recesso può essere esercitato in qualsiasi momento con effetto al termine del periodo già pagato, senza ulteriori addebiti.</p>

      <h2 style={s.h2}>5. Dati, Privacy e Sicurezza</h2>
      <p style={s.p}>I dati inseriti dal Cliente (anagrafiche clienti, appuntamenti, dati finanziari) rimangono di proprietà esclusiva del Cliente. Stylistgo agisce come Responsabile del Trattamento ai sensi del GDPR. I dati sono:</p>
      <ul style={{ ...s.p, paddingLeft: '20px' }}>
        <li>Cifrati a riposo con AES-256-GCM per i campi sensibili (telefono, note tecniche)</li>
        <li>Conservati esclusivamente su server nell&apos;Unione Europea (Supabase — Frankfurt, DE)</li>
        <li>Protetti da Row Level Security (RLS) Postgres: ogni salone accede solo ai propri dati</li>
        <li>Soggetti a politica di cancellazione automatica: i dati di clienti inattivi da 24+ mesi vengono eliminati automaticamente</li>
      </ul>

      <h2 style={s.h2}>6. Portabilità e Cancellazione dei Dati</h2>
      <p style={s.p}>Il Cliente può in qualsiasi momento:</p>
      <ul style={{ ...s.p, paddingLeft: '20px' }}>
        <li>Esportare tutti i dati di un cliente nel formato JSON standard (dal pannello Clienti)</li>
        <li>Richiedere la cancellazione fisica immediata di un cliente e di tutti i dati associati</li>
        <li>Richiedere la cancellazione completa dell&apos;account e di tutti i dati tramite richiesta a privacy@stylistgo.it</li>
      </ul>

      <h2 style={s.h2}>7. Limitazione di Responsabilità</h2>
      <p style={s.p}>Stylistgo non è responsabile per danni indiretti, perdita di profitto o perdita di dati derivanti dall&apos;utilizzo o dall&apos;impossibilità di utilizzo del servizio, nei limiti consentiti dalla legge applicabile. La responsabilità massima è limitata al valore dell&apos;ultimo canone mensile pagato.</p>

      <h2 style={s.h2}>8. Modifiche ai Termini</h2>
      <p style={s.p}>Le modifiche rilevanti ai presenti Termini saranno notificate con almeno 30 giorni di preavviso tramite email o notifica in-app. Il proseguimento dell&apos;utilizzo del Servizio successivamente alla data di efficacia costituisce accettazione delle modifiche.</p>

      <h2 style={s.h2}>9. Legge Applicabile e Foro Competente</h2>
      <p style={s.p}>I presenti Termini sono regolati dalla legge italiana. Per qualsiasi controversia è competente il Tribunale di [Città sede legale Stylistgo], salvo diversa disposizione imperativa di legge applicabile al consumatore.</p>

      <h2 style={s.h2}>10. Contatti</h2>
      <p style={s.p}>Per assistenza: support@stylistgo.it | Per questioni legali e privacy: privacy@stylistgo.it</p>
    </div>
    </div>
  );
}
