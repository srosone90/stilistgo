/**
 * Plan feature gates — defines what each plan can access.
 * Used both server-side (API) and client-side (Sidebar/views).
 *
 * ─── Piani e prezzi ──────────────────────────────────────────────────────────
 *  Trial     — gratis 14 giorni (limitato)
 *  Starter   — €25/mese  (gestionale base completo)
 *  Pro       — €49/mese  (avanzato: analytics, magazzino, report, app cliente)
 *  Business  — €99/mese  (Pro + WhatsApp automation illimitata, UltraMsg incluso)
 *
 * ─── Analisi costi Business ──────────────────────────────────────────────────
 *  UltraMsg istanza: $39/mese (~€36) per utente Business
 *  Margine per utente Business: €99 − €36 = €63/mese
 *
 * ─── Costi fissi ─────────────────────────────────────────────────────────────
 *  GitHub Copilot: €10/mese | Dominio: €10/anno (~€0,83/mese)
 *
 * ─── Regime fiscale consigliato ──────────────────────────────────────────────
 *  Forfettario (ATECO software/IT, coeff. 78%)
 *  5% IRPEF primi 5 anni + ~20% INPS → carico totale ~24-25% del lordo
 *  Target lordo ≥ €2.300/mese → netto ≥ €1.750/mese
 */

export type Plan = 'trial' | 'starter' | 'pro' | 'business';

export interface PlanFeatures {
  calendar: boolean;
  clients: boolean;
  services: boolean;
  staff: boolean;
  maxOperators: number;   // max number of operators
  maxClients: number;     // max clients (999999 = unlimited)
  maxServices: number;    // max services (999999 = unlimited)
  inventory: boolean;
  cash: boolean;
  analysis: boolean;
  gamification: boolean;
  loyalty: boolean;
  bookings: boolean;      // online bookings
  dashboard: boolean;
  tabella: boolean;
  giftCards: boolean;
  subscriptions: boolean; // abbonamenti clienti
  suppliers: boolean;     // fornitori
  reportOperators: boolean;
  clientApp: boolean;
  automations: boolean;   // WhatsApp automation (UltraMsg — Business only)
}

export const PLAN_FEATURES: Record<Plan, PlanFeatures> = {
  trial: {
    calendar: true,  clients: true,  services: true,  staff: true,
    maxOperators: 1, maxClients: 50, maxServices: 5,
    inventory: false, cash: false,    analysis: false,  gamification: false,
    loyalty: false,   bookings: false, dashboard: true,  tabella: false,
    giftCards: false, subscriptions: false, suppliers: false,
    reportOperators: false, clientApp: false, automations: false,
  },
  starter: {
    calendar: true,  clients: true,  services: true,  staff: true,
    maxOperators: 3, maxClients: 999999, maxServices: 999999,
    inventory: false, cash: true,    analysis: false,  gamification: false,
    loyalty: true,    bookings: true,  dashboard: true,  tabella: true,
    giftCards: true, subscriptions: true, suppliers: false,
    reportOperators: false, clientApp: false, automations: false,
  },
  pro: {
    calendar: true,  clients: true,  services: true,  staff: true,
    maxOperators: 10, maxClients: 999999, maxServices: 999999,
    inventory: true, cash: true,    analysis: true,   gamification: true,
    loyalty: true,   bookings: true, dashboard: true,  tabella: true,
    giftCards: true, subscriptions: true, suppliers: true,
    reportOperators: true, clientApp: true, automations: false,
  },
  business: {
    calendar: true,  clients: true,  services: true,  staff: true,
    maxOperators: 999, maxClients: 999999, maxServices: 999999,
    inventory: true, cash: true,    analysis: true,   gamification: true,
    loyalty: true,   bookings: true, dashboard: true,  tabella: true,
    giftCards: true, subscriptions: true, suppliers: true,
    reportOperators: true, clientApp: true, automations: true,
  },
};

export function getPlanFeatures(plan: string): PlanFeatures {
  return PLAN_FEATURES[plan as Plan] ?? PLAN_FEATURES.trial;
}

export const PLAN_LABELS: Record<Plan, string> = {
  trial: 'Trial', starter: 'Starter', pro: 'Pro', business: 'Business',
};

/** Price in EUR/month for each plan (trial = 0) */
export const PLAN_PRICES: Record<Plan, number> = {
  trial: 0, starter: 25, pro: 49, business: 99,
};

/** Maps a sidebar view id to the feature key that gates it */
export const VIEW_TO_FEATURE: Record<string, keyof PlanFeatures> = {
  inventory:          'inventory',
  cash:               'cash',
  analisi:            'analysis',
  gamification:       'gamification',
  loyalty:            'loyalty',
  bookings:           'bookings',
  tabella:            'tabella',
  'gift-cards':       'giftCards',
  abbonamenti:        'subscriptions',
  fornitori:          'suppliers',
  'report-operatori': 'reportOperators',
  'client-app':       'clientApp',
  automazioni:        'automations',
};

/** Upgrade messages per view */
export const UPGRADE_TEXT: Record<string, { plan: string; description: string }> = {
  inventory:          { plan: 'Pro',      description: 'Gestisci il magazzino prodotti e le giacenze.' },
  cash:               { plan: 'Starter',  description: 'Modulo cassa, pagamenti e sessioni POS.' },
  analisi:            { plan: 'Pro',      description: 'Grafici avanzati su fatturato, clienti e servizi.' },
  gamification:       { plan: 'Pro',      description: 'Badge, sfide e classifiche per il team.' },
  loyalty:            { plan: 'Starter',  description: 'Programma fedeltà e punti per i clienti.' },
  bookings:           { plan: 'Starter',  description: 'Ricevi prenotazioni online dal tuo link personale.' },
  tabella:            { plan: 'Starter',  description: 'Vista tabellare di tutti i dati del salone.' },
  'gift-cards':       { plan: 'Starter',  description: 'Crea e gestisci gift card per i tuoi clienti.' },
  abbonamenti:        { plan: 'Starter',  description: 'Pacchetti a sedute acquistabili dai clienti.' },
  fornitori:          { plan: 'Pro',      description: 'Gestione fornitori e ordini prodotti.' },
  'report-operatori': { plan: 'Pro',      description: 'Statistiche e performance per operatore.' },
  'client-app':       { plan: 'Pro',      description: 'App personalizzata per i tuoi clienti.' },
  automazioni:        { plan: 'Business', description: 'Messaggi WhatsApp automatici (conferme, reminder, compleanno, post-visita).' },
};
