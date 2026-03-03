export type EntryCategory =
  | 'Hairstyle Donna'
  | 'Hairstyle Uomo'
  | 'Estetica'
  | 'Nail Care'
  | 'Vendita Prodotti'
  | 'Servizio Sposa';

export type EntrySource =
  | 'Diretta'
  | 'Prenotato'
  | 'Fresha'
  | 'App Ufficiale';

export type EntryMethod =
  | 'Contanti'
  | 'POS'
  | 'Gift Card'
  | 'Acconto';

export type ExpenseType =
  | 'Costi Fissi'
  | 'Acquisto Prodotti'
  | 'Marketing'
  | 'Formazione'
  | 'Personale';

export type ExpenseStatus =
  | 'Pagato'
  | 'Da Pagare'
  | 'Rateizzato';

export interface CashIn {
  id: string;
  type: 'income';
  date: string; // ISO date string
  amount: number;
  category: EntryCategory;
  source: EntrySource;
  method: EntryMethod;
  notes: string;
  createdAt: string;
}

export interface CashOut {
  id: string;
  type: 'expense';
  date: string; // ISO date string
  amount: number;
  supplier: string;
  expenseType: ExpenseType;
  dueDate: string; // scadenza
  status: ExpenseStatus;
  notes: string;
  createdAt: string;
}

export type Transaction = CashIn | CashOut;

export interface AppSettings {
  taxRate: number; // default 25%
  darkMode: boolean;
}

export interface MonthlyStats {
  month: string; // YYYY-MM
  totalIncome: number;
  totalExpense: number;
  operationalMargin: number;
  expenseIncidence: number;
  taxFund: number;
  netProfit: number;
}

export const ENTRY_CATEGORIES: EntryCategory[] = [
  'Hairstyle Donna',
  'Hairstyle Uomo',
  'Estetica',
  'Nail Care',
  'Vendita Prodotti',
  'Servizio Sposa',
];

export const ENTRY_SOURCES: EntrySource[] = [
  'Diretta',
  'Prenotato',
  'Fresha',
  'App Ufficiale',
];

export const ENTRY_METHODS: EntryMethod[] = [
  'Contanti',
  'POS',
  'Gift Card',
  'Acconto',
];

export const EXPENSE_TYPES: ExpenseType[] = [
  'Costi Fissi',
  'Acquisto Prodotti',
  'Marketing',
  'Formazione',
  'Personale',
];

export const EXPENSE_STATUSES: ExpenseStatus[] = [
  'Pagato',
  'Da Pagare',
  'Rateizzato',
];

export const CATEGORY_ICONS: Record<EntryCategory, string> = {
  'Hairstyle Donna': '✂️',
  'Hairstyle Uomo': '💈',
  'Estetica': '🌸',
  'Nail Care': '💅',
  'Vendita Prodotti': '🛍️',
  'Servizio Sposa': '👰',
};

export const EXPENSE_TYPE_ICONS: Record<ExpenseType, string> = {
  'Costi Fissi': '🏠',
  'Acquisto Prodotti': '📦',
  'Marketing': '📣',
  'Formazione': '📚',
  'Personale': '👥',
};
