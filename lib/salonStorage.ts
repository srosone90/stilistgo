import {
  Client, TechnicalCard, Service, Operator, Absence,
  Appointment, WaitingListEntry, Product, StockMovement,
  GiftCard, SalonConfig, DEFAULT_SALON_CONFIG, defaultSchedule,
  OPERATOR_COLORS, Payment, CashSession,
} from '@/types/salon';

// ─── Generic helpers ──────────────────────────────────────────────────────────

function getList<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(key) || '[]') as T[];
  } catch { return []; }
}

function saveList<T>(key: string, data: T[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(data));
}

function getItem<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch { return fallback; }
}

export function salonGenerateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Keys ─────────────────────────────────────────────────────────────────────

const K = {
  clients: 'stylistgo_clients',
  technicalCards: 'stylistgo_technical_cards',
  services: 'stylistgo_services',
  operators: 'stylistgo_operators',
  absences: 'stylistgo_absences',
  appointments: 'stylistgo_appointments',
  waitingList: 'stylistgo_waiting_list',
  products: 'stylistgo_products',
  stockMovements: 'stylistgo_stock_movements',
  giftCards: 'stylistgo_gift_cards',
  salonConfig: 'stylistgo_salon_config',
  payments: 'stylistgo_payments',
  cashSessions: 'stylistgo_cash_sessions',
  activeOperatorId: 'stylistgo_active_operator',
};

// ─── Clients ──────────────────────────────────────────────────────────────────

export function storageGetClients(): Client[] { return getList<Client>(K.clients); }
export function storageSaveClients(data: Client[]): void { saveList(K.clients, data); }

// ─── Technical Cards ──────────────────────────────────────────────────────────

export function storageGetTechnicalCards(): TechnicalCard[] { return getList<TechnicalCard>(K.technicalCards); }
export function storageSaveTechnicalCards(data: TechnicalCard[]): void { saveList(K.technicalCards, data); }

// ─── Services ─────────────────────────────────────────────────────────────────

const DEFAULT_SERVICES: Service[] = [
  { id: 'svc-1', name: 'Taglio capelli donna', category: 'Taglio', duration: 45, price: 35, description: '', operatorIds: [], active: true, createdAt: new Date().toISOString() },
  { id: 'svc-2', name: 'Taglio capelli uomo', category: 'Taglio', duration: 30, price: 20, description: '', operatorIds: [], active: true, createdAt: new Date().toISOString() },
  { id: 'svc-3', name: 'Colore base', category: 'Colore', duration: 90, price: 65, description: '', operatorIds: [], active: true, createdAt: new Date().toISOString() },
  { id: 'svc-4', name: 'Balayage / Shatush', category: 'Colore', duration: 150, price: 120, description: '', operatorIds: [], active: true, createdAt: new Date().toISOString() },
  { id: 'svc-5', name: 'Piega', category: 'Piega', duration: 30, price: 25, description: '', operatorIds: [], active: true, createdAt: new Date().toISOString() },
  { id: 'svc-6', name: 'Trattamento cheratina', category: 'Trattamento', duration: 120, price: 90, description: '', operatorIds: [], active: true, createdAt: new Date().toISOString() },
  { id: 'svc-7', name: 'Manicure', category: 'Nail', duration: 45, price: 30, description: '', operatorIds: [], active: true, createdAt: new Date().toISOString() },
  { id: 'svc-8', name: 'Servizio sposa', category: 'Sposa', duration: 180, price: 200, description: '', operatorIds: [], active: true, createdAt: new Date().toISOString() },
];

export function storageGetServices(): Service[] {
  const s = getList<Service>(K.services);
  if (s.length === 0) {
    saveList(K.services, DEFAULT_SERVICES);
    return DEFAULT_SERVICES;
  }
  return s;
}
export function storageSaveServices(data: Service[]): void { saveList(K.services, data); }

// ─── Operators ────────────────────────────────────────────────────────────────

const DEFAULT_OPERATORS: Operator[] = [
  {
    id: 'op-1', name: 'Titolare', email: '', role: 'owner',
    serviceIds: [], color: OPERATOR_COLORS[0],
    commissionRate: 0, schedule: defaultSchedule(),
    active: true, createdAt: new Date().toISOString(),
  },
];

export function storageGetOperators(): Operator[] {
  const s = getList<Operator>(K.operators);
  if (s.length === 0) {
    saveList(K.operators, DEFAULT_OPERATORS);
    return DEFAULT_OPERATORS;
  }
  return s;
}
export function storageSaveOperators(data: Operator[]): void { saveList(K.operators, data); }

// ─── Absences ─────────────────────────────────────────────────────────────────

export function storageGetAbsences(): Absence[] { return getList<Absence>(K.absences); }
export function storageSaveAbsences(data: Absence[]): void { saveList(K.absences, data); }

// ─── Appointments ─────────────────────────────────────────────────────────────

export function storageGetAppointments(): Appointment[] { return getList<Appointment>(K.appointments); }
export function storageSaveAppointments(data: Appointment[]): void { saveList(K.appointments, data); }

// ─── Waiting List ─────────────────────────────────────────────────────────────

export function storageGetWaitingList(): WaitingListEntry[] { return getList<WaitingListEntry>(K.waitingList); }
export function storageSaveWaitingList(data: WaitingListEntry[]): void { saveList(K.waitingList, data); }

// ─── Products ─────────────────────────────────────────────────────────────────

export function storageGetProducts(): Product[] { return getList<Product>(K.products); }
export function storageSaveProducts(data: Product[]): void { saveList(K.products, data); }

// ─── Stock Movements ──────────────────────────────────────────────────────────

export function storageGetStockMovements(): StockMovement[] { return getList<StockMovement>(K.stockMovements); }
export function storageSaveStockMovements(data: StockMovement[]): void { saveList(K.stockMovements, data); }

// ─── Gift Cards ───────────────────────────────────────────────────────────────

export function storageGetGiftCards(): GiftCard[] { return getList<GiftCard>(K.giftCards); }
export function storageSaveGiftCards(data: GiftCard[]): void { saveList(K.giftCards, data); }

// ─── Salon Config ─────────────────────────────────────────────────────────────

export function storageGetSalonConfig(): SalonConfig {
  return getItem<SalonConfig>(K.salonConfig, DEFAULT_SALON_CONFIG);
}
export function storageSaveSalonConfig(data: SalonConfig): void {
  if (typeof window !== 'undefined') localStorage.setItem(K.salonConfig, JSON.stringify(data));
}

// ─── Payments ──────────────────────────────────────────────────────────────────

export function storageGetPayments(): Payment[] { return getList<Payment>(K.payments); }
export function storageSavePayments(data: Payment[]): void { saveList(K.payments, data); }

// ─── Cash Sessions ────────────────────────────────────────────────────────────

export function storageGetCashSessions(): CashSession[] { return getList<CashSession>(K.cashSessions); }
export function storageSaveCashSessions(data: CashSession[]): void { saveList(K.cashSessions, data); }

// ─── Active Operator ─────────────────────────────────────────────────────────

export function storageGetActiveOperatorId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(K.activeOperatorId);
}
export function storageSaveActiveOperatorId(id: string | null): void {
  if (typeof window === 'undefined') return;
  if (id) localStorage.setItem(K.activeOperatorId, id);
  else localStorage.removeItem(K.activeOperatorId);
}
