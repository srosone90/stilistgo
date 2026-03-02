'use client';

import React, { useState, useMemo } from 'react';
import { useSalon } from '@/context/SalonContext';
import { Appointment, AppointmentStatus, STATUS_COLORS, STATUS_LABELS } from '@/types/salon';
import { format, parseISO, addDays, startOfWeek, isSameDay } from 'date-fns';
import { it } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, X, Clock, User, Scissors } from 'lucide-react';

const inputStyle: React.CSSProperties = { background: '#12121a', border: '1px solid #2e2e40', borderRadius: '10px', padding: '9px 13px', color: '#f4f4f5', fontSize: '13px', outline: 'none', width: '100%' };
const labelStyle: React.CSSProperties = { fontSize: '12px', color: '#71717a', marginBottom: '4px', display: 'block' };
const btnPrimary: React.CSSProperties = { background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', color: '#818cf8', borderRadius: '10px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' };

const EMPTY_APPT: Omit<Appointment, 'id' | 'createdAt' | 'history'> = {
  clientId: '', operatorId: '', serviceIds: [],
  date: format(new Date(), 'yyyy-MM-dd'), startTime: '09:00', endTime: '10:00',
  status: 'scheduled', notes: '', isBlock: false, blockReason: '',
  recurringGroupId: '', feedbackScore: 0,
};

function timeToMinutes(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(m: number) {
  const h = Math.floor(m / 60).toString().padStart(2, '0');
  const mm = (m % 60).toString().padStart(2, '0');
  return `${h}:${mm}`;
}

export default function CalendarView() {
  const { appointments, operators, services, clients, salonConfig,
    addAppointment, updateAppointment, changeAppointmentStatus, deleteAppointment } = useSalon();

  const [view, setView] = useState<'day' | 'week'>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [editAppt, setEditAppt] = useState<Appointment | null>(null);
  const [form, setForm] = useState<Omit<Appointment, 'id' | 'createdAt' | 'history'>>(EMPTY_APPT);
  const [filterOperator, setFilterOperator] = useState('');

  const openHour = parseInt(salonConfig.openTime.split(':')[0], 10);
  const closeHour = parseInt(salonConfig.closeTime.split(':')[0], 10);
  const hours = Array.from({ length: closeHour - openHour }, (_, i) => openHour + i);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const days = view === 'week'
    ? Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
    : [currentDate];

  const activeOperators = useMemo(() =>
    operators.filter(o => o.active && (!filterOperator || o.id === filterOperator)),
    [operators, filterOperator]);

  const filteredAppts = useMemo(() =>
    appointments.filter(a => {
      const inRange = days.some(d => isSameDay(parseISO(a.date), d));
      const opOk = !filterOperator || a.operatorId === filterOperator;
      return inRange && opOk;
    }),
    [appointments, days, filterOperator]);

  function navigate(dir: number) {
    setCurrentDate(prev => addDays(prev, view === 'week' ? dir * 7 : dir));
  }

  function openNew(date?: string, operatorId?: string, startTime?: string) {
    const d = date || format(currentDate, 'yyyy-MM-dd');
    const svcDuration = 60;
    const start = startTime || '09:00';
    const end = minutesToTime(timeToMinutes(start) + svcDuration);
    setEditAppt(null);
    setForm({ ...EMPTY_APPT, date: d, operatorId: operatorId || '', startTime: start, endTime: end });
    setShowForm(true);
  }

  function openEdit(a: Appointment) {
    setEditAppt(a);
    setForm({ clientId: a.clientId, operatorId: a.operatorId, serviceIds: [...a.serviceIds], date: a.date, startTime: a.startTime, endTime: a.endTime, status: a.status, notes: a.notes, isBlock: a.isBlock, blockReason: a.blockReason, recurringGroupId: a.recurringGroupId, feedbackScore: a.feedbackScore });
    setShowForm(true);
  }

  function handleSave() {
    if (editAppt) {
      updateAppointment({ ...editAppt, ...form }, 'Appuntamento modificato');
    } else {
      addAppointment(form);
    }
    setShowForm(false);
  }

  function handleServiceToggle(id: string) {
    setForm(p => {
      const ids = p.serviceIds.includes(id) ? p.serviceIds.filter(s => s !== id) : [...p.serviceIds, id];
      // Auto-calculate end time from total duration
      const totalMin = ids.reduce((sum, sid) => {
        const svc = services.find(s => s.id === sid);
        return sum + (svc?.duration || 0);
      }, 0);
      const end = totalMin > 0 ? minutesToTime(timeToMinutes(p.startTime) + totalMin) : p.endTime;
      return { ...p, serviceIds: ids, endTime: end };
    });
  }

  // Slot height constants
  const HOUR_PX = 64;
  const START_MIN = openHour * 60;

  function apptStyle(a: Appointment, opIndex: number, colWidth: number) {
    const startMin = timeToMinutes(a.startTime) - START_MIN;
    const endMin = timeToMinutes(a.endTime) - START_MIN;
    const top = (startMin / 60) * HOUR_PX;
    const height = Math.max(((endMin - startMin) / 60) * HOUR_PX, 24);
    return { top, height, color: operators.find(o => o.id === a.operatorId)?.color || '#6366f1' };
  }

  return (
    <div className="flex flex-col gap-4 h-full" style={{ minHeight: 0 }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Agenda</h1>
          <p className="text-xs mt-0.5" style={{ color: '#71717a' }}>
            {view === 'week'
              ? `Settimana del ${format(weekStart, 'dd MMM', { locale: it })} – ${format(addDays(weekStart, 6), 'dd MMM yyyy', { locale: it })}`
              : format(currentDate, 'EEEE dd MMMM yyyy', { locale: it })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #2e2e40' }}>
            {(['day', 'week'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className="px-3 py-1.5 text-xs font-medium"
                style={{ background: view === v ? 'rgba(99,102,241,0.2)' : '#12121a', color: view === v ? '#818cf8' : '#71717a', border: 'none', cursor: 'pointer' }}>
                {v === 'day' ? 'Giornaliero' : 'Settimanale'}
              </button>
            ))}
          </div>
          <select value={filterOperator} onChange={e => setFilterOperator(e.target.value)}
            style={{ ...inputStyle, width: 'auto', padding: '6px 10px' }}>
            <option value="">Tutti gli operatori</option>
            {operators.filter(o => o.active).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <button onClick={() => navigate(-1)} style={{ ...btnPrimary, padding: '7px 10px' }}><ChevronLeft size={16} /></button>
          <button onClick={() => setCurrentDate(new Date())} style={{ ...btnPrimary, fontSize: '12px' }}>Oggi</button>
          <button onClick={() => navigate(1)} style={{ ...btnPrimary, padding: '7px 10px' }}><ChevronRight size={16} /></button>
          <button onClick={() => openNew()} style={btnPrimary}><Plus size={14} /> Nuovo</button>
        </div>
      </div>

      {/* Legend */}
      {activeOperators.length > 1 && (
        <div className="flex gap-3 flex-wrap">
          {activeOperators.map(o => (
            <span key={o.id} className="flex items-center gap-1.5 text-xs" style={{ color: '#d4d4d8' }}>
              <span className="inline-block w-3 h-3 rounded-full" style={{ background: o.color }} />
              {o.name}
            </span>
          ))}
        </div>
      )}

      {/* Calendar Grid */}
      <div className="flex-1 overflow-auto rounded-2xl" style={{ border: '1px solid #2e2e40', background: '#1c1c27' }}>
        {/* Header */}
        <div className="flex sticky top-0 z-10" style={{ background: '#18181f', borderBottom: '1px solid #2e2e40' }}>
          <div style={{ width: 56, flexShrink: 0 }} />
          {days.map((day, di) => (
            <div key={di} className="flex-1 text-center py-2 text-xs font-medium"
              style={{ color: isSameDay(day, new Date()) ? '#818cf8' : '#71717a', borderLeft: '1px solid #2e2e40' }}>
              <span className="block">{format(day, 'EEE', { locale: it })}</span>
              <span className="block text-base font-bold" style={{ color: isSameDay(day, new Date()) ? '#818cf8' : '#d4d4d8' }}>
                {format(day, 'dd')}
              </span>
            </div>
          ))}
        </div>

        {/* Time grid */}
        <div className="flex" style={{ minHeight: hours.length * HOUR_PX }}>
          {/* Hours column */}
          <div style={{ width: 56, flexShrink: 0 }}>
            {hours.map(h => (
              <div key={h} style={{ height: HOUR_PX, borderBottom: '1px solid #2e2e40', display: 'flex', alignItems: 'flex-start', paddingTop: 4, paddingLeft: 8 }}>
                <span style={{ fontSize: 11, color: '#3f3f5a' }}>{String(h).padStart(2, '0')}:00</span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day, di) => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const dayAppts = filteredAppts.filter(a => a.date === dayStr);
            return (
              <div key={di} className="flex-1 relative" style={{ borderLeft: '1px solid #2e2e40' }}>
                {/* Hour lines */}
                {hours.map(h => (
                  <div key={h} style={{ height: HOUR_PX, borderBottom: '1px solid #1e1e2e' }}
                    onClick={() => openNew(dayStr, filterOperator || operators[0]?.id, `${String(h).padStart(2, '0')}:00`)}
                    className="cursor-pointer hover:bg-white/[0.02] transition-colors" />
                ))}
                {/* Appointments */}
                {dayAppts.map(a => {
                  const startMin = timeToMinutes(a.startTime) - START_MIN;
                  const endMin = timeToMinutes(a.endTime) - START_MIN;
                  const top = (startMin / 60) * HOUR_PX;
                  const height = Math.max(((endMin - startMin) / 60) * HOUR_PX, 28);
                  const op = operators.find(o => o.id === a.operatorId);
                  const color = op?.color || '#6366f1';
                  const client = clients.find(c => c.id === a.clientId);
                  return (
                    <div key={a.id} onClick={e => { e.stopPropagation(); openEdit(a); }}
                      className="absolute left-1 right-1 rounded-lg px-2 py-1 cursor-pointer hover:brightness-110 transition-all overflow-hidden"
                      style={{ top, height, background: `${color}25`, border: `1px solid ${color}60`, zIndex: 2 }}>
                      <p className="text-xs font-semibold truncate" style={{ color }}>{a.isBlock ? '🔒 ' + a.blockReason : (client ? `${client.firstName} ${client.lastName}` : '—')}</p>
                      <p className="text-xs truncate" style={{ color: '#a1a1aa' }}>{a.startTime}–{a.endTime}</p>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Modal: Appointment Form ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-6" style={{ background: '#18181f', border: '1px solid #2e2e40' }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-white">{editAppt ? 'Modifica Appuntamento' : 'Nuovo Appuntamento'}</h3>
              <div className="flex gap-2 items-center">
                {editAppt && (
                  <select value={editAppt.status} onChange={e => { changeAppointmentStatus(editAppt.id, e.target.value as AppointmentStatus); setEditAppt(prev => prev ? { ...prev, status: e.target.value as AppointmentStatus } : null); }}
                    style={{ ...inputStyle, width: 'auto', padding: '4px 8px', fontSize: '12px' }}>
                    {(Object.keys(STATUS_LABELS) as AppointmentStatus[]).map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                )}
                <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer' }}><X size={18} /></button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isBlock" checked={form.isBlock} onChange={e => setForm(p => ({ ...p, isBlock: e.target.checked }))} />
                <label htmlFor="isBlock" style={{ fontSize: '13px', color: '#d4d4d8' }}>Blocca orario (pausa / riunione)</label>
              </div>

              {form.isBlock ? (
                <div><label style={labelStyle}>Motivo blocco</label><input value={form.blockReason} onChange={e => setForm(p => ({ ...p, blockReason: e.target.value }))} style={inputStyle} /></div>
              ) : (
                <div>
                  <label style={labelStyle}>Cliente</label>
                  <select value={form.clientId} onChange={e => setForm(p => ({ ...p, clientId: e.target.value }))} style={inputStyle}>
                    <option value="">— Seleziona cliente —</option>
                    {clients.sort((a, b) => `${a.firstName}${a.lastName}`.localeCompare(`${b.firstName}${b.lastName}`)).map(c => (
                      <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div><label style={labelStyle}>Data</label><input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} style={inputStyle} /></div>
                <div>
                  <label style={labelStyle}>Operatore</label>
                  <select value={form.operatorId} onChange={e => setForm(p => ({ ...p, operatorId: e.target.value }))} style={inputStyle}>
                    <option value="">—</option>
                    {operators.filter(o => o.active).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
                <div><label style={labelStyle}>Ora inizio</label><input type="time" value={form.startTime} onChange={e => setForm(p => ({ ...p, startTime: e.target.value }))} style={inputStyle} /></div>
                <div><label style={labelStyle}>Ora fine</label><input type="time" value={form.endTime} onChange={e => setForm(p => ({ ...p, endTime: e.target.value }))} style={inputStyle} /></div>
              </div>

              {!form.isBlock && (
                <div>
                  <label style={labelStyle}>Servizi</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {services.filter(s => s.active).map(s => (
                      <button key={s.id} type="button" onClick={() => handleServiceToggle(s.id)}
                        className="text-xs px-2.5 py-1 rounded-lg transition-all"
                        style={{ background: form.serviceIds.includes(s.id) ? 'rgba(99,102,241,0.25)' : '#12121a', border: `1px solid ${form.serviceIds.includes(s.id) ? 'rgba(99,102,241,0.5)' : '#2e2e40'}`, color: form.serviceIds.includes(s.id) ? '#818cf8' : '#71717a', cursor: 'pointer' }}>
                        {s.name} ({s.duration}')
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div><label style={labelStyle}>Note sull'appuntamento</label><textarea rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} /></div>
            </div>

            <div className="flex justify-between mt-4">
              <div>
                {editAppt && (
                  <button onClick={() => { deleteAppointment(editAppt.id); setShowForm(false); }}
                    style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', cursor: 'pointer' }}>
                    Elimina
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowForm(false)} style={{ background: '#12121a', border: '1px solid #2e2e40', color: '#71717a', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', cursor: 'pointer' }}>Annulla</button>
                <button onClick={handleSave} style={btnPrimary}>Salva</button>
              </div>
            </div>

            {/* History log */}
            {editAppt?.history && editAppt.history.length > 0 && (
              <div className="mt-4 pt-4" style={{ borderTop: '1px solid #2e2e40' }}>
                <p className="text-xs font-semibold mb-2" style={{ color: '#71717a' }}>Storico modifiche</p>
                <div className="space-y-1">
                  {[...editAppt.history].reverse().map((h, i) => (
                    <p key={i} className="text-xs" style={{ color: '#3f3f5a' }}>
                      {format(parseISO(h.timestamp), 'dd/MM/yyyy HH:mm')} — {h.action}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
