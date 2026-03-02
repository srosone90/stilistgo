'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useSalon } from '@/context/SalonContext';
import { Payment, PaymentMethod, PAYMENT_METHOD_LABELS, PaymentItem, CashSession } from '@/types/salon';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { Plus, X, Trash2, CreditCard, Banknote, Gift, TrendingUp, ChevronDown, ChevronUp, Printer } from 'lucide-react';
import { formatCurrency } from '@/lib/calculations';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const inputStyle: React.CSSProperties = { background: '#12121a', border: '1px solid #2e2e40', borderRadius: '10px', padding: '9px 13px', color: '#f4f4f5', fontSize: '13px', outline: 'none', width: '100%' };
const labelStyle: React.CSSProperties = { fontSize: '12px', color: '#71717a', marginBottom: '4px', display: 'block' };
const btnPrimary: React.CSSProperties = { background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', color: '#818cf8', borderRadius: '10px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' };
const card: React.CSSProperties = { background: '#1c1c27', border: '1px solid #2e2e40', borderRadius: '16px', padding: '20px' };

const METHOD_ICONS: Record<PaymentMethod, React.ReactNode> = {
  cash: <Banknote size={14} style={{ color: '#22c55e' }} />,
  card: <CreditCard size={14} style={{ color: '#818cf8' }} />,
  gift_card: <Gift size={14} style={{ color: '#f59e0b' }} />,
  mixed: <TrendingUp size={14} style={{ color: '#06b6d4' }} />,
};

type FormState = {
  appointmentId: string;
  clientId: string;
  clientName: string;
  operatorId: string;
  date: string;
  items: PaymentItem[];
  discountPct: number;
  discountEur: number;
  paymentMethod: PaymentMethod;
  cashAmount: number;
  cardAmount: number;
  giftCardCode: string;
  giftCardAmount: number;
  notes: string;
};

const EMPTY_FORM: FormState = {
  appointmentId: '', clientId: '', clientName: '', operatorId: '',
  date: format(new Date(), 'yyyy-MM-dd'),
  items: [], discountPct: 0, discountEur: 0,
  paymentMethod: 'cash', cashAmount: 0, cardAmount: 0,
  giftCardCode: '', giftCardAmount: 0, notes: '',
};

export default function CashView({ newTrigger, cashPreset, onPresetConsumed }: {
  newTrigger?: number;
  cashPreset?: { clientId: string; appointmentId: string } | null;
  onPresetConsumed?: () => void;
}) {
  const {
    payments, addPayment, deletePayment,
    cashSessions, addCashSession, closeCashSession,
    clients, operators, services, appointments,
    redeemGiftCard, salonConfig,
  } = useSalon();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => { if (newTrigger && newTrigger > 0) { setShowForm(true); setForm({ ...EMPTY_FORM, date: selectedDate }); } }, [newTrigger, selectedDate]);

  // Apertura automatica da calendario (bottone Incassa)
  useEffect(() => {
    if (!cashPreset) return;
    const client = clients.find(c => c.id === cashPreset.clientId);
    const appt = appointments.find(a => a.id === cashPreset.appointmentId);
    const newForm: FormState = { ...EMPTY_FORM, date: selectedDate };
    if (client) { newForm.clientId = client.id; newForm.clientName = `${client.firstName} ${client.lastName}`.trim(); }
    if (appt) {
      newForm.appointmentId = appt.id;
      newForm.operatorId = appt.operatorId;
      if (appt.date) newForm.date = appt.date;
      if (appt.serviceIds.length > 0) {
        newForm.items = appt.serviceIds.map(sid => {
          const svc = services.find(s => s.id === sid);
          return svc ? { serviceId: svc.id, serviceName: svc.name, price: svc.price } : null;
        }).filter(Boolean) as PaymentItem[];
      }
    }
    setForm(newForm);
    setShowForm(true);
    onPresetConsumed?.();
  }, [cashPreset, appointments, clients, services, onPresetConsumed, selectedDate]);
  const [showHistory, setShowHistory] = useState(false);
  const [showOpenSession, setShowOpenSession] = useState(false);
  const [openingBalance, setOpeningBalance] = useState('0');
  const [showCloseSession, setShowCloseSession] = useState(false);
  const [closingBalance, setClosingBalance] = useState('');
  const [expandedPaymentId, setExpandedPaymentId] = useState<string | null>(null);
  const [newItemServiceId, setNewItemServiceId] = useState('');

  // Today's session
  const todaySession = useMemo(() =>
    cashSessions.find(s => s.date === selectedDate && !s.closedAt) ?? null,
    [cashSessions, selectedDate]);

  // Payments for selected date
  const dayPayments = useMemo(() =>
    payments.filter(p => p.date === selectedDate).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [payments, selectedDate]);

  // Totals
  const totals = useMemo(() => {
    const total = dayPayments.reduce((s, p) => s + p.total, 0);
    const cash = dayPayments.reduce((s, p) => s + p.cashAmount, 0);
    const card = dayPayments.reduce((s, p) => s + p.cardAmount, 0);
    const gc = dayPayments.reduce((s, p) => s + p.giftCardAmount, 0);
    const discounts = dayPayments.reduce((s, p) => s + p.discountEur, 0);
    return { total, cash, card, gc, discounts, count: dayPayments.length };
  }, [dayPayments]);

  // Computed subtotal/total from form
  const formSubtotal = useMemo(() => form.items.reduce((s, i) => s + i.price, 0), [form.items]);
  const formDiscount = useMemo(() => {
    if (form.discountPct > 0) return Math.round(formSubtotal * form.discountPct / 100 * 100) / 100;
    return form.discountEur;
  }, [formSubtotal, form.discountPct, form.discountEur]);
  const formTotal = useMemo(() => Math.max(0, formSubtotal - formDiscount), [formSubtotal, formDiscount]);

  // Load appointment into form
  function loadAppointment(apptId: string) {
    const appt = appointments.find(a => a.id === apptId);
    if (!appt) return;
    const client = clients.find(c => c.id === appt.clientId);
    const items: PaymentItem[] = appt.serviceIds.map(sid => {
      const svc = services.find(s => s.id === sid);
      return { serviceId: sid, serviceName: svc?.name || sid, price: svc?.price || 0 };
    });
    setForm(p => ({
      ...p,
      appointmentId: apptId,
      clientId: appt.clientId,
      clientName: client ? `${client.firstName} ${client.lastName}` : '',
      operatorId: appt.operatorId,
      date: appt.date,
      items,
    }));
  }

  function addManualItem() {
    if (!newItemServiceId) return;
    const svc = services.find(s => s.id === newItemServiceId);
    if (!svc) return;
    setForm(p => ({ ...p, items: [...p.items, { serviceId: svc.id, serviceName: svc.name, price: svc.price }] }));
    setNewItemServiceId('');
  }

  // --- Generazione PDF report cassa ---
  function generateCashPdf(session: CashSession) {
    const doc = new jsPDF();
    const sp = payments.filter(p => p.date === session.date);
    const st = {
      total: sp.reduce((s, p) => s + p.total, 0),
      cash: sp.reduce((s, p) => s + p.cashAmount, 0),
      card: sp.reduce((s, p) => s + p.cardAmount, 0),
      gc: sp.reduce((s, p) => s + p.giftCardAmount, 0),
      discounts: sp.reduce((s, p) => s + p.discountEur, 0),
    };
    const dateStr = format(parseISO(session.date), 'dd MMMM yyyy', { locale: it });

    // Intestazione
    doc.setFontSize(18);
    doc.setTextColor(40, 40, 40);
    doc.text(salonConfig.salonName || 'Stylistgo', 105, 18, { align: 'center' });
    doc.setFontSize(13);
    doc.setTextColor(80, 80, 80);
    doc.text('REPORT CHIUSURA CASSA', 105, 27, { align: 'center' });
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Data: ${dateStr}`, 14, 37);
    if (session.closedAt) doc.text(`Chiuso alle: ${format(parseISO(session.closedAt), 'HH:mm')}`, 14, 43);
    doc.setDrawColor(200, 200, 200);
    doc.line(14, 48, 196, 48);

    // Tabella movimenti
    if (sp.length > 0) {
      doc.setFontSize(11);
      doc.setTextColor(40, 40, 40);
      doc.text('MOVIMENTI', 14, 55);
      autoTable(doc, {
        startY: 59,
        head: [['Cliente', 'Servizi', 'Metodo', 'Sconto', 'Totale']],
        body: sp.map(p => [
          p.clientName || '—',
          p.items.map(i => i.serviceName).join(', '),
          PAYMENT_METHOD_LABELS[p.paymentMethod],
          p.discountEur > 0 ? `-€${p.discountEur.toFixed(2)}` : '—',
          `€${p.total.toFixed(2)}`,
        ]),
        theme: 'striped',
        headStyles: { fillColor: [99, 102, 241], textColor: 255 },
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: { 4: { halign: 'right', fontStyle: 'bold' } },
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const y1 = sp.length > 0 ? (doc as any).lastAutoTable?.finalY + 10 : 59;

    // Riepilogo incassi
    doc.setFontSize(11);
    doc.setTextColor(40, 40, 40);
    doc.text('RIEPILOGO INCASSI', 14, y1);
    autoTable(doc, {
      startY: y1 + 4,
      body: [
        ['N. transazioni', `${sp.length}`],
        ['Totale incassato', `€${st.total.toFixed(2)}`],
        ['  Contanti', `€${st.cash.toFixed(2)}`],
        ['  Carta / POS', `€${st.card.toFixed(2)}`],
        ['  Gift Card', `€${st.gc.toFixed(2)}`],
        ['Sconti applicati', `-€${st.discounts.toFixed(2)}`],
      ],
      theme: 'plain',
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 90 }, 1: { halign: 'right' } },
      styles: { fontSize: 10, cellPadding: 2.5 },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const y2 = (doc as any).lastAutoTable?.finalY + 10;

    // Fondo cassa
    doc.setFontSize(11);
    doc.setTextColor(40, 40, 40);
    doc.text('FONDO CASSA', 14, y2);
    const teorico = session.openingBalance + st.cash;
    const varianza = session.closingBalance != null ? session.closingBalance - teorico : null;
    autoTable(doc, {
      startY: y2 + 4,
      body: [
        ['Fondo iniziale', `€${session.openingBalance.toFixed(2)}`],
        ['+ Incasso contanti', `€${st.cash.toFixed(2)}`],
        ['= Totale teorico', `€${teorico.toFixed(2)}`],
        ['Contante effettivo a fine turno', session.closingBalance != null ? `€${session.closingBalance.toFixed(2)}` : '—'],
        ['Varianza', varianza != null ? `${varianza >= 0 ? '+' : ''}€${varianza.toFixed(2)}` : '—'],
      ],
      theme: 'plain',
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 90 }, 1: { halign: 'right' } },
      styles: { fontSize: 10, cellPadding: 2.5 },
    });

    // Footer
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const y3 = (doc as any).lastAutoTable?.finalY + 12;
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text(`Generato da Stylistgo · ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 105, y3, { align: 'center' });

    doc.save(`cassa-${session.date.replace(/-/g, '')}.pdf`);
  }

  function syncPaymentAmounts(method: PaymentMethod, total: number) {
    if (method === 'cash') return { cashAmount: total, cardAmount: 0, giftCardAmount: 0 };
    if (method === 'card') return { cashAmount: 0, cardAmount: total, giftCardAmount: 0 };
    if (method === 'gift_card') return { cashAmount: 0, cardAmount: 0, giftCardAmount: total };
    return { cashAmount: form.cashAmount, cardAmount: form.cardAmount, giftCardAmount: form.giftCardAmount };
  }

  function handleSave() {
    if (form.items.length === 0 || formTotal === 0) return;
    const amounts = syncPaymentAmounts(form.paymentMethod, formTotal);
    // Redeem gift card if applicable
    if ((form.paymentMethod === 'gift_card' || form.paymentMethod === 'mixed') && form.giftCardCode) {
      redeemGiftCard(form.giftCardCode, amounts.giftCardAmount || form.giftCardAmount);
    }
    addPayment({
      appointmentId: form.appointmentId,
      clientId: form.clientId,
      clientName: form.clientName,
      operatorId: form.operatorId,
      date: form.date,
      items: form.items,
      subtotal: formSubtotal,
      discountPct: form.discountPct,
      discountEur: formDiscount,
      total: formTotal,
      paymentMethod: form.paymentMethod,
      cashAmount: amounts.cashAmount,
      cardAmount: amounts.cardAmount,
      giftCardCode: form.giftCardCode,
      giftCardAmount: amounts.giftCardAmount || form.giftCardAmount,
      notes: form.notes,
    });
    // Mark appointment completed
    if (form.appointmentId) {
      const appt = appointments.find(a => a.id === form.appointmentId);
      if (appt) {
        // changeAppointmentStatus called indirectly - handled by context
      }
    }
    setShowForm(false);
    setForm(EMPTY_FORM);
  }

  const todayAppts = useMemo(() =>
    appointments.filter(a => a.date === selectedDate && !a.isBlock && a.status !== 'cancelled'),
    [appointments, selectedDate]);

  return (
    <div className="flex flex-col gap-4 h-full" style={{ minHeight: 0 }}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Cassa</h1>
          <p className="text-xs mt-0.5" style={{ color: '#71717a' }}>
            {format(parseISO(selectedDate), 'EEEE dd MMMM yyyy', { locale: it })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
            style={{ ...inputStyle, width: 'auto' }} />
          {!todaySession ? (
            <button onClick={() => setShowOpenSession(true)} style={{ ...btnPrimary, color: '#22c55e', borderColor: 'rgba(34,197,94,0.4)', background: 'rgba(34,197,94,0.1)' }}>
              Apri turno
            </button>
          ) : (
            <button onClick={() => { setClosingBalance(''); setShowCloseSession(true); }}
              style={{ ...btnPrimary, color: '#f59e0b', borderColor: 'rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.1)' }}>
              Chiudi turno
            </button>
          )}
          <button onClick={() => { setForm({ ...EMPTY_FORM, date: selectedDate }); setShowForm(true); }} style={btnPrimary}>
            <Plus size={14} /> Incassa
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Totale incassato', value: formatCurrency(totals.total), color: '#22c55e', icon: <TrendingUp size={16} /> },
          { label: 'Contanti', value: formatCurrency(totals.cash), color: '#d4d4d8', icon: <Banknote size={16} /> },
          { label: 'Carta / POS', value: formatCurrency(totals.card), color: '#818cf8', icon: <CreditCard size={16} /> },
          { label: 'Pagamenti', value: `${totals.count}`, color: '#71717a', icon: null },
        ].map(k => (
          <div key={k.label} style={card} className="text-center">
            <p className="text-xl font-bold" style={{ color: k.color }}>{k.value}</p>
            <p className="text-xs mt-1" style={{ color: '#71717a' }}>{k.label}</p>
          </div>
        ))}
      </div>

      {/* Payments list */}
      <div style={card} className="flex-1 overflow-y-auto min-h-0">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">Movimenti del giorno</h3>
          <button onClick={() => setShowHistory(!showHistory)}
            style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: 4 }}>
            {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {showHistory ? 'Nascondi storico' : 'Mostra storico'}
          </button>
        </div>
        {dayPayments.length === 0 && <p style={{ color: '#3f3f5a', fontSize: '13px' }}>Nessun pagamento registrato per questa data.</p>}
        <div className="space-y-2">
          {dayPayments.map(p => (
            <div key={p.id} style={{ background: '#12121a', border: '1px solid #2e2e40', borderRadius: '12px' }}>
              <div className="flex items-center justify-between p-3 cursor-pointer" onClick={() => setExpandedPaymentId(expandedPaymentId === p.id ? null : p.id)}>
                <div className="flex items-center gap-3">
                  {METHOD_ICONS[p.paymentMethod]}
                  <div>
                    <p className="text-sm font-medium text-white">{p.clientName || '— Cliente non registrato —'}</p>
                    <p style={{ fontSize: '11px', color: '#71717a' }}>
                      {PAYMENT_METHOD_LABELS[p.paymentMethod]} · {p.items.map(i => i.serviceName).join(', ')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold" style={{ color: '#22c55e' }}>{formatCurrency(p.total)}</span>
                  <button onClick={e => { e.stopPropagation(); deletePayment(p.id); }}
                    style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', borderRadius: '8px', padding: '5px 8px', cursor: 'pointer' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              {expandedPaymentId === p.id && (
                <div className="px-3 pb-3 space-y-1" style={{ borderTop: '1px solid #2e2e40', paddingTop: 8 }}>
                  {p.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-xs" style={{ color: '#a1a1aa' }}>
                      <span>{item.serviceName}</span><span>{formatCurrency(item.price)}</span>
                    </div>
                  ))}
                  {p.discountEur > 0 && (
                    <div className="flex justify-between text-xs" style={{ color: '#f59e0b' }}>
                      <span>Sconto {p.discountPct > 0 ? `(${p.discountPct}%)` : ''}</span><span>-{formatCurrency(p.discountEur)}</span>
                    </div>
                  )}
                  {p.notes && <p className="text-xs mt-1" style={{ color: '#71717a' }}>Note: {p.notes}</p>}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Historical sessions */}
        {showHistory && (
          <div className="mt-4 pt-4" style={{ borderTop: '1px solid #2e2e40' }}>
            <h4 className="text-xs font-semibold mb-3" style={{ color: '#71717a' }}>Sessioni cassa chiuse</h4>
            {cashSessions.filter(s => s.closedAt).slice(0, 20).map(s => (
              <div key={s.id} className="flex justify-between items-center text-xs py-2" style={{ borderBottom: '1px solid #2e2e40', color: '#a1a1aa' }}>
                <span style={{ fontWeight: 500 }}>{format(parseISO(s.date), 'dd/MM/yyyy')}</span>
                <span>Apertura: {formatCurrency(s.openingBalance)}</span>
                <span>Chiusura: {s.closingBalance != null ? formatCurrency(s.closingBalance) : '—'}</span>
                <span style={{ color: s.closingBalance != null && s.closingBalance >= s.openingBalance ? '#22c55e' : '#f87171' }}>
                  {s.closingBalance != null ? (s.closingBalance >= s.openingBalance ? '+' : '') + formatCurrency(s.closingBalance - s.openingBalance) : '—'}
                </span>
                <button onClick={() => generateCashPdf(s)} title="Scarica PDF"
                  style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8', borderRadius: '6px', padding: '3px 7px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Printer size={11} /> PDF
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Open session modal */}
      {showOpenSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: '#18181f', border: '1px solid #2e2e40' }}>
            <h3 className="font-semibold text-white mb-4">Apri turno cassa</h3>
            <div><label style={labelStyle}>Fondo cassa iniziale (€)</label>
              <input type="number" min={0} step={0.01} value={openingBalance} onChange={e => setOpeningBalance(e.target.value)} style={inputStyle} />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowOpenSession(false)} style={{ flex: 1, background: '#12121a', border: '1px solid #2e2e40', color: '#71717a', borderRadius: '8px', padding: '8px', fontSize: '13px', cursor: 'pointer' }}>Annulla</button>
              <button onClick={() => { addCashSession(parseFloat(openingBalance) || 0); setShowOpenSession(false); }}
                style={{ ...btnPrimary, flex: 1, justifyContent: 'center' }}>Apri turno</button>
            </div>
          </div>
        </div>
      )}

      {/* Close session modal */}
      {showCloseSession && todaySession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: '#18181f', border: '1px solid #2e2e40' }}>
            <h3 className="font-semibold text-white mb-4">Chiudi turno cassa</h3>
            <div className="space-y-2 mb-4 text-sm" style={{ color: '#a1a1aa' }}>
              <div className="flex justify-between"><span>Fondo iniziale:</span><span>{formatCurrency(todaySession.openingBalance)}</span></div>
              <div className="flex justify-between"><span>Incasso contanti:</span><span>{formatCurrency(totals.cash)}</span></div>
              <div className="flex justify-between font-semibold text-white"><span>Totale in cassa:</span><span>{formatCurrency(todaySession.openingBalance + totals.cash)}</span></div>
            </div>
            <div><label style={labelStyle}>Contante effettivo in cassa (€)</label>
              <input type="number" min={0} step={0.01} value={closingBalance} onChange={e => setClosingBalance(e.target.value)} style={inputStyle} />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowCloseSession(false)} style={{ flex: 1, background: '#12121a', border: '1px solid #2e2e40', color: '#71717a', borderRadius: '8px', padding: '8px', fontSize: '13px', cursor: 'pointer' }}>Annulla</button>
              <button onClick={() => {
                closeCashSession(todaySession.id, parseFloat(closingBalance) || 0);
                // Genera PDF immediatamente dopo la chiusura
                const closedSession: CashSession = { ...todaySession, closingBalance: parseFloat(closingBalance) || 0, closedAt: new Date().toISOString() };
                setTimeout(() => generateCashPdf(closedSession), 150);
                setShowCloseSession(false);
              }}
                style={{ ...btnPrimary, flex: 1, justifyContent: 'center', color: '#f59e0b', borderColor: 'rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.1)' }}>Chiudi e scarica PDF</button>
            </div>
          </div>
        </div>
      )}

      {/* New Payment modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl p-6" style={{ background: '#18181f', border: '1px solid #2e2e40' }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-white">Nuovo incasso</h3>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div className="space-y-3">
              {/* Link to appointment */}
              <div>
                <label style={labelStyle}>Carica da appuntamento (opzionale)</label>
                <select onChange={e => loadAppointment(e.target.value)} style={inputStyle}>
                  <option value="">— Seleziona appuntamento —</option>
                    {todayAppts.map(a => {
                      const c = clients.find(cl => cl.id === a.clientId);
                      return <option key={a.id} value={a.id}>{a.startTime} – {c ? `${c.firstName} ${c.lastName}` : 'Cliente'}</option>;
                    })}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={labelStyle}>Cliente</label>
                  <select value={form.clientId} onChange={e => {
                    const c = clients.find(cl => cl.id === e.target.value);
                    setForm(p => ({ ...p, clientId: e.target.value, clientName: c ? `${c.firstName} ${c.lastName}` : '' }));
                  }} style={inputStyle}>
                    <option value="">— Seleziona —</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Operatore</label>
                  <select value={form.operatorId} onChange={e => setForm(p => ({ ...p, operatorId: e.target.value }))} style={inputStyle}>
                    <option value="">—</option>
                    {operators.filter(o => o.active).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
              </div>
              <div><label style={labelStyle}>Data</label><input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} style={inputStyle} /></div>

              {/* Items */}
              <div>
                <label style={labelStyle}>Servizi / Prodotti</label>
                <div className="flex gap-2 mb-2">
                  <select value={newItemServiceId} onChange={e => setNewItemServiceId(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                    <option value="">— Aggiungi servizio —</option>
                    {services.filter(s => s.active).map(s => <option key={s.id} value={s.id}>{s.name} ({s.duration}') — {formatCurrency(s.price)}</option>)}
                  </select>
                  <button onClick={addManualItem} style={{ ...btnPrimary, flexShrink: 0 }}><Plus size={14} /></button>
                </div>
                {form.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm py-1.5 px-2 rounded-lg mb-1" style={{ background: '#12121a', border: '1px solid #2e2e40' }}>
                    <span style={{ color: '#d4d4d8' }}>{item.serviceName}</span>
                    <div className="flex items-center gap-3">
                      <input type="number" min={0} step={0.01} value={item.price}
                        onChange={e => setForm(p => ({ ...p, items: p.items.map((it, j) => j === i ? { ...it, price: parseFloat(e.target.value) || 0 } : it) }))}
                        style={{ ...inputStyle, width: 80, padding: '4px 8px' }} />
                      <button onClick={() => setForm(p => ({ ...p, items: p.items.filter((_, j) => j !== i) }))}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><X size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Discount */}
              <div className="grid grid-cols-2 gap-3">
                <div><label style={labelStyle}>Sconto %</label><input type="number" min={0} max={100} value={form.discountPct} onChange={e => setForm(p => ({ ...p, discountPct: parseFloat(e.target.value) || 0, discountEur: 0 }))} style={inputStyle} /></div>
                <div><label style={labelStyle}>Sconto €</label><input type="number" min={0} step={0.01} value={form.discountEur} onChange={e => setForm(p => ({ ...p, discountEur: parseFloat(e.target.value) || 0, discountPct: 0 }))} style={inputStyle} /></div>
              </div>

              {/* Total preview */}
              <div className="flex justify-between text-sm px-1" style={{ color: '#a1a1aa' }}>
                <span>Subtotale</span><span>{formatCurrency(formSubtotal)}</span>
              </div>
              {formDiscount > 0 && <div className="flex justify-between text-sm px-1" style={{ color: '#f59e0b' }}><span>Sconto</span><span>-{formatCurrency(formDiscount)}</span></div>}
              <div className="flex justify-between font-bold px-1" style={{ color: '#22c55e', fontSize: 15, borderTop: '1px solid #2e2e40', paddingTop: 8 }}>
                <span>Totale</span><span>{formatCurrency(formTotal)}</span>
              </div>

              {/* Payment method */}
              <div>
                <label style={labelStyle}>Metodo di pagamento</label>
                <div className="flex gap-2 flex-wrap">
                  {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map(m => (
                    <button key={m} onClick={() => setForm(p => ({ ...p, paymentMethod: m }))}
                      className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg"
                      style={{ background: form.paymentMethod === m ? 'rgba(99,102,241,0.2)' : '#12121a', border: `1px solid ${form.paymentMethod === m ? 'rgba(99,102,241,0.5)' : '#2e2e40'}`, color: form.paymentMethod === m ? '#818cf8' : '#71717a', cursor: 'pointer' }}>
                      {METHOD_ICONS[m]} {PAYMENT_METHOD_LABELS[m]}
                    </button>
                  ))}
                </div>
              </div>

              {form.paymentMethod === 'mixed' && (
                <div className="grid grid-cols-2 gap-3">
                  <div><label style={labelStyle}>Contanti (€)</label><input type="number" min={0} step={0.01} value={form.cashAmount} onChange={e => setForm(p => ({ ...p, cashAmount: parseFloat(e.target.value) || 0 }))} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Carta (€)</label><input type="number" min={0} step={0.01} value={form.cardAmount} onChange={e => setForm(p => ({ ...p, cardAmount: parseFloat(e.target.value) || 0 }))} style={inputStyle} /></div>
                </div>
              )}

              {(form.paymentMethod === 'gift_card' || form.paymentMethod === 'mixed') && (
                <div className="grid grid-cols-2 gap-3">
                  <div><label style={labelStyle}>Codice gift card</label><input value={form.giftCardCode} onChange={e => setForm(p => ({ ...p, giftCardCode: e.target.value }))} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Importo gift card (€)</label><input type="number" min={0} step={0.01} value={form.giftCardAmount} onChange={e => setForm(p => ({ ...p, giftCardAmount: parseFloat(e.target.value) || 0 }))} style={inputStyle} /></div>
                </div>
              )}

              <div><label style={labelStyle}>Note</label><input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} style={inputStyle} /></div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowForm(false)} style={{ background: '#12121a', border: '1px solid #2e2e40', color: '#71717a', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', cursor: 'pointer' }}>Annulla</button>
              <button onClick={handleSave} disabled={form.items.length === 0} style={{ ...btnPrimary, opacity: form.items.length === 0 ? 0.4 : 1 }}>Registra incasso</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
