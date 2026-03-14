'use client';

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useSalon } from '@/context/SalonContext';
import { Appointment, AppointmentStatus, STATUS_LABELS, Service } from '@/types/salon';
import { format, parseISO, addDays, startOfWeek, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, addMonths } from 'date-fns';
import { it } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, X, UserPlus, ZoomIn, ZoomOut, Search, Printer, Copy, Clock, AlertCircle, FileText } from 'lucide-react';

const inputStyle: React.CSSProperties = { background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '10px', padding: '9px 13px', color: 'var(--text)', fontSize: '13px', outline: 'none', width: '100%' };
const labelStyle: React.CSSProperties = { fontSize: '12px', color: 'var(--muted)', marginBottom: '4px', display: 'block' };
const btnPrimary: React.CSSProperties = { background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', color: 'var(--accent-light)', borderRadius: '10px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' };

const EMPTY_APPT: Omit<Appointment, 'id' | 'createdAt' | 'history'> = {
  clientId: '', operatorId: '', serviceIds: [], serviceOperators: {}, serviceStartTimes: {}, serviceOperatorDurations: {},
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
// Per-service helpers (pure, used in column rendering)
function getServiceOpDurForAppt(a: Appointment, sid: string, svcs: Service[]): number {
  if (a.serviceOperatorDurations?.[sid] !== undefined) return a.serviceOperatorDurations[sid];
  const svc = svcs.find(s => s.id === sid);
  return svc ? (svc.operatorDuration ?? svc.duration) : 30;
}
function computeServiceStartMin(a: Appointment, targetSid: string, svcs: Service[]): number {
  if (a.serviceStartTimes?.[targetSid]) return timeToMinutes(a.serviceStartTimes[targetSid]);
  let cumMin = timeToMinutes(a.startTime);
  for (const sid of a.serviceIds) {
    if (sid === targetSid) return cumMin;
    const svc = svcs.find(s => s.id === sid);
    cumMin += (a.serviceOperatorDurations?.[sid] ?? (svc?.operatorDuration ?? svc?.duration ?? 30)) + (svc?.processingDuration ?? 0);
  }
  return timeToMinutes(a.startTime);
}
const HOUR_PX_BASE = 80; // base height per hour at zoom 1.0 � 15-min slot = 20px

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

  // --- Combobox: cliente ---------------------------------------------------
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDrop, setShowClientDrop] = useState(false);
  const clientComboRef = useRef<HTMLDivElement>(null);

  // --- Combobox: servizi ---------------------------------------------------
  const [serviceSearch, setServiceSearch] = useState('');
  const [showServiceDrop, setShowServiceDrop] = useState(false);
  const serviceComboRef = useRef<HTMLDivElement>(null);

  // Close comboboxes on outside click
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (clientComboRef.current && !clientComboRef.current.contains(e.target as Node)) setShowClientDrop(false);
      if (serviceComboRef.current && !serviceComboRef.current.contains(e.target as Node)) setShowServiceDrop(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // --- Bottom toolbar: search, slot size, duplicate -------------------------
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [slotSizeMin, setSlotSizeMin] = useState(15); // 15 | 30 | 60
  const [selectedApptId, setSelectedApptId] = useState<string | null>(null);

  // --- Sidebar cliente ------------------------------------------------------
  const [showClientSidebar, setShowClientSidebar] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState('');

  // --- Zoom (mouse wheel + pinch) -------------------------------------------
  const [zoom, setZoom] = useState(1.0);
  // slotSizeMin controls displayed time granularity; zoom controls px height
  const HOUR_PX = HOUR_PX_BASE * zoom;
  const SLOT_MIN = slotSizeMin; // 15 | 30 | 60
  const SLOT_PX = (HOUR_PX / 60) * SLOT_MIN;
  const hourPxRef = useRef(HOUR_PX); // kept in sync � used by drag/resize event closures
  useEffect(() => { hourPxRef.current = HOUR_PX; }, [HOUR_PX]);
  const dayGridRef = useRef<HTMLDivElement>(null);
  const pinchRef = useRef<{ dist: number } | null>(null);

  const clampZoom = (v: number) => Math.min(3.0, Math.max(0.5, v));

  const handleWheelZoom = useCallback((e: WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setZoom(z => clampZoom(z - e.deltaY * 0.002));
  }, []);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = { dist: Math.hypot(dx, dy) };
    }
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const newDist = Math.hypot(dx, dy);
      const ratio = newDist / pinchRef.current.dist;
      pinchRef.current.dist = newDist;
      setZoom(z => clampZoom(z * ratio));
    }
  }, []);

  const handleTouchEnd = useCallback(() => { pinchRef.current = null; }, []);

  useEffect(() => {
    const el = dayGridRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheelZoom, { passive: false });
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('wheel', handleWheelZoom);
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleWheelZoom, handleTouchStart, handleTouchMove, handleTouchEnd]);

  useEffect(() => {
    if (newTrigger && newTrigger > 0) {
      setEditAppt(null);
      setClientSearch('');
      setServiceSearch('');
      setShowClientDrop(false);
      setShowServiceDrop(false);
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

  // Per-service drag & resize
  const serviceDragRef = useRef<{ apptId: string; serviceId: string; origStartMin: number; startY: number; startX: number } | null>(null);
  const serviceDragTargetOpRef = useRef<string | null>(null);
  const [serviceDraggingKey, setServiceDraggingKey] = useState<string | null>(null);
  const [serviceDraggingStart, setServiceDraggingStart] = useState<string | null>(null);
  const [serviceDraggingTargetOpId, setServiceDraggingTargetOpId] = useState<string | null>(null);
  const serviceResizeRef = useRef<{ apptId: string; serviceId: string; origOpDur: number; startY: number } | null>(null);
  const [serviceResizingKey, setServiceResizingKey] = useState<string | null>(null);
  const [serviceResizingOpDur, setServiceResizingOpDur] = useState<number>(0);

  const openHour = parseInt(salonConfig.openTime.split(':')[0], 10);
  const closeHour = parseInt(salonConfig.closeTime.split(':')[0], 10);
  const hours = Array.from({ length: closeHour - openHour }, (_, i) => openHour + i);
  const START_MIN = openHour * 60;

  // --- Current time indicator -----------------------------------------------
  const [nowMin, setNowMin] = useState(() => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); });
  useEffect(() => {
    const tick = () => { const n = new Date(); setNowMin(n.getHours() * 60 + n.getMinutes()); };
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);
  // Auto-scroll to current time on mount (day view)
  const didAutoScroll = useRef(false);
  useEffect(() => {
    if (view !== 'day' || didAutoScroll.current) return;
    const el = dayGridRef.current;
    if (!el) return;
    const topPx = Math.max(0, ((nowMin - START_MIN - 30) / 60) * HOUR_PX);
    el.scrollTop = topPx;
    didAutoScroll.current = true;
  }, [view, HOUR_PX, nowMin, START_MIN]);

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
      // Always include unassigned appointments regardless of operator filter
      const opOk = !filterOperator || a.operatorId === filterOperator || !a.operatorId;
      return inRange && opOk && a.status !== 'completed';
    }), [appointments, days, filterOperator]);

  // --- Go-to-date picker -----------------------------------------------------
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [gotoDateValue, setGotoDateValue] = useState('');

  // --- Search filter --------------------------------------------------------
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return appointments.filter(a => {
      const client = clients.find(c => c.id === a.clientId);
      const clientName = client ? `${client.firstName} ${client.lastName}`.toLowerCase() : '';
      const svcNames = a.serviceIds.map(sid => services.find(s => s.id === sid)?.name || '').join(' ').toLowerCase();
      return clientName.includes(q) || svcNames.includes(q) || a.notes?.toLowerCase().includes(q);
    }).slice(0, 20);
  }, [searchQuery, appointments, clients, services]);

  // --- Overlap detection per operator column --------------------------------
  function getOverlapColumns(appts: { id: string; startMin: number; endMin: number }[]): Map<string, { col: number; totalCols: number }> {
    const sorted = [...appts].sort((a, b) => a.startMin - b.startMin);
    const cols: { endMin: number }[] = [];
    const result = new Map<string, { col: number; totalCols: number }>();
    const apptCol = new Map<string, number>();
    for (const a of sorted) {
      let placed = false;
      for (let c = 0; c < cols.length; c++) {
        if (cols[c].endMin <= a.startMin) { cols[c] = { endMin: a.endMin }; apptCol.set(a.id, c); placed = true; break; }
      }
      if (!placed) { apptCol.set(a.id, cols.length); cols.push({ endMin: a.endMin }); }
    }
    const totalCols = Math.max(1, cols.length);
    for (const a of sorted) { result.set(a.id, { col: apptCol.get(a.id) ?? 0, totalCols }); }
    return result;
  }

  // --- Daily appointment count ----------------------------------------------
  const todayStr = format(currentDate, 'yyyy-MM-dd');
  const dailyCount = useMemo(() =>
    appointments.filter(a => a.date === todayStr && a.status !== 'cancelled').length,
    [appointments, todayStr]);

  function navigate(dir: number) {
    if (view === 'month') {
      setCurrentDate(prev => addMonths(prev, dir));
    } else {
      setCurrentDate(prev => addDays(prev, view === 'week' ? dir * 7 : dir));
    }
  }

  // If clicking under an appointment, start after it
  function resolveStartTime(dayStr: string, operatorId: string, clickedHour: number): string {
    const clickedMin = Math.round(clickedHour * 60 / 15) * 15; // snap to 15-min grid
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
    setClientSearch('');
    setServiceSearch('');
    setShowClientDrop(false);
    setShowServiceDrop(false);
    setForm({ ...EMPTY_APPT, date: d, operatorId: op, startTime: start, endTime: end });
    setShowForm(true);
  }

  function openEdit(a: Appointment) {
    setEditAppt(a);
    setClientSearch('');
    setServiceSearch('');
    setShowClientDrop(false);
    setShowServiceDrop(false);
    setForm({ clientId: a.clientId, operatorId: a.operatorId, serviceIds: [...a.serviceIds], serviceOperators: { ...(a.serviceOperators ?? {}) }, serviceStartTimes: { ...(a.serviceStartTimes ?? {}) }, serviceOperatorDurations: { ...(a.serviceOperatorDurations ?? {}) }, date: a.date, startTime: a.startTime, endTime: a.endTime, status: a.status, notes: a.notes, isBlock: a.isBlock, blockReason: a.blockReason, recurringGroupId: a.recurringGroupId, feedbackScore: a.feedbackScore });
    setShowForm(true);
  }

  function handleSave() {
    if (editAppt) updateAppointment({ ...editAppt, ...form }, 'Appuntamento modificato');
    else addAppointment(form);
    setShowForm(false);
  }

  function handleDuplicate() {
    if (!selectedApptId) return;
    const appt = appointments.find(a => a.id === selectedApptId);
    if (!appt) return;
    const { id: _id, createdAt: _c, history: _h, ...rest } = appt;
    addAppointment(rest);
  }

  function handleServiceToggle(id: string) {
    setForm(p => {
      const ids = p.serviceIds.includes(id) ? p.serviceIds.filter(s => s !== id) : [...p.serviceIds, id];
      const totalMin = ids.reduce((sum, sid) => {
        const svc = services.find(s => s.id === sid);
        return sum + (svc?.duration || 0);
      }, 0);
      const end = totalMin > 0 ? minutesToTime(timeToMinutes(p.startTime) + totalMin) : p.endTime;
      const newSvcOps = { ...(p.serviceOperators ?? {}) };
      const newSvcStarts = { ...(p.serviceStartTimes ?? {}) };
      const newSvcOpDurs = { ...(p.serviceOperatorDurations ?? {}) };
      if (!ids.includes(id)) { delete newSvcOps[id]; delete newSvcStarts[id]; delete newSvcOpDurs[id]; }
      return { ...p, serviceIds: ids, endTime: end, serviceOperators: newSvcOps, serviceStartTimes: newSvcStarts, serviceOperatorDurations: newSvcOpDurs };
    });
  }

  function handleQuickClientSave() {
    if (!quickClient.firstName.trim()) return;
    const newId = addClient({
      firstName: quickClient.firstName, lastName: quickClient.lastName,
      phone: quickClient.phone, email: '', birthDate: '', notes: '',
      allergies: '', tags: [], gdprConsent: false, gdprDate: '', loyaltyPoints: 0,
      gender: '', address: '', city: '', province: '', postalCode: '',
      acquisitionSource: '', acquisitionDate: '',
      visitFrequency: '', lastVisitDate: '', totalVisits: 0, totalRevenue: 0,
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

  const handleServiceDragStart = useCallback((e: React.MouseEvent, apptId: string, serviceId: string, startAbsMin: number, currentOpId: string) => {
    if (e.button !== 0) return;
    e.stopPropagation(); e.preventDefault();
    serviceDragRef.current = { apptId, serviceId, origStartMin: startAbsMin, startY: e.clientY, startX: e.clientX };
    serviceDragTargetOpRef.current = currentOpId;
    wasDraggedRef.current = false;
    setServiceDraggingKey(`${apptId}:${serviceId}`);
    setServiceDraggingStart(minutesToTime(startAbsMin));
    setServiceDraggingTargetOpId(currentOpId);
  }, []);

  const handleServiceResizeStart = useCallback((e: React.MouseEvent, apptId: string, serviceId: string, currentOpDur: number) => {
    e.stopPropagation(); e.preventDefault();
    serviceResizeRef.current = { apptId, serviceId, origOpDur: currentOpDur, startY: e.clientY };
    setServiceResizingKey(`${apptId}:${serviceId}`);
    setServiceResizingOpDur(currentOpDur);
  }, []);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      // SERVICE RESIZE
      if (serviceResizeRef.current) {
        const delta = e.clientY - serviceResizeRef.current.startY;
        const deltaMin = Math.round((delta / hourPxRef.current) * 60);
        setServiceResizingOpDur(Math.max(5, serviceResizeRef.current.origOpDur + deltaMin));
        return;
      }
      // SERVICE DRAG
      if (serviceDragRef.current) {
        const totalDelta = Math.hypot(e.clientX - serviceDragRef.current.startX, e.clientY - serviceDragRef.current.startY);
        if (totalDelta > 5) wasDraggedRef.current = true;
        // Free movement � round to 1 min, no snap
        const rawDelta = (e.clientY - serviceDragRef.current.startY) / hourPxRef.current * 60;
        const deltaMin = Math.round(rawDelta);
        const newStartMin = Math.max(openHour * 60, serviceDragRef.current.origStartMin + deltaMin);
        setServiceDraggingStart(minutesToTime(newStartMin));
        // Detect target operator column from X
        if (gridRef.current && daysRef.current.length === 1 && activeOpColsRef.current.length > 0) {
          const rect = gridRef.current.getBoundingClientRect();
          const relX = e.clientX - rect.left - 56;
          const colW = (rect.width - 56) / activeOpColsRef.current.length;
          const opIdx = Math.max(0, Math.min(activeOpColsRef.current.length - 1, Math.floor(relX / colW)));
          const targetOpId = activeOpColsRef.current[opIdx]?.id ?? null;
          if (targetOpId !== serviceDragTargetOpRef.current) {
            serviceDragTargetOpRef.current = targetOpId;
            setServiceDraggingTargetOpId(targetOpId);
          }
        }
        return;
      }
      // RESIZE
      if (resizeRef.current) {
        const delta = e.clientY - resizeRef.current.startY;
        const deltaMin = Math.round((delta / hourPxRef.current) * 60);
        const newEnd = Math.max(resizeRef.current.origStartMin + 5, resizeRef.current.origEndMin + deltaMin);
        setResizingEndTimeState(minutesToTime(newEnd));
        return;
      }
      // DRAG
      if (dragRef.current) {
        const totalDelta = Math.abs(e.clientX - dragRef.current.startX) + Math.abs(e.clientY - dragRef.current.startY);
        if (totalDelta > 5) wasDraggedRef.current = true;
        const deltaY = e.clientY - dragRef.current.startY;
        const deltaMin = Math.round(deltaY / hourPxRef.current * 60); // free movement, no 15-min snap
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
      // SERVICE RESIZE
      if (serviceResizeRef.current) {
        const { apptId, serviceId } = serviceResizeRef.current;
        serviceResizeRef.current = null;
        setServiceResizingKey(null);
        setServiceResizingOpDur(prev => {
          if (prev <= 0) return 0;
          const appt = appointments.find(a => a.id === apptId);
          if (appt) updateAppointment({ ...appt, serviceOperatorDurations: { ...(appt.serviceOperatorDurations ?? {}), [serviceId]: prev } }, 'Durata servizio modificata');
          return 0;
        });
        return;
      }
      // SERVICE DRAG
      if (serviceDragRef.current) {
        const { apptId, serviceId } = serviceDragRef.current;
        serviceDragRef.current = null;
        setServiceDraggingKey(null);
        setServiceDraggingStart(prev => {
          if (!wasDraggedRef.current || !prev) return null;
          const appt = appointments.find(a => a.id === apptId);
          if (appt) {
            const newSvcStarts = { ...(appt.serviceStartTimes ?? {}), [serviceId]: prev };
            const targetOp = serviceDragTargetOpRef.current;
            const newSvcOps = targetOp
              ? { ...(appt.serviceOperators ?? {}), [serviceId]: targetOp }
              : (appt.serviceOperators ?? {});
            updateAppointment({ ...appt, serviceStartTimes: newSvcStarts, serviceOperators: newSvcOps }, 'Servizio spostato');
          }
          return null;
        });
        setServiceDraggingTargetOpId(null);
        return;
      }
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

  // --- Mobile day-list (shown only on small screens) -----------------------
  const mobileDayStr = format(currentDate, 'yyyy-MM-dd');
  const mobileDayAppts = useMemo(() =>
    appointments
      .filter(a => a.date === mobileDayStr && a.status !== 'cancelled' && a.status !== 'completed' && (!filterOperator || a.operatorId === filterOperator || !a.operatorId))
      .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [appointments, mobileDayStr, filterOperator]);

  const MobileView = (
    <div className="md:hidden flex flex-col h-full" style={{ minHeight: 0 }}>
      {/* Mobile header */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'var(--accent-light)', cursor: 'pointer', padding: '4px' }}><ChevronLeft size={20} /></button>
          <div>
            <p className="font-bold text-sm" style={{ color: 'var(--text)' }}>{format(currentDate, 'EEEE', { locale: it })}</p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>{format(currentDate, 'dd MMMM yyyy', { locale: it })}</p>
          </div>
          <button onClick={() => navigate(1)} style={{ background: 'none', border: 'none', color: 'var(--accent-light)', cursor: 'pointer', padding: '4px' }}><ChevronRight size={20} /></button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrentDate(new Date())} style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: 'var(--accent-light)', borderRadius: 8, padding: '5px 10px', fontSize: 12, cursor: 'pointer' }}>Oggi</button>
          <button onClick={() => openNew(mobileDayStr, operators[0]?.id)} style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)', border: 'none', color: '#fff', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
            <Plus size={15} />
          </button>
        </div>
      </div>
      {/* Operator filter */}
      {operators.filter(o => o.active).length > 1 && (
        <div className="flex gap-2 px-4 py-2 overflow-x-auto flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <button
            onClick={() => setFilterOperator('')}
            style={{ background: !filterOperator ? 'rgba(99,102,241,0.2)' : 'var(--bg-input)', border: `1px solid ${!filterOperator ? 'rgba(99,102,241,0.4)' : 'var(--border)'}`, color: !filterOperator ? 'var(--accent-light)' : 'var(--muted)', borderRadius: 20, padding: '4px 12px', fontSize: 12, whiteSpace: 'nowrap', cursor: 'pointer' }}>
            Tutti
          </button>
          {operators.filter(o => o.active).map(op => (
            <button key={op.id}
              onClick={() => setFilterOperator(op.id === filterOperator ? '' : op.id)}
              style={{ background: filterOperator === op.id ? `${op.color}25` : 'var(--bg-input)', border: `1px solid ${filterOperator === op.id ? op.color : 'var(--border)'}`, color: filterOperator === op.id ? op.color : 'var(--muted)', borderRadius: 20, padding: '4px 12px', fontSize: 12, whiteSpace: 'nowrap', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: op.color, flexShrink: 0, display: 'inline-block' }} />
              {op.name}
            </button>
          ))}
        </div>
      )}
      {/* Appointment list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {mobileDayAppts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3" style={{ color: 'var(--muted)' }}>
            <span style={{ fontSize: 40 }}>??</span>
            <p className="text-sm">Nessun appuntamento</p>
            <button onClick={() => openNew(mobileDayStr, operators[0]?.id)} style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: 'var(--accent-light)', borderRadius: 10, padding: '8px 20px', fontSize: 13, cursor: 'pointer' }}>
              + Nuovo appuntamento
            </button>
          </div>
        ) : (
          mobileDayAppts.map(a => {
            const op = operators.find(o => o.id === a.operatorId);
            const client = clients.find(c => c.id === a.clientId);
            const svcNames = a.serviceIds.map(sid => services.find(s => s.id === sid)?.name).filter(Boolean).join(', ');
            const color = op?.color || '#6366f1';
            const durationMin = timeToMinutes(a.endTime) - timeToMinutes(a.startTime);
            return (
              <div key={a.id}
                onClick={() => openEdit(a)}
                className="rounded-2xl p-3 active:scale-[0.98] transition-transform cursor-pointer"
                style={{ background: `${color}12`, border: `1.5px solid ${color}40` }}>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 pt-0.5">
                    <span className="inline-flex items-center justify-center rounded-full font-bold"
                      style={{ width: 32, height: 32, background: color, color: '#fff', fontSize: 13 }}>
                      {op ? op.name.charAt(0).toUpperCase() : '?'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-sm truncate" style={{ color: 'var(--text)' }}>
                        {a.isBlock ? '?? ' + (a.blockReason || 'Blocco') : (client ? `${client.firstName} ${client.lastName}` : '�')}
                      </p>
                      <p className="text-xs font-bold flex-shrink-0" style={{ color }}>
                        {a.startTime}
                      </p>
                    </div>
                    {svcNames && (
                      <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-3)' }}>{svcNames}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs" style={{ color: 'var(--muted)' }}>{a.startTime} � {a.endTime} � {durationMin}&apos;</span>
                      {op && <span className="text-xs" style={{ color }}>{op.name}</span>}
                      {a.status === 'no-show' && <span className="text-xs" style={{ color: '#f59e0b' }}>? No-show</span>}
                      {a.notes?.trim() && <FileText size={11} color={color} opacity={0.7} />}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      {/* Mobile bottom bar */}
      <div className="flex-shrink-0 flex items-center justify-between gap-2 px-4 py-2" style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-card)' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-light)' }}>{mobileDayAppts.length}</span>
        <span style={{ fontSize: 12, color: 'var(--muted)', flex: 1 }}>appuntamenti</span>
        <button onClick={() => { setShowSearch(s => !s); }} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
          <Search size={13} /> Cerca
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-0 h-full" style={{ minHeight: 0 }}>
      {MobileView}
      {/* --- Desktop layout (hidden on mobile) ----------------------------- */}
      <div className="hidden md:flex flex-col gap-0 flex-1" style={{ minHeight: 0 }}>
      {/* --- Toolbar -------------------------------------------------------- */}
      <div className="flex items-center justify-between flex-wrap gap-2 pt-2 pb-1 px-0">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Agenda</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
            {view === 'week'
              ? `Settimana del ${format(weekStart, 'dd MMM', { locale: it })} ${String.fromCharCode(8211)} ${format(addDays(weekStart, 6), 'dd MMM yyyy', { locale: it })}`
              : view === 'month'
              ? format(currentDate, 'MMMM yyyy', { locale: it })
              : format(currentDate, 'EEEE dd MMMM yyyy', { locale: it })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            {(['day', 'week', 'month'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} className="px-3 py-1.5 text-xs font-medium"
                style={{ background: view === v ? 'rgba(99,102,241,0.2)' : 'var(--bg-input)', color: view === v ? 'var(--accent-light)' : 'var(--muted)', border: 'none', cursor: 'pointer' }}>
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
          {view === 'day' && (
            <>
              <button onClick={() => setZoom(z => clampZoom(z - 0.25))} style={{ ...btnPrimary, padding: '7px 10px' }} title="Zoom out"><ZoomOut size={15} /></button>
              <button onClick={() => setZoom(z => clampZoom(z + 0.25))} style={{ ...btnPrimary, padding: '7px 10px' }} title="Zoom in"><ZoomIn size={15} /></button>
            </>
          )}
          <button onClick={() => openNew()} style={btnPrimary}><Plus size={14} /> Nuovo</button>
          {/* Vai a data */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowDatePicker(p => !p)} style={{ ...btnPrimary, gap: 6 }} title="Vai a data">
              ?? Vai a data
            </button>
            {showDatePicker && (
              <div style={{ position: 'absolute', top: '110%', right: 0, zIndex: 50, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: 8, minWidth: 220 }}>
                <label style={{ fontSize: 11, color: 'var(--muted)' }}>Seleziona data</label>
                <input
                  autoFocus
                  type="date"
                  value={gotoDateValue}
                  onChange={e => setGotoDateValue(e.target.value)}
                  style={{ ...inputStyle }}
                />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setShowDatePicker(false)}
                    style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: 8, padding: '6px', fontSize: 12, cursor: 'pointer' }}>Annulla</button>
                  <button
                    onClick={() => { if (gotoDateValue) { setCurrentDate(parseISO(gotoDateValue)); setView('day'); } setShowDatePicker(false); setGotoDateValue(''); }}
                    style={{ ...btnPrimary, flex: 1, justifyContent: 'center' }}>Vai</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Operator legend � only shown in week/month views */}
      {view !== 'day' && activeOperators.length > 1 && (
        <div className="flex gap-3 flex-wrap">
          {activeOperators.map(o => (
            <span key={o.id} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-2)' }}>
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-white font-bold" style={{ background: o.color, fontSize: 9 }}>
                {o.name.charAt(0).toUpperCase()}
              </span>
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
          <div className="flex-1 overflow-auto rounded-2xl" style={{ border: '1px solid var(--border)', background: 'var(--bg-card)', minHeight: 0 }}>
            {/* Day names header */}
            <div className="grid grid-cols-7 sticky top-0 z-10" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
              {DAY_NAMES.map(d => (
                <div key={d} className="text-center py-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>{d}</div>
              ))}
            </div>
            {/* Day cells */}
            <div className="grid grid-cols-7" style={{ flex: 1 }}>
              {gridDays.map((day, i) => {
                const dayStr = format(day, 'yyyy-MM-dd');
                const dayAppts = appointments.filter(a => a.date === dayStr && a.status !== 'cancelled' && a.status !== 'completed' && (!filterOperator || a.operatorId === filterOperator));
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
                        color: isNow ? '#fff' : isThisMonth ? 'var(--text-2)' : 'var(--border-light)',
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
                              style={{ background: `${op?.color || '#6366f1'}25`, color: op?.color || 'var(--accent-light)', fontSize: 10 }}>
                              {a.startTime} {client ? `${client.firstName}` : a.isBlock ? 'Blocco' : '�'}
                            </div>
                          );
                        })}
                        {dayAppts.length > 3 && (
                          <div className="text-xs px-1" style={{ color: 'var(--muted)', fontSize: 10 }}>+{dayAppts.length - 3} altri</div>
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

      {/* --- DAY VIEW: one column per operator ----------------------------- */}
      {view === 'day' && (
      <div ref={dayGridRef} className="flex-1 overflow-auto rounded-2xl" style={{ border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
        {/* Sticky header: date on left, operator columns */}
        <div className="flex sticky top-0 z-10" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ width: 56, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="text-xs font-bold" style={{ color: isSameDay(currentDate, new Date()) ? 'var(--accent-light)' : 'var(--muted)' }}>
              {format(currentDate, 'dd')}
            </span>
          </div>
          {activeOperators.length === 0 ? (
            <div className="flex-1 text-center py-3 text-xs" style={{ color: 'var(--muted)', borderLeft: '1px solid var(--border)' }}>Nessun operatore attivo</div>
          ) : activeOperators.map(op => (
            <div key={op.id} className="flex-1 py-2 px-2" style={{ borderLeft: '1px solid var(--border)', minWidth: 0 }}>
              <div className="flex items-center justify-center gap-2">
                {/* Avatar operatore */}
                <span className="inline-flex items-center justify-center rounded-full font-bold flex-shrink-0"
                  style={{ width: 28, height: 28, background: op.color, color: '#fff', fontSize: 12 }}>
                  {op.name.charAt(0).toUpperCase()}
                </span>
                <span className="text-xs font-semibold truncate" style={{ color: op.color }}>{op.name}</span>
              </div>
            </div>
          ))}
          {/* Unassigned column header */}
          {(() => {
            const dayStr = format(currentDate, 'yyyy-MM-dd');
            const activeOpIds = new Set(activeOperators.map(o => o.id));
            const hasUnassigned = filteredAppts.some(a => a.date === dayStr && !activeOpIds.has(a.operatorId));
            return hasUnassigned ? (
              <div className="flex-1 py-2 px-2" style={{ borderLeft: '1px solid var(--border)', minWidth: 0 }}>
                <div className="flex items-center justify-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: '#71717a' }} />
                  <span className="text-xs font-semibold truncate" style={{ color: '#71717a' }}>Non assegnato</span>
                </div>
              </div>
            ) : null;
          })()}
        </div>
        {/* Time grid */}
        <div ref={gridRef} className="flex relative" style={{ minHeight: hours.length * HOUR_PX }}>
          {/* Current time line */}
          {isSameDay(currentDate, new Date()) && nowMin >= START_MIN && nowMin <= closeHour * 60 && (
            <div style={{
              position: 'absolute', left: 0, right: 0, zIndex: 20,
              top: ((nowMin - START_MIN) / 60) * HOUR_PX,
              pointerEvents: 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ width: 56, flexShrink: 0, textAlign: 'right', paddingRight: 6, fontSize: 9, color: '#ef4444', fontWeight: 700 }}>
                  {minutesToTime(nowMin)}
                </span>
                <div style={{ flex: 1, height: 2, background: '#ef4444', opacity: 0.85, borderRadius: 2 }} />
              </div>
              <div style={{ position: 'absolute', left: 48, top: -4, width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} />
            </div>
          )}
          {/* Hour + slot labels */}
          <div style={{ width: 56, flexShrink: 0 }}>
            {hours.map(h => {
              const slotsPerHour = 60 / SLOT_MIN;
              return Array.from({ length: slotsPerHour }, (_, q) => (
                <div key={`${h}-${q}`} style={{ height: SLOT_PX, borderBottom: q === slotsPerHour - 1 ? '1px solid var(--border)' : '1px dashed rgba(255,255,255,0.04)', display: 'flex', alignItems: 'flex-start', paddingTop: 2, paddingLeft: 8 }}>
                  {q === 0 && <span style={{ fontSize: 11, color: 'var(--border-light)' }}>{String(h).padStart(2, '0')}:00</span>}
                  {SLOT_MIN === 15 && q === 2 && <span style={{ fontSize: 9, color: 'var(--muted)', opacity: 0.6 }}>{String(h).padStart(2, '0')}:30</span>}
                  {SLOT_MIN === 30 && q === 1 && <span style={{ fontSize: 9, color: 'var(--muted)', opacity: 0.6 }}>{String(h).padStart(2, '0')}:30</span>}
                </div>
              ));
            })}
          </div>
          {/* Operator columns */}
          {activeOperators.map(op => {
            const dayStr = format(currentDate, 'yyyy-MM-dd');
            // Block/no-service appointments for this operator (appointment-level drag)
            const opBlockAppts = filteredAppts.filter(a => {
              const effectiveOp = draggingId === a.id && draggingPos?.operatorId ? draggingPos.operatorId : a.operatorId;
              return a.date === dayStr && (a.isBlock || a.serviceIds.length === 0) && effectiveOp === op.id;
            });
            // Per-service blocks: one independent block per service assigned to this operator
            type SvcBlock = { a: Appointment; sid: string };
            const opSvcBlocks: SvcBlock[] = [];
            filteredAppts.filter(a => a.date === dayStr && !a.isBlock && a.serviceIds.length > 0).forEach(a => {
              a.serviceIds.forEach(sid => {
                const isDraggingThisService = serviceDraggingKey === `${a.id}:${sid}`;
                const effectiveOpId = isDraggingThisService && serviceDraggingTargetOpId
                  ? serviceDraggingTargetOpId
                  : (a.serviceOperators?.[sid] || a.operatorId);
                if (effectiveOpId === op.id) opSvcBlocks.push({ a, sid });
              });
            });
            return (
              <div key={op.id} className="flex-1 relative" style={{ borderLeft: '1px solid var(--border)', minWidth: 0 }}>
                {/* Slot grid (dynamic slot size) */}
                {hours.map(h => {
                  const slotsPerHour = 60 / SLOT_MIN;
                  return Array.from({ length: slotsPerHour }, (_, q) => (
                    <div key={`${h}-${q}`}
                      style={{ height: SLOT_PX, borderBottom: q === slotsPerHour - 1 ? '1px solid var(--border)' : '1px dashed var(--border)', opacity: q === slotsPerHour - 1 ? 1 : 0.3 }}
                      onClick={() => openNew(dayStr, op.id, resolveStartTime(dayStr, op.id, h + q * (SLOT_MIN / 60)))}
                      className="cursor-pointer hover:bg-black/[0.03] dark:hover:bg-white/[0.02] transition-colors" />
                  ));
                })}
                {/* Whole-appointment blocks (isBlock or no services) */}
                {(() => {
                  // Compute overlap columns for block appts
                  const blockOverlap = getOverlapColumns(opBlockAppts.map(a => {
                    const isDragging = draggingId === a.id;
                    const effectiveStart = isDragging && draggingPos ? draggingPos.startTime : a.startTime;
                    const effectiveEnd = resizingId === a.id ? resizingEndTime : (isDragging && draggingPos ? draggingPos.endTime : a.endTime);
                    return { id: a.id, startMin: timeToMinutes(effectiveStart), endMin: timeToMinutes(effectiveEnd) };
                  }));
                  return opBlockAppts.map(a => {
                    const isDragging = draggingId === a.id;
                    const effectiveStart = isDragging && draggingPos ? draggingPos.startTime : a.startTime;
                    const effectiveEndDrag = isDragging && draggingPos ? draggingPos.endTime : a.endTime;
                    const startMin = timeToMinutes(effectiveStart) - START_MIN;
                    const effectiveEnd = resizingId === a.id ? resizingEndTime : effectiveEndDrag;
                    const endMin = timeToMinutes(effectiveEnd) - START_MIN;
                    const top = (startMin / 60) * HOUR_PX;
                    const totalHeight = Math.max(((endMin - startMin) / 60) * HOUR_PX, 28);
                    const color = op.color || '#6366f1';
                    const client = clients.find(c => c.id === a.clientId);
                    const ov = blockOverlap.get(a.id) ?? { col: 0, totalCols: 1 };
                    const colW = 100 / ov.totalCols;
                    const leftPct = ov.col * colW;
                    const isSelected = selectedApptId === a.id;
                    const hasNote = !!a.notes?.trim();
                    const hasWarning = a.status === 'no-show';
                    return (
                      <div key={a.id}
                        onMouseDown={e => handleDragStart(e, a)}
                        onClick={e => { if (wasDraggedRef.current || draggingId || resizingId) { e.stopPropagation(); return; } e.stopPropagation(); setSelectedApptId(a.id === selectedApptId ? null : a.id); openEdit(a); }}
                        className="absolute overflow-hidden hover:brightness-110 transition-all"
                        style={{ top, height: totalHeight, left: `calc(${leftPct}% + 2px)`, width: `calc(${colW}% - 4px)`, background: `${color}22`, border: `1.5px solid ${isSelected ? color : color + '55'}`, borderRadius: 8, boxShadow: isSelected ? `0 0 0 2px ${color}80` : 'none', zIndex: isDragging ? 10 : 2, opacity: isDragging ? 0.7 : 1, cursor: isDragging ? 'grabbing' : 'grab', userSelect: 'none' }}>
                        <div className="px-2 pt-1 pb-0.5" style={{ background: `${color}28` }}>
                          <div className="flex items-start gap-1">
                            <p className="text-xs font-semibold truncate flex-1" style={{ color }}>
                              {a.isBlock ? '?? ' + (a.blockReason || 'Blocco') : (client ? `${client.firstName} ${client.lastName}` : '�')}
                            </p>
                            {/* Status icons */}
                            <div className="flex gap-0.5 flex-shrink-0">
                              {hasNote && <FileText size={9} color={color} opacity={0.8} />}
                              {hasWarning && <AlertCircle size={9} color="#f59e0b" />}
                            </div>
                          </div>
                          <p style={{ color: 'var(--text-3)', fontSize: 10 }}>{effectiveStart}�{effectiveEnd}</p>
                        </div>
                        <div onMouseDown={e => handleResizeStart(e, a)}
                          className="absolute bottom-0 left-0 right-0 flex items-center justify-center"
                          style={{ height: 10, cursor: 'ns-resize', background: `${color}30` }}>
                          <div style={{ width: 20, height: 2, borderRadius: 2, background: color, opacity: 0.8 }} />
                        </div>
                      </div>
                    );
                  });
                })()}
                {/* Per-service independent blocks */}
                {opSvcBlocks.map(({ a, sid }) => {
                  const dragKey = `${a.id}:${sid}`;
                  const isDragging = serviceDraggingKey === dragKey;
                  const isResizing = serviceResizingKey === dragKey;
                  const svc = services.find(s => s.id === sid);
                  if (!svc) return null;
                  const svColor = op.color || '#6366f1';
                  const opDur = isResizing ? serviceResizingOpDur : getServiceOpDurForAppt(a, sid, services);
                  const procDur = svc.processingDuration ?? 0;
                  const startAbsMin = isDragging && serviceDraggingStart
                    ? timeToMinutes(serviceDraggingStart)
                    : computeServiceStartMin(a, sid, services);
                  // Active block sizing (only operator phase)
                  const activeBlockH = Math.max((opDur / 60) * HOUR_PX, 28);
                  const activeTop = ((startAbsMin - START_MIN) / 60) * HOUR_PX;
                  // Posa block sits immediately below the active block
                  const procBlockH = procDur > 0 ? Math.max((procDur / 60) * HOUR_PX, 16) : 0;
                  const procTop = activeTop + activeBlockH;
                  const client = clients.find(c => c.id === a.clientId);
                  const isSelected = selectedApptId === a.id;
                  const hasNote = !!a.notes?.trim();
                  const hasWarning = a.status === 'no-show';
                  const removeService = (e: React.MouseEvent) => {
                    e.stopPropagation();
                    const appt = appointments.find(ap => ap.id === a.id);
                    if (!appt) return;
                    const newSvcIds = appt.serviceIds.filter(s => s !== sid);
                    const newSvcOps = { ...(appt.serviceOperators ?? {}) };
                    const newSvcStarts = { ...(appt.serviceStartTimes ?? {}) };
                    const newSvcOpDurs = { ...(appt.serviceOperatorDurations ?? {}) };
                    delete newSvcOps[sid]; delete newSvcStarts[sid]; delete newSvcOpDurs[sid];
                    updateAppointment({ ...appt, serviceIds: newSvcIds, serviceOperators: newSvcOps, serviceStartTimes: newSvcStarts, serviceOperatorDurations: newSvcOpDurs }, 'Servizio rimosso');
                  };
                  return (
                    <React.Fragment key={dragKey}>
                      {/* -- Active phase block -- */}
                      <div
                        onMouseDown={e => handleServiceDragStart(e, a.id, sid, startAbsMin, op.id)}
                        onClick={e => { if (wasDraggedRef.current) { e.stopPropagation(); return; } e.stopPropagation(); setSelectedApptId(a.id === selectedApptId ? null : a.id); openEdit(a); }}
                        className="absolute left-1 right-1 overflow-hidden hover:brightness-110 transition-all"
                        style={{ top: activeTop, height: activeBlockH, background: `${svColor}22`, border: `1.5px solid ${isSelected ? svColor : svColor + '55'}`, borderRadius: procDur > 0 ? '8px 8px 0 0' : '8px', boxShadow: isSelected ? `0 0 0 2px ${svColor}80` : 'none', zIndex: isDragging ? 10 : 2, opacity: isDragging ? 0.7 : 1, cursor: isDragging ? 'grabbing' : 'grab', userSelect: 'none' }}>
                        {/* � rimuovi servizio */}
                        <button
                          onMouseDown={e => e.stopPropagation()}
                          onClick={removeService}
                          style={{ position: 'absolute', top: 2, right: 2, zIndex: 4, background: 'rgba(0,0,0,0.35)', border: 'none', color: 'rgba(255,255,255,0.65)', borderRadius: '3px', padding: '0 4px', fontSize: '11px', lineHeight: '15px', cursor: 'pointer' }}
                          title="Rimuovi servizio dall'appuntamento">�</button>
                        <div style={{ padding: '2px 24px 0 8px', overflow: 'hidden' }}>
                          <div className="flex items-start gap-1">
                            <p className="text-xs font-semibold truncate flex-1" style={{ color: svColor }}>
                              {client ? `${client.firstName} ${client.lastName}` : '�'}
                            </p>
                            <div className="flex gap-0.5 flex-shrink-0" style={{ marginRight: 16 }}>
                              {hasNote && <FileText size={9} color={svColor} opacity={0.8} />}
                              {hasWarning && <AlertCircle size={9} color="#f59e0b" />}
                            </div>
                          </div>
                          <p style={{ color: 'var(--text-3)', fontSize: 9 }} className="truncate">
                            {minutesToTime(startAbsMin)}�{minutesToTime(startAbsMin + opDur + procDur)} � {svc.name}
                          </p>
                          <p style={{ color: svColor, fontSize: 9, opacity: 0.7 }}>{opDur}&apos; operatore</p>
                        </div>
                        <div onMouseDown={e => handleServiceResizeStart(e, a.id, sid, opDur)}
                          className="absolute bottom-0 left-0 right-0 flex items-center justify-center"
                          style={{ height: 10, cursor: 'ns-resize', background: `${svColor}30` }}>
                          <div style={{ width: 20, height: 2, borderRadius: 2, background: svColor, opacity: 0.8 }} />
                        </div>
                      </div>
                      {/* -- Posa block (separate, clearly linked) -- */}
                      {procDur > 0 && (
                        <div
                          onMouseDown={e => handleServiceDragStart(e, a.id, sid, startAbsMin, op.id)}
                          onClick={e => { if (wasDraggedRef.current) { e.stopPropagation(); return; } e.stopPropagation(); openEdit(a); }}
                          className="absolute overflow-hidden"
                          style={{
                            top: procTop,
                            height: procBlockH,
                            left: 'calc(0.25rem + 3px)',
                            right: '0.25rem',
                            borderLeft: `3px solid ${svColor}`,
                            borderRight: `1px solid ${svColor}70`,
                            borderBottom: `1px solid ${svColor}70`,
                            borderTop: 'none',
                            borderBottomLeftRadius: '6px',
                            borderBottomRightRadius: '6px',
                            background: `repeating-linear-gradient(-45deg, ${svColor}28, ${svColor}28 4px, ${svColor}10 4px, ${svColor}10 8px)`,
                            zIndex: isDragging ? 9 : 2,
                            opacity: isDragging ? 0.7 : 1,
                            cursor: isDragging ? 'grabbing' : 'grab',
                            userSelect: 'none',
                          }}>
                          <div style={{ padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: 10, color: svColor, fontWeight: 600 }}>?</span>
                            <span style={{ fontSize: 10, color: svColor, fontWeight: 600 }}>Posa {procDur}&apos;</span>
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            );
          })}
          {/* Unassigned column */}
          {(() => {
            const dayStr = format(currentDate, 'yyyy-MM-dd');
            const activeOpIds = new Set(activeOperators.map(o => o.id));
            const unassigned = filteredAppts.filter(a => a.date === dayStr && !activeOpIds.has(a.operatorId));
            if (unassigned.length === 0) return null;
            return (
              <div className="flex-1 relative" style={{ borderLeft: '1px solid var(--border)', minWidth: 0 }}>
                {hours.map(h => {
                  const slotsPerHour = 60 / SLOT_MIN;
                  return Array.from({ length: slotsPerHour }, (_, q) => (
                    <div key={`${h}-${q}`}
                      style={{ height: SLOT_PX, borderBottom: q === slotsPerHour - 1 ? '1px solid var(--border)' : '1px dashed var(--border)', opacity: q === slotsPerHour - 1 ? 1 : 0.3 }}
                      onClick={() => openNew(dayStr, '', resolveStartTime(dayStr, '', h + q * (SLOT_MIN / 60)))}
                      className="cursor-pointer hover:bg-black/[0.03] dark:hover:bg-white/[0.02] transition-colors" />
                  ));
                })}
                {unassigned.map(a => {
                  const isDragging = draggingId === a.id;
                  const effectiveStart = isDragging && draggingPos ? draggingPos.startTime : a.startTime;
                  const effectiveEndDrag = isDragging && draggingPos ? draggingPos.endTime : a.endTime;
                  const startMin = timeToMinutes(effectiveStart) - START_MIN;
                  const effectiveEnd = resizingId === a.id ? resizingEndTime : effectiveEndDrag;
                  const endMin = timeToMinutes(effectiveEnd) - START_MIN;
                  const top = (startMin / 60) * HOUR_PX;
                  const totalHeight = Math.max(((endMin - startMin) / 60) * HOUR_PX, 28);
                  const color = '#71717a';
                  const client = clients.find(c => c.id === a.clientId);
                  const svcNames = a.serviceIds.map(sid => services.find(s => s.id === sid)?.name).filter(Boolean).join(', ');
                  const hasNote = !!a.notes?.trim();
                  const hasWarning = a.status === 'no-show';
                  return (
                    <div key={a.id}
                      onMouseDown={e => handleDragStart(e, a)}
                      onClick={e => { if (wasDraggedRef.current || draggingId || resizingId) { e.stopPropagation(); return; } e.stopPropagation(); setSelectedApptId(a.id === selectedApptId ? null : a.id); openEdit(a); }}
                      className="absolute left-1 right-1 rounded-lg overflow-hidden hover:brightness-110 transition-all"
                      style={{ top, height: totalHeight, background: 'rgba(113,113,122,0.15)', border: `1.5px solid ${selectedApptId === a.id ? '#71717a' : 'rgba(113,113,122,0.4)'}`, zIndex: isDragging ? 10 : 2, opacity: isDragging ? 0.7 : 1, cursor: isDragging ? 'grabbing' : 'grab', userSelect: 'none' }}>
                      <div className="px-2 pt-1 pb-0.5" style={{ background: 'rgba(113,113,122,0.15)' }}>
                        <div className="flex items-start gap-1">
                          <p className="text-xs font-semibold truncate flex-1" style={{ color }}>
                            {a.isBlock ? '?? ' + (a.blockReason || 'Blocco') : (client ? `${client.firstName} ${client.lastName}` : '�')}
                          </p>
                          <div className="flex gap-0.5 flex-shrink-0">
                            {hasNote && <FileText size={9} color={color} opacity={0.8} />}
                            {hasWarning && <AlertCircle size={9} color="#f59e0b" />}
                          </div>
                        </div>
                        <p style={{ color: 'var(--text-3)', fontSize: 10 }}>{effectiveStart}�{effectiveEnd}</p>
                        {svcNames && totalHeight > 44 && <p className="truncate" style={{ color: 'var(--muted)', fontSize: 9 }}>{svcNames}</p>}
                      </div>
                      <div onMouseDown={e => handleResizeStart(e, a)}
                        className="absolute bottom-0 left-0 right-0 flex items-center justify-center"
                        style={{ height: 10, cursor: 'ns-resize', background: 'rgba(113,113,122,0.2)' }}>
                        <div style={{ width: 20, height: 2, borderRadius: 2, background: color, opacity: 0.8 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>
      )}

      {/* --- WEEK VIEW: one column per day --------------------------------- */}
      {view === 'week' && (
      <div className="flex-1 overflow-auto rounded-2xl" style={{ border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
        <div className="flex sticky top-0 z-10" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ width: 56, flexShrink: 0 }} />
          {days.map((day, di) => (
            <div key={di} className="flex-1 text-center py-2 text-xs font-medium"
              style={{ color: isSameDay(day, new Date()) ? 'var(--accent-light)' : 'var(--muted)', borderLeft: '1px solid var(--border)' }}>
              <span className="block">{format(day, 'EEE', { locale: it })}</span>
              <span className="block text-base font-bold" style={{ color: isSameDay(day, new Date()) ? 'var(--accent-light)' : 'var(--text-2)' }}>{format(day, 'dd')}</span>
            </div>
          ))}
        </div>
        <div ref={gridRef} className="flex relative" style={{ minHeight: hours.length * HOUR_PX }}>
          <div style={{ width: 56, flexShrink: 0 }}>
            {hours.map(h => (
              <div key={h} style={{ height: HOUR_PX, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', paddingTop: 4, paddingLeft: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--border-light)' }}>{String(h).padStart(2, '0')}:00</span>
              </div>
            ))}
          </div>
          {days.map((day, di) => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const dayAppts = filteredAppts.filter(a =>
              draggingId === a.id && draggingPos ? draggingPos.date === dayStr : a.date === dayStr
            );
            const overlapMap = getOverlapColumns(dayAppts.map(a => {
              const isDragging = draggingId === a.id;
              const effectiveStart = isDragging && draggingPos ? draggingPos.startTime : a.startTime;
              const effectiveEnd = resizingId === a.id ? resizingEndTime : (isDragging && draggingPos ? draggingPos.endTime : a.endTime);
              return { id: a.id, startMin: timeToMinutes(effectiveStart), endMin: timeToMinutes(effectiveEnd) };
            }));
            return (
              <div key={di} className="flex-1 relative" style={{ borderLeft: '1px solid var(--border)' }}>
                {hours.map(h => (
                  <div key={h} style={{ height: HOUR_PX, borderBottom: '1px solid var(--border)' }}
                    onClick={() => {
                      const opId = filterOperator || operators[0]?.id || '';
                      openNew(dayStr, opId, resolveStartTime(dayStr, opId, h));
                    }}
                    className="cursor-pointer hover:bg-black/[0.03] dark:hover:bg-white/[0.02] transition-colors" />
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
                  const svcNames = a.serviceIds.map(sid => services.find(s => s.id === sid)?.name).filter(Boolean).join(', ');
                  const ov = overlapMap.get(a.id) ?? { col: 0, totalCols: 1 };
                  const colW = 100 / ov.totalCols;
                  const leftPct = ov.col * colW;
                  const hasNote = !!a.notes?.trim();
                  const hasWarning = a.status === 'no-show';
                  return (
                    <div key={a.id}
                      onMouseDown={e => handleDragStart(e, a)}
                      onClick={e => { if (wasDraggedRef.current || draggingId || resizingId) { e.stopPropagation(); return; } e.stopPropagation(); openEdit(a); }}
                      className="absolute rounded-lg px-2 py-1 hover:brightness-110 transition-all overflow-hidden"
                      style={{ top, height, left: `calc(${leftPct}% + 2px)`, width: `calc(${colW}% - 4px)`, background: `${color}25`, border: `1px solid ${color}60`, zIndex: isDragging ? 10 : 2, opacity: isDragging ? 0.7 : 1, cursor: isDragging ? 'grabbing' : 'grab', userSelect: 'none' }}>
                      <div className="flex items-start gap-1">
                        <p className="text-xs font-semibold truncate flex-1" style={{ color }}>
                          {a.isBlock ? 'Blocco: ' + a.blockReason : (client ? `${client.firstName} ${client.lastName}` : '�')}
                        </p>
                        <div className="flex gap-0.5 flex-shrink-0">
                          {hasNote && <FileText size={9} color={color} opacity={0.8} />}
                          {hasWarning && <AlertCircle size={9} color="#f59e0b" />}
                        </div>
                      </div>
                      <p className="text-xs truncate" style={{ color: 'var(--text-3)', fontSize: 10 }}>{a.startTime}�{effectiveEnd}</p>
                      {svcNames && height > 38 && <p className="truncate" style={{ color: 'var(--muted)', fontSize: 10 }}>{svcNames}</p>}
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

      {/* --- Bottom toolbar -------------------------------------------------- */}
      <div className="flex items-center gap-2 flex-wrap pt-2 pb-1 px-0 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
        {/* Cerca appuntamento */}
        <button
          onClick={() => setShowSearch(s => !s)}
          style={{ ...btnPrimary, background: showSearch ? 'rgba(99,102,241,0.3)' : btnPrimary.background, gap: 6 }}>
          <Search size={14} /> CERCA APPUNTAMENTO
        </button>
        {/* Conteggio giornaliero */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 10, padding: '5px 12px' }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent-light)', lineHeight: 1 }}>{dailyCount}</span>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>appuntamenti oggi</span>
        </div>
        {/* Stampa */}
        <button onClick={() => window.print()} style={{ ...btnPrimary, gap: 6 }} title="Stampa agenda">
          <Printer size={14} /> STAMPA
        </button>
        {/* Duplica appuntamento selezionato */}
        <button
          onClick={handleDuplicate}
          disabled={!selectedApptId}
          style={{ ...btnPrimary, gap: 6, opacity: selectedApptId ? 1 : 0.4 }}
          title={selectedApptId ? 'Duplica appuntamento selezionato' : 'Seleziona un appuntamento per duplicarlo'}>
          <Copy size={14} /> X2
        </button>
        {/* Selettore slot size */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '4px 10px' }}>
          <Clock size={13} style={{ color: 'var(--muted)' }} />
          <select value={slotSizeMin} onChange={e => setSlotSizeMin(Number(e.target.value))}
            style={{ background: 'transparent', border: 'none', color: 'var(--accent-light)', fontSize: 12, fontWeight: 600, cursor: 'pointer', outline: 'none' }}>
            <option value={15}>15 MIN.</option>
            <option value={30}>30 MIN.</option>
            <option value={60}>60 MIN.</option>
          </select>
        </div>
        {/* Ricerca cliente sidebar toggle */}
        <button onClick={() => setShowClientSidebar(s => !s)}
          style={{ ...btnPrimary, background: showClientSidebar ? 'rgba(99,102,241,0.3)' : btnPrimary.background, gap: 6, marginLeft: 'auto' }}
          title="Cerca cliente">
          <Search size={14} /> Cerca cliente
        </button>
      </div>

      {/* --- Search results overlay ----------------------------------------- */}
      {showSearch && (
        <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', flexShrink: 0 }}>
          <div className="flex items-center gap-2 mb-3">
            <Search size={14} style={{ color: 'var(--muted)' }} />
            <input
              autoFocus
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cerca per cliente, servizio o note�"
              style={{ ...inputStyle, flex: 1 }}
            />
            <button onClick={() => { setShowSearch(false); setSearchQuery(''); }} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}><X size={16} /></button>
          </div>
          {searchResults.length > 0 ? (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {searchResults.map(a => {
                const client = clients.find(c => c.id === a.clientId);
                const op = operators.find(o => o.id === a.operatorId);
                const svcNames = a.serviceIds.map(sid => services.find(s => s.id === sid)?.name).filter(Boolean).join(', ');
                return (
                  <div key={a.id}
                    onClick={() => { setCurrentDate(parseISO(a.date)); setView('day'); setShowSearch(false); setSearchQuery(''); openEdit(a); }}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors">
                    <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ background: op?.color || '#6366f1' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate" style={{ color: 'var(--text)' }}>
                        {client ? `${client.firstName} ${client.lastName}` : '�'}
                      </p>
                      {svcNames && <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>{svcNames}</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-medium" style={{ color: 'var(--accent-light)' }}>{format(parseISO(a.date), 'dd/MM/yy')}</p>
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>{a.startTime}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : searchQuery.trim() ? (
            <p className="text-xs text-center py-2" style={{ color: 'var(--muted)' }}>Nessun risultato per &ldquo;{searchQuery}&rdquo;</p>
          ) : null}
        </div>
      )}

      {/* --- Client sidebar ------------------------------------------------- */}
      {showClientSidebar && (
        <div className="fixed top-0 right-0 bottom-0 z-40 flex flex-col"
          style={{ width: 280, background: 'var(--bg-card)', borderLeft: '1px solid var(--border)', boxShadow: '-4px 0 24px rgba(0,0,0,0.4)' }}>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Cerca cliente</span>
            <button onClick={() => setShowClientSidebar(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}><X size={16} /></button>
          </div>
          <div className="px-4 py-2">
            <input
              autoFocus
              value={sidebarSearch}
              onChange={e => setSidebarSearch(e.target.value)}
              placeholder="Nome, cognome, telefono�"
              style={{ ...inputStyle }}
            />
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1">
            {clients
              .filter(c => {
                if (!sidebarSearch.trim()) return true;
                const q = sidebarSearch.toLowerCase();
                return `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) || (c.phone || '').includes(q);
              })
              .sort((a, b) => `${a.firstName}${a.lastName}`.localeCompare(`${b.firstName}${b.lastName}`))
              .slice(0, 40)
              .map(c => {
                const clientAppts = appointments.filter(a => a.clientId === c.id && a.status !== 'cancelled').sort((a, b) => b.date.localeCompare(a.date));
                const next = clientAppts.find(a => a.date >= format(new Date(), 'yyyy-MM-dd'));
                return (
                  <div key={c.id}
                    onClick={() => { setFilterOperator(''); setCurrentDate(next ? parseISO(next.date) : new Date()); if (next) setView('day'); setShowClientSidebar(false); }}
                    className="rounded-xl px-3 py-2 cursor-pointer hover:bg-white/[0.05] transition-colors"
                    style={{ border: '1px solid var(--border)' }}>
                    <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{c.firstName} {c.lastName}</p>

                    {c.phone && <p className="text-xs" style={{ color: 'var(--muted)' }}>{c.phone}</p>}
                    {next && <p className="text-xs mt-0.5" style={{ color: 'var(--accent-light)' }}>Prossimo: {format(parseISO(next.date), 'dd/MM/yy')} {next.startTime}</p>}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Quick Client Modal */}
      {showQuickClient && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="w-full max-w-sm rounded-2xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Nuovo cliente rapido</h3>
              <button onClick={() => setShowQuickClient(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            <div className="space-y-2">
              <div><label style={labelStyle}>Nome *</label><input autoFocus value={quickClient.firstName} onChange={e => setQuickClient(p => ({ ...p, firstName: e.target.value }))} style={inputStyle} /></div>
              <div><label style={labelStyle}>Cognome</label><input value={quickClient.lastName} onChange={e => setQuickClient(p => ({ ...p, lastName: e.target.value }))} style={inputStyle} /></div>
              <div><label style={labelStyle}>Telefono</label><input value={quickClient.phone} onChange={e => setQuickClient(p => ({ ...p, phone: e.target.value }))} style={inputStyle} /></div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowQuickClient(false)} style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: '8px', padding: '8px', fontSize: '13px', cursor: 'pointer' }}>Annulla</button>
              <button onClick={handleQuickClientSave} style={{ ...btnPrimary, flex: 1, justifyContent: 'center' }}>Crea e seleziona</button>
            </div>
          </div>
        </div>
      )}

      {/* Appointment Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold" style={{ color: 'var(--text)' }}>{editAppt ? 'Modifica Appuntamento' : 'Nuovo Appuntamento'}</h3>
              <div className="flex gap-2 items-center">
                {editAppt && (
                  <>
                    <select value={editAppt.status} onChange={e => { changeAppointmentStatus(editAppt.id, e.target.value as AppointmentStatus); setEditAppt(prev => prev ? { ...prev, status: e.target.value as AppointmentStatus } : null); }}
                      style={{ ...inputStyle, width: 'auto', padding: '4px 8px', fontSize: '12px' }}>
                      {(Object.keys(STATUS_LABELS) as AppointmentStatus[]).map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                    </select>
                    {editAppt.status !== 'no-show' && (
                      <button
                        title="Segna come No-show"
                        onClick={() => { changeAppointmentStatus(editAppt.id, 'no-show'); setEditAppt(prev => prev ? { ...prev, status: 'no-show' } : null); }}
                        style={{ background: '#ef4444', border: 'none', color: '#fff', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        ?? No-show
                      </button>
                    )}
                  </>
                )}
                <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}><X size={18} /></button>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isBlock" checked={form.isBlock} onChange={e => setForm(p => ({ ...p, isBlock: e.target.checked }))} />
                <label htmlFor="isBlock" style={{ fontSize: '13px', color: 'var(--text-2)' }}>Blocca orario (pausa / riunione)</label>
              </div>
              {form.isBlock ? (
                <div><label style={labelStyle}>Motivo blocco</label><input value={form.blockReason} onChange={e => setForm(p => ({ ...p, blockReason: e.target.value }))} style={inputStyle} /></div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label style={{ ...labelStyle, marginBottom: 0 }}>Cliente</label>
                    <button onClick={() => setShowQuickClient(true)} style={{ background: 'none', border: 'none', color: 'var(--accent-light)', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <UserPlus size={12} /> Nuovo cliente
                    </button>
                  </div>
                  {/* Searchable client combobox */}
                  <div ref={clientComboRef} style={{ position: 'relative' }}>
                    <input
                      type="text"
                      autoComplete="off"
                      placeholder="🔍 Cerca cliente..."
                      value={clientSearch}
                      onFocus={() => setShowClientDrop(true)}
                      onChange={e => { setClientSearch(e.target.value); setShowClientDrop(true); }}
                      style={{ ...inputStyle, paddingRight: form.clientId ? '32px' : undefined }}
                    />
                    {/* Overlay showing selected client name when dropdown is closed */}
                    {form.clientId && !showClientDrop && (() => {
                      const sel = clients.find(c => c.id === form.clientId);
                      return sel ? (
                        <div
                          onClick={() => { setShowClientDrop(true); setClientSearch(''); }}
                          style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', paddingLeft: '13px', paddingRight: '32px', cursor: 'text', borderRadius: '10px', background: 'var(--bg-input)', border: '1px solid var(--border)', fontSize: '13px', color: 'var(--text)', userSelect: 'none' }}>
                          {sel.firstName} {sel.lastName}{sel.phone ? ` \u2014 ${sel.phone}` : ''}
                        </div>
                      ) : null;
                    })()}
                    {form.clientId && (
                      <button
                        type="button"
                        onClick={() => { setForm(p => ({ ...p, clientId: '' })); setClientSearch(''); }}
                        style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        <X size={14} />
                      </button>
                    )}
                    {showClientDrop && (
                      <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 200, maxHeight: '220px', overflowY: 'auto', borderRadius: '10px', background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                        {[...clients]
                          .sort((a, b) => `${a.firstName}${a.lastName}`.localeCompare(`${b.firstName}${b.lastName}`))
                          .filter(c => {
                            if (!clientSearch.trim()) return true;
                            const q = clientSearch.toLowerCase();
                            return `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) || (c.phone || '').includes(q);
                          })
                          .map(c => (
                            <div
                              key={c.id}
                              onMouseDown={() => { setForm(p => ({ ...p, clientId: c.id })); setClientSearch(''); setShowClientDrop(false); }}
                              style={{ padding: '9px 13px', cursor: 'pointer', fontSize: '13px', color: form.clientId === c.id ? 'var(--accent-light)' : 'var(--text)', background: form.clientId === c.id ? 'rgba(99,102,241,0.15)' : 'transparent', borderBottom: '1px solid var(--border)' }}
                              onMouseEnter={e => { if (form.clientId !== c.id) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.05)'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = form.clientId === c.id ? 'rgba(99,102,241,0.15)' : 'transparent'; }}>
                              <span style={{ fontWeight: 500 }}>{c.firstName} {c.lastName}</span>
                              {c.phone && <span style={{ color: 'var(--muted)', marginLeft: '6px', fontSize: '12px' }}>{c.phone}</span>}
                            </div>
                          ))}
                        {clients.filter(c => {
                          if (!clientSearch.trim()) return true;
                          const q = clientSearch.toLowerCase();
                          return `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) || (c.phone || '').includes(q);
                        }).length === 0 && (
                          <div style={{ padding: '10px 13px', fontSize: '13px', color: 'var(--muted)' }}>Nessun cliente trovato</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div><label style={labelStyle}>Data</label><input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} style={inputStyle} /></div>
                <div>
                  <label style={labelStyle}>Operatore</label>
                  <select value={form.operatorId} onChange={e => setForm(p => ({ ...p, operatorId: e.target.value }))} style={inputStyle}>
                    <option value="">�</option>
                    {operators.filter(o => o.active).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
                <div><label style={labelStyle}>Ora inizio</label><input type="time" value={form.startTime} onChange={e => setForm(p => ({ ...p, startTime: e.target.value }))} style={inputStyle} /></div>
                <div><label style={labelStyle}>Ora fine</label><input type="time" value={form.endTime} onChange={e => setForm(p => ({ ...p, endTime: e.target.value }))} style={inputStyle} /></div>
              </div>
              {!form.isBlock && (
                <div className="space-y-2">
                  <label style={labelStyle}>Servizi</label>
                  {/* Selected service chips */}
                  {form.serviceIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-1">
                      {form.serviceIds.map(sid => {
                        const svc = services.find(s => s.id === sid);
                        if (!svc) return null;
                        return (
                          <span key={sid} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', color: 'var(--accent-light)', borderRadius: '20px', padding: '3px 10px', fontSize: '12px' }}>
                            {svc.name} ({svc.duration}')
                            <button type="button" onMouseDown={() => handleServiceToggle(sid)} style={{ background: 'none', border: 'none', color: 'var(--accent-light)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0, marginLeft: '2px' }}><X size={11} /></button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                  {/* Searchable service combobox */}
                  <div ref={serviceComboRef} style={{ position: 'relative' }}>
                    <input
                      type="text"
                      autoComplete="off"
                      placeholder="🔍 Cerca servizio..."
                      value={serviceSearch}
                      onFocus={() => setShowServiceDrop(true)}
                      onChange={e => { setServiceSearch(e.target.value); setShowServiceDrop(true); }}
                      style={inputStyle}
                    />
                    {showServiceDrop && (
                      <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 200, maxHeight: '220px', overflowY: 'auto', borderRadius: '10px', background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                        {services
                          .filter(s => s.active)
                          .filter(s => !serviceSearch.trim() || s.name.toLowerCase().includes(serviceSearch.toLowerCase()))
                          .map(s => (
                            <div
                              key={s.id}
                              onMouseDown={() => { handleServiceToggle(s.id); setServiceSearch(''); }}
                              style={{ padding: '9px 13px', cursor: 'pointer', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: form.serviceIds.includes(s.id) ? 'var(--accent-light)' : 'var(--text)', background: form.serviceIds.includes(s.id) ? 'rgba(99,102,241,0.15)' : 'transparent', borderBottom: '1px solid var(--border)' }}
                              onMouseEnter={e => { if (!form.serviceIds.includes(s.id)) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.05)'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = form.serviceIds.includes(s.id) ? 'rgba(99,102,241,0.15)' : 'transparent'; }}>
                              <span style={{ fontWeight: form.serviceIds.includes(s.id) ? 600 : 400 }}>{s.name}</span>
                              <span style={{ fontSize: '12px', color: 'var(--muted)', marginLeft: '8px' }}>{s.duration}'</span>
                            </div>
                          ))}
                        {services.filter(s => s.active && (!serviceSearch.trim() || s.name.toLowerCase().includes(serviceSearch.toLowerCase()))).length === 0 && (
                          <div style={{ padding: '10px 13px', fontSize: '13px', color: 'var(--muted)' }}>Nessun servizio trovato</div>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Per-service operator assignment (shown when multiple services selected) */}
                  {form.serviceIds.length > 0 && (
                    <div className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                      <p className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Operatore per servizio</p>
                      {form.serviceIds.map(sid => {
                        const svc = services.find(s => s.id === sid);
                        if (!svc) return null;
                        const assignedOp = form.serviceOperators?.[sid] || form.operatorId;
                        const hasProc = (svc.processingDuration ?? 0) > 0;
                        return (
                          <div key={sid} className="flex items-center gap-2">
                            <span className="text-xs flex-1 truncate" style={{ color: 'var(--text-2)' }}>
                              {svc.name}
                              {hasProc && <span style={{ color: 'var(--muted)', marginLeft: 4 }}>({svc.operatorDuration ?? svc.duration}&apos;+{svc.processingDuration}&apos;)</span>}
                            </span>
                            <select
                              value={assignedOp}
                              onChange={e => setForm(p => ({ ...p, serviceOperators: { ...(p.serviceOperators ?? {}), [sid]: e.target.value } }))}
                              style={{ ...inputStyle, width: 'auto', padding: '4px 8px', fontSize: '12px', flex: '0 0 auto' }}>
                              {operators.filter(o => o.active).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  )}
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
                <button onClick={() => setShowForm(false)} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', cursor: 'pointer' }}>Annulla</button>
                <button onClick={handleSave} style={btnPrimary}>Salva</button>
              </div>
            </div>
            {editAppt?.history && editAppt.history.length > 0 && (
              <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                <p className="text-xs font-semibold mb-2" style={{ color: 'var(--muted)' }}>Storico modifiche</p>
                <div className="space-y-1">
                  {[...editAppt.history].reverse().map((h, i) => (
                    <p key={i} className="text-xs" style={{ color: 'var(--border-light)' }}>
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
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <h3 className="font-semibold mb-2" style={{ color: 'var(--text)' }}>Eliminare appuntamento?</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>Questa azione non � reversibile.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDeleteId(null)} style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: '8px', padding: '8px', fontSize: '13px', cursor: 'pointer' }}>Annulla</button>
              <button onClick={() => { deleteAppointment(confirmDeleteId); setConfirmDeleteId(null); setShowForm(false); }}
                style={{ flex: 1, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', borderRadius: '8px', padding: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}>Elimina</button>
            </div>
          </div>
        </div>
      )}
      </div>{/* end hidden md:flex desktop wrapper */}

    </div>
  );
}
