'use client';

import React, { useRef, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { useSalon } from '@/context/SalonContext';
import { Transaction, CashIn, CashOut } from '@/types';
import { GiftCard, SalonConfig, DayOfWeek } from '@/types/salon';
import Papa from 'papaparse';
import { Upload, Download, AlertTriangle, CheckCircle2, RefreshCw, Wifi, WifiOff, FileDown, Plus, Trash2, Check } from 'lucide-react';
import { generateId } from '@/lib/storage';
import { resetSupabaseAvailability } from '@/lib/db';
import { exportTransactionsPDF } from '@/lib/pdf';

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '10px',
  padding: '10px 14px', color: 'var(--text)', fontSize: '14px', outline: 'none', width: '100%',
};

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px',
};

const DAYS: { label: string; value: DayOfWeek }[] = [
  { label: 'Lun', value: 1 }, { label: 'Mar', value: 2 }, { label: 'Mer', value: 3 },
  { label: 'Gio', value: 4 }, { label: 'Ven', value: 5 }, { label: 'Sab', value: 6 }, { label: 'Dom', value: 0 },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={cardStyle}>
      <h3 className="font-semibold text-white mb-4">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>{label}</label>
      {children}
    </div>
  );
}

function SaveBtn({ onClick, saved }: { onClick: () => void; saved?: boolean }) {
  return (
    <button onClick={onClick}
      className="mt-3 px-4 py-2 rounded-xl text-sm font-semibold text-white"
      style={{
        background: saved ? 'rgba(34,197,94,0.75)' : 'rgba(99,102,241,0.8)',
        display: 'inline-flex', alignItems: 'center', gap: 6,
        transition: 'background 0.25s',
      }}>
      {saved ? <><Check size={14} /> Salvato!</> : 'Salva modifiche'}
    </button>
  );
}

export default function SettingsView() {
  const { settings, updateSettings, transactions, importEntries, dataSource } = useApp();
  const {
    salonConfig, updateSalonConfig,
    giftCards, addGiftCard, updateGiftCard,
    operators, clients, services, appointments, payments, products,
  } = useSalon();

  // ── Tax rate ───────────────────────────────────────────────
  const [taxInput, setTaxInput] = useState(String(settings.taxRate));

  // ── Salon info ─────────────────────────────────────────────
  const [info, setInfo] = useState({
    salonName: salonConfig.salonName,
    address: salonConfig.address || '',
    phone: salonConfig.phone || '',
    email: salonConfig.email || '',
    vatNumber: salonConfig.vatNumber || '',
    invoiceNote: salonConfig.invoiceNote || '',
    currency: salonConfig.currency || '€',
  });

  // ── Schedule ───────────────────────────────────────────────
  const [schedule, setSchedule] = useState({
    openTime: salonConfig.openTime,
    closeTime: salonConfig.closeTime,
    slotMinutes: salonConfig.slotMinutes,
    workDays: [...salonConfig.workDays],
  });

  // ── Loyalty ────────────────────────────────────────────────
  const [loyalty, setLoyalty] = useState({
    loyaltyPointsPerEuro: salonConfig.loyaltyPointsPerEuro,
    dormientiDays: salonConfig.dormientiDays,
  });

  // ── Gift card form ─────────────────────────────────────────
  const emptyGC = { clientId: '', clientName: '', initialValue: 50, expiryDate: '', isActive: true };
  const [gcForm, setGcForm] = useState(emptyGC);
  const [gcOpen, setGcOpen] = useState(false);

  // ── Import / export ────────────────────────────────────────
  const [importStatus, setImportStatus] = useState<{ ok?: number; skip?: number; error?: string } | null>(null);
  const [backupStatus, setBackupStatus] = useState<{ ok?: boolean; error?: string } | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [savedSection, setSavedSection] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const backupRef = useRef<HTMLInputElement>(null);

  const flash = (sec: string) => {
    setSavedSection(sec);
    setTimeout(() => setSavedSection(s => (s === sec ? null : s)), 2500);
  };

  // ── Handlers ───────────────────────────────────────────────
  const handleReconnect = async () => {
    setReconnecting(true);
    resetSupabaseAvailability();
    setTimeout(() => window.location.reload(), 300);
  };

  const saveTax = async () => {
    const v = parseFloat(taxInput);
    if (!isNaN(v) && v >= 0 && v <= 100) { await updateSettings({ taxRate: v }); flash('tax'); }
  };

  const saveInfo = () => { updateSalonConfig(info); flash('info'); };

  const saveSchedule = () => { updateSalonConfig(schedule); flash('schedule'); };

  const saveLoyalty = () => { updateSalonConfig(loyalty); flash('loyalty'); };

  const toggleDay = (d: DayOfWeek) => {
    setSchedule(prev => ({
      ...prev,
      workDays: prev.workDays.includes(d) ? prev.workDays.filter(x => x !== d) : [...prev.workDays, d],
    }));
  };

  const handleAddGC = () => {
    if (!gcForm.initialValue || gcForm.initialValue <= 0) return;
    addGiftCard({
      clientId: gcForm.clientId,
      clientName: gcForm.clientName || 'Cliente generico',
      initialValue: gcForm.initialValue,
      remainingValue: gcForm.initialValue,
      expiryDate: gcForm.expiryDate,
      isActive: true,
    });
    setGcForm(emptyGC);
    setGcOpen(false);
  };

  const handleToggleGC = (gc: GiftCard) => {
    updateGiftCard({ ...gc, isActive: !gc.isActive });
  };

  const handleExportTransactions = () => {
    const json = JSON.stringify(transactions, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stylistgo-contabilita-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = () => exportTransactionsPDF(transactions);

  const handleExportFullBackup = () => {
    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      salonConfig,
      operators,
      clients,
      services,
      appointments,
      payments,
      products,
      giftCards,
      transactions,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stylistgo-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBackupStatus(null);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (!data.version || !data.salonConfig) throw new Error('File non valido o non è un backup Stylistgo');
        if (data.salonConfig) updateSalonConfig(data.salonConfig);
        if (Array.isArray(data.transactions)) await importEntries(data.transactions);
        setBackupStatus({ ok: true });
      } catch (err: any) {
        setBackupStatus({ error: err.message || 'Errore durante il ripristino' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportStatus(null);

    if (file.name.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string) as Transaction[];
          if (!Array.isArray(data)) throw new Error('Formato non valido');
          await importEntries(data);
          setImportStatus({ ok: data.length });
        } catch (err: any) {
          setImportStatus({ error: err.message || 'Errore nel file JSON' });
        }
      };
      reader.readAsText(file);
      return;
    }

    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as Record<string, string>[];
        const imported: Transaction[] = [];
        let skip = 0;
        rows.forEach((row) => {
          const type = (row['type'] || row['tipo'] || '').toLowerCase();
          const amount = parseFloat(row['amount'] || row['importo'] || '0');
          const date = row['date'] || row['data'] || '';
          if (!date || isNaN(amount) || amount <= 0) { skip++; return; }
          if (type === 'income' || type === 'entrata') {
            imported.push({
              id: row['id'] || generateId(), type: 'income', date, amount,
              category: (row['category'] || row['categoria'] || 'Hairstyle Donna') as CashIn['category'],
              source: (row['source'] || row['sorgente'] || 'Diretta') as CashIn['source'],
              method: (row['method'] || row['metodo'] || 'Contanti') as CashIn['method'],
              notes: row['notes'] || row['note'] || '',
              createdAt: row['createdAt'] || new Date().toISOString(),
            });
          } else if (type === 'expense' || type === 'uscita') {
            imported.push({
              id: row['id'] || generateId(), type: 'expense', date, amount,
              supplier: row['supplier'] || row['fornitore'] || 'N/D',
              expenseType: (row['expenseType'] || row['tipologia'] || 'Costi Fissi') as CashOut['expenseType'],
              dueDate: row['dueDate'] || row['scadenza'] || '',
              status: (row['status'] || row['stato'] || 'Da Pagare') as CashOut['status'],
              notes: row['notes'] || row['note'] || '',
              createdAt: row['createdAt'] || new Date().toISOString(),
            });
          } else { skip++; }
        });
        importEntries(imported).then(() => setImportStatus({ ok: imported.length, skip }))
          .catch((err: any) => setImportStatus({ error: err.message }));
      },
      error: (err) => setImportStatus({ error: err.message }),
    });
    e.target.value = '';
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Impostazioni</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>Configurazione completa del salone</p>
      </div>

      {/* ─── 1. Info Salone ─────────────────────────────────── */}
      <Section title="🏢 Info Salone">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome salone">
            <input value={info.salonName} onChange={e => setInfo(p => ({ ...p, salonName: e.target.value }))} style={inputStyle} />
          </Field>
          <Field label="Valuta">
            <input value={info.currency} onChange={e => setInfo(p => ({ ...p, currency: e.target.value }))} style={inputStyle} maxLength={3} />
          </Field>
          <Field label="Telefono">
            <input value={info.phone} onChange={e => setInfo(p => ({ ...p, phone: e.target.value }))} style={inputStyle} />
          </Field>
          <Field label="Email">
            <input type="email" value={info.email} onChange={e => setInfo(p => ({ ...p, email: e.target.value }))} style={inputStyle} />
          </Field>
          <div className="col-span-2">
            <Field label="Indirizzo">
              <input value={info.address} onChange={e => setInfo(p => ({ ...p, address: e.target.value }))} style={inputStyle} />
            </Field>
          </div>
          <Field label="P.IVA / Codice Fiscale">
            <input value={info.vatNumber} onChange={e => setInfo(p => ({ ...p, vatNumber: e.target.value }))} style={inputStyle} />
          </Field>
          <div className="col-span-2">
            <Field label="Nota standard su stampe / ricevute">
              <textarea value={info.invoiceNote} onChange={e => setInfo(p => ({ ...p, invoiceNote: e.target.value }))} rows={2}
                style={{ ...inputStyle, resize: 'none' }} />
            </Field>
          </div>
        </div>
        <SaveBtn onClick={saveInfo} saved={savedSection === 'info'} />
      </Section>

      {/* ─── 2. Agenda & Orari ──────────────────────────────── */}
      <Section title="🗓️ Agenda & Orari">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Apertura">
            <input type="time" value={schedule.openTime} onChange={e => setSchedule(p => ({ ...p, openTime: e.target.value }))} style={inputStyle} />
          </Field>
          <Field label="Chiusura">
            <input type="time" value={schedule.closeTime} onChange={e => setSchedule(p => ({ ...p, closeTime: e.target.value }))} style={inputStyle} />
          </Field>
        </div>
        <Field label="Durata slot agenda">
          <div className="flex gap-2">
            {[15, 30, 60].map(m => (
              <button key={m} onClick={() => setSchedule(p => ({ ...p, slotMinutes: m }))}
                className="px-4 py-2 rounded-xl text-sm font-medium"
                style={schedule.slotMinutes === m
                  ? { background: 'rgba(99,102,241,0.8)', color: '#fff' }
                  : { background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
                {m} min
              </button>
            ))}
          </div>
        </Field>
        <Field label="Giorni lavorativi">
          <div className="flex gap-2 flex-wrap">
            {DAYS.map(({ label, value }) => (
              <button key={value} onClick={() => toggleDay(value)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium"
                style={schedule.workDays.includes(value)
                  ? { background: 'rgba(99,102,241,0.7)', color: '#fff' }
                  : { background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
                {label}
              </button>
            ))}
          </div>
        </Field>
        <SaveBtn onClick={saveSchedule} saved={savedSection === 'schedule'} />
      </Section>

      {/* ─── 3. Programma Fedeltà ───────────────────────────── */}
      <Section title="⭐ Programma Fedeltà">
        <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
          I clienti accumulano punti fedeltà su ogni acquisto. I clienti &quot;dormienti&quot; vengono evidenziati automaticamente.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Punti per ogni €1 speso">
            <input type="number" min={0} step={0.1} value={loyalty.loyaltyPointsPerEuro}
              onChange={e => setLoyalty(p => ({ ...p, loyaltyPointsPerEuro: parseFloat(e.target.value) || 0 }))} style={inputStyle} />
          </Field>
          <Field label="Giorni inattività → dormiente">
            <input type="number" min={1} value={loyalty.dormientiDays}
              onChange={e => setLoyalty(p => ({ ...p, dormientiDays: parseInt(e.target.value) || 60 }))} style={inputStyle} />
          </Field>
        </div>
        <SaveBtn onClick={saveLoyalty} saved={savedSection === 'loyalty'} />
      </Section>

      {/* ─── 4. Gift Card ───────────────────────────────────── */}
      <Section title="🎟️ Gift Card">
        <div className="space-y-2 mb-4">
          {giftCards.length === 0 && (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Nessuna gift card creata.</p>
          )}
          {giftCards.map(gc => (
            <div key={gc.id} className="flex items-center justify-between rounded-xl px-4 py-3"
              style={{ background: 'var(--bg-input)', border: `1px solid ${gc.isActive ? 'rgba(99,102,241,0.3)' : 'var(--border)'}` }}>
              <div>
                <p className="text-sm font-mono font-semibold" style={{ color: gc.isActive ? 'var(--accent-light)' : 'var(--muted)' }}>{gc.code}</p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  {gc.clientName} · Rimanente: <strong style={{ color: 'var(--text)' }}>€{gc.remainingValue.toFixed(2)}</strong>
                  {gc.expiryDate ? ` · Scad: ${gc.expiryDate}` : ''}
                </p>
              </div>
              <button onClick={() => handleToggleGC(gc)}
                className="text-xs px-3 py-1.5 rounded-lg"
                style={gc.isActive
                  ? { background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }
                  : { background: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)' }}>
                {gc.isActive ? 'Disattiva' : 'Riattiva'}
              </button>
            </div>
          ))}
        </div>

        {gcOpen ? (
          <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
            <p className="text-sm font-semibold text-white">Nuova Gift Card</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Valore (€)">
                <input type="number" min={1} value={gcForm.initialValue}
                  onChange={e => setGcForm(p => ({ ...p, initialValue: parseFloat(e.target.value) || 0 }))} style={inputStyle} />
              </Field>
              <Field label="Scadenza (opz.)">
                <input type="date" value={gcForm.expiryDate}
                  onChange={e => setGcForm(p => ({ ...p, expiryDate: e.target.value }))} style={inputStyle} />
              </Field>
              <div className="col-span-2">
                <Field label="Nome cliente (opz.)">
                  <input value={gcForm.clientName}
                    onChange={e => setGcForm(p => ({ ...p, clientName: e.target.value }))} style={inputStyle} />
                </Field>
              </div>
              <div className="col-span-2">
                <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Oppure scegli dal registro</label>
                <select value={gcForm.clientId}
                  onChange={e => {
                    const c = clients.find(x => x.id === e.target.value);
                    setGcForm(p => ({ ...p, clientId: e.target.value, clientName: c ? `${c.firstName} ${c.lastName}` : p.clientName }));
                  }} style={{ ...inputStyle }}>
                  <option value="">— Seleziona cliente —</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleAddGC}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                style={{ background: 'rgba(99,102,241,0.8)' }}>
                <Plus size={14} /> Crea Gift Card
              </button>
              <button onClick={() => setGcOpen(false)}
                className="px-4 py-2 rounded-xl text-sm"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
                Annulla
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setGcOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
            style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: 'var(--accent-light)' }}>
            <Plus size={15} /> Crea nuova Gift Card
          </button>
        )}
      </Section>

      {/* ─── 5. Fondo Tasse ─────────────────────────────────── */}
      <Section title="🏦 Fondo Tasse">
        <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
          Percentuale detratta virtualmente da ogni entrata per stimare l&apos;utile reale post-tasse.
        </p>
        <div className="flex gap-3 items-center">
          <input type="number" min="0" max="100" step="0.5" value={taxInput}
            onChange={e => setTaxInput(e.target.value)}
            style={{ ...inputStyle, width: '120px' }} />
          <span style={{ color: 'var(--muted)' }}>%</span>
          <button onClick={saveTax}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{
              background: savedSection === 'tax' ? 'rgba(34,197,94,0.75)' : 'rgba(99,102,241,0.8)',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              transition: 'background 0.25s',
            }}>
            {savedSection === 'tax' ? <><Check size={14} /> Salvato!</> : 'Salva'}
          </button>
        </div>
        <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
          Aliquota attuale: <strong style={{ color: 'var(--accent-light)' }}>{settings.taxRate}%</strong>
        </p>
      </Section>

      {/* ─── 6. Backup Completo ─────────────────────────────── */}
      <Section title="💾 Backup Completo">
        <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
          Esporta tutti i dati del salone (clienti, operatori, appuntamenti, pagamenti, prodotti, gift card, contabilità, config) in un unico file JSON.
        </p>
        <div className="flex flex-col gap-2">
          <button onClick={handleExportFullBackup}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
            style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80' }}>
            <Download size={16} /> Esporta backup completo
          </button>
          <div>
            <input ref={backupRef} type="file" accept=".json" onChange={handleImportBackup} style={{ display: 'none' }} />
            <button onClick={() => backupRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
              style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#fbbf24' }}>
              <Upload size={16} /> Ripristina da backup
            </button>
          </div>
        </div>
        {backupStatus && (
          <div className="mt-3 rounded-xl px-4 py-3 flex items-center gap-2 text-sm"
            style={backupStatus.error
              ? { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }
              : { background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e' }}>
            {backupStatus.error ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
            {backupStatus.error ? `Errore: ${backupStatus.error}` : 'Backup ripristinato con successo.'}
          </div>
        )}
      </Section>

      {/* ─── 7. Dati Contabilità ────────────────────────────── */}
      <Section title="📊 Dati Contabilità">
        <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
          Esporta i movimenti contabili (solo entrate/uscite manuali + cassa salone) oppure importa da CSV/JSON.
        </p>
        <div className="flex flex-col gap-2 mb-4">
          <button onClick={handleExportTransactions}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
            <Download size={16} /> Esporta JSON ({transactions.length} voci)
          </button>
          <button onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
            <FileDown size={16} /> Esporta PDF completo ({transactions.length} voci)
          </button>
        </div>

        <div>
          <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>
            <strong style={{ color: 'var(--text-2)' }}>CSV entrata:</strong> type, date, amount, category, source, method, notes<br />
            <strong style={{ color: 'var(--text-2)' }}>CSV uscita:</strong> type (expense), date, amount, supplier, expenseType, dueDate, status, notes
          </p>
          <input ref={fileRef} type="file" accept=".csv,.json" onChange={handleImportCSV} style={{ display: 'none' }} />
          <button onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
            style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: 'var(--accent-light)' }}>
            <Upload size={16} /> Importa CSV o JSON (contabilità)
          </button>
          {importStatus && (
            <div className="mt-3 rounded-xl px-4 py-3 flex items-center gap-2 text-sm"
              style={importStatus.error
                ? { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }
                : { background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e' }}>
              {importStatus.error ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
              {importStatus.error
                ? `Errore: ${importStatus.error}`
                : `Importate ${importStatus.ok} voci${importStatus.skip ? ` (${importStatus.skip} saltate)` : ''}.`}
            </div>
          )}
        </div>
      </Section>

      {/* ─── 8. Connessione ─────────────────────────────────── */}
      <Section title="🌐 Connessione Dati">
        <div className="flex items-center justify-between mb-4 p-3 rounded-xl"
          style={dataSource === 'supabase'
            ? { background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' }
            : { background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
          <div className="flex items-center gap-2 text-sm">
            {dataSource === 'supabase'
              ? <><Wifi size={15} style={{ color: '#22c55e' }} /><span style={{ color: '#22c55e' }}>Supabase — cloud, tutti i dispositivi</span></>
              : <><WifiOff size={15} style={{ color: '#f59e0b' }} /><span style={{ color: '#f59e0b' }}>LocalStorage — solo questo browser</span></>}
          </div>
          {dataSource === 'local' && (
            <button onClick={handleReconnect} disabled={reconnecting}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium"
              style={{ background: 'rgba(99,102,241,0.2)', color: 'var(--accent-light)', border: '1px solid rgba(99,102,241,0.4)' }}>
              <RefreshCw size={12} className={reconnecting ? 'animate-spin' : ''} />
              Riconnetti
            </button>
          )}
        </div>

        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold" style={{ color: 'var(--accent-light)' }}>{transactions.length}</p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>Movimenti</p>
          </div>
          <div>
            <p className="text-2xl font-bold" style={{ color: '#22c55e' }}>{clients.length}</p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>Clienti</p>
          </div>
          <div>
            <p className="text-2xl font-bold" style={{ color: '#f59e0b' }}>{appointments.length}</p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>Appuntamenti</p>
          </div>
          <div>
            <p className="text-2xl font-bold" style={{ color: '#ec4899' }}>{operators.length}</p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>Operatori</p>
          </div>
        </div>
      </Section>
    </div>
  );
}
