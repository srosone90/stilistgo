'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, Users, Target } from 'lucide-react';

interface BIData {
  mrrByMonth: { month: string; mrr: number }[];
  churnRate: number;
  conversionRate: number;
  avgLtv: number;
  avgMrr: number;
  cohorts: { month: string; registered: number; active: number; rate: number }[];
  trialExpiringSoon: number;
  inactiveSince30: number;
  forecast: { month: string; mrr: number }[];
  totals: { active: number; trial: number; cancelled: number; suspended: number };
}

const card = (e?: React.CSSProperties): React.CSSProperties => ({ background:'#1c1c27', border:'1px solid #2e2e40', borderRadius:'16px', padding:'20px', ...e });

const fmtEur = (n: number) => `€${n.toLocaleString('it-IT')}`;

function MiniBar({ data, colorFn, heightKey }: { data: { month: string; [k: string]: number|string }[]; colorFn: (v: number, max: number) => string; heightKey: string }) {
  const max = Math.max(...data.map(d => d[heightKey] as number), 1);
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:'3px', height:'80px' }}>
      {data.map(d => {
        const v = d[heightKey] as number;
        const h = Math.max(2, (v / max) * 70);
        return (
          <div key={d.month} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:'2px' }}>
            <div title={`${d.month}: ${v}`} style={{ width:'100%', borderRadius:'3px 3px 0 0', background: colorFn(v, max), height:`${h}px`, transition:'height 0.3s' }} />
            <span style={{ color:'#3f3f5a', fontSize:'8px', transform:'rotate(-30deg)', transformOrigin:'center', whiteSpace:'nowrap' }}>{String(d.month).slice(5)}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function BISection({ af }: { af: (url: string, opts?: RequestInit) => Promise<Response> }) {
  const [data, setData] = useState<BIData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await af('/api/admin/bi');
    const d = await res.json();
    setData(d);
    setLoading(false);
  }, [af]);

  useEffect(() => { load(); }, [load]);

  if (loading || !data) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'200px', gap:'10px', color:'#71717a' }}>
      <RefreshCw size={16} className="animate-spin" /> Caricamento analytics…
    </div>
  );

  const currentMrr = data.mrrByMonth[data.mrrByMonth.length - 1]?.mrr ?? 0;
  const prevMrr = data.mrrByMonth[data.mrrByMonth.length - 2]?.mrr ?? 0;
  const mrrDelta = currentMrr - prevMrr;

  const allMonthlyData = [
    ...data.mrrByMonth,
    ...data.forecast.map(f => ({ ...f, forecast: true })),
  ];

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'10px' }}>
        <div>
          <h2 style={{ color:'#f4f4f5', fontWeight:700, fontSize:'20px', margin:0 }}>Business Intelligence</h2>
          <p style={{ color:'#71717a', fontSize:'12px', margin:'4px 0 0' }}>MRR, churn, conversion, LTV e forecast</p>
        </div>
        <button onClick={load} style={{ display:'flex', alignItems:'center', gap:'5px', background:'none', border:'1px solid #2e2e40', borderRadius:'8px', padding:'7px 12px', color:'#71717a', cursor:'pointer', fontSize:'12px' }}>
          <RefreshCw size={12} /> Aggiorna
        </button>
      </div>

      {/* KPI row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:'12px' }}>
        {[
          { label:'MRR attuale', value: fmtEur(currentMrr), sub: mrrDelta >= 0 ? `+${fmtEur(mrrDelta)} questo mese` : `${fmtEur(mrrDelta)} questo mese`, color: mrrDelta >= 0 ? '#4ade80' : '#f87171', icon: mrrDelta >= 0 ? <TrendingUp size={16}/> : <TrendingDown size={16}/> },
          { label:'ARR stimato', value: fmtEur(currentMrr * 12), color:'#818cf8', icon:<TrendingUp size={16}/> },
          { label:'Churn rate', value: `${data.churnRate}%`, color: data.churnRate > 10 ? '#f87171' : data.churnRate > 5 ? '#fbbf24' : '#4ade80', icon:<TrendingDown size={16}/> },
          { label:'Trial → Paying', value: `${data.conversionRate}%`, color: data.conversionRate > 50 ? '#4ade80' : '#fbbf24', icon:<Target size={16}/> },
          { label:'LTV medio', value: fmtEur(data.avgLtv), sub:'~24 mesi', color:'#c084fc', icon:<TrendingUp size={16}/> },
          { label:'ARPU', value: fmtEur(data.avgMrr), color:'#60a5fa', icon:<Users size={16}/> },
          { label:'Trial scad. 7gg', value: data.trialExpiringSoon, color: data.trialExpiringSoon > 0 ? '#fbbf24' : '#71717a', icon:<Users size={16}/> },
          { label:'Inattivi 30gg', value: data.inactiveSince30, color: data.inactiveSince30 > 3 ? '#f87171' : '#71717a', icon:<Users size={16}/> },
        ].map(k => (
          <div key={k.label} style={card({ padding:'14px 16px' })}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'8px' }}>
              <p style={{ color:'#71717a', fontSize:'11px', margin:0 }}>{k.label}</p>
              <span style={{ color: k.color, opacity:0.7 }}>{k.icon}</span>
            </div>
            <p style={{ color: k.color, fontSize:'22px', fontWeight:700, margin:0 }}>{k.value}</p>
            {'sub' in k && k.sub && <p style={{ color:'#52525b', fontSize:'10px', margin:'2px 0 0' }}>{k.sub}</p>}
          </div>
        ))}
      </div>

      {/* MRR chart + forecast */}
      <div style={card()}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px' }}>
          <p style={{ color:'#f4f4f5', fontWeight:600, fontSize:'14px', margin:0 }}>MRR storico + forecast 3 mesi</p>
          <div style={{ display:'flex', gap:'12px', fontSize:'11px' }}>
            <span style={{ display:'flex', alignItems:'center', gap:'4px', color:'#818cf8' }}><span style={{ width:'10px', height:'10px', borderRadius:'2px', background:'rgba(99,102,241,0.7)', display:'inline-block' }}/> Storico</span>
            <span style={{ display:'flex', alignItems:'center', gap:'4px', color:'#fbbf24' }}><span style={{ width:'10px', height:'10px', borderRadius:'2px', background:'rgba(245,158,11,0.5)', display:'inline-block', border:'1px dashed rgba(245,158,11,0.7)' }}/> Forecast</span>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'flex-end', gap:'3px', height:'120px' }}>
          {(() => {
            const all = [...data.mrrByMonth, ...data.forecast.map(f => ({ ...f, isForecast: true }))];
            const max = Math.max(...all.map(d => d.mrr), 1);
            return all.map((d) => {
              const isForecast = 'isForecast' in d && d.isForecast;
              const h = Math.max(2, (d.mrr / max) * 100);
              return (
                <div key={d.month} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:'3px' }}>
                  <span style={{ color: isForecast ? '#fbbf24' : '#f4f4f5', fontSize:'8px', fontWeight:600 }}>{d.mrr > 0 ? `€${d.mrr}` : ''}</span>
                  <div title={`${d.month}: €${d.mrr}`} style={{ width:'100%', borderRadius:'3px 3px 0 0', background: isForecast ? 'rgba(245,158,11,0.4)' : 'rgba(99,102,241,0.7)', height:`${h}px`, border: isForecast ? '1px dashed rgba(245,158,11,0.6)' : 'none', transition:'height 0.3s' }} />
                  <span style={{ color:'#3f3f5a', fontSize:'8px', whiteSpace:'nowrap' }}>{d.month.slice(5)}</span>
                </div>
              );
            });
          })()}
        </div>
      </div>

      {/* Two col: Cohorts + Tenant breakdown */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
        {/* Cohort retention */}
        <div style={card()}>
          <p style={{ color:'#f4f4f5', fontWeight:600, fontSize:'14px', margin:'0 0 14px' }}>Retention per coorte (6 mesi)</p>
          {data.cohorts.map(c => (
            <div key={c.month} style={{ marginBottom:'10px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'3px' }}>
                <span style={{ color:'#a1a1aa', fontSize:'12px' }}>{c.month}</span>
                <span style={{ fontSize:'12px', fontWeight:600, color: c.rate >= 80 ? '#4ade80' : c.rate >= 50 ? '#fbbf24' : '#f87171' }}>
                  {c.active}/{c.registered} = {c.rate}%
                </span>
              </div>
              <div style={{ height:'6px', background:'#1e1e2a', borderRadius:'3px' }}>
                <div style={{ width:`${c.rate}%`, height:'100%', borderRadius:'3px', background: c.rate >= 80 ? '#4ade80' : c.rate >= 50 ? '#fbbf24' : '#f87171', transition:'width 0.3s' }} />
              </div>
            </div>
          ))}
          {data.cohorts.length === 0 && <p style={{ color:'#3f3f5a', fontSize:'12px' }}>Dati insufficienti.</p>}
        </div>

        {/* Tenant breakdown */}
        <div style={card()}>
          <p style={{ color:'#f4f4f5', fontWeight:600, fontSize:'14px', margin:'0 0 14px' }}>Breakdown tenant</p>
          {[
            { label:'Attivi paganti', n: data.totals.active, color:'#4ade80' },
            { label:'In trial', n: data.totals.trial, color:'#fbbf24' },
            { label:'Sospesi', n: data.totals.suspended, color:'#f59e0b' },
            { label:'Cancellati', n: data.totals.cancelled, color:'#f87171' },
          ].map(row => {
            const tot = data.totals.active + data.totals.trial + data.totals.suspended + data.totals.cancelled;
            const pct = tot > 0 ? Math.round((row.n / tot) * 100) : 0;
            return (
              <div key={row.label} style={{ marginBottom:'12px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'3px' }}>
                  <span style={{ color:'#a1a1aa', fontSize:'12px' }}>{row.label}</span>
                  <span style={{ color: row.color, fontWeight:600, fontSize:'12px' }}>{row.n} ({pct}%)</span>
                </div>
                <div style={{ height:'6px', background:'#1e1e2a', borderRadius:'3px' }}>
                  <div style={{ width:`${pct}%`, height:'100%', borderRadius:'3px', background: row.color }} />
                </div>
              </div>
            );
          })}

          <div style={{ borderTop:'1px solid #2e2e40', paddingTop:'12px', marginTop:'4px' }}>
            <p style={{ color:'#71717a', fontSize:'11px', margin:'0 0 8px' }}>Alert priorità</p>
            <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
              {data.trialExpiringSoon > 0 && (
                <div style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:'8px', padding:'8px 10px', fontSize:'12px', color:'#fbbf24' }}>
                  ⏳ {data.trialExpiringSoon} trial in scadenza nei prossimi 7 giorni
                </div>
              )}
              {data.inactiveSince30 > 0 && (
                <div style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:'8px', padding:'8px 10px', fontSize:'12px', color:'#f87171' }}>
                  💤 {data.inactiveSince30} tenant inattivi da più di 30 giorni
                </div>
              )}
              {data.trialExpiringSoon === 0 && data.inactiveSince30 === 0 && (
                <p style={{ color:'#4ade80', fontSize:'12px' }}>✅ Nessun alert critico al momento.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
