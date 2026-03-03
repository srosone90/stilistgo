'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard, Users, Ticket, Megaphone, Flag, ScrollText, LogOut,
  ShieldCheck, TrendingUp, AlertTriangle, CheckCircle2, XCircle, Clock,
  ChevronRight, Plus, Search, X, Save, RefreshCw, ToggleLeft, ToggleRight,
  Building2, Phone, Mail, MapPin, UserCog, Calendar as CalendarIcon, Trash2,
  MessageSquare, Wifi, WifiOff, ArrowUpRight, Send, Star, Zap, Check,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type Section = 'overview' | 'tenants' | 'tickets' | 'broadcasts' | 'flags' | 'audit' | 'whatsapp' | 'sales';

interface Metrics {
  total: number; active: number; trial: number; suspended: number; cancelled: number;
  mrr: number; arr: number;
  byPlan: Record<string, number>; regByMonth: Record<string, number>;
  atRisk: number; openTickets: number; urgentTickets: number; broadcasts: number;
}

interface Tenant {
  user_id: string; email: string; full_name: string; salon_name: string;
  plan: string; monthly_price: number; trial_ends_at: string | null;
  status: string; region: string; sector: string; notes: string; csm: string;
  registered_at: string; last_seen_at: string | null;
  clients_count: number; appointments_count: number; operators_count: number;
  services_count: number; last_sync: string; phone: string; vat_number: string;
  is_admin: boolean;
  online_bookings_30d: number;
}

interface Ticket {
  id: string; tenant_id: string; tenant_name: string; subject: string; body: string;
  category: string; priority: string; status: string; assigned_to: string;
  resolution: string; created_at: string; updated_at: string;
}

interface Broadcast { id: string; title: string; body: string; target: string; created_at: string; }
interface Flag { id: string; name: string; description: string; enabled_for: string; enabled: boolean; created_at: string; }
interface AuditEntry { id: string; action: string; target_tenant: string; details: Record<string, unknown>; created_at: string; }

interface AnalyticsData {
  monthlyRevenue: { month: string; total: number }[];
  topServices: { name: string; count: number; revenue: number }[];
  paymentBreakdown: { method: string; total: number }[];
  totalRevenue: number;
  giftCardsCount: number;
  giftCardsActive: number;
  onlineBookings30d: number;
  onlineBookingsPending: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const fmtDT = (d: string | null) => d ? new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const STATUS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  trial:     { bg: 'rgba(245,158,11,0.15)', text: '#fbbf24', border: 'rgba(245,158,11,0.4)', label: 'Trial' },
  active:    { bg: 'rgba(34,197,94,0.15)',  text: '#4ade80', border: 'rgba(34,197,94,0.4)',  label: 'Attivo' },
  suspended: { bg: 'rgba(239,68,68,0.1)',   text: '#f87171', border: 'rgba(239,68,68,0.3)',  label: 'Sospeso' },
  cancelled: { bg: 'rgba(113,113,122,0.1)', text: '#71717a', border: 'rgba(113,113,122,0.2)', label: 'Cancellato' },
};
const PLAN: Record<string, { bg: string; text: string; label: string }> = {
  trial:    { bg: 'rgba(245,158,11,0.1)',  text: '#fbbf24', label: 'Trial' },
  starter:  { bg: 'rgba(99,102,241,0.1)',  text: '#818cf8', label: 'Starter' },
  pro:      { bg: 'rgba(168,85,247,0.1)',  text: '#c084fc', label: 'Pro' },
  business: { bg: 'rgba(34,197,94,0.1)',   text: '#4ade80', label: 'Business' },
};
const PRIO: Record<string, { text: string; label: string }> = {
  bassa: { text: '#71717a', label: 'Bassa' }, normale: { text: '#818cf8', label: 'Normale' },
  alta:  { text: '#fbbf24', label: 'Alta' },  urgente: { text: '#f87171', label: 'Urgente' },
};
const TK_STATUS: Record<string, { bg: string; text: string; label: string }> = {
  aperto:        { bg: 'rgba(239,68,68,0.1)',   text: '#f87171', label: 'Aperto' },
  in_lavorazione:{ bg: 'rgba(245,158,11,0.1)',  text: '#fbbf24', label: 'In lavorazione' },
  risolto:       { bg: 'rgba(34,197,94,0.1)',   text: '#4ade80', label: 'Risolto' },
  chiuso:        { bg: 'rgba(113,113,122,0.1)', text: '#71717a', label: 'Chiuso' },
};

const PLAN_PRICES: Record<string, number> = { trial: 0, starter: 25, pro: 49, business: 99 };

const ACTION_LABELS: Record<string, string> = {
  tenant_updated: 'Tenant aggiornato', ticket_created: 'Ticket creato',
  broadcast_sent: 'Broadcast inviato', flag_toggled: 'Flag modificato',
  tenant_deleted: 'Tenant eliminato',
};

// ─── Styled helpers ───────────────────────────────────────────────────────────

const inp = (extra?: React.CSSProperties): React.CSSProperties => ({
  width: '100%', background: '#12121a', border: '1px solid #2e2e40', borderRadius: '10px',
  padding: '9px 12px', color: '#f4f4f5', fontSize: '13px', outline: 'none',
  boxSizing: 'border-box', ...extra,
});
const sel = (extra?: React.CSSProperties): React.CSSProperties => ({
  ...inp(extra), cursor: 'pointer', appearance: 'none' as const,
});
const card = (extra?: React.CSSProperties): React.CSSProperties => ({
  background: '#1c1c27', border: '1px solid #2e2e40', borderRadius: '16px', padding: '20px', ...extra,
});

function Badge({ s, map }: { s: string; map: Record<string, { bg: string; text: string; border?: string; label: string }> }) {
  const c = map[s] ?? { bg: 'rgba(113,113,122,0.1)', text: '#71717a', label: s };
  return (
    <span style={{ background: c.bg, color: c.text, border: `1px solid ${c.border ?? 'transparent'}`, borderRadius: '6px', padding: '2px 8px', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap' }}>
      {c.label}
    </span>
  );
}

function KpiCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={card({ padding: '18px 20px' })}>
      <p style={{ color: '#71717a', fontSize: '12px', margin: 0, marginBottom: '6px' }}>{label}</p>
      <p style={{ color: color ?? '#f4f4f5', fontSize: '26px', fontWeight: 700, margin: 0 }}>{value}</p>
      {sub && <p style={{ color: '#71717a', fontSize: '11px', margin: 0, marginTop: '4px' }}>{sub}</p>}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [section, setSection] = useState<Section>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Data
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // Tenant detail modal
  const [selTenant, setSelTenant] = useState<Tenant | null>(null);
  const [editTenant, setEditTenant] = useState<Partial<Tenant>>({});
  const [savingTenant, setSavingTenant] = useState(false);
  const [confirmDeleteTenant, setConfirmDeleteTenant] = useState(false);
  const [deleteDataToo, setDeleteDataToo] = useState(false);
  const [deletingTenant, setDeletingTenant] = useState(false);

  // Ticket modal
  const [selTicket, setSelTicket] = useState<Ticket | null>(null);
  const [newTicket, setNewTicket] = useState(false);
  const [ticketForm, setTicketForm] = useState<Partial<Ticket>>({});

  // Broadcast modal
  const [newBcast, setNewBcast] = useState(false);
  const [bcastForm, setBcastForm] = useState({ title: '', body: '', target: 'all' });

  // Flag new modal
  const [newFlag, setNewFlag] = useState(false);
  const [flagForm, setFlagForm] = useState({ name: '', description: '', enabled_for: 'all' });

  // Search
  const [tenantSearch, setTenantSearch] = useState('');
  const [tenantPlanFilter, setTenantPlanFilter] = useState('');
  const [tenantStatusFilter, setTenantStatusFilter] = useState('');
  const [ticketStatusFilter, setTicketStatusFilter] = useState('');

  // WhatsApp istanze
  const [waSearch, setWaSearch] = useState('');
  const [waModal, setWaModal] = useState<Tenant | null>(null);
  const [waForm, setWaForm] = useState({ ultraMsgInstanceId: '', ultraMsgToken: '' });
  const [waSaving, setWaSaving] = useState(false);
  const [waSaved, setWaSaved] = useState(false);
  const [waStatuses, setWaStatuses] = useState<Record<string, 'connected' | 'disconnected' | 'none'>>({});
  const [waQrCodes, setWaQrCodes] = useState<Record<string, string | null>>({});
  const [waInstances, setWaInstances] = useState<Record<string, string>>({});

  // Analytics / impersonation / WA test
  const [selTenantTab, setSelTenantTab] = useState<'info' | 'analytics'>('info');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [impersonating, setImpersonating] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  function getToken() { return sessionStorage.getItem('stylistgo_admin_token') ?? ''; }

  const af = useCallback(async (url: string, opts?: RequestInit) => {
    const token = getToken();
    return fetch(url, {
      ...opts,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts?.headers ?? {}) },
    });
  }, []);

  // Auth check
  useEffect(() => {
    af('/api/admin/auth').then(r => {
      if (r.ok) { setAuthed(true); }
      else { router.replace('/admin/login'); }
    }).catch(() => router.replace('/admin/login'));
  }, [af, router]);

  // Load data for current section
  const loadSection = useCallback(async (s: Section) => {
    setLoading(true);
    try {
      if (s === 'overview') {
        const [m, t] = await Promise.all([af('/api/admin/metrics'), af('/api/admin/tenants')]);
        const [md, td] = await Promise.all([m.json(), t.json()]);
        setMetrics(md);
        setTenants(td.tenants ?? []);
      } else if (s === 'tenants') {
        const res = await af('/api/admin/tenants');
        const d = await res.json();
        setTenants(d.tenants ?? []);
      } else if (s === 'tickets') {
        const res = await af('/api/admin/tickets');
        const d = await res.json();
        setTickets(d.tickets ?? []);
        // Also load tenants for select
        const tr = await af('/api/admin/tenants');
        const td = await tr.json();
        setTenants(td.tenants ?? []);
      } else if (s === 'broadcasts') {
        const res = await af('/api/admin/broadcasts');
        const d = await res.json();
        setBroadcasts(d.broadcasts ?? []);
      } else if (s === 'flags') {
        const res = await af('/api/admin/flags');
        const d = await res.json();
        setFlags(d.flags ?? []);
      } else if (s === 'audit') {
        const res = await af('/api/admin/audit?limit=100');
        const d = await res.json();
        setAudit(d.entries ?? []);
      } else if (s === 'whatsapp') {
        const res = await af('/api/admin/tenants');
        const d = await res.json();
        const list: Tenant[] = d.tenants ?? [];
        setTenants(list);
        // Bulk-check WA status for all tenants in parallel
        await Promise.all(list.map(async (t) => {
          try {
            const r = await af(`/api/admin/whatsapp?user_id=${t.user_id}`);
            if (!r.ok) return;
            const creds = await r.json();
            if (creds.ultraMsgInstanceId && creds.ultraMsgToken) {
              setWaInstances(p => ({ ...p, [t.user_id]: creds.ultraMsgInstanceId }));
              const sr = await fetch(`/api/ultramsg/status?instanceId=${creds.ultraMsgInstanceId}&token=${creds.ultraMsgToken}`);
              const sd = await sr.json();
              setWaStatuses(p => ({ ...p, [t.user_id]: sd.connected ? 'connected' : 'disconnected' }));
              setWaQrCodes(p => ({ ...p, [t.user_id]: sd.qrCode ?? null }));
            }
          } catch { /* ignore per tenant */ }
        }));
      }
    } finally { setLoading(false); }
  }, [af]);

  useEffect(() => { if (authed) loadSection(section); }, [authed, section, loadSection]);

  const changeSection = (s: Section) => { setSection(s); setSelTenant(null); setSelTicket(null); };

  const logout = () => { sessionStorage.removeItem('stylistgo_admin_token'); router.replace('/admin/login'); };

  // ─── Analytics + impersonation + WA test ────────────────────────────────
  const loadAnalytics = useCallback(async (userId: string) => {
    setAnalyticsLoading(true);
    setAnalyticsData(null);
    const res = await af(`/api/admin/tenant-analytics?user_id=${userId}`);
    const d = await res.json();
    setAnalyticsData(d);
    setAnalyticsLoading(false);
  }, [af]);

  const impersonateTenant = useCallback(async (tenant: Tenant) => {
    setImpersonating(true);
    const res = await af('/api/admin/impersonate', { method: 'POST', body: JSON.stringify({ user_id: tenant.user_id }) });
    const d = await res.json();
    setImpersonating(false);
    if (d.url) {
      window.open(d.url, '_blank');
    } else {
      alert(`Errore: ${d.error}`);
    }
  }, [af]);

  const sendWaTest = useCallback(async () => {
    if (!waModal || !testPhone || !waForm.ultraMsgInstanceId || !waForm.ultraMsgToken) return;
    setTestSending(true);
    setTestResult(null);
    const res = await fetch('/api/ultramsg/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instanceId: waForm.ultraMsgInstanceId,
        token: waForm.ultraMsgToken,
        to: testPhone,
        message: `✅ Messaggio di test da Stylistgo Admin — ${waModal.salon_name}`,
      }),
    });
    const d = await res.json();
    setTestResult({ ok: d.success, msg: d.success ? 'Inviato! Verifica il telefono.' : (d.error ?? 'Errore invio') });
    setTestSending(false);
  }, [waModal, testPhone, waForm]);

  if (!authed) return null;

  // ─── Tenant save ──────────────────────────────────────────────────────────
  const saveTenant = async () => {
    if (!selTenant) return;
    setSavingTenant(true);
    try {
      const res = await af('/api/admin/tenants', { method: 'PATCH', body: JSON.stringify({ user_id: selTenant.user_id, ...editTenant }) });
      const data = await res.json();
      if (!res.ok) {
        alert(`Errore salvataggio: ${data.error ?? res.status}`);
        return;
      }
      setSelTenant(null);
      loadSection('tenants');
    } catch (err) {
      alert(`Errore di rete: ${err}`);
    } finally {
      setSavingTenant(false);
    }
  };

  // ─── Tenant delete ────────────────────────────────────────────────────────
  const deleteTenant = async () => {
    if (!selTenant) return;
    setDeletingTenant(true);
    try {
      const res = await af('/api/admin/tenants', { method: 'DELETE', body: JSON.stringify({ user_id: selTenant.user_id, delete_data: deleteDataToo }) });
      const data = await res.json();
      if (!res.ok) {
        alert(`Errore eliminazione: ${data.error ?? res.status}`);
        return;
      }
      setConfirmDeleteTenant(false);
      setDeleteDataToo(false);
      setSelTenant(null);
      loadSection('tenants');
    } catch (err) {
      alert(`Errore di rete: ${err}`);
    } finally {
      setDeletingTenant(false);
    }
  };

  // ─── Ticket save ─────────────────────────────────────────────────────────
  const saveTicket = async () => {
    if (selTicket) {
      await af('/api/admin/tickets', { method: 'PATCH', body: JSON.stringify({ id: selTicket.id, ...ticketForm }) });
    } else {
      await af('/api/admin/tickets', { method: 'POST', body: JSON.stringify(ticketForm) });
    }
    setSelTicket(null); setNewTicket(false);
    loadSection('tickets');
  };

  // ─── Broadcast send ───────────────────────────────────────────────────────
  const sendBroadcast = async () => {
    await af('/api/admin/broadcasts', { method: 'POST', body: JSON.stringify(bcastForm) });
    setNewBcast(false); setBcastForm({ title: '', body: '', target: 'all' });
    loadSection('broadcasts');
  };

  // ─── Flag toggle ──────────────────────────────────────────────────────────
  const toggleFlag = async (flag: Flag) => {
    await af('/api/admin/flags', { method: 'PATCH', body: JSON.stringify({ id: flag.id, enabled: !flag.enabled }) });
    setFlags(prev => prev.map(f => f.id === flag.id ? { ...f, enabled: !f.enabled } : f));
  };

  const createFlag = async () => {
    await af('/api/admin/flags', { method: 'POST', body: JSON.stringify(flagForm) });
    setNewFlag(false); setFlagForm({ name: '', description: '', enabled_for: 'all' });
    loadSection('flags');
  };

  // ─── Filtered lists ───────────────────────────────────────────────────────
  const filteredTenants = tenants.filter(t => {
    const q = tenantSearch.toLowerCase();
    const matchQ = !q || t.salon_name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q) || t.full_name.toLowerCase().includes(q);
    const matchPlan = !tenantPlanFilter || t.plan === tenantPlanFilter;
    const matchStatus = !tenantStatusFilter || t.status === tenantStatusFilter;
    return matchQ && matchPlan && matchStatus;
  });

  const filteredTickets = tickets.filter(t => !ticketStatusFilter || t.status === ticketStatusFilter);

  // ─── SIDEBAR ─────────────────────────────────────────────────────────────
  const navItems: { id: Section; icon: React.ReactNode; label: string; count?: number }[] = [
    { id: 'overview', icon: <LayoutDashboard size={18} />, label: 'Overview' },
    { id: 'tenants', icon: <Users size={18} />, label: 'Tenant', count: metrics?.total },
    { id: 'tickets', icon: <Ticket size={18} />, label: 'Ticket', count: metrics?.openTickets },
    { id: 'broadcasts', icon: <Megaphone size={18} />, label: 'Broadcast' },
    { id: 'flags', icon: <Flag size={18} />, label: 'Feature Flag' },
    { id: 'audit', icon: <ScrollText size={18} />, label: 'Audit Log' },
    { id: 'whatsapp', icon: <MessageSquare size={18} />, label: 'WhatsApp' },
    { id: 'sales', icon: <Star size={18} />, label: 'Vendita 💰' },
  ];

  // ─── OVERVIEW ────────────────────────────────────────────────────────────
  const OverviewSection = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <h2 style={{ color: '#f4f4f5', fontWeight: 700, fontSize: '20px', margin: 0 }}>Panoramica SaaS</h2>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: '12px' }}>
        <KpiCard label="Tenant totali" value={metrics?.total ?? '—'} />
        <KpiCard label="Attivi" value={metrics?.active ?? '—'} color="#4ade80" />
        <KpiCard label="Trial" value={metrics?.trial ?? '—'} color="#fbbf24" />
        <KpiCard label="MRR stimato" value={metrics ? `€${metrics.mrr.toLocaleString('it-IT', { minimumFractionDigits: 0 })}` : '—'} color="#818cf8" sub={metrics ? `ARR €${metrics.arr.toLocaleString('it-IT')}` : undefined} />
        <KpiCard label="Ticket aperti" value={metrics?.openTickets ?? '—'} color={metrics?.urgentTickets ? '#f87171' : undefined} sub={metrics?.urgentTickets ? `${metrics.urgentTickets} urgenti` : undefined} />
        <KpiCard label="A rischio churn" value={metrics?.atRisk ?? '—'} color={metrics?.atRisk ? '#f59e0b' : undefined} />
      </div>

      {/* Plans + recent registrations */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div style={card()}>
          <p style={{ color: '#71717a', fontSize: '12px', margin: '0 0 12px' }}>Tenant per piano</p>
          {metrics && Object.entries(metrics.byPlan).map(([plan, n]) => (
            <div key={plan} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <Badge s={plan} map={PLAN} />
              <span style={{ color: '#f4f4f5', fontWeight: 600, fontSize: '14px' }}>{n}</span>
            </div>
          ))}
        </div>
        <div style={card()}>
          <p style={{ color: '#71717a', fontSize: '12px', margin: '0 0 12px' }}>Nuove registrazioni (6 mesi)</p>
          {metrics && Object.entries(metrics.regByMonth).sort().map(([month, n]) => (
            <div key={month} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: '#a1a1aa', fontSize: '12px' }}>{month}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ height: '6px', borderRadius: '3px', background: '#818cf8', width: `${Math.min(100, n * 20)}px` }} />
                <span style={{ color: '#f4f4f5', fontWeight: 600, fontSize: '13px', minWidth: '20px' }}>{n}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* At-risk tenants */}
      {tenants.filter(t => {
        if (t.status === 'cancelled') return false;
        const now = Date.now();
        if (t.trial_ends_at && new Date(t.trial_ends_at).getTime() - now < 3 * 86400000 && new Date(t.trial_ends_at).getTime() > now) return true;
        if (t.last_seen_at && now - new Date(t.last_seen_at).getTime() > 14 * 86400000) return true;
        return false;
      }).length > 0 && (
        <div style={card()}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <AlertTriangle size={16} style={{ color: '#f59e0b' }} />
            <p style={{ color: '#f4f4f5', fontSize: '14px', fontWeight: 600, margin: 0 }}>Tenant a rischio</p>
          </div>
          {tenants.filter(t => {
            if (t.status === 'cancelled') return false;
            const now = Date.now();
            if (t.trial_ends_at && new Date(t.trial_ends_at).getTime() - now < 3 * 86400000 && new Date(t.trial_ends_at).getTime() > now) return true;
            if (t.last_seen_at && now - new Date(t.last_seen_at).getTime() > 14 * 86400000) return true;
            return false;
          }).slice(0, 5).map(t => (
            <div key={t.user_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #2e2e40' }}>
              <div>
                <p style={{ color: '#f4f4f5', fontSize: '13px', fontWeight: 600, margin: 0 }}>{t.salon_name}</p>
                <p style={{ color: '#71717a', fontSize: '11px', margin: 0 }}>Ultimo accesso: {fmtDate(t.last_seen_at)}</p>
              </div>
              <button onClick={() => { changeSection('tenants'); setTimeout(() => { setSelTenant(t); setEditTenant({ ...t }); setConfirmDeleteTenant(false); setDeleteDataToo(false); setSelTenantTab('info'); setAnalyticsData(null); }, 100); }}
                  style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', fontSize: '12px' }}>
                        Dettaglio <ChevronRight size={12} style={{ display: 'inline' }} />
                      </button>
            </div>
          ))}
        </div>
      )}

      {/* Recent audit */}
      <div style={card()}>
        <p style={{ color: '#71717a', fontSize: '12px', margin: '0 0 12px' }}>Ultime azioni admin</p>
        {audit.slice(0, 5).map(e => (
          <div key={e.id} style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #1e1e2a' }}>
            <ScrollText size={13} style={{ color: '#71717a', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: '#f4f4f5', fontSize: '12px', margin: 0 }}>{ACTION_LABELS[e.action] ?? e.action}</p>
              {e.target_tenant && <p style={{ color: '#71717a', fontSize: '11px', margin: 0 }}>{e.target_tenant.slice(0, 16)}</p>}
            </div>
            <p style={{ color: '#3f3f5a', fontSize: '11px', margin: 0 }}>{fmtDT(e.created_at)}</p>
          </div>
        ))}
        {audit.length === 0 && <p style={{ color: '#3f3f5a', fontSize: '12px' }}>Nessuna azione registrata.</p>}
      </div>
    </div>
  );

  // ─── TENANT DETAIL MODAL ─────────────────────────────────────────────────
  const TenantModal = () => {
    if (!selTenant) return null;
    const t = selTenant;
    const e = editTenant;
    const set = (k: keyof Tenant, v: unknown) => setEditTenant(prev => ({ ...prev, [k]: v }));

    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }} onClick={() => { setSelTenant(null); setConfirmDeleteTenant(false); setDeleteDataToo(false); }}>
        <div style={{ width: '520px', height: '100vh', overflowY: 'auto', background: '#1c1c27', borderLeft: '1px solid #2e2e40', padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }} onClick={ev => ev.stopPropagation()}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <p style={{ color: '#f4f4f5', fontSize: '18px', fontWeight: 700, margin: 0 }}>{t.salon_name}</p>
              <p style={{ color: '#71717a', fontSize: '12px', margin: '4px 0 8px' }}>{t.user_id}</p>
              <div style={{ display: 'flex', gap: '6px' }}>
                <Badge s={t.status} map={STATUS} />
                <Badge s={t.plan} map={PLAN} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
              <button onClick={() => { setSelTenant(null); setConfirmDeleteTenant(false); setDeleteDataToo(false); setSelTenantTab('info'); setAnalyticsData(null); }} style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', padding: '4px' }}><X size={18} /></button>
              <button onClick={() => impersonateTenant(t)} disabled={impersonating}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.35)', background: 'rgba(99,102,241,0.08)', color: '#818cf8', fontSize: '11px', cursor: impersonating ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                <ArrowUpRight size={11} /> {impersonating ? 'Apertura…' : 'Accedi come'}
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '4px', background: '#12121a', borderRadius: '10px', padding: '4px' }}>
            {(['info', 'analytics'] as const).map(tab => (
              <button key={tab} onClick={() => {
                setSelTenantTab(tab);
                if (tab === 'analytics' && !analyticsData && !analyticsLoading) loadAnalytics(t.user_id);
              }} style={{ flex: 1, padding: '7px', borderRadius: '8px', border: 'none', background: selTenantTab === tab ? '#1c1c27' : 'transparent', color: selTenantTab === tab ? '#f4f4f5' : '#71717a', fontWeight: selTenantTab === tab ? 600 : 400, fontSize: '12px', cursor: 'pointer' }}>
                {tab === 'info' ? '📋 Info' : '📊 Analytics'}
              </button>
            ))}
          </div>

          {selTenantTab === 'info' && <>
          {/* Metrics row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px' }}>
            {[['Clienti', t.clients_count], ['Appunt.', t.appointments_count], ['Operat.', t.operators_count], ['Servizi', t.services_count]].map(([l, v]) => (
              <div key={l as string} style={{ background: '#12121a', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
                <p style={{ color: '#818cf8', fontSize: '18px', fontWeight: 700, margin: 0 }}>{v as number}</p>
                <p style={{ color: '#71717a', fontSize: '10px', margin: 0 }}>{l as string}</p>
              </div>
            ))}
          </div>

          {/* Edit fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              ['Nome salone', 'salon_name', 'text'],
              ['Titolare', 'full_name', 'text'],
              ['Email', 'email', 'email'],
              ['Telefono', 'phone', 'tel'],
              ['P.IVA / CF', 'vat_number', 'text'],
              ['Settore', 'sector', 'text'],
              ['Regione', 'region', 'text'],
              ['CSM assegnato', 'csm', 'text'],
            ].map(([label, key, type]) => (
              <div key={key as string}>
                <label style={{ display: 'block', fontSize: '11px', color: '#71717a', marginBottom: '4px' }}>{label}</label>
                <input type={type as string} value={(e[key as keyof Tenant] ?? '') as string}
                  onChange={ev => set(key as keyof Tenant, ev.target.value)} style={inp()} />
              </div>
            ))}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#71717a', marginBottom: '4px' }}>Piano</label>
                <select value={(e.plan ?? t.plan) as string} onChange={ev => {
                  const p = ev.target.value;
                  set('plan', p);
                  set('monthly_price', PLAN_PRICES[p] ?? 0);
                }} style={sel()}>
                  {['trial','starter','pro','business'].map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)} — €{PLAN_PRICES[p]}/mese</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#71717a', marginBottom: '4px' }}>Stato</label>
                <select value={(e.status ?? t.status) as string} onChange={ev => set('status', ev.target.value)} style={sel()}>
                  {['trial','active','suspended','cancelled'].map(s => <option key={s} value={s}>{STATUS[s]?.label ?? s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#71717a', marginBottom: '4px' }}>Prezzo mensile (€)</label>
                <input type="number" min={0} value={((e.monthly_price ?? t.monthly_price) as number)}
                  onChange={ev => set('monthly_price', parseFloat(ev.target.value) || 0)} style={inp()} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#71717a', marginBottom: '4px' }}>Fine trial</label>
                <input type="date" value={((e.trial_ends_at ?? t.trial_ends_at) as string)?.slice(0, 10) ?? ''}
                  onChange={ev => set('trial_ends_at', ev.target.value ? new Date(ev.target.value).toISOString() : null)} style={inp()} />
              </div>
            </div>

            {/* Admin toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#12121a', borderRadius: '10px', padding: '10px 14px' }}>
              <div>
                <p style={{ margin: 0, fontSize: '13px', color: '#f4f4f5', fontWeight: 600 }}>Accesso Admin</p>
                <p style={{ margin: 0, fontSize: '11px', color: '#71717a' }}>Permette all&apos;utente di accedere al pannello admin</p>
              </div>
              <button
                onClick={() => set('is_admin', !(e.is_admin ?? t.is_admin))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: (e.is_admin ?? t.is_admin) ? '#818cf8' : '#3f3f5a' }}
              >
                {(e.is_admin ?? t.is_admin)
                  ? <ToggleRight size={32} />
                  : <ToggleLeft size={32} />}
              </button>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#71717a', marginBottom: '4px' }}>Note interne</label>
              <textarea rows={3} value={(e.notes ?? t.notes) as string} onChange={ev => set('notes', ev.target.value)}
                style={{ ...inp(), resize: 'vertical' }} />
            </div>
          </div>

          {/* Info row */}
          <div style={{ background: '#12121a', borderRadius: '10px', padding: '12px', fontSize: '11px', color: '#71717a' }}>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <span><CalendarIcon size={10} style={{ display: 'inline', marginRight: 3 }} />Registrato: {fmtDate(t.registered_at)}</span>
              <span><Clock size={10} style={{ display: 'inline', marginRight: 3 }} />Ultimo sync: {fmtDT(t.last_sync)}</span>
            </div>
          </div>

          {/* Save */}
          <button onClick={saveTenant} disabled={savingTenant}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '12px', border: 'none', background: savingTenant ? '#2e2e40' : 'linear-gradient(135deg,#f59e0b,#ef4444)', color: 'white', fontWeight: 600, cursor: savingTenant ? 'not-allowed' : 'pointer' }}>
            <Save size={15} /> {savingTenant ? 'Salvataggio…' : 'Salva modifiche'}
          </button>

          {/* Delete */}
          {!confirmDeleteTenant ? (
            <button onClick={() => setConfirmDeleteTenant(true)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.08)', color: '#f87171', fontWeight: 500, cursor: 'pointer', fontSize: '13px' }}>
              <Trash2 size={14} /> Elimina tenant
            </button>
          ) : (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '12px', padding: '14px' }}>
              <p style={{ color: '#f87171', fontWeight: 600, fontSize: '13px', margin: '0 0 6px' }}>⚠️ Conferma eliminazione</p>
              <p style={{ color: '#a1a1aa', fontSize: '12px', margin: '0 0 10px' }}>
                Questa operazione elimina i metadati del tenant da admin_tenants.
              </p>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', cursor: 'pointer' }}>
                <input type="checkbox" checked={deleteDataToo} onChange={e => setDeleteDataToo(e.target.checked)} />
                <span style={{ color: '#f87171', fontSize: '12px', fontWeight: 600 }}>Elimina anche i dati del salone (salon_data) — non reversibile</span>
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => { setConfirmDeleteTenant(false); setDeleteDataToo(false); }}
                  style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #2e2e40', background: '#12121a', color: '#a1a1aa', cursor: 'pointer', fontSize: '12px' }}>
                  Annulla
                </button>
                <button onClick={deleteTenant} disabled={deletingTenant}
                  style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', background: deletingTenant ? '#2e2e40' : '#ef4444', color: 'white', cursor: deletingTenant ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 600 }}>
                  {deletingTenant ? 'Eliminazione…' : 'Elimina definitivamente'}
                </button>
              </div>
            </div>
          )}
          </>}

          {/* Analytics tab */}
          {selTenantTab === 'analytics' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {analyticsLoading && <p style={{ color: '#71717a', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>Caricamento analytics…</p>}
              {analyticsData && (() => {
                const maxRev = Math.max(...analyticsData.monthlyRevenue.map(m => m.total), 1);
                const totalMethod = analyticsData.paymentBreakdown.reduce((s, p) => s + p.total, 0);
                const fmtEur = (n: number) => `€${n.toLocaleString('it-IT', { minimumFractionDigits: 0 })}`;
                return (<>
                  {/* KPI strip */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px' }}>
                    {[
                      ['Tot. entrate', fmtEur(analyticsData.totalRevenue), '#4ade80'],
                      ['Prenot. online 30g', String(analyticsData.onlineBookings30d), '#818cf8'],
                      ['Gift card attive', `${analyticsData.giftCardsActive}/${analyticsData.giftCardsCount}`, '#fbbf24'],
                    ].map(([l, v, c]) => (
                      <div key={l} style={{ background: '#12121a', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
                        <p style={{ color: c, fontSize: '18px', fontWeight: 700, margin: 0 }}>{v}</p>
                        <p style={{ color: '#71717a', fontSize: '10px', margin: 0 }}>{l}</p>
                      </div>
                    ))}
                  </div>

                  {/* Monthly revenue bar chart */}
                  <div style={{ background: '#12121a', borderRadius: '12px', padding: '14px' }}>
                    <p style={{ color: '#71717a', fontSize: '11px', margin: '0 0 10px' }}>Entrate mensili (12 mesi)</p>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '70px' }}>
                      {analyticsData.monthlyRevenue.map(m => (
                        <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                          <div title={fmtEur(m.total)}
                            style={{ width: '100%', borderRadius: '3px 3px 0 0', background: m.total > 0 ? 'rgba(99,102,241,0.7)' : '#1e1e2a', height: `${Math.max(2, (m.total / maxRev) * 58)}px` }} />
                          <span style={{ color: '#3f3f5a', fontSize: '8px' }}>{m.month.slice(5)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Top services */}
                  {analyticsData.topServices.length > 0 && (
                    <div style={{ background: '#12121a', borderRadius: '12px', padding: '14px' }}>
                      <p style={{ color: '#71717a', fontSize: '11px', margin: '0 0 10px' }}>Top 5 servizi per fatturato</p>
                      {analyticsData.topServices.map((s, i) => (
                        <div key={s.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < analyticsData.topServices.length - 1 ? '1px solid #1e1e2a' : 'none' }}>
                          <div><span style={{ color: '#71717a', fontSize: '10px', marginRight: '6px' }}>#{i + 1}</span><span style={{ color: '#f4f4f5', fontSize: '12px' }}>{s.name}</span></div>
                          <div><span style={{ color: '#4ade80', fontSize: '12px', fontWeight: 600 }}>{fmtEur(s.revenue)}</span><span style={{ color: '#71717a', fontSize: '10px', marginLeft: '6px' }}>{s.count}×</span></div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Payment breakdown */}
                  {analyticsData.paymentBreakdown.length > 0 && (
                    <div style={{ background: '#12121a', borderRadius: '12px', padding: '14px' }}>
                      <p style={{ color: '#71717a', fontSize: '11px', margin: '0 0 10px' }}>Metodi di pagamento</p>
                      {analyticsData.paymentBreakdown.map(p => {
                        const pct = totalMethod > 0 ? (p.total / totalMethod) * 100 : 0;
                        const labels: Record<string, string> = { cash: 'Contanti', card: 'Carta', gift_card: 'Gift Card', mixed: 'Misto' };
                        return (
                          <div key={p.method} style={{ marginBottom: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                              <span style={{ color: '#a1a1aa', fontSize: '11px' }}>{labels[p.method] ?? p.method}</span>
                              <span style={{ color: '#f4f4f5', fontSize: '11px', fontWeight: 600 }}>{fmtEur(p.total)} <span style={{ color: '#71717a' }}>({pct.toFixed(0)}%)</span></span>
                            </div>
                            <div style={{ height: '4px', background: '#1e1e2a', borderRadius: '2px' }}>
                              <div style={{ width: `${pct}%`, height: '100%', borderRadius: '2px', background: '#6366f1' }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>);
              })()}
              {!analyticsLoading && !analyticsData && (
                <p style={{ color: '#52525b', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>Nessun dato disponibile.</p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ─── TENANTS ─────────────────────────────────────────────────────────────
  const TenantsSection = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <h2 style={{ color: '#f4f4f5', fontWeight: 700, fontSize: '20px', margin: 0 }}>Tenant ({filteredTenants.length})</h2>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#71717a' }} />
            <input placeholder="Cerca…" value={tenantSearch} onChange={e => setTenantSearch(e.target.value)} style={{ ...inp(), paddingLeft: '30px', width: '180px' }} />
          </div>
          <select value={tenantPlanFilter} onChange={e => setTenantPlanFilter(e.target.value)} style={sel({ width: '120px' })}>
            <option value="">Tutti i piani</option>
            {['trial','starter','pro','business'].map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
          </select>
          <select value={tenantStatusFilter} onChange={e => setTenantStatusFilter(e.target.value)} style={sel({ width: '130px' })}>
            <option value="">Tutti gli stati</option>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </div>

      <div style={card({ padding: 0, overflow: 'hidden' })}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #2e2e40' }}>
                {['Salone','Titolare','Piano','Stato','Clienti','Appunt.','Prenot.30g','Registrato','Azioni'].map(h => (
                  <th key={h} style={{ padding: '12px 14px', textAlign: 'left', color: '#71717a', fontWeight: 500, fontSize: '11px', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredTenants.map(t => (
                <tr key={t.user_id} style={{ borderBottom: '1px solid #1e1e2a', cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#202030')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  onClick={() => { setSelTenant(t); setEditTenant({ ...t }); setConfirmDeleteTenant(false); setDeleteDataToo(false); setSelTenantTab('info'); setAnalyticsData(null); }}>
                  <td style={{ padding: '12px 14px', color: '#f4f4f5', fontWeight: 600 }}>{t.salon_name}</td>
                  <td style={{ padding: '12px 14px', color: '#a1a1aa' }}>{t.full_name || '—'}</td>
                  <td style={{ padding: '12px 14px' }}><Badge s={t.plan} map={PLAN} /></td>
                  <td style={{ padding: '12px 14px' }}><Badge s={t.status} map={STATUS} /></td>
                  <td style={{ padding: '12px 14px', color: '#a1a1aa', textAlign: 'center' }}>{t.clients_count}</td>
                  <td style={{ padding: '12px 14px', color: '#a1a1aa', textAlign: 'center' }}>{t.appointments_count}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    {(t.online_bookings_30d ?? 0) > 0
                      ? <span style={{ color: '#818cf8', fontWeight: 600 }}>{t.online_bookings_30d}</span>
                      : <span style={{ color: '#3f3f5a' }}>—</span>}
                  </td>
                  <td style={{ padding: '12px 14px', color: '#71717a', whiteSpace: 'nowrap' }}>{fmtDate(t.registered_at)}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <button onClick={ev => { ev.stopPropagation(); setSelTenant(t); setEditTenant({ ...t }); setConfirmDeleteTenant(false); setDeleteDataToo(false); setSelTenantTab('info'); setAnalyticsData(null); }}
                      style={{ background: 'none', border: '1px solid #2e2e40', borderRadius: '6px', padding: '4px 10px', color: '#818cf8', fontSize: '11px', cursor: 'pointer' }}>
                      Apri
                    </button>
                  </td>
                </tr>
              ))}
              {filteredTenants.length === 0 && (
                <tr><td colSpan={9} style={{ padding: '24px', textAlign: 'center', color: '#3f3f5a' }}>Nessun tenant trovato.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // ─── TICKETS ─────────────────────────────────────────────────────────────
  const TicketsSection = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <h2 style={{ color: '#f4f4f5', fontWeight: 700, fontSize: '20px', margin: 0 }}>Ticket di supporto</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <select value={ticketStatusFilter} onChange={e => setTicketStatusFilter(e.target.value)} style={sel({ width: '150px' })}>
            <option value="">Tutti gli stati</option>
            {Object.entries(TK_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <button onClick={() => { setTicketForm({ category: 'domanda', priority: 'normale' }); setNewTicket(true); }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', color: 'white', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
            <Plus size={14} /> Nuovo ticket
          </button>
        </div>
      </div>

      <div style={card({ padding: 0, overflow: 'hidden' })}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #2e2e40' }}>
              {['Salone','Oggetto','Categoria','Priorità','Stato','Data','Azioni'].map(h => (
                <th key={h} style={{ padding: '12px 14px', textAlign: 'left', color: '#71717a', fontWeight: 500, fontSize: '11px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredTickets.map(t => (
              <tr key={t.id} style={{ borderBottom: '1px solid #1e1e2a' }}>
                <td style={{ padding: '12px 14px', color: '#f4f4f5', fontWeight: 600 }}>{t.tenant_name || '—'}</td>
                <td style={{ padding: '12px 14px', color: '#a1a1aa', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</td>
                <td style={{ padding: '12px 14px', color: '#71717a' }}>{t.category}</td>
                <td style={{ padding: '12px 14px' }}><span style={{ color: PRIO[t.priority]?.text ?? '#71717a', fontWeight: 600 }}>{PRIO[t.priority]?.label ?? t.priority}</span></td>
                <td style={{ padding: '12px 14px' }}><Badge s={t.status} map={TK_STATUS} /></td>
                <td style={{ padding: '12px 14px', color: '#71717a', whiteSpace: 'nowrap' }}>{fmtDate(t.created_at)}</td>
                <td style={{ padding: '12px 14px' }}>
                  <button onClick={() => { setSelTicket(t); setTicketForm({ ...t }); setNewTicket(false); }}
                    style={{ background: 'none', border: '1px solid #2e2e40', borderRadius: '6px', padding: '4px 10px', color: '#818cf8', fontSize: '11px', cursor: 'pointer' }}>
                    Apri
                  </button>
                </td>
              </tr>
            ))}
            {filteredTickets.length === 0 && (
              <tr><td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#3f3f5a' }}>Nessun ticket trovato.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Ticket modal */}
      {(selTicket || newTicket) && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => { setSelTicket(null); setNewTicket(false); }}>
          <div style={{ width: '480px', maxHeight: '90vh', overflowY: 'auto', background: '#1c1c27', border: '1px solid #2e2e40', borderRadius: '20px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }} onClick={ev => ev.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ color: '#f4f4f5', fontWeight: 700, margin: 0 }}>{selTicket ? 'Modifica ticket' : 'Nuovo ticket'}</h3>
              <button onClick={() => { setSelTicket(null); setNewTicket(false); }} style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            {[
              ['Salone', 'tenant_name', 'text'],
              ['Oggetto', 'subject', 'text'],
            ].map(([l, k, type]) => (
              <div key={k as string}>
                <label style={{ display: 'block', fontSize: '11px', color: '#71717a', marginBottom: '4px' }}>{l}</label>
                <input type={type as string} value={(ticketForm[k as keyof Ticket] ?? '') as string} onChange={ev => setTicketForm(p => ({ ...p, [k as string]: ev.target.value }))} style={inp()} />
              </div>
            ))}
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#71717a', marginBottom: '4px' }}>Descrizione</label>
              <textarea rows={3} value={ticketForm.body ?? ''} onChange={ev => setTicketForm(p => ({ ...p, body: ev.target.value }))} style={{ ...inp(), resize: 'vertical' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {[['Categoria', 'category', ['bug','domanda','feature','altro']], ['Priorità', 'priority', ['bassa','normale','alta','urgente']], ['Stato', 'status', ['aperto','in_lavorazione','risolto','chiuso']]].map(([l, k, opts]) => (
                <div key={k as string}>
                  <label style={{ display: 'block', fontSize: '11px', color: '#71717a', marginBottom: '4px' }}>{l as string}</label>
                  <select value={(ticketForm[k as keyof Ticket] ?? '') as string} onChange={ev => setTicketForm(p => ({ ...p, [k as string]: ev.target.value }))} style={sel()}>
                    {(opts as string[]).map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              ))}
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#71717a', marginBottom: '4px' }}>Assegnato a</label>
                <input value={ticketForm.assigned_to ?? ''} onChange={ev => setTicketForm(p => ({ ...p, assigned_to: ev.target.value }))} style={inp()} />
              </div>
            </div>
            {selTicket && (
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#71717a', marginBottom: '4px' }}>Note risoluzione</label>
                <textarea rows={2} value={ticketForm.resolution ?? ''} onChange={ev => setTicketForm(p => ({ ...p, resolution: ev.target.value }))} style={{ ...inp(), resize: 'vertical' }} />
              </div>
            )}
            <button onClick={saveTicket} style={{ padding: '11px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', color: 'white', fontWeight: 600, cursor: 'pointer' }}>
              {selTicket ? 'Salva modifiche' : 'Crea ticket'}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // ─── BROADCASTS ──────────────────────────────────────────────────────────
  const BroadcastsSection = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ color: '#f4f4f5', fontWeight: 700, fontSize: '20px', margin: 0 }}>Broadcast ({broadcasts.length})</h2>
        <button onClick={() => setNewBcast(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', color: 'white', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
          <Plus size={14} /> Nuovo messaggio
        </button>
      </div>
      <p style={{ color: '#71717a', fontSize: '12px', margin: '-8px 0 0' }}>Messaggi in-app inviati ai tenant (visibili al prossimo accesso al gestionale).</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {broadcasts.map(b => (
          <div key={b.id} style={card({ padding: '16px' })}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <p style={{ color: '#f4f4f5', fontWeight: 600, fontSize: '14px', margin: 0 }}>{b.title}</p>
                <p style={{ color: '#a1a1aa', fontSize: '12px', margin: '4px 0 8px' }}>{b.body}</p>
                <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: '#71717a' }}>
                  <span>Target: <span style={{ color: '#818cf8' }}>{b.target}</span></span>
                  <span>{fmtDT(b.created_at)}</span>
                </div>
              </div>
              <button onClick={async () => { await af('/api/admin/broadcasts', { method: 'DELETE', body: JSON.stringify({ id: b.id }) }); setBroadcasts(prev => prev.filter(x => x.id !== b.id)); }}
                style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', padding: '4px' }}><X size={15} /></button>
            </div>
          </div>
        ))}
        {broadcasts.length === 0 && <div style={card({ color: '#3f3f5a', fontSize: '13px', textAlign: 'center' })}>Nessun broadcast inviato.</div>}
      </div>

      {/* New broadcast modal */}
      {newBcast && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setNewBcast(false)}>
          <div style={{ width: '460px', background: '#1c1c27', border: '1px solid #2e2e40', borderRadius: '20px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }} onClick={ev => ev.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ color: '#f4f4f5', fontWeight: 700, margin: 0 }}>Invia broadcast</h3>
              <button onClick={() => setNewBcast(false)} style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#71717a', marginBottom: '4px' }}>Titolo</label>
              <input value={bcastForm.title} onChange={e => setBcastForm(p => ({ ...p, title: e.target.value }))} style={inp()} placeholder="Es. Novità del prodotto" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#71717a', marginBottom: '4px' }}>Messaggio</label>
              <textarea rows={4} value={bcastForm.body} onChange={e => setBcastForm(p => ({ ...p, body: e.target.value }))} style={{ ...inp(), resize: 'vertical' }} placeholder="Testo del messaggio…" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#71717a', marginBottom: '4px' }}>Destinatari</label>
              <select value={bcastForm.target} onChange={e => setBcastForm(p => ({ ...p, target: e.target.value }))} style={sel()}>
                <option value="all">Tutti i tenant</option>
                <option value="trial">Solo trial</option>
                <option value="active">Solo attivi</option>
                <option value="plan:pro">Solo piano Pro</option>
                <option value="plan:business">Solo piano Business</option>
              </select>
            </div>
            <button onClick={sendBroadcast} disabled={!bcastForm.title || !bcastForm.body}
              style={{ padding: '11px', borderRadius: '12px', border: 'none', background: (!bcastForm.title || !bcastForm.body) ? '#2e2e40' : 'linear-gradient(135deg,#f59e0b,#ef4444)', color: 'white', fontWeight: 600, cursor: (!bcastForm.title || !bcastForm.body) ? 'not-allowed' : 'pointer' }}>
              Invia broadcast
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // ─── FEATURE FLAGS ────────────────────────────────────────────────────────
  const FlagsSection = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ color: '#f4f4f5', fontWeight: 700, fontSize: '20px', margin: 0 }}>Feature Flag</h2>
        <button onClick={() => setNewFlag(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', color: 'white', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
          <Plus size={14} /> Nuovo flag
        </button>
      </div>

      <div style={card({ padding: 0, overflow: 'hidden' })}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #2e2e40' }}>
              {['Funzionalità','Descrizione','Attivo per','Stato'].map(h => (
                <th key={h} style={{ padding: '12px 14px', textAlign: 'left', color: '#71717a', fontWeight: 500, fontSize: '11px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {flags.map(f => (
              <tr key={f.id} style={{ borderBottom: '1px solid #1e1e2a' }}>
                <td style={{ padding: '12px 14px', color: '#f4f4f5', fontWeight: 600 }}>{f.name}</td>
                <td style={{ padding: '12px 14px', color: '#71717a' }}>{f.description || '—'}</td>
                <td style={{ padding: '12px 14px' }}><span style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8', padding: '2px 8px', borderRadius: '6px', fontSize: '11px' }}>{f.enabled_for}</span></td>
                <td style={{ padding: '12px 14px' }}>
                  <button onClick={() => toggleFlag(f)} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', color: f.enabled ? '#4ade80' : '#71717a' }}>
                    {f.enabled ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                    <span style={{ fontSize: '12px' }}>{f.enabled ? 'Attivo' : 'Disattivo'}</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* New flag modal */}
      {newFlag && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setNewFlag(false)}>
          <div style={{ width: '400px', background: '#1c1c27', border: '1px solid #2e2e40', borderRadius: '20px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }} onClick={ev => ev.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ color: '#f4f4f5', fontWeight: 700, margin: 0 }}>Nuovo feature flag</h3>
              <button onClick={() => setNewFlag(false)} style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            {[['Nome', 'name'], ['Descrizione', 'description']].map(([l, k]) => (
              <div key={k}>
                <label style={{ display: 'block', fontSize: '11px', color: '#71717a', marginBottom: '4px' }}>{l}</label>
                <input value={flagForm[k as 'name' | 'description']} onChange={e => setFlagForm(p => ({ ...p, [k]: e.target.value }))} style={inp()} />
              </div>
            ))}
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#71717a', marginBottom: '4px' }}>Attivo per</label>
              <select value={flagForm.enabled_for} onChange={e => setFlagForm(p => ({ ...p, enabled_for: e.target.value }))} style={sel()}>
                <option value="all">Tutti</option>
                <option value="none">Nessuno</option>
                <option value="starter">Starter+</option>
                <option value="pro">Pro+</option>
                <option value="business">Business+</option>
              </select>
            </div>
            <button onClick={createFlag} disabled={!flagForm.name}
              style={{ padding: '11px', borderRadius: '12px', border: 'none', background: !flagForm.name ? '#2e2e40' : 'linear-gradient(135deg,#f59e0b,#ef4444)', color: 'white', fontWeight: 600, cursor: !flagForm.name ? 'not-allowed' : 'pointer' }}>
              Crea flag
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // ─── AUDIT LOG ───────────────────────────────────────────────────────────
  const AuditSection = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ color: '#f4f4f5', fontWeight: 700, fontSize: '20px', margin: 0 }}>Audit Log</h2>
        <button onClick={() => loadSection('audit')} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: '1px solid #2e2e40', borderRadius: '8px', padding: '6px 12px', color: '#71717a', cursor: 'pointer', fontSize: '12px' }}>
          <RefreshCw size={12} /> Aggiorna
        </button>
      </div>
      <div style={card({ padding: 0, overflow: 'hidden' })}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #2e2e40' }}>
              {['Azione','Tenant','Dettagli','Data'].map(h => (
                <th key={h} style={{ padding: '12px 14px', textAlign: 'left', color: '#71717a', fontWeight: 500, fontSize: '11px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {audit.map(e => (
              <tr key={e.id} style={{ borderBottom: '1px solid #1e1e2a' }}>
                <td style={{ padding: '10px 14px', color: '#f4f4f5', fontWeight: 500 }}>{ACTION_LABELS[e.action] ?? e.action}</td>
                <td style={{ padding: '10px 14px', color: '#a1a1aa', fontSize: '11px' }}>{e.target_tenant ? e.target_tenant.slice(0, 16) : '—'}</td>
                <td style={{ padding: '10px 14px', color: '#71717a', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {Object.entries(e.details ?? {}).map(([k, v]) => `${k}: ${v}`).join(' · ') || '—'}
                </td>
                <td style={{ padding: '10px 14px', color: '#3f3f5a', whiteSpace: 'nowrap' }}>{fmtDT(e.created_at)}</td>
              </tr>
            ))}
            {audit.length === 0 && (
              <tr><td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: '#3f3f5a' }}>Nessuna azione registrata.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ─── WHATSAPP ────────────────────────────────────────────────────────────
  const openWaModal = async (tenant: Tenant) => {
    setWaModal(tenant);
    setWaSaved(false);
    setWaForm({ ultraMsgInstanceId: '', ultraMsgToken: '' });
    setTestPhone('');
    setTestResult(null);
    try {
      const res = await af(`/api/admin/whatsapp?user_id=${tenant.user_id}`);
      if (res.ok) {
        const d = await res.json();
        const instanceId = d.ultraMsgInstanceId ?? '';
        const token = d.ultraMsgToken ?? '';
        setWaForm({ ultraMsgInstanceId: instanceId, ultraMsgToken: token });
        if (instanceId) setWaInstances(p => ({ ...p, [tenant.user_id]: instanceId }));
        // Auto-check status when opening modal if credentials exist
        if (instanceId && token) {
          checkWaStatus(tenant, instanceId, token);
        }
      }
    } catch { /* ignore */ }
  };

  const checkWaStatus = async (tenant: Tenant, instanceId: string, token: string) => {
    if (!instanceId || !token) { setWaStatuses(p => ({ ...p, [tenant.user_id]: 'none' })); return; }
    try {
      const res = await fetch(`/api/ultramsg/status?instanceId=${instanceId}&token=${token}`);
      const d = await res.json();
      setWaStatuses(p => ({ ...p, [tenant.user_id]: d.connected ? 'connected' : 'disconnected' }));
      setWaQrCodes(p => ({ ...p, [tenant.user_id]: d.qrCode ?? null }));
    } catch {
      setWaStatuses(p => ({ ...p, [tenant.user_id]: 'disconnected' }));
    }
  };

  const saveWaCredentials = async () => {
    if (!waModal) return;
    setWaSaving(true);
    await af('/api/admin/whatsapp', {
      method: 'PATCH',
      body: JSON.stringify({ user_id: waModal.user_id, ...waForm }),
    });
    setWaSaving(false);
    setWaSaved(true);
    if (waForm.ultraMsgInstanceId) setWaInstances(p => ({ ...p, [waModal.user_id]: waForm.ultraMsgInstanceId }));
    await checkWaStatus(waModal, waForm.ultraMsgInstanceId, waForm.ultraMsgToken);
    setTimeout(() => setWaSaved(false), 2000);
  };

  const removeWaCredentials = async () => {
    if (!waModal) return;
    setWaSaving(true);
    await af('/api/admin/whatsapp', {
      method: 'PATCH',
      body: JSON.stringify({ user_id: waModal.user_id, ultraMsgInstanceId: '', ultraMsgToken: '' }),
    });
    setWaForm({ ultraMsgInstanceId: '', ultraMsgToken: '' });
    setWaStatuses(p => ({ ...p, [waModal.user_id]: 'none' }));
    setWaQrCodes(p => ({ ...p, [waModal.user_id]: null }));
    setWaInstances(p => { const n = { ...p }; delete n[waModal.user_id]; return n; });
    setWaSaving(false);
  };

  const WhatsAppSection = () => {
    const filtered = tenants.filter(t =>
      !waSearch || t.salon_name.toLowerCase().includes(waSearch.toLowerCase()) || t.email.toLowerCase().includes(waSearch.toLowerCase())
    );
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h2 style={{ color: '#f4f4f5', fontWeight: 700, fontSize: '20px', margin: 0 }}>Istanze WhatsApp (UltraMsg)</h2>
            <p style={{ color: '#71717a', fontSize: '12px', margin: '4px 0 0' }}>Assegna un&apos;istanza UltraMsg a ogni salone. Il salone vede solo i toggle — le credenziali le gestisci solo tu.</p>
          </div>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#71717a' }} />
            <input value={waSearch} onChange={e => setWaSearch(e.target.value)} placeholder="Cerca salone…" style={{ ...inp({ paddingLeft: '30px', width: '220px' }) }} />
          </div>
        </div>

        <div style={card({ padding: 0, overflow: 'hidden' })}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #2e2e40' }}>
                {['Salone', 'Email', 'Piano', 'Istanza', 'Stato', 'Azioni'].map(h => (
                  <th key={h} style={{ padding: '12px 14px', textAlign: 'left', color: '#71717a', fontWeight: 500, fontSize: '11px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => {
                const status = waStatuses[t.user_id] ?? 'none';
                return (
                  <tr key={t.user_id} style={{ borderBottom: '1px solid #1e1e2a' }}>
                    <td style={{ padding: '12px 14px', color: '#f4f4f5', fontWeight: 600 }}>{t.salon_name || '—'}</td>
                    <td style={{ padding: '12px 14px', color: '#71717a', fontSize: '11px' }}>{t.email}</td>
                    <td style={{ padding: '12px 14px' }}><Badge s={t.plan} map={PLAN} /></td>
                    <td style={{ padding: '12px 14px', color: '#a1a1aa', fontSize: '11px', fontFamily: 'monospace' }}>
                      {waInstances[t.user_id] ?? '—'}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {status === 'connected'    && <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#4ade80', fontSize: '12px' }}><Wifi size={13} /> Connesso</span>}
                      {status === 'disconnected' && <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#fbbf24', fontSize: '12px' }}><WifiOff size={13} /> Attesa QR</span>}
                      {status === 'none'         && <span style={{ color: '#3f3f5a', fontSize: '12px' }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <button
                        onClick={() => openWaModal(t)}
                        style={{ background: 'none', border: '1px solid #2e2e40', borderRadius: '6px', padding: '4px 10px', color: '#818cf8', fontSize: '11px', cursor: 'pointer' }}
                      >
                        Configura
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#3f3f5a' }}>Nessun salone trovato.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Modal assegnazione istanza */}
        {waModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setWaModal(null)}>
            <div style={{ width: '460px', background: '#1c1c27', border: '1px solid #2e2e40', borderRadius: '20px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}
              onClick={ev => ev.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ color: '#f4f4f5', fontWeight: 700, margin: 0 }}>Configura WhatsApp</h3>
                  <p style={{ color: '#71717a', fontSize: '12px', margin: '4px 0 0' }}>{waModal.salon_name}</p>
                </div>
                <button onClick={() => setWaModal(null)} style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer' }}><X size={18} /></button>
              </div>

              {/* Stato connessione nel modal */}
              {waModal && waStatuses[waModal.user_id] && waStatuses[waModal.user_id] !== 'none' && (
                <div style={{ background: waStatuses[waModal.user_id] === 'connected' ? 'rgba(74,222,128,0.08)' : 'rgba(251,191,36,0.08)', border: `1px solid ${waStatuses[waModal.user_id] === 'connected' ? 'rgba(74,222,128,0.25)' : 'rgba(251,191,36,0.25)'}`, borderRadius: '12px', padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {waStatuses[waModal.user_id] === 'connected'
                        ? <><Wifi size={14} style={{ color: '#4ade80' }} /><span style={{ color: '#4ade80', fontWeight: 600, fontSize: '13px' }}>WhatsApp connesso ✓</span></>
                        : <><WifiOff size={14} style={{ color: '#fbbf24' }} /><span style={{ color: '#fbbf24', fontWeight: 600, fontSize: '13px' }}>In attesa del QR scan</span></>
                      }
                    </div>
                    <button
                      onClick={() => waModal && checkWaStatus(waModal, waForm.ultraMsgInstanceId, waForm.ultraMsgToken)}
                      style={{ background: 'none', border: '1px solid #2e2e40', borderRadius: '6px', padding: '3px 8px', color: '#71717a', fontSize: '11px', cursor: 'pointer' }}
                    >
                      ↻ Aggiorna
                    </button>
                  </div>
                  {/* QR code se disponibile e non ancora connesso */}
                  {waStatuses[waModal.user_id] === 'disconnected' && waQrCodes[waModal.user_id] && (
                    <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <p style={{ color: '#71717a', fontSize: '11px', textAlign: 'center' }}>
                        Scansiona con WhatsApp del salone →<br/>
                        <em style={{ fontSize: '10px' }}>Impostazioni → Dispositivi collegati → Collega dispositivo</em>
                      </p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={waQrCodes[waModal.user_id]!} alt="QR WhatsApp" style={{ width: '180px', height: '180px', borderRadius: '8px', background: 'white', padding: '8px' }} />
                      <p style={{ color: '#52525b', fontSize: '10px' }}>Il QR scade dopo 45 secondi — clicca ↻ Aggiorna per rigenerarlo</p>
                    </div>
                  )}
                  {waStatuses[waModal.user_id] === 'disconnected' && !waQrCodes[waModal.user_id] && (
                    <p style={{ color: '#71717a', fontSize: '11px', marginTop: '6px' }}>
                      Clicca ↻ Aggiorna per caricare il QR code da scansionare con il telefono del salone.
                    </p>
                  )}
                </div>
              )}

              <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '10px', padding: '12px', fontSize: '12px', color: '#a1a1aa' }}>
                💡 Crea l&apos;istanza su <a href="https://ultramsg.com" target="_blank" rel="noreferrer" style={{ color: '#818cf8' }}>ultramsg.com</a>, copia Instance ID e Token, incollali qui sotto e salva. Poi scansiona il QR che apparirà sopra.
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#71717a', marginBottom: '4px' }}>Instance ID</label>
                <input
                  value={waForm.ultraMsgInstanceId}
                  onChange={e => setWaForm(p => ({ ...p, ultraMsgInstanceId: e.target.value }))}
                  placeholder="instance123456"
                  style={inp()}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#71717a', marginBottom: '4px' }}>Token</label>
                <input
                  value={waForm.ultraMsgToken}
                  onChange={e => setWaForm(p => ({ ...p, ultraMsgToken: e.target.value }))}
                  placeholder="xxxxxxxxxxxxxxxx"
                  style={inp()}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={saveWaCredentials}
                  disabled={waSaving || !waForm.ultraMsgInstanceId || !waForm.ultraMsgToken}
                  style={{ flex: 1, padding: '11px', borderRadius: '12px', border: 'none', background: (!waForm.ultraMsgInstanceId || !waForm.ultraMsgToken) ? '#2e2e40' : 'linear-gradient(135deg,#6366f1,#818cf8)', color: 'white', fontWeight: 600, cursor: (!waForm.ultraMsgInstanceId || !waForm.ultraMsgToken) ? 'not-allowed' : 'pointer' }}
                >
                  {waSaving ? 'Salvataggio…' : waSaved ? '✓ Salvato' : 'Salva istanza'}
                </button>
                {(waForm.ultraMsgInstanceId || waForm.ultraMsgToken) && (
                  <button
                    onClick={removeWaCredentials}
                    disabled={waSaving}
                    style={{ padding: '11px 16px', borderRadius: '12px', border: '1px solid #ef4444', background: 'transparent', color: '#f87171', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
                  >
                    Rimuovi
                  </button>
                )}
              </div>

              {/* Test WA */}
              {waForm.ultraMsgInstanceId && waForm.ultraMsgToken && (
                <div style={{ borderTop: '1px solid #2e2e40', paddingTop: '14px' }}>
                  <p style={{ color: '#71717a', fontSize: '11px', margin: '0 0 8px' }}>Invia messaggio di test</p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      value={testPhone}
                      onChange={e => { setTestPhone(e.target.value); setTestResult(null); }}
                      placeholder="391234567890"
                      style={{ ...inp({ flex: '1' }) }}
                    />
                    <button
                      onClick={sendWaTest}
                      disabled={testSending || !testPhone.trim()}
                      style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '9px 14px', borderRadius: '10px', border: 'none', background: testSending || !testPhone.trim() ? '#2e2e40' : 'rgba(99,102,241,0.2)', color: '#818cf8', fontWeight: 600, fontSize: '12px', cursor: testSending || !testPhone.trim() ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                      <Send size={12} /> {testSending ? '…' : 'Manda test'}
                    </button>
                  </div>
                  {testResult && (
                    <p style={{ marginTop: '6px', fontSize: '12px', color: testResult.ok ? '#4ade80' : '#f87171' }}>
                      {testResult.ok ? '✅' : '❌'} {testResult.msg}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─── SALES / PRESENTAZIONE COMMERCIALE ────────────────────────────────────
  const SalesSection = () => {
    const PLANS = [
      {
        key: 'starter', label: 'Starter', price: 25, color: '#818cf8', gradient: 'linear-gradient(135deg,#6366f1,#818cf8)',
        tagline: 'Per chi inizia a professionalizzarsi',
        features: [
          'Calendario appuntamenti illimitati',
          'Gestione clienti (fino a 500)',
          'Cassa e pagamenti (contanti, carta)',
          'Schede cliente con storico',
          'Gift card e buoni regalo',
          'Abbonamenti e tessere fedeltà',
          'Fino a 3 operatori',
          'Assistenza via email',
        ],
        notIncluded: ['Analytics avanzata', 'App cliente', 'WhatsApp automation'],
      },
      {
        key: 'pro', label: 'Pro', price: 49, color: '#c084fc', gradient: 'linear-gradient(135deg,#9333ea,#c084fc)',
        tagline: 'Per saloni in crescita che vogliono più controllo',
        badge: '⭐ Più scelto',
        features: [
          'Tutto di Starter +',
          'Clienti illimitati',
          'Fino a 10 operatori',
          'Analytics e report avanzati',
          'Gestione fornitori e magazzino',
          'Report per operatore',
          'Gamification (punti fedeltà, badge)',
          'App cliente (prenotazione online)',
          'Assistenza prioritaria',
        ],
        notIncluded: ['WhatsApp automation'],
      },
      {
        key: 'business', label: 'Business', price: 99, color: '#4ade80', gradient: 'linear-gradient(135deg,#059669,#4ade80)',
        tagline: 'Per saloni premium con automazione totale',
        badge: '🚀 Premium',
        features: [
          'Tutto di Pro +',
          'Operatori illimitati',
          'WhatsApp automation (promemoria, follow-up)',
          'Istanza UltraMsg dedicata inclusa',
          'Messaggi automatici post-appuntamento',
          'Riattivazione clienti dormienti',
          'CSM dedicato',
          'Onboarding guidato in sede',
          'SLA risposta < 4h',
        ],
        notIncluded: [],
      },
    ];

    const CHECKLIST = [
      { step: '1', label: 'Mostra il gestionale live', sub: 'Apri il demo e fai vedere calendario + cassa' },
      { step: '2', label: 'Chiedi quanti appuntamenti/giorno', sub: 'Aiuta a quantificare il tempo risparmiato' },
      { step: '3', label: 'Mostra le gift card', sub: 'Entrate extra senza lavoro aggiuntivo' },
      { step: '4', label: 'Proponi il piano giusto', sub: 'Starter per chi inizia, Pro per crescere, Business per automazione' },
      { step: '5', label: 'Trial gratuito 14 giorni', sub: 'Nessun rischio — parte subito oggi' },
      { step: '6', label: 'Registra e configura insieme', sub: 'Aggiungi il primo servizio e operatore' },
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '960px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', padding: '20px 0 0' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '999px', padding: '4px 16px', marginBottom: '12px' }}>
            <Zap size={13} style={{ color: '#fbbf24' }} />
            <span style={{ color: '#fbbf24', fontSize: '12px', fontWeight: 600 }}>PRESENTAZIONE COMMERCIALE</span>
          </div>
          <h2 style={{ color: '#f4f4f5', fontSize: '28px', fontWeight: 800, margin: '0 0 8px' }}>Stylistgo — Gestionale per saloni</h2>
          <p style={{ color: '#71717a', fontSize: '15px', margin: 0 }}>Mostra questa pagina al cliente durante la visita</p>
        </div>

        {/* Piano cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          {PLANS.map(plan => (
            <div key={plan.key} style={{ background: '#1c1c27', border: `1px solid ${plan.color}40`, borderRadius: '20px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative', overflow: 'hidden' }}>
              {plan.badge && (
                <div style={{ position: 'absolute', top: '14px', right: '14px', background: plan.gradient, borderRadius: '999px', padding: '3px 10px', fontSize: '10px', color: 'white', fontWeight: 700 }}>{plan.badge}</div>
              )}
              {/* Price */}
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: plan.color, textTransform: 'uppercase', letterSpacing: '1px' }}>{plan.label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                  <span style={{ fontSize: '36px', fontWeight: 800, color: '#f4f4f5' }}>€{plan.price}</span>
                  <span style={{ fontSize: '13px', color: '#71717a' }}>/mese</span>
                </div>
                <p style={{ color: '#a1a1aa', fontSize: '12px', margin: '4px 0 0', lineHeight: 1.4 }}>{plan.tagline}</p>
              </div>

              {/* Features */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {plan.features.map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <Check size={13} style={{ color: plan.color, flexShrink: 0, marginTop: '2px' }} />
                    <span style={{ color: '#d4d4d8', fontSize: '12px', lineHeight: 1.4 }}>{f}</span>
                  </div>
                ))}
                {plan.notIncluded.map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', opacity: 0.3 }}>
                    <X size={13} style={{ color: '#71717a', flexShrink: 0, marginTop: '2px' }} />
                    <span style={{ color: '#71717a', fontSize: '12px', lineHeight: 1.4 }}>{f}</span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <button
                onClick={() => { changeSection('tenants'); }}
                style={{ width: '100%', padding: '11px', borderRadius: '12px', border: 'none', background: plan.gradient, color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}>
                Attiva {plan.label}
              </button>
            </div>
          ))}
        </div>

        {/* Trial banner */}
        <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '16px', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <p style={{ color: '#fbbf24', fontWeight: 700, fontSize: '16px', margin: '0 0 4px' }}>🎁 Prova gratis 14 giorni</p>
            <p style={{ color: '#a1a1aa', fontSize: '13px', margin: 0 }}>Nessuna carta di credito richiesta. Accesso completo al piano Pro per 14 giorni. Poi decidi tu.</p>
          </div>
          <div style={{ background: 'linear-gradient(135deg,#f59e0b,#ef4444)', borderRadius: '12px', padding: '10px 20px', color: 'white', fontWeight: 700, fontSize: '14px', whiteSpace: 'nowrap' }}>
            Inizia il trial →
          </div>
        </div>

        {/* Checklist di vendita */}
        <div style={card()}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <Star size={16} style={{ color: '#fbbf24' }} />
            <p style={{ color: '#f4f4f5', fontSize: '15px', fontWeight: 700, margin: 0 }}>Script di vendita — segui questi passi dal vivo</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {CHECKLIST.map(item => (
              <div key={item.step} style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', padding: '12px', background: '#12121a', borderRadius: '12px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 700, fontSize: '12px', color: 'white' }}>{item.step}</div>
                <div>
                  <p style={{ color: '#f4f4f5', fontWeight: 600, fontSize: '13px', margin: '0 0 2px' }}>{item.label}</p>
                  <p style={{ color: '#71717a', fontSize: '11px', margin: 0 }}>{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ROI estimate */}
        <div style={card()}>
          <p style={{ color: '#71717a', fontSize: '12px', margin: '0 0 14px' }}>💡 Aiuta il cliente a calcolare il ROI</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px' }}>
            {[
              { label: 'Tempo risparmiato', value: '~3h/settimana', sub: 'No più agenda carta, no dimenticanze', color: '#818cf8' },
              { label: 'Clienti recuperati', value: '+15-20%', sub: 'Promemoria automatici riducono i no-show', color: '#4ade80' },
              { label: 'Entrate extra gift card', value: '+€200-500/mese', sub: 'I clienti regalano, tu incassi subito', color: '#fbbf24' },
            ].map(kpi => (
              <div key={kpi.label} style={{ background: '#12121a', borderRadius: '12px', padding: '14px', textAlign: 'center' }}>
                <p style={{ color: kpi.color, fontSize: '20px', fontWeight: 800, margin: '0 0 4px' }}>{kpi.value}</p>
                <p style={{ color: '#f4f4f5', fontSize: '12px', fontWeight: 600, margin: '0 0 4px' }}>{kpi.label}</p>
                <p style={{ color: '#52525b', fontSize: '10px', margin: 0, lineHeight: 1.4 }}>{kpi.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ─── LAYOUT ───────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0f0f13', overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={{ width: sidebarOpen ? '220px' : '56px', flexShrink: 0, background: '#13131e', borderRight: '1px solid #2e2e40', display: 'flex', flexDirection: 'column', transition: 'width 0.2s', overflow: 'hidden' }}>
        {/* Logo */}
        <div style={{ padding: sidebarOpen ? '20px 16px 16px' : '20px 12px 16px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid #2e2e40' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ShieldCheck size={16} color="white" />
          </div>
          {sidebarOpen && <span style={{ color: '#f4f4f5', fontWeight: 700, fontSize: '14px', whiteSpace: 'nowrap' }}>Admin Panel</span>}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {navItems.map(item => {
            const active = section === item.id;
            return (
              <button key={item.id} onClick={() => changeSection(item.id)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: sidebarOpen ? '9px 10px' : '9px', borderRadius: '10px', border: 'none', background: active ? 'rgba(245,158,11,0.15)' : 'transparent', color: active ? '#fbbf24' : '#71717a', cursor: 'pointer', textAlign: 'left', width: '100%', whiteSpace: 'nowrap', justifyContent: sidebarOpen ? 'flex-start' : 'center' }}>
                <span style={{ flexShrink: 0 }}>{item.icon}</span>
                {sidebarOpen && <><span style={{ fontSize: '13px', fontWeight: active ? 600 : 400, flex: 1 }}>{item.label}</span>
                  {item.count !== undefined && item.count > 0 && (
                    <span style={{ background: active ? 'rgba(245,158,11,0.3)' : 'rgba(245,158,11,0.15)', color: '#fbbf24', borderRadius: '10px', padding: '1px 7px', fontSize: '10px', fontWeight: 600 }}>{item.count}</span>
                  )}</>}
              </button>
            );
          })}
        </nav>

        {/* Bottom */}
        <div style={{ padding: '12px 8px', borderTop: '1px solid #2e2e40', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <button onClick={() => setSidebarOpen(p => !p)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px', borderRadius: '10px', border: 'none', background: 'transparent', color: '#71717a', cursor: 'pointer', justifyContent: sidebarOpen ? 'flex-start' : 'center' }}>
            <ChevronRight size={16} style={{ transform: sidebarOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
            {sidebarOpen && <span style={{ fontSize: '12px' }}>Riduci</span>}
          </button>
          <button onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px', borderRadius: '10px', border: 'none', background: 'transparent', color: '#71717a', cursor: 'pointer', justifyContent: sidebarOpen ? 'flex-start' : 'center' }}>
            <LogOut size={16} style={{ flexShrink: 0 }} />
            {sidebarOpen && <span style={{ fontSize: '12px' }}>Esci</span>}
          </button>
          {sidebarOpen && <a href="/login" style={{ fontSize: '10px', color: '#2e2e40', textAlign: 'center', textDecoration: 'none', padding: '4px 0' }}>← Gestionale</a>}
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, overflow: 'auto', padding: '28px' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: '#71717a', gap: '10px' }}>
            <RefreshCw size={18} className="animate-spin" /> Caricamento…
          </div>
        ) : (
          <>
            {section === 'overview'    && OverviewSection()}
            {section === 'tenants'     && TenantsSection()}
            {section === 'tickets'     && TicketsSection()}
            {section === 'broadcasts'  && BroadcastsSection()}
            {section === 'flags'       && FlagsSection()}
            {section === 'audit'       && AuditSection()}
            {section === 'whatsapp'    && WhatsAppSection()}
            {section === 'sales'        && SalesSection()}
          </>
        )}
      </div>

      {/* Tenant modal */}
      {selTenant && TenantModal()}
    </div>
  );
}
