'use client';

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useSalon } from '@/context/SalonContext';
import { Appointment, AppointmentStatus, STATUS_LABELS } from '@/types/salon';
import { format, parseISO, addDays, startOfWeek, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, addMonths } from 'date-fns';
import { it } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, X, UserPlus, LayoutGrid } from 'lucide-react';

const inputStyle: React.CSSProperties = { background: '#12121a', border: '1px solid #2e2e40', borderRadius: '10px', padding: '9px 13px', color: '#f4f4f5', fontSize: '13px', outline: 'none', width: '100%' };
const labelStyle: React.CSSProperties = { fontSize: '12px', color: '#71717a', marginBottom: '4px', display: 'block' };
const btnPrimary: React.CSSProperties = { background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', color: '#818cf8', borderRadius: '10px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' };

const EMPTY_APPT: Omit<Appointment, 'id' | 'createdAt' | 'history'> = {
  clientId: '', operatorId: '', serviceIds: [],
  date: format(new Date(), 'yyyy-MM-dd'), startTime: '09:00', endTime: '10:00',
  status: 'scheduled', notes: '', isBlock: false, blockReason: '',
  recurringGroupId: '', feedbackScore: 0,
};
const EMPTY_QUICK_CLIENT = { firstName: '', lastName: '', phone: '' };

function timeToMinutes(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function minutesToTime(m: number) {
  const clamped = Math.max(0, Math.min(m, 23 * 60 + 55));
  const h = Math.floor(clamped / 60).toString().padStart(2, '0');
  const mm = (clamped % 60).toString().padStart(2, '0');
  return `${h}:${mm}`;
}
const HOUR_PX = 64;

export default function CalendarView({ newTrigger, onGoToCash }: { newTrigger?: number; onGoToCash?: (clientId: string, appointmentId: string) => void }) {
  const {
    appointments, operators, services, clients, salonConfig,
    addAppointment, updateAppointment, changeAppointmentStatus, deleteAppointment,
    addClient,
  } = useSalon();

  const [view, setView] = useState<'day' | 'week' | 'month'>('day');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [editAppt, setEditAppt] = useState<Appointment | null>(null);
  const [form, setForm] = useState<Omit<Appointment, 'id' | 'createdAt' | 'history'>>(EMPTY_APPT);
  const [filterOperator, setFilterOperator] = useState('');
  const [showQuickClient, setShowQuickClient] = useState(false);
  const [quickClient, setQuickClient] = useState(EMPTY_QUICK_CLIENT);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (newTrigger && newTrigger > 0) {
      setEditAppt(null);
      setForm({ ...EMPTY_APPT, date: format(new Date(), 'yyyy-MM-dd'), operatorId: operators[0]?.id || '' });
      setShowForm(true);
    }
  }, [newTrigger, operators]);

  // Resize
  const resizeRef = useRef<{ apptId: string; origStartMin: number; origEndMin: number; startY: number } | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [resizingEndTime, setResizingEndTimeState] = useState('');

  // Drag & drop
  const gridRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ apptId: string; origDate: string; origStartMin: number; durationMin: number; startY: number; startX: number; dayIndex: number } | null>(null);
  const wasDraggedRef = useRef(false);
  const daysRef = useRef<Date[]>([]); // inizializzato vuoto, aggiornato via useEffect
  const activeOpColsRef = useRef<{ id: string }[]>([]); // operator columns for day view
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggingPos, setDraggingPos] = useState<{ date: string; startTime: string; endTime: string; operatorId?: string } | null>(null);

  const openHour = parseInt(salonConfig.openTime.split(':')[0], 10);
  const closeHour = parseInt(salonConfig.closeTime.split(':')[0], 10);
  const hours = Array.from({ length: closeHour - openHour }, (_, i) => openHour + i);
  const START_MIN = openHour * 60;

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const days = view === 'week' ? Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)) : [currentDate];

  // Mantieni daysRef aggiornato per gli event handler del documento
  useEffect(() => { daysRef.current = days; }, [days]);

  const activeOperators = useMemo(() =>
    operators.filter(o => o.active && (!filterOperator || o.id === filterOperator)),
    [operators, filterOperator]);

  // Mantieni activeOpColsRef aggiornato per drag handler in day view
  useEffect(() => { activeOpColsRef.current = activeOperators; }, [activeOperators]);

  const filteredAppts = useMemo(() =>
    appointments.filter(a => {
      const inRange = days.some(d => isSameDay(parseISO(a.date), d));
      const opOk = !filterOperator || a.operatorId === filterOperator;
      return inRange && opOk && a.status !== 'completed';
    }), [appointments, days, filterOperator]);

  function navigate(dir: number) {
    if (view === 'month') {
      setCurrentDate(prev => addMonths(prev, dir));
    } else {
      setCurrentDate(prev => addDays(prev, view === 'week' ? dir * 7 : dir));
    }
  }

  // If clicking under an appointment, start after it
  function resolveStartTime(dayStr: string, operatorId: string, clickedHour: number): string {
    const clickedMin = clickedHour * 60;
    const dayAppts = appointments.filter(a => a.date === dayStr && a.operatorId === operatorId);
    let lastEnd = clickedMin;
    for (const a of dayAppts) {
      const sMin = timeToMinutes(a.startTime);
      const eMin = timeToMinutes(a.endTime);
      if (sMin <= clickedMin && eMin > lastEnd) lastEnd = eMin;
    }
    return minutesToTime(lastEnd);
  }

  function openNew(date?: string, operatorId?: string, startTime?: string) {
    const d = date || format(currentDate, 'yyyy-MM-dd');
    const op = operatorId || operators[0]?.id || '';
    const start = startTime || '09:00';
    const end = minutesToTime(timeToMinutes(start) + 60);
    setEditAppt(null);
    setForm({ ...EMPTY_APPT, date: d, operatorId: op, startTime: start, endTime: end });
    setShowForm(true);
  }

  function openEdit(a: Appointment) {
    setEditAppt(a);
    setForm({ clientId: a.clientId, operatorId: a.operatorId, serviceIds: [...a.serviceIds], date: a.date, startTime: a.startTime, endTime: a.endTime, status: a.status, notes: a.notes, isBlock: a.isBlock, blockReason: a.blockReason, recurringGroupId: a.recurringGroupId, feedbackScore: a.feedbackScore });
    setShowForm(true);
  }

  function handleSave() {
    if (editAppt) updateAppointment({ ...editAppt, ...form }, 'Appuntamento modificato');
    else addAppointment(form);
    setShowForm(false);
  }

  function handleServiceToggle(id: string) {
    setForm(p => {
      const ids = p.serviceIds.includes(id) ? p.serviceIds.filter(s => s !== id) : [...p.serviceIds, id];
      const totalMin = ids.reduce((sum, sid) => {
        const svc = services.find(s => s.id === sid);
        return sum + (svc?.duration || 0);
      }, 0);
      const end = totalMin > 0 ? minutesToTime(timeToMinutes(p.startTime) + totalMin) : p.endTime;
      return { ...p, serviceIds: ids, endTime: end };
    });
  }

  function handleQuickClientSave() {
    if (!quickClient.firstName.trim()) return;
    const newId = addClient({
      firstName: quickClient.firstName, lastName: quickClient.lastName,
      phone: quickClient.phone, email: '', birthDate: '', notes: '',
      allergies: '', tags: [], gdprConsent: false, gdprDate: '', loyaltyPoints: 0,
    });
    setForm(p => ({ ...p, clientId: newId }));
    setShowQuickClient(false);
    setQuickClient(EMPTY_QUICK_CLIENT);
  }

  // Resize drag
  const handleResizeStart = useCallback((e: React.MouseEvent, appt: Appointment) => {
    e.stopPropagation();
    e.preventDefault();
    resizeRef.current = { apptId: appt.id, origStartMin: timeToMinutes(appt.startTime), origEndMin: timeToMinutes(appt.endTime), startY: e.clientY };
    setResizingId(appt.id);
    setResizingEndTimeState(appt.endTime);
  }, []);

  // Drag appuntamento
  const handleDragStart = useCallback((e: React.MouseEvent, appt: Appointment) => {
    if (e.button !== 0 || resizeRef.current) return;
    e.stopPropagation();
    e.preventDefault();
    const dIdx = daysRef.current.findIndex(d => format(d, 'yyyy-MM-dd') === appt.date);
    dragRef.current = {
      apptId: appt.id,
      origDate: appt.date,
      origStartMin: timeToMinutes(appt.startTime),
      durationMin: timeToMinutes(appt.endTime) - timeToMinutes(appt.startTime),
      startY: e.clientY,
      startX: e.clientX,
      dayIndex: dIdx >= 0 ? dIdx : 0,
    };
    wasDraggedRef.current = false;
    setDraggingId(appt.id);
    setDraggingPos({ date: appt.date, startTime: appt.startTime, endTime: appt.endTime });
  }, []);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      // RESIZE
      if (resizeRef.current) {
        const delta = e.clientY - resizeRef.current.startY;
        const deltaMin = Math.round((delta / HOUR_PX) * 60 / 15) * 15;
        const newEnd = Math.max(resizeRef.current.origStartMin + 15, resizeRef.current.origEndMin + deltaMin);
        setResizingEndTimeState(minutesToTime(newEnd));
        return;
      }
      // DRAG
      if (dragRef.current) {
        const totalDelta = Math.abs(e.clientX - dragRef.current.startX) + Math.abs(e.clientY - dragRef.current.startY);
        if (totalDelta > 5) wasDraggedRef.current = true;
        const deltaY = e.clientY - dragRef.current.startY;
        const deltaMin = Math.round(deltaY / HOUR_PX * 60 / 15) * 15;
        const newStartMin = Math.max(openHour * 60, dragRef.current.origStartMin + deltaMin);
        const newEndMin = newStartMin + dragRef.current.durationMin;
        let newDayIdx = dragRef.current.dayIndex;
        let newOperatorId: string | undefined;
        if (gridRef.current) {
          const rect = gridRef.current.getBoundingClientRect();
          const relX = e.clientX - rect.left - 56;
          // Day view: X maps to operator column; week view: X maps to day column
          if (daysRef.current.length === 1 && activeOpColsRef.current.length > 0) {
            const colW = (rect.width - 56) / activeOpColsRef.current.length;
            const opIdx = Math.max(0, Math.min(activeOpColsRef.current.length - 1, Math.floor(relX / colW)));
            newOperatorId = activeOpColsRef.current[opIdx].id;
          } else {
            const colW = (rect.width - 56) / daysRef.current.length;
            newDayIdx = Math.max(0, Math.min(daysRef.current.length - 1, Math.floor(relX / colW)));
          }
        }
        const newDate = format(daysRef.current[Math.max(0, Math.min(daysRef.current.length - 1, newDayIdx))], 'yyyy-MM-dd');
        setDraggingPos({ date: newDate, startTime: minutesToTime(newStartMin), endTime: minutesToTime(newEndMin), operatorId: newOperatorId });
      }
    }
    function onUp() {
      // RESIZE
      if (resizeRef.current) {
        const { apptId } = resizeRef.current;
        setResizingId(null);
        resizeRef.current = null;
        setResizingEndTimeState(prev => {
          const appt = appointments.find(a => a.id === apptId);
          if (appt && prev && prev !== appt.endTime) {
            updateAppointment({ ...appt, endTime: prev }, 'Durata modificata');
          }
          return '';
        });
        return;
      }
      // DRAG
      if (dragRef.current) {
        const { apptId } = dragRef.current;
        dragRef.current = null;
        setDraggingId(null);
        setDraggingPos(prev => {
          if (!wasDraggedRef.current || !prev) return null;
          const appt = appointments.find(a => a.id === apptId);
          if (appt) {
            const opChanged = prev.operatorId && prev.operatorId !== appt.operatorId;
            const timeChanged = prev.date !== appt.date || prev.startTime !== appt.startTime;
            if (timeChanged || opChanged) {
              updateAppointment({
                ...appt,
                date: prev.date,
                startTime: prev.startTime,
                endTime: prev.endTime,
                operatorId: prev.operatorId ?? appt.operatorId,
              }, 'Spostato');
            }
          }
          return null;
        });
      }
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
  }, [appointments, updateAppointment, openHour]);

  return (
    <div className="flex flex-col gap-4 h-full" style={{ minHeight: 0 }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Agenda</h1>
          <p className="text-xs mt-0.5" style={{ color: '#71717a' }}>
            {view === 'week'
              ? `Settimana del ${format(weekStart, 'dd MMM', { locale: it })} ${String.fromCharCode(8211)} ${format(addDays(weekStart, 6), 'dd MMM yyyy', { locale: it })}`
              : view === 'month'
              ? format(currentDate, 'MMMM yyyy', { locale: it })
              : format(currentDate, 'EEEE dd MMMM yyyy', { locale: it })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #2e2e40' }}>
            {(['day', 'week', 'month'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} className="px-3 py-1.5 text-xs font-medium"
                style={{ background: view === v ? 'rgba(99,102,241,0.2)' : '#12121a', color: view === v ? '#818cf8' : '#71717a', border: 'none', cursor: 'pointer' }}>
                {v === 'day' ? 'Giorno' : v === 'week' ? 'Settimana' : 'Mese'}
              </button>
            ))}
          </div>
          <select value={filterOperator} onChange={e => setFilterOperator(e.target.value)} style={{ ...inputStyle, width: 'auto', padding: '6px 10px' }}>
            <option value="">Tutti gli operatori</option>
            {operators.filter(o => o.active).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <button onClick={() => navigate(-1)} style={{ ...btnPrimary, padding: '7px 10px' }}><ChevronLeft size={16} /></button>
          <button onClick={() => setCurrentDate(new Date())} style={{ ...btnPrimary, fontSize: '12px' }}>Oggi</button>
          <button onClick={() => navigate(1)} style={{ ...btnPrimary, padding: '7px 10px' }}><ChevronRight size={16} /></button>
          <button onClick={() => openNew()} style={btnPrimary}><Plus size={14} /> Nuovo</button>
        </div>
      </div>

      {/* Operator legend — only shown in week/month views */}
      {view !== 'day' && activeOperators.length > 1 && (
        <div className="flex gap-3 flex-wrap">
          {activeOperators.map(o => (
            <span key={o.id} className="flex items-center gap-1.5 text-xs" style={{ color: '#d4d4d8' }}>
              <span className="inline-block w-3 h-3 rounded-full" style={{ background: o.color }} />
              {o.name}
            </span>
          ))}
        </div>
      )}

      {/* Month view */}
      {view === 'month' && (() => {
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
        const gridEnd = addDays(startOfWeek(monthEnd, { weekStartsOn: 1 }), 6);
        const gridDays = eachDayOfInterval({ start: gridStart, end: addDays(gridEnd, 7) }).slice(0, 42);
        const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
        return (
          <div className="flex-1 overflow-auto rounded-2xl" style={{ border: '1px solid #2e2e40', background: '#1c1c27', minHeight: 0 }}>
            {/* Day names header */}
            <div className="grid grid-cols-7 sticky top-0 z-10" style={{ background: '#18181f', borderBottom: '1px solid #2e2e40' }}>
              {DAY_NAMES.map(d => (
                <div key={d} className="text-center py-2 text-xs font-medium" style={{ color: '#71717a' }}>{d}</div>
              ))}
            </div>
            {/* Day cells */}
            <div className="grid grid-cols-7" style={{ flex: 1 }}>
              {gridDays.map((day, i) => {
                const dayStr = format(day, 'yyyy-MM-dd');
                const dayAppts = appointments.filter(a => a.date === dayStr && a.status !== 'cancelled' && (!filterOperator || a.operatorId === filterOperator));
                const isThisMonth = isSameMonth(day, currentDate);
                const isNow = isSameDay(day, new Date());
                return (
                  <div key={i}
                    onClick={() => { setCurrentDate(day); setView('day'); }}
                    className="min-h-[80px] p-2 cursor-pointer transition-colors"
                    style={{ border: '1px solid #1e1e2e', background: isNow ? 'rgba(99,102,241,0.08)' : 'transparent', opacity: isThisMonth ? 1 : 0.35 }}>
                    <span className="text-xs font-bold inline-flex items-center justify-center w-6 h-6 rounded-full"
                      style={{
                        background: isNow ? '#6366f1' : 'transparent',
                        color: isNow ? '#fff' : isThisMonth ? '#d4d4d8' : '#3f3f5a',
                      }}>
                      {format(day, 'd')}
                    </span>
                    {dayAppts.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {dayAppts.slice(0, 3).map(a => {
                          const op = operators.find(o => o.id === a.operatorId);
                          const client = clients.find(c => c.id === a.clientId);
                          return (
                            <div key={a.id} className="text-xs truncate rounded px-1 py-0.5"
                              style={{ background: `${op?.color || '#6366f1'}25`, color: op?.color || '#818cf8', fontSize: 10 }}>
                              {a.startTime} {client ? `${client.firstName}` : a.isBlock ? 'Blocco' : '—'}
                            </div>
                          );
                        })}
                        {dayAppts.length > 3 && (
                          <div className="text-xs px-1" style={{ color: '#71717a', fontSize: 10 }}>+{dayAppts.length - 3} altri</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ─── DAY VIEW: one column per operator ───────────────────────────── */}
      {view === 'day' && (
      <div className="flex-1 overflow-auto rounded-2xl" style={{ border: '1px solid #2e2e40', background: '#1c1c27' }}>
        {/* Sticky header: date on left, operator columns */}
        <div className="flex sticky top-0 z-10" style={{ background: '#18181f', borderBottom: '1px solid #2e2e40' }}>
          <div style={{ width: 56, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="text-xs font-bold" style={{ color: isSameDay(currentDate, new Date()) ? '#818cf8' : '#71717a' }}>
              {format(currentDate, 'dd')}
            </span>
          </div>
          {activeOperators.length === 0 ? (
            <div className="flex-1 text-center py-3 text-xs" style={{ color: '#71717a', borderLeft: '1px solid #2e2e40' }}>Nessun operatore attivo</div>
          ) : activeOperators.map(op => (
            <div key={op.id} className="flex-1 py-2 px-2" style={{ borderLeft: '1px solid #2e2e40', minWidth: 0 }}>
              <div className="flex items-center justify-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: op.color }} />
                <span className="text-xs font-semibold truncate" style={{ color: op.color }}>{op.name}</span>
              </div>
            </div>
          ))}
        </div>
        {/* Time grid */}
        <div ref={gridRef} className="flex" style={{ minHeight: hours.length * HOUR_PX }}>
          {/* Hour labels */}
          <div style={{ width: 56, flexShrink: 0 }}>
            {hours.map(h => (
              <div key={h} style={{ height: HOUR_PX, borderBottom: '1px solid #2e2e40', display: 'flex', alignItems: 'flex-start', paddingTop: 4, paddingLeft: 8 }}>
                <span style={{ fontSize: 11, color: '#3f3f5a' }}>{String(h).padStart(2, '0')}:00</span>
              </div>
            ))}
          </div>
          {/* Operator columns */}
          {activeOperators.map(op => {
            const dayStr = format(currentDate, 'yyyy-MM-dd');
            // Show appointment in this column based on its effective operatorId while dragging
            const colAppts = filteredAppts.filter(a => {
              const effectiveOp = draggingId === a.id && draggingPos?.operatorId ? draggingPos.operatorId : a.operatorId;
              return a.date === dayStr && effectiveOp === op.id;
            });
            return (
              <div key={op.id} className="flex-1 relative" style={{ borderLeft: '1px solid #2e2e40', minWidth: 0 }}>
                {hours.map(h => (
                  <div key={h} style={{ height: HOUR_PX, borderBottom: '1px solid #1e1e2e' }}
                    onClick={() => openNew(dayStr, op.id, resolveStartTime(dayStr, op.id, h))}
                    className="cursor-pointer hover:bg-white/[0.02] transition-colors" />
                ))}
                {colAppts.map(a => {
                  const isDragging = draggingId === a.id;
                  const effectiveStart = isDragging && draggingPos ? draggingPos.startTime : a.startTime;
                  const effectiveEndDrag = isDragging && draggingPos ? draggingPos.endTime : a.endTime;
                  const startMin = timeToMinutes(effectiveStart) - START_MIN;
                  const effectiveEnd = resizingId === a.id ? resizingEndTime : effectiveEndDrag;
                  const endMin = timeToMinutes(effectiveEnd) - START_MIN;
                  const top = (startMin / 60) * HOUR_PX;
                  const height = Math.max(((endMin - startMin) / 60) * HOUR_PX, 28);
                  const color = op.color || '#6366f1';
                  const client = clients.find(c => c.id === a.clientId);
                  const svcNames = a.serviceIds.map(sid => services.find(s => s.id === sid)?.name).filter(Boolean).join(', ');
                  return (
                    <div key={a.id}
                      onMouseDown={e => handleDragStart(e, a)}
                      onClick={e => { if (wasDraggedRef.current || draggingId || resizingId) { e.stopPropagation(); return; } e.stopPropagation(); openEdit(a); }}
                      className="absolute left-1 right-1 rounded-lg px-2 py-1 hover:brightness-110 transition-all overflow-hidden"
                      style={{ top, height, background: `${color}22`, border: `1px solid ${color}55`, zIndex: isDragging ? 10 : 2, opacity: isDragging ? 0.7 : 1, cursor: isDragging ? 'grabbing' : 'grab', userSelect: 'none' }}>
                      <p className="text-xs font-semibold truncate" style={{ color }}>
                        {a.isBlock ? '🔒 ' + (a.blockReason || 'Blocco') : (client ? `${client.firstName} ${client.lastName}` : '—')}
                      </p>
                      <p className="text-xs" style={{ color: '#a1a1aa', fontSize: 10 }}>{effectiveStart}–{effectiveEnd}</p>
                      {svcNames && <p className="truncate" style={{ color: '#71717a', fontSize: 10 }}>{svcNames}</p>}
                      <div onMouseDown={e => handleResizeStart(e, a)}
                        className="absolute bottom-0 left-0 right-0 flex items-center justify-center"
                        style={{ height: 10, cursor: 'ns-resize', background: `${color}30` }}>
                        <div style={{ width: 20, height: 2, borderRadius: 2, background: color, opacity: 0.8 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      )}

      {/* ─── WEEK VIEW: one column per day ───────────────────────────────── */}
      {view === 'week' && (
      <div className="flex-1 overflow-auto rounded-2xl" style={{ border: '1px solid #2e2e40', background: '#1c1c27' }}>
        <div className="flex sticky top-0 z-10" style={{ background: '#18181f', borderBottom: '1px solid #2e2e40' }}>
          <div style={{ width: 56, flexShrink: 0 }} />
          {days.map((day, di) => (
            <div key={di} className="flex-1 text-center py-2 text-xs font-medium"
              style={{ color: isSameDay(day, new Date()) ? '#818cf8' : '#71717a', borderLeft: '1px solid #2e2e40' }}>
              <span className="block">{format(day, 'EEE', { locale: it })}</span>
              <span className="block text-base font-bold" style={{ color: isSameDay(day, new Date()) ? '#818cf8' : '#d4d4d8' }}>{format(day, 'dd')}</span>
            </div>
          ))}
        </div>
        <div ref={gridRef} className="flex" style={{ minHeight: hours.length * HOUR_PX }}>
          <div style={{ width: 56, flexShrink: 0 }}>
            {hours.map(h => (
              <div key={h} style={{ height: HOUR_PX, borderBottom: '1px solid #2e2e40', display: 'flex', alignItems: 'flex-start', paddingTop: 4, paddingLeft: 8 }}>
                <span style={{ fontSize: 11, color: '#3f3f5a' }}>{String(h).padStart(2, '0')}:00</span>
              </div>
            ))}
          </div>
          {days.map((day, di) => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const dayAppts = filteredAppts.filter(a =>
              draggingId === a.id && draggingPos ? draggingPos.date === dayStr : a.date === dayStr
            );
            return (
              <div key={di} className="flex-1 relative" style={{ borderLeft: '1px solid #2e2e40' }}>
                {hours.map(h => (
                  <div key={h} style={{ height: HOUR_PX, borderBottom: '1px solid #1e1e2e' }}
                    onClick={() => {
                      const opId = filterOperator || operators[0]?.id || '';
                      openNew(dayStr, opId, resolveStartTime(dayStr, opId, h));
                    }}
                    className="cursor-pointer hover:bg-white/[0.02] transition-colors" />
                ))}
                {dayAppts.map(a => {
                  const isDragging = draggingId === a.id;
                  const effectiveStart = isDragging && draggingPos ? draggingPos.startTime : a.startTime;
                  const effectiveEndDrag = isDragging && draggingPos ? draggingPos.endTime : a.endTime;
                  const startMin = timeToMinutes(effectiveStart) - START_MIN;
                  const effectiveEnd = resizingId === a.id ? resizingEndTime : effectiveEndDrag;
                  const endMin = timeToMinutes(effectiveEnd) - START_MIN;
                  const top = (startMin / 60) * HOUR_PX;
                  const height = Math.max(((endMin - startMin) / 60) * HOUR_PX, 28);
                  const color = operators.find(o => o.id === a.operatorId)?.color || '#6366f1';
                  const client = clients.find(c => c.id === a.clientId);
                  return (
                    <div key={a.id}
                      onMouseDown={e => handleDragStart(e, a)}
                      onClick={e => { if (wasDraggedRef.current || draggingId || resizingId) { e.stopPropagation(); return; } e.stopPropagation(); openEdit(a); }}
                      className="absolute left-1 right-1 rounded-lg px-2 py-1 hover:brightness-110 transition-all overflow-hidden"
                      style={{ top, height, background: `${color}25`, border: `1px solid ${color}60`, zIndex: isDragging ? 10 : 2, opacity: isDragging ? 0.7 : 1, cursor: isDragging ? 'grabbing' : 'grab', userSelect: 'none' }}>
                      <p className="text-xs font-semibold truncate" style={{ color }}>
                        {a.isBlock ? 'Blocco: ' + a.blockReason : (client ? `${client.firstName} ${client.lastName}` : '—')}
                      </p>
                      <p className="text-xs truncate" style={{ color: '#a1a1aa' }}>{a.startTime}–{effectiveEnd}</p>
                      <div onMouseDown={e => handleResizeStart(e, a)}
                        className="absolute bottom-0 left-0 right-0 flex items-center justify-center"
                        style={{ height: 10, cursor: 'ns-resize', background: `${color}30` }}>
                        <div style={{ width: 20, height: 2, borderRadius: 2, background: color, opacity: 0.8 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      )}

      {/* Quick Client Modal */}
      {showQuickClient && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="w-full max-w-sm rounded-2xl p-5" style={{ background: '#18181f', border: '1px solid #2e2e40' }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-white text-sm">Nuovo cliente rapido</h3>
              <button onClick={() => setShowQuickClient(false)} style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            <div className="space-y-2">
              <div><label style={labelStyle}>Nome *</label><input autoFocus value={quickClient.firstName} onChange={e => setQuickClient(p => ({ ...p, firstName: e.target.value }))} style={inputStyle} /></div>
              <div><label style={labelStyle}>Cognome</label><input value={quickClient.lastName} onChange={e => setQuickClient(p => ({ ...p, lastName: e.target.value }))} style={inputStyle} /></div>
              <div><label style={labelStyle}>Telefono</label><input value={quickClient.phone} onChange={e => setQuickClient(p => ({ ...p, phone: e.target.value }))} style={inputStyle} /></div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowQuickClient(false)} style={{ flex: 1, background: '#12121a', border: '1px solid #2e2e40', color: '#71717a', borderRadius: '8px', padding: '8px', fontSize: '13px', cursor: 'pointer' }}>Annulla</button>
              <button onClick={handleQuickClientSave} style={{ ...btnPrimary, flex: 1, justifyContent: 'center' }}>Crea e seleziona</button>
            </div>
          </div>
        </div>
      )}

      {/* Appointment Modal */}
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
                  <div className="flex items-center justify-between mb-1">
                    <label style={{ ...labelStyle, marginBottom: 0 }}>Cliente</label>
                    <button onClick={() => setShowQuickClient(true)} style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <UserPlus size={12} /> Nuovo cliente
                    </button>
                  </div>
                  <select value={form.clientId} onChange={e => setForm(p => ({ ...p, clientId: e.target.value }))} style={inputStyle}>
                    <option value="">— Seleziona cliente —</option>
                    {[...clients].sort((a, b) => `${a.firstName}${a.lastName}`.localeCompare(`${b.firstName}${b.lastName}`)).map(c => (
                      <option key={c.id} value={c.id}>{c.firstName} {c.lastName}{c.phone ? ` · ${c.phone}` : ''}</option>
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
              <div><label style={labelStyle}>Note</label><textarea rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} /></div>
            </div>
            <div className="flex justify-between mt-4">
              <div className="flex gap-2">
                {editAppt && (
                  <button onClick={() => setConfirmDeleteId(editAppt.id)}
                    style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', cursor: 'pointer' }}>
                    Elimina
                  </button>
                )}
                {editAppt && form.clientId && onGoToCash && (
                  <button onClick={() => { setShowForm(false); onGoToCash(form.clientId, editAppt.id); }}
                    style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', cursor: 'pointer' }}>
                    Incassa
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowForm(false)} style={{ background: '#12121a', border: '1px solid #2e2e40', color: '#71717a', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', cursor: 'pointer' }}>Annulla</button>
                <button onClick={handleSave} style={btnPrimary}>Salva</button>
              </div>
            </div>
            {editAppt?.history && editAppt.history.length > 0 && (
              <div className="mt-4 pt-4" style={{ borderTop: '1px solid #2e2e40' }}>
                <p className="text-xs font-semibold mb-2" style={{ color: '#71717a' }}>Storico modifiche</p>
                <div className="space-y-1">
                  {[...editAppt.history].reverse().map((h, i) => (
                    <p key={i} className="text-xs" style={{ color: '#3f3f5a' }}>
                      {format(parseISO(h.timestamp), 'dd/MM/yyyy HH:mm')} {String.fromCharCode(8212)} {h.action}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirm delete appointment */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: '#18181f', border: '1px solid #2e2e40' }}>
            <h3 className="font-semibold text-white mb-2">Eliminare appuntamento?</h3>
            <p className="text-sm mb-4" style={{ color: '#71717a' }}>Questa azione non è reversibile.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDeleteId(null)} style={{ flex: 1, background: '#12121a', border: '1px solid #2e2e40', color: '#71717a', borderRadius: '8px', padding: '8px', fontSize: '13px', cursor: 'pointer' }}>Annulla</button>
              <button onClick={() => { deleteAppointment(confirmDeleteId); setConfirmDeleteId(null); setShowForm(false); }}
                style={{ flex: 1, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', borderRadius: '8px', padding: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}>Elimina</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
