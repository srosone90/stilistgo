'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSalon } from '@/context/SalonContext';
import { OnlineBooking, dbGetOnlineBookings, dbUpdateBookingStatus, dbDeleteBooking } from '@/lib/salonDb';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { RefreshCw, CheckCircle2, XCircle, Trash2, ExternalLink, Clock, Phone, Mail, Scissors, CalendarPlus } from 'lucide-react';
import { getCurrentUser } from '@/lib/supabase';

import { useNotifications } from '@/context/NotificationContext';

const card: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px' };

const STATUS_STYLES: Record<string, React.CSSProperties> = {
  pending:   { background: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)' },
  confirmed: { background: 'rgba(34,197,94,0.15)',  color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)'  },
  cancelled: { background: 'rgba(239,68,68,0.1)',   color: '#f87171', border: '1px solid rgba(239,68,68,0.2)'  },
};
const STATUS_LABELS: Record<string, string> = {
  pending: '⏳ In attesa', confirmed: '✅ Confermata', cancelled: '❌ Annullata',
};

export default function OnlineBookingsView() {
  const { addAppointment, clients, addClient, services, importPendingBookings } = useSalon();
  const { realtimeBookingTick } = useNotifications();
  const [bookings, setBookings] = useState<OnlineBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed' | 'cancelled'>('all');
  const [converting, setConverting] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>('');

  useEffect(() => {
    getCurrentUser().then(u => { if (u) setUserId(u.id as string); });
  }, []);

  const bookingUrl = typeof window !== 'undefined' && userId
    ? `${window.location.origin}/booking/${userId}`
    : '';

  // load() fetches bookings for display only. Auto-import happens in SalonContext.loadCloud()
  // (with deduplication + WA confirm). Running addAppointment here on every load() call
  // caused duplicate appointments and double WA when the user clicked "Aggiorna".
  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const data = await dbGetOnlineBookings(userId);
    setBookings(data);
    setLoading(false);
  }, [userId]);

  // Re-load display list AND import into calendar when real-time tick fires
  useEffect(() => {
    load();
    if (realtimeBookingTick > 0) importPendingBookings();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, realtimeBookingTick]);

  const handleConfirm = async (id: string) => {
    await dbUpdateBookingStatus(id, 'confirmed');
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'confirmed' } : b));
  };

  const handleCancel = async (id: string) => {
    await dbUpdateBookingStatus(id, 'cancelled');
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'cancelled' } : b));
  };

  const handleDelete = async (id: string) => {
    await dbDeleteBooking(id);
    setBookings(prev => prev.filter(b => b.id !== id));
  };

  const handleConvertToAppointment = (b: OnlineBooking) => {
    setConverting(b.id);
    // Find or create client
    const existingClient = clients.find(c =>
      c.phone === b.client_phone ||
      (b.client_email && c.email === b.client_email)
    );
    let clientId = existingClient?.id;
    if (!clientId) {
      const [firstName, ...rest] = b.client_name.trim().split(' ');
      clientId = addClient({
        firstName: firstName || b.client_name,
        lastName: rest.join(' ') || '',
        phone: b.client_phone,
        email: b.client_email,
        birthDate: '', notes: `Prenotato online il ${format(parseISO(b.created_at), 'dd/MM/yyyy')}`,
        allergies: '', tags: [], gdprConsent: false, gdprDate: '', loyaltyPoints: 0,
      });
    }
    // Find matching service
    const matchedService = services.find(s =>
      s.name.toLowerCase().includes(b.service.toLowerCase()) ||
      b.service.toLowerCase().includes(s.name.toLowerCase())
    );
    const dur = matchedService?.duration ?? 60;
    const [hh, mm] = b.preferred_time.split(':').map(Number);
    const endMin = hh * 60 + mm + dur;
    const calcEndTime = `${String(Math.floor(endMin / 60) % 24).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
    addAppointment({
      clientId,
      operatorId: '',
      serviceIds: matchedService ? [matchedService.id] : [],
      date: b.preferred_date,
      startTime: b.preferred_time,
      endTime: calcEndTime,
      status: 'confirmed',
      notes: `Prenotazione online: ${b.service}${b.notes ? ` — ${b.notes}` : ''}`,
      isBlock: false,
      blockReason: '',
      recurringGroupId: '',
      feedbackScore: 0,
    });
    dbUpdateBookingStatus(b.id, 'confirmed');
    setBookings(prev => prev.map(x => x.id === b.id ? { ...x, status: 'confirmed' } : x));
    setConverting(null);
  };

  const visible = bookings.filter(b => filter === 'all' || b.status === filter);
  const pendingCount = bookings.filter(b => b.status === 'pending').length;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Prenotazioni Online</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            Gestisci le richieste ricevute tramite il link pubblico
          </p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer' }}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Aggiorna
        </button>
      </div>

      {/* Link pubblico */}
      <div style={{ ...card, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)' }}>
        <p className="text-sm font-semibold text-white mb-1">🔗 Link prenotazione da condividere</p>
        <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
          Invia questo link ai tuoi clienti (WhatsApp, Instagram, sito web…)
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs px-3 py-2 rounded-lg truncate" style={{ background: 'var(--bg-input)', color: 'var(--accent-light)', border: '1px solid var(--border)' }}>
            {bookingUrl}
          </code>
          <button onClick={() => navigator.clipboard.writeText(bookingUrl)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
            style={{ background: 'rgba(99,102,241,0.2)', color: 'var(--accent-light)', border: '1px solid rgba(99,102,241,0.3)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <ExternalLink size={12} /> Copia link
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'In attesa',  value: bookings.filter(b => b.status === 'pending').length,   color: '#fbbf24' },
          { label: 'Confermate', value: bookings.filter(b => b.status === 'confirmed').length,  color: '#4ade80' },
          { label: 'Annullate',  value: bookings.filter(b => b.status === 'cancelled').length,  color: '#f87171' },
        ].map(s => (
          <div key={s.label} style={card} className="text-center">
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(['all', 'pending', 'confirmed', 'cancelled'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium"
            style={filter === f
              ? { background: 'rgba(99,102,241,0.2)', color: 'var(--accent-light)', border: '1px solid rgba(99,102,241,0.4)' }
              : { background: 'var(--bg-input)', color: 'var(--muted)', border: '1px solid var(--border)', cursor: 'pointer' }}>
            {f === 'all' ? `Tutte (${bookings.length})` : f === 'pending' ? `In attesa${pendingCount > 0 ? ` (${pendingCount})` : ''}` : f === 'confirmed' ? 'Confermate' : 'Annullate'}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <p className="text-center py-12 text-sm" style={{ color: 'var(--muted)' }}>Caricamento...</p>
      ) : visible.length === 0 ? (
        <p className="text-center py-12 text-sm" style={{ color: 'var(--muted)' }}>
          {filter === 'all' ? 'Nessuna prenotazione ricevuta ancora.' : 'Nessuna prenotazione in questa categoria.'}
        </p>
      ) : (
        <div className="space-y-3">
          {visible.map(b => (
            <div key={b.id} style={card}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-white">{b.client_name}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={STATUS_STYLES[b.status]}>
                      {STATUS_LABELS[b.status]}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs" style={{ color: 'var(--muted)' }}>
                    <span className="flex items-center gap-1"><Phone size={10} /> {b.client_phone}</span>
                    {b.client_email && <span className="flex items-center gap-1"><Mail size={10} /> {b.client_email}</span>}
                    <span className="flex items-center gap-1">
                      <Clock size={10} /> {format(parseISO(b.created_at), 'dd/MM/yyyy HH:mm', { locale: it })}
                    </span>
                  </div>
                </div>
                <button onClick={() => handleDelete(b.id)}
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', borderRadius: '8px', padding: '6px', cursor: 'pointer' }}>
                  <Trash2 size={13} />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="rounded-lg px-3 py-2" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
                  <p className="text-xs mb-0.5" style={{ color: 'var(--muted)' }}>Servizio</p>
                  <p className="text-sm font-medium text-white flex items-center gap-1"><Scissors size={11} style={{ color: 'var(--accent-light)' }} />{b.service}</p>
                </div>
                <div className="rounded-lg px-3 py-2" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
                  <p className="text-xs mb-0.5" style={{ color: 'var(--muted)' }}>Data</p>
                  <p className="text-sm font-medium text-white">{b.preferred_date}</p>
                </div>
                <div className="rounded-lg px-3 py-2" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
                  <p className="text-xs mb-0.5" style={{ color: 'var(--muted)' }}>Ora</p>
                  <p className="text-sm font-medium text-white">{b.preferred_time}</p>
                </div>
              </div>

              {b.notes && (
                <p className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-3)' }}>
                  📝 {b.notes}
                </p>
              )}

              {b.status === 'pending' && (
                <div className="flex gap-2">
                  <button onClick={() => handleConvertToAppointment(b)} disabled={converting === b.id}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
                    style={{ background: 'rgba(99,102,241,0.2)', color: 'var(--accent-light)', border: '1px solid rgba(99,102,241,0.3)', cursor: 'pointer' }}>
                    <CalendarPlus size={12} /> {converting === b.id ? 'Conversione...' : 'Converti in appuntamento'}
                  </button>
                  <button onClick={() => handleConfirm(b.id)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
                    style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)', cursor: 'pointer' }}>
                    <CheckCircle2 size={12} /> Conferma
                  </button>
                  <button onClick={() => handleCancel(b.id)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
                    style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer' }}>
                    <XCircle size={12} /> Rifiuta
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
