'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Plus, X, Save, FileDown, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';

interface Invoice {
  id: string; tenant_id: string; number: string; amount: number; plan: string;
  period_start: string; period_end: string; status: string; notes: string;
  paid_at: string | null; created_at: string;
}
interface Tenant { user_id: string; salon_name: string; email: string; plan: string; monthly_price: number; }

const inp: React.CSSProperties = { width:'100%', background:'#12121a', border:'1px solid #2e2e40', borderRadius:'10px', padding:'9px 12px', color:'#f4f4f5', fontSize:'13px', outline:'none', boxSizing:'border-box' };
const card = (e?: React.CSSProperties): React.CSSProperties => ({ background:'#1c1c27', border:'1px solid #2e2e40', borderRadius:'16px', padding:'20px', ...e });
const INV_STATUS: Record<string,{bg:string;text:string;label:string}> = {
  pending:   { bg:'rgba(245,158,11,0.1)',  text:'#fbbf24', label:'Da pagare' },
  paid:      { bg:'rgba(34,197,94,0.1)',   text:'#4ade80', label:'Pagata' },
  overdue:   { bg:'rgba(239,68,68,0.1)',   text:'#f87171', label:'Scaduta' },
  cancelled: { bg:'rgba(113,113,122,0.1)', text:'#71717a', label:'Annullata' },
};

const PLAN_PRICES: Record<string, number> = { trial: 0, starter: 25, pro: 49, business: 99 };

const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('it-IT', { day:'2-digit', month:'2-digit', year:'numeric' }) : '—';
const fmtEur = (n: number) => `€${n.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`;

function Badge({ s, map }: { s: string; map: Record<string,{bg:string;text:string;label:string}> }) {
  const c = map[s] ?? { bg:'rgba(113,113,122,0.1)', text:'#71717a', label: s };
  return <span style={{ background:c.bg, color:c.text, borderRadius:'6px', padding:'2px 8px', fontSize:'11px', fontWeight:600, whiteSpace:'nowrap' }}>{c.label}</span>;
}

export default function InvoicesSection({ af }: { af: (url: string, opts?: RequestInit) => Promise<Response> }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [editModal, setEditModal] = useState<Invoice | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTenant, setFilterTenant] = useState('');
  const [form, setForm] = useState({ tenant_id:'', plan:'starter', amount:25, period_start:'', period_end:'', notes:'' });
  const [saving, setSaving] = useState(false);
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0,7));

  const load = useCallback(async () => {
    setLoading(true);
    const [ir, tr] = await Promise.all([af('/api/admin/invoices'), af('/api/admin/tenants')]);
    const [id, td] = await Promise.all([ir.json(), tr.json()]);
    setInvoices(id.invoices ?? []);
    setTenants(td.tenants ?? []);
    setLoading(false);
  }, [af]);

  useEffect(() => { load(); }, [load]);

  const createInvoice = async () => {
    setSaving(true);
    await af('/api/admin/invoices', { method:'POST', body: JSON.stringify(form) });
    setSaving(false); setModal(false);
    setForm({ tenant_id:'', plan:'starter', amount:25, period_start:'', period_end:'', notes:'' });
    load();
  };

  const updateStatus = async (inv: Invoice, status: string) => {
    await af('/api/admin/invoices', { method:'PATCH', body: JSON.stringify({ id: inv.id, status }) });
    setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, status, paid_at: status === 'paid' ? new Date().toISOString() : i.paid_at } : i));
  };

  const deleteInvoice = async (id: string) => {
    if (!confirm('Eliminare questa fattura?')) return;
    await af('/api/admin/invoices', { method:'DELETE', body: JSON.stringify({ id }) });
    setInvoices(prev => prev.filter(i => i.id !== id));
  };

  const downloadCsv = () => {
    window.open(`/api/admin/reports?type=csv&month=${reportMonth}`, '_blank');
  };

  const filtered = invoices.filter(i => {
    const matchStatus = !filterStatus || i.status === filterStatus;
    const matchTenant = !filterTenant || i.tenant_id === filterTenant;
    return matchStatus && matchTenant;
  });

  const totalPending = invoices.filter(i => i.status === 'pending').reduce((s, i) => s + i.amount, 0);
  const totalPaid    = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0);
  const totalOverdue = invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + i.amount, 0);

  const sel: React.CSSProperties = { ...inp, cursor:'pointer', appearance:'none' as const };

  if (loading) return <p style={{ color:'#71717a', textAlign:'center', padding:'40px 0' }}>Caricamento fatture…</p>;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'10px' }}>
        <h2 style={{ color:'#f4f4f5', fontWeight:700, fontSize:'20px', margin:0 }}>Fatturazione ({invoices.length})</h2>
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'6px', background:'#1c1c27', border:'1px solid #2e2e40', borderRadius:'10px', padding:'6px 10px' }}>
            <span style={{ color:'#71717a', fontSize:'12px' }}>CSV</span>
            <input type="month" value={reportMonth} onChange={e => setReportMonth(e.target.value)} style={{ ...inp, width:'130px', padding:'4px 8px' }} />
            <button onClick={downloadCsv} style={{ display:'flex', alignItems:'center', gap:'4px', background:'rgba(99,102,241,0.15)', border:'1px solid rgba(99,102,241,0.3)', borderRadius:'8px', padding:'5px 10px', color:'#818cf8', fontSize:'12px', cursor:'pointer' }}>
              <FileDown size={12} /> Export
            </button>
          </div>
          <button onClick={() => setModal(true)} style={{ display:'flex', alignItems:'center', gap:'6px', padding:'8px 16px', borderRadius:'10px', border:'none', background:'linear-gradient(135deg,#f59e0b,#ef4444)', color:'white', fontWeight:600, fontSize:'13px', cursor:'pointer' }}>
            <Plus size={14} /> Nuova fattura
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px' }}>
        {[
          { label:'Da pagare', value: fmtEur(totalPending), color:'#fbbf24', icon: <Clock size={14}/> },
          { label:'Incassato', value: fmtEur(totalPaid),    color:'#4ade80', icon: <CheckCircle2 size={14}/> },
          { label:'Scaduto',   value: fmtEur(totalOverdue), color:'#f87171', icon: <AlertTriangle size={14}/> },
        ].map(k => (
          <div key={k.label} style={card({ padding:'14px 16px', display:'flex', alignItems:'center', gap:'12px' })}>
            <span style={{ color: k.color }}>{k.icon}</span>
            <div>
              <p style={{ color: k.color, fontSize:'20px', fontWeight:700, margin:0 }}>{k.value}</p>
              <p style={{ color:'#71717a', fontSize:'11px', margin:0 }}>{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...sel, width:'150px' }}>
          <option value="">Tutti gli stati</option>
          {Object.entries(INV_STATUS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filterTenant} onChange={e => setFilterTenant(e.target.value)} style={{ ...sel, width:'180px' }}>
          <option value="">Tutti i tenant</option>
          {tenants.map(t => <option key={t.user_id} value={t.user_id}>{t.salon_name}</option>)}
        </select>
      </div>

      {/* Table */}
      <div style={card({ padding:0, overflow:'hidden' })}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
            <thead>
              <tr style={{ borderBottom:'1px solid #2e2e40' }}>
                {['N°','Salone','Piano','Periodo','Importo','Stato','Pagata il','Azioni'].map(h => (
                  <th key={h} style={{ padding:'12px 14px', textAlign:'left', color:'#71717a', fontWeight:500, fontSize:'11px', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(inv => {
                const t = tenants.find(t => t.user_id === inv.tenant_id);
                return (
                  <tr key={inv.id} style={{ borderBottom:'1px solid #1e1e2a' }}>
                    <td style={{ padding:'12px 14px', color:'#818cf8', fontWeight:600, fontFamily:'monospace' }}>{inv.number}</td>
                    <td style={{ padding:'12px 14px', color:'#f4f4f5', fontWeight:600 }}>{t?.salon_name ?? inv.tenant_id.slice(0,10)}</td>
                    <td style={{ padding:'12px 14px', color:'#a1a1aa' }}>{inv.plan}</td>
                    <td style={{ padding:'12px 14px', color:'#71717a', fontSize:'12px', whiteSpace:'nowrap' }}>{fmtDate(inv.period_start)} → {fmtDate(inv.period_end)}</td>
                    <td style={{ padding:'12px 14px', color:'#f4f4f5', fontWeight:600 }}>{fmtEur(inv.amount)}</td>
                    <td style={{ padding:'12px 14px' }}><Badge s={inv.status} map={INV_STATUS} /></td>
                    <td style={{ padding:'12px 14px', color:'#71717a', fontSize:'12px' }}>{fmtDate(inv.paid_at)}</td>
                    <td style={{ padding:'12px 14px' }}>
                      <div style={{ display:'flex', gap:'4px' }}>
                        {inv.status === 'pending' && (
                          <button onClick={() => updateStatus(inv, 'paid')} style={{ background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.3)', borderRadius:'6px', padding:'3px 8px', color:'#4ade80', fontSize:'11px', cursor:'pointer' }}>✓ Pagata</button>
                        )}
                        {inv.status === 'pending' && (
                          <button onClick={() => updateStatus(inv, 'overdue')} style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)', borderRadius:'6px', padding:'3px 8px', color:'#f87171', fontSize:'11px', cursor:'pointer' }}>Scaduta</button>
                        )}
                        <button onClick={() => deleteInvoice(inv.id)} style={{ background:'none', border:'none', color:'#52525b', cursor:'pointer', padding:'3px 6px' }}><X size={13}/></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} style={{ padding:'24px', textAlign:'center', color:'#3f3f5a' }}>Nessuna fattura trovata.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create modal */}
      {modal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center' }} onClick={() => setModal(false)}>
          <div style={{ width:'460px', background:'#1c1c27', border:'1px solid #2e2e40', borderRadius:'20px', padding:'24px', display:'flex', flexDirection:'column', gap:'14px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3 style={{ color:'#f4f4f5', fontWeight:700, margin:0 }}>Nuova fattura</h3>
              <button onClick={() => setModal(false)} style={{ background:'none', border:'none', color:'#71717a', cursor:'pointer' }}><X size={18}/></button>
            </div>
            <div>
              <label style={{ display:'block', fontSize:'11px', color:'#71717a', marginBottom:'4px' }}>Cliente</label>
              <select value={form.tenant_id} onChange={e => {
                const t = tenants.find(t => t.user_id === e.target.value);
                setForm(p => ({ ...p, tenant_id: e.target.value, plan: t?.plan ?? 'starter', amount: PLAN_PRICES[t?.plan ?? 'starter'] ?? 25 }));
              }} style={{ ...sel }}>
                <option value="">Seleziona tenant…</option>
                {tenants.map(t => <option key={t.user_id} value={t.user_id}>{t.salon_name} — {t.email}</option>)}
              </select>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
              <div>
                <label style={{ display:'block', fontSize:'11px', color:'#71717a', marginBottom:'4px' }}>Piano</label>
                <select value={form.plan} onChange={e => setForm(p => ({ ...p, plan: e.target.value, amount: PLAN_PRICES[e.target.value] ?? 0 }))} style={{ ...sel }}>
                  {['trial','starter','pro','business'].map(p => <option key={p} value={p}>{p} — €{PLAN_PRICES[p]}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'11px', color:'#71717a', marginBottom:'4px' }}>Importo (€)</label>
                <input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: parseFloat(e.target.value) || 0 }))} style={inp} />
              </div>
              <div>
                <label style={{ display:'block', fontSize:'11px', color:'#71717a', marginBottom:'4px' }}>Periodo dal</label>
                <input type="date" value={form.period_start} onChange={e => setForm(p => ({ ...p, period_start: e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={{ display:'block', fontSize:'11px', color:'#71717a', marginBottom:'4px' }}>Periodo al</label>
                <input type="date" value={form.period_end} onChange={e => setForm(p => ({ ...p, period_end: e.target.value }))} style={inp} />
              </div>
            </div>
            <div>
              <label style={{ display:'block', fontSize:'11px', color:'#71717a', marginBottom:'4px' }}>Note</label>
              <textarea rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} style={{ ...inp, resize:'vertical' }} />
            </div>
            <button onClick={createInvoice} disabled={saving || !form.tenant_id || !form.period_start}
              style={{ padding:'11px', borderRadius:'12px', border:'none', background: (!form.tenant_id||!form.period_start) ? '#2e2e40' : 'linear-gradient(135deg,#f59e0b,#ef4444)', color:'white', fontWeight:600, cursor:(!form.tenant_id||!form.period_start)?'not-allowed':'pointer' }}>
              {saving ? 'Salvataggio…' : 'Crea fattura'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
