import { supabase } from './supabase';
import { Transaction, CashIn, CashOut, AppSettings } from '@/types';
import * as local from './storage';

// ─── Connection health ────────────────────────────────────────────────────────

let supabaseAvailable: boolean | null = null; // null = not yet tested

async function isSupabaseAvailable(): Promise<boolean> {
  if (supabaseAvailable !== null) return supabaseAvailable;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    // /auth/v1/health risponde sempre 200 senza auth — nessun 401
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`,
      {
        headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);
    supabaseAvailable = res.ok;
  } catch {
    supabaseAvailable = false;
  }
  return supabaseAvailable;
}

export function resetSupabaseAvailability() {
  supabaseAvailable = null;
}

// ─── Row ↔ Model mappers ──────────────────────────────────────────────────────

function rowToTransaction(row: Record<string, unknown>): Transaction {
  if (row.type === 'income') {
    return {
      id: row.id as string,
      type: 'income',
      date: row.date as string,
      amount: Number(row.amount),
      category: row.category as CashIn['category'],
      source: row.source as CashIn['source'],
      method: row.method as CashIn['method'],
      notes: (row.notes as string) ?? '',
      createdAt: row.created_at as string,
    } satisfies CashIn;
  }
  return {
    id: row.id as string,
    type: 'expense',
    date: row.date as string,
    amount: Number(row.amount),
    supplier: (row.supplier as string) ?? '',
    expenseType: row.expense_type as CashOut['expenseType'],
    dueDate: (row.due_date as string) ?? '',
    status: row.status as CashOut['status'],
    notes: (row.notes as string) ?? '',
    createdAt: row.created_at as string,
  } satisfies CashOut;
}

function transactionToRow(t: Transaction): Record<string, unknown> {
  const base = {
    id: t.id,
    type: t.type,
    date: t.date,
    amount: t.amount,
    notes: t.notes,
    created_at: t.createdAt,
  };
  if (t.type === 'income') {
    return { ...base, category: t.category, source: t.source, method: t.method };
  }
  return {
    ...base,
    supplier: t.supplier,
    expense_type: t.expenseType,
    due_date: t.dueDate || null,
    status: t.status,
  };
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export async function dbGetTransactions(): Promise<{ data: Transaction[]; source: 'supabase' | 'local' }> {
  if (await isSupabaseAvailable()) {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false });
    if (!error && data) {
      const txs = data.map(rowToTransaction);
      // Sync to LocalStorage as offline cache
      local.saveTransactions(txs);
      return { data: txs, source: 'supabase' };
    }
  }
  // Fallback to LocalStorage
  return { data: local.getTransactions(), source: 'local' };
}

export async function dbAddTransaction(t: Transaction): Promise<void> {
  local.addTransaction(t); // Always save locally first
  if (await isSupabaseAvailable()) {
    const { error } = await supabase.from('transactions').insert(transactionToRow(t));
    if (error) throw error;
  }
}

export async function dbUpdateTransaction(t: Transaction): Promise<void> {
  local.updateTransaction(t);
  if (await isSupabaseAvailable()) {
    const { error } = await supabase
      .from('transactions')
      .update(transactionToRow(t))
      .eq('id', t.id);
    if (error) throw error;
  }
}

export async function dbDeleteTransaction(id: string): Promise<void> {
  local.deleteTransaction(id);
  if (await isSupabaseAvailable()) {
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) throw error;
  }
}

export async function dbImportTransactions(incoming: Transaction[]): Promise<void> {
  local.importTransactions(incoming);
  if (await isSupabaseAvailable()) {
    const rows = incoming.map(transactionToRow);
    const { error } = await supabase
      .from('transactions')
      .upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
    if (error) throw error;
  }
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function dbGetSettings(): Promise<{ data: AppSettings; source: 'supabase' | 'local' }> {
  if (await isSupabaseAvailable()) {
    const { data, error } = await supabase
      .from('app_settings')
      .select('*')
      .eq('id', 1)
      .single();
    if (!error && data) {
      const cfg = { taxRate: Number(data.tax_rate), darkMode: data.dark_mode ?? true };
      local.saveSettings(cfg);
      return { data: cfg, source: 'supabase' };
    }
  }
  return { data: local.getSettings(), source: 'local' };
}

export async function dbSaveSettings(s: AppSettings): Promise<void> {
  local.saveSettings(s);
  if (await isSupabaseAvailable()) {
    const { error } = await supabase
      .from('app_settings')
      .upsert({ id: 1, tax_rate: s.taxRate, dark_mode: s.darkMode });
    if (error) throw error;
  }
}

