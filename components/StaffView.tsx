'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useSalon } from '@/context/SalonContext';
import { Operator, OperatorRole, WorkShift, DayOfWeek, DAY_NAMES, DAY_NAMES_FULL, OPERATOR_COLORS, defaultSchedule, Absence, OperatorPermissions, DEFAULT_OPERATOR_PERMISSIONS, PERMISSION_LABELS } from '@/types/salon';
import { format, parseISO } from 'date-fns';
import { salonGenerateId } from '@/lib/salonStorage';
import { formatCurrency } from '@/lib/calculations';
import { Plus, X, Pencil, Trash2, User } from 'lucide-react';

const card: React.CSSProperties = { background: '#1c1c27', border: '1px solid #2e2e40', borderRadius: '16px', padding: '20px' };
const inputStyle: React.CSSProperties = { background: '#12121a', border: '1px solid #2e2e40', borderRadius: '10px', padding: '9px 13px', color: '#f4f4f5', fontSize: '13px', outline: 'none', width: '100%' };
const labelStyle: React.CSSProperties = { fontSize: '12px', color: '#71717a', marginBottom: '4px', display: 'block' };
const btnPrimary: React.CSSProperties = { background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', color: '#818cf8', borderRadius: '10px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' };

const ROLE_LABELS: Record<OperatorRole, string> = { owner: 'Titolare', operator: 'Operatore', reception: 'Reception' };

const EMPTY_OPERATOR: Omit<Operator, 'id' | 'createdAt'> = {
  name: '', email: '', role: 'operator', serviceIds: [],
  color: OPERATOR_COLORS[0], commissionRate: 0,
  schedule: defaultSchedule(), active: true, pin: '',
  permissions: { ...DEFAULT_OPERATOR_PERMISSIONS },
};

const EMPTY_ABSENCE: Omit<Absence, 'id' | 'createdAt'> = {
  operatorId: '', startDate: format(new Date(), 'yyyy-MM-dd'),
  endDate: format(new Date(), 'yyyy-MM-dd'), reason: '',
};

export default function StaffView({ newTrigger }: { newTrigger?: number }) {
  const { operators, addOperator, updateOperator, deleteOperator, services, absences, addAbsence, deleteAbsence, appointments } = useSalon();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { if (newTrigger && newTrigger > 0) { setShowForm(true); setEditOp(null); setForm(EMPTY_OPERATOR); } }, [newTrigger]);
  const [editOp, setEditOp] = useState<Operator | null>(null);
  const [form, setForm] = useState<Omit<Operator, 'id' | 'createdAt'>>(EMPTY_OPERATOR);
  const [showAbsForm, setShowAbsForm] = useState(false);
  const [absForm, setAbsForm] = useState<Omit<Absence, 'id' | 'createdAt'>>(EMPTY_ABSENCE);
  const [activeTab, setActiveTab] = useState<'info' | 'schedule' | 'absences' | 'stats'>('info');

  const selected = selectedId ? operators.find(o => o.id === selectedId) ?? null : null;

  /* ── Stats per operator ── */
  const opStats = useMemo(() => {
    const stats: Record<string, { total: number; count: number; noshow: number }> = {};
    appointments.forEach(a => {
      if (!stats[a.operatorId]) stats[a.operatorId] = { total: 0, count: 0, noshow: 0 };
      stats[a.operatorId].count++;
      if (a.status === 'no-show') stats[a.operatorId].noshow++;
    });
    return stats;
  }, [appointments]);

  function openNew() {
    setEditOp(null);
    setForm({ ...EMPTY_OPERATOR, color: OPERATOR_COLORS[operators.length % OPERATOR_COLORS.length] });
    setShowForm(true);
  }

  function openEdit(o: Operator) {
    setEditOp(o);
    setForm({ name: o.name, email: o.email, role: o.role, serviceIds: [...o.serviceIds], color: o.color, commissionRate: o.commissionRate, schedule: o.schedule.map(s => ({ ...s })), active: o.active, pin: o.pin || '', permissions: o.permissions ? { ...o.permissions } : { ...DEFAULT_OPERATOR_PERMISSIONS } });
    setShowForm(true);
  }

  function handleSave() {
    if (!form.name.trim()) return;
    if (editOp) updateOperator({ ...editOp, ...form });
    else addOperator(form);
    setShowForm(false);
  }

  function updateShift(index: number, field: keyof WorkShift, value: string | boolean) {
    setForm(p => {
      const schedule = p.schedule.map((s, i) => i === index ? { ...s, [field]: value } : s);
      return { ...p, schedule };
    });
  }

  function toggleService(id: string) {
    setForm(p => ({ ...p, serviceIds: p.serviceIds.includes(id) ? p.serviceIds.filter(x => x !== id) : [...p.serviceIds, id] }));
  }

  function handleAddAbsence() {
    if (!selected) return;
    addAbsence({ ...absForm, operatorId: selected.id });
    setShowAbsForm(false);
    setAbsForm({ ...EMPTY_ABSENCE, operatorId: selected.id });
  }

  return (
    <div className="flex flex-col md:flex-row gap-4 md:gap-5 h-full" style={{ minHeight: 0 }}>
      {/* ── LEFT: list ── */}
      <div className={`flex flex-col gap-4 md:w-72 md:shrink-0${selectedId ? ' hidden md:flex' : ''}`}>
        <div>
          <h1 className="text-2xl font-bold text-white">Personale</h1>
          <p className="text-xs mt-1" style={{ color: '#71717a' }}>{operators.filter(o => o.active).length} operatori attivi</p>
        </div>
        <button onClick={openNew} style={btnPrimary}><Plus size={14} /> Nuovo operatore</button>
        <div className="flex flex-col gap-2 overflow-y-auto" style={{ flex: 1 }}>
          {operators.map(o => (
            <button key={o.id} onClick={() => { setSelectedId(o.id); setActiveTab('info'); }}
              className="text-left rounded-xl px-4 py-3 transition-all flex items-center gap-3"
              style={{ background: selectedId === o.id ? 'rgba(99,102,241,0.15)' : '#1c1c27', border: `1px solid ${selectedId === o.id ? 'rgba(99,102,241,0.5)' : '#2e2e40'}` }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ background: o.color }}>
                {o.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-white">{o.name}</p>
                <p style={{ fontSize: '11px', color: '#71717a' }}>{ROLE_LABELS[o.role]}{!o.active ? ' · Inattivo' : ''}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── RIGHT: detail ── */}
      <div className="flex-1 overflow-y-auto">
        {!selected ? (
          <div className="hidden md:flex items-center justify-center h-full" style={{ color: '#3f3f5a' }}>Seleziona un operatore dalla lista</div>
        ) : (
          <div className="space-y-4">
            <button className="md:hidden flex items-center gap-1 text-sm mb-1" style={{ color: '#818cf8', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} onClick={() => setSelectedId(null)}>
              ← Torna alla lista
            </button>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold" style={{ background: selected.color }}>
                  {selected.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">{selected.name}</h2>
                  <p style={{ fontSize: '13px', color: '#71717a' }}>{ROLE_LABELS[selected.role]} · {selected.email || 'nessuna email'}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEdit(selected)} style={btnPrimary}>Modifica</button>
                <button onClick={() => { deleteOperator(selected.id); setSelectedId(null); }}
                  style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', borderRadius: '10px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer' }}>
                  Elimina
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#12121a', border: '1px solid #2e2e40', width: 'fit-content' }}>
              {(['info', 'schedule', 'absences', 'stats'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{ background: activeTab === tab ? 'rgba(99,102,241,0.2)' : 'transparent', color: activeTab === tab ? '#818cf8' : '#71717a', cursor: 'pointer', border: 'none' }}>
                  {tab === 'info' ? 'Info' : tab === 'schedule' ? 'Orari' : tab === 'absences' ? 'Assenze' : 'Statistiche'}
                </button>
              ))}
            </div>

            {/* Tab: Info */}
            {activeTab === 'info' && (
              <div className="grid grid-cols-2 gap-4">
                <div style={card}>
                  <h3 className="text-sm font-semibold text-white mb-3">Dati generali</h3>
                  <div className="space-y-2 text-sm">
                    <p><span style={{ color: '#71717a' }}>Ruolo:</span> <span style={{ color: '#d4d4d8' }}>{ROLE_LABELS[selected.role]}</span></p>
                    <p><span style={{ color: '#71717a' }}>Email:</span> <span style={{ color: '#d4d4d8' }}>{selected.email || '—'}</span></p>
                    <p><span style={{ color: '#71717a' }}>Provvigione:</span> <span style={{ color: '#f59e0b' }}>{selected.commissionRate}%</span></p>
                    <p><span style={{ color: '#71717a' }}>Stato:</span> <span style={{ color: selected.active ? '#22c55e' : '#f87171' }}>{selected.active ? 'Attivo' : 'Inattivo'}</span></p>
                  </div>
                </div>
                <div style={card}>
                  <h3 className="text-sm font-semibold text-white mb-3">Servizi abilitati</h3>
                  {selected.serviceIds.length === 0 ? (
                    <p style={{ fontSize: '13px', color: '#71717a' }}>Tutti i servizi</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {selected.serviceIds.map(id => {
                        const s = services.find(x => x.id === id);
                        return s ? <span key={id} className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' }}>{s.name}</span> : null;
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab: Schedule */}
            {activeTab === 'schedule' && (
              <div style={card}>
                <h3 className="text-sm font-semibold text-white mb-3">Orari di lavoro</h3>
                <div className="space-y-2">
                  {selected.schedule.map((shift, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <span style={{ width: 32, color: '#71717a', fontSize: '12px' }}>{DAY_NAMES[shift.dayOfWeek]}</span>
                      <span style={{ color: shift.isWorking ? '#22c55e' : '#3f3f5a', fontSize: '12px' }}>
                        {shift.isWorking ? `${shift.startTime} – ${shift.endTime}` : 'Chiuso'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab: Absences */}
            {activeTab === 'absences' && (
              <div className="space-y-3">
                <button onClick={() => { setShowAbsForm(true); setAbsForm({ ...EMPTY_ABSENCE, operatorId: selected.id }); }} style={btnPrimary}>
                  <Plus size={14} /> Aggiungi assenza
                </button>
                {absences.filter(a => a.operatorId === selected.id).length === 0 && (
                  <p style={{ color: '#3f3f5a', fontSize: '13px' }}>Nessuna assenza registrata.</p>
                )}
                {absences.filter(a => a.operatorId === selected.id).sort((a, b) => b.startDate.localeCompare(a.startDate)).map(a => (
                  <div key={a.id} className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: '#1c1c27', border: '1px solid #2e2e40' }}>
                    <div>
                      <p className="text-sm text-white">{format(parseISO(a.startDate), 'dd/MM/yyyy')} → {format(parseISO(a.endDate), 'dd/MM/yyyy')}</p>
                      <p style={{ fontSize: '12px', color: '#71717a' }}>{a.reason || '—'}</p>
                    </div>
                    <button onClick={() => deleteAbsence(a.id)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            )}

            {/* Tab: Stats */}
            {activeTab === 'stats' && (
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Appuntamenti totali', value: opStats[selected.id]?.count ?? 0 },
                  { label: 'No-show', value: opStats[selected.id]?.noshow ?? 0, color: '#ef4444' },
                  { label: 'Tasso presenza', value: opStats[selected.id]?.count ? `${(((opStats[selected.id].count - opStats[selected.id].noshow) / opStats[selected.id].count) * 100).toFixed(0)}%` : '—', color: '#22c55e' },
                ].map(k => (
                  <div key={k.label} style={card} className="text-center">
                    <p className="text-2xl font-bold" style={{ color: k.color || 'white' }}>{k.value}</p>
                    <p className="text-xs mt-1" style={{ color: '#71717a' }}>{k.label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modal: Operator Form ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6" style={{ background: '#18181f', border: '1px solid #2e2e40' }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-white">{editOp ? 'Modifica Operatore' : 'Nuovo Operatore'}</h3>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label style={labelStyle}>Nome *</label><input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={inputStyle} /></div>
              <div><label style={labelStyle}>Email</label><input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} style={inputStyle} /></div>
              <div>
                <label style={labelStyle}>PIN accesso (4 cifre)</label>
                <input type="password" maxLength={8} value={form.pin || ''} onChange={e => setForm(p => ({ ...p, pin: e.target.value.replace(/\D/g, '') }))} placeholder="Lascia vuoto per nessun PIN" style={inputStyle} />
                <p style={{ fontSize: '11px', color: '#3f3f5a', marginTop: 4 }}>L'operatore usa questo PIN per accedere al gestionale dalla sidebar.</p>
              </div>
              <div>
                <label style={labelStyle}>Ruolo</label>
                <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value as OperatorRole }))} style={inputStyle}>
                  {(Object.keys(ROLE_LABELS) as OperatorRole[]).map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>
              <div><label style={labelStyle}>Provvigione (%)</label><input type="number" min={0} max={100} value={form.commissionRate} onChange={e => setForm(p => ({ ...p, commissionRate: Number(e.target.value) }))} style={inputStyle} /></div>
              <div>
                <label style={labelStyle}>Colore calendario</label>
                <div className="flex gap-2 flex-wrap mt-1">
                  {OPERATOR_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setForm(p => ({ ...p, color: c }))}
                      className="w-6 h-6 rounded-full transition-all"
                      style={{ background: c, border: `2px solid ${form.color === c ? 'white' : 'transparent'}`, cursor: 'pointer' }} />
                  ))}
                </div>
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <input type="checkbox" id="opActive" checked={form.active} onChange={e => setForm(p => ({ ...p, active: e.target.checked }))} />
                <label htmlFor="opActive" style={{ fontSize: '13px', color: '#d4d4d8' }}>Operatore attivo</label>
              </div>

              {/* Schedule editor */}
              <div className="col-span-2 pt-2" style={{ borderTop: '1px solid #2e2e40' }}>
                <label style={{ ...labelStyle, marginBottom: '10px', fontSize: '13px', color: '#d4d4d8' }}>Orari di lavoro</label>
                <div className="space-y-2">
                  {form.schedule.map((shift, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span style={{ width: '90px', fontSize: '12px', color: '#d4d4d8' }}>{DAY_NAMES_FULL[shift.dayOfWeek]}</span>
                      <input type="checkbox" checked={shift.isWorking} onChange={e => updateShift(i, 'isWorking', e.target.checked)} />
                      {shift.isWorking && (
                        <>
                          <input type="time" value={shift.startTime} onChange={e => updateShift(i, 'startTime', e.target.value)} style={{ ...inputStyle, width: '100px' }} />
                          <span style={{ color: '#71717a', fontSize: '12px' }}>–</span>
                          <input type="time" value={shift.endTime} onChange={e => updateShift(i, 'endTime', e.target.value)} style={{ ...inputStyle, width: '100px' }} />
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Services abilitati */}
              <div className="col-span-2 pt-2" style={{ borderTop: '1px solid #2e2e40' }}>
                <label style={{ ...labelStyle, marginBottom: '8px', fontSize: '13px', color: '#d4d4d8' }}>Servizi abilitati (vuoto = tutti)</label>
                <div className="flex flex-wrap gap-2">
                  {services.filter(s => s.active).map(s => (
                    <button key={s.id} type="button" onClick={() => toggleService(s.id)}
                      className="text-xs px-2.5 py-1 rounded-lg transition-all"
                      style={{ background: form.serviceIds.includes(s.id) ? 'rgba(99,102,241,0.25)' : '#12121a', border: `1px solid ${form.serviceIds.includes(s.id) ? 'rgba(99,102,241,0.5)' : '#2e2e40'}`, color: form.serviceIds.includes(s.id) ? '#818cf8' : '#71717a', cursor: 'pointer' }}>
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Permessi accesso — solo per ruoli non-titolare */}
              {form.role !== 'owner' && (
                <div className="col-span-2 pt-2" style={{ borderTop: '1px solid #2e2e40' }}>
                  <label style={{ ...labelStyle, marginBottom: '8px', fontSize: '13px', color: '#d4d4d8' }}>Accesso alle sezioni</label>
                  <p style={{ fontSize: '11px', color: '#3f3f5a', marginBottom: 10 }}>Deseleziona le sezioni a cui questo operatore non deve avere accesso.</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(PERMISSION_LABELS) as (keyof OperatorPermissions)[]).map(key => {
                      const perms = form.permissions ?? { ...DEFAULT_OPERATOR_PERMISSIONS };
                      const checked = perms[key] ?? true;
                      return (
                        <label key={key} className="flex items-center gap-2 text-sm cursor-pointer py-1.5 px-2 rounded-lg"
                          style={{ background: checked ? 'rgba(99,102,241,0.08)' : '#12121a', border: `1px solid ${checked ? 'rgba(99,102,241,0.25)' : '#2e2e40'}` }}>
                          <input type="checkbox" checked={checked}
                            onChange={e => setForm(p => ({ ...p, permissions: { ...(p.permissions ?? DEFAULT_OPERATOR_PERMISSIONS), [key]: e.target.checked } }))} />
                          <span style={{ color: checked ? '#d4d4d8' : '#71717a' }}>{PERMISSION_LABELS[key]}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowForm(false)} style={{ background: '#12121a', border: '1px solid #2e2e40', color: '#71717a', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', cursor: 'pointer' }}>Annulla</button>
              <button onClick={handleSave} style={btnPrimary}>Salva</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Absence Form ── */}
      {showAbsForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: '#18181f', border: '1px solid #2e2e40' }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-white">Aggiungi Assenza</h3>
              <button onClick={() => setShowAbsForm(false)} style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div><label style={labelStyle}>Data inizio</label><input type="date" value={absForm.startDate} onChange={e => setAbsForm(p => ({ ...p, startDate: e.target.value }))} style={inputStyle} /></div>
              <div><label style={labelStyle}>Data fine</label><input type="date" value={absForm.endDate} onChange={e => setAbsForm(p => ({ ...p, endDate: e.target.value }))} style={inputStyle} /></div>
              <div><label style={labelStyle}>Motivo</label><input value={absForm.reason} onChange={e => setAbsForm(p => ({ ...p, reason: e.target.value }))} placeholder="Ferie, malattia…" style={inputStyle} /></div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowAbsForm(false)} style={{ background: '#12121a', border: '1px solid #2e2e40', color: '#71717a', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', cursor: 'pointer' }}>Annulla</button>
              <button onClick={handleAddAbsence} style={btnPrimary}>Salva</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
