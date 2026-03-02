'use client';

import React, { useState, useMemo } from 'react';
import { useSalon } from '@/context/SalonContext';
import { Product, StockMovement, StockMovementType, STOCK_MOVEMENT_LABELS } from '@/types/salon';
import { format, parseISO } from 'date-fns';
import { formatCurrency } from '@/lib/calculations';
import { Plus, X, Pencil, Trash2, AlertTriangle, Package } from 'lucide-react';

const card: React.CSSProperties = { background: '#1c1c27', border: '1px solid #2e2e40', borderRadius: '16px', padding: '20px' };
const inputStyle: React.CSSProperties = { background: '#12121a', border: '1px solid #2e2e40', borderRadius: '10px', padding: '9px 13px', color: '#f4f4f5', fontSize: '13px', outline: 'none', width: '100%' };
const labelStyle: React.CSSProperties = { fontSize: '12px', color: '#71717a', marginBottom: '4px', display: 'block' };
const btnPrimary: React.CSSProperties = { background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', color: '#818cf8', borderRadius: '10px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' };

const EMPTY_PRODUCT: Omit<Product, 'id' | 'createdAt'> = {
  name: '', brand: '', category: '', unit: 'pz',
  purchasePrice: 0, salePrice: 0, stock: 0, minStock: 5,
  isForSale: false, active: true,
};

const EMPTY_MOVEMENT: Omit<StockMovement, 'id' | 'createdAt'> = {
  productId: '', type: 'load', quantity: 1, date: format(new Date(), 'yyyy-MM-dd'), notes: '', operatorId: '',
};

export default function InventoryView() {
  const { products, addProduct, updateProduct, deleteProduct, stockMovements, addStockMovement, operators } = useSalon();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showProdForm, setShowProdForm] = useState(false);
  const [editProd, setEditProd] = useState<Product | null>(null);
  const [form, setForm] = useState<Omit<Product, 'id' | 'createdAt'>>(EMPTY_PRODUCT);
  const [showMoveForm, setShowMoveForm] = useState(false);
  const [moveForm, setMoveForm] = useState<Omit<StockMovement, 'id' | 'createdAt'>>(EMPTY_MOVEMENT);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [showOnlyLow, setShowOnlyLow] = useState(false);

  const categories = useMemo(() => Array.from(new Set(products.map(p => p.category).filter(Boolean))).sort(), [products]);

  const filtered = useMemo(() => products.filter(p => {
    const q = p.name.toLowerCase() + p.brand.toLowerCase();
    const matchSearch = q.includes(search.toLowerCase());
    const matchCat = !filterCategory || p.category === filterCategory;
    const matchLow = !showOnlyLow || p.stock <= p.minStock;
    return matchSearch && matchCat && matchLow && p.active;
  }), [products, search, filterCategory, showOnlyLow]);

  const selected = selectedId ? products.find(p => p.id === selectedId) ?? null : null;
  const productMovements = useMemo(() =>
    stockMovements.filter(m => m.productId === selectedId).sort((a, b) => b.date.localeCompare(a.date)),
    [stockMovements, selectedId]);

  const lowStockCount = useMemo(() => products.filter(p => p.active && p.stock <= p.minStock).length, [products]);

  function openNew() { setEditProd(null); setForm(EMPTY_PRODUCT); setShowProdForm(true); }
  function openEdit(p: Product) {
    setEditProd(p);
    setForm({ name: p.name, brand: p.brand, category: p.category, unit: p.unit, purchasePrice: p.purchasePrice, salePrice: p.salePrice, stock: p.stock, minStock: p.minStock, isForSale: p.isForSale, active: p.active });
    setShowProdForm(true);
  }

  function handleSave() {
    if (!form.name.trim()) return;
    if (editProd) updateProduct({ ...editProd, ...form });
    else addProduct(form);
    setShowProdForm(false);
  }

  function handleAddMovement() {
    if (!moveForm.productId) return;
    const qty = moveForm.type === 'load' ? Math.abs(moveForm.quantity) : -Math.abs(moveForm.quantity);
    addStockMovement({ ...moveForm, quantity: qty });
    setShowMoveForm(false);
  }

  return (
    <div className="flex gap-5 h-full" style={{ minHeight: 0 }}>
      {/* ── LEFT: product list ── */}
      <div className="flex flex-col gap-4" style={{ width: '340px', flexShrink: 0 }}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Magazzino</h1>
            <p className="text-xs mt-1" style={{ color: '#71717a' }}>{products.filter(p => p.active).length} prodotti</p>
          </div>
          <button onClick={openNew} style={btnPrimary}><Plus size={14} /></button>
        </div>

        {lowStockCount > 0 && (
          <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
            <AlertTriangle size={14} style={{ color: '#f59e0b' }} />
            <span style={{ fontSize: '12px', color: '#f59e0b' }}>{lowStockCount} prodotti sotto soglia minima</span>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca prodotto…" style={inputStyle} />
          <div className="flex gap-2">
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
              <option value="">Tutte le categorie</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button onClick={() => setShowOnlyLow(p => !p)}
              className="px-3 py-2 rounded-lg text-xs font-medium"
              style={{ background: showOnlyLow ? 'rgba(245,158,11,0.2)' : '#12121a', border: `1px solid ${showOnlyLow ? 'rgba(245,158,11,0.5)' : '#2e2e40'}`, color: showOnlyLow ? '#f59e0b' : '#71717a', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}>
              ⚠ Scorte basse
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2 overflow-y-auto" style={{ flex: 1 }}>
          {filtered.length === 0 && <p style={{ color: '#3f3f5a', fontSize: '13px' }}>Nessun prodotto trovato.</p>}
          {filtered.map(p => (
            <button key={p.id} onClick={() => setSelectedId(p.id)}
              className="text-left rounded-xl px-3 py-3 transition-all"
              style={{ background: selectedId === p.id ? 'rgba(99,102,241,0.15)' : '#1c1c27', border: `1px solid ${selectedId === p.id ? 'rgba(99,102,241,0.5)' : p.stock <= p.minStock ? 'rgba(245,158,11,0.4)' : '#2e2e40'}` }}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-white">{p.name}</p>
                  <p style={{ fontSize: '11px', color: '#71717a' }}>{p.brand}{p.category ? ` · ${p.category}` : ''}</p>
                </div>
                <span className="text-xs font-bold" style={{ color: p.stock <= p.minStock ? '#f59e0b' : '#22c55e' }}>
                  {p.stock} {p.unit}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── RIGHT: product detail ── */}
      <div className="flex-1 overflow-y-auto">
        {!selected ? (
          <div className="flex items-center justify-center h-full" style={{ color: '#3f3f5a' }}>Seleziona un prodotto dalla lista</div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">{selected.name}</h2>
                <p style={{ fontSize: '13px', color: '#71717a' }}>{selected.brand}{selected.category ? ` · ${selected.category}` : ''}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setShowMoveForm(true); setMoveForm({ ...EMPTY_MOVEMENT, productId: selected.id }); }} style={btnPrimary}><Plus size={14} /> Movimento</button>
                <button onClick={() => openEdit(selected)} style={{ ...btnPrimary, color: '#71717a', borderColor: '#2e2e40', background: '#12121a' }}><Pencil size={14} /></button>
                <button onClick={() => { deleteProduct(selected.id); setSelectedId(null); }}
                  style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', borderRadius: '10px', padding: '8px 12px', fontSize: '13px', cursor: 'pointer' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Giacenza', value: `${selected.stock} ${selected.unit}`, color: selected.stock <= selected.minStock ? '#f59e0b' : '#22c55e' },
                { label: 'Soglia minima', value: `${selected.minStock} ${selected.unit}`, color: '#71717a' },
                { label: 'Prezzo acquisto', value: formatCurrency(selected.purchasePrice), color: '#d4d4d8' },
                { label: 'Prezzo vendita', value: selected.isForSale ? formatCurrency(selected.salePrice) : '—', color: '#818cf8' },
              ].map(k => (
                <div key={k.label} style={card} className="text-center">
                  <p className="text-xl font-bold" style={{ color: k.color }}>{k.value}</p>
                  <p className="text-xs mt-1" style={{ color: '#71717a' }}>{k.label}</p>
                </div>
              ))}
            </div>

            {selected.stock <= selected.minStock && (
              <div className="flex items-center gap-2 rounded-xl px-4 py-3" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
                <AlertTriangle size={15} style={{ color: '#f59e0b' }} />
                <span style={{ fontSize: '13px', color: '#f59e0b' }}>Scorta sotto soglia minima — considera il riordino.</span>
              </div>
            )}

            {/* Movement history */}
            <div style={card}>
              <h3 className="text-sm font-semibold text-white mb-3">Storico movimenti</h3>
              {productMovements.length === 0 && <p style={{ color: '#3f3f5a', fontSize: '13px' }}>Nessun movimento registrato.</p>}
              <div className="space-y-2">
                {productMovements.map(m => (
                  <div key={m.id} className="flex items-center justify-between text-sm py-1.5" style={{ borderBottom: '1px solid #2e2e40' }}>
                    <div>
                      <span style={{ color: '#d4d4d8' }}>{STOCK_MOVEMENT_LABELS[m.type]}</span>
                      {m.notes && <span style={{ color: '#71717a', marginLeft: 8, fontSize: '12px' }}>{m.notes}</span>}
                    </div>
                    <div className="flex items-center gap-4">
                      <span style={{ fontSize: '12px', color: '#71717a' }}>{format(parseISO(m.date), 'dd/MM/yyyy')}</span>
                      <span className="font-semibold" style={{ color: m.quantity > 0 ? '#22c55e' : '#ef4444', minWidth: 60, textAlign: 'right' }}>
                        {m.quantity > 0 ? '+' : ''}{m.quantity} {selected.unit}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal: Product Form ── */}
      {showProdForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-6" style={{ background: '#18181f', border: '1px solid #2e2e40' }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-white">{editProd ? 'Modifica Prodotto' : 'Nuovo Prodotto'}</h3>
              <button onClick={() => setShowProdForm(false)} style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label style={labelStyle}>Nome *</label><input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={inputStyle} /></div>
              <div><label style={labelStyle}>Brand</label><input value={form.brand} onChange={e => setForm(p => ({ ...p, brand: e.target.value }))} style={inputStyle} /></div>
              <div><label style={labelStyle}>Categoria</label><input value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} placeholder="es. Colorante, Shampoo…" style={inputStyle} /></div>
              <div><label style={labelStyle}>Unità</label><input value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} placeholder="pz, ml, g…" style={inputStyle} /></div>
              <div><label style={labelStyle}>Giacenza attuale</label><input type="number" min={0} value={form.stock} onChange={e => setForm(p => ({ ...p, stock: Number(e.target.value) }))} style={inputStyle} /></div>
              <div><label style={labelStyle}>Soglia minima riordino</label><input type="number" min={0} value={form.minStock} onChange={e => setForm(p => ({ ...p, minStock: Number(e.target.value) }))} style={inputStyle} /></div>
              <div><label style={labelStyle}>Prezzo acquisto (€)</label><input type="number" min={0} step={0.01} value={form.purchasePrice} onChange={e => setForm(p => ({ ...p, purchasePrice: Number(e.target.value) }))} style={inputStyle} /></div>
              <div><label style={labelStyle}>Prezzo vendita (€)</label><input type="number" min={0} step={0.01} value={form.salePrice} onChange={e => setForm(p => ({ ...p, salePrice: Number(e.target.value) }))} style={inputStyle} /></div>
              <div className="col-span-2 flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: '#d4d4d8' }}>
                  <input type="checkbox" checked={form.isForSale} onChange={e => setForm(p => ({ ...p, isForSale: e.target.checked }))} />
                  In vendita al cliente
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: '#d4d4d8' }}>
                  <input type="checkbox" checked={form.active} onChange={e => setForm(p => ({ ...p, active: e.target.checked }))} />
                  Prodotto attivo
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowProdForm(false)} style={{ background: '#12121a', border: '1px solid #2e2e40', color: '#71717a', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', cursor: 'pointer' }}>Annulla</button>
              <button onClick={handleSave} style={btnPrimary}>Salva</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Movement Form ── */}
      {showMoveForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: '#18181f', border: '1px solid #2e2e40' }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-white">Registra Movimento</h3>
              <button onClick={() => setShowMoveForm(false)} style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label style={labelStyle}>Tipo movimento</label>
                <select value={moveForm.type} onChange={e => setMoveForm(p => ({ ...p, type: e.target.value as StockMovementType }))} style={inputStyle}>
                  {(Object.keys(STOCK_MOVEMENT_LABELS) as StockMovementType[]).map(t => <option key={t} value={t}>{STOCK_MOVEMENT_LABELS[t]}</option>)}
                </select>
              </div>
              <div><label style={labelStyle}>Quantità</label><input type="number" min={1} value={moveForm.quantity} onChange={e => setMoveForm(p => ({ ...p, quantity: Number(e.target.value) }))} style={inputStyle} /></div>
              <div><label style={labelStyle}>Data</label><input type="date" value={moveForm.date} onChange={e => setMoveForm(p => ({ ...p, date: e.target.value }))} style={inputStyle} /></div>
              <div>
                <label style={labelStyle}>Operatore</label>
                <select value={moveForm.operatorId} onChange={e => setMoveForm(p => ({ ...p, operatorId: e.target.value }))} style={inputStyle}>
                  <option value="">—</option>
                  {operators.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div><label style={labelStyle}>Note</label><input value={moveForm.notes} onChange={e => setMoveForm(p => ({ ...p, notes: e.target.value }))} style={inputStyle} /></div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowMoveForm(false)} style={{ background: '#12121a', border: '1px solid #2e2e40', color: '#71717a', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', cursor: 'pointer' }}>Annulla</button>
              <button onClick={handleAddMovement} style={btnPrimary}>Salva</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
