'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import {
  Client, TechnicalCard, Service, Operator, Absence,
  Appointment, AppointmentStatus, WaitingListEntry,
  Product, StockMovement, GiftCard, SalonConfig, AppointmentHistoryEntry,
  Payment, CashSession, GamificationConfig, DEFAULT_GAMIFICATION_CONFIG,
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
  salonGenerateId,
} from '@/lib/salonStorage';
import { getCurrentUser } from '@/lib/supabase';
import { dbGetSalonState, dbSaveSalonState } from '@/lib/salonDb';

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
  addProduct: (p: Omit<Product, 'id' | 'createdAt'>) => void;
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
  const [salonConfig, setSalonConfig] = useState<SalonConfig>(storageGetSalonConfig());
  const [payments, setPayments] = useState<Payment[]>([]);
  const [cashSessions, setCashSessions] = useState<CashSession[]>([]);
  const [activeOperatorId, setActiveOperatorIdState] = useState<string | null>(null);
  const [salonLoading, setSalonLoading] = useState(true);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cloudLoadAttempted = useRef(false);

  useEffect(() => {
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
    setSalonLoading(false);
  }, []);

  // ─── Cloud sync: load from Supabase once after local load ─────────────────
  useEffect(() => {
    if (salonLoading) return;
    const loadCloud = async () => {
      try {
        const user = await getCurrentUser();
        if (!user) return;
        const cloudState = await dbGetSalonState(user.id as string);
        if (!cloudState) return;
        if (cloudState.clients)            { setClients(cloudState.clients as Client[]); storageSaveClients(cloudState.clients as Client[]); }
        if (cloudState.technicalCards)     { setTechnicalCards(cloudState.technicalCards as TechnicalCard[]); storageSaveTechnicalCards(cloudState.technicalCards as TechnicalCard[]); }
        if (cloudState.services)           { setServices(cloudState.services as Service[]); storageSaveServices(cloudState.services as Service[]); }
        if (cloudState.operators)          { setOperators(cloudState.operators as Operator[]); storageSaveOperators(cloudState.operators as Operator[]); }
        if (cloudState.absences)           { setAbsences(cloudState.absences as Absence[]); storageSaveAbsences(cloudState.absences as Absence[]); }
        if (cloudState.appointments)       { setAppointments(cloudState.appointments as Appointment[]); storageSaveAppointments(cloudState.appointments as Appointment[]); }
        if (cloudState.waitingList)        { setWaitingList(cloudState.waitingList as WaitingListEntry[]); storageSaveWaitingList(cloudState.waitingList as WaitingListEntry[]); }
        if (cloudState.products)           { setProducts(cloudState.products as Product[]); storageSaveProducts(cloudState.products as Product[]); }
        if (cloudState.stockMovements)     { setStockMovements(cloudState.stockMovements as StockMovement[]); storageSaveStockMovements(cloudState.stockMovements as StockMovement[]); }
        if (cloudState.giftCards)          { setGiftCards(cloudState.giftCards as GiftCard[]); storageSaveGiftCards(cloudState.giftCards as GiftCard[]); }
        if (cloudState.payments)           { setPayments(cloudState.payments as Payment[]); storageSavePayments(cloudState.payments as Payment[]); }
        if (cloudState.cashSessions)       { setCashSessions(cloudState.cashSessions as CashSession[]); storageSaveCashSessions(cloudState.cashSessions as CashSession[]); }
        if (cloudState.salonConfig)        { setSalonConfig(cloudState.salonConfig as SalonConfig); storageSaveSalonConfig(cloudState.salonConfig as SalonConfig); }
        if (cloudState.gamificationConfig) { setGamificationConfig(cloudState.gamificationConfig as GamificationConfig); storageSaveGamificationConfig(cloudState.gamificationConfig as GamificationConfig); }
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
    syncTimerRef.current = setTimeout(async () => {
      try {
        const user = await getCurrentUser();
        if (!user) return;
        await dbSaveSalonState(user.id as string, {
          clients, technicalCards, services, operators, absences, appointments,
          waitingList, products, stockMovements, giftCards, payments,
          cashSessions, salonConfig, gamificationConfig,
        });
      } catch { /* ignore */ }
    }, 3000);
    return () => { if (syncTimerRef.current) clearTimeout(syncTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, technicalCards, services, operators, absences, appointments,
      waitingList, products, stockMovements, giftCards, payments,
      cashSessions, salonConfig, gamificationConfig]);

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
  }, []);

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

  const addProduct = useCallback((p: Omit<Product, 'id' | 'createdAt'>) => {
    const full: Product = { ...p, id: salonGenerateId(), createdAt: new Date().toISOString() };
    setProducts(prev => { const n = [...prev, full]; storageSaveProducts(n); return n; });
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

  // ─── Payments ───────────────────────────────────────────────────────────────

  const addPayment = useCallback((p: Omit<Payment, 'id' | 'createdAt'>) => {
    const full: Payment = { ...p, id: salonGenerateId(), createdAt: new Date().toISOString() };
    setPayments(prev => { const n = [full, ...prev]; storageSavePayments(n); return n; });
    // Auto loyalty points: 1pt per euro spent
    if (p.clientId) {
      setClients(prev => {
        const n = prev.map(c => c.id === p.clientId ? { ...c, loyaltyPoints: c.loyaltyPoints + Math.floor(p.total) } : c);
        storageSaveClients(n);
        return n;
      });
    }
  }, []);

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
    const op = storageGetOperators().find(o => o.id === operatorId);
    if (!op) return false;
    if (!op.pin) return true; // no PIN set = always accept
    return op.pin === pin;
  }, []);

  const updateGamificationConfig = useCallback((c: Partial<GamificationConfig>) => {
    setGamificationConfig(prev => { const n = { ...prev, ...c }; storageSaveGamificationConfig(n); return n; });
  }, []);

  return (
    <SalonContext.Provider value={{
      clients, technicalCards, services, operators, absences,
      appointments, waitingList, products, stockMovements, giftCards,
      salonConfig, salonLoading,
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
      updateSalonConfig,
      payments, cashSessions, addPayment, deletePayment, addCashSession, closeCashSession,
      activeOperatorId, setActiveOperatorId, verifyOperatorPin,
      gamificationConfig, updateGamificationConfig,
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
