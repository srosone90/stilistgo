'use client';

import React, { useRef, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Transaction, CashIn, CashOut } from '@/types';
import Papa from 'papaparse';
import { Upload, Download, AlertTriangle, CheckCircle2, RefreshCw, Wifi, WifiOff, FileDown } from 'lucide-react';
import { generateId } from '@/lib/storage';
import { resetSupabaseAvailability } from '@/lib/db';
import { exportTransactionsPDF } from '@/lib/pdf';

const inputStyle: React.CSSProperties = {
  background: '#12121a', border: '1px solid #2e2e40', borderRadius: '10px',
  padding: '10px 14px', color: '#f4f4f5', fontSize: '14px', outline: 'none', width: '100%',
};

export default function SettingsView() {
  const { settings, updateSettings, transactions, importEntries, dataSource } = useApp();
  const [taxInput, setTaxInput] = useState(String(settings.taxRate));
  const [importStatus, setImportStatus] = useState<{ ok?: number; skip?: number; error?: string } | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleReconnect = async () => {
    setReconnecting(true);
    resetSupabaseAvailability();
    // Trigger a re-check by re-loading the page
    setTimeout(() => window.location.reload(), 300);
  };

  const saveTax = async () => {
    const v = parseFloat(taxInput);
    if (!isNaN(v) && v >= 0 && v <= 100) {
      await updateSettings({ taxRate: v });
    }
  };

  const handleExport = () => {
    const json = JSON.stringify(transactions, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stylistgo-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
      header: true,
      skipEmptyLines: true,
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
              id: row['id'] || generateId(),
              type: 'income',
              date,
              amount,
              category: (row['category'] || row['categoria'] || 'Hairstyle Donna') as CashIn['category'],
              source: (row['source'] || row['sorgente'] || 'Diretta') as CashIn['source'],
              method: (row['method'] || row['metodo'] || 'Contanti') as CashIn['method'],
              notes: row['notes'] || row['note'] || '',
              createdAt: row['createdAt'] || new Date().toISOString(),
            });
          } else if (type === 'expense' || type === 'uscita') {
            imported.push({
              id: row['id'] || generateId(),
              type: 'expense',
              date,
              amount,
              supplier: row['supplier'] || row['fornitore'] || 'N/D',
              expenseType: (row['expenseType'] || row['tipologia'] || 'Costi Fissi') as CashOut['expenseType'],
              dueDate: row['dueDate'] || row['scadenza'] || '',
              status: (row['status'] || row['stato'] || 'Da Pagare') as CashOut['status'],
              notes: row['notes'] || row['note'] || '',
              createdAt: row['createdAt'] || new Date().toISOString(),
            });
          } else {
            skip++;
          }
        });

        importEntries(imported).then(() => {
          setImportStatus({ ok: imported.length, skip });
        }).catch((err: any) => setImportStatus({ error: err.message }));
      },
      error: (err) => setImportStatus({ error: err.message }),
    });

    e.target.value = '';
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Impostazioni</h1>
        <p className="text-sm mt-1" style={{ color: '#71717a' }}>Configurazione fiscale e gestione dati</p>
      </div>

      {/* Tax rate */}
      <div className="rounded-2xl p-5" style={{ background: '#1c1c27', border: '1px solid #2e2e40' }}>
        <h3 className="font-semibold text-white mb-1">🏦 Aliquota Fondo Tasse</h3>
        <p className="text-xs mb-4" style={{ color: '#71717a' }}>
          Percentuale detratta virtualmente da ogni entrata per stimare l&apos;utile reale post-tasse.
        </p>
        <div className="flex gap-3 items-center">
          <input
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={taxInput}
            onChange={e => setTaxInput(e.target.value)}
            style={{ ...inputStyle, width: '120px' }}
          />
          <span style={{ color: '#71717a' }}>%</span>
          <button onClick={saveTax}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: 'rgba(99,102,241,0.8)' }}>
            Salva
          </button>
        </div>
        <p className="text-xs mt-2" style={{ color: '#71717a' }}>
          Aliquota attuale: <strong style={{ color: '#818cf8' }}>{settings.taxRate}%</strong>
        </p>
      </div>

      {/* Export */}
      <div className="rounded-2xl p-5" style={{ background: '#1c1c27', border: '1px solid #2e2e40' }}>
        <h3 className="font-semibold text-white mb-1">📤 Esporta Dati</h3>
        <p className="text-xs mb-4" style={{ color: '#71717a' }}>
          Esporta tutti i movimenti in formato JSON per backup o migrazione, oppure in PDF per la stampa.
        </p>
        <button onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
          style={{ background: '#12121a', border: '1px solid #2e2e40', color: '#d4d4d8' }}>
          <Download size={16} />
          Esporta JSON ({transactions.length} voci)
        </button>
        <button
          onClick={() => exportTransactionsPDF(transactions)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
          <FileDown size={16} />
          Esporta PDF completo ({transactions.length} voci)
        </button>
      </div>

      {/* Import */}
      <div className="rounded-2xl p-5" style={{ background: '#1c1c27', border: '1px solid #2e2e40' }}>
        <h3 className="font-semibold text-white mb-1">📥 Importa da CSV / JSON</h3>
        <p className="text-xs mb-2" style={{ color: '#71717a' }}>
          Carica dati da un file CSV (con colonne: type, date, amount, category/supplier, ...) o un JSON esportato precedentemente.
        </p>
        <div className="text-xs mb-4 space-y-1" style={{ color: '#71717a' }}>
          <p><strong style={{ color: '#d4d4d8' }}>Colonne CSV entrata:</strong> type (income), date (YYYY-MM-DD), amount, category, source, method, notes</p>
          <p><strong style={{ color: '#d4d4d8' }}>Colonne CSV uscita:</strong> type (expense), date, amount, supplier, expenseType, dueDate, status, notes</p>
        </div>

        <input ref={fileRef} type="file" accept=".csv,.json" onChange={handleImportCSV} style={{ display: 'none' }} />
        <button onClick={() => fileRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
          style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8' }}>
          <Upload size={16} />
          Seleziona file CSV o JSON
        </button>

        {importStatus && (
          <div className="mt-4 rounded-xl px-4 py-3 flex items-center gap-2 text-sm"
            style={importStatus.error
              ? { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }
              : { background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e' }}>
            {importStatus.error ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
            {importStatus.error
              ? `Errore: ${importStatus.error}`
              : `Importate ${importStatus.ok} voci con successo${importStatus.skip ? ` (${importStatus.skip} righe saltate)` : ''}.`}
          </div>
        )}
      </div>

      {/* Data info */}
      <div className="rounded-2xl p-5" style={{ background: '#1c1c27', border: '1px solid #2e2e40' }}>
        <h3 className="font-semibold text-white mb-3">ℹ️ Stato Dati</h3>

        {/* Connection status */}
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
              style={{ background: 'rgba(99,102,241,0.2)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.4)' }}>
              <RefreshCw size={12} className={reconnecting ? 'animate-spin' : ''} />
              Riconnetti
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold" style={{ color: '#818cf8' }}>{transactions.length}</p>
            <p className="text-xs" style={{ color: '#71717a' }}>Movimenti totali</p>
          </div>
          <div>
            <p className="text-2xl font-bold" style={{ color: '#22c55e' }}>{transactions.filter(t => t.type === 'income').length}</p>
            <p className="text-xs" style={{ color: '#71717a' }}>Entrate</p>
          </div>
          <div>
            <p className="text-2xl font-bold" style={{ color: '#ef4444' }}>{transactions.filter(t => t.type === 'expense').length}</p>
            <p className="text-xs" style={{ color: '#71717a' }}>Uscite</p>
          </div>
        </div>
      </div>
    </div>
  );
}
