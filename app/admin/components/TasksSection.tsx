'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Plus, X, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';

interface Task {
  id: string; tenant_id: string | null; title: string; description: string;
  due_date: string | null; assigned_to: string; status: string; priority: string;
  created_at: string; completed_at: string | null;
}
interface Tenant { user_id: string; salon_name: string; }

const inp: React.CSSProperties = { width:'100%', background:'#12121a', border:'1px solid #2e2e40', borderRadius:'10px', padding:'9px 12px', color:'#f4f4f5', fontSize:'13px', outline:'none', boxSizing:'border-box' };
const sel: React.CSSProperties = { ...inp, cursor:'pointer', appearance:'none' as const };
const card = (e?: React.CSSProperties): React.CSSProperties => ({ background:'#1c1c27', border:'1px solid #2e2e40', borderRadius:'16px', padding:'20px', ...e });

const PRIO: Record<string,{color:string;label:string}> = {
  bassa:   { color:'#71717a', label:'Bassa' },
  normale: { color:'#818cf8', label:'Normale' },
  alta:    { color:'#fbbf24', label:'Alta' },
  urgente: { color:'#f87171', label:'Urgente' },
};

const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('it-IT', { day:'2-digit', month:'2-digit', year:'numeric' }) : '—';
const isOverdue = (d: string | null) => d ? new Date(d) < new Date() : false;

export default function TasksSection({ af }: { af: (url: string, opts?: RequestInit) => Promise<Response> }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [form, setForm] = useState<Partial<Task>>({ priority:'normale', status:'open' });
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState('open');
  const [filterPriority, setFilterPriority] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [tr, tnr] = await Promise.all([af('/api/admin/tasks'), af('/api/admin/tenants')]);
    const [td, tnd] = await Promise.all([tr.json(), tnr.json()]);
    setTasks(td.tasks ?? []);
    setTenants(tnd.tenants ?? []);
    setLoading(false);
  }, [af]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setForm({ priority:'normale', status:'open' }); setEditTask(null); setModal(true); };
  const openEdit = (t: Task) => { setEditTask(t); setForm({ ...t }); setModal(true); };

  const save = async () => {
    setSaving(true);
    if (editTask) {
      await af('/api/admin/tasks', { method:'PATCH', body: JSON.stringify({ id: editTask.id, ...form }) });
      setTasks(prev => prev.map(t => t.id === editTask.id ? { ...t, ...form } as Task : t));
    } else {
      const res = await af('/api/admin/tasks', { method:'POST', body: JSON.stringify(form) });
      const d = await res.json();
      if (d.task) setTasks(prev => [...prev, d.task]);
    }
    setSaving(false); setModal(false);
  };

  const toggleDone = async (task: Task) => {
    const newStatus = task.status === 'done' ? 'open' : 'done';
    await af('/api/admin/tasks', { method:'PATCH', body: JSON.stringify({ id: task.id, status: newStatus }) });
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus, completed_at: newStatus === 'done' ? new Date().toISOString() : null } : t));
  };

  const deleteTask = async (id: string) => {
    await af('/api/admin/tasks', { method:'DELETE', body: JSON.stringify({ id }) });
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const filtered = tasks.filter(t => {
    const matchStatus = !filterStatus || t.status === filterStatus;
    const matchPriority = !filterPriority || t.priority === filterPriority;
    return matchStatus && matchPriority;
  });

  const openCount = tasks.filter(t => t.status === 'open').length;
  const overdueCount = tasks.filter(t => t.status === 'open' && isOverdue(t.due_date)).length;
  const urgentCount = tasks.filter(t => t.status === 'open' && t.priority === 'urgente').length;

  if (loading) return <p style={{ color:'#71717a', textAlign:'center', padding:'40px 0' }}>Caricamento task…</p>;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'10px' }}>
        <h2 style={{ color:'#f4f4f5', fontWeight:700, fontSize:'20px', margin:0 }}>Task & Attività</h2>
        <button onClick={openNew} style={{ display:'flex', alignItems:'center', gap:'6px', padding:'8px 16px', borderRadius:'10px', border:'none', background:'linear-gradient(135deg,#f59e0b,#ef4444)', color:'white', fontWeight:600, fontSize:'13px', cursor:'pointer' }}>
          <Plus size={14} /> Nuovo task
        </button>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px' }}>
        {[
          { label:'Aperti', value: openCount, color:'#818cf8', icon:<Clock size={14}/> },
          { label:'Scaduti', value: overdueCount, color:'#f87171', icon:<AlertTriangle size={14}/> },
          { label:'Urgenti', value: urgentCount, color:'#fbbf24', icon:<AlertTriangle size={14}/> },
        ].map(k => (
          <div key={k.label} style={card({ padding:'14px 16px', display:'flex', alignItems:'center', gap:'12px' })}>
            <span style={{ color:k.color }}>{k.icon}</span>
            <div>
              <p style={{ color:k.color, fontSize:'22px', fontWeight:700, margin:0 }}>{k.value}</p>
              <p style={{ color:'#71717a', fontSize:'11px', margin:0 }}>{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:'8px' }}>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...sel, width:'130px' }}>
          <option value="">Tutti</option>
          <option value="open">Aperti</option>
          <option value="done">Completati</option>
        </select>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} style={{ ...sel, width:'130px' }}>
          <option value="">Tutte le priorità</option>
          {Object.entries(PRIO).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Task list */}
      <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
        {filtered.map(task => {
          const tenant = tenants.find(t => t.user_id === task.tenant_id);
          const overdue = task.status === 'open' && isOverdue(task.due_date);
          return (
            <div key={task.id} style={card({ padding:'14px 18px', display:'flex', alignItems:'center', gap:'14px', opacity: task.status === 'done' ? 0.55 : 1, borderColor: overdue ? 'rgba(239,68,68,0.3)' : '#2e2e40' })}>
              <button onClick={() => toggleDone(task)} style={{ flexShrink:0, background:'none', border:'none', cursor:'pointer', padding:0, color: task.status === 'done' ? '#4ade80' : '#3f3f5a' }}>
                <CheckCircle2 size={22} />
              </button>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
                  <p style={{ color: task.status === 'done' ? '#52525b' : '#f4f4f5', fontWeight:600, fontSize:'13px', margin:0, textDecoration: task.status === 'done' ? 'line-through' : 'none' }}>{task.title}</p>
                  <span style={{ color: PRIO[task.priority]?.color ?? '#71717a', fontSize:'11px', fontWeight:600 }}>{PRIO[task.priority]?.label ?? task.priority}</span>
                  {tenant && <span style={{ color:'#818cf8', fontSize:'11px' }}>— {tenant.salon_name}</span>}
                </div>
                {task.description && <p style={{ color:'#71717a', fontSize:'12px', margin:'4px 0 0' }}>{task.description}</p>}
                <div style={{ display:'flex', gap:'14px', marginTop:'4px', fontSize:'11px', color: overdue ? '#f87171' : '#52525b' }}>
                  {task.due_date && <span>{overdue ? '⚠️ Scaduto' : '📅'} {fmtDate(task.due_date)}</span>}
                  {task.assigned_to && <span>👤 {task.assigned_to}</span>}
                  {task.completed_at && <span>✓ {fmtDate(task.completed_at)}</span>}
                </div>
              </div>
              <div style={{ display:'flex', gap:'4px' }}>
                <button onClick={() => openEdit(task)} style={{ background:'none', border:'1px solid #2e2e40', borderRadius:'6px', padding:'4px 10px', color:'#818cf8', fontSize:'11px', cursor:'pointer' }}>Modifica</button>
                <button onClick={() => deleteTask(task.id)} style={{ background:'none', border:'none', color:'#52525b', cursor:'pointer', padding:'4px' }}><X size={13}/></button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <div style={card({ textAlign:'center', color:'#3f3f5a', fontSize:'13px' })}>Nessun task trovato.</div>}
      </div>

      {/* Modal */}
      {modal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center' }} onClick={() => setModal(false)}>
          <div style={{ width:'480px', background:'#1c1c27', border:'1px solid #2e2e40', borderRadius:'20px', padding:'24px', display:'flex', flexDirection:'column', gap:'14px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3 style={{ color:'#f4f4f5', fontWeight:700, margin:0 }}>{editTask ? 'Modifica task' : 'Nuovo task'}</h3>
              <button onClick={() => setModal(false)} style={{ background:'none', border:'none', color:'#71717a', cursor:'pointer' }}><X size={18}/></button>
            </div>
            <div>
              <label style={{ display:'block', fontSize:'11px', color:'#71717a', marginBottom:'4px' }}>Titolo *</label>
              <input value={form.title ?? ''} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} style={inp} placeholder="Es. Chiamata follow-up" />
            </div>
            <div>
              <label style={{ display:'block', fontSize:'11px', color:'#71717a', marginBottom:'4px' }}>Descrizione</label>
              <textarea rows={2} value={form.description ?? ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} style={{ ...inp, resize:'vertical' }} />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
              <div>
                <label style={{ display:'block', fontSize:'11px', color:'#71717a', marginBottom:'4px' }}>Priorità</label>
                <select value={form.priority ?? 'normale'} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))} style={sel}>
                  {Object.entries(PRIO).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'11px', color:'#71717a', marginBottom:'4px' }}>Scadenza</label>
                <input type="date" value={form.due_date ?? ''} onChange={e => setForm(p => ({ ...p, due_date: e.target.value || null }))} style={inp} />
              </div>
              <div>
                <label style={{ display:'block', fontSize:'11px', color:'#71717a', marginBottom:'4px' }}>Assegnato a</label>
                <input value={form.assigned_to ?? ''} onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))} style={inp} placeholder="Admin" />
              </div>
              <div>
                <label style={{ display:'block', fontSize:'11px', color:'#71717a', marginBottom:'4px' }}>Tenant (opzionale)</label>
                <select value={form.tenant_id ?? ''} onChange={e => setForm(p => ({ ...p, tenant_id: e.target.value || null }))} style={sel}>
                  <option value="">— Generale —</option>
                  {tenants.map(t => <option key={t.user_id} value={t.user_id}>{t.salon_name}</option>)}
                </select>
              </div>
            </div>
            <button onClick={save} disabled={saving || !form.title}
              style={{ padding:'11px', borderRadius:'12px', border:'none', background: !form.title ? '#2e2e40' : 'linear-gradient(135deg,#f59e0b,#ef4444)', color:'white', fontWeight:600, cursor:!form.title?'not-allowed':'pointer' }}>
              {saving ? 'Salvataggio…' : editTask ? 'Salva modifiche' : 'Crea task'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
