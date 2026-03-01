'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Transaction, AppSettings } from '@/types';
import {
  dbGetTransactions, dbAddTransaction, dbUpdateTransaction,
  dbDeleteTransaction, dbImportTransactions, dbGetSettings, dbSaveSettings,
} from '@/lib/db';
import { generateId } from '@/lib/storage';

interface AppContextValue {
  transactions: Transaction[];
  settings: AppSettings;
  loading: boolean;
  dataSource: 'supabase' | 'local' | null;
  addEntry: (t: Omit<Transaction, 'id' | 'createdAt'>) => Promise<void>;
  updateEntry: (t: Transaction) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  importEntries: (entries: Transaction[]) => Promise<void>;
  updateSettings: (s: Partial<AppSettings>) => Promise<void>;
}

const defaultSettings: AppSettings = { taxRate: 25, darkMode: true };
const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState<'supabase' | 'local' | null>(null);

  // Initial load — Supabase first, LocalStorage fallback
  useEffect(() => {
    Promise.all([dbGetTransactions(), dbGetSettings()])
      .then(([txResult, cfgResult]) => {
        setTransactions(txResult.data);
        setSettings(cfgResult.data);
        setDataSource(txResult.source);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const addEntry = useCallback(async (t: Omit<Transaction, 'id' | 'createdAt'>) => {
    const full = { ...t, id: generateId(), createdAt: new Date().toISOString() } as Transaction;
    // Optimistic update
    setTransactions(prev => [full, ...prev]);
    try {
      await dbAddTransaction(full);
    } catch (e) {
      // Rollback on error
      setTransactions(prev => prev.filter(x => x.id !== full.id));
      throw e;
    }
  }, []);

  const updateEntry = useCallback(async (t: Transaction) => {
    const previous = transactions.find(x => x.id === t.id);
    setTransactions(prev => prev.map(x => x.id === t.id ? t : x));
    try {
      await dbUpdateTransaction(t);
    } catch (e) {
      if (previous) setTransactions(prev => prev.map(x => x.id === t.id ? previous : x));
      throw e;
    }
  }, [transactions]);

  const deleteEntry = useCallback(async (id: string) => {
    const previous = transactions.find(x => x.id === id);
    setTransactions(prev => prev.filter(x => x.id !== id));
    try {
      await dbDeleteTransaction(id);
    } catch (e) {
      if (previous) setTransactions(prev => [...prev, previous]);
      throw e;
    }
  }, [transactions]);

  const importEntries = useCallback(async (entries: Transaction[]) => {
    await dbImportTransactions(entries);
    const { data } = await dbGetTransactions();
    setTransactions(data);
  }, []);

  const updateSettings = useCallback(async (partial: Partial<AppSettings>) => {
    const updated = { ...settings, ...partial };
    setSettings(updated);
    await dbSaveSettings(updated);
  }, [settings]);

  return (
    <AppContext.Provider value={{ transactions, settings, loading, dataSource, addEntry, updateEntry, deleteEntry, importEntries, updateSettings }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

