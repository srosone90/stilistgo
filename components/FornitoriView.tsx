'use client';

import React, { useState, useEffect } from 'react';
import { useSalon } from '@/context/SalonContext';
import { Supplier } from '@/types/salon';
import {
  Plus, Search, Pencil, Trash2, X, Building2, Phone, Mail, MapPin, Package, ChevronRight,
} from 'lucide-react';

const EMPTY_FORM: Omit<Supplier, 'id' | 'createdAt'> = {
  name: '', contactName: '', phone: '', email: '', address: '', notes: '', active: true,
};

export default function FornitoriView({ newTrigger }: { newTrigger?: number }) {
  const { suppliers, addSupplier, updateSupplier, deleteSupplier, products, updateProduct } = useSalon();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Supplier | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => { if (newTrigger) openAdd(); }, [newTrigger]); // eslint-disable-line react-hooks/exhaustive-deps
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.contactName.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase())
  );

  function openAdd() { setForm(EMPTY_FORM); setEditTarget(null); setShowForm(true); }
  function openEdit(s: Supplier) { setForm({ name: s.name, contactName: s.contactName, phone: s.phone, email: s.email, address: s.address, notes: s.notes, active: s.active }); setEditTarget(s); setShowForm(true); }

  function handleSave() {
    if (!form.name.trim()) return;
    if (editTarget) updateSupplier({ ...editTarget, ...form });
    else addSupplier(form);
    setShowForm(false);
  }

  function handleDelete(id: string) {
    // Unlink products before deleting
    products.filter(p => p.supplierId === id).forEach(p => updateProduct({ ...p, supplierId: undefined }));
    deleteSupplier(id);
    setConfirmDelete(null);
    if (selectedId === id) setSelectedId(null);
  }

  const selectedSupplier = suppliers.find(s => s.id === selectedId);
  const supplierProducts = products.filter(p => p.supplierId === selectedId && p.active);

  return (
    <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
      {/* List panel */}
      <div className="flex flex-col border-r" style={{ minWidth: 0, flex: '0 0 320px', borderColor: 'var(--border)', background: 'var(--bg-sidebar)' }}>
        {/* Toolbar */}
        <div className="p-4 space-y-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-white">Fornitori</h1>
            <button onClick={openAdd}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all hover:opacity-80"
              style={{ background: '#6366f1' }}>
              <Plus size={14} />Nuovo
            </button>
          </div>
          <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <Search size={14} style={{ color: 'var(--muted)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Cerca fornitore…"
              className="flex-1 bg-transparent text-sm outline-none text-white placeholder:text-[var(--muted)]" />
          </div>
        </div>

        {/* Supplier list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-8 text-center">
              <Building2 size={32} className="mx-auto mb-2" style={{ color: 'var(--muted)' }} />
              <p className="text-sm" style={{ color: 'var(--muted)' }}>Nessun fornitore trovato</p>
            </div>
          ) : (
            filtered.map(s => (
              <button key={s.id}
                onClick={() => setSelectedId(selectedId === s.id ? null : s.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all hover:opacity-80"
                style={{
                  background: selectedId === s.id ? 'var(--bg-card)' : 'transparent',
                  borderBottom: '1px solid var(--border)',
                }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                  <Building2 size={16} style={{ color: '#6366f1' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{s.name}</p>
                  {s.contactName && <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>{s.contactName}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: s.active ? '#22c55e22' : '#ef444422', color: s.active ? '#22c55e' : '#ef4444' }}>
                    {s.active ? 'Attivo' : 'Inattivo'}
                  </span>
                  <ChevronRight size={14} style={{ color: 'var(--muted)' }} />
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Detail panel */}
      <div className="flex-1 overflow-y-auto" style={{ background: 'var(--bg-page)' }}>
        {!selectedSupplier ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <Building2 size={48} className="mb-3" style={{ color: 'var(--muted)' }} />
            <p className="font-medium text-white">Seleziona un fornitore</p>
            <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
              Clicca su un fornitore per vedere i dettagli e i prodotti collegati
            </p>
          </div>
        ) : (
          <div className="p-4 md:p-6 space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">{selectedSupplier.name}</h2>
                {selectedSupplier.contactName && (
                  <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>Referente: {selectedSupplier.contactName}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEdit(selectedSupplier)}
                  className="p-2 rounded-lg transition-all hover:opacity-80"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                  <Pencil size={14} style={{ color: 'var(--text-2)' }} />
                </button>
                <button onClick={() => setConfirmDelete(selectedSupplier.id)}
                  className="p-2 rounded-lg transition-all hover:opacity-80"
                  style={{ background: '#ef444420', border: '1px solid #ef4444' }}>
                  <Trash2 size={14} style={{ color: '#ef4444' }} />
                </button>
              </div>
            </div>

            {/* Info cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {selectedSupplier.phone && (
                <div className="flex items-center gap-3 rounded-xl p-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                  <Phone size={16} style={{ color: '#6366f1' }} />
                  <div>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>Telefono</p>
                    <a href={`tel:${selectedSupplier.phone}`} className="text-sm font-medium text-white hover:underline">{selectedSupplier.phone}</a>
                  </div>
                </div>
              )}
              {selectedSupplier.email && (
                <div className="flex items-center gap-3 rounded-xl p-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                  <Mail size={16} style={{ color: '#6366f1' }} />
                  <div>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>Email</p>
                    <a href={`mailto:${selectedSupplier.email}`} className="text-sm font-medium text-white hover:underline">{selectedSupplier.email}</a>
                  </div>
                </div>
              )}
              {selectedSupplier.address && (
                <div className="flex items-center gap-3 rounded-xl p-3 sm:col-span-2" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                  <MapPin size={16} style={{ color: '#6366f1' }} />
                  <div>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>Indirizzo</p>
                    <p className="text-sm font-medium text-white">{selectedSupplier.address}</p>
                  </div>
                </div>
              )}
            </div>

            {selectedSupplier.notes && (
              <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>NOTE</p>
                <p className="text-sm text-white whitespace-pre-line">{selectedSupplier.notes}</p>
              </div>
            )}

            {/* Products linked */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-white">Prodotti collegati ({supplierProducts.length})</p>
              </div>
              {supplierProducts.length === 0 ? (
                <div className="rounded-xl p-4 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                  <Package size={24} className="mx-auto mb-1" style={{ color: 'var(--muted)' }} />
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>Nessun prodotto collegato</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                    Collega i prodotti a questo fornitore nella sezione Magazzino
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {supplierProducts.map(p => (
                    <div key={p.id} className="flex items-center justify-between rounded-xl px-4 py-3"
                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                      <div>
                        <p className="text-sm font-medium text-white">{p.name}</p>
                        <p className="text-xs" style={{ color: 'var(--muted)' }}>{p.brand} · {p.category}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-white">{p.stock} {p.unit}</p>
                        <p className="text-xs" style={{ color: p.stock <= p.minStock ? '#ef4444' : 'var(--muted)' }}>
                          min. {p.minStock}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-lg rounded-2xl p-6 space-y-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white">{editTarget ? 'Modifica fornitore' : 'Nuovo fornitore'}</h2>
              <button onClick={() => setShowForm(false)}><X size={18} style={{ color: 'var(--muted)' }} /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: 'Nome azienda *', key: 'name', placeholder: 'es. L\'Oréal Italia' },
                { label: 'Referente', key: 'contactName', placeholder: 'Nome del contatto' },
                { label: 'Telefono', key: 'phone', placeholder: '+39 02 …' },
                { label: 'Email', key: 'email', placeholder: 'info@fornitore.it' },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>{label}</label>
                  <input
                    value={(form as unknown as Record<string, string>)[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none text-white placeholder:text-[var(--muted)]"
                    style={{ background: 'var(--bg-page)', border: '1px solid var(--border)' }} />
                </div>
              ))}
              <div className="sm:col-span-2">
                <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Indirizzo</label>
                <input
                  value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  placeholder="Via …, città"
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none text-white placeholder:text-[var(--muted)]"
                  style={{ background: 'var(--bg-page)', border: '1px solid var(--border)' }} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Note</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  placeholder="Note interne..."
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none text-white placeholder:text-[var(--muted)] resize-none"
                  style={{ background: 'var(--bg-page)', border: '1px solid var(--border)' }} />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-white">
                <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
                Attivo
              </label>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-2 rounded-xl text-sm font-medium"
                style={{ background: 'var(--bg-page)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
                Annulla
              </button>
              <button onClick={handleSave} disabled={!form.name.trim()}
                className="flex-1 py-2 rounded-xl text-sm font-medium text-white transition-all hover:opacity-80 disabled:opacity-40"
                style={{ background: '#6366f1' }}>
                {editTarget ? 'Aggiorna' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="rounded-2xl p-6 space-y-4 max-w-sm w-full" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <p className="font-bold text-white">Eliminare fornitore?</p>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              I prodotti collegati verranno scollegati. Questa azione non è reversibile.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2 rounded-xl text-sm font-medium"
                style={{ background: 'var(--bg-page)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
                Annulla
              </button>
              <button onClick={() => handleDelete(confirmDelete)}
                className="flex-1 py-2 rounded-xl text-sm font-medium text-white"
                style={{ background: '#ef4444' }}>
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
