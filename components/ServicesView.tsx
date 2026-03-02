'use client';

import React, { useState, useMemo } from 'react';
import { useSalon } from '@/context/SalonContext';
import { Service, ServiceCategory, SERVICE_CATEGORIES } from '@/types/salon';
import { formatCurrency } from '@/lib/calculations';
import { Plus, X, Pencil, Trash2 } from 'lucide-react';

const card: React.CSSProperties = { background: '#1c1c27', border: '1px solid #2e2e40', borderRadius: '16px', padding: '20px' };
const inputStyle: React.CSSProperties = { background: '#12121a', border: '1px solid #2e2e40', borderRadius: '10px', padding: '9px 13px', color: '#f4f4f5', fontSize: '13px', outline: 'none', width: '100%' };
const labelStyle: React.CSSProperties = { fontSize: '12px', color: '#71717a', marginBottom: '4px', display: 'block' };
const btnPrimary: React.CSSProperties = { background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', color: '#818cf8', borderRadius: '10px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' };

const EMPTY_SERVICE: Omit<Service, 'id' | 'createdAt'> = {
  name: '', category: 'Taglio', duration: 30, price: 0,
  description: '', operatorIds: [], active: true,
};

const CAT_COLORS: Record<ServiceCategory, string> = {
  Taglio: '#6366f1', Colore: '#f59e0b', Trattamento: '#22c55e',
  Piega: '#06b6d4', Estetica: '#ec4899', Nail: '#a855f7',
  Sposa: '#ef4444', Altro: '#71717a',
};

export default function ServicesView() {
  const { services, addService, updateService, deleteService, operators } = useSalon();
  const [showForm, setShowForm] = useState(false);
  const [editSvc, setEditSvc] = useState<Service | null>(null);
  const [form, setForm] = useState<Omit<Service, 'id' | 'createdAt'>>(EMPTY_SERVICE);
  const [filterCat, setFilterCat] = useState<ServiceCategory | 'all'>('all');

  const grouped = useMemo(() => {
    const cats = filterCat === 'all' ? SERVICE_CATEGORIES : [filterCat];
    return cats.map(cat => ({
      cat,
      items: services.filter(s => s.category === cat).sort((a, b) => a.name.localeCompare(b.name)),
    })).filter(g => g.items.length > 0);
  }, [services, filterCat]);

  function openNew() {
    setEditSvc(null);
    setForm(EMPTY_SERVICE);
    setShowForm(true);
  }

  function openEdit(s: Service) {
    setEditSvc(s);
    setForm({ name: s.name, category: s.category, duration: s.duration, price: s.price, description: s.description, operatorIds: [...s.operatorIds], active: s.active });
    setShowForm(true);
  }

  function handleSave() {
    if (!form.name.trim()) return;
    if (editSvc) updateService({ ...editSvc, ...form });
    else addService(form);
    setShowForm(false);
  }

  function toggleOperator(id: string) {
    setForm(p => ({
      ...p,
      operatorIds: p.operatorIds.includes(id) ? p.operatorIds.filter(x => x !== id) : [...p.operatorIds, id],
    }));
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Listino Servizi</h1>
          <p className="text-xs mt-1" style={{ color: '#71717a' }}>{services.filter(s => s.active).length} servizi attivi</p>
        </div>
        <button onClick={openNew} style={btnPrimary}><Plus size={14} /> Nuovo servizio</button>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFilterCat('all')}
          className="text-xs px-3 py-1.5 rounded-lg"
          style={{ background: filterCat === 'all' ? 'rgba(99,102,241,0.2)' : '#12121a', border: `1px solid ${filterCat === 'all' ? 'rgba(99,102,241,0.5)' : '#2e2e40'}`, color: filterCat === 'all' ? '#818cf8' : '#71717a', cursor: 'pointer' }}>
          Tutte
        </button>
        {SERVICE_CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setFilterCat(cat)}
            className="text-xs px-3 py-1.5 rounded-lg"
            style={{ background: filterCat === cat ? `${CAT_COLORS[cat]}20` : '#12121a', border: `1px solid ${filterCat === cat ? CAT_COLORS[cat] + '60' : '#2e2e40'}`, color: filterCat === cat ? CAT_COLORS[cat] : '#71717a', cursor: 'pointer' }}>
            {cat}
          </button>
        ))}
      </div>

      {/* Services table */}
      {grouped.length === 0 && <p style={{ color: '#3f3f5a', fontSize: '13px' }}>Nessun servizio trovato. Aggiungine uno.</p>}
      {grouped.map(({ cat, items }) => (
        <div key={cat} style={card}>
          <h3 className="font-semibold text-sm mb-3" style={{ color: CAT_COLORS[cat] }}>{cat}</h3>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #2e2e40' }}>
                {['Servizio', 'Durata', 'Prezzo', 'Operatori', 'Attivo', ''].map(h => (
                  <th key={h} className="text-left pb-2 pr-4" style={{ color: '#71717a', fontWeight: 500, fontSize: '12px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid #1e1e2e' }}>
                  <td className="py-2.5 pr-4">
                    <p className="text-white font-medium">{s.name}</p>
                    {s.description && <p className="text-xs mt-0.5" style={{ color: '#71717a' }}>{s.description}</p>}
                  </td>
                  <td className="py-2.5 pr-4" style={{ color: '#d4d4d8' }}>{s.duration} min</td>
                  <td className="py-2.5 pr-4 font-semibold" style={{ color: '#22c55e' }}>{formatCurrency(s.price)}</td>
                  <td className="py-2.5 pr-4" style={{ color: '#71717a', fontSize: '12px' }}>
                    {s.operatorIds.length === 0 ? 'Tutti' : s.operatorIds.map(id => operators.find(o => o.id === id)?.name).filter(Boolean).join(', ')}
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: s.active ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: s.active ? '#22c55e' : '#f87171', border: `1px solid ${s.active ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
                      {s.active ? 'Attivo' : 'Inattivo'}
                    </span>
                  </td>
                  <td className="py-2.5">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => openEdit(s)} style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', padding: '4px' }} title="Modifica"><Pencil size={14} /></button>
                      <button onClick={() => deleteService(s.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }} title="Elimina"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Servizi totali', value: services.length },
          { label: 'Prezzo medio', value: services.length > 0 ? formatCurrency(services.reduce((s, v) => s + v.price, 0) / services.length) : '—' },
          { label: 'Durata media', value: services.length > 0 ? `${Math.round(services.reduce((s, v) => s + v.duration, 0) / services.length)} min` : '—' },
        ].map(k => (
          <div key={k.label} style={card} className="text-center">
            <p className="text-2xl font-bold text-white">{k.value}</p>
            <p className="text-xs mt-1" style={{ color: '#71717a' }}>{k.label}</p>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-6" style={{ background: '#18181f', border: '1px solid #2e2e40' }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-white">{editSvc ? 'Modifica Servizio' : 'Nuovo Servizio'}</h3>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label style={labelStyle}>Nome servizio *</label><input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={inputStyle} /></div>
              <div>
                <label style={labelStyle}>Categoria</label>
                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value as ServiceCategory }))} style={inputStyle}>
                  {SERVICE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div><label style={labelStyle}>Durata (min)</label><input type="number" min={5} step={5} value={form.duration} onChange={e => setForm(p => ({ ...p, duration: Number(e.target.value) }))} style={inputStyle} /></div>
              <div><label style={labelStyle}>Prezzo (€)</label><input type="number" min={0} step={0.5} value={form.price} onChange={e => setForm(p => ({ ...p, price: Number(e.target.value) }))} style={inputStyle} /></div>
              <div className="flex items-center gap-2 pt-6">
                <input type="checkbox" id="active" checked={form.active} onChange={e => setForm(p => ({ ...p, active: e.target.checked }))} />
                <label htmlFor="active" style={{ fontSize: '13px', color: '#d4d4d8' }}>Servizio attivo</label>
              </div>
              <div className="col-span-2"><label style={labelStyle}>Descrizione</label><textarea rows={2} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} /></div>
              <div className="col-span-2">
                <label style={labelStyle}>Operatori abilitati (vuoto = tutti)</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {operators.filter(o => o.active).map(o => (
                    <button key={o.id} type="button" onClick={() => toggleOperator(o.id)}
                      className="text-xs px-2.5 py-1 rounded-lg transition-all"
                      style={{ background: form.operatorIds.includes(o.id) ? 'rgba(99,102,241,0.25)' : '#12121a', border: `1px solid ${form.operatorIds.includes(o.id) ? 'rgba(99,102,241,0.5)' : '#2e2e40'}`, color: form.operatorIds.includes(o.id) ? '#818cf8' : '#71717a', cursor: 'pointer' }}>
                      {o.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowForm(false)} style={{ background: '#12121a', border: '1px solid #2e2e40', color: '#71717a', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', cursor: 'pointer' }}>Annulla</button>
              <button onClick={handleSave} style={btnPrimary}>Salva</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
