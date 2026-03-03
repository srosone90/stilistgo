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
} from '@/lib/salonStorage';
import { getCurrentUser } from '@/lib/supabase';
import { dbGetSalonState, dbSaveSalonState, dbGetOnlineBookings, dbUpdateBookingStatus } from '@/lib/salonDb';

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
  addOperator: (o: Omit<Operator, 'id' | 'createdAt'>) => void;
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
}

const SalonContext = createContext<SalonContextValue | null>(null);

export function SalonProvider({ children }: { children: React.ReactNode }) {
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
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [subscriptions, setSubscriptions] = useState<ClientSubscription[]>([]);
  const [salonLoading, setSalonLoading] = useState(true);
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
        setStorageUserId(user.id as string);
        const cloudState = await dbGetSalonState(user.id as string);
        if (!cloudState) return;
        // Only overwrite local data if cloud has actual content (non-empty arrays).
        // This prevents a partial/empty cloud state from wiping freshly-read local data.
        const arr = <T,>(v: unknown): v is T[] => Array.isArray(v) && (v as T[]).length > 0;
        if (arr<Client>(cloudState.clients))                   { setClients(cloudState.clients as Client[]); storageSaveClients(cloudState.clients as Client[]); }
        if (arr<TechnicalCard>(cloudState.technicalCards))     { setTechnicalCards(cloudState.technicalCards as TechnicalCard[]); storageSaveTechnicalCards(cloudState.technicalCards as TechnicalCard[]); }
        if (arr<Service>(cloudState.services))                 { setServices(cloudState.services as Service[]); storageSaveServices(cloudState.services as Service[]); }
        if (arr<Operator>(cloudState.operators))               { setOperators(cloudState.operators as Operator[]); storageSaveOperators(cloudState.operators as Operator[]); }
        if (arr<Absence>(cloudState.absences))                 { setAbsences(cloudState.absences as Absence[]); storageSaveAbsences(cloudState.absences as Absence[]); }
        if (arr<Appointment>(cloudState.appointments))         { setAppointments(cloudState.appointments as Appointment[]); storageSaveAppointments(cloudState.appointments as Appointment[]); }
        if (arr<WaitingListEntry>(cloudState.waitingList))     { setWaitingList(cloudState.waitingList as WaitingListEntry[]); storageSaveWaitingList(cloudState.waitingList as WaitingListEntry[]); }
        if (arr<Product>(cloudState.products))                 { setProducts(cloudState.products as Product[]); storageSaveProducts(cloudState.products as Product[]); }
        if (arr<StockMovement>(cloudState.stockMovements))     { setStockMovements(cloudState.stockMovements as StockMovement[]); storageSaveStockMovements(cloudState.stockMovements as StockMovement[]); }
        if (arr<GiftCard>(cloudState.giftCards))               { setGiftCards(cloudState.giftCards as GiftCard[]); storageSaveGiftCards(cloudState.giftCards as GiftCard[]); }
        if (arr<Payment>(cloudState.payments))                 { setPayments(cloudState.payments as Payment[]); storageSavePayments(cloudState.payments as Payment[]); }
        if (arr<CashSession>(cloudState.cashSessions))         { setCashSessions(cloudState.cashSessions as CashSession[]); storageSaveCashSessions(cloudState.cashSessions as CashSession[]); }
        if (arr<WhatsAppMessage>((cloudState as Record<string, unknown>).whatsappMessages)) { setWhatsappMessages((cloudState as Record<string, unknown>).whatsappMessages as WhatsAppMessage[]); }
        const cs = cloudState as Record<string, unknown>;
        if (arr<Supplier>(cs.suppliers))             { setSuppliers(cs.suppliers as Supplier[]); storageSaveSuppliers(cs.suppliers as Supplier[]); }
        if (arr<ClientSubscription>(cs.subscriptions)) { setSubscriptions(cs.subscriptions as ClientSubscription[]); storageSaveSubscriptions(cs.subscriptions as ClientSubscription[]); }
        // For object fields (salonConfig, gamificationConfig) compare timestamps:
        // only apply cloud data if cloud saved it MORE RECENTLY than our last local save.
        const cloudSavedAt = (cloudState._savedAt as number) ?? 0;
        const localSavedAt = getLocalSavedAt();
        const cloudIsNewer = cloudSavedAt >= localSavedAt;
        if (cloudIsNewer) {
          if (cloudState.salonConfig)        { setSalonConfig(cloudState.salonConfig as SalonConfig); storageSaveSalonConfig(cloudState.salonConfig as SalonConfig); }
          if (cloudState.gamificationConfig) { setGamificationConfig(cloudState.gamificationConfig as GamificationConfig); storageSaveGamificationConfig(cloudState.gamificationConfig as GamificationConfig); }
          if ((cloudState as Record<string, unknown>).clientAppConfig) { const cac = (cloudState as Record<string, unknown>).clientAppConfig as ClientAppConfig; setClientAppConfig(cac); storageSaveClientAppConfig(cac); }
        } else if (cloudState.salonConfig) {
          // Even if local is newer, always apply admin-set WhatsApp credentials from cloud.
          // Admins write directly to the DB without updating _savedAt, so we must always
          // pick up ultraMsgInstanceId/ultraMsgToken regardless of the timestamp comparison.
          const cloudWa = (cloudState.salonConfig as SalonConfig).whatsapp;
          if (cloudWa?.ultraMsgInstanceId || cloudWa?.ultraMsgToken) {
            setSalonConfig(prev => {
              const merged: SalonConfig = {
                ...prev,
                whatsapp: {
                  ...DEFAULT_WHATSAPP_CONFIG,
                  ...(prev.whatsapp ?? {}),
                  ultraMsgInstanceId: cloudWa.ultraMsgInstanceId,
                  ultraMsgToken: cloudWa.ultraMsgToken,
                },
              };
              storageSaveSalonConfig(merged);
              return merged;
            });
          }
        }

        // ── Auto-import pending online bookings into the calendar ────────────
        await importPendingBookings();
      } catch { /* ignore */ } finally {
        cloudLoadAttempted.current = true;
      }
    };
    loadCloud();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salonLoading]);

  // ─── Cloud sync: debounced save on every state change ─────────────────────
  useEffect(() => {
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
      if (!cloudLoadAttempted.current) return;
      if (syncTimerRef.current) { clearTimeout(syncTimerRef.current); syncTimerRef.current = null; }
      try {
        const user = await getCurrentUser();
        if (!user) return;
        const savedAt = Date.now();
        setLocalSavedAt(savedAt);
        await dbSaveSalonState(user.id as string, { ...latestStateRef.current, _savedAt: savedAt });
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

  // ─── Clients ──────────────────────────────────────────────────────────────

  const addClient = useCallback((c: Omit<Client, 'id' | 'createdAt'>): string => {
    const full: Client = { ...c, id: salonGenerateId(), createdAt: new Date().toISOString() };
    setClients(prev => { const n = [full, ...prev]; storageSaveClients(n); return n; });
    return full.id;
  }, []);

  const updateClient = useCallback((c: Client) => {
    setClients(prev => { const n = prev.map(x => x.id === c.id ? c : x); storageSaveClients(n); return n; });
  }, []);

  const deleteClient = useCallback((id: string) => {
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
    const full: TechnicalCard = { ...c, id: salonGenerateId(), createdAt: new Date().toISOString() };
    setTechnicalCards(prev => { const n = [full, ...prev]; storageSaveTechnicalCards(n); return n; });
  }, []);

  const updateTechnicalCard = useCallback((c: TechnicalCard) => {
    setTechnicalCards(prev => { const n = prev.map(x => x.id === c.id ? c : x); storageSaveTechnicalCards(n); return n; });
  }, []);

  const deleteTechnicalCard = useCallback((id: string) => {
    setTechnicalCards(prev => { const n = prev.filter(x => x.id !== id); storageSaveTechnicalCards(n); return n; });
  }, []);

  // ─── Services ─────────────────────────────────────────────────────────────

  const addService = useCallback((s: Omit<Service, 'id' | 'createdAt'>) => {
    const full: Service = { ...s, id: salonGenerateId(), createdAt: new Date().toISOString() };
    setServices(prev => { const n = [...prev, full]; storageSaveServices(n); return n; });
  }, []);

  const updateService = useCallback((s: Service) => {
    setServices(prev => { const n = prev.map(x => x.id === s.id ? s : x); storageSaveServices(n); return n; });
  }, []);

  const deleteService = useCallback((id: string) => {
    setServices(prev => { const n = prev.filter(x => x.id !== id); storageSaveServices(n); return n; });
  }, []);

  // ─── Operators ────────────────────────────────────────────────────────────

  const addOperator = useCallback((o: Omit<Operator, 'id' | 'createdAt'>) => {
    const full: Operator = { ...o, id: salonGenerateId(), createdAt: new Date().toISOString() };
    setOperators(prev => { const n = [...prev, full]; storageSaveOperators(n); return n; });
  }, []);

  const updateOperator = useCallback((o: Operator) => {
    setOperators(prev => { const n = prev.map(x => x.id === o.id ? o : x); storageSaveOperators(n); return n; });
  }, []);

  const deleteOperator = useCallback((id: string) => {
    setOperators(prev => { const n = prev.filter(x => x.id !== id); storageSaveOperators(n); return n; });
  }, []);

  // ─── Absences ─────────────────────────────────────────────────────────────

  const addAbsence = useCallback((a: Omit<Absence, 'id' | 'createdAt'>) => {
    const full: Absence = { ...a, id: salonGenerateId(), createdAt: new Date().toISOString() };
    setAbsences(prev => { const n = [...prev, full]; storageSaveAbsences(n); return n; });
  }, []);

  const deleteAbsence = useCallback((id: string) => {
    setAbsences(prev => { const n = prev.filter(x => x.id !== id); storageSaveAbsences(n); return n; });
  }, []);

  // ─── Appointments ─────────────────────────────────────────────────────────

  const addAppointment = useCallback((a: Omit<Appointment, 'id' | 'createdAt' | 'history'>) => {
    const full: Appointment = {
      ...a, id: salonGenerateId(), createdAt: new Date().toISOString(),
      history: [{ timestamp: new Date().toISOString(), action: 'Appuntamento creato' }],
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
    const updated = historyNote
      ? { ...a, history: [...(a.history || []), { timestamp: new Date().toISOString(), action: historyNote }] }
      : a;
    setAppointments(prev => { const n = prev.map(x => x.id === a.id ? updated : x); storageSaveAppointments(n); return n; });
  }, []);

  const changeAppointmentStatus = useCallback((id: string, status: AppointmentStatus) => {
    setAppointments(prev => {
      const n = prev.map(x => x.id === id
        ? { ...x, status, history: [...(x.history || []), { timestamp: new Date().toISOString(), action: `Stato cambiato in: ${status}` }] }
        : x);
      storageSaveAppointments(n);
      return n;
    });
  }, []);

  const deleteAppointment = useCallback((id: string) => {
    setAppointments(prev => { const n = prev.filter(x => x.id !== id); storageSaveAppointments(n); return n; });
  }, []);

  // ─── Waiting List ─────────────────────────────────────────────────────────

  const addWaitingEntry = useCallback((e: Omit<WaitingListEntry, 'id' | 'createdAt'>) => {
    const full: WaitingListEntry = { ...e, id: salonGenerateId(), createdAt: new Date().toISOString() };
    setWaitingList(prev => { const n = [...prev, full]; storageSaveWaitingList(n); return n; });
  }, []);

  const deleteWaitingEntry = useCallback((id: string) => {
    setWaitingList(prev => { const n = prev.filter(x => x.id !== id); storageSaveWaitingList(n); return n; });
  }, []);

  // ─── Products ─────────────────────────────────────────────────────────────

  const addProduct = useCallback((p: Omit<Product, 'id' | 'createdAt'>): string => {
    const full: Product = { ...p, id: salonGenerateId(), createdAt: new Date().toISOString() };
    setProducts(prev => { const n = [...prev, full]; storageSaveProducts(n); return n; });
    return full.id;
  }, []);

  const updateProduct = useCallback((p: Product) => {
    setProducts(prev => { const n = prev.map(x => x.id === p.id ? p : x); storageSaveProducts(n); return n; });
  }, []);

  const deleteProduct = useCallback((id: string) => {
    setProducts(prev => { const n = prev.filter(x => x.id !== id); storageSaveProducts(n); return n; });
  }, []);

  // ─── Stock Movements ──────────────────────────────────────────────────────

  const addStockMovement = useCallback((m: Omit<StockMovement, 'id' | 'createdAt'>) => {
    const full: StockMovement = { ...m, id: salonGenerateId(), createdAt: new Date().toISOString() };
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
    const code = `GC-${Date.now().toString(36).toUpperCase()}`;
    const full: GiftCard = { ...g, id: salonGenerateId(), code, createdAt: new Date().toISOString() };
    setGiftCards(prev => { const n = [...prev, full]; storageSaveGiftCards(n); return n; });
  }, []);

  const redeemGiftCard = useCallback((code: string, amount: number): boolean => {
    let ok = false;
    setGiftCards(prev => {
      const n = prev.map(g => {
        if (g.code === code && g.isActive && g.remainingValue >= amount) {
          ok = true;
          const remaining = g.remainingValue - amount;
          return { ...g, remainingValue: remaining, isActive: remaining > 0 };
        }
        return g;
      });
      storageSaveGiftCards(n);
      return n;
    });
    return ok;
  }, []);

  const updateGiftCard = useCallback((g: GiftCard) => {
    setGiftCards(prev => { const n = prev.map(x => x.id === g.id ? g : x); storageSaveGiftCards(n); return n; });
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
    const full: Payment = { ...p, id: salonGenerateId(), createdAt: new Date().toISOString() };
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
    setPayments(prev => { const n = prev.filter(x => x.id !== id); storageSavePayments(n); return n; });
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

  const setActiveOperatorId = useCallback((id: string | null) => {
    storageSaveActiveOperatorId(id);
    setActiveOperatorIdState(id);
  }, []);

  const verifyOperatorPin = useCallback((operatorId: string, pin: string): boolean => {
    // Use the always-current ref rather than stale localStorage to get latest operators
    const ops = (latestStateRef.current.operators as Operator[] | undefined) ?? storageGetOperators();
    const op = ops.find(o => o.id === operatorId);
    if (!op) return false;
    if (!op.pin) return true; // no PIN set = always accept
    return op.pin === pin;
  }, []);

  const updateGamificationConfig = useCallback((c: Partial<GamificationConfig>) => {
    setGamificationConfig(prev => { const n = { ...prev, ...c }; storageSaveGamificationConfig(n); return n; });
  }, []);

  const addWhatsAppMessage = useCallback((m: WhatsAppMessage) => {
    setWhatsappMessages(prev => [...prev, m].slice(-200)); // keep last 200
  }, []);

  // ─── Suppliers ────────────────────────────────────────────────────────────

  const addSupplier = useCallback((s: Omit<Supplier, 'id' | 'createdAt'>): string => {
    const full: Supplier = { ...s, id: salonGenerateId(), createdAt: new Date().toISOString() };
    setSuppliers(prev => { const n = [...prev, full]; storageSaveSuppliers(n); return n; });
    return full.id;
  }, []);

  const updateSupplier = useCallback((s: Supplier) => {
    setSuppliers(prev => { const n = prev.map(x => x.id === s.id ? s : x); storageSaveSuppliers(n); return n; });
  }, []);

  const deleteSupplier = useCallback((id: string) => {
    setSuppliers(prev => { const n = prev.filter(x => x.id !== id); storageSaveSuppliers(n); return n; });
  }, []);

  // ─── Client Subscriptions ─────────────────────────────────────────────────

  const addSubscription = useCallback((s: Omit<ClientSubscription, 'id' | 'createdAt'>): string => {
    const full: ClientSubscription = { ...s, id: salonGenerateId(), createdAt: new Date().toISOString() };
    setSubscriptions(prev => { const n = [...prev, full]; storageSaveSubscriptions(n); return n; });
    return full.id;
  }, []);

  const updateSubscription = useCallback((s: ClientSubscription) => {
    setSubscriptions(prev => { const n = prev.map(x => x.id === s.id ? s : x); storageSaveSubscriptions(n); return n; });
  }, []);

  const deleteSubscription = useCallback((id: string) => {
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
      gamificationConfig, updateGamificationConfig,
      whatsappMessages, addWhatsAppMessage,
      suppliers, addSupplier, updateSupplier, deleteSupplier,
      subscriptions, addSubscription, updateSubscription, deleteSubscription, useSubscriptionSession,
      importPendingBookings,
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
