'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Plus, X, TrendingUp, ArrowRight } from 'lucide-react';

interface Lead {
  id: string; tenant_id: string | null; company_name: string; contact_name: string;
  email: string; phone: string; stage: string; plan_interest: string; notes: string;
  csm: string; estimated_mrr: number; created_at: string; updated_at: string;
}

const inp: React.CSSProperties = { width:'100%', background:'#12121a', border:'1px solid #2e2e40', borderRadius:'10px', padding:'9px 12px', color:'#f4f4f5', fontSize:'13px', outline:'none', boxSizing:'border-box' };
const sel: React.CSSProperties = { ...inp, cursor:'pointer', appearance:'none' as const };
const card = (e?: React.CSSProperties): React.CSSProperties => ({ background:'#1c1c27', border:'1px solid #2e2e40', borderRadius:'16px', padding:'20px', ...e });

const STAGES = ['lead','demo','trial','paying','churned'];
const STAGE_META: Record<string,{label:string;color:string;bg:string}> = {
  lead:    { label:'Lead',      color:'#71717a', bg:'rgba(113,113,122,0.15)' },
  demo:    { label:'Demo',      color:'#818cf8', bg:'rgba(99,102,241,0.15)' },
  trial:   { label:'Trial',     color:'#fbbf24', bg:'rgba(245,158,11,0.15)' },
  paying:  { label:'Cliente',   color:'#4ade80', bg:'rgba(34,197,94,0.15)' },
  churned: { label:'Perso',     color:'#f87171', bg:'rgba(239,68,68,0.15)' },
};

const fmtDate = (d: string) => new Date(d).toLocaleDateString('it-IT', { day:'2-digit', month:'2-digit', year:'numeric' });

export default function PipelineSection({ af }: { af: (url: string, opts?: RequestInit) => Promise<Response> }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [form, setForm] = useState<Partial<Lead>>({ stage:'lead', estimated_mrr:0 });
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<'kanban'|'list'>('kanban');
  const [dragging, setDragging] = useState<string|null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await af('/api/admin/pipeline');
    const d = await res.json();
    setLeads(d.leads ?? []);
    setLoading(false);
  }, [af]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setForm({ stage:'lead', estimated_mrr:0 }); setEditLead(null); setModal(true); };
  const openEdit = (l: Lead) => { setEditLead(l); setForm({ ...l }); setModal(true); };

  const save = async () => {
    setSaving(true);
    if (editLead) {
      await af('/api/admin/pipeline', { method:'PATCH', body: JSON.stringify({ id: editLead.id, ...form }) });
      setLeads(prev => prev.map(l => l.id === editLead.id ? { ...l, ...form } as Lead : l));
    } else {
      const res = await af('/api/admin/pipeline', { method:'POST', body: JSON.stringify(form) });
      const d = await res.json();
      if (d.lead) setLeads(prev => [d.lead, ...prev]);
    }
    setSaving(false); setModal(false);
  };

  const deleteLead = async (id: string) => {
    if (!confirm('Eliminare questo lead?')) return;
    await af('/api/admin/pipeline', { method:'DELETE', body: JSON.stringify({ id }) });
    setLeads(prev => prev.filter(l => l.id !== id));
  };

  const moveStage = async (id: string, stage: string) => {
    await af('/api/admin/pipeline', { method:'PATCH', body: JSON.stringify({ id, stage }) });
    setLeads(prev => prev.map(l => l.id === id ? { ...l, stage } : l));
  };

  const mrrByStage = (stage: string) => leads.filter(l => l.stage === stage).reduce((s, l) => s + (l.estimated_mrr ?? 0), 0);

  if (loading) return <p style={{ color:'#71717a', textAlign:'center', padding:'40px 0' }}>Caricamento pipeline…</p>;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'10px' }}>
        <div>
          <h2 style={{ color:'#f4f4f5', fontWeight:700, fontSize:'20px', margin:0 }}>Pipeline Vendite</h2>
          <p style={{ color:'#71717a', fontSize:'12px', margin:'4px 0 0' }}>Trascina i lead tra le colonne per aggiornare lo stage</p>
        </div>
        <div style={{ display:'flex', gap:'8px' }}>
          <div style={{ display:'flex', background:'#12121a', border:'1px solid #2e2e40', borderRadius:'10px', overflow:'hidden' }}>
            {(['kanban','list'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{ padding:'7px 14px', border:'none', background: view === v ? '#1c1c27' : 'transparent', color: view === v ? '#f4f4f5' : '#71717a', fontSize:'12px', cursor:'pointer', fontWeight: view === v ? 600 : 400 }}>
                {v === 'kanban' ? '⬜ Kanban' : '☰ Lista'}
              </button>
            ))}
          </div>
          <button onClick={openNew} style={{ display:'flex', alignItems:'center', gap:'6px', padding:'8px 16px', borderRadius:'10px', border:'none', background:'linear-gradient(135deg,#f59e0b,#ef4444)', color:'white', fontWeight:600, fontSize:'13px', cursor:'pointer' }}>
            <Plus size={14} /> Nuovo lead
          </button>
        </div>
      </div>

      {/* MRR summary */}
      <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
        {STAGES.filter(s => s !== 'churned').map(s => (
          <div key={s} style={{ background: STAGE_META[s].bg, borderRadius:'10px', padding:'8px 14px', display:'flex', gap:'10px', alignItems:'center' }}>
            <span style={{ color: STAGE_META[s].color, fontSize:'11px', fontWeight:600 }}>{STAGE_META[s].label}</span>
            <span style={{ color:'#f4f4f5', fontSize:'13px', fontWeight:700 }}>€{mrrByStage(s)}/m</span>
          </div>
        ))}
        <div style={{ display:'flex', alignItems:'center', gap:'6px', marginLeft:'auto' }}>
          <TrendingUp size={14} style={{ color:'#818cf8' }} />
          <span style={{ color:'#818cf8', fontWeight:700, fontSize:'13px' }}>MRR potenziale: €{leads.filter(l => l.stage !== 'churned').reduce((s,l) => s+(l.estimated_mrr??0),0)}/mese</span>
        </div>
      </div>

      {view === 'kanban' ? (
        /* Kanban */
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'12px', alignItems:'start' }}>
          {STAGES.map(stage => {
            const stageLeads = leads.filter(l => l.stage === stage);
            const meta = STAGE_META[stage];
            return (
              <div key={stage}
                style={{ background:'#13131e', border:`1px solid ${meta.bg}`, borderRadius:'14px', padding:'12px', minHeight:'100px' }}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); if (dragging) moveStage(dragging, stage); setDragging(null); }}
              >
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px' }}>
                  <span style={{ color: meta.color, fontWeight:700, fontSize:'12px' }}>{meta.label}</span>
                  <span style={{ background: meta.bg, color: meta.color, borderRadius:'10px', padding:'1px 7px', fontSize:'11px' }}>{stageLeads.length}</span>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                  {stageLeads.map(l => (
                    <div key={l.id}
                      draggable
                      onDragStart={() => setDragging(l.id)}
                      onDragEnd={() => setDragging(null)}
                      onClick={() => openEdit(l)}
                      style={{ background:'#1c1c27', border:'1px solid #2e2e40', borderRadius:'10px', padding:'10px', cursor:'grab', transition:'opacity 0.15s', opacity: dragging === l.id ? 0.5 : 1 }}>
                      <p style={{ color:'#f4f4f5', fontWeight:600, fontSize:'12px', margin:'0 0 2px' }}>{l.company_name}</p>
                      {l.contact_name && <p style={{ color:'#71717a', fontSize:'11px', margin:'0 0 4px' }}>{l.contact_name}</p>}
                      {l.estimated_mrr > 0 && <p style={{ color:'#4ade80', fontSize:'11px', fontWeight:600, margin:0 }}>€{l.estimated_mrr}/mese</p>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List view */
        <div style={card({ padding:0, overflow:'hidden' })}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
            <thead>
              <tr style={{ borderBottom:'1px solid #2e2e40' }}>
                {['Azienda','Contatto','Email','Stage','Piano','MRR est.','CSM','Azioni'].map(h => (
                  <th key={h} style={{ padding:'12px 14px', textAlign:'left', color:'#71717a', fontWeight:500, fontSize:'11px', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leads.map(l => {
                const meta = STAGE_META[l.stage] ?? STAGE_META.lead;
                return (
                  <tr key={l.id} style={{ borderBottom:'1px solid #1e1e2a' }}>
                    <td style={{ padding:'12px 14px', color:'#f4f4f5', fontWeight:600 }}>{l.company_name}</td>
                    <td style={{ padding:'12px 14px', color:'#a1a1aa' }}>{l.contact_name || '—'}</td>
                    <td style={{ padding:'12px 14px', color:'#71717a', fontSize:'12px' }}>{l.email || '—'}</td>
                    <td style={{ padding:'12px 14px' }}>
                      <span style={{ background: meta.bg, color: meta.color, borderRadius:'6px', padding:'2px 8px', fontSize:'11px', fontWeight:600 }}>{meta.label}</span>
                    </td>
                    <td style={{ padding:'12px 14px', color:'#a1a1aa' }}>{l.plan_interest || '—'}</td>
                    <td style={{ padding:'12px 14px', color: l.estimated_mrr > 0 ? '#4ade80' : '#52525b', fontWeight: l.estimated_mrr > 0 ? 600 : 400 }}>
                      {l.estimated_mrr > 0 ? `€${l.estimated_mrr}/m` : '—'}
                    </td>
                    <td style={{ padding:'12px 14px', color:'#71717a', fontSize:'12px' }}>{l.csm || '—'}</td>
                    <td style={{ padding:'12px 14px' }}>
                      <div style={{ display:'flex', gap:'4px' }}>
                        <button onClick={() => openEdit(l)} style={{ background:'none', border:'1px solid #2e2e40', borderRadius:'6px', padding:'4px 10px', color:'#818cf8', fontSize:'11px', cursor:'pointer' }}>Modifica</button>
                        <button onClick={() => deleteLead(l.id)} style={{ background:'none', border:'none', color:'#52525b', cursor:'pointer', padding:'4px' }}><X size={13}/></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {leads.length === 0 && <tr><td colSpan={8} style={{ padding:'24px', textAlign:'center', color:'#3f3f5a' }}>Nessun lead in pipeline.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit/Create modal */}
      {modal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center' }} onClick={() => setModal(false)}>
          <div style={{ width:'520px', maxHeight:'90vh', overflowY:'auto', background:'#1c1c27', border:'1px solid #2e2e40', borderRadius:'20px', padding:'24px', display:'flex', flexDirection:'column', gap:'14px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3 style={{ color:'#f4f4f5', fontWeight:700, margin:0 }}>{editLead ? 'Modifica lead' : 'Nuovo lead'}</h3>
              <button onClick={() => setModal(false)} style={{ background:'none', border:'none', color:'#71717a', cursor:'pointer' }}><X size={18}/></button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
              {[['Azienda / Nome salone','company_name'],['Contatto','contact_name'],['Email','email'],['Telefono','phone'],['CSM','csm']].map(([l,k]) => (
                <div key={k} style={{ gridColumn: k === 'company_name' ? '1/-1' : 'auto' }}>
                  <label style={{ display:'block', fontSize:'11px', color:'#71717a', marginBottom:'4px' }}>{l}</label>
                  <input value={(form as Record<string,unknown>)[k] as string ?? ''} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} style={inp} />
                </div>
              ))}
              <div>
                <label style={{ display:'block', fontSize:'11px', color:'#71717a', marginBottom:'4px' }}>Stage</label>
                <select value={form.stage ?? 'lead'} onChange={e => setForm(p => ({ ...p, stage: e.target.value }))} style={sel}>
                  {STAGES.map(s => <option key={s} value={s}>{STAGE_META[s].label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'11px', color:'#71717a', marginBottom:'4px' }}>Piano interesse</label>
                <select value={form.plan_interest ?? ''} onChange={e => setForm(p => ({ ...p, plan_interest: e.target.value }))} style={sel}>
                  <option value="">—</option>
                  {['starter','pro','business'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={{ display:'block', fontSize:'11px', color:'#71717a', marginBottom:'4px' }}>MRR stimato (€/mese)</label>
                <input type="number" value={form.estimated_mrr ?? 0} onChange={e => setForm(p => ({ ...p, estimated_mrr: parseFloat(e.target.value) || 0 }))} style={inp} />
              </div>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={{ display:'block', fontSize:'11px', color:'#71717a', marginBottom:'4px' }}>Note</label>
                <textarea rows={3} value={form.notes ?? ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} style={{ ...inp, resize:'vertical' }} />
              </div>
            </div>
            <button onClick={save} disabled={saving || !form.company_name}
              style={{ padding:'11px', borderRadius:'12px', border:'none', background: !form.company_name ? '#2e2e40' : 'linear-gradient(135deg,#f59e0b,#ef4444)', color:'white', fontWeight:600, cursor:!form.company_name?'not-allowed':'pointer' }}>
              {saving ? 'Salvataggio…' : editLead ? 'Salva modifiche' : 'Aggiungi lead'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
