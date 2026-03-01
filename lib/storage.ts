import { Transaction, CashIn, CashOut, AppSettings } from '@/types';

const TRANSACTIONS_KEY = 'stylistgo_transactions';
const SETTINGS_KEY = 'stylistgo_settings';

export const defaultSettings: AppSettings = {
  taxRate: 25,
  darkMode: true,
};

export function getTransactions(): Transaction[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(TRANSACTIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveTransactions(transactions: Transaction[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
}

export function addTransaction(transaction: Transaction): Transaction[] {
  const all = getTransactions();
  const updated = [...all, transaction];
  saveTransactions(updated);
  return updated;
}

export function updateTransaction(updated: Transaction): Transaction[] {
  const all = getTransactions();
  const result = all.map((t) => (t.id === updated.id ? updated : t));
  saveTransactions(result);
  return result;
}

export function deleteTransaction(id: string): Transaction[] {
  const all = getTransactions();
  const result = all.filter((t) => t.id !== id);
  saveTransactions(result);
  return result;
}

export function getSettings(): AppSettings {
  if (typeof window === 'undefined') return defaultSettings;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...defaultSettings, ...JSON.parse(raw) } : defaultSettings;
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(settings: AppSettings): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function importTransactions(incoming: Transaction[]): Transaction[] {
  const existing = getTransactions();
  const existingIds = new Set(existing.map((t) => t.id));
  const newOnes = incoming.filter((t) => !existingIds.has(t.id));
  const merged = [...existing, ...newOnes];
  saveTransactions(merged);
  return merged;
}
