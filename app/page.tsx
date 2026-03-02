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
import { useApp } from '@/context/AppContext';
import { getCurrentUser } from '@/lib/supabase';
import { Plus, Loader2, CalendarDays, Users, Sparkles, UserCog, Package, Banknote } from 'lucide-react';

type View = 'dashboard' | 'tabella' | 'analisi' | 'impostazioni' | 'calendar' | 'clients' | 'services' | 'staff' | 'inventory' | 'cash';

export default function Home() {
  const router = useRouter();
  const [view, setView] = useState<View>('dashboard');
  const [showForm, setShowForm] = useState(false);
  const [fabTrigger, setFabTrigger] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const { loading } = useApp();

  // Auth guard
  useEffect(() => {
    getCurrentUser().then((user) => {
      if (!user) {
        router.push('/login');
      } else {
        setAuthChecked(true);
      }
    });
  }, [router]);

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
  };

  const renderView = () => {
    switch (view) {
      case 'dashboard': return <Dashboard />;
      case 'tabella': return <TabularView />;
      case 'analisi': return <AnalysisView />;
      case 'impostazioni': return <SettingsView />;
      case 'calendar': return <CalendarView newTrigger={fabTrigger} />;
      case 'clients': return <ClientsView newTrigger={fabTrigger} />;
      case 'services': return <ServicesView newTrigger={fabTrigger} />;
      case 'staff': return <StaffView newTrigger={fabTrigger} />;
      case 'inventory': return <InventoryView newTrigger={fabTrigger} />;
      case 'cash': return <CashView newTrigger={fabTrigger} />;
    }
  };

  if (!authChecked || loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: '#0f0f13' }}>
        <div className="flex flex-col items-center gap-4 text-center px-6">
          <Loader2 size={36} className="animate-spin" style={{ color: '#6366f1' }} />
          <div>
            <p className="text-white font-medium">Collegamento in corso...</p>
            <p className="text-xs mt-1" style={{ color: '#71717a' }}>
              Verifica autenticazione · caricamento dati
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#0f0f13' }}>
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar activeView={view} onNavigate={(v) => setView(v as View)} />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setSidebarOpen(false)} />
          <div className="relative z-50">
            <Sidebar activeView={view} onNavigate={(v) => { setView(v as View); setSidebarOpen(false); }} />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center justify-between px-4 py-3" style={{ background: '#16161f', borderBottom: '1px solid #2e2e40' }}>
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg" style={{ background: '#1c1c27' }}>
            <div className="space-y-1">
              <div className="w-5 h-0.5 rounded" style={{ background: '#d4d4d8' }} />
              <div className="w-5 h-0.5 rounded" style={{ background: '#d4d4d8' }} />
              <div className="w-5 h-0.5 rounded" style={{ background: '#d4d4d8' }} />
            </div>
          </button>
          <p className="font-bold text-white text-sm">Stylistgo</p>
          <div className="w-9" />
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto px-6 py-6">
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
    </div>
  );
}

