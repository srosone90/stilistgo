'use client';

import React, { useState, useCallback } from 'react';
import {
  Search, X, Save, RefreshCw, UserCog, Settings, Users, Calendar,
  ChevronRight, ToggleLeft, ToggleRight, Plus, Trash2, Eye, EyeOff,
} from 'lucide-react';

interface Operator {
  id: string;
  name: string;
  pin: string | null;
  role: string;
  color: string;
  email: string;
  active: boolean;
  commissionRate: number;
}

interface SalonConfig {
  salonName?: string;
  email?: string;
  phone?: string;
  address?: string;
  vatNumber?: string;
  currency?: string;
  openTime?: string;
  closeTime?: string;
  slotMinutes?: number;
  dormientiDays?: number;
}

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  loyaltyPoints: number;
  createdAt: string;
}

interface Appointment {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  clientId: string;
  operatorId: string;
  serviceIds: string[];
}

interface SalonState {
  operators?: Operator[];
  salonConfig?: SalonConfig;
  clients?: Client[];
  appointments?: Appointment[];
}

interface Tenant {
  user_id: string;
  salon_name: string;
  email: string;
  plan: string;
}

const inp = (extra?: React.CSSProperties): React.CSSProperties => ({
  width: '100%', background: '#12121a', border: '1px solid #2e2e40', borderRadius: '10px',
  padding: '9px 12px', color: '#f4f4f5', fontSize: '13px', outline: 'none',
  boxSizing: 'border-box', ...extra,
});

const card = (extra?: React.CSSProperties): React.CSSProperties => ({
  background: '#1c1c27', border: '1px solid #2e2e40', borderRadius: '16px', padding: '20px', ...extra,
});

const btn = (variant: 'primary' | 'danger' | 'ghost' | 'purple' = 'primary', extra?: React.CSSProperties): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
  borderRadius: '10px', fontWeight: 600, fontSize: '12px', cursor: 'pointer',
  background: variant === 'primary' ? 'linear-gradient(135deg,#f59e0b,#ef4444)'
    : variant === 'danger' ? 'rgba(239,68,68,0.12)'
    : variant === 'purple' ? 'rgba(99,102,241,0.15)'
    : 'rgba(255,255,255,0.05)',
  color: variant === 'danger' ? '#f87171' : variant === 'purple' ? '#818cf8' : 'white',
  border: variant === 'danger' ? '1px solid rgba(239,68,68,0.3)'
    : variant === 'ghost' ? '1px solid #2e2e40'
    : variant === 'purple' ? '1px solid rgba(99,102,241,0.3)'
    : 'none',
  ...extra,
});

const STATUS_COLOR: Record<string, string> = {
  scheduled: '#818cf8', completed: '#4ade80', cancelled: '#f87171', noshow: '#fbbf24',
};

export default function SalonDataSection({ af, tenants }: {
  af: (url: string, opts?: RequestInit) => Promise<Response>;
  tenants: Tenant[];
}) {
  const [search, setSearch] = useState('');
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [tab, setTab] = useState<'operators' | 'config' | 'clients' | 'appointments'>('operators');
  const [state, setState] = useState<SalonState | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [editOperators, setEditOperators] = useState<Operator[]>([]);
  const [editConfig, setEditConfig] = useState<SalonConfig>({});
  const [showPins, setShowPins] = useState<Record<string, boolean>>({});

  const filtered = tenants.filter(t => {
    const q = search.toLowerCase();
    return !q || t.salon_name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q);
  });

  const loadTenant = useCallback(async (t: Tenant) => {
    setSelectedTenant(t);
    setLoading(true);
    setState(null);
    setTab('operators');
    setSavedMsg('');
    try {
      const res = await af(`/api/admin/salon-data?user_id=${t.user_id}`);
      if (!res.ok) { setLoading(false); return; }
      const d = await res.json();
      const s = d.state as SalonState;
      setState(s);
      setEditOperators((s.operators ?? []).map(op => ({ ...op, pin: op.pin ?? '' })));
      setEditConfig(s.salonConfig ?? {});
    } finally {
      setLoading(false);
    }
  }, [af]);

  const saveOperators = async () => {
    if (!selectedTenant) return;
    setSaving(true);
    try {
      const res = await af('/api/admin/salon-data', {
        method: 'PATCH',
        body: JSON.stringify({
          user_id: selectedTenant.user_id,
          operators: editOperators.map(op => ({ ...op, pin: op.pin || null })),
        }),
      });
      if (res.ok) { setSavedMsg('Operatori salvati ✓'); setTimeout(() => setSavedMsg(''), 2500); }
      else { const d = await res.json(); alert('Errore: ' + d.error); }
    } finally { setSaving(false); }
  };

  const saveConfig = async () => {
    if (!selectedTenant) return;
    setSaving(true);
    try {
      const res = await af('/api/admin/salon-data', {
        method: 'PATCH',
        body: JSON.stringify({ user_id: selectedTenant.user_id, salonConfig: editConfig }),
      });
      if (res.ok) { setSavedMsg('Config salvata ✓'); setTimeout(() => setSavedMsg(''), 2500); }
      else { const d = await res.json(); alert('Errore: ' + d.error); }
    } finally { setSaving(false); }
  };

  const addOperator = () => {
    const newOp: Operator = {
      id: `op-${Date.now()}`,
      name: 'Nuovo operatore',
      pin: null,
      role: 'operator',
      color: '#6366f1',
      email: '',
      active: true,
      commissionRate: 0,
    };
    setEditOperators(prev => [...prev, newOp]);
  };

  const removeOperator = (id: string) => {
    setEditOperators(prev => prev.filter(op => op.id !== id));
  };

  const updateOp = (id: string, key: keyof Operator, value: unknown) => {
    setEditOperators(prev => prev.map(op => op.id === id ? { ...op, [key]: value } : op));
  };

  const clientMap = new Map((state?.clients ?? []).map(c => [c.id, c]));
  const opMap = new Map((state?.operators ?? []).map(op => [op.id, op]));

  return (
    <div style={{ display: 'flex', gap: '20px', height: '100%' }}>
      <div style={{ width: '280px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#71717a' }} />
          <input placeholder="Cerca salone…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...inp(), paddingLeft: '30px' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
          {filtered.map(t => (
            <button key={t.user_id} onClick={() => loadTenant(t)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                padding: '10px 12px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                background: selectedTenant?.user_id === t.user_id ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)',
                borderLeft: selectedTenant?.user_id === t.user_id ? '3px solid #6366f1' : '3px solid transparent',
                textAlign: 'left', gap: '2px',
              }}>
              <span style={{ color: '#f4f4f5', fontSize: '13px', fontWeight: 600 }}>{t.salon_name}</span>
              <span style={{ color: '#71717a', fontSize: '11px' }}>{t.email}</span>
            </button>
          ))}
          {filtered.length === 0 && <p style={{ color: '#3f3f5a', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>Nessun salone trovato.</p>}
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {!selectedTenant && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', color: '#3f3f5a', fontSize: '13px' }}>
            ← Seleziona un salone per gestirne i dati
          </div>
        )}

        {selectedTenant && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ color: '#f4f4f5', fontWeight: 700, fontSize: '18px', margin: 0 }}>{selectedTenant.salon_name}</h2>
                <p style={{ color: '#71717a', fontSize: '12px', margin: '2px 0 0' }}>{selectedTenant.email} · {selectedTenant.user_id.slice(0, 16)}…</p>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {savedMsg && <span style={{ color: '#4ade80', fontSize: '12px', fontWeight: 600 }}>{savedMsg}</span>}
                <button onClick={() => loadTenant(selectedTenant)} style={btn('ghost')}>
                  <RefreshCw size={13} /> Ricarica
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '4px', background: '#12121a', borderRadius: '12px', padding: '4px', width: 'fit-content' }}>
              {([
                { id: 'operators', icon: <UserCog size={13} />, label: 'Operatori' },
                { id: 'config',    icon: <Settings size={13} />, label: 'Config salone' },
                { id: 'clients',   icon: <Users size={13} />,   label: `Clienti (${state?.clients?.length ?? '…'})` },
                { id: 'appointments', icon: <Calendar size={13} />, label: `Appuntamenti (${state?.appointments?.length ?? '…'})` },
              ] as const).map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: tab === t.id ? 600 : 400, background: tab === t.id ? '#1c1c27' : 'transparent', color: tab === t.id ? '#f4f4f5' : '#71717a' }}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#71717a', padding: '40px 0' }}>
                <RefreshCw size={15} /> Caricamento…
              </div>
            )}

            {!loading && tab === 'operators' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ color: '#71717a', fontSize: '12px', margin: 0 }}>{editOperators.length} operatori configurati</p>
                  <button onClick={addOperator} style={btn('purple')}>
                    <Plus size={13} /> Aggiungi operatore
                  </button>
                </div>

                {editOperators.map((op, idx) => (
                  <div key={op.id} style={card({ padding: '16px' })}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: op.color + '25', color: op.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '15px', flexShrink: 0 }}>
                        {op.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ color: '#f4f4f5', fontWeight: 600, fontSize: '14px', margin: 0 }}>{op.name}</p>
                        <p style={{ color: '#71717a', fontSize: '11px', margin: 0 }}>{op.id}</p>
                      </div>
                      <button onClick={() => updateOp(op.id, 'active', !op.active)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: op.active ? '#4ade80' : '#3f3f5a', padding: 0 }}>
                        {op.active ? <ToggleRight size={26} /> : <ToggleLeft size={26} />}
                      </button>
                      {idx > 0 && (
                        <button onClick={() => removeOperator(op.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#71717a', padding: 0 }}>
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: '#71717a', marginBottom: '4px' }}>Nome</label>
                        <input value={op.name} onChange={e => updateOp(op.id, 'name', e.target.value)} style={inp()} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: '#71717a', marginBottom: '4px' }}>PIN</label>
                        <div style={{ position: 'relative' }}>
                          <input
                            type={showPins[op.id] ? 'text' : 'password'}
                            value={op.pin ?? ''}
                            onChange={e => updateOp(op.id, 'pin', e.target.value.replace(/\D/g, '').slice(0, 8))}
                            placeholder="Nessun PIN"
                            style={{ ...inp(), paddingRight: '36px' }}
                          />
                          <button onClick={() => setShowPins(p => ({ ...p, [op.id]: !p[op.id] }))}
                            style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#71717a', padding: 0 }}>
                            {showPins[op.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: '#71717a', marginBottom: '4px' }}>Ruolo</label>
                        <select value={op.role} onChange={e => updateOp(op.id, 'role', e.target.value)}
                          style={{ ...inp(), cursor: 'pointer' }}>
                          <option value="owner">Titolare (owner)</option>
                          <option value="operator">Operatore</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: '#71717a', marginBottom: '4px' }}>Email</label>
                        <input value={op.email} onChange={e => updateOp(op.id, 'email', e.target.value)} style={inp()} placeholder="(opzionale)" />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: '#71717a', marginBottom: '4px' }}>Colore</label>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input type="color" value={op.color} onChange={e => updateOp(op.id, 'color', e.target.value)}
                            style={{ width: '40px', height: '36px', padding: '2px', borderRadius: '8px', border: '1px solid #2e2e40', background: '#12121a', cursor: 'pointer' }} />
                          <input value={op.color} onChange={e => updateOp(op.id, 'color', e.target.value)} style={{ ...inp(), flex: 1 }} />
                        </div>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: '#71717a', marginBottom: '4px' }}>Commissione %</label>
                        <input type="number" min={0} max={100} value={op.commissionRate}
                          onChange={e => updateOp(op.id, 'commissionRate', parseFloat(e.target.value) || 0)} style={inp()} />
                      </div>
                    </div>
                  </div>
                ))}

                <button onClick={saveOperators} disabled={saving}
                  style={{ ...btn('primary'), justifyContent: 'center', padding: '12px', opacity: saving ? 0.6 : 1 }}>
                  <Save size={14} /> {saving ? 'Salvataggio…' : 'Salva operatori'}
                </button>
              </div>
            )}

            {!loading && tab === 'config' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={card()}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    {([
                      ['Nome salone',   'salonName',  'text'],
                      ['Email',         'email',      'email'],
                      ['Telefono',      'phone',      'tel'],
                      ['Indirizzo',     'address',    'text'],
                      ['P.IVA / CF',    'vatNumber',  'text'],
                      ['Valuta',        'currency',   'text'],
                      ['Orario apertura', 'openTime', 'time'],
                      ['Orario chiusura', 'closeTime','time'],
                    ] as [string, keyof SalonConfig, string][]).map(([label, key, type]) => (
                      <div key={key}>
                        <label style={{ display: 'block', fontSize: '11px', color: '#71717a', marginBottom: '4px' }}>{label}</label>
                        <input type={type} value={(editConfig[key] as string) ?? ''}
                          onChange={e => setEditConfig(p => ({ ...p, [key]: e.target.value }))} style={inp()} />
                      </div>
                    ))}
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: '#71717a', marginBottom: '4px' }}>Slot minuti</label>
                      <input type="number" min={5} max={120} value={editConfig.slotMinutes ?? 30}
                        onChange={e => setEditConfig(p => ({ ...p, slotMinutes: parseInt(e.target.value) || 30 }))} style={inp()} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: '#71717a', marginBottom: '4px' }}>Giorni clienti dormienti</label>
                      <input type="number" min={1} value={editConfig.dormientiDays ?? 60}
                        onChange={e => setEditConfig(p => ({ ...p, dormientiDays: parseInt(e.target.value) || 60 }))} style={inp()} />
                    </div>
                  </div>
                </div>
                <button onClick={saveConfig} disabled={saving}
                  style={{ ...btn('primary'), justifyContent: 'center', padding: '12px', opacity: saving ? 0.6 : 1 }}>
                  <Save size={14} /> {saving ? 'Salvataggio…' : 'Salva configurazione'}
                </button>
              </div>
            )}

            {!loading && tab === 'clients' && (
              <div style={card({ padding: 0, overflow: 'hidden' })}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #2e2e40' }}>
                        {['Nome', 'Telefono', 'Email', 'Punti fedeltà', 'Registrato'].map(h => (
                          <th key={h} style={{ padding: '12px 14px', textAlign: 'left', color: '#71717a', fontWeight: 500, fontSize: '11px' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(state?.clients ?? []).map(c => (
                        <tr key={c.id} style={{ borderBottom: '1px solid #1e1e2a' }}>
                          <td style={{ padding: '10px 14px', color: '#f4f4f5', fontWeight: 600 }}>{c.firstName} {c.lastName}</td>
                          <td style={{ padding: '10px 14px', color: '#a1a1aa' }}>{c.phone || '—'}</td>
                          <td style={{ padding: '10px 14px', color: '#a1a1aa' }}>{c.email || '—'}</td>
                          <td style={{ padding: '10px 14px', color: '#818cf8', fontWeight: 600 }}>{c.loyaltyPoints ?? 0}</td>
                          <td style={{ padding: '10px 14px', color: '#71717a', fontSize: '11px' }}>
                            {c.createdAt ? new Date(c.createdAt).toLocaleDateString('it-IT') : '—'}
                          </td>
                        </tr>
                      ))}
                      {(state?.clients ?? []).length === 0 && (
                        <tr><td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#3f3f5a' }}>Nessun cliente.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {!loading && tab === 'appointments' && (
              <div style={card({ padding: 0, overflow: 'hidden' })}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #2e2e40' }}>
                        {['Data', 'Orario', 'Cliente', 'Operatore', 'Stato'].map(h => (
                          <th key={h} style={{ padding: '12px 14px', textAlign: 'left', color: '#71717a', fontWeight: 500, fontSize: '11px' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(state?.appointments ?? [])
                        .sort((a, b) => b.date.localeCompare(a.date))
                        .map(a => {
                          const client = clientMap.get(a.clientId);
                          const op = opMap.get(a.operatorId);
                          return (
                            <tr key={a.id} style={{ borderBottom: '1px solid #1e1e2a' }}>
                              <td style={{ padding: '10px 14px', color: '#f4f4f5', fontWeight: 600 }}>
                                {new Date(a.date).toLocaleDateString('it-IT')}
                              </td>
                              <td style={{ padding: '10px 14px', color: '#a1a1aa' }}>{a.startTime} – {a.endTime}</td>
                              <td style={{ padding: '10px 14px', color: '#a1a1aa' }}>
                                {client ? `${client.firstName} ${client.lastName}` : a.clientId.slice(0, 10) + '…'}
                              </td>
                              <td style={{ padding: '10px 14px' }}>
                                {op ? (
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: op.color, flexShrink: 0 }} />
                                    <span style={{ color: '#a1a1aa' }}>{op.name}</span>
                                  </span>
                                ) : <span style={{ color: '#3f3f5a' }}>—</span>}
                              </td>
                              <td style={{ padding: '10px 14px' }}>
                                <span style={{ color: STATUS_COLOR[a.status] ?? '#71717a', fontWeight: 600, fontSize: '11px' }}>
                                  {a.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      {(state?.appointments ?? []).length === 0 && (
                        <tr><td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#3f3f5a' }}>Nessun appuntamento.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

