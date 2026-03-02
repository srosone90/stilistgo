/**
 * Plan feature gates — defines what each plan can access.
 * Used both server-side (API) and client-side (Sidebar/views).
 */

export type Plan = 'trial' | 'starter' | 'pro' | 'business' | 'enterprise';

export interface PlanFeatures {
  calendar: boolean;
  clients: boolean;
  services: boolean;
  staff: boolean;
  maxOperators: number;  // max number of operators
  inventory: boolean;
  cash: boolean;
  analysis: boolean;
  gamification: boolean;
  loyalty: boolean;
  bookings: boolean;     // online bookings
  dashboard: boolean;
  tabella: boolean;
}

export const PLAN_FEATURES: Record<Plan, PlanFeatures> = {
  trial: {
    calendar: true, clients: true, services: true, staff: true, maxOperators: 2,
    inventory: false, cash: false, analysis: false, gamification: false,
    loyalty: false, bookings: false, dashboard: true, tabella: false,
  },
  starter: {
    calendar: true, clients: true, services: true, staff: true, maxOperators: 5,
    inventory: true, cash: true, analysis: false, gamification: false,
    loyalty: true, bookings: true, dashboard: true, tabella: true,
  },
  pro: {
    calendar: true, clients: true, services: true, staff: true, maxOperators: 10,
    inventory: true, cash: true, analysis: true, gamification: true,
    loyalty: true, bookings: true, dashboard: true, tabella: true,
  },
  business: {
    calendar: true, clients: true, services: true, staff: true, maxOperators: 999,
    inventory: true, cash: true, analysis: true, gamification: true,
    loyalty: true, bookings: true, dashboard: true, tabella: true,
  },
  enterprise: {
    calendar: true, clients: true, services: true, staff: true, maxOperators: 999,
    inventory: true, cash: true, analysis: true, gamification: true,
    loyalty: true, bookings: true, dashboard: true, tabella: true,
  },
};

export function getPlanFeatures(plan: string): PlanFeatures {
  return PLAN_FEATURES[plan as Plan] ?? PLAN_FEATURES.trial;
}

export const PLAN_LABELS: Record<Plan, string> = {
  trial: 'Trial', starter: 'Starter', pro: 'Pro', business: 'Business', enterprise: 'Enterprise',
};

/** Maps a sidebar view id to the feature key that gates it */
export const VIEW_TO_FEATURE: Record<string, keyof PlanFeatures> = {
  inventory: 'inventory',
  cash: 'cash',
  analisi: 'analysis',
  gamification: 'gamification',
  loyalty: 'loyalty',
  bookings: 'bookings',
  tabella: 'tabella',
};

/** Upgrade messages per view */
export const UPGRADE_TEXT: Record<string, { plan: string; description: string }> = {
  inventory:    { plan: 'Starter',  description: 'Gestisci il magazzino prodotti e le giacenze.' },
  cash:         { plan: 'Starter',  description: 'Modulo cassa, pagamenti e sessioni POS.' },
  analisi:      { plan: 'Pro',      description: 'Grafici avanzati su fatturato, clienti e servizi.' },
  gamification: { plan: 'Pro',      description: 'Badge, sfide e classifiche per il team.' },
  loyalty:      { plan: 'Starter',  description: 'Programma fedeltà e punti per i clienti.' },
  bookings:     { plan: 'Starter',  description: 'Ricevi prenotazioni online dal tuo link personale.' },
  tabella:      { plan: 'Starter',  description: 'Vista tabellare di tutti i dati del salone.' },
};
