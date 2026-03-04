'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Plus, X, Copy, Check } from 'lucide-react';

interface Coupon {
  id: string; code: string; description: string; discount_pct: number; discount_eur: number;
  applies_to: string; max_uses: number; uses_count: number; expires_at: string | null;
  active: boolean; created_at: string;
}

const inp: React.CSSProperties = { width:'100%', background:'#12121a', border:'1px solid #2e2e40', borderRadius:'10px', padding:'9px 12px', color:'#f4f4f5', fontSize:'13px', outline:'none', boxSizing:'border-box' };
const sel: React.CSSProperties = { ...inp, cursor:'pointer', appearance:'none' as const };
const card = (e?: React.CSSProperties): React.CSSProperties => ({ background:'#1c1c27', border:'1px solid #2e2e40', borderRadius:'16px', padding:'20px', ...e });

function randCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('it-IT', { day:'2-digit', month:'2-digit', year:'numeric' }) : 'Mai';

export default function CouponsSection({ af }: { af: (url: string, opts?: RequestInit) => Promise<Response> }) {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [editCoupon, setEditCoupon] = useState<Coupon | null>(null);
  const [form, setForm] = useState({ code: randCode(), description:'', discount_pct:0, discount_eur:0, applies_to:'all', max_uses:0, expires_at:'' });
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string|null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await af('/api/admin/coupons');
    const d = await res.json();
    setCoupons(d.coupons ?? []);
    setLoading(false);
  }, [af]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setForm({ code: randCode(), description:'', discount_pct:0, discount_eur:0, applies_to:'all', max_uses:0, expires_at:'' }); setEditCoupon(null); setModal(true); };

  const save = async () => {
    setSaving(true);
    if (editCoupon) {
      await af('/api/admin/coupons', { method:'PATCH', body: JSON.stringify({ id: editCoupon.id, ...form }) });
      setCoupons(prev => prev.map(c => c.id === editCoupon.id ? { ...c, ...form } as Coupon : c));
    } else {
      const res = await af('/api/admin/coupons', { method:'POST', body: JSON.stringify({ ...form, expires_at: form.expires_at || null }) });
      const d = await res.json();
      if (d.coupon) setCoupons(prev => [d.coupon, ...prev]);
    }
    setSaving(false); setModal(false);
  };

  const toggleActive = async (c: Coupon) => {
    await af('/api/admin/coupons', { method:'PATCH', body: JSON.stringify({ id: c.id, active: !c.active }) });
    setCoupons(prev => prev.map(x => x.id === c.id ? { ...x, active: !x.active } : x));
  };

  const deleteCoupon = async (id: string) => {
    if (!confirm('Eliminare questo coupon?')) return;
    await af('/api/admin/coupons', { method:'DELETE', body: JSON.stringify({ id }) });
    setCoupons(prev => prev.filter(c => c.id !== id));
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  const activeCoupons = coupons.filter(c => c.active).length;
  const totalUses = coupons.reduce((s, c) => s + c.uses_count, 0);

  if (loading) return <p style={{ color:'#71717a', textAlign:'center', padding:'40px 0' }}>Caricamento coupon…</p>;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'10px' }}>
        <div>
          <h2 style={{ color:'#f4f4f5', fontWeight:700, fontSize:'20px', margin:0 }}>Coupon & Sconti ({coupons.length})</h2>
          <p style={{ color:'#71717a', fontSize:'12px', margin:'4px 0 0' }}>{activeCoupons} attivi · {totalUses} utilizzi totali</p>
        </div>
        <button onClick={openNew} style={{ display:'flex', alignItems:'center', gap:'6px', padding:'8px 16px', borderRadius:'10px', border:'none', background:'linear-gradient(135deg,#f59e0b,#ef4444)', color:'white', fontWeight:600, fontSize:'13px', cursor:'pointer' }}>
          <Plus size={14} /> Nuovo coupon
        </button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:'12px' }}>
        {coupons.map(c => {
          const usageMax = c.max_uses > 0 ? c.max_uses : null;
          const usagePct = usageMax ? Math.min(100, (c.uses_count / usageMax) * 100) : 0;
          const expired = c.expires_at && new Date(c.expires_at) < new Date();
          return (
            <div key={c.id} style={card({ opacity: (!c.active || expired) ? 0.65 : 1, borderColor: c.active && !expired ? '#2e2e40' : 'rgba(239,68,68,0.2)' })}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'10px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                  <span style={{ fontFamily:'monospace', fontWeight:800, fontSize:'16px', color:'#f4f4f5', letterSpacing:'2px' }}>{c.code}</span>
                  <button onClick={() => copyCode(c.code)} style={{ background:'none', border:'none', color: copied === c.code ? '#4ade80' : '#71717a', cursor:'pointer', padding:'2px' }}>
                    {copied === c.code ? <Check size={13}/> : <Copy size={13}/>}
                  </button>
                </div>
                <div style={{ display:'flex', gap:'4px' }}>
                  <button onClick={() => toggleActive(c)} style={{ background: c.active ? 'rgba(34,197,94,0.1)' : 'rgba(113,113,122,0.1)', border:'none', borderRadius:'6px', padding:'3px 8px', color: c.active ? '#4ade80' : '#71717a', fontSize:'11px', cursor:'pointer', fontWeight:600 }}>
                    {c.active ? 'Attivo' : 'Disattivo'}
                  </button>
                  <button onClick={() => deleteCoupon(c.id)} style={{ background:'none', border:'none', color:'#52525b', cursor:'pointer', padding:'3px' }}><X size={13}/></button>
                </div>
              </div>

              <p style={{ color:'#a1a1aa', fontSize:'12px', margin:'0 0 8px' }}>{c.description || '—'}</p>

              <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'10px' }}>
                {c.discount_pct > 0 && <span style={{ background:'rgba(99,102,241,0.1)', color:'#818cf8', borderRadius:'6px', padding:'2px 8px', fontSize:'12px', fontWeight:600 }}>-{c.discount_pct}%</span>}
                {c.discount_eur > 0 && <span style={{ background:'rgba(34,197,94,0.1)', color:'#4ade80', borderRadius:'6px', padding:'2px 8px', fontSize:'12px', fontWeight:600 }}>-€{c.discount_eur}</span>}
                <span style={{ background:'rgba(245,158,11,0.1)', color:'#fbbf24', borderRadius:'6px', padding:'2px 8px', fontSize:'12px' }}>{c.applies_to === 'all' ? 'Tutti i piani' : `Piano ${c.applies_to}`}</span>
              </div>

              <div style={{ fontSize:'11px', color:'#52525b', display:'flex', gap:'12px', flexWrap:'wrap' }}>
                <span>Utilizzi: {c.uses_count}{usageMax ? ` / ${usageMax}` : ''}</span>
                <span>Scade: {fmtDate(c.expires_at)}</span>
              </div>

              {usageMax && (
                <div style={{ height:'4px', background:'#1e1e2a', borderRadius:'2px', marginTop:'8px' }}>
                  <div style={{ width:`${usagePct}%`, height:'100%', borderRadius:'2px', background:'#6366f1' }} />
                </div>
              )}
            </div>
          );
        })}
        {coupons.length === 0 && <div style={card({ textAlign:'center', color:'#3f3f5a', fontSize:'13px', gridColumn:'1/-1' })}>Nessun coupon creato.</div>}
      </div>

      {/* Modal */}
      {modal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center' }} onClick={() => setModal(false)}>
          <div style={{ width:'460px', background:'#1c1c27', border:'1px solid #2e2e40', borderRadius:'20px', padding:'24px', display:'flex', flexDirection:'column', gap:'14px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3 style={{ color:'#f4f4f5', fontWeight:700, margin:0 }}>Nuovo coupon</h3>
              <button onClick={() => setModal(false)} style={{ background:'none', border:'none', color:'#71717a', cursor:'pointer' }}><X size={18}/></button>
            </div>
            <div>
              <label style={{ display:'block', fontSize:'11px', color:'#71717a', marginBottom:'4px' }}>Codice</label>
              <div style={{ display:'flex', gap:'8px' }}>
                <input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} style={inp} />
                <button onClick={() => setForm(p => ({ ...p, code: randCode() }))} style={{ background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.3)', borderRadius:'8px', padding:'8px 12px', color:'#818cf8', fontSize:'12px', cursor:'pointer', whiteSpace:'nowrap' }}>↻ Random</button>
              </div>
            </div>
            <div>
              <label style={{ display:'block', fontSize:'11px', color:'#71717a', marginBottom:'4px' }}>Descrizione</label>
              <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} style={inp} placeholder="Es. Promo marzo 2026" />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
              <div>
                <label style={{ display:'block', fontSize:'11px', color:'#71717a', marginBottom:'4px' }}>Sconto % (0 = nessuno)</label>
                <input type="number" min={0} max={100} value={form.discount_pct} onChange={e => setForm(p => ({ ...p, discount_pct: parseFloat(e.target.value) || 0 }))} style={inp} />
              </div>
              <div>
                <label style={{ display:'block', fontSize:'11px', color:'#71717a', marginBottom:'4px' }}>Sconto € (0 = nessuno)</label>
                <input type="number" min={0} value={form.discount_eur} onChange={e => setForm(p => ({ ...p, discount_eur: parseFloat(e.target.value) || 0 }))} style={inp} />
              </div>
              <div>
                <label style={{ display:'block', fontSize:'11px', color:'#71717a', marginBottom:'4px' }}>Applicabile a</label>
                <select value={form.applies_to} onChange={e => setForm(p => ({ ...p, applies_to: e.target.value }))} style={sel}>
                  <option value="all">Tutti i piani</option>
                  {['starter','pro','business'].map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'11px', color:'#71717a', marginBottom:'4px' }}>Max utilizzi (0 = illimitato)</label>
                <input type="number" min={0} value={form.max_uses} onChange={e => setForm(p => ({ ...p, max_uses: parseInt(e.target.value) || 0 }))} style={inp} />
              </div>
              <div>
                <label style={{ display:'block', fontSize:'11px', color:'#71717a', marginBottom:'4px' }}>Scadenza (vuoto = mai)</label>
                <input type="date" value={form.expires_at} onChange={e => setForm(p => ({ ...p, expires_at: e.target.value }))} style={inp} />
              </div>
            </div>
            <button onClick={save} disabled={saving || !form.code}
              style={{ padding:'11px', borderRadius:'12px', border:'none', background: !form.code ? '#2e2e40' : 'linear-gradient(135deg,#f59e0b,#ef4444)', color:'white', fontWeight:600, cursor:!form.code?'not-allowed':'pointer' }}>
              {saving ? 'Salvataggio…' : 'Crea coupon'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
