'use client';

import React, { useRef, useState, useCallback, DragEvent } from 'react';
import { useSalon } from '@/context/SalonContext';
import { useApp } from '@/context/AppContext';
import { format } from 'date-fns';
import { X, Upload, Loader2, CheckCircle2, AlertTriangle, FileText, Trash2 } from 'lucide-react';

interface ParsedProduct {
  name: string;
  brand: string;
  category: string;
  quantity: number;
  unit: string;
  purchasePrice: number;
  totalPrice: number;
  selected: boolean;
}

interface InvoiceData {
  supplier: string;
  invoiceDate: string;
  invoiceNumber: string;
  totalAmount: number;
  products: ParsedProduct[];
}

interface Props {
  onClose: () => void;
  onImported: (count: number) => void;
}

const inp: React.CSSProperties = { background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '10px', padding: '8px 12px', color: 'var(--text)', fontSize: '13px', outline: 'none', width: '100%' };
const lbl: React.CSSProperties = { fontSize: '12px', color: 'var(--muted)', marginBottom: '4px', display: 'block' };

type Step = 'upload' | 'parsing' | 'review' | 'importing' | 'done' | 'error';

export default function InvoiceImportModal({ onClose, onImported }: Props) {
  const { products, addProduct, addStockMovement } = useSalon();
  const { addEntry } = useApp();

  const [step, setStep] = useState<Step>('upload');
  const [errorMsg, setErrorMsg] = useState('');
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [dragging, setDragging] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Parse invoice via Gemini ───────────────────────────────────────────────
  const parseFile = useCallback(async (file: File) => {
    setStep('parsing');
    setErrorMsg('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/parse-invoice', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMsg(json.error ?? 'Errore durante l\'analisi. Riprova.');
        setStep('error');
        return;
      }
      const data = json.data as Omit<InvoiceData, 'products'> & { products: Omit<ParsedProduct, 'selected'>[] };
      setInvoice({
        supplier: data.supplier || '',
        invoiceDate: data.invoiceDate || format(new Date(), 'yyyy-MM-dd'),
        invoiceNumber: data.invoiceNumber || '',
        totalAmount: data.totalAmount || 0,
        products: (data.products || []).map(p => ({
          ...p,
          quantity: Math.max(1, Math.round(Number(p.quantity) || 1)),
          purchasePrice: Number(p.purchasePrice) || 0,
          totalPrice: Number(p.totalPrice) || 0,
          unit: p.unit || 'pz',
          selected: true,
        })),
      });
      setStep('review');
    } catch {
      setErrorMsg('Connessione non disponibile. Riprova.');
      setStep('error');
    }
  }, []);

  // ── Drag & drop ────────────────────────────────────────────────────────────
  const onDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) parseFile(file);
  }, [parseFile]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  };

  // ── Edit helpers ───────────────────────────────────────────────────────────
  function updateProduct(idx: number, field: keyof ParsedProduct, value: string | number | boolean) {
    setInvoice(prev => {
      if (!prev) return prev;
      const updated = [...prev.products];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...prev, products: updated };
    });
  }

  function removeProduct(idx: number) {
    setInvoice(prev => {
      if (!prev) return prev;
      return { ...prev, products: prev.products.filter((_, i) => i !== idx) };
    });
  }

  // ── Import into inventory ──────────────────────────────────────────────────
  async function handleImport() {
    if (!invoice) return;
    setStep('importing');

    const today = format(new Date(), 'yyyy-MM-dd');
    const invoiceDate = invoice.invoiceDate || today;
    let totalCost = 0;
    let count = 0;

    for (const p of invoice.products.filter(p => p.selected && p.name.trim())) {
      const qty = Math.max(1, Math.round(p.quantity));
      const price = Number(p.purchasePrice) || 0;
      totalCost += price > 0 ? price * qty : (p.totalPrice || 0);

      // Match existing product by name (case-insensitive)
      const existing = products.find(
        ep => ep.name.toLowerCase().trim() === p.name.toLowerCase().trim()
      );

      let productId: string;
      if (existing) {
        productId = existing.id;
        // Update purchase price if provided
        if (price > 0 && price !== existing.purchasePrice) {
          // Note: updateProduct not imported here by design — keep it simple
        }
      } else {
        // Create new product
        productId = addProduct({
          name: p.name.trim(),
          brand: p.brand?.trim() || invoice.supplier || '',
          category: p.category?.trim() || 'Importato',
          unit: p.unit || 'pz',
          purchasePrice: price,
          salePrice: price > 0 ? Math.round(price * 1.4 * 100) / 100 : 0,
          stock: 0,
          minStock: 5,
          isForSale: false,
          active: true,
        });
      }

      // Add stock movement (load = carico fornitore)
      addStockMovement({
        productId,
        type: 'load',
        quantity: qty,
        date: invoiceDate,
        notes: `📄 Fattura ${invoice.invoiceNumber ? '#' + invoice.invoiceNumber + ' ' : ''}${invoice.supplier || ''}`.trim(),
        operatorId: '',
      });

      count++;
    }

    // Register expense as "Da Pagare" (pending — operator will mark as paid)
    if (totalCost > 0 || invoice.totalAmount > 0) {
      const amount = invoice.totalAmount > 0 ? invoice.totalAmount : totalCost;
      await addEntry({
        type: 'expense',
        date: invoiceDate,
        amount,
        supplier: invoice.supplier || 'Fornitore',
        expenseType: 'Acquisto Prodotti',
        dueDate: '',
        status: 'Da Pagare',
        notes: `📄 Fattura importata${invoice.invoiceNumber ? ' #' + invoice.invoiceNumber : ''} — ${count} prodotti scaricati in magazzino`,
      } as Parameters<typeof addEntry>[0]);
    }

    setImportedCount(count);
    setStep('done');
    onImported(count);
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '20px', width: '100%', maxWidth: '760px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>🤖 Importa Fattura con AI</h2>
            <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
              Carica una foto o PDF della fattura — Gemini AI estrae i prodotti automaticamente
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>

          {/* ── UPLOAD ── */}
          {step === 'upload' && (
            <div>
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragging ? 'rgba(99,102,241,0.8)' : 'var(--border)'}`,
                  borderRadius: '16px',
                  background: dragging ? 'rgba(99,102,241,0.08)' : 'var(--bg-input)',
                  padding: '48px 24px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <Upload size={36} style={{ color: 'var(--accent-light)', margin: '0 auto 12px' }} />
                <p style={{ color: 'var(--text)', fontWeight: 600, marginBottom: '6px' }}>
                  Trascina qui la fattura
                </p>
                <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '12px' }}>
                  oppure clicca per scegliere un file
                </p>
                <p style={{ color: 'var(--border-light)', fontSize: '11px' }}>
                  Formati supportati: JPG, PNG, WebP, HEIC, PDF
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                style={{ display: 'none' }}
                onChange={onFileChange}
              />
            </div>
          )}

          {/* ── PARSING ── */}
          {step === 'parsing' && (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <Loader2 size={40} style={{ color: 'var(--accent-light)', margin: '0 auto 16px', animation: 'spin 1s linear infinite' }} className="animate-spin" />
              <p style={{ color: 'var(--text)', fontWeight: 600, marginBottom: '6px' }}>Analisi in corso…</p>
              <p style={{ color: 'var(--muted)', fontSize: '13px' }}>Gemini AI sta leggendo la fattura</p>
            </div>
          )}

          {/* ── ERROR ── */}
          {step === 'error' && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <AlertTriangle size={36} style={{ color: '#f59e0b', margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--text)', fontWeight: 600, marginBottom: '6px' }}>Analisi fallita</p>
              <p style={{ color: '#f87171', fontSize: '13px', marginBottom: '20px' }}>{errorMsg}</p>
              <button
                onClick={() => { setStep('upload'); setErrorMsg(''); }}
                style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', color: 'var(--accent-light)', borderRadius: '10px', padding: '10px 20px', fontSize: '14px', cursor: 'pointer' }}
              >
                Riprova
              </button>
            </div>
          )}

          {/* ── DONE ── */}
          {step === 'done' && (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <CheckCircle2 size={44} style={{ color: '#22c55e', margin: '0 auto 16px' }} />
              <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: '18px', marginBottom: '8px' }}>
                Importazione completata!
              </p>
              <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '6px' }}>
                {importedCount} prodotti aggiornati in magazzino
              </p>
              <p style={{ color: '#f59e0b', fontSize: '13px' }}>
                ⚠️ La spesa è stata registrata come <strong>Da Pagare</strong> — marcala come pagata quando effettui il pagamento
              </p>
            </div>
          )}

          {/* ── REVIEW ── */}
          {step === 'review' && invoice && (
            <div className="flex flex-col gap-5">
              {/* Invoice meta */}
              <div style={{ background: 'var(--bg-input)', borderRadius: '12px', padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={lbl}>Fornitore *</label>
                  <input
                    value={invoice.supplier}
                    onChange={e => setInvoice(p => p ? { ...p, supplier: e.target.value } : p)}
                    style={inp}
                    placeholder="Nome fornitore"
                  />
                </div>
                <div>
                  <label style={lbl}>Data fattura</label>
                  <input
                    type="date"
                    value={invoice.invoiceDate}
                    onChange={e => setInvoice(p => p ? { ...p, invoiceDate: e.target.value } : p)}
                    style={inp}
                  />
                </div>
                <div>
                  <label style={lbl}>Totale fattura (€)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={invoice.totalAmount || ''}
                    onChange={e => setInvoice(p => p ? { ...p, totalAmount: parseFloat(e.target.value) || 0 } : p)}
                    style={inp}
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Products table */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: '14px' }}>
                    Prodotti rilevati ({invoice.products.filter(p => p.selected).length} selezionati)
                  </p>
                  <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                    Deseleziona o modifica i prodotti prima di importare
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {invoice.products.length === 0 && (
                    <p style={{ color: 'var(--muted)', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
                      Nessun prodotto rilevato. Prova con un&apos;immagine più nitida.
                    </p>
                  )}
                  {invoice.products.map((p, i) => (
                    <div
                      key={i}
                      style={{
                        background: p.selected ? 'var(--bg-input)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${p.selected ? 'var(--border)' : 'rgba(255,255,255,0.05)'}`,
                        borderRadius: '12px',
                        padding: '12px',
                        opacity: p.selected ? 1 : 0.45,
                      }}
                    >
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          checked={p.selected}
                          onChange={e => updateProduct(i, 'selected', e.target.checked)}
                          style={{ marginTop: '3px', cursor: 'pointer', accentColor: 'var(--accent-light)', width: '16px', height: '16px', flexShrink: 0 }}
                        />
                        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 80px 80px', gap: '8px' }}>
                          {/* Name */}
                          <div>
                            <label style={lbl}>Nome prodotto</label>
                            <input value={p.name} onChange={e => updateProduct(i, 'name', e.target.value)} style={inp} placeholder="Nome" />
                          </div>
                          {/* Brand */}
                          <div>
                            <label style={lbl}>Marca</label>
                            <input value={p.brand} onChange={e => updateProduct(i, 'brand', e.target.value)} style={inp} placeholder="Marca" />
                          </div>
                          {/* Category */}
                          <div>
                            <label style={lbl}>Categoria</label>
                            <input value={p.category} onChange={e => updateProduct(i, 'category', e.target.value)} style={inp} placeholder="Categoria" />
                          </div>
                          {/* Quantity */}
                          <div>
                            <label style={lbl}>Quantità</label>
                            <input type="number" min="1" value={p.quantity} onChange={e => updateProduct(i, 'quantity', parseInt(e.target.value) || 1)} style={inp} />
                          </div>
                          {/* Purchase price */}
                          <div>
                            <label style={lbl}>Prezzo (€)</label>
                            <input type="number" min="0" step="0.01" value={p.purchasePrice || ''} onChange={e => updateProduct(i, 'purchasePrice', parseFloat(e.target.value) || 0)} style={inp} placeholder="0.00" />
                          </div>
                        </div>
                        <button onClick={() => removeProduct(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '2px', flexShrink: 0, marginTop: '16px' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {/* Existing product hint */}
                      {(() => {
                        const existing = products.find(ep => ep.name.toLowerCase().trim() === p.name.toLowerCase().trim());
                        return existing ? (
                          <p style={{ fontSize: '11px', color: '#60a5fa', marginTop: '6px', marginLeft: '26px' }}>
                            ✓ Prodotto esistente — verrà aggiornata la giacenza (attuale: {existing.stock} {existing.unit})
                          </p>
                        ) : (
                          <p style={{ fontSize: '11px', color: '#a3e635', marginTop: '6px', marginLeft: '26px' }}>
                            + Nuovo prodotto — verrà creato automaticamente
                          </p>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              </div>

              {/* Pending expense notice */}
              <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '12px', padding: '12px 16px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <AlertTriangle size={16} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '1px' }} />
                <div>
                  <p style={{ color: '#f59e0b', fontSize: '13px', fontWeight: 600 }}>Spesa in sospeso</p>
                  <p style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '2px' }}>
                    La spesa verrà registrata come <strong>Da Pagare</strong>. Vai in Cassa → Uscite per marcarla come pagata quando effettui il bonifico/pagamento.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── IMPORTING ── */}
          {step === 'importing' && (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <Loader2 size={40} style={{ color: 'var(--accent-light)', margin: '0 auto 16px' }} className="animate-spin" />
              <p style={{ color: 'var(--text)', fontWeight: 600 }}>Importazione in corso…</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '10px', flexShrink: 0 }}>
          {step === 'done' ? (
            <button
              onClick={onClose}
              style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', color: 'var(--accent-light)', borderRadius: '10px', padding: '10px 24px', fontSize: '14px', cursor: 'pointer', fontWeight: 600 }}
            >
              Chiudi
            </button>
          ) : step === 'review' && invoice ? (
            <>
              <button
                onClick={onClose}
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: '10px', padding: '10px 20px', fontSize: '13px', cursor: 'pointer' }}
              >
                Annulla
              </button>
              <button
                disabled={invoice.products.filter(p => p.selected).length === 0}
                onClick={handleImport}
                style={{
                  background: invoice.products.filter(p => p.selected).length > 0 ? 'rgba(99,102,241,0.25)' : 'var(--bg-input)',
                  border: `1px solid ${invoice.products.filter(p => p.selected).length > 0 ? 'rgba(99,102,241,0.5)' : 'var(--border)'}`,
                  color: invoice.products.filter(p => p.selected).length > 0 ? 'var(--accent-light)' : 'var(--muted)',
                  borderRadius: '10px', padding: '10px 24px', fontSize: '14px', cursor: invoice.products.filter(p => p.selected).length > 0 ? 'pointer' : 'not-allowed', fontWeight: 600,
                }}
              >
                <FileText size={14} style={{ display: 'inline', marginRight: '6px' }} />
                Importa {invoice.products.filter(p => p.selected).length} prodotti
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: '10px', padding: '10px 20px', fontSize: '13px', cursor: 'pointer' }}
            >
              Annulla
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
