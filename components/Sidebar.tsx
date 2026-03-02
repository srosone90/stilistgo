'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LayoutDashboard, Table2, BarChart3, Settings, Scissors, Wifi, WifiOff, LogOut, CalendarDays, Users, Sparkles, UserCog, Package, Banknote, UserCircle, X, Lock, LogIn, Trophy } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { getCurrentUser, signOut } from '@/lib/supabase';
import { useSalon } from '@/context/SalonContext';
import { OperatorPermissions } from '@/types/salon';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: 'Contabilità',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
      { id: 'tabella', label: 'Tabella', icon: <Table2 size={18} /> },
      { id: 'analisi', label: 'Analisi', icon: <BarChart3 size={18} /> },
      { id: 'impostazioni', label: 'Impostazioni', icon: <Settings size={18} /> },
    ],
  },
  {
    label: 'Gestionale Salone',
    items: [
      { id: 'calendar', label: 'Agenda', icon: <CalendarDays size={18} /> },
      { id: 'clients', label: 'Clienti', icon: <Users size={18} /> },
      { id: 'services', label: 'Servizi', icon: <Sparkles size={18} /> },
      { id: 'staff', label: 'Personale', icon: <UserCog size={18} /> },
      { id: 'inventory', label: 'Magazzino', icon: <Package size={18} /> },
      { id: 'cash', label: 'Cassa', icon: <Banknote size={18} /> },
    ],
  },
  {
    label: 'Team',
    items: [
      { id: 'gamification', label: 'Gamification', icon: <Trophy size={18} /> },
    ],
  },
];

interface SidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
  onLock?: () => void;
  permissions?: OperatorPermissions;
}

export default function Sidebar({ activeView, onNavigate, onLock, permissions }: SidebarProps) {
  const { dataSource } = useApp();
  const { operators, activeOperatorId, setActiveOperatorId, verifyOperatorPin } = useSalon();
  const router = useRouter();
  const [userName, setUserName] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinStep, setPinStep] = useState<'select' | 'pin'>('select');
  const [selectedOpId, setSelectedOpId] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  const activeOp = operators.find(o => o.id === activeOperatorId);

  function openPinModal() { setShowPinModal(true); setPinStep('select'); setSelectedOpId(''); setPinInput(''); setPinError(false); }
  function handleOpSelect(id: string) {
    const op = operators.find(o => o.id === id);
    if (!op) return;
    if (!op.pin) { setActiveOperatorId(id); setShowPinModal(false); return; }
    setSelectedOpId(id); setPinStep('pin'); setPinInput(''); setPinError(false);
  }
  function handlePinSubmit() {
    const ok = verifyOperatorPin(selectedOpId, pinInput);
    if (ok) { setActiveOperatorId(selectedOpId); setShowPinModal(false); }
    else { setPinError(true); setPinInput(''); }
  }

  useEffect(() => {
    getCurrentUser().then(u => {
      if (u) setUserName(u.user_metadata?.full_name || u.email || '');
    });
  }, []);

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
    router.refresh();
  };
  return (
    <aside className="w-60 shrink-0 h-screen sticky top-0 flex flex-col"
      style={{ background: '#16161f', borderRight: '1px solid #2e2e40' }}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5" style={{ borderBottom: '1px solid #2e2e40' }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
          style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)' }}>
          <Scissors size={18} className="text-white" />
        </div>
        <div>
          <p className="font-bold text-sm text-white leading-tight">Stylistgo</p>
          <p className="text-xs" style={{ color: '#71717a' }}>Salon Gestionale</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-4">
        {navGroups.map(group => (
          <div key={group.label}>
            <p className="px-3 mb-1 text-xs font-semibold uppercase tracking-wider" style={{ color: '#3f3f5a' }}>{group.label}</p>
            <div className="space-y-0.5">
              {group.items.filter(item => {
                if (!permissions) return true;
                if (item.id === 'gamification') return true; // always visible
                if (item.id === 'dashboard' || item.id === 'tabella' || item.id === 'analisi' || item.id === 'impostazioni') return permissions.accounting;
                if (item.id === 'calendar') return permissions.calendar;
                if (item.id === 'clients') return permissions.clients;
                if (item.id === 'services') return permissions.services;
                if (item.id === 'staff') return permissions.staff;
                if (item.id === 'inventory') return permissions.inventory;
                if (item.id === 'cash') return permissions.cash;
                return true;
              }).map((item) => {
                const active = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all"
                    style={{
                      background: active ? 'rgba(99,102,241,0.15)' : 'transparent',
                      color: active ? '#818cf8' : '#71717a',
                      border: active ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
                    }}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 space-y-3" style={{ borderTop: '1px solid #2e2e40' }}>
        {/* Active operator */}
        <button onClick={openPinModal}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all"
          style={{ background: activeOp ? `${activeOp.color}18` : '#12121a', border: `1px solid ${activeOp ? activeOp.color + '40' : '#2e2e40'}`, cursor: 'pointer' }}>
          <UserCircle size={16} style={{ color: activeOp?.color || '#71717a' }} />
          <div className="text-left flex-1 min-w-0">
            <p className="text-xs font-medium truncate" style={{ color: activeOp?.color || '#71717a' }}>
              {activeOp ? activeOp.name : 'Nessun operatore'}
            </p>
            <p className="text-xs" style={{ color: '#3f3f5a' }}>Tocca per cambiare</p>
          </div>
        </button>
        {/* Blocca schermo */}
        {onLock && (
          <button onClick={onLock}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all"
            style={{ background: 'transparent', color: '#71717a', border: '1px solid transparent' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,102,241,0.1)'; (e.currentTarget as HTMLButtonElement).style.color = '#818cf8'; (e.currentTarget as HTMLButtonElement).style.border = '1px solid rgba(99,102,241,0.2)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#71717a'; (e.currentTarget as HTMLButtonElement).style.border = '1px solid transparent'; }}
          >
            <LogIn size={16} />
            Cambia operatore
          </button>
        )}
        {/* User info */}
        {userName && (
          <div className="px-1">
            <p className="text-xs font-medium text-white truncate">{userName}</p>
            <div className="flex items-center gap-1 mt-0.5 text-xs"
              style={{ color: dataSource === 'supabase' ? '#22c55e' : '#f59e0b' }}>
              {dataSource === 'supabase'
                ? <><Wifi size={10} /> Cloud</>
                : <><WifiOff size={10} /> Locale</>}
            </div>
          </div>
        )}
        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all"
          style={{ background: 'transparent', color: '#71717a', border: '1px solid transparent' }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.1)';
            (e.currentTarget as HTMLButtonElement).style.color = '#ef4444';
            (e.currentTarget as HTMLButtonElement).style.border = '1px solid rgba(239,68,68,0.2)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            (e.currentTarget as HTMLButtonElement).style.color = '#71717a';
            (e.currentTarget as HTMLButtonElement).style.border = '1px solid transparent';
          }}
        >
          <LogOut size={16} />
          Esci
        </button>
        <p className="text-xs px-1" style={{ color: '#3f3f5a' }}>v1.0.0 · 2026</p>
      </div>

      {/* PIN modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-xs rounded-2xl p-5" style={{ background: '#18181f', border: '1px solid #2e2e40' }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-white text-sm">{pinStep === 'select' ? 'Chi sta lavorando?' : 'Inserisci PIN'}</h3>
              <button onClick={() => setShowPinModal(false)} style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            {pinStep === 'select' ? (
              <div className="space-y-2">
                {operators.filter(o => o.active).map(op => (
                  <button key={op.id} onClick={() => handleOpSelect(op.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left"
                    style={{ background: '#12121a', border: `1px solid ${op.color}40`, cursor: 'pointer' }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ background: op.color + '30', color: op.color }}>
                      {op.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium" style={{ color: '#d4d4d8' }}>{op.name}</p>
                      <p style={{ fontSize: 11, color: '#71717a' }}>{op.pin ? <><Lock size={9} style={{ display: 'inline' }} /> PIN richiesto</> : 'Nessun PIN'}</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div>
                <p className="text-sm mb-3" style={{ color: '#a1a1aa' }}>
                  Operatore: <strong style={{ color: '#d4d4d8' }}>{operators.find(o => o.id === selectedOpId)?.name}</strong>
                </p>
                <input
                  type="password" maxLength={8} placeholder="PIN" value={pinInput}
                  onChange={e => { setPinInput(e.target.value); setPinError(false); }}
                  onKeyDown={e => e.key === 'Enter' && handlePinSubmit()}
                  autoFocus
                  style={{ background: '#12121a', border: `1px solid ${pinError ? '#ef4444' : '#2e2e40'}`, borderRadius: '10px', padding: '10px 13px', color: '#f4f4f5', fontSize: '16px', outline: 'none', width: '100%', letterSpacing: '0.3em', textAlign: 'center' }}
                />
                {pinError && <p className="text-xs mt-1 text-center" style={{ color: '#ef4444' }}>PIN errato. Riprova.</p>}
                <button onClick={handlePinSubmit} style={{ width: '100%', marginTop: 12, background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', color: '#818cf8', borderRadius: '10px', padding: '9px', fontSize: '13px', cursor: 'pointer' }}>
                  Accedi
                </button>
                <button onClick={() => setPinStep('select')} style={{ width: '100%', marginTop: 6, background: 'none', border: 'none', color: '#71717a', fontSize: '12px', cursor: 'pointer' }}>
                  ← Cambia operatore
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
