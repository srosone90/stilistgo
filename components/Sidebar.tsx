'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LayoutDashboard, Table2, BarChart3, Settings, Scissors, Wifi, WifiOff, LogOut } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { getCurrentUser, signOut } from '@/lib/supabase';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
  { id: 'tabella', label: 'Tabella', icon: <Table2 size={20} /> },
  { id: 'analisi', label: 'Analisi', icon: <BarChart3 size={20} /> },
  { id: 'impostazioni', label: 'Impostazioni', icon: <Settings size={20} /> },
];

interface SidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
}

export default function Sidebar({ activeView, onNavigate }: SidebarProps) {
  const { dataSource } = useApp();
  const router = useRouter();
  const [userName, setUserName] = useState('');

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
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
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
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 space-y-3" style={{ borderTop: '1px solid #2e2e40' }}>
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
    </aside>
  );
}
