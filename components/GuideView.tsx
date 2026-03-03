'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Search, X, ChevronDown, ChevronUp, BookOpen, Camera } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface GuideSection {
  id: string;
  category: string;
  categoryColor: string;
  icon: string;
  title: string;
  tags: string[];
  summary: string;
  content: React.ReactNode;
  screenshotSlot?: string; // filename in /public/guide/
  illustration?: React.ReactNode;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function hl(text: string, q: string): React.ReactNode {
  if (!q.trim()) return text;
  const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(re);
  return parts.map((p, i) =>
    re.test(p) ? <mark key={i} style={{ background: 'rgba(251,191,36,0.35)', color: 'inherit', borderRadius: 2 }}>{p}</mark> : p
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 10, padding: '10px 14px', marginTop: 10 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-light)', display: 'block', marginBottom: 4 }}>💡 Suggerimento</span>
      <span style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>{children}</span>
    </div>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 10, padding: '10px 14px', marginTop: 10 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b', display: 'block', marginBottom: 4 }}>⚠️ Attenzione</span>
      <span style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>{children}</span>
    </div>
  );
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol style={{ margin: '10px 0 0', paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((item, i) => (
        <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ minWidth: 22, height: 22, borderRadius: '50%', background: 'rgba(99,102,241,0.2)', color: 'var(--accent-light)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
          <span style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>{item}</span>
        </li>
      ))}
    </ol>
  );
}

function ScreenshotSlot({ label }: { label: string }) {
  return (
    <div style={{
      border: '1.5px dashed var(--border)', borderRadius: 12, padding: '28px 16px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 8, margin: '14px 0', background: 'rgba(255,255,255,0.02)',
    }}>
      <Camera size={22} style={{ color: 'var(--border-light)', opacity: 0.5 }} />
      <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0, textAlign: 'center' }}>
        Screenshot: <em>{label}</em>
      </p>
      <p style={{ fontSize: 11, color: 'var(--border-light)', margin: 0, textAlign: 'center', opacity: 0.7 }}>
        Salva l'immagine in <code style={{ background: 'var(--bg-input)', padding: '1px 5px', borderRadius: 4 }}>/public/guide/{label}</code>
      </p>
    </div>
  );
}

// ─── SVG Illustrations ────────────────────────────────────────────────────────
const DashboardSVG = () => (
  <svg viewBox="0 0 360 160" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', borderRadius: 10, margin: '12px 0' }}>
    <rect width="360" height="160" rx="10" fill="rgba(99,102,241,0.06)" />
    {[0,1,2,3].map(i => (
      <rect key={i} x={12 + i * 86} y="12" width="78" height="46" rx="8" fill="rgba(99,102,241,0.12)" stroke="rgba(99,102,241,0.2)" strokeWidth="1" />
    ))}
    <text x="20" y="30" fill="rgba(255,255,255,0.4)" fontSize="8">Incassi mese</text>
    <text x="20" y="48" fill="rgba(99,102,241,0.9)" fontSize="14" fontWeight="bold">€4.280</text>
    <text x="106" y="30" fill="rgba(255,255,255,0.4)" fontSize="8">Appuntamenti</text>
    <text x="106" y="48" fill="#22c55e" fontSize="14" fontWeight="bold">48</text>
    <text x="192" y="30" fill="rgba(255,255,255,0.4)" fontSize="8">Clienti attivi</text>
    <text x="192" y="48" fill="#f59e0b" fontSize="14" fontWeight="bold">127</text>
    <text x="278" y="30" fill="rgba(255,255,255,0.4)" fontSize="8">Fondo tasse</text>
    <text x="278" y="48" fill="#ec4899" fontSize="14" fontWeight="bold">€856</text>
    {[30,55,45,70,60,80,65,88,72,90,68,75].map((h, i) => (
      <rect key={i} x={12 + i * 28} y={160 - h} width="20" height={h - 76} rx="4" fill="rgba(99,102,241,0.4)" />
    ))}
    {[30,55,45,70,60,80,65,88,72,90,68,75].map((h, i) => (
      <rect key={i} x={12 + i * 28} y={160 - h + (h - 76)} width="20" height="76" rx="4" fill="rgba(99,102,241,0.15)" />
    ))}
  </svg>
);

const AgendaSVG = () => (
  <svg viewBox="0 0 360 150" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', borderRadius: 10, margin: '12px 0' }}>
    <rect width="360" height="150" rx="10" fill="rgba(99,102,241,0.06)" />
    {['Lun','Mar','Mer','Gio','Ven','Sab'].map((d, i) => (
      <g key={i}>
        <text x={30 + i * 55} y="22" fill="rgba(255,255,255,0.4)" fontSize="9" textAnchor="middle">{d}</text>
      </g>
    ))}
    <rect x="3" y="28" width="52" height="30" rx="6" fill="rgba(99,102,241,0.35)" />
    <text x="7" y="40" fill="white" fontSize="8">09:00 Laura</text>
    <text x="7" y="52" fill="rgba(255,255,255,0.7)" fontSize="7">Piega · Marco</text>
    <rect x="58" y="28" width="52" height="22" rx="6" fill="rgba(34,197,94,0.35)" />
    <text x="62" y="40" fill="white" fontSize="8">09:30 Sara</text>
    <rect x="3" y="64" width="52" height="38" rx="6" fill="rgba(245,158,11,0.35)" />
    <text x="7" y="76" fill="white" fontSize="8">10:30 Giulia</text>
    <text x="7" y="88" fill="rgba(255,255,255,0.7)" fontSize="7">Colore · Chiara</text>
    <rect x="113" y="44" width="52" height="22" rx="6" fill="rgba(236,72,153,0.35)" />
    <text x="117" y="56" fill="white" fontSize="8">10:00 Anna</text>
    <rect x="168" y="28" width="52" height="22" rx="6" fill="rgba(99,102,241,0.35)" />
    <text x="172" y="40" fill="white" fontSize="8">09:00 Paolo</text>
    <rect x="223" y="36" width="52" height="30" rx="6" fill="rgba(34,197,94,0.25)" />
    <text x="227" y="48" fill="white" fontSize="8">09:30 Mario</text>
    <rect x="278" y="28" width="52" height="22" rx="6" fill="rgba(245,158,11,0.25)" />
    <text x="282" y="40" fill="white" fontSize="8">09:00 Lucia</text>
    {[0,1,2,3,4].map(i => (
      <line key={i} x1="3" y1={28 + i * 22} x2="357" y2={28 + i * 22} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
    ))}
  </svg>
);

const CassaSVG = () => (
  <svg viewBox="0 0 360 140" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', borderRadius: 10, margin: '12px 0' }}>
    <rect width="360" height="140" rx="10" fill="rgba(99,102,241,0.06)" />
    <rect x="10" y="10" width="160" height="120" rx="8" fill="rgba(255,255,255,0.04)" stroke="rgba(99,102,241,0.2)" strokeWidth="1" />
    <text x="18" y="28" fill="rgba(255,255,255,0.5)" fontSize="9" fontWeight="bold">CLIENTE</text>
    <rect x="18" y="34" width="120" height="18" rx="5" fill="rgba(255,255,255,0.07)" />
    <text x="26" y="47" fill="rgba(255,255,255,0.4)" fontSize="9">Maria Rossi</text>
    <text x="18" y="70" fill="rgba(255,255,255,0.5)" fontSize="9" fontWeight="bold">SERVIZI</text>
    <text x="18" y="84" fill="rgba(255,255,255,0.3)" fontSize="8">Piega · €25</text>
    <text x="18" y="96" fill="rgba(255,255,255,0.3)" fontSize="8">Colore · €60</text>
    <line x1="18" y1="104" x2="154" y2="104" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
    <text x="18" y="118" fill="rgba(255,255,255,0.7)" fontSize="10" fontWeight="bold">Totale: €85</text>
    <rect x="182" y="10" width="168" height="120" rx="8" fill="rgba(255,255,255,0.04)" stroke="rgba(99,102,241,0.2)" strokeWidth="1" />
    <text x="190" y="28" fill="rgba(255,255,255,0.5)" fontSize="9" fontWeight="bold">PAGAMENTO</text>
    {[['💵 Contanti', '22c55e'], ['💳 Carta', '6366f1'], ['📱 Satispay', 'f59e0b'], ['🎟 Gift Card', 'ec4899']].map(([label, color], i) => (
      <g key={i}>
        <rect x="190" y={36 + i * 22} width="140" height="16" rx="5" fill={i === 0 ? `rgba(34,197,94,0.2)` : 'rgba(255,255,255,0.05)'} stroke={i === 0 ? `rgba(34,197,94,0.4)` : 'transparent'} strokeWidth="1" />
        <text x="198" y={48 + i * 22} fill={i === 0 ? '#22c55e' : 'rgba(255,255,255,0.4)'} fontSize="8">{label as string}</text>
      </g>
    ))}
    <rect x="190" y="106" width="140" height="18" rx="6" fill="rgba(99,102,241,0.5)" />
    <text x="238" y="119" fill="white" fontSize="10" fontWeight="bold">INCASSA</text>
  </svg>
);

const ClientiSVG = () => (
  <svg viewBox="0 0 360 140" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', borderRadius: 10, margin: '12px 0' }}>
    <rect width="360" height="140" rx="10" fill="rgba(99,102,241,0.06)" />
    {[0, 1, 2].map(i => (
      <g key={i}>
        <rect x="10" y={10 + i * 42} width="340" height="36" rx="8" fill="rgba(255,255,255,0.04)" stroke="rgba(99,102,241,0.15)" strokeWidth="1" />
        <circle cx="34" cy={28 + i * 42} r="12" fill={['rgba(99,102,241,0.3)', 'rgba(34,197,94,0.3)', 'rgba(245,158,11,0.3)'][i]} />
        <text x="34" y={32 + i * 42} fill="white" fontSize="10" textAnchor="middle">{['MR','GL','AS'][i]}</text>
        <text x="54" y={24 + i * 42} fill="rgba(255,255,255,0.8)" fontSize="10" fontWeight="bold">{['Maria Rossi','Giulia Longo','Anna Scotti'][i]}</text>
        <text x="54" y={36 + i * 42} fill="rgba(255,255,255,0.3)" fontSize="8">{['Ultima visita: 3 giorni fa', 'Ultima visita: 12 giorni fa', 'Ultima visita: 2 mesi fa'][i]}</text>
        <text x="270" y={24 + i * 42} fill="#f59e0b" fontSize="9">⭐ {[320, 140, 60][i]} pt</text>
        <rect x="270" y={30 + i * 42} width="60" height="10" rx="4" fill={['rgba(34,197,94,0.2)', 'rgba(34,197,94,0.2)', 'rgba(239,68,68,0.2)'][i]} />
        <text x="300" y={39 + i * 42} fill={['#22c55e','#22c55e','#ef4444'][i]} fontSize="7" textAnchor="middle">{['Attiva','Attiva','Dormiente'][i]}</text>
      </g>
    ))}
  </svg>
);

// ─── Guide Content ─────────────────────────────────────────────────────────────
const SECTIONS: GuideSection[] = [
  // ── CONTABILITÀ ──────────────────────────────────────────────────────────────
  {
    id: 'dashboard',
    category: 'Contabilità',
    categoryColor: '#6366f1',
    icon: '📊',
    title: 'Dashboard',
    tags: ['KPI', 'statistiche', 'incassi', 'grafici', 'overview', 'mensile', 'giornaliero'],
    summary: 'Panoramica in tempo reale delle performance del salone.',
    illustration: <DashboardSVG />,
    content: (
      <>
        <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, margin: '0 0 10px' }}>
          La Dashboard è la prima cosa che vedi al login: mostra in un colpo d'occhio i numeri più importanti del salone.
        </p>
        <Steps items={[
          'I 4 KPI principali in alto mostrano: incassi del mese, numero di appuntamenti, clienti attivi e fondo tasse accantonato.',
          'Il grafico a barre mostra l\'andamento degli incassi negli ultimi 12 mesi. Passaci sopra con il mouse per vedere il dettaglio.',
          'La sezione "Ultimi movimenti" elenca le voci contabili più recenti con data, importo e categoria.',
          'Il pannello "Appuntamenti oggi" mostra tutti gli slot del giorno corrente.',
        ]} />
        <Tip>La dashboard si aggiorna in tempo reale: se un'altra scheda registra un pagamento, il KPI si aggiorna automaticamente grazie al sync Supabase.</Tip>
        <ScreenshotSlot label="dashboard-overview.png" />
      </>
    ),
  },
  {
    id: 'tabella',
    category: 'Contabilità',
    categoryColor: '#6366f1',
    icon: '📋',
    title: 'Tabella Contabilità',
    tags: ['entrate', 'uscite', 'filtri', 'ricerca', 'movimenti', 'contanti', 'carta', 'export'],
    summary: 'Registro completo di entrate e uscite con filtri avanzati.',
    content: (
      <>
        <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, margin: '0 0 10px' }}>
          La sezione Tabella è il registro contabile principale. Ogni incasso dalla Cassa o voce inserita manualmente compare qui.
        </p>
        <Steps items={[
          'Clicca il pulsante "+" (FAB in basso a destra) per aggiungere manualmente un\'entrata o un\'uscita.',
          'Usa la barra di ricerca in cima per cercare per cliente, nota o categoria.',
          'I filtri "Periodo", "Tipo" e "Categoria" permettono di isolare esattamente le voci che cerchi.',
          'Clicca su una voce per vederne il dettaglio o modificarla.',
          'Il totale netto (entrate − uscite) è sempre visibile in cima alla lista.',
        ]} />
        <Tip>Le voci generate dalla Cassa hanno sorgente "Prenotato" o "Diretta". Quelle inserite manualmente hanno sorgente personalizzabile.</Tip>
        <Warning>Le voci non possono essere eliminate in blocco — vanno rimosse una ad una per sicurezza contabile.</Warning>
        <ScreenshotSlot label="tabella-contabilita.png" />
      </>
    ),
  },
  {
    id: 'analisi',
    category: 'Contabilità',
    categoryColor: '#6366f1',
    icon: '📈',
    title: 'Analisi',
    tags: ['grafici', 'categoria', 'trend', 'annuale', 'breakdown', 'statistiche avanzate'],
    summary: 'Grafici e breakdown per categoria, operatore e periodo.',
    content: (
      <>
        <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, margin: '0 0 10px' }}>
          La sezione Analisi trasforma i dati contabili in grafici leggibili per prendere decisioni informate.
        </p>
        <Steps items={[
          'Seleziona il periodo di analisi (mese, trimestre, anno) dal selettore in cima.',
          'Il grafico a torta mostra la distribuzione delle entrate per categoria (Hairstyle, Colore, Nail Care, ecc.).',
          'Il grafico a linee confronta l\'andamento mensile rispetto all\'anno precedente.',
          'La tabella breakdown elenca le categorie ordinate per importo totale.',
          'Usa il filtro operatore per vedere le performance del singolo stilista.',
        ]} />
        <Tip>Esporta i dati come PDF dalla sezione Impostazioni → Dati Contabilità → Esporta PDF.</Tip>
        <ScreenshotSlot label="analisi-grafici.png" />
      </>
    ),
  },
  {
    id: 'impostazioni',
    category: 'Contabilità',
    categoryColor: '#6366f1',
    icon: '⚙️',
    title: 'Impostazioni',
    tags: ['configurazione', 'salone', 'orari', 'slot', 'tasse', 'backup', 'importa', 'esporta', 'P.IVA', 'valuta'],
    summary: 'Configurazione completa: info salone, orari, fedeltà, backup.',
    content: (
      <>
        <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, margin: '0 0 10px' }}>
          Le Impostazioni raccolgono tutta la configurazione del salone, divisa in sezioni distinte.
        </p>
        <Steps items={[
          '🏢 Info Salone: nome, indirizzo, telefono, email, P.IVA e nota standard sulle ricevute.',
          '🗓️ Agenda & Orari: imposta apertura/chiusura, durata slot (15/30/60 min) e giorni lavorativi.',
          '⭐ Fedeltà: configura i punti per ogni euro speso e la soglia "cliente dormiente".',
          '🎟️ Gift Card: crea e gestisci le gift card fisiche o digitali.',
          '🏦 Fondo Tasse: percentuale da accantonare virtualmente su ogni entrata.',
          '💾 Backup: esporta o importa un backup JSON completo di tutti i dati.',
          '📊 Contabilità: esporta i movimenti in JSON o PDF, oppure importa da CSV.',
        ]} />
        <Tip>Ogni sezione ha un pulsante "Salva modifiche" separato: ricordati di salvare prima di cambiare sezione.</Tip>
        <ScreenshotSlot label="impostazioni.png" />
      </>
    ),
  },

  // ── GESTIONALE ───────────────────────────────────────────────────────────────
  {
    id: 'calendar',
    category: 'Gestionale Salone',
    categoryColor: '#22c55e',
    icon: '🗓️',
    title: 'Agenda',
    tags: ['appuntamento', 'calendario', 'operatore', 'slot', 'prenotazione', 'drag', 'settimana', 'giorno'],
    summary: 'Gestione completa degli appuntamenti con vista giornaliera e settimanale.',
    illustration: <AgendaSVG />,
    content: (
      <>
        <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, margin: '0 0 10px' }}>
          L'Agenda è il cuore del gestionale. Visualizza, crea e modifica appuntamenti in modo visuale.
        </p>
        <Steps items={[
          'Clicca su uno slot libero nella griglia per aprire il form "Nuovo Appuntamento".',
          'Seleziona cliente (o creane uno al volo), operatore, uno o più servizi e la data/ora di inizio.',
          'La durata viene calcolata automaticamente sommando i tempi dei servizi selezionati.',
          'Clicca su un appuntamento esistente per modificarlo, cambiarne lo stato o eliminarlo.',
          'Usa i pulsanti "Oggi", "←" e "→" per navigare tra i giorni.',
          'Filtra per operatore con il selettore in cima: ogni operatore ha un colore diverso.',
          'Il tasto "Vai in cassa" sull\'appuntamento apre direttamente la Cassa pre-compilata.',
        ]} />
        <Tip>Vuoi spostare un appuntamento? Clicca e trascina il blocco nella griglia — la durata viene mantenuta automaticamente.</Tip>
        <Warning>Gli appuntamenti delle prossime 24 ore con cliente che ha il numero di telefono vengono inviati come promemoria WhatsApp se le automazioni sono attive.</Warning>
        <ScreenshotSlot label="agenda-settimanale.png" />
      </>
    ),
  },
  {
    id: 'clients',
    category: 'Gestionale Salone',
    categoryColor: '#22c55e',
    icon: '👥',
    title: 'Clienti',
    tags: ['cliente', 'scheda', 'storico', 'fedeltà', 'punti', 'dormiente', 'compleanno', 'note', 'telefono'],
    summary: 'Registro clienti con storico visite, punti fedeltà e segmentazione.',
    illustration: <ClientiSVG />,
    content: (
      <>
        <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, margin: '0 0 10px' }}>
          Il registro clienti raccoglie tutte le informazioni e la storia di ogni persona che frequenta il salone.
        </p>
        <Steps items={[
          'Clicca "+" per aggiungere un nuovo cliente: nome, cognome, telefono, email, data di nascita.',
          'Clicca su un cliente per aprirne la scheda completa con storico appuntamenti e pagamenti.',
          'I punti fedeltà si accumulano automaticamente ad ogni pagamento in base alla configurazione in Impostazioni.',
          'Il badge "Dormiente" compare automaticamente se il cliente non visita il salone da N giorni (configurabile).',
          'Usa la ricerca in cima per trovare clienti per nome, cognome o telefono.',
          'Puoi aggiungere note private al cliente (allergie, preferenze, ecc.).',
        ]} />
        <Tip>Filtra per "Dormienti" per identificare i clienti da riconquistare con un messaggio WhatsApp personalizzato.</Tip>
        <ScreenshotSlot label="clienti-lista.png" />
      </>
    ),
  },
  {
    id: 'services',
    category: 'Gestionale Salone',
    categoryColor: '#22c55e',
    icon: '✨',
    title: 'Servizi',
    tags: ['servizio', 'prezzo', 'durata', 'categoria', 'listino', 'trattamento'],
    summary: 'Catalogo servizi con prezzi, durate e categorie.',
    content: (
      <>
        <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, margin: '0 0 10px' }}>
          Il catalogo servizi definisce cosa offre il salone: ogni voce viene usata nell'Agenda, nella Cassa e nell'App Cliente.
        </p>
        <Steps items={[
          'Clicca "+" per creare un nuovo servizio: nome, prezzo, durata (in minuti) e categoria.',
          'Le categorie disponibili sono: Hairstyle Donna, Hairstyle Uomo, Colore, Nail Care, Estetica, Servizio Sposa.',
          'La durata viene usata nell\'Agenda per calcolare automaticamente l\'orario di fine slot.',
          'Il prezzo compare nella Cassa quando si seleziona il servizio durante un incasso.',
          'I servizi attivi compaiono nell\'App Cliente pubblica (prenotazioni online).',
        ]} />
        <Tip>Puoi creare servizi "bundle" con durata cumulata — es. "Piega + Colore" come servizio unico se viene sempre venduto insieme.</Tip>
        <ScreenshotSlot label="servizi-catalogo.png" />
      </>
    ),
  },
  {
    id: 'staff',
    category: 'Gestionale Salone',
    categoryColor: '#22c55e',
    icon: '👤',
    title: 'Personale',
    tags: ['operatore', 'stilista', 'PIN', 'permessi', 'ruolo', 'titolare', 'accesso', 'lock screen'],
    summary: 'Gestione operatori con ruoli, PIN e permessi granulari.',
    content: (
      <>
        <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, margin: '0 0 10px' }}>
          La sezione Personale gestisce gli operatori del salone, i loro ruoli e cosa possono vedere/fare nel gestionale.
        </p>
        <Steps items={[
          'Clicca "+" per aggiungere un operatore: nome, ruolo (Titolare / Stilista / Apprendista) e colore calendario.',
          'Imposta un PIN a 4-6 cifre: l\'operatore dovrà inserirlo per accedere alla propria sessione dal Lock Screen.',
          'I permessi granulari permettono di abilitare/disabilitare l\'accesso a: Agenda, Clienti, Servizi, Personale, Magazzino, Cassa, Contabilità.',
          'Il Titolare ha accesso totale e non può essere limitato.',
          'Cambia operatore attivo dal selettore in fondo alla sidebar.',
        ]} />
        <Tip>Usa il Lock Screen (icona 🔒 in sidebar) per passare rapidamente da un operatore all'altro senza fare logout.</Tip>
        <Warning>Se un operatore non ha il PIN impostato, chiunque può selezionarlo senza autenticazione. Imposta sempre un PIN per gli operatori con permessi contabili.</Warning>
        <ScreenshotSlot label="personale-operatori.png" />
      </>
    ),
  },
  {
    id: 'inventory',
    category: 'Gestionale Salone',
    categoryColor: '#22c55e',
    icon: '📦',
    title: 'Magazzino',
    tags: ['prodotto', 'stock', 'scorte', 'inventario', 'soglia', 'alert', 'quantità', 'fornitore'],
    summary: 'Inventario prodotti con alert scorte e gestione fornitori.',
    content: (
      <>
        <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, margin: '0 0 10px' }}>
          Il Magazzino tiene traccia di tutti i prodotti in stock: shampoo, tinte, accessori e tutto ciò che viene utilizzato o venduto.
        </p>
        <Steps items={[
          'Clicca "+" per aggiungere un prodotto: nome, categoria, quantità attuale, soglia minima e prezzo.',
          'Quando la quantità scende sotto la soglia minima, il prodotto viene evidenziato in rosso.',
          'Aggiorna la quantità dopo ogni utilizzo cliccando il prodotto e modificando lo stock.',
          'Collega un prodotto a un fornitore per tracciare facilmente gli ordini.',
          'La sezione Fornitori (vedi sotto) gestisce l\'anagrafica dei fornitori.',
        ]} />
        <Tip>Imposta soglie minime realistiche: es. se riordini quando hai meno di 2 flaconi, metti la soglia a 2.</Tip>
        <ScreenshotSlot label="magazzino-inventario.png" />
      </>
    ),
  },
  {
    id: 'cash',
    category: 'Gestionale Salone',
    categoryColor: '#22c55e',
    icon: '💰',
    title: 'Cassa',
    tags: ['pagamento', 'incasso', 'contanti', 'carta', 'satispay', 'gift card', 'sconto', 'ricevuta', 'cliente', 'appuntamento'],
    summary: 'Registra pagamenti, applica sconti, accetta gift card e abbonamenti.',
    illustration: <CassaSVG />,
    content: (
      <>
        <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, margin: '0 0 10px' }}>
          La Cassa è il punto di vendita integrato: registra ogni incasso, lo collega al cliente e lo sincronizza automaticamente con la contabilità.
        </p>
        <Steps items={[
          'Seleziona il cliente dalla lista o creane uno al volo con il pulsante "+".',
          'Aggiungi i servizi effettuati: il totale si calcola automaticamente.',
          'Applica uno sconto (percentuale o importo fisso) se necessario.',
          'Seleziona il metodo di pagamento: Contanti, Carta, Satispay, Bonifico, Gift Card o Abbonamento.',
          'Clicca "INCASSA" per confermare: il pagamento viene salvato e i punti fedeltà accreditati al cliente.',
          'Puoi aprire la Cassa direttamente dall\'Agenda cliccando "Vai in cassa" su un appuntamento completato.',
        ]} />
        <Tip>Il campo "Note" sull'incasso è utile per specificare dettagli come "pagamento parziale" o "caparra".</Tip>
        <Warning>Se usi Gift Card, verifica che il saldo sia sufficiente prima di concludere l'incasso — il sistema scala automaticamente il valore rimanente.</Warning>
        <ScreenshotSlot label="cassa-pagamento.png" />
      </>
    ),
  },
  {
    id: 'fornitori',
    category: 'Gestionale Salone',
    categoryColor: '#22c55e',
    icon: '🏭',
    title: 'Fornitori',
    tags: ['fornitore', 'ordine', 'acquisto', 'fattura', 'contatto', 'prodotto'],
    summary: 'Anagrafica fornitori collegata al magazzino.',
    content: (
      <>
        <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, margin: '0 0 10px' }}>
          La sezione Fornitori gestisce i contatti dei tuoi fornitori di prodotti e li collega al magazzino.
        </p>
        <Steps items={[
          'Aggiungi un fornitore con: nome azienda, referente, telefono, email e note.',
          'Ogni fornitore può essere associato a uno o più prodotti nel Magazzino.',
          'Registra gli ordini effettuati con data, prodotti e quantità per tenere uno storico acquisti.',
          'Usa la scheda fornitore per accedere rapidamente ai contatti quando devi riordinare.',
        ]} />
        <Tip>Collega ogni prodotto al fornitore corretto: quando lo stock va in alert, sai subito a chi telefonare.</Tip>
        <ScreenshotSlot label="fornitori.png" />
      </>
    ),
  },
  {
    id: 'abbonamenti',
    category: 'Gestionale Salone',
    categoryColor: '#22c55e',
    icon: '💳',
    title: 'Abbonamenti',
    tags: ['abbonamento', 'pacchetto', 'crediti', 'mensile', 'cliente', 'ricorrente'],
    summary: 'Crea e gestisci pacchetti prepagati e abbonamenti ricorrenti.',
    content: (
      <>
        <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, margin: '0 0 10px' }}>
          Gli Abbonamenti permettono di vendere pacchetti prepagati (es. "10 pieghe", "mensile colore") che il cliente scalerà ad ogni visita.
        </p>
        <Steps items={[
          'Clicca "+" per creare un tipo di abbonamento: nome, numero di accessi, prezzo totale e validità.',
          'Assegna l\'abbonamento a un cliente specificando la data di inizio.',
          'In Cassa, seleziona "Abbonamento" come metodo di pagamento: il sistema scalerà automaticamente un accesso.',
          'Visualizza le sessioni rimanenti dal profilo cliente o dalla lista abbonamenti.',
        ]} />
        <Tip>Gli abbonamenti sono un ottimo strumento di fidelizzazione: il cliente prepaga e torna più spesso.</Tip>
        <ScreenshotSlot label="abbonamenti.png" />
      </>
    ),
  },
  {
    id: 'gift-cards',
    category: 'Gestionale Salone',
    categoryColor: '#22c55e',
    icon: '🎟️',
    title: 'Gift Card',
    tags: ['gift card', 'buono', 'regalo', 'codice', 'saldo', 'valore'],
    summary: 'Emetti e gestisci gift card con saldo scalabile.',
    content: (
      <>
        <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, margin: '0 0 10px' }}>
          Le Gift Card permettono di vendere buoni regalo a valore variabile che i clienti possono spendere in una o più visite.
        </p>
        <Steps items={[
          'Vai in Impostazioni → Gift Card oppure nella sezione dedicata.',
          'Clicca "Crea nuova Gift Card": inserisci il valore, la scadenza opzionale e il nome del cliente beneficiario.',
          'Il sistema genera un codice univoco: comunicalo al cliente.',
          'In Cassa, seleziona "Gift Card" come metodo e inserisci il codice: il saldo viene scalato automaticamente.',
          'Il saldo rimanente è sempre visibile nella lista gift card.',
        ]} />
        <Warning>Le gift card scadute vengono mostrate come inattive ma il saldo non viene eliminato — puoi sempre riattivare manualmente.</Warning>
        <ScreenshotSlot label="gift-cards.png" />
      </>
    ),
  },
  {
    id: 'report-operatori',
    category: 'Gestionale Salone',
    categoryColor: '#22c55e',
    icon: '📊',
    title: 'Report Operatori',
    tags: ['report', 'operatore', 'performance', 'incassi', 'appuntamenti', 'statistiche', 'stilista'],
    summary: 'Performance individuali per operatore: incassi, appuntamenti, servizi.',
    content: (
      <>
        <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, margin: '0 0 10px' }}>
          Il Report Operatori mostra le statistiche di performance di ogni stilista nel periodo selezionato.
        </p>
        <Steps items={[
          'Seleziona il periodo (settimana, mese, anno) dal filtro in cima.',
          'Ogni card operatore mostra: numero appuntamenti, incassi totali, servizi più eseguiti.',
          'Il grafico a barre confronta le performance tra operatori.',
          'Puoi filtrare per singolo operatore per una vista più dettagliata.',
        ]} />
        <Tip>Usa questo report per impostare obiettivi mensili nella sezione Gamification.</Tip>
        <ScreenshotSlot label="report-operatori.png" />
      </>
    ),
  },

  // ── TEAM ─────────────────────────────────────────────────────────────────────
  {
    id: 'gamification',
    category: 'Team',
    categoryColor: '#f59e0b',
    icon: '🏆',
    title: 'Gamification',
    tags: ['classifica', 'obiettivi', 'badge', 'team', 'motivazione', 'premi', 'punti operatore'],
    summary: 'Obiettivi, classifiche e badge per motivare il team.',
    content: (
      <>
        <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, margin: '0 0 10px' }}>
          La Gamification introduce un sistema di obiettivi e classifiche per motivare gli operatori e aumentare la produttività del team.
        </p>
        <Steps items={[
          'Visualizza la classifica mensile degli operatori per incassi o numero di appuntamenti.',
          'Imposta obiettivi mensili per ogni operatore (es. "raggiungere €3.000 di incassi").',
          'Quando un obiettivo viene raggiunto, l\'operatore riceve un badge visibile nel suo profilo.',
          'La leaderboard è visibile a tutti gli operatori — crea sana competizione nel team.',
        ]} />
        <Tip>Condividi schermata della classifica a fine mese in chat di gruppo — un piccolo gesto che motiva molto!</Tip>
        <ScreenshotSlot label="gamification.png" />
      </>
    ),
  },
  {
    id: 'loyalty',
    category: 'Team',
    categoryColor: '#f59e0b',
    icon: '⭐',
    title: 'Fidelizzazione',
    tags: ['fedeltà', 'punti', 'premi', 'loyalty', 'milestone', 'sconto fedeltà', 'cliente top'],
    summary: 'Pannello di gestione del programma fedeltà clienti.',
    content: (
      <>
        <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, margin: '0 0 10px' }}>
          La sezione Fidelizzazione offre una vista completa del programma punti: chi ha più punti, chi è vicino a una milestone, chi non viene più.
        </p>
        <Steps items={[
          'Visualizza la classifica clienti per punti fedeltà accumulati.',
          'I clienti vicini alla milestone impostata (es. 100 punti) sono evidenziati in cima.',
          'Quando un cliente raggiunge la milestone, riceve un messaggio WhatsApp automatico (se le automazioni sono attive).',
          'Modifica manualmente i punti di un cliente dalla sua scheda in caso di correzione.',
          'Configura il rapporto punti/euro in Impostazioni → Programma Fedeltà.',
        ]} />
        <Tip>Usa un valore di 1 punto per ogni euro speso come default. Per salone con scontrino medio alto ({'>'}€80), considera 0,5 pt/€.</Tip>
        <ScreenshotSlot label="fidelizzazione.png" />
      </>
    ),
  },

  // ── ONLINE ───────────────────────────────────────────────────────────────────
  {
    id: 'bookings',
    category: 'Online',
    categoryColor: '#ec4899',
    icon: '🌐',
    title: 'Prenotazioni Online',
    tags: ['prenotazione online', 'PWA', 'QR code', 'link', 'richiesta', 'approva', 'rifiuta', 'cliente app'],
    summary: 'Gestione delle richieste di prenotazione arrivate dall\'app cliente pubblica.',
    content: (
      <>
        <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, margin: '0 0 10px' }}>
          La sezione Prenotazioni Online raccoglie tutte le richieste arrivate dall'app di prenotazione pubblica del tuo salone.
        </p>
        <Steps items={[
          'Ogni nuova richiesta appare con stato "In attesa" e mostra: cliente, servizio, data/ora desiderata.',
          'Clicca "Approva" per accettare: la prenotazione viene inserita automaticamente in Agenda.',
          'Clicca "Rifiuta" per declinare: il cliente riceve una notifica nell\'app.',
          'Usa il link/QR code nella sezione App Cliente per condividere la pagina di prenotazione.',
          'Le notifiche nella campanella 🔔 segnalano nuove richieste in tempo reale.',
        ]} />
        <Tip>Attiva le automazioni WhatsApp per inviare un messaggio di conferma automatico quando approvi una prenotazione.</Tip>
        <Warning>Le prenotazioni online arrivano come richieste — non vengono inserite automaticamente in Agenda finché non le approvi.</Warning>
        <ScreenshotSlot label="prenotazioni-online.png" />
      </>
    ),
  },
  {
    id: 'automazioni',
    category: 'Online',
    categoryColor: '#ec4899',
    icon: '💬',
    title: 'Automazioni WhatsApp',
    tags: ['WhatsApp', 'UltraMsg', 'promemoria', 'compleanno', 'automatico', 'fedeltà', 'messaggio', 'template', 'scheduler'],
    summary: 'Invio automatico di messaggi WhatsApp: promemoria, auguri e premi fedeltà.',
    content: (
      <>
        <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, margin: '0 0 10px' }}>
          Le Automazioni inviano messaggi WhatsApp ai tuoi clienti in modo completamente automatico, ogni giorno alle 8:00.
        </p>
        <Steps items={[
          'Vai su ultramsg.com, crea un account e connetti il tuo numero WhatsApp.',
          'Copia il tuo Instance ID e il Token API dalla dashboard UltraMsg.',
          'In Stylistgo → Automazioni, incolla Instance ID e Token e clicca "Connetti".',
          'Attiva le automazioni che desideri: Promemoria appuntamento (giorno prima), Auguri compleanno, Messaggio post-visita, Notifica milestone fedeltà.',
          'Personalizza il testo di ogni messaggio usando le variabili: {{nome}}, {{servizio}}, {{ora}}, {{salone}}, {{punti}}.',
          'Il sistema funziona in autonomia: ogni mattina alle 8 controlla gli appuntamenti del giorno successivo e invia i messaggi.',
        ]} />
        <Tip>Testa sempre il messaggio con il bottone "Invia test" prima di attivare l'automazione — così verifichi che il formato sia corretto.</Tip>
        <Warning>UltraMsg richiede che il numero WhatsApp rimanga connesso (tenere il telefono acceso e connesso a internet). Se la sessione scade, i messaggi non vengono inviati.</Warning>
        <ScreenshotSlot label="automazioni-whatsapp.png" />
      </>
    ),
  },
  {
    id: 'client-app',
    category: 'Online',
    categoryColor: '#ec4899',
    icon: '📱',
    title: 'App Cliente',
    tags: ['app', 'PWA', 'prenotazione pubblica', 'link', 'QR', 'personalizzazione', 'colori', 'logo', 'installazione'],
    summary: 'Personalizza la pagina pubblica di prenotazione per i tuoi clienti.',
    content: (
      <>
        <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, margin: '0 0 10px' }}>
          L'App Cliente è una Progressive Web App (PWA) pubblica che i tuoi clienti possono installare sul telefono per prenotare direttamente.
        </p>
        <Steps items={[
          'Copia il link pubblico o scarica il QR code e condividilo con i tuoi clienti (WhatsApp, Instagram, biglietti da visita).',
          'Personalizza: colore principale, messaggio di benvenuto, testo "About", logo e immagine di copertina.',
          'Scegli lo stile dello sfondo (scuro/neutro/caldo/rosa) e il colore accent.',
          'I clienti vedono i tuoi servizi, scelgono data/ora tra gli slot liberi e inviano la richiesta.',
          'Le richieste arrivano nella sezione Prenotazioni Online per la tua approvazione.',
          'I clienti possono installare l\'app sul telefono con "Aggiungi alla schermata Home" per usarla come un\'app nativa.',
        ]} />
        <Tip>Carica un logo quadrato di almeno 200×200 px e un'immagine di copertina 1200×400 px per un risultato professionale.</Tip>
        <ScreenshotSlot label="client-app-preview.png" />
      </>
    ),
  },
];

// ─── Category colors / groups ─────────────────────────────────────────────────
const CATEGORIES = ['Contabilità', 'Gestionale Salone', 'Team', 'Online'] as const;
const CAT_COLORS: Record<string, string> = {
  'Contabilità': '#6366f1',
  'Gestionale Salone': '#22c55e',
  'Team': '#f59e0b',
  'Online': '#ec4899',
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function GuideView() {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['dashboard']));
  const [activeId, setActiveId] = useState('dashboard');
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const searchRef = useRef<HTMLInputElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);

  // Filter sections by query
  const filtered = useMemo(() => {
    if (!query.trim()) return SECTIONS;
    const q = query.toLowerCase();
    return SECTIONS.filter(s =>
      s.title.toLowerCase().includes(q) ||
      s.summary.toLowerCase().includes(q) ||
      s.tags.some(t => t.toLowerCase().includes(q)) ||
      s.category.toLowerCase().includes(q)
    );
  }, [query]);

  // When search produces results, open matching sections
  useEffect(() => {
    if (query.trim()) {
      setExpanded(new Set(filtered.map(s => s.id)));
    }
  }, [filtered, query]);

  // Scroll spy with IntersectionObserver
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    SECTIONS.forEach(s => {
      const el = sectionRefs.current[s.id];
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveId(s.id); },
        { root: mainRef.current, threshold: 0.3 }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach(o => o.disconnect());
  }, []);

  const toggleSection = useCallback((id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const scrollTo = useCallback((id: string) => {
    const el = sectionRefs.current[id];
    if (!el || !mainRef.current) return;
    mainRef.current.scrollTo({ top: el.offsetTop - 16, behavior: 'smooth' });
    setExpanded(prev => new Set([...prev, id]));
    setActiveId(id);
  }, []);

  const noResults = filtered.length === 0;

  return (
    <div style={{ display: 'flex', height: '100%', gap: 0, overflow: 'hidden' }}>
      {/* ── Left TOC sidebar ──────────────────────────────────────────────────── */}
      <aside style={{
        width: 220, flexShrink: 0, height: '100%', overflowY: 'auto',
        borderRight: '1px solid var(--border)', padding: '20px 12px',
        display: 'flex', flexDirection: 'column', gap: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 4 }}>
          <BookOpen size={16} style={{ color: 'var(--accent-light)' }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Indice</span>
        </div>
        {CATEGORIES.map(cat => {
          const catSections = SECTIONS.filter(s => s.category === cat);
          return (
            <div key={cat}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: CAT_COLORS[cat], marginBottom: 6, paddingLeft: 4 }}>{cat}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {catSections.map(s => {
                  const isActive = activeId === s.id;
                  const inFilter = !query || filtered.some(f => f.id === s.id);
                  return (
                    <button key={s.id} onClick={() => scrollTo(s.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 7,
                        padding: '6px 8px', borderRadius: 7, border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
                        background: isActive ? `${CAT_COLORS[cat]}22` : 'transparent',
                        color: isActive ? CAT_COLORS[cat] : inFilter ? 'var(--muted)' : 'var(--border-light)',
                        opacity: inFilter ? 1 : 0.35,
                        transition: 'all 0.15s',
                        fontSize: 12, fontWeight: isActive ? 600 : 400,
                      }}>
                      <span style={{ fontSize: 13 }}>{s.icon}</span>
                      {s.title}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </aside>

      {/* ── Main content ──────────────────────────────────────────────────────── */}
      <div ref={mainRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 0 }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
            📖 Guida al gestionale
          </h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 16px' }}>
            Documentazione completa di tutte le funzioni di Stylistgo · {SECTIONS.length} sezioni
          </p>

          {/* Search */}
          <div style={{ position: 'relative', maxWidth: 480 }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} />
            <input
              ref={searchRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Cerca funzione, parola chiave, sezione…"
              style={{
                width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 12, padding: '10px 36px 10px 36px', color: 'var(--text)',
                fontSize: 13, outline: 'none',
              }}
              onKeyDown={e => { if (e.key === 'Escape') { setQuery(''); searchRef.current?.blur(); } }}
            />
            {query && (
              <button onClick={() => setQuery('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center' }}>
                <X size={14} />
              </button>
            )}
          </div>
          {query && (
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
              {noResults ? 'Nessun risultato per ' : `${filtered.length} risultat${filtered.length === 1 ? 'o' : 'i'} per `}
              <strong style={{ color: 'var(--text)' }}>"{query}"</strong>
              {noResults && ' — prova con un\'altra parola chiave.'}
            </p>
          )}
        </div>

        {/* Sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {CATEGORIES.map(cat => {
            const catFiltered = filtered.filter(s => s.category === cat);
            if (catFiltered.length === 0) return null;
            return (
              <div key={cat}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, paddingLeft: 2 }}>
                  <div style={{ width: 3, height: 16, borderRadius: 2, background: CAT_COLORS[cat] }} />
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: CAT_COLORS[cat] }}>{cat}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
                  {catFiltered.map(section => {
                    const isOpen = expanded.has(section.id);
                    return (
                      <div
                        key={section.id}
                        ref={el => { sectionRefs.current[section.id] = el; }}
                        style={{
                          background: 'var(--bg-card)', border: `1px solid ${activeId === section.id ? `${CAT_COLORS[section.category]}44` : 'var(--border)'}`,
                          borderRadius: 14, overflow: 'hidden', transition: 'border-color 0.2s',
                        }}
                      >
                        {/* Accordion header */}
                        <button
                          onClick={() => toggleSection(section.id)}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                            padding: '14px 16px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
                          }}
                        >
                          <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{section.icon}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                                {hl(section.title, query)}
                              </span>
                              <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20, background: `${CAT_COLORS[section.category]}22`, color: CAT_COLORS[section.category] }}>
                                {section.category}
                              </span>
                            </div>
                            <p style={{ fontSize: 12, color: 'var(--muted)', margin: '2px 0 0', lineHeight: 1.4 }}>
                              {hl(section.summary, query)}
                            </p>
                          </div>
                          <div style={{ flexShrink: 0, color: 'var(--muted)' }}>
                            {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </div>
                        </button>

                        {/* Tags */}
                        {isOpen && (
                          <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                              {section.tags.map(tag => (
                                <span key={tag} onClick={() => setQuery(tag)} style={{
                                  fontSize: 10, padding: '2px 8px', borderRadius: 20,
                                  background: 'var(--bg-input)', border: '1px solid var(--border)',
                                  color: query === tag ? CAT_COLORS[section.category] : 'var(--muted)',
                                  cursor: 'pointer', transition: 'color 0.1s',
                                }}>
                                  {tag}
                                </span>
                              ))}
                            </div>

                            {/* Illustration if present */}
                            {section.illustration}

                            {/* Main content */}
                            <div>{section.content}</div>

                            {/* Screenshot slot */}
                            {section.screenshotSlot && <ScreenshotSlot label={section.screenshotSlot} />}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)', textAlign: 'center' }}>
          <p style={{ fontSize: 11, color: 'var(--border-light)' }}>Stylistgo · Guida versione 1.0 · {new Date().getFullYear()}</p>
        </div>
      </div>
    </div>
  );
}
