'use client';

import React from 'react';
import { Check, X, Printer } from 'lucide-react';

// ─── Dati piani ───────────────────────────────────────────────────────────────

const PLANS = [
  {
    key: 'starter',
    label: 'Starter',
    price: 25,
    tagline: 'Tutto il necessario per gestire il salone in digitale',
    color: '#818cf8',
    gradient: 'linear-gradient(135deg,#6366f1,#818cf8)',
    colorLight: 'rgba(129,140,248,0.12)',
    colorBorder: 'rgba(129,140,248,0.4)',
    ideal: 'Ideale per saloni con 1-3 operatori che vogliono smettere di usare carta e penna',
    sections: [
      {
        title: 'Calendario & Appuntamenti',
        items: [
          { text: 'Calendario visivo con vista giornaliera, settimanale e mensile', ok: true },
          { text: 'Appuntamenti illimitati', ok: true },
          { text: 'Gestione orari e pause per ogni operatore', ok: true },
          { text: 'Promemoria manuali ai clienti', ok: true },
        ],
      },
      {
        title: 'Clienti',
        items: [
          { text: 'Fino a 500 schede cliente', ok: true },
          { text: 'Storico appuntamenti per cliente', ok: true },
          { text: 'Note e preferenze personali', ok: true },
          { text: 'Clienti illimitati', ok: false },
        ],
      },
      {
        title: 'Cassa & Pagamenti',
        items: [
          { text: 'Cassa integrata con riepilogo incassi', ok: true },
          { text: 'Pagamenti in contanti e carta', ok: true },
          { text: 'Gift card e buoni regalo', ok: true },
          { text: 'Abbonamenti e tessere fedeltà', ok: true },
        ],
      },
      {
        title: 'Operatori',
        items: [
          { text: 'Fino a 3 operatori', ok: true },
          { text: 'Profilo e colore calendario per operatore', ok: true },
          { text: 'Report per singolo operatore', ok: false },
          { text: 'Operatori illimitati', ok: false },
        ],
      },
      {
        title: 'Analytics & Report',
        items: [
          { text: 'Riepilogo giornaliero incassi', ok: true },
          { text: 'Analytics avanzata e grafici', ok: false },
          { text: 'Report mensili esportabili', ok: false },
          { text: 'Report per operatore', ok: false },
        ],
      },
      {
        title: 'Avanzate',
        items: [
          { text: 'Gestione fornitori e magazzino', ok: false },
          { text: 'App cliente per prenotazioni online', ok: false },
          { text: 'WhatsApp automation', ok: false },
          { text: 'Gamification (punti fedeltà, badge)', ok: false },
        ],
      },
      {
        title: 'Supporto',
        items: [
          { text: 'Assistenza via email', ok: true },
          { text: 'Assistenza prioritaria', ok: false },
          { text: 'CSM dedicato', ok: false },
          { text: 'Onboarding guidato in sede', ok: false },
        ],
      },
    ],
  },
  {
    key: 'pro',
    label: 'Pro',
    price: 49,
    tagline: 'Controllo completo del salone, con dati e automazioni',
    color: '#c084fc',
    gradient: 'linear-gradient(135deg,#9333ea,#c084fc)',
    colorLight: 'rgba(192,132,252,0.12)',
    colorBorder: 'rgba(192,132,252,0.45)',
    badge: 'Più scelto',
    ideal: 'Ideale per saloni in crescita con 3-10 operatori che vogliono analytics, magazzino e prenotazioni online',
    sections: [
      {
        title: 'Calendario & Appuntamenti',
        items: [
          { text: 'Calendario visivo con vista giornaliera, settimanale e mensile', ok: true },
          { text: 'Appuntamenti illimitati', ok: true },
          { text: 'Gestione orari e pause per ogni operatore', ok: true },
          { text: 'Promemoria manuali ai clienti', ok: true },
        ],
      },
      {
        title: 'Clienti',
        items: [
          { text: 'Clienti illimitati', ok: true },
          { text: 'Storico appuntamenti per cliente', ok: true },
          { text: 'Note e preferenze personali', ok: true },
          { text: 'Segmentazione clienti per frequenza', ok: true },
        ],
      },
      {
        title: 'Cassa & Pagamenti',
        items: [
          { text: 'Cassa integrata con riepilogo incassi', ok: true },
          { text: 'Pagamenti in contanti e carta', ok: true },
          { text: 'Gift card e buoni regalo', ok: true },
          { text: 'Abbonamenti e tessere fedeltà', ok: true },
        ],
      },
      {
        title: 'Operatori',
        items: [
          { text: 'Fino a 10 operatori', ok: true },
          { text: 'Profilo e colore calendario per operatore', ok: true },
          { text: 'Report per singolo operatore', ok: true },
          { text: 'Operatori illimitati', ok: false },
        ],
      },
      {
        title: 'Analytics & Report',
        items: [
          { text: 'Riepilogo giornaliero incassi', ok: true },
          { text: 'Analytics avanzata e grafici', ok: true },
          { text: 'Report mensili esportabili', ok: true },
          { text: 'Report per operatore', ok: true },
        ],
      },
      {
        title: 'Avanzate',
        items: [
          { text: 'Gestione fornitori e magazzino', ok: true },
          { text: 'App cliente per prenotazioni online', ok: true },
          { text: 'Gamification (punti fedeltà, badge)', ok: true },
          { text: 'WhatsApp automation', ok: false },
        ],
      },
      {
        title: 'Supporto',
        items: [
          { text: 'Assistenza prioritaria (risposta < 24h)', ok: true },
          { text: 'CSM dedicato', ok: false },
          { text: 'Onboarding guidato in sede', ok: false },
          { text: 'SLA risposta < 4h', ok: false },
        ],
      },
    ],
  },
  {
    key: 'business',
    label: 'Business',
    price: 99,
    tagline: 'Tutto Pro + automazione WhatsApp e supporto premium',
    color: '#4ade80',
    gradient: 'linear-gradient(135deg,#059669,#4ade80)',
    colorLight: 'rgba(74,222,128,0.12)',
    colorBorder: 'rgba(74,222,128,0.35)',
    badge: 'Premium',
    ideal: 'Ideale per saloni premium che vogliono recuperare clienti dormienti e automatizzare la comunicazione via WhatsApp',
    sections: [
      {
        title: 'Calendario & Appuntamenti',
        items: [
          { text: 'Calendario visivo con vista giornaliera, settimanale e mensile', ok: true },
          { text: 'Appuntamenti illimitati', ok: true },
          { text: 'Gestione orari e pause per ogni operatore', ok: true },
          { text: 'Promemoria automatici via WhatsApp', ok: true },
        ],
      },
      {
        title: 'Clienti',
        items: [
          { text: 'Clienti illimitati', ok: true },
          { text: 'Storico appuntamenti per cliente', ok: true },
          { text: 'Note e preferenze personali', ok: true },
          { text: 'Riattivazione clienti dormienti automatica', ok: true },
        ],
      },
      {
        title: 'Cassa & Pagamenti',
        items: [
          { text: 'Cassa integrata con riepilogo incassi', ok: true },
          { text: 'Pagamenti in contanti e carta', ok: true },
          { text: 'Gift card e buoni regalo', ok: true },
          { text: 'Abbonamenti e tessere fedeltà', ok: true },
        ],
      },
      {
        title: 'Operatori',
        items: [
          { text: 'Operatori illimitati', ok: true },
          { text: 'Profilo e colore calendario per operatore', ok: true },
          { text: 'Report per singolo operatore', ok: true },
          { text: 'Gestione permessi per ruolo', ok: true },
        ],
      },
      {
        title: 'Analytics & Report',
        items: [
          { text: 'Riepilogo giornaliero incassi', ok: true },
          { text: 'Analytics avanzata e grafici', ok: true },
          { text: 'Report mensili esportabili', ok: true },
          { text: 'Report per operatore', ok: true },
        ],
      },
      {
        title: 'Avanzate',
        items: [
          { text: 'Gestione fornitori e magazzino', ok: true },
          { text: 'App cliente per prenotazioni online', ok: true },
          { text: 'Gamification (punti fedeltà, badge)', ok: true },
          { text: 'WhatsApp automation (istanza UltraMsg inclusa)', ok: true },
        ],
      },
      {
        title: 'Supporto',
        items: [
          { text: 'Assistenza prioritaria', ok: true },
          { text: 'CSM dedicato', ok: true },
          { text: 'Onboarding guidato in sede', ok: true },
          { text: 'SLA risposta < 4h', ok: true },
        ],
      },
    ],
  },
];

const ALL_FEATURES = [
  { category: 'Calendario', label: 'Appuntamenti illimitati' },
  { category: 'Calendario', label: 'Vista giornaliera / settimanale / mensile' },
  { category: 'Calendario', label: 'Promemoria automatici WhatsApp' },
  { category: 'Clienti', label: 'Clienti illimitati' },
  { category: 'Clienti', label: 'Storico e schede cliente' },
  { category: 'Clienti', label: 'Riattivazione clienti dormienti' },
  { category: 'Cassa', label: 'Cassa integrata' },
  { category: 'Cassa', label: 'Gift card e buoni regalo' },
  { category: 'Cassa', label: 'Abbonamenti / tessere fedeltà' },
  { category: 'Operatori', label: 'Fino a 3 operatori' },
  { category: 'Operatori', label: 'Fino a 10 operatori' },
  { category: 'Operatori', label: 'Operatori illimitati' },
  { category: 'Analytics', label: 'Analytics avanzata e grafici' },
  { category: 'Analytics', label: 'Report mensili esportabili' },
  { category: 'Analytics', label: 'Report per operatore' },
  { category: 'Avanzate', label: 'Prenotazioni online (app cliente)' },
  { category: 'Avanzate', label: 'Gestione fornitori e magazzino' },
  { category: 'Avanzate', label: 'Gamification (punti, badge)' },
  { category: 'Avanzate', label: 'WhatsApp automation inclusa' },
  { category: 'Supporto', label: 'Assistenza prioritaria' },
  { category: 'Supporto', label: 'CSM dedicato' },
  { category: 'Supporto', label: 'Onboarding in sede' },
];

const COMPARE: Record<string, { starter: boolean; pro: boolean; business: boolean }> = {
  'Appuntamenti illimitati':                { starter: true,  pro: true,  business: true  },
  'Vista giornaliera / settimanale / mensile': { starter: true, pro: true, business: true },
  'Promemoria automatici WhatsApp':         { starter: false, pro: false, business: true  },
  'Clienti illimitati':                     { starter: false, pro: true,  business: true  },
  'Storico e schede cliente':               { starter: true,  pro: true,  business: true  },
  'Riattivazione clienti dormienti':        { starter: false, pro: false, business: true  },
  'Cassa integrata':                        { starter: true,  pro: true,  business: true  },
  'Gift card e buoni regalo':               { starter: true,  pro: true,  business: true  },
  'Abbonamenti / tessere fedeltà':          { starter: true,  pro: true,  business: true  },
  'Fino a 3 operatori':                     { starter: true,  pro: false, business: false },
  'Fino a 10 operatori':                    { starter: false, pro: true,  business: false },
  'Operatori illimitati':                   { starter: false, pro: false, business: true  },
  'Analytics avanzata e grafici':           { starter: false, pro: true,  business: true  },
  'Report mensili esportabili':             { starter: false, pro: true,  business: true  },
  'Report per operatore':                   { starter: false, pro: true,  business: true  },
  'Prenotazioni online (app cliente)':      { starter: false, pro: true,  business: true  },
  'Gestione fornitori e magazzino':         { starter: false, pro: true,  business: true  },
  'Gamification (punti, badge)':            { starter: false, pro: true,  business: true  },
  'WhatsApp automation inclusa':            { starter: false, pro: false, business: true  },
  'Assistenza prioritaria':                 { starter: false, pro: true,  business: true  },
  'CSM dedicato':                           { starter: false, pro: false, business: true  },
  'Onboarding in sede':                     { starter: false, pro: false, business: true  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function SalesPage() {
  const handlePrint = () => window.print();

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
          .print-page { background: white !important; color: black !important; }
          .plan-card { break-inside: avoid; page-break-inside: avoid; }
          .compare-table { break-inside: avoid; }
        }
      `}</style>

      <div className="print-page" style={{ minHeight: '100vh', background: '#0f0f13', color: '#f4f4f5', fontFamily: 'system-ui, -apple-system, sans-serif', padding: '0' }}>

        {/* Topbar */}
        <div className="no-print" style={{ position: 'sticky', top: 0, zIndex: 50, background: '#13131e', borderBottom: '1px solid #2e2e40', padding: '14px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <a href="/admin" style={{ color: '#71717a', fontSize: '12px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '5px' }}>
              ← Admin Panel
            </a>
            <span style={{ color: '#2e2e40' }}>|</span>
            <span style={{ color: '#f4f4f5', fontWeight: 700, fontSize: '15px' }}>Piani Stylistgo</span>
          </div>
          <button
            onClick={handlePrint}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 20px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', color: 'white', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
          >
            <Printer size={15} /> Esporta PDF
          </button>
        </div>

        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '48px 24px' }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <p style={{ color: '#f59e0b', fontSize: '12px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>STYLISTGO</p>
            <h1 style={{ fontSize: '40px', fontWeight: 900, margin: '0 0 16px', lineHeight: 1.1 }}>
              Il gestionale per il tuo salone
            </h1>
            <p style={{ color: '#a1a1aa', fontSize: '17px', maxWidth: '560px', margin: '0 auto', lineHeight: 1.6 }}>
              Scegli il piano adatto alla tua attività. Inizia gratis per 14 giorni, senza carta di credito.
            </p>
          </div>

          {/* Piano cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '20px', marginBottom: '64px' }}>
            {PLANS.map(plan => (
              <div key={plan.key} className="plan-card" style={{ background: '#1c1c27', border: `2px solid ${plan.colorBorder}`, borderRadius: '24px', padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: '0' }}>

                {/* Badge */}
                {'badge' in plan && plan.badge && (
                  <div style={{ display: 'inline-block', alignSelf: 'flex-start', background: plan.gradient, borderRadius: '999px', padding: '4px 14px', fontSize: '11px', fontWeight: 700, color: 'white', marginBottom: '14px' }}>
                    {plan.badge}
                  </div>
                )}

                {/* Name & price */}
                <p style={{ color: plan.color, fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 6px' }}>{plan.label}</p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '48px', fontWeight: 900, color: '#f4f4f5', lineHeight: 1 }}>€{plan.price}</span>
                  <span style={{ color: '#71717a', fontSize: '14px' }}>/mese</span>
                </div>
                <p style={{ color: '#a1a1aa', fontSize: '13px', lineHeight: 1.5, margin: '0 0 16px' }}>{plan.tagline}</p>

                {/* Ideal for */}
                <div style={{ background: plan.colorLight, border: `1px solid ${plan.colorBorder}`, borderRadius: '12px', padding: '12px 14px', marginBottom: '24px' }}>
                  <p style={{ color: plan.color, fontSize: '11px', fontWeight: 700, margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ideale per</p>
                  <p style={{ color: '#d4d4d8', fontSize: '12px', margin: 0, lineHeight: 1.5 }}>{plan.ideal}</p>
                </div>

                {/* Sections */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {plan.sections.map(sec => (
                    <div key={sec.title}>
                      <p style={{ color: '#52525b', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 8px' }}>{sec.title}</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                        {sec.items.map(item => (
                          <div key={item.text} style={{ display: 'flex', alignItems: 'flex-start', gap: '9px', opacity: item.ok ? 1 : 0.35 }}>
                            <div style={{ width: '17px', height: '17px', borderRadius: '50%', background: item.ok ? plan.colorLight : '#1e1e2a', border: `1px solid ${item.ok ? plan.colorBorder : '#2e2e40'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                              {item.ok
                                ? <Check size={10} style={{ color: plan.color }} />
                                : <X size={10} style={{ color: '#52525b' }} />}
                            </div>
                            <span style={{ color: item.ok ? '#d4d4d8' : '#52525b', fontSize: '12px', lineHeight: 1.5 }}>{item.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <div style={{ marginTop: '28px' }}>
                  <a
                    href="/login"
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: 'block', width: '100%', padding: '13px', borderRadius: '14px', background: plan.gradient, color: 'white', fontWeight: 700, fontSize: '14px', textAlign: 'center', textDecoration: 'none', boxSizing: 'border-box' }}
                  >
                    Inizia con {plan.label} &rarr;
                  </a>
                  <p style={{ color: '#52525b', fontSize: '10px', textAlign: 'center', margin: '8px 0 0' }}>14 giorni gratis, nessuna carta</p>
                </div>
              </div>
            ))}
          </div>

          {/* Tabella comparativa */}
          <div style={{ marginBottom: '64px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 800, textAlign: 'center', margin: '0 0 32px' }}>Confronto dettagliato</h2>
            <div className="compare-table" style={{ background: '#1c1c27', border: '1px solid #2e2e40', borderRadius: '20px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #2e2e40' }}>
                    <th style={{ padding: '16px 20px', textAlign: 'left', color: '#71717a', fontWeight: 600, width: '46%' }}>Funzionalità</th>
                    {PLANS.map(p => (
                      <th key={p.key} style={{ padding: '16px 20px', textAlign: 'center', color: p.color, fontWeight: 800, fontSize: '14px' }}>
                        {p.label}<br />
                        <span style={{ color: '#71717a', fontSize: '11px', fontWeight: 400 }}>€{p.price}/mese</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ALL_FEATURES.map((f, i) => {
                    const row = COMPARE[f.label];
                    const isFirst = i === 0 || ALL_FEATURES[i - 1].category !== f.category;
                    return (
                      <React.Fragment key={f.label}>
                        {isFirst && (
                          <tr>
                            <td colSpan={4} style={{ padding: '10px 20px 4px', background: '#12121a', color: '#52525b', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
                              {f.category}
                            </td>
                          </tr>
                        )}
                        <tr style={{ borderBottom: '1px solid #1e1e2a', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                          <td style={{ padding: '12px 20px', color: '#d4d4d8' }}>{f.label}</td>
                          {(['starter', 'pro', 'business'] as const).map(pk => {
                            const plan = PLANS.find(p => p.key === pk)!;
                            return (
                              <td key={pk} style={{ padding: '12px 20px', textAlign: 'center' }}>
                                {row?.[pk]
                                  ? <Check size={18} style={{ color: plan.color, margin: '0 auto', display: 'block' }} />
                                  : <span style={{ color: '#2e2e40', fontSize: '18px', lineHeight: 1 }}>—</span>}
                              </td>
                            );
                          })}
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ROI section */}
          <div style={{ marginBottom: '64px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 800, textAlign: 'center', margin: '0 0 32px' }}>Quanto guadagni usandolo?</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px' }}>
              {[
                { icon: '⏱', value: '~3h', suffix: 'a settimana risparmiate', desc: 'Niente più agenda cartacea, telefonate per confermare appuntamenti e fogli Excel.', color: '#818cf8' },
                { icon: '📅', value: '-30%', suffix: 'di appuntamenti persi', desc: 'I promemoria automatici riducono i no-show. Su 10 appuntamenti al giorno = 3 recuperati.', color: '#4ade80' },
                { icon: '🎁', value: '+€200', suffix: 'al mese dalle gift card', desc: 'I clienti usano le gift card come regalo. Tu incassi subito, il servizio viene erogato dopo.', color: '#fbbf24' },
              ].map(k => (
                <div key={k.value} style={{ background: '#1c1c27', border: '1px solid #2e2e40', borderRadius: '20px', padding: '28px 24px', textAlign: 'center' }}>
                  <div style={{ fontSize: '36px', marginBottom: '8px' }}>{k.icon}</div>
                  <p style={{ color: k.color, fontSize: '36px', fontWeight: 900, margin: '0 0 4px', lineHeight: 1 }}>{k.value}</p>
                  <p style={{ color: '#f4f4f5', fontWeight: 700, fontSize: '14px', margin: '0 0 10px' }}>{k.suffix}</p>
                  <p style={{ color: '#71717a', fontSize: '12px', margin: 0, lineHeight: 1.6 }}>{k.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* FAQ */}
          <div style={{ marginBottom: '64px', maxWidth: '720px', margin: '0 auto 64px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 800, textAlign: 'center', margin: '0 0 32px' }}>Domande frequenti</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { q: 'Posso cambiare piano in qualsiasi momento?', a: 'Sì. Puoi passare da Starter a Pro o a Business in qualsiasi momento. Il cambio è immediato e il costo viene proporzionato ai giorni rimanenti del mese.' },
                { q: 'Cos\'è il trial gratuito?', a: '14 giorni di accesso completo a tutte le funzioni del piano Pro, senza inserire una carta di credito. Alla scadenza scegli il piano che preferisci o smetti — nessun addebito automatico.' },
                { q: 'I dati sono al sicuro?', a: 'Sì. Tutti i dati sono salvati su Supabase (infrastruttura Postgres su AWS), crittografati e con backup giornalieri. Non condividiamo i dati con terze parti.' },
                { q: 'Funziona anche da smartphone?', a: 'Sì. Il gestionale è una web app ottimizzata per mobile. Nessuna app da installare — basta aprire il browser e aggiungere il link alla schermata home.' },
                { q: 'Cos\'è WhatsApp automation?', a: 'Con il piano Business configuriamo un numero WhatsApp dedicato al tuo salone. Il sistema manda automaticamente promemoria prima degli appuntamenti, messaggi di follow-up dopo e campagne di riattivazione ai clienti che non vengono da 30+ giorni.' },
              ].map(faq => (
                <div key={faq.q} style={{ background: '#1c1c27', border: '1px solid #2e2e40', borderRadius: '14px', padding: '20px 24px' }}>
                  <p style={{ color: '#f4f4f5', fontWeight: 700, fontSize: '14px', margin: '0 0 6px' }}>{faq.q}</p>
                  <p style={{ color: '#a1a1aa', fontSize: '13px', margin: 0, lineHeight: 1.6 }}>{faq.a}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Footer CTA */}
          <div style={{ textAlign: 'center', padding: '40px 24px', background: '#1c1c27', border: '1px solid #2e2e40', borderRadius: '24px' }}>
            <h3 style={{ fontSize: '28px', fontWeight: 900, margin: '0 0 12px' }}>Inizia gratis oggi</h3>
            <p style={{ color: '#a1a1aa', fontSize: '15px', margin: '0 0 28px' }}>14 giorni senza impegno. Nessuna carta di credito richiesta.</p>
            <a
              href="/login"
              target="_blank"
              rel="noreferrer"
              className="no-print"
              style={{ display: 'inline-block', padding: '14px 40px', borderRadius: '14px', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', color: 'white', fontWeight: 700, fontSize: '16px', textDecoration: 'none' }}
            >
              Registrati gratis &rarr;
            </a>
            <p style={{ color: '#3f3f5a', fontSize: '11px', margin: '16px 0 0' }}>stylistgo.netlify.app</p>
          </div>

        </div>
      </div>
    </>
  );
}
