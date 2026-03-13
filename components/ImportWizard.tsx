'use client';

/**
 * ImportWizard.tsx — Multi-step CSV import wizard for clients.
 *
 * Steps:
 *   1. upload   — file selection (click or drag-and-drop), auto-parse & auto-map
 *   2. mapping  — per-column dropdown + auto-match highlights + saved profiles
 *   3. preview  — summary counts, duplicate resolution choice, row preview
 *   4. importing — animated progress bar
 *   5. done     — final stats + downloadable log
 */

import React, { useState, useEffect } from 'react';
import { useSalon } from '@/context/SalonContext';
import { getCurrentUser } from '@/lib/supabase';
import { salonGenerateId } from '@/lib/salonStorage';
import {
  Upload, X, ChevronRight, ChevronLeft, Check,
  AlertTriangle, Download, Save, Trash2, BookOpen,
} from 'lucide-react';
import {
  decodeFileBuffer, parseCsv, autoMatch, TARGET_FIELDS, FieldKey,
  processRow, normalizePhone,
  loadImportProfiles, saveImportProfile, deleteImportProfile,
  ImportProfile, ColumnMapping, ParsedRow,
} from '@/lib/importParser';
import type { Client } from '@/types/salon';

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'upload' | 'mapping' | 'preview' | 'importing' | 'done';
type DupAction = 'skip' | 'overwrite' | 'import';

interface ProcessedRow extends ParsedRow {
  isDup: boolean;
  dupClientId?: string;
}

// ─── Shared styles (mirror ClientsView.tsx) ───────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-input)', border: '1px solid var(--border)',
  borderRadius: '10px', padding: '8px 12px', color: 'var(--text)',
  fontSize: '13px', outline: 'none', width: '100%',
};
const btnPrimary: React.CSSProperties = {
  background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)',
  color: 'var(--accent-light)', borderRadius: '10px', padding: '8px 16px',
  fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
};
const btnSecondary: React.CSSProperties = {
  background: 'var(--bg-input)', border: '1px solid var(--border)',
  color: 'var(--text-2)', borderRadius: '10px', padding: '8px 16px',
  fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
};
const btnDanger: React.CSSProperties = {
  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
  color: '#f87171', borderRadius: '8px', padding: '5px 10px',
  fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ImportWizard({ onClose }: { onClose: () => void }) {
  const { clients, addClient, updateClient } = useSalon();
  const [salonId, setSalonId] = useState('');
  useEffect(() => { getCurrentUser().then(u => { if (u) setSalonId(u.id); }); }, []);

  const [step, setStep] = useState<Step>('upload');
  const [isDragging, setIsDragging] = useState(false);

  // ── Step 1: upload ───────────────────────────────────────────────────────────
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [fileName, setFileName] = useState('');
  const [uploadError, setUploadError] = useState('');

  // ── Step 2: mapping ──────────────────────────────────────────────────────────
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [profiles, setProfiles] = useState<ImportProfile[]>([]);
  const [saveProfileName, setSaveProfileName] = useState('');
  const [showSaveProfile, setShowSaveProfile] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editingProfileName, setEditingProfileName] = useState('');

  // ── Step 3: preview ──────────────────────────────────────────────────────────
  const [processedRows, setProcessedRows] = useState<ProcessedRow[]>([]);
  const [dupAction, setDupAction] = useState<DupAction>('skip');
  const [dupCount, setDupCount] = useState(0);
  const [warnCount, setWarnCount] = useState(0);

  // ── Step 4/5: import results ─────────────────────────────────────────────────
  const [progress, setProgress] = useState(0);
  const [resultStats, setResultStats] = useState({ imported: 0, skipped: 0, overwritten: 0, warnings: 0 });
  const [errorLog, setErrorLog] = useState<string[]>([]);

  // Load saved profiles when salonId becomes available
  useEffect(() => {
    if (salonId) setProfiles(loadImportProfiles(salonId));
  }, [salonId]);

  // ─── File processing ─────────────────────────────────────────────────────────

  async function handleFile(file: File) {
    setUploadError('');
    const name = file.name.toLowerCase();
    if (!name.endsWith('.csv') && !name.endsWith('.txt')) {
      setUploadError('Solo file CSV (.csv, .txt) sono supportati in questa versione del wizard.');
      return;
    }
    try {
      const buf = await file.arrayBuffer();
      const text = decodeFileBuffer(buf);
      const { headers, rows } = parseCsv(text);
      if (headers.length === 0) { setUploadError('File CSV vuoto o non riconosciuto.'); return; }
      if (rows.length === 0) { setUploadError('Il file non contiene righe di dati (solo intestazione).'); return; }
      setCsvHeaders(headers);
      setCsvRows(rows);
      setFileName(file.name);
      // Auto-map each column
      const m: ColumnMapping = {};
      headers.forEach(h => { m[h] = autoMatch(h); });
      setMapping(m);
      setStep('mapping');
    } catch {
      setUploadError('Errore nella lettura del file. Verifica che sia un CSV valido.');
    }
  }

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = ''; // reset so the same file can be re-selected
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }

  // ─── Profile management ──────────────────────────────────────────────────────

  function applyProfile(profile: ImportProfile) {
    // Overlay only columns that exist in the current file
    const m: ColumnMapping = { ...mapping };
    csvHeaders.forEach(h => {
      if (profile.mapping[h] !== undefined) m[h] = profile.mapping[h];
    });
    setMapping(m);
  }

  function handleSaveProfile() {
    if (!saveProfileName.trim() || !salonId) return;
    const profile: ImportProfile = {
      id: salonGenerateId(),
      name: saveProfileName.trim(),
      mapping: { ...mapping },
      createdAt: new Date().toISOString(),
    };
    saveImportProfile(salonId, profile);
    setProfiles(loadImportProfiles(salonId));
    setSaveProfileName('');
    setShowSaveProfile(false);
  }

  function handleDeleteProfile(id: string) {
    if (!salonId) return;
    deleteImportProfile(salonId, id);
    setProfiles(loadImportProfiles(salonId));
  }

  function handleRenameProfile(id: string, name: string) {
    if (!salonId || !name.trim()) return;
    const all = loadImportProfiles(salonId);
    const p = all.find(x => x.id === id);
    if (!p) return;
    saveImportProfile(salonId, { ...p, name: name.trim() });
    setProfiles(loadImportProfiles(salonId));
    setEditingProfileId(null);
  }

  // ─── Transition to preview ───────────────────────────────────────────────────

  function goToPreview() {
    // Snapshot existing clients once — avoids re-checking against partially
    // updated state if the user somehow triggers import multiple times.
    const existingByPhone = new Map<string, Client>(
      clients
        .filter(c => c.phone.trim())
        .map(c => [normalizePhone(c.phone), c]),
    );
    const existingByEmail = new Map<string, Client>(
      clients
        .filter(c => c.email.trim())
        .map(c => [c.email.toLowerCase(), c]),
    );

    const rows: ProcessedRow[] = [];
    // Collect warnings for the pre-import log
    const warningLines: string[] = [];

    for (let i = 0; i < csvRows.length; i++) {
      const pr = processRow(csvRows[i], csvHeaders, mapping, i + 2); // row 2 = first data row
      const { record } = pr;
      // Skip rows that are completely empty
      if (!record.firstName && !record.lastName && !record.phone && !record.email) continue;

      const phone = normalizePhone(record.phone);
      const email = record.email.toLowerCase();
      const dupByPhone = phone ? existingByPhone.get(phone) : undefined;
      const dupByEmail = email ? existingByEmail.get(email) : undefined;
      const dupClient = dupByPhone ?? dupByEmail;

      rows.push({ ...pr, isDup: !!dupClient, dupClientId: dupClient?.id });
      warningLines.push(...pr.warnings);
    }

    setProcessedRows(rows);
    setDupCount(rows.filter(r => r.isDup).length);
    setWarnCount(rows.filter(r => r.warnings.length > 0).length);
    setErrorLog(warningLines); // preview log = validation warnings only
    setStep('preview');
  }

  // ─── Execute import ──────────────────────────────────────────────────────────

  async function executeImport() {
    setStep('importing');
    setProgress(0);
    let imported = 0, skipped = 0, overwritten = 0, warnings = 0;
    const log: string[] = [];
    const today = new Date().toISOString().slice(0, 10);

    for (let i = 0; i < processedRows.length; i++) {
      const { record, isDup, dupClientId, warnings: rowWarnings, rowIndex } = processedRows[i];
      const fullRecord: Omit<Client, 'id' | 'createdAt'> = {
        ...record,
        gdprDate: record.gdprConsent ? (record.gdprDate || today) : '',
      };

      if (isDup) {
        if (dupAction === 'skip') {
          skipped++;
          log.push(`Riga ${rowIndex}: SALTATO — ${record.firstName} ${record.lastName} (duplicato)`);
        } else if (dupAction === 'overwrite' && dupClientId) {
          const existing = clients.find(c => c.id === dupClientId);
          if (existing) {
            updateClient({ ...existing, ...fullRecord });
            overwritten++;
          }
          if (rowWarnings.length) { warnings++; log.push(...rowWarnings); }
        } else {
          // import_anyway — create new record even if duplicate
          addClient(fullRecord);
          imported++;
          if (rowWarnings.length) { warnings++; log.push(...rowWarnings); }
        }
      } else {
        addClient(fullRecord);
        imported++;
        if (rowWarnings.length) { warnings++; log.push(...rowWarnings); }
      }

      setProgress(Math.round(((i + 1) / processedRows.length) * 100));
      // Yield to the event loop every 100 rows to keep the UI responsive
      if (i % 100 === 99) await new Promise<void>(r => setTimeout(r, 0));
    }

    setResultStats({ imported, skipped, overwritten, warnings });
    setErrorLog(log);
    setStep('done');
  }

  // ─── Download log ─────────────────────────────────────────────────────────────

  function downloadLog() {
    if (errorLog.length === 0) return;
    const blob = new Blob([errorLog.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'import_log.txt'; a.click();
    URL.revokeObjectURL(url);
  }

  // ─── Derived helpers ──────────────────────────────────────────────────────────

  // True if every required field has been mapped to at least one column
  const requiredMapped = TARGET_FIELDS
    .filter(f => f.required)
    .every(f => Object.values(mapping).includes(f.key));

  // Returns true when the current mapping for `header` matches the auto-detected value
  // (used to display the "auto" badge)
  function wasAutoMatched(header: string): boolean {
    const detected = autoMatch(header);
    return detected !== '__ignore__' && detected === mapping[header];
  }

  const importableCount = processedRows.filter(r => !r.isDup || dupAction !== 'skip').length;

  // ─── Step indicator metadata ──────────────────────────────────────────────────

  const STEPS: { key: Step; label: string }[] = [
    { key: 'upload',    label: 'Carica' },
    { key: 'mapping',   label: 'Mappa' },
    { key: 'preview',   label: 'Anteprima' },
    { key: 'importing', label: 'Importa' },
    { key: 'done',      label: 'Fatto' },
  ];
  const stepIndex = STEPS.findIndex(s => s.key === step);

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.72)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: '16px',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: '20px', width: '100%', maxWidth: '720px',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px 0', flexShrink: 0,
        }}>
          <h2 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '18px', margin: 0 }}>
            Importa Clienti
          </h2>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--muted)', padding: '4px', display: 'flex',
          }}>
            <X size={18} />
          </button>
        </div>

        {/* ── Step indicator ── */}
        <div style={{ padding: '16px 24px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {STEPS.map((s, i) => (
              <React.Fragment key={s.key}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: i > stepIndex ? 0.35 : 1 }}>
                  <div style={{
                    width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '11px', fontWeight: 700,
                    background: i < stepIndex ? 'rgba(34,197,94,0.2)' : i === stepIndex ? 'rgba(99,102,241,0.3)' : 'var(--bg-input)',
                    border: `1px solid ${i < stepIndex ? 'rgba(34,197,94,0.5)' : i === stepIndex ? 'rgba(99,102,241,0.6)' : 'var(--border)'}`,
                    color: i < stepIndex ? '#22c55e' : i === stepIndex ? 'var(--accent-light)' : 'var(--muted)',
                  }}>
                    {i < stepIndex ? <Check size={12} /> : i + 1}
                  </div>
                  <span style={{
                    fontSize: '12px', whiteSpace: 'nowrap',
                    fontWeight: i === stepIndex ? 600 : 400,
                    color: i === stepIndex ? 'var(--accent-light)' : 'var(--muted)',
                  }}>{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{ flex: 1, height: '1px', background: 'var(--border)', minWidth: '8px' }} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* ── Content ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* ════ STEP 1: Upload ════ */}
          {step === 'upload' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Saved profiles — shown here too so user can recognise a known source */}
              {profiles.length > 0 && (
                <div style={{ padding: '12px', borderRadius: '12px', background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
                  <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '0 0 8px' }}>
                    Profili di mapping salvati (saranno applicabili al passo successivo):
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {profiles.map(p => (
                      <span key={p.id} style={{
                        display: 'flex', alignItems: 'center', gap: '5px',
                        padding: '4px 10px', borderRadius: '8px', fontSize: '12px',
                        background: 'rgba(99,102,241,0.1)', color: 'var(--accent-light)',
                        border: '1px solid rgba(99,102,241,0.25)',
                      }}>
                        <BookOpen size={11} /> {p.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Drop zone */}
              <label
                onDragEnter={() => setIsDragging(true)}
                onDragLeave={() => setIsDragging(false)}
                onDragOver={e => e.preventDefault()}
                onDrop={onDrop}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', gap: '12px', borderRadius: '16px',
                  padding: '48px 24px', cursor: 'pointer', transition: 'all 0.2s',
                  border: `2px dashed ${isDragging ? 'rgba(99,102,241,0.7)' : 'var(--border)'}`,
                  background: isDragging ? 'rgba(99,102,241,0.06)' : 'transparent',
                }}>
                <Upload size={30} style={{ color: 'var(--accent-light)' }} />
                <div style={{ textAlign: 'center' }}>
                  <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: '15px', margin: 0 }}>
                    Clicca o trascina qui il file CSV
                  </p>
                  <p style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '4px' }}>
                    Separatore auto-rilevato ( ; , \t ) · UTF-8 · UTF-8 BOM · ISO-8859-1
                  </p>
                </div>
                <input type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={onFileInput} />
              </label>

              {uploadError && (
                <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
                  <p style={{ fontSize: '13px', color: '#f87171', margin: 0 }}>{uploadError}</p>
                </div>
              )}

              <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)' }}>
                <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0, lineHeight: '1.7' }}>
                  <strong style={{ color: 'var(--accent-light)' }}>Campi supportati:</strong>{' '}
                  Nome, Cognome, Sesso, Data di nascita, Telefono, Email, Indirizzo, CAP, Provincia,
                  Fonte acquisizione, Data acquisizione, Punti fedeltà, Privacy, Tag, Note, Allergie.
                  Il mapping colonne avviene al passo successivo.
                </p>
              </div>
            </div>
          )}

          {/* ════ STEP 2: Mapping ════ */}
          {step === 'mapping' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Saved profiles */}
              {profiles.length > 0 && (
                <div style={{ padding: '12px', borderRadius: '12px', background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
                  <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '0 0 8px' }}>
                    Applica un profilo salvato · <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>doppio clic per rinominare</span>
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {profiles.map(p => (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {editingProfileId === p.id ? (
                          <>
                            <input
                              autoFocus
                              value={editingProfileName}
                              onChange={e => setEditingProfileName(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleRenameProfile(p.id, editingProfileName);
                                if (e.key === 'Escape') setEditingProfileId(null);
                              }}
                              style={{ ...inputStyle, width: '160px', padding: '4px 8px', fontSize: '12px' }}
                            />
                            <button onClick={() => handleRenameProfile(p.id, editingProfileName)} style={{ ...btnPrimary, padding: '4px 8px', fontSize: '11px' }}>
                              <Check size={11} />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => applyProfile(p)}
                            onDoubleClick={() => { setEditingProfileId(p.id); setEditingProfileName(p.name); }}
                            title="Clic = applica · Doppio clic = rinomina"
                            style={{
                              display: 'flex', alignItems: 'center', gap: '5px',
                              padding: '5px 10px', borderRadius: '8px', cursor: 'pointer',
                              background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)',
                              color: 'var(--accent-light)', fontSize: '12px',
                            }}>
                            <BookOpen size={11} /> {p.name}
                          </button>
                        )}
                        <button onClick={() => handleDeleteProfile(p.id)} style={{ ...btnDanger, padding: '4px 7px' }} title="Elimina profilo">
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* File info */}
              <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0 }}>
                File: <strong style={{ color: 'var(--text-2)' }}>{fileName}</strong>{' '}
                · {csvRows.length} rig{csvRows.length === 1 ? 'a' : 'he'} · {csvHeaders.length} colonne
              </p>

              {/* Mapping table */}
              <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                {/* Header row */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr',
                  padding: '10px 14px', background: 'var(--bg-input)',
                  borderBottom: '1px solid var(--border)',
                  fontSize: '11px', fontWeight: 600, color: 'var(--muted)',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  <span>Colonna nel tuo file</span>
                  <span>Campo in StylistGo</span>
                </div>

                {csvHeaders.map((h, i) => {
                  const isAutoM = wasAutoMatched(h);
                  const isMapped = mapping[h] && mapping[h] !== '__ignore__';
                  const isRequired = TARGET_FIELDS.find(f => f.key === mapping[h])?.required;
                  const sampleVal = (csvRows[0]?.[i] ?? '').slice(0, 35);

                  return (
                    <div key={i} style={{
                      display: 'grid', gridTemplateColumns: '1fr 1fr',
                      padding: '9px 14px', alignItems: 'center',
                      borderBottom: i < csvHeaders.length - 1 ? '1px solid var(--border)' : 'none',
                      background: isRequired && isMapped ? 'rgba(34,197,94,0.04)'
                        : isAutoM ? 'rgba(99,102,241,0.03)'
                        : 'transparent',
                    }}>
                      <div style={{ paddingRight: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '13px', color: 'var(--text)', fontFamily: 'monospace' }}>{h}</span>
                          {isAutoM && isMapped && (
                            <span style={{
                              fontSize: '10px', padding: '1px 5px', borderRadius: '4px',
                              background: 'rgba(99,102,241,0.15)', color: 'var(--accent-light)',
                              border: '1px solid rgba(99,102,241,0.3)',
                            }}>auto</span>
                          )}
                        </div>
                        {sampleVal && (
                          <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '2px 0 0', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            es. {sampleVal}{csvRows[0]?.[i]?.length > 35 ? '…' : ''}
                          </p>
                        )}
                      </div>
                      <select
                        value={mapping[h] ?? '__ignore__'}
                        onChange={e => setMapping(prev => ({ ...prev, [h]: e.target.value as FieldKey }))}
                        style={{
                          ...inputStyle,
                          fontSize: '12px',
                          borderColor: isMapped ? 'rgba(99,102,241,0.5)' : 'var(--border)',
                        }}>
                        {TARGET_FIELDS.map(f => (
                          <option key={String(f.key)} value={String(f.key)}>
                            {f.label}{f.required ? ' *' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>

              {/* Required field warning */}
              {!requiredMapped && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '10px 12px', borderRadius: '10px',
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                }}>
                  <AlertTriangle size={14} style={{ color: '#f87171', flexShrink: 0 }} />
                  <p style={{ fontSize: '12px', color: '#f87171', margin: 0 }}>
                    Il campo <strong>Nome *</strong> è obbligatorio. Mappa almeno una colonna come "Nome" per procedere.
                  </p>
                </div>
              )}

              {/* Save profile */}
              <div>
                {showSaveProfile ? (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      autoFocus
                      placeholder='Nome profilo (es. "Gestionale Acme 2024")'
                      value={saveProfileName}
                      onChange={e => setSaveProfileName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleSaveProfile();
                        if (e.key === 'Escape') { setShowSaveProfile(false); setSaveProfileName(''); }
                      }}
                      style={inputStyle}
                    />
                    <button onClick={handleSaveProfile} style={{ ...btnPrimary, flexShrink: 0 }}>
                      <Save size={13} /> Salva
                    </button>
                    <button onClick={() => { setShowSaveProfile(false); setSaveProfileName(''); }} style={{ ...btnSecondary, flexShrink: 0 }}>
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setShowSaveProfile(true)} style={{ ...btnSecondary, fontSize: '12px', padding: '6px 12px' }}>
                    <Save size={12} /> Salva mapping come profilo riutilizzabile
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ════ STEP 3: Preview ════ */}
          {step === 'preview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Summary cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                {[
                  { label: 'Record trovati', value: processedRows.length, color: 'var(--text)' },
                  { label: 'Nuovi', value: processedRows.length - dupCount, color: '#22c55e' },
                  { label: 'Duplicati', value: dupCount, color: '#f59e0b' },
                  { label: 'Con avvisi', value: warnCount, color: '#f87171' },
                ].map(card => (
                  <div key={card.label} style={{
                    padding: '14px', borderRadius: '12px', textAlign: 'center',
                    background: 'var(--bg-input)', border: '1px solid var(--border)',
                  }}>
                    <p style={{ fontSize: '24px', fontWeight: 700, color: card.color, margin: 0 }}>{card.value}</p>
                    <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '3px 0 0' }}>{card.label}</p>
                  </div>
                ))}
              </div>

              {/* Duplicate resolution */}
              {dupCount > 0 && (
                <div style={{
                  padding: '14px', borderRadius: '12px',
                  background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.3)',
                }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#f59e0b', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle size={14} />
                    {dupCount} client{dupCount > 1 ? 'i' : 'e'} già present{dupCount > 1 ? 'i' : 'e'}. Come procedere?
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {([
                      { v: 'skip' as DupAction, label: 'Salta i duplicati', desc: 'Importa solo i nuovi clienti, ignora quelli già esistenti' },
                      { v: 'overwrite' as DupAction, label: 'Sovrascrivi i duplicati', desc: 'Aggiorna i dati dei clienti esistenti con i valori del file' },
                      { v: 'import' as DupAction, label: 'Importa comunque tutti', desc: 'Crea nuovi record anche se risultano già presenti' },
                    ]).map(opt => (
                      <label key={opt.v} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                        <input
                          type="radio" name="dupAction" value={opt.v}
                          checked={dupAction === opt.v}
                          onChange={() => setDupAction(opt.v)}
                          style={{ marginTop: '3px', flexShrink: 0 }}
                        />
                        <div>
                          <p style={{ fontSize: '13px', color: 'var(--text)', margin: 0, fontWeight: 500 }}>{opt.label}</p>
                          <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '1px 0 0' }}>{opt.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Warnings / error CSV download */}
              {warnCount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                  <p style={{ fontSize: '12px', color: '#f87171', margin: 0 }}>
                    {warnCount} rig{warnCount > 1 ? 'he' : 'a'} con avvisi (es. email malformata). Verranno importat{warnCount > 1 ? 'e' : 'a'} comunque.
                  </p>
                  <button onClick={downloadLog} style={btnDanger}>
                    <Download size={12} /> Scarica log
                  </button>
                </div>
              )}

              {/* Row preview table (first 10) */}
              {processedRows.length > 0 && (
                <div>
                  <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '0 0 8px' }}>
                    Anteprima prime {Math.min(processedRows.length, 10)} righe:
                  </p>
                  <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                    {processedRows.slice(0, 10).map((row, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '8px 14px', fontSize: '12px',
                        borderBottom: i < Math.min(processedRows.length, 10) - 1 ? '1px solid var(--border)' : 'none',
                        background: row.isDup ? 'rgba(245,158,11,0.04)' : 'transparent',
                      }}>
                        <span style={{ color: 'var(--muted)', fontSize: '11px', width: '28px', flexShrink: 0 }}>
                          #{row.rowIndex}
                        </span>
                        <span style={{ color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.record.firstName} {row.record.lastName}
                          {row.record.phone ? ` · ${row.record.phone}` : ''}
                          {row.record.email ? ` · ${row.record.email}` : ''}
                        </span>
                        {row.isDup && (
                          <span style={{
                            fontSize: '10px', padding: '2px 6px', borderRadius: '4px', flexShrink: 0,
                            background: 'rgba(245,158,11,0.15)', color: '#f59e0b',
                            border: '1px solid rgba(245,158,11,0.3)',
                          }}>dup</span>
                        )}
                        {row.warnings.length > 0 && (
                          <span title={row.warnings.join('; ')} style={{
                            fontSize: '10px', padding: '2px 6px', borderRadius: '4px', flexShrink: 0,
                            background: 'rgba(239,68,68,0.1)', color: '#f87171',
                            border: '1px solid rgba(239,68,68,0.25)',
                          }}>⚠</span>
                        )}
                      </div>
                    ))}
                    {processedRows.length > 10 && (
                      <div style={{
                        padding: '8px 14px', textAlign: 'center',
                        fontSize: '12px', color: 'var(--muted)', background: 'var(--bg-input)',
                      }}>
                        …e altri {processedRows.length - 10} record
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════ STEP 4: Importing ════ */}
          {step === 'importing' && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: '20px', padding: '30px 0', textAlign: 'center',
            }}>
              <div style={{
                width: '76px', height: '76px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(99,102,241,0.15)', border: '2px solid rgba(99,102,241,0.3)',
              }}>
                <Upload size={32} style={{ color: 'var(--accent-light)' }} />
              </div>
              <div>
                <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: '15px', margin: 0 }}>Importazione in corso…</p>
                <p style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '4px' }}>{progress}% completato</p>
              </div>
              <div style={{
                width: '100%', maxWidth: '420px', height: '8px',
                borderRadius: '4px', background: 'var(--bg-input)', overflow: 'hidden',
                border: '1px solid var(--border)',
              }}>
                <div style={{
                  height: '100%', borderRadius: '4px',
                  background: 'linear-gradient(90deg, rgba(99,102,241,0.7), rgba(99,102,241,1))',
                  width: `${progress}%`, transition: 'width 0.3s ease',
                }} />
              </div>
            </div>
          )}

          {/* ════ STEP 5: Done ════ */}
          {step === 'done' && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: '20px', padding: '10px 0', textAlign: 'center',
            }}>
              <div style={{
                width: '72px', height: '72px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(34,197,94,0.15)', border: '2px solid rgba(34,197,94,0.4)',
              }}>
                <Check size={30} style={{ color: '#22c55e' }} />
              </div>
              <h3 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '17px', margin: 0 }}>
                Importazione completata!
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', width: '100%' }}>
                {[
                  { label: 'Importati',          value: resultStats.imported,   color: '#22c55e' },
                  { label: 'Sovrascritti',        value: resultStats.overwritten, color: 'var(--accent-light)' },
                  { label: 'Saltati (duplicati)', value: resultStats.skipped,    color: '#f59e0b' },
                  { label: 'Con avvisi',          value: resultStats.warnings,   color: '#f87171' },
                ].map(s => (
                  <div key={s.label} style={{
                    padding: '14px', borderRadius: '12px', textAlign: 'center',
                    background: 'var(--bg-input)', border: '1px solid var(--border)',
                  }}>
                    <p style={{ fontSize: '26px', fontWeight: 700, color: s.color, margin: 0 }}>{s.value}</p>
                    <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '3px 0 0' }}>{s.label}</p>
                  </div>
                ))}
              </div>
              {errorLog.length > 0 && (
                <button onClick={downloadLog} style={{ ...btnSecondary, gap: '8px' }}>
                  <Download size={14} /> Scarica log dettagliato ({errorLog.length} voci)
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Footer navigation ── */}
        {step !== 'importing' && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '16px 24px', borderTop: '1px solid var(--border)', flexShrink: 0,
          }}>
            {/* Left: Back / empty */}
            {step === 'done' ? (
              <div />
            ) : (
              <button
                onClick={() => {
                  if (step === 'mapping') setStep('upload');
                  else if (step === 'preview') setStep('mapping');
                }}
                style={{
                  ...btnSecondary,
                  visibility: step === 'upload' ? 'hidden' : 'visible',
                }}>
                <ChevronLeft size={15} /> Indietro
              </button>
            )}

            {/* Right: Next / Import / Close */}
            {step === 'done' ? (
              <button onClick={onClose} style={btnPrimary}>
                <Check size={14} /> Chiudi
              </button>
            ) : step === 'preview' ? (
              <button
                onClick={executeImport}
                disabled={processedRows.length === 0 || importableCount === 0}
                style={{ ...btnPrimary, opacity: (processedRows.length === 0 || importableCount === 0) ? 0.5 : 1 }}>
                <Upload size={14} /> Importa {importableCount} client{importableCount === 1 ? 'e' : 'i'}
              </button>
            ) : step === 'mapping' ? (
              <button
                onClick={goToPreview}
                disabled={!requiredMapped}
                style={{ ...btnPrimary, opacity: !requiredMapped ? 0.5 : 1 }}
                title={!requiredMapped ? 'Mappa il campo Nome per procedere' : undefined}>
                Anteprima <ChevronRight size={15} />
              </button>
            ) : (
              <div /> /* upload step has no right button — user picks the file */
            )}
          </div>
        )}
      </div>
    </div>
  );
}
