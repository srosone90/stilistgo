'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Plus, X, Mail, Phone, MessageSquare, FileText } from 'lucide-react';

interface CommLog {
  id: string; tenant_id: string; type: string; direction: string;
  subject: string; body: string; created_by: string; created_at: string;
}
interface Tenant { user_id: string; salon_name: string; email: string; }

const inp: React.CSSProperties = { width:'100%', background:'#12121a', border:'1px solid #2e2e40', borderRadius:'10px', padding:'9px 12px', color:'#f4f4f5', fontSize:'13px', outline:'none', boxSizing:'border-box' };
const sel: React.CSSProperties = { ...inp, cursor:'pointer', appearance:'none' as const };
const card = (e?: React.CSSProperties): React.CSSProperties => ({ background:'#1c1c27', border:'1px solid #2e2e40', borderRadius:'16px', padding:'20px', ...e });

const TYPE_ICONS: Record<string, React.ReactNode> = {
  email:    <Mail size={14} style={{ color:'#818cf8' }} />,
  chiamata: <Phone size={14} style={{ color:'#4ade80' }} />,
  sms:      <MessageSquare size={14} style={{ color:'#fbbf24' }} />,
  nota:     <FileText size={14} style={{ color:'#f87171' }} />,
};
const TYPE_COLORS: Record<string,string> = { email:'#818cf8', chiamata:'#4ade80', sms:'#fbbf24', nota:'#f87171' };

const fmtDT = (d: string) => new Date(d).toLocaleString('it-IT', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });

export default function CommsSection({ af }: { af: (url: string, opts?: RequestInit) => Promise<Response> }) {
  const [logs, setLogs] = useState<CommLog[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ tenant_id:'', type:'email', direction:'outbound', subject:'', body:'', created_by:'admin' });
  const [saving, setSaving] = useState(false);
  const [filterTenant, setFilterTenant] = useState('');
  const [filterType, setFilterType] = useState('');
  const [expandedLog, setExpandedLog] = useState<string|null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [lr, tr] = await Promise.all([af('/api/admin/comms'), af('/api/admin/tenants')]);
    const [ld, td] = await Promise.all([lr.json(), tr.json()]);
    setLogs(ld.logs ?? []);
    setTenants(td.tenants ?? []);
    setLoading(false);
  }, [af]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    const res = await af('/api/admin/comms', { method:'POST', body: JSON.stringify(form) });
    const d = await res.json();
    if (d.log) setLogs(prev => [d.log, ...prev]);
    setSaving(false); setModal(false);
    setForm({ tenant_id:'', type:'email', direction:'outbound', subject:'', body:'', created_by:'admin' });
  };

  const deleteLog = async (id: string) => {
    await af('/api/admin/comms', { method:'DELETE', body: JSON.stringify({ id }) });
    setLogs(prev => prev.filter(l => l.id !== id));
  };

  const filtered = logs.filter(l => {
    const matchTenant = !filterTenant || l.tenant_id === filterTenant;
    const matchType = !filterType || l.type === filterType;
    return matchTenant && matchType;
  });

  if (loading) return <p style={{ color:'#71717a', textAlign:'center', padding:'40px 0' }}>Caricamento comunicazioni…</p>;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'10px' }}>
        <div>
          <h2 style={{ color:'#f4f4f5', fontWeight:700, fontSize:'20px', margin:0 }}>Log Comunicazioni ({filtered.length})</h2>
          <p style={{ color:'#71717a', fontSize:'12px', margin:'4px 0 0' }}>Storico email, chiamate, SMS e note per ogni tenant</p>
        </div>
        <button onClick={() => setModal(true)} style={{ display:'flex', alignItems:'center', gap:'6px', padding:'8px 16px', borderRadius:'10px', border:'none', background:'linear-gradient(135deg,#f59e0b,#ef4444)', color:'white', fontWeight:600, fontSize:'13px', cursor:'pointer' }}>
          <Plus size={14} /> Registra comunicazione
        </button>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
        <select value={filterTenant} onChange={e => setFilterTenant(e.target.value)} style={{ ...sel, width:'200px' }}>
          <option value="">Tutti i tenant</option>
          {tenants.map(t => <option key={t.user_id} value={t.user_id}>{t.salon_name}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ ...sel, width:'140px' }}>
          <option value="">Tutti i tipi</option>
          {['email','chiamata','sms','nota'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
        </select>
      </div>

      {/* Log list */}
      <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
        {filtered.map(log => {
          const tenant = tenants.find(t => t.user_id === log.tenant_id);
          const expanded = expandedLog === log.id;
          return (
            <div key={log.id} style={card({ padding:'14px 18px', cursor:'pointer' })} onClick={() => setExpandedLog(expanded ? null : log.id)}>
              <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                <span style={{ flexShrink:0 }}>{TYPE_ICONS[log.type] ?? <Mail size={14}/>}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap' }}>
                    <span style={{ color:TYPE_COLORS[log.type] ?? '#818cf8', fontSize:'11px', fontWeight:600, textTransform:'uppercase' }}>{log.type}</span>
                    <span style={{ color: log.direction === 'outbound' ? '#4ade80' : '#818cf8', fontSize:'11px' }}>{log.direction === 'outbound' ? '↗ Uscente' : '↙ Entrante'}</span>
                    {tenant && <span style={{ color:'#a1a1aa', fontSize:'12px' }}>{tenant.salon_name}</span>}
                  </div>
                  <p style={{ color:'#f4f4f5', fontWeight:600, fontSize:'13px', margin:'4px 0 0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace: expanded ? 'normal' : 'nowrap' }}>{log.subject || '—'}</p>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', flexShrink:0 }}>
                  <span style={{ color:'#52525b', fontSize:'11px' }}>{fmtDT(log.created_at)}</span>
                  <button onClick={e => { e.stopPropagation(); deleteLog(log.id); }} style={{ background:'none', border:'none', color:'#3f3f5a', cursor:'pointer', padding:'2px' }}><X size={12}/></button>
                </div>
              </div>
              {expanded && log.body && (
                <div style={{ marginTop:'12px', paddingTop:'12px', borderTop:'1px solid #2e2e40' }}>
                  <p style={{ color:'#a1a1aa', fontSize:'13px', margin:0, whiteSpace:'pre-wrap' }}>{log.body}</p>
                  {log.created_by && <p style={{ color:'#52525b', fontSize:'11px', margin:'8px 0 0' }}>Da: {log.created_by}</p>}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && <div style={card({ textAlign:'center', color:'#3f3f5a', fontSize:'13px' })}>Nessuna comunicazione registrata.</div>}
      </div>

      {/* Modal */}
      {modal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center' }} onClick={() => setModal(false)}>
          <div style={{ width:'500px', background:'#1c1c27', border:'1px solid #2e2e40', borderRadius:'20px', padding:'24px', display:'flex', flexDirection:'column', gap:'14px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3 style={{ color:'#f4f4f5', fontWeight:700, margin:0 }}>Registra comunicazione</h3>
              <button onClick={() => setModal(false)} style={{ background:'none', border:'none', color:'#71717a', cursor:'pointer' }}><X size={18}/></button>
            </div>
            <div>
              <label style={{ display:'block', fontSize:'11px', color:'#71717a', marginBottom:'4px' }}>Cliente *</label>
              <select value={form.tenant_id} onChange={e => setForm(p => ({ ...p, tenant_id: e.target.value }))} style={sel}>
                <option value="">Seleziona tenant…</option>
                {tenants.map(t => <option key={t.user_id} value={t.user_id}>{t.salon_name} ({t.email})</option>)}
              </select>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
              <div>
                <label style={{ display:'block', fontSize:'11px', color:'#71717a', marginBottom:'4px' }}>Tipo</label>
                <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} style={sel}>
                  {['email','chiamata','sms','nota'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'11px', color:'#71717a', marginBottom:'4px' }}>Direzione</label>
                <select value={form.direction} onChange={e => setForm(p => ({ ...p, direction: e.target.value }))} style={sel}>
                  <option value="outbound">↗ Uscente (noi → cliente)</option>
                  <option value="inbound">↙ Entrante (cliente → noi)</option>
                </select>
              </div>
            </div>
            <div>
              <label style={{ display:'block', fontSize:'11px', color:'#71717a', marginBottom:'4px' }}>Oggetto</label>
              <input value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} style={inp} placeholder="Es. Benvenuto, rinnovo, follow-up…" />
            </div>
            <div>
              <label style={{ display:'block', fontSize:'11px', color:'#71717a', marginBottom:'4px' }}>Contenuto / Note</label>
              <textarea rows={4} value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))} style={{ ...inp, resize:'vertical' }} placeholder="Contenuto della comunicazione, note della chiamata…" />
            </div>
            <div>
              <label style={{ display:'block', fontSize:'11px', color:'#71717a', marginBottom:'4px' }}>Registrato da</label>
              <input value={form.created_by} onChange={e => setForm(p => ({ ...p, created_by: e.target.value }))} style={inp} placeholder="admin" />
            </div>
            <button onClick={save} disabled={saving || !form.tenant_id}
              style={{ padding:'11px', borderRadius:'12px', border:'none', background: !form.tenant_id ? '#2e2e40' : 'linear-gradient(135deg,#f59e0b,#ef4444)', color:'white', fontWeight:600, cursor:!form.tenant_id?'not-allowed':'pointer' }}>
              {saving ? 'Salvataggio…' : 'Registra'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
