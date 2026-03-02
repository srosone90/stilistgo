'use client';

import React, { useState, useMemo } from 'react';
import { useSalon } from '@/context/SalonContext';
import { GamificationBonus } from '@/types/salon';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { Trophy, Medal, Star, Plus, X, Trash2, Settings, Users, Award, TrendingUp, Package } from 'lucide-react';
import { formatCurrency } from '@/lib/calculations';

const inputStyle: React.CSSProperties = { background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '10px', padding: '9px 13px', color: 'var(--text)', fontSize: '13px', outline: 'none', width: '100%' };
const labelStyle: React.CSSProperties = { fontSize: '12px', color: 'var(--muted)', marginBottom: '4px', display: 'block' };
const card: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px' };
const btnPrimary: React.CSSProperties = { background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', color: 'var(--accent-light)', borderRadius: '10px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' };

const TROPHY_CONFIG = [
  { key: 'gold',   icon: '🥇', label: 'Oro',    color: '#f59e0b', glow: 'rgba(245,158,11,0.25)' },
  { key: 'silver', icon: '🥈', label: 'Argento', color: '#94a3b8', glow: 'rgba(148,163,184,0.2)' },
  { key: 'bronze', icon: '🥉', label: 'Bronzo',  color: '#d97706', glow: 'rgba(217,119,6,0.2)' },
  { key: 'none',   icon: '🌱', label: '—',       color: 'var(--border-light)', glow: 'transparent' },
];

function getTrophy(revenue: number, bronze: number, silver: number, gold: number): typeof TROPHY_CONFIG[number] {
  if (revenue >= gold)   return TROPHY_CONFIG[0];
  if (revenue >= silver) return TROPHY_CONFIG[1];
  if (revenue >= bronze) return TROPHY_CONFIG[2];
  return TROPHY_CONFIG[3];
}

const BONUS_ICONS = ['🏆', '⭐', '🎯', '🚀', '💪', '🎉', '💎', '🔥'];

const EMPTY_BONUS: Omit<GamificationBonus, 'id'> = { label: '', description: '', amount: 0, icon: '🏆' };

export default function GamificationView() {
  const {
    gamificationConfig, updateGamificationConfig,
    operators, payments, appointments,
    activeOperatorId,
  } = useSalon();

  const [showSettings, setShowSettings] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [bonusForm, setBonusForm] = useState<Omit<GamificationBonus, 'id'> | null>(null);
  const [editBonusId, setEditBonusId] = useState<string | null>(null);

  // Is current user owner/admin?
  const activeOp = operators.find(o => o.id === activeOperatorId);
  const isOwner = !activeOperatorId || activeOp?.role === 'owner';

  // Month range
  const monthStart = useMemo(() => startOfMonth(parseISO(selectedMonth + '-01')), [selectedMonth]);
  const monthEnd   = useMemo(() => endOfMonth(parseISO(selectedMonth + '-01')),   [selectedMonth]);

  // Stats per operator for selected month
  const participantOps = useMemo(() =>
    operators.filter(o => o.active && gamificationConfig.participantOperatorIds.includes(o.id)),
    [operators, gamificationConfig.participantOperatorIds]);

  const stats = useMemo(() => {
    return participantOps.map(op => {
      const ops_payments = payments.filter(p => {
        const d = parseISO(p.date);
        return p.operatorId === op.id && d >= monthStart && d <= monthEnd;
      });
      const revenue   = ops_payments.reduce((s, p) => s + p.total, 0);
      const services  = ops_payments.reduce((s, p) => s + p.items.filter(i => !i.isProduct).length, 0);
      const products  = ops_payments.reduce((s, p) => s + p.items.filter(i => i.isProduct).length, 0);
      const appts     = appointments.filter(a => {
        const d = parseISO(a.date);
        return a.operatorId === op.id && a.status === 'completed' && d >= monthStart && d <= monthEnd;
      }).length;
      const trophy = getTrophy(revenue, gamificationConfig.bronzeThreshold, gamificationConfig.silverThreshold, gamificationConfig.goldThreshold);
      return { op, revenue, services, products, appts, trophy };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [participantOps, payments, appointments, monthStart, monthEnd, gamificationConfig]);

  // ─── Settings helpers ──────────────────────────────────────────────────────

  function toggleParticipant(opId: string) {
    const ids = gamificationConfig.participantOperatorIds;
    updateGamificationConfig({
      participantOperatorIds: ids.includes(opId) ? ids.filter(i => i !== opId) : [...ids, opId],
    });
  }

  function saveBonusForm() {
    if (!bonusForm || !bonusForm.label) return;
    const bonuses = gamificationConfig.bonuses;
    if (editBonusId) {
      updateGamificationConfig({ bonuses: bonuses.map(b => b.id === editBonusId ? { ...bonusForm, id: editBonusId } : b) });
    } else {
      updateGamificationConfig({ bonuses: [...bonuses, { ...bonusForm, id: `bonus-${Date.now()}` }] });
    }
    setBonusForm(null);
    setEditBonusId(null);
  }

  // ─── RENDER ────────────────────────────────────────────────────────────────

  if (!gamificationConfig.isEnabled && !isOwner) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 py-24">
        <div className="text-6xl">🏆</div>
        <p className="text-white font-semibold text-lg">Gamification non attiva</p>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Chiedi al titolare di attivare il programma.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Trophy size={24} style={{ color: '#f59e0b' }} /> Gamification
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Classifica e premi mensili del team</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
            style={{ ...inputStyle, width: 'auto' }} />
          {isOwner && (
            <button onClick={() => setShowSettings(s => !s)} style={{ ...btnPrimary, background: showSettings ? 'rgba(99,102,241,0.3)' : undefined }}>
              <Settings size={14} /> Impostazioni
            </button>
          )}
        </div>
      </div>

      {/* Owner settings panel */}
      {showSettings && isOwner && (
        <div style={card} className="space-y-5">
          <h3 className="text-white font-semibold flex items-center gap-2"><Settings size={16} /> Impostazioni Gamification</h3>

          {/* Enable toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white font-medium">Programma attivo</p>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Attiva o disattiva la gamification per tutto il team</p>
            </div>
            <button onClick={() => updateGamificationConfig({ isEnabled: !gamificationConfig.isEnabled })}
              className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
              style={{ background: gamificationConfig.isEnabled ? '#6366f1' : 'var(--border)' }}>
              <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                style={{ transform: gamificationConfig.isEnabled ? 'translateX(22px)' : 'translateX(2px)' }} />
            </button>
          </div>

          {/* Participants */}
          <div>
            <p className="text-sm text-white font-medium mb-2 flex items-center gap-1"><Users size={14} /> Partecipanti</p>
            <div className="flex flex-wrap gap-2">
              {operators.filter(o => o.active).map(op => {
                const active = gamificationConfig.participantOperatorIds.includes(op.id);
                return (
                  <button key={op.id} onClick={() => toggleParticipant(op.id)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                    style={{ background: active ? 'rgba(99,102,241,0.2)' : 'var(--bg-input)', border: `1px solid ${active ? 'rgba(99,102,241,0.5)' : 'var(--border)'}`, color: active ? 'var(--accent-light)' : '#52525b' }}>
                    {active ? '✓ ' : ''}{op.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Trophy thresholds */}
          <div>
            <p className="text-sm text-white font-medium mb-2 flex items-center gap-1"><Trophy size={14} /> Soglie trofei (fatturato mensile €)</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: '🥉 Bronzo', key: 'bronzeThreshold' as const, value: gamificationConfig.bronzeThreshold },
                { label: '🥈 Argento', key: 'silverThreshold' as const, value: gamificationConfig.silverThreshold },
                { label: '🥇 Oro', key: 'goldThreshold' as const, value: gamificationConfig.goldThreshold },
              ].map(t => (
                <div key={t.key}>
                  <label style={labelStyle}>{t.label}</label>
                  <input type="number" min={0} step={50} value={t.value}
                    onChange={e => updateGamificationConfig({ [t.key]: parseFloat(e.target.value) || 0 })}
                    style={inputStyle} />
                </div>
              ))}
            </div>
          </div>

          {/* Bonuses */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-white font-medium flex items-center gap-1"><Award size={14} /> Bonus definiti</p>
              <button onClick={() => { setBonusForm({ ...EMPTY_BONUS }); setEditBonusId(null); }} style={btnPrimary}>
                <Plus size={13} /> Nuovo bonus
              </button>
            </div>
            <div className="space-y-2">
              {gamificationConfig.bonuses.map(b => (
                <div key={b.id} className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{b.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-white">{b.label}</p>
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>{b.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-sm" style={{ color: '#22c55e' }}>+{formatCurrency(b.amount)}</span>
                    <button onClick={() => { setBonusForm({ label: b.label, description: b.description, amount: b.amount, icon: b.icon }); setEditBonusId(b.id); }}
                      style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', color: 'var(--accent-light)', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: 11 }}>Modifica</button>
                    <button onClick={() => updateGamificationConfig({ bonuses: gamificationConfig.bonuses.filter(x => x.id !== b.id) })}
                      style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer' }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
              {gamificationConfig.bonuses.length === 0 && (
                <p className="text-xs py-2" style={{ color: 'var(--border-light)' }}>Nessun bonus definito. Crea il primo bonus per motivare il team.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bonus form modal */}
      {bonusForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: '#18181f', border: '1px solid var(--border)' }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-white">{editBonusId ? 'Modifica bonus' : 'Nuovo bonus'}</h3>
              <button onClick={() => { setBonusForm(null); setEditBonusId(null); }} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label style={labelStyle}>Icona</label>
                <div className="flex flex-wrap gap-2">
                  {BONUS_ICONS.map(icon => (
                    <button key={icon} onClick={() => setBonusForm(p => p ? { ...p, icon } : p)}
                      className="text-2xl w-10 h-10 rounded-lg flex items-center justify-center transition-all"
                      style={{ background: bonusForm.icon === icon ? 'rgba(99,102,241,0.3)' : 'var(--bg-input)', border: `1px solid ${bonusForm.icon === icon ? 'rgba(99,102,241,0.5)' : 'var(--border)'}` }}>
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={labelStyle}>Nome bonus</label>
                <input value={bonusForm.label} onChange={e => setBonusForm(p => p ? { ...p, label: e.target.value } : p)} placeholder="es. Dipendente del mese" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Descrizione</label>
                <input value={bonusForm.description} onChange={e => setBonusForm(p => p ? { ...p, description: e.target.value } : p)} placeholder="es. Maggior fatturato del mese" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Importo bonus (€)</label>
                <input type="number" min={0} step={5} value={bonusForm.amount} onChange={e => setBonusForm(p => p ? { ...p, amount: parseFloat(e.target.value) || 0 } : p)} style={inputStyle} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => { setBonusForm(null); setEditBonusId(null); }} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', cursor: 'pointer' }}>Annulla</button>
              <button onClick={saveBonusForm} disabled={!bonusForm.label} style={{ ...btnPrimary, opacity: !bonusForm.label ? 0.4 : 1 }}>Salva</button>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard */}
      {!gamificationConfig.isEnabled && isOwner ? (
        <div style={card} className="text-center py-10">
          <p className="text-4xl mb-2">💤</p>
          <p className="text-white font-medium">Gamification disattivata</p>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>Attiva il programma dalle impostazioni per vedere la classifica.</p>
        </div>
      ) : participantOps.length === 0 ? (
        <div style={card} className="text-center py-10">
          <p className="text-4xl mb-2">👥</p>
          <p className="text-white font-medium">Nessun partecipante selezionato</p>
          {isOwner && <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>Scegli chi partecipa al programma dalle impostazioni.</p>}
        </div>
      ) : (
        <>
          {/* Month label */}
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--border-light)' }}>
            Classifica — {format(parseISO(selectedMonth + '-01'), 'MMMM yyyy', { locale: it })}
          </p>

          {/* Podium top 3 */}
          {stats.length >= 1 && (
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(stats.length, 3)}, 1fr)` }}>
              {stats.slice(0, 3).map((s, idx) => {
                const medals = ['🥇', '🥈', '🥉'];
                const podiumColors = ['rgba(245,158,11,0.15)', 'rgba(148,163,184,0.1)', 'rgba(217,119,6,0.1)'];
                const podiumBorders = ['rgba(245,158,11,0.4)', 'rgba(148,163,184,0.3)', 'rgba(217,119,6,0.3)'];
                const progressToNext =
                  idx === 0 ? 100
                  : s.revenue >= gamificationConfig.goldThreshold ? 100
                  : s.revenue >= gamificationConfig.silverThreshold
                    ? Math.min(100, Math.round((s.revenue - gamificationConfig.silverThreshold) / (gamificationConfig.goldThreshold - gamificationConfig.silverThreshold) * 100))
                    : s.revenue >= gamificationConfig.bronzeThreshold
                      ? Math.min(100, Math.round((s.revenue - gamificationConfig.bronzeThreshold) / (gamificationConfig.silverThreshold - gamificationConfig.bronzeThreshold) * 100))
                      : Math.min(100, Math.round(s.revenue / gamificationConfig.bronzeThreshold * 100));
                return (
                  <div key={s.op.id} style={{ ...card, background: podiumColors[idx], border: `1px solid ${podiumBorders[idx]}`, textAlign: 'center', position: 'relative', boxShadow: `0 0 20px ${s.trophy.glow}` }}>
                    <div className="text-3xl mb-1">{medals[idx]}</div>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm mx-auto mb-2"
                      style={{ background: s.op.color }}>
                      {s.op.name.charAt(0).toUpperCase()}
                    </div>
                    <p className="font-bold text-white text-sm">{s.op.name}</p>
                    <p className="text-xl font-bold mt-1" style={{ color: '#22c55e' }}>{formatCurrency(s.revenue)}</p>
                    <div className="flex justify-center gap-3 mt-2 text-xs" style={{ color: 'var(--muted)' }}>
                      <span title="Appuntamenti completati">📅 {s.appts}</span>
                      <span title="Servizi">✂️ {s.services}</span>
                      <span title="Prodotti venduti">📦 {s.products}</span>
                    </div>
                    {/* Progress bar to next trophy */}
                    <div className="mt-3">
                      <div className="h-1.5 rounded-full" style={{ background: 'var(--border)' }}>
                        <div className="h-1.5 rounded-full transition-all" style={{ width: `${progressToNext}%`, background: s.trophy.color }} />
                      </div>
                      <p className="text-xs mt-1" style={{ color: s.trophy.color }}>{s.trophy.icon} {s.trophy.label}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Full ranking table */}
          {stats.length > 3 && (
            <div style={card}>
              <h3 className="text-sm font-semibold text-white mb-3">Classifica completa</h3>
              <div className="space-y-2">
                {stats.slice(3).map((s, idx) => (
                  <div key={s.op.id} className="flex items-center gap-4 px-3 py-2 rounded-xl" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
                    <span className="text-sm font-bold w-5 text-center" style={{ color: '#52525b' }}>{idx + 4}</span>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ background: s.op.color }}>
                      {s.op.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{s.op.name}</p>
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>📅 {s.appts} app. · ✂️ {s.services} serv. · 📦 {s.products} prod.</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold" style={{ color: '#22c55e' }}>{formatCurrency(s.revenue)}</p>
                      <p className="text-xs">{s.trophy.icon} {s.trophy.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bonuses showcase */}
          {gamificationConfig.bonuses.length > 0 && (
            <div style={card}>
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Award size={15} style={{ color: '#f59e0b' }} /> Bonus disponibili</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {gamificationConfig.bonuses.map(b => (
                  <div key={b.id} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.15)' }}>
                    <span className="text-2xl flex-shrink-0">{b.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">{b.label}</p>
                      {b.description && <p className="text-xs" style={{ color: 'var(--muted)' }}>{b.description}</p>}
                    </div>
                    <span className="text-sm font-bold flex-shrink-0" style={{ color: '#22c55e' }}>+{formatCurrency(b.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* My stats (for non-owner current operator) */}
          {activeOperatorId && !isOwner && (() => {
            const my = stats.find(s => s.op.id === activeOperatorId);
            if (!my) return null;
            const rank = stats.findIndex(s => s.op.id === activeOperatorId) + 1;
            return (
              <div style={{ ...card, border: '1px solid rgba(99,102,241,0.4)', background: 'rgba(99,102,241,0.07)' }}>
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Star size={15} style={{ color: 'var(--accent-light)' }} /> Le tue statistiche</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  {[
                    { label: 'Posizione', value: `#${rank}`, color: 'var(--accent-light)' },
                    { label: 'Fatturato', value: formatCurrency(my.revenue), color: '#22c55e' },
                    { label: 'Appuntamenti', value: `${my.appts}`, color: '#06b6d4' },
                    { label: 'Trofeo', value: `${my.trophy.icon} ${my.trophy.label}`, color: my.trophy.color },
                  ].map(k => (
                    <div key={k.label}>
                      <p className="text-lg font-bold" style={{ color: k.color }}>{k.value}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{k.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
