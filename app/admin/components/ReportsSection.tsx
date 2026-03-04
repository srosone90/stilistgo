'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { FileDown, RefreshCw, Plus, X } from 'lucide-react';

interface MonthlyReport {
  month: string; activeTenants: number; trialTenants: number;
  mrr: number; arr: number; invoicedTotal: number; paidTotal: number;
  pendingTotal: number; overdueTotal: number; invoiceCount: number; paymentCount: number;
}
interface Payment {
  id: string; tenant_id: string; invoice_id: string | null; amount: number;
  method: string; date: string; reference: string; notes: string; created_at: string;
}
interface Tenant { user_id: string; salon_name: string; }
interface Invoice { id: string; number: string; tenant_id: string; amount: number; }

const inp: React.CSSProperties = { width:'100%', background:'#12121a', border:'1px solid #2e2e40', borderRadius:'10px', padding:'9px 12px', color:'#f4f4f5', fontSize:'13px', outline:'none', boxSizing:'border-box' };
const sel: React.CSSProperties = { ...inp, cursor:'pointer', appearance:'none' as const };
const card = (e?: React.CSSProperties): React.CSSProperties => ({ background:'#1c1c27', border:'1px solid #2e2e40', borderRadius:'16px', padding:'20px', ...e });
const fmtDate = (d: string) => new Date(d).toLocaleDateString('it-IT', { day:'2-digit', month:'2-digit', year:'numeric' });
const fmtEur = (n: number) => `€${n.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`;

const METHOD_LABELS: Record<string,string> = { bonifico:'Bonifico', carta:'Carta', contanti:'Contanti', altro:'Altro' };

export default function ReportsSection({ af }: { af: (url: string, opts?: RequestInit) => Promise<Response> }) {
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ tenant_id:'', invoice_id:'', amount:0, method:'bonifico', date: new Date().toISOString().slice(0,10), reference:'', notes:'' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [rr, pr, tr, ir] = await Promise.all([
      af(`/api/admin/reports?month=${month}`),
      af('/api/admin/payments'),
      af('/api/admin/tenants'),
      af('/api/admin/invoices'),
    ]);
    const [rd, pd, td, invd] = await Promise.all([rr.json(), pr.json(), tr.json(), ir.json()]);
    setReport(rd);
    setPayments(pd.payments ?? []);
    setTenants(td.tenants ?? []);
    setInvoices(invd.invoices ?? []);
    setLoading(false);
  }, [af, month]);

  useEffect(() => { load(); }, [load]);

  const registerPayment = async () => {
    setSaving(true);
    const res = await af('/api/admin/payments', { method:'POST', body: JSON.stringify({ ...form, invoice_id: form.invoice_id || null }) });
    const d = await res.json();
    if (d.payment) {
      setPayments(prev => [d.payment, ...prev]);
      // Mark invoice as paid if selected
      if (form.invoice_id) {
        await af('/api/admin/invoices', { method:'PATCH', body: JSON.stringify({ id: form.invoice_id, status:'paid' }) });
      }
    }
    setSaving(false); setModal(false);
  };

  const deletePayment = async (id: string) => {
    if (!confirm('Eliminare questo pagamento?')) return;
    await af('/api/admin/payments', { method:'DELETE', body: JSON.stringify({ id }) });
    setPayments(prev => prev.filter(p => p.id !== id));
  };

  const downloadCsv = () => window.open(`/api/admin/reports?type=csv&month=${month}`, '_blank');

  const tenantInvoices = invoices.filter(i => i.tenant_id === form.tenant_id);
  const totalPaymentsMonth = payments.filter(p => p.date?.slice(0,7) === month).reduce((s,p) => s+p.amount,0);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'10px' }}>
        <h2 style={{ color:'#f4f4f5', fontWeight:700, fontSize:'20px', margin:0 }}>Report Mensile & Pagamenti</h2>
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', alignItems:'center' }}>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ ...inp, width:'150px' }} />
          <button onClick={load} style={{ display:'flex', alignItems:'center', gap:'5px', background:'none', border:'1px solid #2e2e40', borderRadius:'8px', padding:'7px 12px', color:'#71717a', cursor:'pointer', fontSize:'12px' }}>
            <RefreshCw size={12}/> Aggiorna
          </button>
          <button onClick={downloadCsv} style={{ display:'flex', alignItems:'center', gap:'5px', background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.3)', borderRadius:'8px', padding:'7px 12px', color:'#818cf8', cursor:'pointer', fontSize:'12px' }}>
            <FileDown size={12}/> CSV Fatture
          </button>
          <button onClick={() => { setForm({ tenant_id:'', invoice_id:'', amount:0, method:'bonifico', date: new Date().toISOString().slice(0,10), reference:'', notes:'' }); setModal(true); }}
            style={{ display:'flex', alignItems:'center', gap:'6px', padding:'8px 16px', borderRadius:'10px', border:'none', background:'linear-gradient(135deg,#f59e0b,#ef4444)', color:'white', fontWeight:600, fontSize:'13px', cursor:'pointer' }}>
            <Plus size={14}/> Registra pagamento
          </button>
        </div>
      </div>

      {/* Summary KPIs */}
      {report && !loading && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:'12px' }}>
          {[
            { label:'Tenant attivi', value: report.activeTenants, color:'#4ade80' },
            { label:'MRR', value:`€${report.mrr}`, color:'#818cf8' },
            { label:'Fatturato mese', value: fmtEur(report.invoicedTotal), color:'#f4f4f5' },
            { label:'Pagato', value: fmtEur(report.paidTotal), color:'#4ade80' },
            { label:'In sospeso', value: fmtEur(report.pendingTotal), color:'#fbbf24' },
            { label:'Scaduto', value: fmtEur(report.overdueTotal), color:'#f87171' },
          ].map(k => (
            <div key={k.label} style={card({ padding:'14px 16px' })}>
              <p style={{ color:'#71717a', fontSize:'11px', margin:'0 0 6px' }}>{k.label}</p>
              <p style={{ color: k.color, fontSize:'20px', fontWeight:700, margin:0 }}>{k.value}</p>
            </div>
          ))}
        </div>
      )}

      {loading && <p style={{ color:'#71717a', textAlign:'center', padding:'20px 0' }}>Caricamento…</p>}

      {/* Payments received list */}
      <div style={card({ padding:0, overflow:'hidden' })}>
        <div style={{ padding:'16px 18px', borderBottom:'1px solid #2e2e40', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <p style={{ color:'#f4f4f5', fontWeight:600, fontSize:'14px', margin:0 }}>Pagamenti ricevuti</p>
          <p style={{ color:'#4ade80', fontWeight:700, fontSize:'14px', margin:0 }}>Totale mese: {fmtEur(totalPaymentsMonth)}</p>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
            <thead>
              <tr style={{ borderBottom:'1px solid #2e2e40' }}>
                {['Data','Salone','Importo','Metodo','Fattura','Riferimento',''].map(h => (
                  <th key={h} style={{ padding:'12px 14px', textAlign:'left', color:'#71717a', fontWeight:500, fontSize:'11px', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payments.map(p => {
                const t = tenants.find(t => t.user_id === p.tenant_id);
                const inv = invoices.find(i => i.id === p.invoice_id);
                return (
                  <tr key={p.id} style={{ borderBottom:'1px solid #1e1e2a' }}>
                    <td style={{ padding:'12px 14px', color:'#a1a1aa', whiteSpace:'nowrap' }}>{fmtDate(p.date)}</td>
                    <td style={{ padding:'12px 14px', color:'#f4f4f5', fontWeight:600 }}>{t?.salon_name ?? p.tenant_id.slice(0,10)}</td>
                    <td style={{ padding:'12px 14px', color:'#4ade80', fontWeight:600 }}>{fmtEur(p.amount)}</td>
                    <td style={{ padding:'12px 14px', color:'#a1a1aa' }}>{METHOD_LABELS[p.method] ?? p.method}</td>
                    <td style={{ padding:'12px 14px', color:'#818cf8', fontSize:'12px', fontFamily:'monospace' }}>{inv?.number ?? '—'}</td>
                    <td style={{ padding:'12px 14px', color:'#71717a', fontSize:'12px' }}>{p.reference || '—'}</td>
                    <td style={{ padding:'12px 14px' }}>
                      <button onClick={() => deletePayment(p.id)} style={{ background:'none', border:'none', color:'#52525b', cursor:'pointer', padding:'3px' }}><X size={13}/></button>
                    </td>
                  </tr>
                );
              })}
              {payments.length === 0 && (
                <tr><td colSpan={7} style={{ padding:'24px', textAlign:'center', color:'#3f3f5a' }}>Nessun pagamento registrato.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Register payment modal */}
      {modal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center' }} onClick={() => setModal(false)}>
          <div style={{ width:'460px', background:'#1c1c27', border:'1px solid #2e2e40', borderRadius:'20px', padding:'24px', display:'flex', flexDirection:'column', gap:'14px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3 style={{ color:'#f4f4f5', fontWeight:700, margin:0 }}>Registra pagamento ricevuto</h3>
              <button onClick={() => setModal(false)} style={{ background:'none', border:'none', color:'#71717a', cursor:'pointer' }}><X size={18}/></button>
            </div>
            <div>
              <label style={{ display:'block', fontSize:'11px', color:'#71717a', marginBottom:'4px' }}>Cliente *</label>
              <select value={form.tenant_id} onChange={e => setForm(p => ({ ...p, tenant_id: e.target.value, invoice_id:'' }))} style={sel}>
                <option value="">Seleziona tenant…</option>
                {tenants.map(t => <option key={t.user_id} value={t.user_id}>{t.salon_name}</option>)}
              </select>
            </div>
            {form.tenant_id && tenantInvoices.length > 0 && (
              <div>
                <label style={{ display:'block', fontSize:'11px', color:'#71717a', marginBottom:'4px' }}>Fattura collegata (opzionale)</label>
                <select value={form.invoice_id} onChange={e => {
                  const inv = invoices.find(i => i.id === e.target.value);
                  setForm(p => ({ ...p, invoice_id: e.target.value, amount: inv?.amount ?? p.amount }));
                }} style={sel}>
                  <option value="">— Nessuna —</option>
                  {tenantInvoices.map(i => <option key={i.id} value={i.id}>{i.number} — €{i.amount}</option>)}
                </select>
              </div>
            )}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
              <div>
                <label style={{ display:'block', fontSize:'11px', color:'#71717a', marginBottom:'4px' }}>Importo (€) *</label>
                <input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: parseFloat(e.target.value)||0 }))} style={inp} />
              </div>
              <div>
                <label style={{ display:'block', fontSize:'11px', color:'#71717a', marginBottom:'4px' }}>Metodo</label>
                <select value={form.method} onChange={e => setForm(p => ({ ...p, method: e.target.value }))} style={sel}>
                  {Object.entries(METHOD_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'11px', color:'#71717a', marginBottom:'4px' }}>Data</label>
                <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={{ display:'block', fontSize:'11px', color:'#71717a', marginBottom:'4px' }}>Riferimento</label>
                <input value={form.reference} onChange={e => setForm(p => ({ ...p, reference: e.target.value }))} style={inp} placeholder="Es. RID, n. bonifico" />
              </div>
            </div>
            <div>
              <label style={{ display:'block', fontSize:'11px', color:'#71717a', marginBottom:'4px' }}>Note</label>
              <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} style={inp} />
            </div>
            <button onClick={registerPayment} disabled={saving || !form.tenant_id || form.amount <= 0}
              style={{ padding:'11px', borderRadius:'12px', border:'none', background: (!form.tenant_id||form.amount<=0) ? '#2e2e40' : 'linear-gradient(135deg,#f59e0b,#ef4444)', color:'white', fontWeight:600, cursor:(!form.tenant_id||form.amount<=0)?'not-allowed':'pointer' }}>
              {saving ? 'Salvataggio…' : 'Registra pagamento'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
