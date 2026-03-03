// ─── Client / CRM ─────────────────────────────────────────────────────────────

export interface Client {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  birthDate: string; // YYYY-MM-DD
  notes: string;
  allergies: string;
  tags: string[];
  gdprConsent: boolean;
  gdprDate: string;
  loyaltyPoints: number;
  createdAt: string;
}

export type HairType = 'lisci' | 'mossi' | 'ricci' | 'crespi' | 'altro';
export type HairCondition = 'sani' | 'secchi' | 'grassi' | 'colorati' | 'trattati' | 'rovinati';

export interface TechnicalCard {
  id: string;
  clientId: string;
  operatorId: string;
  date: string; // YYYY-MM-DD
  serviceDescription: string;
  brand: string;
  formula: string;
  oxidant: string;
  oxidantPct: string;
  posaDuration: number; // minutes
  result: string;
  notes: string;
  // Enhanced fields
  hairType?: HairType;
  hairCondition?: HairCondition;
  hairLength?: 'corti' | 'medi' | 'lunghi';
  photosBefore?: string[]; // base64 data URLs
  photosAfter?: string[];  // base64 data URLs
  appointmentId?: string;
  createdAt: string;
}

// ─── Services ─────────────────────────────────────────────────────────────────

export type ServiceCategory =
  | 'Taglio'
  | 'Colore'
  | 'Trattamento'
  | 'Piega'
  | 'Estetica'
  | 'Nail'
  | 'Sposa'
  | 'Altro';

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  'Taglio', 'Colore', 'Trattamento', 'Piega', 'Estetica', 'Nail', 'Sposa', 'Altro',
];

export interface ServiceProductUsage {
  productId: string;
  qty: number; // quantity used per service
}

export interface Service {
  id: string;
  name: string;
  category: ServiceCategory;
  duration: number; // minutes
  price: number;
  description: string;
  operatorIds: string[]; // empty = all operators
  active: boolean;
  productUsage?: ServiceProductUsage[]; // auto-deduct from stock when service is rendered
  createdAt: string;
}

// ─── Operators / Staff ────────────────────────────────────────────────────────

export type OperatorRole = 'owner' | 'operator' | 'reception';

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
export const DAY_NAMES_FULL = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

export interface WorkShift {
  dayOfWeek: DayOfWeek;
  isWorking: boolean;
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
}

export type OperatorPermissions = {
  calendar: boolean;   // Agenda
  clients: boolean;    // Clienti
  services: boolean;   // Servizi
  staff: boolean;      // Personale
  inventory: boolean;  // Magazzino
  cash: boolean;       // Cassa
  accounting: boolean; // Contabilità (dashboard, tabella, analisi, impostazioni)
};

export const DEFAULT_OPERATOR_PERMISSIONS: OperatorPermissions = {
  calendar: true, clients: true, services: true,
  staff: false, inventory: false, cash: true, accounting: false,
};

export const PERMISSION_LABELS: Record<keyof OperatorPermissions, string> = {
  calendar: 'Agenda',
  clients: 'Clienti',
  services: 'Servizi',
  staff: 'Personale',
  inventory: 'Magazzino',
  cash: 'Cassa',
  accounting: 'Contabilità',
};

export interface Operator {
  id: string;
  name: string;
  email: string;
  role: OperatorRole;
  serviceIds: string[]; // empty = all services
  color: string; // hex
  commissionRate: number; // 0-100%
  schedule: WorkShift[];
  active: boolean;
  pin?: string; // PIN per accesso staff
  permissions?: OperatorPermissions; // undefined = accesso completo (titolare)
  createdAt: string;
}

export interface Absence {
  id: string;
  operatorId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  reason: string;
  createdAt: string;
}

// ─── Appointments ─────────────────────────────────────────────────────────────

export type AppointmentStatus =
  | 'scheduled'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'no-show';

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: 'Prenotato',
  confirmed: 'Confermato',
  completed: 'Completato',
  cancelled: 'Cancellato',
  'no-show': 'No-show',
};

export const STATUS_COLORS: Record<AppointmentStatus, string> = {
  scheduled: '#6366f1',
  confirmed: '#22c55e',
  completed: '#a855f7',
  cancelled: '#71717a',
  'no-show': '#ef4444',
};

export interface AppointmentHistoryEntry {
  timestamp: string;
  action: string;
}

export interface Appointment {
  id: string;
  clientId: string;   // empty string if block slot
  operatorId: string;
  serviceIds: string[];
  date: string;       // YYYY-MM-DD
  startTime: string;  // "HH:mm"
  endTime: string;    // "HH:mm"
  status: AppointmentStatus;
  notes: string;
  isBlock: boolean;
  blockReason: string;
  recurringGroupId: string;
  feedbackScore: number; // 0 = not given, 1-5
  history: AppointmentHistoryEntry[];
  createdAt: string;
}

export interface WaitingListEntry {
  id: string;
  clientId: string;
  serviceId: string;
  preferredOperatorId: string;
  preferredDateFrom: string;
  notes: string;
  createdAt: string;
}

// ─── Inventory ────────────────────────────────────────────────────────────────

export type StockMovementType = 'load' | 'internal_use' | 'sale' | 'adjustment';

export const STOCK_MOVEMENT_LABELS: Record<StockMovementType, string> = {
  load: 'Carico fornitore',
  internal_use: 'Uso interno',
  sale: 'Vendita cliente',
  adjustment: 'Rettifica',
};

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  unit: string; // "ml", "g", "pz"
  purchasePrice: number;
  salePrice: number;
  stock: number;
  minStock: number;
  isForSale: boolean;
  active: boolean;
  supplierId?: string; // reference to Supplier
  createdAt: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  type: StockMovementType;
  quantity: number; // positive = in, negative = out
  date: string;
  notes: string;
  operatorId: string;
  createdAt: string;
}

// ─── Gift Cards ───────────────────────────────────────────────────────────────

export interface GiftCard {
  id: string;
  code: string;
  clientId: string;
  clientName: string;
  initialValue: number;
  remainingValue: number;
  expiryDate: string;
  isActive: boolean;
  purchasedByOperatorId?: string;
  sentViaWhatsApp?: boolean;
  recipientPhone?: string; // phone to send the gift card to (if different from clientId)
  message?: string; // personal message
  createdAt: string;
}

// ─── WhatsApp Automations (UltraMsg) ─────────────────────────────────────────

export interface WhatsAppConfig {
  enabled: boolean;
  // UltraMsg credentials — set by admin, NOT by the salon user
  ultraMsgInstanceId: string;
  ultraMsgToken: string;
  // Automation toggles — set by salon user
  reminderEnabled: boolean;
  birthdayEnabled: boolean;
  postVisitEnabled: boolean;
  loyaltyEnabled: boolean;
  bookingConfirmEnabled: boolean;
  appointmentConfirmEnabled: boolean;
  loyaltyMilestone: number;
  // Message templates (optional — fallback to defaults if not set)
  reminderMsg?: string;
  birthdayMsg?: string;
  postVisitMsg?: string;
  bookingConfirmMsg?: string;
  appointmentConfirmMsg?: string;
  loyaltyMsg?: string;
}

export const DEFAULT_WHATSAPP_CONFIG: WhatsAppConfig = {
  enabled: false,
  ultraMsgInstanceId: '',
  ultraMsgToken: '',
  reminderEnabled: true,
  birthdayEnabled: true,
  postVisitEnabled: true,
  loyaltyEnabled: false,
  bookingConfirmEnabled: true,
  appointmentConfirmEnabled: true,
  loyaltyMilestone: 100,
  reminderMsg: 'Ciao {nome}! 😊 Ti ricordiamo il tuo appuntamento di *{servizio}* domani alle {ora} da {salone}. A presto!',
  birthdayMsg: 'Tanti auguri {nome}! 🎂🎉 Tutto il team di {salone} ti augura una splendida giornata!',
  postVisitMsg: 'Ciao {nome}! Speriamo tu sia soddisfatta della tua visita da {salone}. ⭐ Ci fa sempre piacere sapere come stai!',
  bookingConfirmMsg: 'Ciao {nome}! ✅ La tua prenotazione da *{salone}* per il {data} alle {ora} è confermata. A presto!',
  appointmentConfirmMsg: 'Ciao {nome}! ✅ Il tuo appuntamento di *{servizio}* è confermato per il {data} alle {ora} da {salone}. A presto!',
  loyaltyMsg: 'Complimenti {nome}! 🌟 Hai raggiunto {punti} punti fedeltà da {salone}. Contattaci per scoprire il tuo premio!',
};

export type WhatsAppMessageType = 'reminder' | 'birthday' | 'post_visit' | 'loyalty' | 'booking_confirm' | 'appointment_confirm' | 'manual';

export interface WhatsAppMessage {
  id: string;
  type: WhatsAppMessageType;
  clientId: string;
  clientName: string;
  phone: string;
  templateName: string;
  status: 'sent' | 'failed';
  errorMsg?: string;
  sentAt: string; // ISO
}

// ─── Salon Configuration ─────────────────────────────────────────────────────

export interface SalonConfig {
  salonName: string;
  openTime: string;   // "HH:mm"
  closeTime: string;  // "HH:mm"
  workDays: DayOfWeek[];
  slotMinutes: number; // 15 | 30
  loyaltyPointsPerEuro: number;
  dormientiDays: number; // days before marking client dormant
  // Contact & identity
  address: string;
  phone: string;
  email: string;
  vatNumber: string;   // P.IVA
  invoiceNote: string; // note standard in stampe/fatture
  currency: string;    // default '€'
  whatsapp?: WhatsAppConfig;
}

export const DEFAULT_SALON_CONFIG: SalonConfig = {
  salonName: 'Stylistgo',
  openTime: '09:00',
  closeTime: '19:00',
  workDays: [1, 2, 3, 4, 5, 6],
  slotMinutes: 30,
  loyaltyPointsPerEuro: 1,
  dormientiDays: 60,
  address: '',
  phone: '',
  email: '',
  vatNumber: '',
  invoiceNote: '',
  currency: '€',
};

export const OPERATOR_COLORS = [
  '#6366f1', '#a855f7', '#22c55e', '#f59e0b',
  '#ef4444', '#06b6d4', '#ec4899', '#84cc16',
];

// ─── Cash / POS ───────────────────────────────────────────────────────────────

export type PaymentMethod = 'cash' | 'card' | 'gift_card' | 'mixed';

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Contanti',
  card: 'Carta / POS',
  gift_card: 'Gift Card',
  mixed: 'Misto',
};

export interface PaymentItem {
  serviceId?: string;       // service id (if service)
  productId?: string;       // product id (if product)
  subscriptionId?: string;  // subscription id (if session redeemed)
  serviceName: string;      // name (service or product label)
  price: number;
  isProduct?: boolean;      // true = inventory product sale
  isSubscriptionSession?: boolean; // true = session redeemed from subscription
}

export interface Payment {
  id: string;
  appointmentId: string;
  clientId: string;
  clientName: string;
  operatorId: string;
  date: string; // YYYY-MM-DD
  items: PaymentItem[];
  subtotal: number;
  discountPct: number;
  discountEur: number;
  total: number;
  paymentMethod: PaymentMethod;
  cashAmount: number;
  cardAmount: number;
  giftCardCode: string;
  giftCardAmount: number;
  subscriptionId?: string;   // if paid/redeemed via subscription
  notes: string;
  createdAt: string;
}

export interface CashSession {
  id: string;
  date: string; // YYYY-MM-DD
  openingBalance: number;
  closingBalance: number | null;
  closedAt: string | null;
  createdAt: string;
}

// ─── Gamification ───────────────────────────────────────────────────────────

export interface GamificationBonus {
  id: string;
  label: string;       // e.g. "Dipendente del mese"
  description: string; // e.g. "10 appuntamenti in un giorno"
  amount: number;      // € bonus da assegnare
  icon: string;        // emoji
}

export interface GamificationConfig {
  isEnabled: boolean;
  participantOperatorIds: string[];  // operatori che partecipano
  bonuses: GamificationBonus[];      // bonus definiti dal titolare
  bronzeThreshold: number;   // fatturato mensile min trofeo bronzo (€)
  silverThreshold: number;   // trofeo argento
  goldThreshold: number;     // trofeo oro
}

export const DEFAULT_GAMIFICATION_CONFIG: GamificationConfig = {
  isEnabled: false,
  participantOperatorIds: [],
  bonuses: [],
  bronzeThreshold: 500,
  silverThreshold: 1500,
  goldThreshold: 3000,
};

// ─── Suppliers ────────────────────────────────────────────────────────────────

export interface Supplier {
  id: string;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  active: boolean;
  createdAt: string;
}

// ─── Client Subscriptions ─────────────────────────────────────────────────────

export type SubscriptionStatus = 'active' | 'expired' | 'exhausted' | 'cancelled';

export interface ClientSubscription {
  id: string;
  clientId: string;
  clientName: string;
  name: string;           // e.g. "Pacchetto 10 lavaggi"
  serviceIds: string[];   // which services can be redeemed
  totalSessions: number;
  usedSessions: number;
  price: number;          // purchase price
  purchaseDate: string;   // YYYY-MM-DD
  expiryDate: string;     // YYYY-MM-DD
  status: SubscriptionStatus;
  purchasedByOperatorId?: string;
  notes: string;
  createdAt: string;
}

// ─── Client App Configuration ─────────────────────────────────────────────────

export interface ClientAppConfig {
  /** Welcome message shown on the home screen of the client app */
  welcomeMessage: string;
  /** Short description of the salon shown in the app */
  aboutText: string;
  /** Primary accent color (hex) used throughout the client app */
  accentColor: string;
  /** Whether to show service prices in the app */
  showPrices: boolean;
  /** Whether clients must be logged-in to book */
  requireLoginForBooking: boolean;
  /** How many days ahead clients can book (e.g. 90) */
  maxAdvanceDays: number;
  /** Minimum hours notice required before a booking (e.g. 2) */
  minAdvanceHours: number;
  /** Contact phone shown in the app (can differ from salonConfig.phone) */
  contactPhone: string;
  /** Contact address shown in the app */
  contactAddress: string;
  /** Instagram handle without @ (e.g. "leribelle.salon") */
  instagramHandle: string;
  /** Facebook page URL */
  facebookUrl: string;
  /** Cancellation policy text shown during booking confirmation */
  cancellationPolicy: string;
  /** Message shown to the client after a successful booking */
  bookingConfirmationMessage: string;
}

export const DEFAULT_CLIENT_APP_CONFIG: ClientAppConfig = {
  welcomeMessage: 'Benvenuta! 💇‍♀️',
  aboutText: '',
  accentColor: '#c084fc',
  showPrices: true,
  requireLoginForBooking: true,
  maxAdvanceDays: 90,
  minAdvanceHours: 2,
  contactPhone: '',
  contactAddress: '',
  instagramHandle: '',
  facebookUrl: '',
  cancellationPolicy: 'Per cancellare o modificare l\'appuntamento si prega di avvisare almeno 24 ore prima.',
  bookingConfirmationMessage: 'Prenotazione confermata! Ti aspettiamo. 🌸',
};

// Default schedule helper
export function defaultSchedule(): WorkShift[] {
  return Array.from({ length: 7 }, (_, i) => ({
    dayOfWeek: i as DayOfWeek,
    isWorking: i >= 1 && i <= 6, // Mon-Sat
    startTime: '09:00',
    endTime: '19:00',
  }));
}
