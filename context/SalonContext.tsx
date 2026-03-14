'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import {
  Client, TechnicalCard, Service, Operator, Absence,
  Appointment, AppointmentStatus, WaitingListEntry,
  Product, StockMovement, GiftCard, SalonConfig, AppointmentHistoryEntry,
  Payment, CashSession, GamificationConfig, DEFAULT_GAMIFICATION_CONFIG, DEFAULT_SALON_CONFIG,
  WhatsAppMessage, WhatsAppConfig, DEFAULT_WHATSAPP_CONFIG,
  Supplier, ClientSubscription, SubscriptionStatus,
  ClientAppConfig, DEFAULT_CLIENT_APP_CONFIG,
} from '@/types/salon';
import {
  storageGetClients, storageSaveClients,
  storageGetTechnicalCards, storageSaveTechnicalCards,
  storageGetServices, storageSaveServices,
  storageGetOperators, storageSaveOperators,
  storageGetAbsences, storageSaveAbsences,
  storageGetAppointments, storageSaveAppointments,
  storageGetWaitingList, storageSaveWaitingList,
  storageGetProducts, storageSaveProducts,
  storageGetStockMovements, storageSaveStockMovements,
  storageGetGiftCards, storageSaveGiftCards,
  storageGetSalonConfig, storageSaveSalonConfig,
  storageGetPayments, storageSavePayments,
  storageGetCashSessions, storageSaveCashSessions,
  storageGetActiveOperatorId, storageSaveActiveOperatorId,
  storageGetGamificationConfig, storageSaveGamificationConfig,
  storageGetSuppliers, storageSaveSuppliers,
  storageGetSubscriptions, storageSaveSubscriptions,
  storageGetClientAppConfig, storageSaveClientAppConfig,
  salonGenerateId, setStorageUserId,
  getLocalSavedAt, setLocalSavedAt,
  storageGetDeleted, storageSaveDeleted, storageMarkDeleted,
  type DeletedMap,
} from '@/lib/salonStorage';
import { getCurrentUser } from '@/lib/supabase';
import { dbGetSalonState, dbSaveSalonState, dbGetOnlineBookings, dbUpdateBookingStatus, dbSubscribeToSalonChanges } from '@/lib/salonDb';

interface SalonContextValue {
  // State
  clients: Client[];
  technicalCards: TechnicalCard[];
  services: Service[];
  operators: Operator[];
  absences: Absence[];
  appointments: Appointment[];
  waitingList: WaitingListEntry[];
  products: Product[];
  stockMovements: StockMovement[];
  giftCards: GiftCard[];
  salonConfig: SalonConfig;
  clientAppConfig: ClientAppConfig;
  salonLoading: boolean;

  // Clients
  addClient: (c: Omit<Client, 'id' | 'createdAt'>) => string;
  updateClient: (c: Client) => void;
  deleteClient: (id: string) => void;
  addLoyaltyPoints: (clientId: string, points: number) => void;

  // Technical Cards
  addTechnicalCard: (c: Omit<TechnicalCard, 'id' | 'createdAt'>) => void;
  updateTechnicalCard: (c: TechnicalCard) => void;
  deleteTechnicalCard: (id: string) => void;

  // Services
  addService: (s: Omit<Service, 'id' | 'createdAt'>) => void;
  updateService: (s: Service) => void;
  deleteService: (id: string) => void;

  // Operators
  addOperator: (o: Omit<Operator, 'id' | 'createdAt'>) => string;
  updateOperator: (o: Operator) => void;
  deleteOperator: (id: string) => void;

  // Absences
  addAbsence: (a: Omit<Absence, 'id' | 'createdAt'>) => void;
  deleteAbsence: (id: string) => void;

  // Appointments
  addAppointment: (a: Omit<Appointment, 'id' | 'createdAt' | 'history'>) => void;
  updateAppointment: (a: Appointment, historyNote?: string) => void;
  changeAppointmentStatus: (id: string, status: AppointmentStatus) => void;
  deleteAppointment: (id: string) => void;

  // Waiting list
  addWaitingEntry: (e: Omit<WaitingListEntry, 'id' | 'createdAt'>) => void;
  deleteWaitingEntry: (id: string) => void;

  // Products
  addProduct: (p: Omit<Product, 'id' | 'createdAt'>) => string; // returns new product id
  updateProduct: (p: Product) => void;
  deleteProduct: (id: string) => void;

  // Stock
  addStockMovement: (m: Omit<StockMovement, 'id' | 'createdAt'>) => void;

  // Gift Cards
  addGiftCard: (g: Omit<GiftCard, 'id' | 'createdAt' | 'code'>) => void;
  redeemGiftCard: (code: string, amount: number) => boolean;
  updateGiftCard: (g: GiftCard) => void;

  // Config
  updateSalonConfig: (c: Partial<SalonConfig>) => void;
  updateClientAppConfig: (c: Partial<ClientAppConfig>) => void;

  // Payments / Cassa
  payments: Payment[];
  cashSessions: CashSession[];
  addPayment: (p: Omit<Payment, 'id' | 'createdAt'>) => void;
  deletePayment: (id: string) => void;
  addCashSession: (openingBalance: number) => void;
  closeCashSession: (id: string, closingBalance: number) => void;

  // Active operator (PIN-based staff)
  activeOperatorId: string | null;
  setActiveOperatorId: (id: string | null) => void;
  verifyOperatorPin: (operatorId: string, pin: string) => boolean;
  // Private mode: unlocked with PIN privato del titolare
  isPrivateMode: boolean;
  setPrivateMode: (v: boolean) => void;
  checkPinMode: (operatorId: string | null, pin: string) => 'public' | 'private' | 'invalid';

  // Gamification
  gamificationConfig: GamificationConfig;
  updateGamificationConfig: (c: Partial<GamificationConfig>) => void;

  // WhatsApp message log
  whatsappMessages: WhatsAppMessage[];
  addWhatsAppMessage: (m: WhatsAppMessage) => void;

  // Suppliers
  suppliers: Supplier[];
  addSupplier: (s: Omit<Supplier, 'id' | 'createdAt'>) => string;
  updateSupplier: (s: Supplier) => void;
  deleteSupplier: (id: string) => void;

  // Client Subscriptions
  subscriptions: ClientSubscription[];
  addSubscription: (s: Omit<ClientSubscription, 'id' | 'createdAt'>) => string;
  updateSubscription: (s: ClientSubscription) => void;
  deleteSubscription: (id: string) => void;
  useSubscriptionSession: (subscriptionId: string) => boolean; // returns false if no sessions left

  // Online bookings → calendar import (called on real-time tick)
  importPendingBookings: () => Promise<void>;

  // Cloud connectivity: 'cloud' = authenticated Supabase user, 'local' = offline/local account
  cloudSyncStatus: 'cloud' | 'local';
}

const SalonContext = createContext<SalonContextValue | null>(null);

// ─── Per-item merge helper ──────────────────────────────────────────────────────────────────
// Merges two arrays by item id. For each id, takes the version with the
// higher updatedAt (falls back to createdAt if updatedAt is absent).
// Items in either deletedIds set are removed from the result.
type WithId = { id: string; updatedAt?: string; createdAt: string };
function mergeItems<T extends WithId>(
  local: T[], cloud: T[],
  localDel: string[] = [], cloudDel: string[] = [],
): T[] {
  const delSet = new Set([...localDel, ...cloudDel]);
  const map = new Map<string, T>();
  for (const item of local) {
    if (!delSet.has(item.id)) map.set(item.id, item);
  }
  for (const item of cloud) {
    if (delSet.has(item.id)) continue;
    const ex = map.get(item.id);
    if (!ex) {
      map.set(item.id, item);
    } else {
      const localTs = ex.updatedAt ?? ex.createdAt;
      const cloudTs = item.updatedAt ?? item.createdAt;
      if (cloudTs > localTs) map.set(item.id, item);
    }
  }
  return Array.from(map.values());
}

export function SalonProvider({ children }: { children: React.ReactNode }) {
  // ── View-only mode: set when admin impersonates a tenant ─────────────────
  // In this mode we load cloud data but NEVER write back (prevents localStorage
  // contamination when the admin browser has stale data for a different user).
  const isViewMode = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('view') === '1';

  const [clients, setClients] = useState<Client[]>([]);
  const [technicalCards, setTechnicalCards] = useState<TechnicalCard[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [waitingList, setWaitingList] = useState<WaitingListEntry[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [giftCards, setGiftCards] = useState<GiftCard[]>([]);
  const [gamificationConfig, setGamificationConfig] = useState<GamificationConfig>(DEFAULT_GAMIFICATION_CONFIG);
  const [salonConfig, setSalonConfig] = useState<SalonConfig>(DEFAULT_SALON_CONFIG);
  const [clientAppConfig, setClientAppConfig] = useState<ClientAppConfig>(DEFAULT_CLIENT_APP_CONFIG);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [cashSessions, setCashSessions] = useState<CashSession[]>([]);
  const [whatsappMessages, setWhatsappMessages] = useState<WhatsAppMessage[]>([]);
  const [activeOperatorId, setActiveOperatorIdState] = useState<string | null>(null);
  const [isPrivateMode, setPrivateModeState] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [subscriptions, setSubscriptions] = useState<ClientSubscription[]>([]);
  const [salonLoading, setSalonLoading] = useState(true);
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'cloud' | 'local'>('local');
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cloudLoadAttempted = useRef(false);
  // A ref always holding the latest state snapshot — used by the flush-on-hide effect
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const latestStateRef = useRef<Record<string, any>>({});

  useEffect(() => {
    const init = async () => {
      // ─── Set per-user storage prefix FIRST, before any localStorage read ───
      try {
        const user = await getCurrentUser();
        if (user) {
          setStorageUserId(user.id as string);
        }
      } catch { /* ignore */ }

      setClients(storageGetClients());
      setTechnicalCards(storageGetTechnicalCards());
      setServices(storageGetServices());
      setOperators(storageGetOperators());
      setAbsences(storageGetAbsences());
      setAppointments(storageGetAppointments());
      setWaitingList(storageGetWaitingList());
      setProducts(storageGetProducts());
      setStockMovements(storageGetStockMovements());
      setGiftCards(storageGetGiftCards());
      setGamificationConfig(storageGetGamificationConfig());
      setSalonConfig(storageGetSalonConfig());
      setPayments(storageGetPayments());
      setCashSessions(storageGetCashSessions());
      setActiveOperatorIdState(storageGetActiveOperatorId());
      setSuppliers(storageGetSuppliers());
      setSubscriptions(storageGetSubscriptions());
      setClientAppConfig(storageGetClientAppConfig());
      setSalonLoading(false);
    };
    init();
  }, []);

  // ─── Import pending online bookings into calendar (also called on realtime tick) ─
  const importPendingBookings = useCallback(async () => {
    try {
      const user = await getCurrentUser();
      if (!user || (user.id as string).startsWith('local-')) return;
      const userId = user.id as string;

      const pendingBookings = await dbGetOnlineBookings(userId);
      const pending = pendingBookings.filter(b => b.status === 'pending');
      if (pending.length === 0) return;

      // localStorage is always up-to-date (state changes are saved there immediately)
      const baseApts     = storageGetAppointments();
      const baseClients  = storageGetClients();
      const baseServices = storageGetServices();
      const sc           = storageGetSalonConfig(); // for WA settings
      const mergedApts     = [...baseApts];
      const mergedClients  = [...baseClients];

      for (const b of pending) {
        const alreadyIn = mergedApts.some(a =>
          a.notes?.includes(b.id) ||
          (a.date === b.preferred_date && a.startTime === b.preferred_time &&
           mergedClients.find(c => c.id === a.clientId)?.phone === b.client_phone)
        );
        if (alreadyIn) { dbUpdateBookingStatus(b.id, 'confirmed').catch(() => {}); continue; }

        const opMatch = (b.notes || '').match(/^\[op:([^\]]+)\]/);
        const bookingOperatorId = opMatch?.[1] || '';
        const cleanNotes = (b.notes || '').replace(/^\[op:[^\]]+\]\s*/, '');
        const [firstName, ...rest] = (b.client_name || '').trim().split(' ');
        const bookingFirstName = firstName || b.client_name;
        const bookingLastName  = rest.join(' ') || '';

        const existingClient = mergedClients.find(c =>
          c.phone === b.client_phone || (b.client_email && c.email === b.client_email)
        );
        let clientId: string;
        if (existingClient) {
          // Create a new object — do NOT mutate the reference that lives in React state
          const updatedClient: Client = {
            ...existingClient,
            firstName: bookingFirstName,
            lastName:  bookingLastName,
            email:     b.client_email || existingClient.email,
          };
          const idx = mergedClients.findIndex(c => c.id === existingClient.id);
          mergedClients[idx] = updatedClient;
          clientId = updatedClient.id;
        } else {
          const nc: Client = {
            id: salonGenerateId(), firstName: bookingFirstName, lastName: bookingLastName,
            phone: b.client_phone, email: b.client_email || '', birthDate: '',
            notes: `Prenotato online il ${b.created_at?.slice(0, 10) ?? ''}`,
            allergies: '', tags: [], gdprConsent: false, gdprDate: '', loyaltyPoints: 0,
            gender: '', address: '', city: '', province: '', postalCode: '',
            acquisitionSource: 'sito_web', acquisitionDate: b.created_at?.slice(0, 10) ?? '',
            visitFrequency: '', lastVisitDate: '', totalVisits: 0, totalRevenue: 0,
            createdAt: new Date().toISOString(),
          };
          mergedClients.push(nc);
          clientId = nc.id;
        }

        const matchedService = baseServices.find(s =>
          s.name.toLowerCase().includes((b.service || '').toLowerCase()) ||
          (b.service || '').toLowerCase().includes(s.name.toLowerCase())
        );
        const dur = matchedService?.duration ?? 60;
        const [hh, mm] = (b.preferred_time || '10:00').split(':').map(Number);
        const endMin = (hh || 10) * 60 + (mm || 0) + dur;
        const endTime = `${String(Math.floor(endMin / 60) % 24).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
        mergedApts.push({
          id: salonGenerateId(), clientId, operatorId: bookingOperatorId,
          serviceIds: matchedService ? [matchedService.id] : [],
          date: b.preferred_date, startTime: b.preferred_time, endTime,
          status: 'scheduled',
          notes: `📱 Prenotazione online [${b.id}]: ${b.service}${cleanNotes ? ` — ${cleanNotes}` : ''}`,
          isBlock: false, blockReason: '', recurringGroupId: '', feedbackScore: 0,
          createdAt: new Date().toISOString(),
          history: [{ timestamp: new Date().toISOString(), action: 'Importato da prenotazione online' }],
        });

        // WA conferma al cliente
        try {
          const wa = sc?.whatsapp;
          const clientPhone = b.client_phone?.replace(/\D/g, '');
          if (wa?.ultraMsgInstanceId && wa?.ultraMsgToken && (wa.appointmentConfirmEnabled ?? true) && clientPhone) {
            const svcName  = matchedService?.name || b.service || 'appuntamento';
            const salonName = sc?.salonName ?? 'il salone';
            const DEFAULT_APPT_MSG = 'Ciao {nome}! ✅ Il tuo appuntamento di *{servizio}* è confermato per il {data} alle {ora} da {salone}. A presto!';
            const msg = (wa.appointmentConfirmMsg ?? DEFAULT_APPT_MSG)
              .split('{nome}').join(bookingFirstName)
              .split('{servizio}').join(svcName)
              .split('{data}').join(b.preferred_date)
              .split('{ora}').join(b.preferred_time)
              .split('{salone}').join(salonName);
            fetch('/api/ultramsg/send', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ instanceId: wa.ultraMsgInstanceId, token: wa.ultraMsgToken, to: clientPhone, message: msg }),
            }).catch(() => {});
          }
        } catch { /* non bloccare l'import */ }

        // Mark as confirmed BEFORE state update to prevent double import on rapid refresh
        await dbUpdateBookingStatus(b.id, 'confirmed');
      }

      if (mergedApts.length > baseApts.length) {
        setAppointments(mergedApts); storageSaveAppointments(mergedApts);
      }
      const baseClientMap = new Map(baseClients.map(c => [c.id, c]));
      const clientsChanged = mergedClients.length !== baseClients.length ||
        mergedClients.some(c => { const o = baseClientMap.get(c.id); return o && (o.firstName !== c.firstName || o.lastName !== c.lastName || o.email !== c.email); });
      if (clientsChanged) { setClients(mergedClients); storageSaveClients(mergedClients); }
    } catch { /* ignore */ }
  }, []); // uses refs/storage only — no reactive deps needed

  // ─── Cloud sync: load from Supabase once after local load ─────────────────
  useEffect(() => {
    if (salonLoading) return;
    const loadCloud = async () => {
      try {
        const user = await getCurrentUser();
        // Local-only users (id starts with 'local-') have no Supabase session — skip cloud
        if (!user || (user.id as string).startsWith('local-')) return;
        setCloudSyncStatus('cloud'); // user has a real Supabase account → data syncs to cloud
        setStorageUserId(user.id as string);
        const cloudState = await dbGetSalonState(user.id as string);
        if (!cloudState) return;
        const adminState = cloudState.admin_state as Record<string, unknown> | undefined;
        // ── Per-item merge: each entity is merged independently ─────────────
        // Items are compared by updatedAt (falls back to createdAt).
        // Items present in either the local or cloud deleted-IDs registry are removed.
        const cloudDel = (cloudState._deleted ?? {}) as DeletedMap;
        const localDel = storageGetDeleted();
        // Merge the two deleted maps (union) and persist
        const mergedDel: DeletedMap = { ...localDel };
        for (const entity of Object.keys(cloudDel)) {
          mergedDel[entity] = Array.from(new Set([...(mergedDel[entity] ?? []), ...(cloudDel[entity] ?? [])]));
        }
        storageSaveDeleted(mergedDel);

        const mArr = <T extends WithId>(
          localArr: T[], cloudArr: unknown, entity: string,
        ): T[] => mergeItems(
          localArr,
          Array.isArray(cloudArr) ? cloudArr as T[] : [],
          mergedDel[entity] ?? [],
          [], // already merged into mergedDel above
        );

        const newClients  = mArr<Client>(storageGetClients(), cloudState.clients, 'clients');
        const newTechCards = mArr<TechnicalCard>(storageGetTechnicalCards(), cloudState.technicalCards, 'technicalCards');
        const newServices  = mArr<Service>(storageGetServices(), cloudState.services, 'services');
        const newAbsences  = mArr<Absence>(storageGetAbsences(), cloudState.absences, 'absences');
        const newApts      = mArr<Appointment>(storageGetAppointments(), cloudState.appointments, 'appointments');
        const newWaiting   = mArr<WaitingListEntry>(storageGetWaitingList(), cloudState.waitingList, 'waitingList');
        const newProducts  = mArr<Product>(storageGetProducts(), cloudState.products, 'products');
        const newStock     = mArr<StockMovement>(storageGetStockMovements(), cloudState.stockMovements, 'stockMovements');
        const newGiftCards = mArr<GiftCard>(storageGetGiftCards(), cloudState.giftCards, 'giftCards');
        const newPayments  = mArr<Payment>(storageGetPayments(), cloudState.payments, 'payments');
        const newSuppliers = mArr<Supplier>(storageGetSuppliers() as Supplier[], (cloudState as Record<string, unknown>).suppliers, 'suppliers');
        const newSubs      = mArr<ClientSubscription>(storageGetSubscriptions() as ClientSubscription[], (cloudState as Record<string, unknown>).subscriptions, 'subscriptions');

        // Operators: merge per-item. Cloud/merged version wins (it's the newer one via mergeItems);
        // local is used only as fallback for fields that the cloud version may lack (e.g. PIN on old records).
        const localOpsStorage = storageGetOperators();
        const newOpsRaw = mArr<Operator>(localOpsStorage, cloudState.operators, 'operators');
        const newOps = newOpsRaw.map(op => {
          const local = localOpsStorage.find(l => l.id === op.id);
          if (!local) return op;
          return { ...op, pin: op.pin || local.pin, privatePin: op.privatePin || local.privatePin, color: op.color || local.color, commissionRate: op.commissionRate ?? local.commissionRate, schedule: op.schedule?.length ? op.schedule : local.schedule };
        });

        // cashSessions / whatsappMessages / subscriptions: merge as arrays (no updatedAt)
        const arr = <T,>(v: unknown): v is T[] => Array.isArray(v) && (v as T[]).length > 0;

        const cloudSavedAt = (cloudState._savedAt as number) ?? 0;
        const localSavedAt = getLocalSavedAt();
        const cloudIsNewer = cloudSavedAt >= localSavedAt;

        if (!isViewMode) {
          setClients(newClients); storageSaveClients(newClients);
          setTechnicalCards(newTechCards); storageSaveTechnicalCards(newTechCards);
          setServices(newServices); storageSaveServices(newServices);
          setOperators(newOps); storageSaveOperators(newOps);
          setAbsences(newAbsences); storageSaveAbsences(newAbsences);
          setAppointments(newApts); storageSaveAppointments(newApts);
          setWaitingList(newWaiting); storageSaveWaitingList(newWaiting);
          setProducts(newProducts); storageSaveProducts(newProducts);
          setStockMovements(newStock); storageSaveStockMovements(newStock);
          setGiftCards(newGiftCards); storageSaveGiftCards(newGiftCards);
          setPayments(newPayments); storageSavePayments(newPayments);
          setSuppliers(newSuppliers); storageSaveSuppliers(newSuppliers);
          setSubscriptions(newSubs); storageSaveSubscriptions(newSubs);
          if (arr<CashSession>(cloudState.cashSessions)) { setCashSessions(cloudState.cashSessions as CashSession[]); storageSaveCashSessions(cloudState.cashSessions as CashSession[]); }
          if (arr<WhatsAppMessage>((cloudState as Record<string, unknown>).whatsappMessages)) { setWhatsappMessages((cloudState as Record<string, unknown>).whatsappMessages as WhatsAppMessage[]); }
        } else {
          // View-only (impersonation): load directly from cloud without writing localStorage
          setClients(Array.isArray(cloudState.clients) ? cloudState.clients as Client[] : []);
          setTechnicalCards(Array.isArray(cloudState.technicalCards) ? cloudState.technicalCards as TechnicalCard[] : []);
          setServices(Array.isArray(cloudState.services) ? cloudState.services as Service[] : []);
          setOperators(Array.isArray(cloudState.operators) ? cloudState.operators as Operator[] : []);
          setAbsences(Array.isArray(cloudState.absences) ? cloudState.absences as Absence[] : []);
          setAppointments(Array.isArray(cloudState.appointments) ? cloudState.appointments as Appointment[] : []);
          setWaitingList(Array.isArray(cloudState.waitingList) ? cloudState.waitingList as WaitingListEntry[] : []);
          setProducts(Array.isArray(cloudState.products) ? cloudState.products as Product[] : []);
          setStockMovements(Array.isArray(cloudState.stockMovements) ? cloudState.stockMovements as StockMovement[] : []);
          setGiftCards(Array.isArray(cloudState.giftCards) ? cloudState.giftCards as GiftCard[] : []);
          setPayments(Array.isArray(cloudState.payments) ? cloudState.payments as Payment[] : []);
          if (arr<Supplier>((cloudState as Record<string, unknown>).suppliers)) setSuppliers((cloudState as Record<string, unknown>).suppliers as Supplier[]);
          if (arr<ClientSubscription>((cloudState as Record<string, unknown>).subscriptions)) setSubscriptions((cloudState as Record<string, unknown>).subscriptions as ClientSubscription[]);
          if (arr<CashSession>(cloudState.cashSessions)) setCashSessions(cloudState.cashSessions as CashSession[]);
        }

        // salonConfig: merge with pin preservation
        if (cloudIsNewer && cloudState.salonConfig) {
          const localCfg = storageGetSalonConfig();
          const cloudCfg = cloudState.salonConfig as SalonConfig;
          const mergedCfg: SalonConfig = { ...cloudCfg, ownerPublicPin: cloudCfg.ownerPublicPin || localCfg.ownerPublicPin, ownerPrivatePin: cloudCfg.ownerPrivatePin || localCfg.ownerPrivatePin };
          setSalonConfig(mergedCfg);
          if (!isViewMode) storageSaveSalonConfig(mergedCfg);
        } else if (!cloudIsNewer && cloudState.salonConfig) {
          const cloudWa = (cloudState.salonConfig as SalonConfig).whatsapp;
          if (cloudWa?.ultraMsgInstanceId || cloudWa?.ultraMsgToken) {
            setSalonConfig(prev => {
              const merged: SalonConfig = { ...prev, whatsapp: { ...DEFAULT_WHATSAPP_CONFIG, ...(prev.whatsapp ?? {}), ultraMsgInstanceId: cloudWa.ultraMsgInstanceId, ultraMsgToken: cloudWa.ultraMsgToken } };
              if (!isViewMode) storageSaveSalonConfig(merged);
              return merged;
            });
          }
        }
        if (cloudIsNewer) {
          if (cloudState.gamificationConfig) { setGamificationConfig(cloudState.gamificationConfig as GamificationConfig); if (!isViewMode) storageSaveGamificationConfig(cloudState.gamificationConfig as GamificationConfig); }
          if ((cloudState as Record<string, unknown>).clientAppConfig) { const cac = (cloudState as Record<string, unknown>).clientAppConfig as ClientAppConfig; setClientAppConfig(cac); if (!isViewMode) storageSaveClientAppConfig(cac); }
        }

        // Admin state overrides (operator list + salonConfig pushed by admin panel)
        if (adminState?.operators) {
          const adminOps = adminState.operators as Operator[];
          const localOps2 = storageGetOperators();
          // Merge: admin edits win for known operators, but salon-added operators
          // (not present in admin's list) are preserved to avoid data loss.
          const adminIds = new Set(adminOps.map(o => o.id));
          const salonOnlyOps = localOps2.filter(o => !adminIds.has(o.id));
          const withPins = adminOps.map(op => {
            const local = localOps2.find(l => l.id === op.id);
            if (!local) return op;
            // Prefer local PIN/schedule (set by the salon on this device) with admin version as fallback
            return { ...op, pin: local.pin || op.pin, privatePin: local.privatePin || op.privatePin, color: op.color || local.color, commissionRate: op.commissionRate ?? local.commissionRate, schedule: local.schedule?.length ? local.schedule : op.schedule };
          });
          const merged = [...withPins, ...salonOnlyOps];
          setOperators(merged);
          if (!isViewMode) storageSaveOperators(merged);
        }
        if (adminState?.salonConfig) {
          const localCfg2 = storageGetSalonConfig();
          const adminCfg = adminState.salonConfig as SalonConfig;
          const merged2 = { ...adminCfg, ownerPublicPin: adminCfg.ownerPublicPin || localCfg2.ownerPublicPin, ownerPrivatePin: adminCfg.ownerPrivatePin || localCfg2.ownerPrivatePin };
          setSalonConfig(prev => ({ ...prev, ...merged2 }));
          if (!isViewMode) storageSaveSalonConfig({ ...({} as SalonConfig), ...merged2 });
        }

        // ── Auto-import pending online bookings into the calendar ────────────
        await importPendingBookings();
      } catch { /* ignore */ } finally {
        cloudLoadAttempted.current = true;
        setCloudReady(true);
      }
    };
    loadCloud();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salonLoading]);

  // ─── Cloud sync: debounced save on every state change ─────────────────────
  useEffect(() => {
    if (isViewMode) return; // never write back when impersonating
    if (!cloudLoadAttempted.current) return;
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    const savedAt = Date.now();
    // Record local modification time IMMEDIATELY, before the timer fires.
    // This ensures that if the page is closed before the 1.5s timer fires,
    // we still know local data is newer than the last cloud save.
    setLocalSavedAt(savedAt);
    syncTimerRef.current = setTimeout(async () => {
      try {
        const user = await getCurrentUser();
        if (!user) return;
        await dbSaveSalonState(user.id as string, {
          clients, technicalCards, services, operators, absences, appointments,
          waitingList, products, stockMovements, giftCards, payments,
          cashSessions, salonConfig, gamificationConfig, whatsappMessages,
          suppliers, subscriptions, clientAppConfig,
          _savedAt: savedAt,
          _deleted: storageGetDeleted(),
        });
      } catch { /* ignore */ }
    }, 1500);
    // Intentionally NOT cancelling syncTimerRef in cleanup:
    // if user navigates away before the debounce fires the cleanup would
    // cancel the only pending save, leaving Supabase stale. The clearTimeout
    // above already prevents duplicate timers accumulating.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, technicalCards, services, operators, absences, appointments,
      waitingList, products, stockMovements, giftCards, payments,
      cashSessions, salonConfig, gamificationConfig, whatsappMessages,
      suppliers, subscriptions, clientAppConfig]);

  // Keep latestStateRef in sync so the flush-on-hide effect has fresh data
  useEffect(() => {
    latestStateRef.current = {
      clients, technicalCards, services, operators, absences, appointments,
      waitingList, products, stockMovements, giftCards, payments,
      cashSessions, salonConfig, gamificationConfig, whatsappMessages,
      suppliers, subscriptions, clientAppConfig,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, technicalCards, services, operators, absences, appointments,
      waitingList, products, stockMovements, giftCards, payments,
      cashSessions, salonConfig, gamificationConfig, whatsappMessages,
      suppliers, subscriptions, clientAppConfig]);

  // ─── Flush to cloud immediately when tab is hidden or page is unloading ───
  // This fires BEFORE window.location.href navigations complete, ensuring
  // the latest data reaches Supabase even if the user logs out quickly.
  useEffect(() => {
    const flush = async () => {
      if (isViewMode) return; // never write back when impersonating
      if (!cloudLoadAttempted.current) return;
      if (syncTimerRef.current) { clearTimeout(syncTimerRef.current); syncTimerRef.current = null; }
      try {
        const user = await getCurrentUser();
        if (!user) return;
        const savedAt = Date.now();
        setLocalSavedAt(savedAt);
        await dbSaveSalonState(user.id as string, { ...latestStateRef.current, _savedAt: savedAt, _deleted: storageGetDeleted() });
      } catch { /* ignore */ }
    };
    const onVisChange = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', onVisChange);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVisChange);
      window.removeEventListener('pagehide', flush);
    };
  }, []); // empty deps — reads always-current refs

  // ─── Supabase Realtime: live sync across devices ───────────────────────
  // Once the first cloud load is done, subscribe to changes on salon_data.
  // When another device saves, we receive the new state and merge it in.
  useEffect(() => {
    if (!cloudReady || isViewMode) return;
    let unsub: (() => void) | undefined;
    getCurrentUser().then(user => {
      if (!user || (user.id as string).startsWith('local-')) return;
      const userId = user.id as string;
      unsub = dbSubscribeToSalonChanges(userId, (newState, adminState) => {
        // ── Admin-panel writes (admin_state changed) ──────────────────────
        // These bypass the timestamp filter — the admin always wins immediately.
        if (adminState && Object.keys(adminState).length > 0) {
          if (adminState.operators) {
            const adminOps = adminState.operators as Operator[];
            const localOps = storageGetOperators();
            // Merge: admin edits win for known operators, salon-added operators are preserved.
            const adminIds = new Set(adminOps.map(o => o.id));
            const salonOnlyOps = localOps.filter(o => !adminIds.has(o.id));
            const withPins = adminOps.map(op => {
              const local = localOps.find(l => l.id === op.id);
              if (!local) return op;
              return { ...op, pin: op.pin || local.pin, privatePin: op.privatePin || local.privatePin, color: op.color || local.color, commissionRate: op.commissionRate ?? local.commissionRate, schedule: op.schedule?.length ? op.schedule : local.schedule };
            });
            const mergedOps = [...withPins, ...salonOnlyOps];
            setOperators(mergedOps); storageSaveOperators(mergedOps);
          }
          if (adminState.salonConfig) {
            const localCfgAdm = storageGetSalonConfig();
            const adminCfg = adminState.salonConfig as SalonConfig;
            const mergedAdm: SalonConfig = { ...localCfgAdm, ...adminCfg, ownerPublicPin: adminCfg.ownerPublicPin || localCfgAdm.ownerPublicPin, ownerPrivatePin: adminCfg.ownerPrivatePin || localCfgAdm.ownerPrivatePin };
            setSalonConfig(mergedAdm); storageSaveSalonConfig(mergedAdm);
          }
        }

        // ── Peer-device saves (state column changed) ───────────────────────
        // Skip only if this is our OWN save echoed back (same device, same timestamp)
        const cloudTs = (newState._savedAt as number) ?? 0;
        const localTs = getLocalSavedAt();
        if (cloudTs < localTs) return; // strictly older than our last save — skip
        if (cloudTs === localTs) return; // exact echo of our own save — skip
        // Merge incoming cloud state with current local state (ALL entities)
        const cloudDel2 = (newState._deleted ?? {}) as DeletedMap;
        const localDel2 = storageGetDeleted();
        const merged2: DeletedMap = { ...localDel2 };
        for (const e of Object.keys(cloudDel2)) {
          merged2[e] = Array.from(new Set([...(merged2[e] ?? []), ...(cloudDel2[e] ?? [])]));
        }
        storageSaveDeleted(merged2);
        const ma = <T extends WithId>(local: T[], cloud: unknown, entity: string): T[] =>
          mergeItems(local, Array.isArray(cloud) ? cloud as T[] : [], merged2[entity] ?? [], []);
        const snap = latestStateRef.current;
        // ── Array entities with updatedAt ──────────────────────────────────
        const nc   = ma<Client>(snap.clients as Client[], newState.clients, 'clients');
        const ntc  = ma<TechnicalCard>(snap.technicalCards as TechnicalCard[], newState.technicalCards, 'technicalCards');
        const ns   = ma<Service>(snap.services as Service[], newState.services, 'services');
        const noRaw = ma<Operator>(snap.operators as Operator[], newState.operators, 'operators');
        // Restore PIN/schedule from in-memory state if the incoming cloud version lacks them.
        // Guards against peers that saved operators without these fields (e.g. fresh device before cloud load).
        const snapOpsRT = snap.operators as Operator[];
        const no = noRaw.map(op => {
          const snapOp = snapOpsRT.find(x => x.id === op.id);
          if (!snapOp) return op;
          return { ...op, pin: op.pin || snapOp.pin, privatePin: op.privatePin || snapOp.privatePin, schedule: op.schedule?.length ? op.schedule : snapOp.schedule };
        });
        const nab  = ma<Absence>(snap.absences as Absence[], newState.absences, 'absences');
        const na   = ma<Appointment>(snap.appointments as Appointment[], newState.appointments, 'appointments');
        const nwl  = ma<WaitingListEntry>(snap.waitingList as WaitingListEntry[], newState.waitingList, 'waitingList');
        const nprod = ma<Product>(snap.products as Product[], newState.products, 'products');
        const nst  = ma<StockMovement>(snap.stockMovements as StockMovement[], newState.stockMovements, 'stockMovements');
        const ngc  = ma<GiftCard>(snap.giftCards as GiftCard[], newState.giftCards, 'giftCards');
        const npay = ma<Payment>(snap.payments as Payment[], newState.payments, 'payments');
        const nsupp = ma<Supplier>(snap.suppliers as Supplier[], (newState as Record<string, unknown>).suppliers, 'suppliers');
        const nsub = ma<ClientSubscription>(snap.subscriptions as ClientSubscription[], (newState as Record<string, unknown>).subscriptions, 'subscriptions');
        setClients(nc); storageSaveClients(nc);
        setTechnicalCards(ntc); storageSaveTechnicalCards(ntc);
        setServices(ns); storageSaveServices(ns);
        setOperators(no); storageSaveOperators(no);
        setAbsences(nab); storageSaveAbsences(nab);
        setAppointments(na); storageSaveAppointments(na);
        setWaitingList(nwl); storageSaveWaitingList(nwl);
        setProducts(nprod); storageSaveProducts(nprod);
        setStockMovements(nst); storageSaveStockMovements(nst);
        setGiftCards(ngc); storageSaveGiftCards(ngc);
        setPayments(npay); storageSavePayments(npay);
        setSuppliers(nsupp); storageSaveSuppliers(nsupp);
        setSubscriptions(nsub); storageSaveSubscriptions(nsub);
        // ── CashSessions: no updatedAt, replace wholesale if cloud is newer ─
        if (Array.isArray(newState.cashSessions)) {
          setCashSessions(newState.cashSessions as CashSession[]); storageSaveCashSessions(newState.cashSessions as CashSession[]);
        }
        // ── SalonConfig: replace preserving local-only PINs ────────────────
        if (newState.salonConfig) {
          const localCfgRt = storageGetSalonConfig();
          const cloudCfgRt = newState.salonConfig as SalonConfig;
          const mergedCfgRt: SalonConfig = { ...cloudCfgRt, ownerPublicPin: cloudCfgRt.ownerPublicPin || localCfgRt.ownerPublicPin, ownerPrivatePin: cloudCfgRt.ownerPrivatePin || localCfgRt.ownerPrivatePin };
          setSalonConfig(mergedCfgRt); storageSaveSalonConfig(mergedCfgRt);
        }
        // ── GamificationConfig ────────────────────────────────────────────
        if (newState.gamificationConfig) {
          setGamificationConfig(newState.gamificationConfig as GamificationConfig);
          storageSaveGamificationConfig(newState.gamificationConfig as GamificationConfig);
        }
        // ── ClientAppConfig ───────────────────────────────────────────────
        if ((newState as Record<string, unknown>).clientAppConfig) {
          const cac = (newState as Record<string, unknown>).clientAppConfig as ClientAppConfig;
          setClientAppConfig(cac); storageSaveClientAppConfig(cac);
        }
        // ── WhatsApp message log (memory-only, no localStorage) ──────────
        if (Array.isArray((newState as Record<string, unknown>).whatsappMessages)) {
          setWhatsappMessages((newState as Record<string, unknown>).whatsappMessages as WhatsAppMessage[]);
        }
      });
    });
    return () => { unsub?.(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudReady]);

  // ─── Clients ──────────────────────────────────────────────────────────────

  const addClient = useCallback((c: Omit<Client, 'id' | 'createdAt'>): string => {
    const ts = new Date().toISOString();
    const full: Client = { ...c, id: salonGenerateId(), createdAt: ts, updatedAt: ts };
    setClients(prev => { const n = [full, ...prev]; storageSaveClients(n); return n; });
    return full.id;
  }, []);

  const updateClient = useCallback((c: Client) => {
    const updated = { ...c, updatedAt: new Date().toISOString() };
    setClients(prev => { const n = prev.map(x => x.id === c.id ? updated : x); storageSaveClients(n); return n; });
  }, []);

  const deleteClient = useCallback((id: string) => {
    storageMarkDeleted('clients', id);
    setClients(prev => { const n = prev.filter(x => x.id !== id); storageSaveClients(n); return n; });
  }, []);

  const addLoyaltyPoints = useCallback((clientId: string, points: number) => {
    setClients(prev => {
      const n = prev.map(c => c.id === clientId ? { ...c, loyaltyPoints: Math.max(0, c.loyaltyPoints + points) } : c);
      storageSaveClients(n);
      return n;
    });
  }, []);

  // ─── Technical Cards ──────────────────────────────────────────────────────

  const addTechnicalCard = useCallback((c: Omit<TechnicalCard, 'id' | 'createdAt'>) => {
    const ts = new Date().toISOString();
    const full: TechnicalCard = { ...c, id: salonGenerateId(), createdAt: ts, updatedAt: ts };
    setTechnicalCards(prev => { const n = [full, ...prev]; storageSaveTechnicalCards(n); return n; });
  }, []);

  const updateTechnicalCard = useCallback((c: TechnicalCard) => {
    const updated = { ...c, updatedAt: new Date().toISOString() };
    setTechnicalCards(prev => { const n = prev.map(x => x.id === c.id ? updated : x); storageSaveTechnicalCards(n); return n; });
  }, []);

  const deleteTechnicalCard = useCallback((id: string) => {
    storageMarkDeleted('technicalCards', id);
    setTechnicalCards(prev => { const n = prev.filter(x => x.id !== id); storageSaveTechnicalCards(n); return n; });
  }, []);

  // ─── Services ─────────────────────────────────────────────────────────────

  const addService = useCallback((s: Omit<Service, 'id' | 'createdAt'>) => {
    const ts = new Date().toISOString();
    const full: Service = { ...s, id: salonGenerateId(), createdAt: ts, updatedAt: ts };
    setServices(prev => { const n = [...prev, full]; storageSaveServices(n); return n; });
  }, []);

  const updateService = useCallback((s: Service) => {
    const updated = { ...s, updatedAt: new Date().toISOString() };
    setServices(prev => { const n = prev.map(x => x.id === s.id ? updated : x); storageSaveServices(n); return n; });
  }, []);

  const deleteService = useCallback((id: string) => {
    storageMarkDeleted('services', id);
    setServices(prev => { const n = prev.filter(x => x.id !== id); storageSaveServices(n); return n; });
  }, []);

  // ─── Operators ────────────────────────────────────────────────────────────

  const addOperator = useCallback((o: Omit<Operator, 'id' | 'createdAt'>): string => {
    const ts = new Date().toISOString();
    const full: Operator = { ...o, id: salonGenerateId(), createdAt: ts, updatedAt: ts };
    setOperators(prev => { const n = [...prev, full]; storageSaveOperators(n); return n; });
    return full.id;
  }, []);

  const updateOperator = useCallback((o: Operator) => {
    const updated = { ...o, updatedAt: new Date().toISOString() };
    setOperators(prev => { const n = prev.map(x => x.id === o.id ? updated : x); storageSaveOperators(n); return n; });
  }, []);

  const deleteOperator = useCallback((id: string) => {
    storageMarkDeleted('operators', id);
    setOperators(prev => { const n = prev.filter(x => x.id !== id); storageSaveOperators(n); return n; });
  }, []);

  // ─── Absences ─────────────────────────────────────────────────────────────

  const addAbsence = useCallback((a: Omit<Absence, 'id' | 'createdAt'>) => {
    const ts = new Date().toISOString();
    const full: Absence = { ...a, id: salonGenerateId(), createdAt: ts, updatedAt: ts };
    setAbsences(prev => { const n = [...prev, full]; storageSaveAbsences(n); return n; });
  }, []);

  const deleteAbsence = useCallback((id: string) => {
    storageMarkDeleted('absences', id);
    setAbsences(prev => { const n = prev.filter(x => x.id !== id); storageSaveAbsences(n); return n; });
  }, []);

  // ─── Appointments ─────────────────────────────────────────────────────────

  const addAppointment = useCallback((a: Omit<Appointment, 'id' | 'createdAt' | 'history'>) => {
    const ts = new Date().toISOString();
    const full: Appointment = {
      ...a, id: salonGenerateId(), createdAt: ts, updatedAt: ts,
      history: [{ timestamp: ts, action: 'Appuntamento creato' }],
    };
    setAppointments(prev => { const n = [...prev, full]; storageSaveAppointments(n); return n; });

    // ── WhatsApp conferma appuntamento (fire-and-forget) ──
    try {
      const snap = latestStateRef.current;
      const wa = (snap.salonConfig as SalonConfig | undefined)?.whatsapp;
      if (wa?.ultraMsgInstanceId && wa?.ultraMsgToken && (wa.appointmentConfirmEnabled ?? true)) {
        const clientsList = (snap.clients as Client[]) ?? [];
        const servicesList = (snap.services as Service[]) ?? [];
        const client = clientsList.find(c => c.id === a.clientId);
        if (client?.phone) {
          const svcNames = servicesList.filter(s => (a.serviceIds ?? []).includes(s.id)).map(s => s.name).join(', ') || 'appuntamento';
          const salonName = (snap.salonConfig as SalonConfig | undefined)?.salonName ?? 'il salone';
          const DEFAULT_APPT_MSG = 'Ciao {nome}! ✅ Il tuo appuntamento di *{servizio}* è confermato per il {data} alle {ora} da {salone}. A presto!';
          const template = wa.appointmentConfirmMsg ?? DEFAULT_APPT_MSG;
          const msg = template
            .split('{nome}').join(client.firstName)
            .split('{servizio}').join(svcNames)
            .split('{data}').join(a.date)
            .split('{ora}').join(a.startTime)
            .split('{salone}').join(salonName);
          fetch('/api/ultramsg/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ instanceId: wa.ultraMsgInstanceId, token: wa.ultraMsgToken, to: client.phone, message: msg }),
          }).catch(() => {});
        }
      }
    } catch { /* non bloccare il salvataggio */ }
  }, []); // latestStateRef è un ref — non serve come dep

  const updateAppointment = useCallback((a: Appointment, historyNote?: string) => {
    const ts = new Date().toISOString();
    const updated = historyNote
      ? { ...a, updatedAt: ts, history: [...(a.history || []), { timestamp: ts, action: historyNote }] }
      : { ...a, updatedAt: ts };
    setAppointments(prev => { const n = prev.map(x => x.id === a.id ? updated : x); storageSaveAppointments(n); return n; });
  }, []);

  const changeAppointmentStatus = useCallback((id: string, status: AppointmentStatus) => {
    setAppointments(prev => {
      const ts2 = new Date().toISOString();
      const n = prev.map(x => x.id === id
        ? { ...x, status, updatedAt: ts2, history: [...(x.history || []), { timestamp: ts2, action: `Stato cambiato in: ${status}` }] }
        : x);
      storageSaveAppointments(n);
      return n;
    });
  }, []);

  const deleteAppointment = useCallback((id: string) => {
    storageMarkDeleted('appointments', id);
    setAppointments(prev => { const n = prev.filter(x => x.id !== id); storageSaveAppointments(n); return n; });
  }, []);

  // ─── Waiting List ─────────────────────────────────────────────────────────

  const addWaitingEntry = useCallback((e: Omit<WaitingListEntry, 'id' | 'createdAt'>) => {
    const ts = new Date().toISOString();
    const full: WaitingListEntry = { ...e, id: salonGenerateId(), createdAt: ts, updatedAt: ts };
    setWaitingList(prev => { const n = [...prev, full]; storageSaveWaitingList(n); return n; });
  }, []);

  const deleteWaitingEntry = useCallback((id: string) => {
    storageMarkDeleted('waitingList', id);
    setWaitingList(prev => { const n = prev.filter(x => x.id !== id); storageSaveWaitingList(n); return n; });
  }, []);

  // ─── Products ─────────────────────────────────────────────────────────────

  const addProduct = useCallback((p: Omit<Product, 'id' | 'createdAt'>): string => {
    const ts = new Date().toISOString();
    const full: Product = { ...p, id: salonGenerateId(), createdAt: ts, updatedAt: ts };
    setProducts(prev => { const n = [...prev, full]; storageSaveProducts(n); return n; });
    return full.id;
  }, []);

  const updateProduct = useCallback((p: Product) => {
    const updated = { ...p, updatedAt: new Date().toISOString() };
    setProducts(prev => { const n = prev.map(x => x.id === p.id ? updated : x); storageSaveProducts(n); return n; });
  }, []);

  const deleteProduct = useCallback((id: string) => {
    storageMarkDeleted('products', id);
    setProducts(prev => { const n = prev.filter(x => x.id !== id); storageSaveProducts(n); return n; });
  }, []);

  // ─── Stock Movements ──────────────────────────────────────────────────────

  const addStockMovement = useCallback((m: Omit<StockMovement, 'id' | 'createdAt'>) => {
    const ts = new Date().toISOString();
    const full: StockMovement = { ...m, id: salonGenerateId(), createdAt: ts, updatedAt: ts };
    setStockMovements(prev => { const n = [...prev, full]; storageSaveStockMovements(n); return n; });
    // Update product stock
    setProducts(prev => {
      const n = prev.map(p => p.id === m.productId
        ? { ...p, stock: Math.max(0, p.stock + m.quantity) }
        : p);
      storageSaveProducts(n);
      return n;
    });
  }, []);

  // ─── Gift Cards ───────────────────────────────────────────────────────────

  const addGiftCard = useCallback((g: Omit<GiftCard, 'id' | 'createdAt' | 'code'>) => {
    const ts = new Date().toISOString();
    const code = `GC-${Date.now().toString(36).toUpperCase()}`;
    const full: GiftCard = { ...g, id: salonGenerateId(), code, createdAt: ts, updatedAt: ts };
    setGiftCards(prev => { const n = [...prev, full]; storageSaveGiftCards(n); return n; });
  }, []);

  const redeemGiftCard = useCallback((code: string, amount: number): boolean => {
    const normalizedCode = code.trim().toUpperCase();
    let ok = false;
    setGiftCards(prev => {
      const ts2 = new Date().toISOString();
      const n = prev.map(g => {
        if (g.code.trim().toUpperCase() === normalizedCode && g.isActive && g.remainingValue >= amount) {
          ok = true;
          const remaining = g.remainingValue - amount;
          return { ...g, remainingValue: remaining, isActive: remaining > 0, updatedAt: ts2 };
        }
        return g;
      });
      storageSaveGiftCards(n);
      return n;
    });
    return ok;
  }, []);

  const updateGiftCard = useCallback((g: GiftCard) => {
    const updated = { ...g, updatedAt: new Date().toISOString() };
    setGiftCards(prev => { const n = prev.map(x => x.id === g.id ? updated : x); storageSaveGiftCards(n); return n; });
  }, []);

  // ─── Config ───────────────────────────────────────────────────────────────

  const updateSalonConfig = useCallback((c: Partial<SalonConfig>) => {
    setSalonConfig(prev => { const n = { ...prev, ...c }; storageSaveSalonConfig(n); return n; });
  }, []);

  const updateClientAppConfig = useCallback((c: Partial<ClientAppConfig>) => {
    setClientAppConfig(prev => { const n = { ...prev, ...c }; storageSaveClientAppConfig(n); return n; });
  }, []);

  // ─── Payments ───────────────────────────────────────────────────────────────

  const addPayment = useCallback((p: Omit<Payment, 'id' | 'createdAt'>) => {
    const ts = new Date().toISOString();
    const full: Payment = { ...p, id: salonGenerateId(), createdAt: ts, updatedAt: ts };
    setPayments(prev => { const n = [full, ...prev]; storageSavePayments(n); return n; });
    // Auto loyalty points: use configured multiplier (default 1pt per euro)
    if (p.clientId) {
      const snap = latestStateRef.current;
      const ptsPerEuro = (snap.salonConfig as { loyaltyPointsPerEuro?: number } | undefined)?.loyaltyPointsPerEuro ?? 1;
      setClients(prev => {
        const n = prev.map(c => c.id === p.clientId ? { ...c, loyaltyPoints: c.loyaltyPoints + Math.floor(p.total * ptsPerEuro) } : c);
        storageSaveClients(n);
        return n;
      });
    }
    // Auto-deduct products linked to services (Collegamento Prodotti → Servizi)
    const serviceIdsInPayment = p.items.filter(i => i.serviceId && !i.isProduct).map(i => i.serviceId!);
    if (serviceIdsInPayment.length > 0) {
      const snap = latestStateRef.current;
      const servicesList = (snap.services as Service[] | undefined) ?? [];
      const date = p.date || new Date().toISOString().slice(0, 10);
      const deductions: { productId: string; qty: number }[] = [];
      for (const svcId of serviceIdsInPayment) {
        const svc = servicesList.find(s => s.id === svcId);
        if (svc?.productUsage?.length) {
          for (const usage of svc.productUsage) {
            const existing = deductions.find(d => d.productId === usage.productId);
            if (existing) existing.qty += usage.qty;
            else deductions.push({ productId: usage.productId, qty: usage.qty });
          }
        }
      }
      if (deductions.length > 0) {
        const movements: StockMovement[] = deductions.map(d => ({
          id: salonGenerateId(), productId: d.productId,
          type: 'internal_use' as const,
          quantity: -d.qty, date,
          notes: `Uso automatico da servizio (pagamento ${full.id.slice(-6)})`,
          operatorId: p.operatorId,
          createdAt: new Date().toISOString(),
        }));
        setStockMovements(prev => { const n = [...prev, ...movements]; storageSaveStockMovements(n); return n; });
        setProducts(prev => {
          let updated = [...prev];
          for (const d of deductions) {
            updated = updated.map(pr => pr.id === d.productId
              ? { ...pr, stock: Math.max(0, pr.stock - d.qty) }
              : pr);
          }
          storageSaveProducts(updated);
          return updated;
        });
      }
    }
  }, []); // latestStateRef is a ref — no dep needed

  const deletePayment = useCallback((id: string) => {
    // First, find the payment to check if it's linked to an appointment
    const pay = (latestStateRef.current.payments as Payment[] | undefined)?.find(x => x.id === id);
    storageMarkDeleted('payments', id);
    setPayments(prev => { const n = prev.filter(x => x.id !== id); storageSavePayments(n); return n; });
    // Update localSavedAt so a rapid refresh doesn't restore the deleted entry from cloud
    setLocalSavedAt(Date.now());
    // If this payment was linked to an appointment, restore it to 'scheduled' in the agenda
    if (pay?.appointmentId) {
      setAppointments(prev => {
        const appt = prev.find(a => a.id === pay.appointmentId);
        if (!appt || appt.status !== 'completed') return prev;
        const updated = prev.map(a => a.id === appt.id ? { ...a, status: 'scheduled' as const } : a);
        storageSaveAppointments(updated);
        return updated;
      });
    }
  }, []);

  const addCashSession = useCallback((openingBalance: number) => {
    const full: CashSession = {
      id: salonGenerateId(),
      date: new Date().toISOString().slice(0, 10),
      openingBalance,
      closingBalance: null,
      closedAt: null,
      createdAt: new Date().toISOString(),
    };
    setCashSessions(prev => { const n = [full, ...prev]; storageSaveCashSessions(n); return n; });
  }, []);

  const closeCashSession = useCallback((id: string, closingBalance: number) => {
    setCashSessions(prev => {
      const n = prev.map(s => s.id === id
        ? { ...s, closingBalance, closedAt: new Date().toISOString() }
        : s);
      storageSaveCashSessions(n);
      return n;
    });
  }, []);

  // ─── Active Operator (PIN) ──────────────────────────────────────────────────────

  const setPrivateMode = useCallback((v: boolean) => {
    setPrivateModeState(v);
  }, []);

  const setActiveOperatorId = useCallback((id: string | null) => {
    storageSaveActiveOperatorId(id);
    setActiveOperatorIdState(id);
    setPrivateModeState(false); // reset private mode on operator change
  }, []);

  const verifyOperatorPin = useCallback((operatorId: string, pin: string): boolean => {
    const ops = (latestStateRef.current.operators as Operator[] | undefined) ?? storageGetOperators();
    const op = ops.find(o => o.id === operatorId);
    if (!op) return false;
    if (!op.pin) return true; // no PIN set = always accept
    return op.pin === pin;
  }, []);

  const checkPinMode = useCallback((operatorId: string | null, pin: string): 'public' | 'private' | 'invalid' => {
    const ops = (latestStateRef.current.operators as Operator[] | undefined) ?? storageGetOperators();
    const cfg = (latestStateRef.current.salonConfig as SalonConfig | undefined) ?? storageGetSalonConfig();

    if (operatorId === null) {
      // No-operator titolare: use salonConfig pins
      const publ = cfg.ownerPublicPin;
      const priv = cfg.ownerPrivatePin;
      if (!publ && !priv) return 'public'; // free access
      if (priv && pin === priv) return 'private';
      if (!publ || pin === publ) return 'public';
      return 'invalid';
    }

    const op = ops.find(o => o.id === operatorId);
    if (!op) return 'invalid';
    // Check private PIN first
    if (op.privatePin && pin === op.privatePin) return 'private';
    // Check public PIN
    if (!op.pin) return 'public'; // no public PIN = free access
    if (pin === op.pin) return 'public';
    return 'invalid';
  }, []);

  const updateGamificationConfig = useCallback((c: Partial<GamificationConfig>) => {
    setGamificationConfig(prev => { const n = { ...prev, ...c }; storageSaveGamificationConfig(n); return n; });
  }, []);

  const addWhatsAppMessage = useCallback((m: WhatsAppMessage) => {
    setWhatsappMessages(prev => [...prev, m].slice(-200)); // keep last 200
  }, []);

  // ─── Suppliers ────────────────────────────────────────────────────────────

  const addSupplier = useCallback((s: Omit<Supplier, 'id' | 'createdAt'>): string => {
    const ts = new Date().toISOString();
    const full: Supplier = { ...s, id: salonGenerateId(), createdAt: ts, updatedAt: ts };
    setSuppliers(prev => { const n = [...prev, full]; storageSaveSuppliers(n); return n; });
    return full.id;
  }, []);

  const updateSupplier = useCallback((s: Supplier) => {
    const updated = { ...s, updatedAt: new Date().toISOString() };
    setSuppliers(prev => { const n = prev.map(x => x.id === s.id ? updated : x); storageSaveSuppliers(n); return n; });
  }, []);

  const deleteSupplier = useCallback((id: string) => {
    storageMarkDeleted('suppliers', id);
    setSuppliers(prev => { const n = prev.filter(x => x.id !== id); storageSaveSuppliers(n); return n; });
  }, []);

  // ─── Client Subscriptions ─────────────────────────────────────────────────

  const addSubscription = useCallback((s: Omit<ClientSubscription, 'id' | 'createdAt'>): string => {
    const ts = new Date().toISOString();
    const full: ClientSubscription = { ...s, id: salonGenerateId(), createdAt: ts, updatedAt: ts };
    setSubscriptions(prev => { const n = [...prev, full]; storageSaveSubscriptions(n); return n; });
    return full.id;
  }, []);

  const updateSubscription = useCallback((s: ClientSubscription) => {
    const updated = { ...s, updatedAt: new Date().toISOString() };
    setSubscriptions(prev => { const n = prev.map(x => x.id === s.id ? updated : x); storageSaveSubscriptions(n); return n; });
  }, []);

  const deleteSubscription = useCallback((id: string) => {
    storageMarkDeleted('subscriptions', id);
    setSubscriptions(prev => { const n = prev.filter(x => x.id !== id); storageSaveSubscriptions(n); return n; });
  }, []);

  const useSubscriptionSession = useCallback((subscriptionId: string): boolean => {
    let success = false;
    setSubscriptions(prev => {
      const sub = prev.find(x => x.id === subscriptionId);
      if (!sub || sub.usedSessions >= sub.totalSessions || sub.status !== 'active') return prev;
      const usedSessions = sub.usedSessions + 1;
      const status: SubscriptionStatus = usedSessions >= sub.totalSessions ? 'exhausted' : sub.status;
      const updated = prev.map(x => x.id === subscriptionId ? { ...x, usedSessions, status } : x);
      storageSaveSubscriptions(updated);
      success = true;
      return updated;
    });
    return success;
  }, []);

  return (
    <SalonContext.Provider value={{
      clients, technicalCards, services, operators, absences,
      appointments, waitingList, products, stockMovements, giftCards,
      salonConfig, clientAppConfig, salonLoading,
      addClient, updateClient, deleteClient, addLoyaltyPoints,
      addTechnicalCard, updateTechnicalCard, deleteTechnicalCard,
      addService, updateService, deleteService,
      addOperator, updateOperator, deleteOperator,
      addAbsence, deleteAbsence,
      addAppointment, updateAppointment, changeAppointmentStatus, deleteAppointment,
      addWaitingEntry, deleteWaitingEntry,
      addProduct, updateProduct, deleteProduct,
      addStockMovement,
      addGiftCard, redeemGiftCard, updateGiftCard,
      updateSalonConfig, updateClientAppConfig,
      payments, cashSessions, addPayment, deletePayment, addCashSession, closeCashSession,
      activeOperatorId, setActiveOperatorId, verifyOperatorPin,
      isPrivateMode, setPrivateMode, checkPinMode,
      gamificationConfig, updateGamificationConfig,
      whatsappMessages, addWhatsAppMessage,
      suppliers, addSupplier, updateSupplier, deleteSupplier,
      subscriptions, addSubscription, updateSubscription, deleteSubscription, useSubscriptionSession,
      importPendingBookings,
      cloudSyncStatus,
    }}>
      {children}
    </SalonContext.Provider>
  );
}

export function useSalon(): SalonContextValue {
  const ctx = useContext(SalonContext);
  if (!ctx) throw new Error('useSalon must be used inside SalonProvider');
  return ctx;
}









