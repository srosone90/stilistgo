import { Transaction, CashIn, CashOut, EntryCategory, ExpenseType, MonthlyStats } from '@/types';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

export function isCashIn(t: Transaction): t is CashIn {
  return t.type === 'income';
}

export function isCashOut(t: Transaction): t is CashOut {
  return t.type === 'expense';
}

export function filterByMonth(transactions: Transaction[], yearMonth: string): Transaction[] {
  const start = startOfMonth(parseISO(`${yearMonth}-01`));
  const end = endOfMonth(parseISO(`${yearMonth}-01`));
  return transactions.filter((t) => {
    const d = parseISO(t.date);
    return isWithinInterval(d, { start, end });
  });
}

export function filterByYear(transactions: Transaction[], year: string): Transaction[] {
  return transactions.filter((t) => t.date.startsWith(year));
}

export function getTotalIncome(transactions: Transaction[]): number {
  return transactions.filter(isCashIn).reduce((sum, t) => sum + t.amount, 0);
}

export function getTotalExpense(transactions: Transaction[]): number {
  return transactions.filter(isCashOut).reduce((sum, t) => sum + t.amount, 0);
}

export function getOperationalMargin(income: number, expense: number): number {
  return income - expense;
}

export function getExpenseIncidence(income: number, expense: number): number {
  if (income === 0) return 0;
  return (expense / income) * 100;
}

export function getTaxFund(income: number, taxRate: number): number {
  return (income * taxRate) / 100;
}

export function getNetProfit(income: number, expense: number, taxFund: number): number {
  return income - expense - taxFund;
}

export function getIncomeByCategory(transactions: Transaction[]): Record<EntryCategory, number> {
  const result = {} as Record<EntryCategory, number>;
  transactions.filter(isCashIn).forEach((t) => {
    result[t.category] = (result[t.category] || 0) + t.amount;
  });
  return result;
}

export function getExpenseByType(transactions: Transaction[]): Record<ExpenseType, number> {
  const result = {} as Record<ExpenseType, number>;
  transactions.filter(isCashOut).forEach((t) => {
    result[t.expenseType] = (result[t.expenseType] || 0) + t.amount;
  });
  return result;
}

export function getIncomeBySource(transactions: Transaction[]): Record<string, number> {
  const result: Record<string, number> = {};
  transactions.filter(isCashIn).forEach((t) => {
    result[t.source] = (result[t.source] || 0) + t.amount;
  });
  return result;
}

export function getIncomeByMethod(transactions: Transaction[]): Record<string, number> {
  const result: Record<string, number> = {};
  transactions.filter(isCashIn).forEach((t) => {
    result[t.method] = (result[t.method] || 0) + t.amount;
  });
  return result;
}

export function getMonthlyStats(transactions: Transaction[], taxRate: number): MonthlyStats[] {
  const monthSet = new Set<string>();
  transactions.forEach((t) => {
    monthSet.add(t.date.slice(0, 7));
  });

  return Array.from(monthSet)
    .sort()
    .map((month) => {
      const filtered = filterByMonth(transactions, month);
      const income = getTotalIncome(filtered);
      const expense = getTotalExpense(filtered);
      const margin = getOperationalMargin(income, expense);
      const incidence = getExpenseIncidence(income, expense);
      const taxFund = getTaxFund(income, taxRate);
      const net = getNetProfit(income, expense, taxFund);
      return { month, totalIncome: income, totalExpense: expense, operationalMargin: margin, expenseIncidence: incidence, taxFund, netProfit: net };
    });
}

export function getLast6MonthsData(transactions: Transaction[], taxRate: number) {
  const months: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(format(d, 'yyyy-MM'));
  }

  return months.map((month) => {
    const filtered = filterByMonth(transactions, month);
    const income = getTotalIncome(filtered);
    const expense = getTotalExpense(filtered);
    const taxFund = getTaxFund(income, taxRate);
    const net = getNetProfit(income, expense, taxFund);
    return {
      month: format(parseISO(`${month}-01`), 'MMM yy'),
      Entrate: income,
      Uscite: expense,
      'Utile Netto': net,
    };
  });
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount);
}
