'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Dashboard from '@/components/Dashboard';
import TabularView from '@/components/TabularView';
import AnalysisView from '@/components/AnalysisView';
import SettingsView from '@/components/SettingsView';
import EntryForm from '@/components/EntryForm';
import CalendarView from '@/components/CalendarView';
import ClientsView from '@/components/ClientsView';
import ServicesView from '@/components/ServicesView';
import StaffView from '@/components/StaffView';
import InventoryView from '@/components/InventoryView';
import CashView from '@/components/CashView';
import GamificationView from '@/components/GamificationView';
import LoyaltyView from '@/components/LoyaltyView';
import OnlineBookingsView from '@/components/OnlineBookingsView';
import AutomationsView from '@/components/AutomationsView';
import OperatorLockScreen from '@/components/OperatorLockScreen';
import { useApp } from '@/context/AppContext';
import { useSalon } from '@/context/SalonContext';
import { getCurrentUser, signOut } from '@/lib/supabase';
import { DEFAULT_OPERATOR_PERMISSIONS, OperatorPermissions } from '@/types/salon';
import { PLAN_FEATURES, PlanFeatures, VIEW_TO_FEATURE, UPGRADE_TEXT } from '@/lib/planGate';
import { Plus, Loader2, CalendarDays, Users, Sparkles, UserCog, Package, Banknote, Trophy, Star, Globe, LogOut, Lock, MessageSquare } from 'lucide-react';

type View = 'dashboard' | 'tabella' | 'analisi' | 'impostazioni' | 'calendar' | 'clients' | 'services' | 'staff' | 'inventory' | 'cash' | 'gamification' | 'loyalty' | 'bookings' | 'automazioni';

export default function Home() {
  const router = useRouter();
  const [view, setView] = useState<View>('dashboard');
  const [showForm, setShowForm] = useState(false);
  const [fabTrigger, setFabTrigger] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [showLockScreen, setShowLockScreen] = useState(false);
  const [cashPreset, setCashPreset] = useState<{ clientId: string; appointmentId: string } | null>(null);
  const [planFeatures, setPlanFeatures] = useState<PlanFeatures>(PLAN_FEATURES.trial);
  const [currentPlan, setCurrentPlan] = useState('trial');
  const { loading } = useApp();
  const { activeOperatorId, operators } = useSalon();

  // Calcola permessi effettivi: admin/titolare = accesso totale, altri operatori = permissions
  const FULL_PERMISSIONS: OperatorPermissions = { calendar: true, clients: true, services: true, staff: true, inventory: true, cash: true, accounting: true };
  const activeOp = operators.find(o => o.id === activeOperatorId);
  const effectivePerms: OperatorPermissions = !activeOperatorId || !activeOp
    ? FULL_PERMISSIONS
    : activeOp.role === 'owner'
      ? FULL_PERMISSIONS
      : activeOp.permissions ?? DEFAULT_OPERATOR_PERMISSIONS;

  // Se la vista attuale non è accessibile dopo cambio permessi, torna a calendar o dashboard
  useEffect(() => {
    if (showLockScreen) return;
    const viewPermsMap: Record<View, boolean> = {
      dashboard: effectivePerms.accounting, tabella: effectivePerms.accounting,
      analisi: effectivePerms.accounting, impostazioni: effectivePerms.accounting,
      calendar: effectivePerms.calendar, clients: effectivePerms.clients,
      services: effectivePerms.services, staff: effectivePerms.staff,
      inventory: effectivePerms.inventory, cash: effectivePerms.cash,
      gamification: true, loyalty: true, bookings: effectivePerms.accounting, automazioni: true,
    };
    if (!viewPermsMap[view]) {
      const fallback = (Object.keys(viewPermsMap) as View[]).find(v => viewPermsMap[v]);
      setView(fallback ?? 'calendar');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOperatorId, showLockScreen]);

  // Auth guard — mostra SEMPRE il lock screen al caricamento
  useEffect(() => {
    getCurrentUser().then(async (user) => {
      if (!user) {
        router.push('/login');
      } else {
        setAuthChecked(true);
        setShowLockScreen(true);
        // Fetch plan for this user
        try {
          const res = await fetch(`/api/user/plan?userId=${user.id}`);
          if (res.ok) {
            const data = await res.json();
            setPlanFeatures(data.features ?? PLAN_FEATURES.trial);
            setCurrentPlan(data.plan ?? 'trial');
          }
        } catch { /* fall back to trial */ }
      }
    });
  }, [router]);

  // Reset FAB trigger ogni volta che si cambia sezione
  useEffect(() => { setFabTrigger(0); }, [view]);

  // Nodo "accesso negato" da usare nelle view bloccate
  const AccessDenied = (
    <div className="flex flex-col items-center justify-center h-full gap-3 py-20">
      <div className="text-5xl">🔒</div>
      <p className="text-white font-semibold text-lg">Accesso non consentito</p>
      <p className="text-sm" style={{ color: 'var(--muted)' }}>Contatta il titolare per richiedere l&apos;accesso a questa sezione.</p>
    </div>
  );

  // Upgrade wall per funzioni non incluse nel piano
  const upgradeWall = (viewId: string) => {
    const info = UPGRADE_TEXT[viewId] ?? { plan: 'superiore', description: 'Questa funzione non è disponibile nel tuo piano attuale.' };
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 py-20 px-6">
        <div style={{ background: 'rgba(99,102,241,0.1)', borderRadius: '50%', padding: '20px' }}>
          <Lock size={36} style={{ color: 'var(--accent-light)' }} />
        </div>
        <div className="text-center">
          <p className="text-white font-bold text-xl mb-2">Funzione non disponibile</p>
          <p className="text-sm mb-1" style={{ color: 'var(--text-3)' }}>{info.description}</p>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Piano attuale: <span style={{ color: '#fbbf24', fontWeight: 600 }}>{currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}</span></p>
        </div>
        <div style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '12px', padding: '12px 24px', textAlign: 'center' }}>
          <p style={{ color: 'var(--accent-light)', fontSize: '13px', margin: 0 }}>Richiedi l&apos;upgrade al piano <strong>{info.plan.charAt(0).toUpperCase() + info.plan.slice(1)}</strong> per sbloccare questa funzione.</p>
        </div>
      </div>
    );
  };

  const FAB_CONFIG: Record<View, { label: string; icon: React.ReactNode; action: () => void }> = {
    dashboard:    { label: 'Nuova Voce',       icon: <Plus size={20} />,      action: () => setShowForm(true) },
    tabella:      { label: 'Nuova Voce',       icon: <Plus size={20} />,      action: () => setShowForm(true) },
    analisi:      { label: 'Nuova Voce',       icon: <Plus size={20} />,      action: () => setShowForm(true) },
    impostazioni: { label: 'Nuova Voce',       icon: <Plus size={20} />,      action: () => setShowForm(true) },
    calendar:     { label: 'Nuovo Appuntamento', icon: <CalendarDays size={20} />, action: () => setFabTrigger(t => t + 1) },
    clients:      { label: 'Nuovo Cliente',    icon: <Users size={20} />,     action: () => setFabTrigger(t => t + 1) },
    services:     { label: 'Nuovo Servizio',   icon: <Sparkles size={20} />,  action: () => setFabTrigger(t => t + 1) },
    staff:        { label: 'Nuovo Operatore',  icon: <UserCog size={20} />,   action: () => setFabTrigger(t => t + 1) },
    inventory:    { label: 'Nuovo Prodotto',   icon: <Package size={20} />,   action: () => setFabTrigger(t => t + 1) },
    cash:         { label: 'Incassa',          icon: <Banknote size={20} />,  action: () => setFabTrigger(t => t + 1) },
    gamification: { label: 'Gamification',     icon: <Trophy size={20} />,    action: () => {} },
    loyalty:      { label: 'Fidelizzazione',    icon: <Star size={20} />,      action: () => {} },
    bookings:     { label: 'Prenotazioni',      icon: <Globe size={20} />,         action: () => {} },
    automazioni:  { label: 'Automazioni',         icon: <MessageSquare size={20} />, action: () => {} },
  };

  const renderView = () => {
    // Plan gating: check if the active view is locked by the current plan
    const featureKey = VIEW_TO_FEATURE[view];
    if (featureKey && !planFeatures[featureKey]) {
      return upgradeWall(view);
    }
    switch (view) {
      case 'dashboard': return effectivePerms.accounting ? <Dashboard showAccounting={true} /> : <Dashboard showAccounting={false} />;
      case 'tabella':   return effectivePerms.accounting ? <TabularView /> : AccessDenied;
      case 'analisi':   return effectivePerms.accounting ? <AnalysisView /> : AccessDenied;
      case 'impostazioni': return effectivePerms.accounting ? <SettingsView /> : AccessDenied;
      case 'calendar': return effectivePerms.calendar ? <CalendarView newTrigger={fabTrigger} onGoToCash={(clientId, appointmentId) => { setCashPreset({ clientId, appointmentId }); setView('cash'); }} /> : AccessDenied;
      case 'clients':  return effectivePerms.clients  ? <ClientsView newTrigger={fabTrigger} /> : AccessDenied;
      case 'services': return effectivePerms.services  ? <ServicesView newTrigger={fabTrigger} /> : AccessDenied;
      case 'staff':    return effectivePerms.staff     ? <StaffView newTrigger={fabTrigger} /> : AccessDenied;
      case 'inventory':return effectivePerms.inventory ? <InventoryView newTrigger={fabTrigger} /> : AccessDenied;
      case 'cash':     return effectivePerms.cash      ? <CashView newTrigger={fabTrigger} cashPreset={cashPreset} onPresetConsumed={() => setCashPreset(null)} /> : AccessDenied;
      case 'gamification': return <GamificationView />;
      case 'loyalty':      return <LoyaltyView />;
      case 'bookings':     return effectivePerms.accounting ? <OnlineBookingsView /> : AccessDenied;
      case 'automazioni':  return <AutomationsView />;
    }
  };

  if (!authChecked || loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: 'var(--bg-page)' }}>
        <div className="flex flex-col items-center gap-4 text-center px-6">
          <Loader2 size={36} className="animate-spin" style={{ color: '#6366f1' }} />
          <div>
            <p className="text-white font-medium">Collegamento in corso...</p>
            <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
              Verifica autenticazione · caricamento dati
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-page)' }}>
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar activeView={view} onNavigate={(v) => setView(v as View)} onLock={() => setShowLockScreen(true)} permissions={effectivePerms} planFeatures={planFeatures} />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setSidebarOpen(false)}>
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)' }} />
          <div className="absolute left-0 top-0 h-full z-50" onClick={e => e.stopPropagation()}>
            <Sidebar activeView={view} onNavigate={(v) => { setView(v as View); setSidebarOpen(false); }} onLock={() => { setSidebarOpen(false); setShowLockScreen(true); }} permissions={effectivePerms} planFeatures={planFeatures} />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center justify-between px-4 py-3" style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border)' }}>
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg" style={{ background: 'var(--bg-card)' }}>
            <div className="space-y-1">
              <div className="w-5 h-0.5 rounded" style={{ background: 'var(--text-2)' }} />
              <div className="w-5 h-0.5 rounded" style={{ background: 'var(--text-2)' }} />
              <div className="w-5 h-0.5 rounded" style={{ background: 'var(--text-2)' }} />
            </div>
          </button>
          <p className="font-bold text-white text-sm">Stylistgo</p>
          <button
            onClick={async () => { await signOut(); window.location.href = '/login'; }}
            className="p-2 rounded-lg"
            style={{ background: 'var(--bg-card)' }}
            title="Esci"
          >
            <LogOut size={18} style={{ color: 'var(--muted)' }} />
          </button>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto px-3 py-3 md:px-6 md:py-6">
          {renderView()}
        </main>
      </div>

      {/* FAB — Contextual action button */}
      <button
        onClick={FAB_CONFIG[view].action}
        className="fixed bottom-6 right-6 z-30 flex items-center gap-2 px-5 py-3 rounded-2xl font-semibold text-white shadow-2xl transition-all hover:scale-105 active:scale-95"
        style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)', boxShadow: '0 0 30px rgba(99,102,241,0.4)' }}
      >
        {FAB_CONFIG[view].icon}
        <span className="hidden sm:block">{FAB_CONFIG[view].label}</span>
      </button>

      {/* Entry Form Modal */}
      {showForm && <EntryForm onClose={() => setShowForm(false)} />}

      {/* Operator Lock Screen */}
      {showLockScreen && (
        <OperatorLockScreen onUnlock={() => setShowLockScreen(false)} />
      )}
    </div>
  );
}

