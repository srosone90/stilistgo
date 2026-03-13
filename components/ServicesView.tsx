'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useSalon } from '@/context/SalonContext';
import { Service, ServiceCategory, SERVICE_CATEGORIES, ServiceProductUsage } from '@/types/salon';
import { formatCurrency } from '@/lib/calculations';
import { format } from 'date-fns';
import { Plus, X, Pencil, Trash2, Download, Upload, AlertTriangle, Check } from 'lucide-react';

const card: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px' };
const inputStyle: React.CSSProperties = { background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '10px', padding: '9px 13px', color: 'var(--text)', fontSize: '13px', outline: 'none', width: '100%' };
const labelStyle: React.CSSProperties = { fontSize: '12px', color: 'var(--muted)', marginBottom: '4px', display: 'block' };
const btnPrimary: React.CSSProperties = { background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', color: 'var(--accent-light)', borderRadius: '10px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' };

const EMPTY_SERVICE: Omit<Service, 'id' | 'createdAt'> = {
  name: '', category: 'Taglio', duration: 30, price: 0,
  description: '', operatorIds: [], active: true, productUsage: [],
};

const CAT_COLORS: Record<ServiceCategory, string> = {
  Taglio: '#6366f1', Colore: '#f59e0b', Trattamento: '#22c55e',
  Piega: '#06b6d4', Estetica: '#ec4899', Nail: '#a855f7',
  Sposa: '#ef4444', Altro: 'var(--muted)',
};

// ─── Import preview row type ─────────────────────────────────────────────────
interface ImportRow {
  name: string;
  category: ServiceCategory;
  operatorDuration: number;
  processingDuration: number;
  price: number;
  description: string;
  active: boolean;
  isDup: boolean;
  dupId?: string;
}

export default function ServicesView({ newTrigger }: { newTrigger?: number }) {
  const { services, addService, updateService, deleteService, operators, products } = useSalon();
  const [showForm, setShowForm] = useState(false);
  const [editSvc, setEditSvc] = useState<Service | null>(null);
  const [form, setForm] = useState<Omit<Service, 'id' | 'createdAt'>>(EMPTY_SERVICE);
  const [filterCat, setFilterCat] = useState<ServiceCategory | 'all'>('all');

  // ── Export / Import state ───────────────────────────────────────────────────
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importDupAction, setImportDupAction] = useState<'skip' | 'overwrite'>('skip');
  const [importStep, setImportStep] = useState<'preview' | 'done'>('preview');
  const [importStats, setImportStats] = useState({ imported: 0, skipped: 0, overwritten: 0 });
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (newTrigger && newTrigger > 0) { setShowForm(true); setEditSvc(null); setForm(EMPTY_SERVICE); } }, [newTrigger]);

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
    setForm({ name: s.name, category: s.category, duration: s.duration, operatorDuration: s.operatorDuration ?? s.duration, processingDuration: s.processingDuration ?? 0, price: s.price, description: s.description, operatorIds: [...s.operatorIds], active: s.active, productUsage: [...(s.productUsage ?? [])] });
    setShowForm(true);
  }

  function handleSave() {
    if (!form.name.trim()) return;
    const opDur = form.operatorDuration ?? form.duration;
    const procDur = form.processingDuration ?? 0;
    const serviceData = { ...form, duration: opDur + procDur, operatorDuration: opDur, processingDuration: procDur };
    if (editSvc) updateService({ ...editSvc, ...serviceData });
    else addService(serviceData);
    setShowForm(false);
  }

  function toggleOperator(id: string) {
    setForm(p => ({
      ...p,
      operatorIds: p.operatorIds.includes(id) ? p.operatorIds.filter(x => x !== id) : [...p.operatorIds, id],
    }));
  }

  // ── Export ──────────────────────────────────────────────────────────────────
  function exportServices(fmt: 'csv' | 'json' | 'xml') {
    const today = format(new Date(), 'yyyy-MM-dd');
    let content = ''; let mimeType = 'text/plain;charset=utf-8'; let ext = 'txt';
    if (fmt === 'csv') {
      const BOM = '\uFEFF';
      const header = 'Nome;Categoria;TempoOperatore(min);TempoPosa(min);DurataTotale(min);Prezzo;Descrizione;Attivo';
      const rows = services.map(s => [
        s.name, s.category,
        String(s.operatorDuration ?? s.duration),
        String(s.processingDuration ?? 0),
        String(s.duration),
        s.price.toFixed(2),
        s.description,
        s.active ? 'Sì' : 'No',
      ].map(v => `"${(v ?? '').replace(/"/g, '""')}"`).join(';'));
      content = BOM + [header, ...rows].join('\n'); mimeType = 'text/csv;charset=utf-8'; ext = 'csv';
    } else if (fmt === 'json') {
      content = JSON.stringify(services.map(s => ({
        nome: s.name, categoria: s.category,
        tempoOperatore: s.operatorDuration ?? s.duration,
        tempoPosa: s.processingDuration ?? 0,
        durataTotale: s.duration,
        prezzo: s.price, descrizione: s.description, attivo: s.active,
      })), null, 2); mimeType = 'application/json;charset=utf-8'; ext = 'json';
    } else {
      const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      content = `<?xml version="1.0" encoding="UTF-8"?>\n<servizi>\n` +
        services.map(s =>
          `  <servizio>\n    <nome>${esc(s.name)}</nome>\n    <categoria>${esc(s.category)}</categoria>\n` +
          `    <tempoOperatore>${s.operatorDuration ?? s.duration}</tempoOperatore>\n    <tempoPosa>${s.processingDuration ?? 0}</tempoPosa>\n    <durataTotale>${s.duration}</durataTotale>\n` +
          `    <prezzo>${s.price.toFixed(2)}</prezzo>\n    <descrizione>${esc(s.description)}</descrizione>\n    <attivo>${s.active}</attivo>\n  </servizio>`
        ).join('\n') + '\n</servizi>';
      mimeType = 'application/xml;charset=utf-8'; ext = 'xml';
    }
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `servizi_${today}.${ext}`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    setShowExport(false);
  }

  // ── Import ──────────────────────────────────────────────────────────────────
  function handleImportFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        let rows: ImportRow[] = [];
        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(text);
          if (!Array.isArray(parsed)) { setImportError('Il file JSON deve contenere un array di oggetti.'); setShowImport(true); return; }
          rows = parsed.map((r: Record<string, unknown>) => {
            const opDur = Number(r.tempoOperatore ?? r.operatorDuration ?? r.durataTotale ?? r.duration ?? 30);
            const procDur = Number(r.tempoPosa ?? r.processingDuration ?? 0);
            const rawCat = String(r.categoria ?? r.category ?? 'Altro');
            const cat: ServiceCategory = (SERVICE_CATEGORIES as string[]).includes(rawCat) ? rawCat as ServiceCategory : 'Altro';
            const name = String(r.nome ?? r.name ?? '').trim();
            const dup = services.find(s => s.name.toLowerCase() === name.toLowerCase());
            return { name, category: cat, operatorDuration: opDur, processingDuration: procDur, price: Number(r.prezzo ?? r.price ?? 0), description: String(r.descrizione ?? r.description ?? ''), active: String(r.attivo ?? r.active ?? 'true').toLowerCase() !== 'false' && String(r.attivo ?? r.active ?? 'true') !== '0' && String(r.attivo ?? r.active ?? 'sì').toLowerCase() !== 'no', isDup: !!dup, dupId: dup?.id };
          }).filter((r: ImportRow) => r.name);
        } else {
          // CSV: detect separator
          const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
          if (lines.length < 2) { setImportError('File CSV vuoto o non valido.'); setShowImport(true); return; }
          const sep = lines[0].includes(';') ? ';' : ',';
          const headers = lines[0].split(sep).map(h => h.replace(/^"|"$/g, '').trim().toLowerCase());
          const idx = (k: string[]) => k.map(n => headers.findIndex(h => h === n || h.startsWith(n))).find(i => i >= 0) ?? -1;
          const iName = idx(['nome', 'name']);
          const iCat = idx(['categoria', 'category', 'cat']);
          const iOpDur = idx(['tempooperatore', 'operatorduration', 'tempo operatore', 'op']);
          const iProcDur = idx(['tempoposa', 'processingduration', 'tempo posa', 'posa']);
          const iDur = idx(['duratatotale', 'durata', 'duration', 'total']);
          const iPrice = idx(['prezzo', 'price', 'costo', 'cost']);
          const iDesc = idx(['descrizione', 'description', 'desc']);
          const iActive = idx(['attivo', 'active']);
          if (iName < 0) { setImportError('Colonna "Nome" non trovata nel CSV.'); setShowImport(true); return; }
          const parseCell = (row: string[], i: number) => i >= 0 ? row[i]?.replace(/^"|"$/g, '').trim() : '';
          rows = lines.slice(1).map(line => {
            const cells = line.split(sep);
            const name = parseCell(cells, iName);
            if (!name) return null;
            const rawCat = parseCell(cells, iCat) || 'Altro';
            const cat: ServiceCategory = (SERVICE_CATEGORIES as string[]).includes(rawCat) ? rawCat as ServiceCategory : 'Altro';
            const fallbackDur = iDur >= 0 ? Number(parseCell(cells, iDur)) || 30 : 30;
            const opDur = iOpDur >= 0 ? Number(parseCell(cells, iOpDur)) || fallbackDur : fallbackDur;
            const procDur = iProcDur >= 0 ? Number(parseCell(cells, iProcDur)) || 0 : 0;
            const price = iPrice >= 0 ? parseFloat(parseCell(cells, iPrice).replace(',', '.')) || 0 : 0;
            const desc = parseCell(cells, iDesc);
            const activeStr = (iActive >= 0 ? parseCell(cells, iActive) : 'Sì').toLowerCase();
            const active = activeStr !== 'no' && activeStr !== 'false' && activeStr !== '0';
            const dup = services.find(s => s.name.toLowerCase() === name.toLowerCase());
            return { name, category: cat, operatorDuration: opDur, processingDuration: procDur, price, description: desc, active, isDup: !!dup, dupId: dup?.id } as ImportRow;
          }).filter(Boolean) as ImportRow[];
        }
        if (rows.length === 0) { setImportError('Nessun servizio valido trovato nel file.'); setShowImport(true); return; }
        setImportRows(rows);
        setImportError('');
        setShowImport(true);
      } catch {
        setImportError('Errore nella lettura del file. Verifica che sia un CSV o JSON valido.');
        setShowImport(true);
      }
    };
    reader.readAsText(file, 'utf-8');
  }

  function handleImportConfirm() {
    let imported = 0; let skipped = 0; let overwritten = 0;
    const now = new Date().toISOString();
    for (const r of importRows) {
      const opDur = r.operatorDuration;
      const procDur = r.processingDuration;
      const serviceData = { name: r.name, category: r.category, duration: opDur + procDur, operatorDuration: opDur, processingDuration: procDur, price: r.price, description: r.description, operatorIds: [], active: r.active, productUsage: [] };
      if (r.isDup) {
        if (importDupAction === 'overwrite' && r.dupId) {
          const existing = services.find(s => s.id === r.dupId);
          if (existing) { updateService({ ...existing, ...serviceData }); overwritten++; }
        } else { skipped++; }
      } else {
        addService(serviceData);
        imported++;
      }
    }
    setImportStats({ imported, skipped, overwritten });
    setImportStep('done');
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Listino Servizi</h1>
          <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{services.filter(s => s.active).length} servizi attivi</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowExport(true)} style={{ ...btnPrimary, fontSize: '12px', padding: '6px 10px' }} title="Esporta servizi"><Download size={14} /></button>
          <button onClick={() => { setImportError(''); setImportRows([]); setImportStep('preview'); fileInputRef.current?.click(); }} style={{ ...btnPrimary, fontSize: '12px', padding: '6px 10px' }} title="Importa servizi"><Upload size={14} /></button>
          <input ref={fileInputRef} type="file" accept=".csv,.json" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleImportFile(f); e.target.value = ''; }} />
          <button onClick={openNew} style={btnPrimary}><Plus size={14} /> Nuovo servizio</button>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFilterCat('all')}
          className="text-xs px-3 py-1.5 rounded-lg"
          style={{ background: filterCat === 'all' ? 'rgba(99,102,241,0.2)' : 'var(--bg-input)', border: `1px solid ${filterCat === 'all' ? 'rgba(99,102,241,0.5)' : 'var(--border)'}`, color: filterCat === 'all' ? 'var(--accent-light)' : 'var(--muted)', cursor: 'pointer' }}>
          Tutte
        </button>
        {SERVICE_CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setFilterCat(cat)}
            className="text-xs px-3 py-1.5 rounded-lg"
            style={{ background: filterCat === cat ? `${CAT_COLORS[cat]}20` : 'var(--bg-input)', border: `1px solid ${filterCat === cat ? CAT_COLORS[cat] + '60' : 'var(--border)'}`, color: filterCat === cat ? CAT_COLORS[cat] : 'var(--muted)', cursor: 'pointer' }}>
            {cat}
          </button>
        ))}
      </div>

      {/* Services table */}
      {grouped.length === 0 && <p style={{ color: 'var(--border-light)', fontSize: '13px' }}>Nessun servizio trovato. Aggiungine uno.</p>}
      {grouped.map(({ cat, items }) => (
        <div key={cat} style={card}>
          <h3 className="font-semibold text-sm mb-3" style={{ color: CAT_COLORS[cat] }}>{cat}</h3>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Servizio', 'Durata', 'Prezzo', 'Operatori', 'Attivo', ''].map(h => (
                  <th key={h} className="text-left pb-2 pr-4" style={{ color: 'var(--muted)', fontWeight: 500, fontSize: '12px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid #1e1e2e' }}>
                  <td className="py-2.5 pr-4">
                    <p className="text-white font-medium">{s.name}</p>
                    {s.description && <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{s.description}</p>}
                  </td>
                  <td className="py-2.5 pr-4" style={{ color: 'var(--text-2)' }}>
                    {(s.processingDuration ?? 0) > 0
                      ? <span title={`Operatore: ${s.operatorDuration ?? s.duration}' + Posa: ${s.processingDuration}'`}>{s.operatorDuration ?? s.duration}'+{s.processingDuration}'</span>
                      : <span>{s.duration} min</span>}
                  </td>
                  <td className="py-2.5 pr-4 font-semibold" style={{ color: '#22c55e' }}>{formatCurrency(s.price)}</td>
                  <td className="py-2.5 pr-4" style={{ color: 'var(--muted)', fontSize: '12px' }}>
                    {s.operatorIds.length === 0 ? 'Tutti' : s.operatorIds.map(id => operators.find(o => o.id === id)?.name).filter(Boolean).join(', ')}
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: s.active ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: s.active ? '#22c55e' : '#f87171', border: `1px solid ${s.active ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
                      {s.active ? 'Attivo' : 'Inattivo'}
                    </span>
                  </td>
                  <td className="py-2.5">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => openEdit(s)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '4px' }} title="Modifica"><Pencil size={14} /></button>
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
            <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{k.label}</p>
          </div>
        ))}
      </div>

      {/* ── Modal: Esporta Servizi ── */}
      {showExport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: '#18181f', border: '1px solid var(--border)' }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-white">Esporta Servizi ({services.length})</h3>
              <button onClick={() => setShowExport(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>Scegli il formato per esportare tutti i {services.length} servizi.</p>
            <div className="grid grid-cols-3 gap-3">
              {([
                { fmt: 'csv' as const, label: 'CSV', desc: 'Excel / LibreOffice', icon: '📊' },
                { fmt: 'json' as const, label: 'JSON', desc: 'Backup / sviluppatori', icon: '📋' },
                { fmt: 'xml' as const, label: 'XML', desc: 'Gestionali', icon: '🖥️' },
              ]).map(({ fmt, label, desc, icon }) => (
                <button key={fmt} onClick={() => exportServices(fmt)}
                  className="flex flex-col items-center gap-1 rounded-xl p-4 transition-all hover:opacity-80"
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                  <span style={{ fontSize: '24px', lineHeight: 1 }}>{icon}</span>
                  <span className="text-sm font-semibold text-white">{label}</span>
                  <span className="text-xs text-center" style={{ color: 'var(--muted)' }}>{desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Importa Servizi ── */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6" style={{ background: '#18181f', border: '1px solid var(--border)' }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-white">
                {importStep === 'done' ? 'Importazione completata' : `Anteprima importazione (${importRows.length} servizi)`}
              </h3>
              <button onClick={() => { setShowImport(false); setImportRows([]); setImportStep('preview'); }} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            {importError && (
              <div className="flex items-center gap-2 rounded-xl p-3 mb-4" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
                <AlertTriangle size={16} color="#f87171" />
                <span className="text-sm" style={{ color: '#f87171' }}>{importError}</span>
              </div>
            )}

            {importStep === 'done' ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Importati', value: importStats.imported, color: '#22c55e' },
                    { label: 'Saltati (dup)', value: importStats.skipped, color: 'var(--muted)' },
                    { label: 'Sovrascritti', value: importStats.overwritten, color: '#f59e0b' },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
                      <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{s.label}</p>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end">
                  <button onClick={() => { setShowImport(false); setImportRows([]); setImportStep('preview'); }} style={btnPrimary}><Check size={14} /> Chiudi</button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Dup action */}
                {importRows.some(r => r.isDup) && (
                  <div className="rounded-xl p-3" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
                    <p className="text-sm font-medium mb-2" style={{ color: '#f59e0b' }}>
                      <AlertTriangle size={14} style={{ display: 'inline', marginRight: 4 }} />
                      {importRows.filter(r => r.isDup).length} servizi già esistenti con lo stesso nome.
                    </p>
                    <div className="flex gap-3">
                      {(['skip', 'overwrite'] as const).map(opt => (
                        <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
                          <input type="radio" name="dupAction" value={opt} checked={importDupAction === opt} onChange={() => setImportDupAction(opt)} />
                          <span className="text-xs" style={{ color: 'var(--text-2)' }}>
                            {opt === 'skip' ? 'Salta i duplicati' : 'Sovrascrivi i duplicati'}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Preview table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        {['Nome', 'Categoria', 'T.Op', 'T.Posa', 'Prezzo', 'Attivo', 'Stato'].map(h => (
                          <th key={h} className="text-left pb-2 pr-3" style={{ color: 'var(--muted)', fontWeight: 500 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {importRows.map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #1e1e2e' }}>
                          <td className="py-2 pr-3 text-white font-medium">{r.name}</td>
                          <td className="py-2 pr-3" style={{ color: 'var(--text-2)' }}>{r.category}</td>
                          <td className="py-2 pr-3" style={{ color: 'var(--text-2)' }}>{r.operatorDuration}&apos;</td>
                          <td className="py-2 pr-3" style={{ color: 'var(--text-2)' }}>{r.processingDuration}&apos;</td>
                          <td className="py-2 pr-3" style={{ color: '#22c55e' }}>{formatCurrency(r.price)}</td>
                          <td className="py-2 pr-3">
                            <span className="px-1.5 py-0.5 rounded-full text-xs" style={{ background: r.active ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: r.active ? '#22c55e' : '#f87171' }}>
                              {r.active ? 'Sì' : 'No'}
                            </span>
                          </td>
                          <td className="py-2">
                            {r.isDup
                              ? <span className="px-1.5 py-0.5 rounded-full text-xs" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>Duplicato</span>
                              : <span className="px-1.5 py-0.5 rounded-full text-xs" style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--accent-light)' }}>Nuovo</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end gap-2">
                  <button onClick={() => { setShowImport(false); setImportRows([]); }} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', cursor: 'pointer' }}>Annulla</button>
                  <button onClick={handleImportConfirm} style={btnPrimary}><Check size={14} /> Importa {importRows.filter(r => !r.isDup || importDupAction === 'overwrite').length} servizi</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-6" style={{ background: '#18181f', border: '1px solid var(--border)' }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-white">{editSvc ? 'Modifica Servizio' : 'Nuovo Servizio'}</h3>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label style={labelStyle}>Nome servizio *</label><input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={inputStyle} /></div>
              <div>
                <label style={labelStyle}>Categoria</label>
                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value as ServiceCategory }))} style={inputStyle}>
                  {SERVICE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Tempo operatore (min)</label>
                <input type="number" min={5} step={5} value={form.operatorDuration ?? form.duration} onChange={e => setForm(p => ({ ...p, operatorDuration: Number(e.target.value) }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Tempo posa/attesa (min)</label>
                <input type="number" min={0} step={5} value={form.processingDuration ?? 0} onChange={e => setForm(p => ({ ...p, processingDuration: Number(e.target.value) }))} style={inputStyle} />
              </div>
              <div><label style={labelStyle}>Prezzo (€)</label><input type="number" min={0} step={0.5} value={form.price} onChange={e => setForm(p => ({ ...p, price: Number(e.target.value) }))} style={inputStyle} /></div>
              <div className="flex items-center gap-2 pt-6 col-span-1">
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Totale: <strong style={{ color: 'var(--text)' }}>{(form.operatorDuration ?? form.duration) + (form.processingDuration ?? 0)} min</strong></span>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input type="checkbox" id="active" checked={form.active} onChange={e => setForm(p => ({ ...p, active: e.target.checked }))} />
                <label htmlFor="active" style={{ fontSize: '13px', color: 'var(--text-2)' }}>Servizio attivo</label>
              </div>
              <div className="col-span-2"><label style={labelStyle}>Descrizione</label><textarea rows={2} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} /></div>
              <div className="col-span-2">
                <label style={labelStyle}>Operatori abilitati (vuoto = tutti)</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {operators.filter(o => o.active).map(o => (
                    <button key={o.id} type="button" onClick={() => toggleOperator(o.id)}
                      className="text-xs px-2.5 py-1 rounded-lg transition-all"
                      style={{ background: form.operatorIds.includes(o.id) ? 'rgba(99,102,241,0.25)' : 'var(--bg-input)', border: `1px solid ${form.operatorIds.includes(o.id) ? 'rgba(99,102,241,0.5)' : 'var(--border)'}`, color: form.operatorIds.includes(o.id) ? 'var(--accent-light)' : 'var(--muted)', cursor: 'pointer' }}>
                      {o.name}
                    </button>
                  ))}
                </div>
              </div>
              {/* Product usage section */}
              <div className="col-span-2">
                <label style={labelStyle}>Prodotti usati per questo servizio (scalati automaticamente) </label>
                <div className="space-y-2 mt-1">
                  {(form.productUsage ?? []).map((usage, idx) => {
                    const prod = products.find(p => p.id === usage.productId);
                    return (
                      <div key={idx} className="flex items-center gap-2">
                        <select
                          value={usage.productId}
                          onChange={e => setForm(f => { const u = [...(f.productUsage ?? [])]; u[idx] = { ...u[idx], productId: e.target.value }; return { ...f, productUsage: u }; })}
                          style={{ ...inputStyle, flex: 1 }}>
                          <option value="">— Seleziona prodotto —</option>
                          {products.filter(p => p.active).map(p => <option key={p.id} value={p.id}>{p.name} ({p.brand})</option>)}
                        </select>
                        <input type="number" min={0.01} step={0.01}
                          value={usage.qty}
                          onChange={e => setForm(f => { const u = [...(f.productUsage ?? [])]; u[idx] = { ...u[idx], qty: parseFloat(e.target.value) || 0 }; return { ...f, productUsage: u }; })}
                          style={{ ...inputStyle, width: '80px' }}
                          placeholder="qty" />
                        {prod && <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{prod.unit}</span>}
                        <button type="button" onClick={() => setForm(f => ({ ...f, productUsage: (f.productUsage ?? []).filter((_, i) => i !== idx) }))}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}>×</button>
                      </div>
                    );
                  })}
                  <button type="button"
                    onClick={() => setForm(f => ({ ...f, productUsage: [...(f.productUsage ?? []), { productId: '', qty: 1 }] }))}
                    style={{ ...btnPrimary, fontSize: '12px', padding: '6px 12px' }}>
                    <Plus size={12} /> Aggiungi prodotto
                  </button>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowForm(false)} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', cursor: 'pointer' }}>Annulla</button>
              <button onClick={handleSave} style={btnPrimary}>Salva</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
