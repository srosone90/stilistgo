import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { Transaction, AppSettings } from '@/types';
import {
  isCashIn,
  getTotalIncome,
  getTotalExpense,
  getOperationalMargin,
  getExpenseIncidence,
  getTaxFund,
  getNetProfit,
  getIncomeByCategory,
  getExpenseByType,
  formatCurrency,
  getLast6MonthsData,
} from '@/lib/calculations';

// ─── Shared helpers ──────────────────────────────────────────────────────────

const BRAND = 'Stylistgo';
const ACCENT = [99, 102, 241] as const; // indigo-500
const DARK_BG = [18, 18, 26] as const;

function addHeader(doc: jsPDF, title: string, subtitle?: string) {
  const pageW = doc.internal.pageSize.getWidth();

  // header bar
  doc.setFillColor(...DARK_BG);
  doc.rect(0, 0, pageW, 32, 'F');

  // brand name
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(BRAND, 14, 14);

  // title
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 200, 220);
  doc.text(title, 14, 22);

  // date generated
  const dateStr = format(new Date(), "dd/MM/yyyy HH:mm", { locale: it });
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 150);
  doc.text(`Generato il ${dateStr}`, pageW - 14, 22, { align: 'right' });

  if (subtitle) {
    doc.setFontSize(9);
    doc.setTextColor(130, 130, 160);
    doc.text(subtitle, 14, 29);
  }

  return 38; // y offset after header
}

function addFooter(doc: jsPDF) {
  const pageCount = (doc as any).internal.getNumberOfPages();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 130);
    doc.text(`${BRAND} — pagina ${i} di ${pageCount}`, pageW / 2, pageH - 6, { align: 'center' });
  }
}

function addSectionTitle(doc: jsPDF, text: string, y: number): number {
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...ACCENT);
  doc.text(text, 14, y);
  return y + 6;
}

// ─── 1. TRANSACTIONS PDF (TabularView) ───────────────────────────────────────

export function exportTransactionsPDF(
  transactions: Transaction[],
  filters?: { type?: string; month?: string; year?: string },
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  // subtitle based on active filters
  const subtitleParts: string[] = [];
  if (filters?.type && filters.type !== 'all') subtitleParts.push(filters.type === 'income' ? 'Solo Entrate' : 'Solo Uscite');
  if (filters?.year) subtitleParts.push(filters.year);
  if (filters?.month) subtitleParts.push(`mese ${filters.month}`);
  const subtitle = subtitleParts.length ? subtitleParts.join(' · ') : 'Tutti i movimenti';

  let y = addHeader(doc, 'Tabella Movimenti', subtitle);

  const income = getTotalIncome(transactions);
  const expense = getTotalExpense(transactions);
  const balance = income - expense;

  // Summary row
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 180, 200);
  doc.text(
    `Entrate: ${formatCurrency(income)}   Uscite: ${formatCurrency(expense)}   Saldo: ${formatCurrency(balance)}   (${transactions.length} voci)`,
    14, y,
  );
  y += 8;

  const rows = transactions.map(t => {
    if (isCashIn(t)) {
      return [
        format(parseISO(t.date), 'dd/MM/yyyy'),
        'Entrata',
        t.category,
        t.source,
        t.method,
        t.notes || '—',
        formatCurrency(t.amount),
      ];
    } else {
      return [
        format(parseISO(t.date), 'dd/MM/yyyy'),
        'Uscita',
        t.expenseType,
        t.supplier,
        t.status,
        t.notes || '—',
        formatCurrency(t.amount),
      ];
    }
  });

  autoTable(doc, {
    startY: y,
    head: [['Data', 'Tipo', 'Categoria / Tipo Spesa', 'Fonte / Fornitore', 'Metodo / Stato', 'Note', 'Importo']],
    body: rows,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2.5, textColor: [220, 220, 240], fillColor: [24, 24, 36] },
    headStyles: { fillColor: [...ACCENT], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [28, 28, 40] },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 18 },
      6: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
    },
    didParseCell(data) {
      if (data.column.index === 1 && data.section === 'body') {
        const val = data.cell.raw as string;
        if (val === 'Entrata') data.cell.styles.textColor = [34, 197, 94];
        if (val === 'Uscita') data.cell.styles.textColor = [239, 68, 68];
      }
      if (data.column.index === 6 && data.section === 'body') {
        const row = data.row.raw as string[];
        data.cell.styles.textColor = row[1] === 'Entrata' ? [34, 197, 94] : [239, 68, 68];
      }
    },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc);

  const filename = `stylistgo-movimenti-${format(new Date(), 'yyyyMMdd-HHmm')}.pdf`;
  doc.save(filename);
}

// ─── 2. DASHBOARD PDF ────────────────────────────────────────────────────────

export function exportDashboardPDF(
  transactions: Transaction[],
  settings: AppSettings,
  monthLabel: string,
  monthTx: Transaction[],
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  let y = addHeader(doc, `Report Dashboard — ${monthLabel}`, 'Riepilogo economico mensile');

  const income = getTotalIncome(monthTx);
  const expense = getTotalExpense(monthTx);
  const margin = getOperationalMargin(income, expense);
  const incidence = getExpenseIncidence(income, expense);
  const taxFund = getTaxFund(income, settings.taxRate);
  const net = getNetProfit(income, expense, taxFund);

  // KPI table
  y = addSectionTitle(doc, 'KPI del mese', y);
  autoTable(doc, {
    startY: y,
    head: [['Indicatore', 'Valore']],
    body: [
      ['Totale Entrate', formatCurrency(income)],
      ['Totale Uscite', formatCurrency(expense)],
      ['Margine Operativo', formatCurrency(margin)],
      [`Incidenza Spese`, `${incidence.toFixed(1)}%`],
      [`Fondo Tasse (${settings.taxRate}%)`, formatCurrency(taxFund)],
      ['Utile Netto Stimato', formatCurrency(net)],
    ],
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3, textColor: [220, 220, 240], fillColor: [24, 24, 36] },
    headStyles: { fillColor: [...ACCENT], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [28, 28, 40] },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 12;

  // Category breakdown
  const byCategory = getIncomeByCategory(monthTx);
  const catRows = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, val]) => [cat, formatCurrency(val), income > 0 ? `${((val / income) * 100).toFixed(1)}%` : '—']);

  if (catRows.length > 0) {
    y = addSectionTitle(doc, 'Entrate per Categoria', y);
    autoTable(doc, {
      startY: y,
      head: [['Categoria', 'Importo', '% sul totale']],
      body: catRows,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3, textColor: [220, 220, 240], fillColor: [24, 24, 36] },
      headStyles: { fillColor: [...ACCENT], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [28, 28, 40] },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 12;
  }

  // Last 6 months trend
  const trend = getLast6MonthsData(transactions, settings.taxRate);
  y = addSectionTitle(doc, 'Andamento ultimi 6 mesi', y);
  autoTable(doc, {
    startY: y,
    head: [['Mese', 'Entrate', 'Uscite', 'Utile Netto']],
    body: trend.map(row => [row.month, formatCurrency(row['Entrate']), formatCurrency(row['Uscite']), formatCurrency(row['Utile Netto'])]),
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3, textColor: [220, 220, 240], fillColor: [24, 24, 36] },
    headStyles: { fillColor: [...ACCENT], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [28, 28, 40] },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right', fontStyle: 'bold' } },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc);

  const filename = `stylistgo-dashboard-${format(new Date(), 'yyyyMMdd-HHmm')}.pdf`;
  doc.save(filename);
}

// ─── 3. ANALYSIS PDF (AnalysisView) ──────────────────────────────────────────

export function exportAnalysisPDF(
  filtered: Transaction[],
  periodLabel: string,
  settings: AppSettings,
  allTransactions: Transaction[],
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  let y = addHeader(doc, `Report Analitico — ${periodLabel}`, 'Analisi entrate, uscite e categorie');

  const income = getTotalIncome(filtered);
  const expense = getTotalExpense(filtered);

  // Summary
  y = addSectionTitle(doc, 'Riepilogo periodo', y);
  autoTable(doc, {
    startY: y,
    head: [['Voce', 'Importo']],
    body: [
      ['Totale Entrate', formatCurrency(income)],
      ['Totale Uscite', formatCurrency(expense)],
      ['Saldo', formatCurrency(income - expense)],
    ],
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3, textColor: [220, 220, 240], fillColor: [24, 24, 36] },
    headStyles: { fillColor: [...ACCENT], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [28, 28, 40] },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // Entrate per categoria
  const byCategory = getIncomeByCategory(filtered);
  const catRows = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, val]) => [cat, formatCurrency(val), income > 0 ? `${((val / income) * 100).toFixed(1)}%` : '—']);

  if (catRows.length > 0) {
    y = addSectionTitle(doc, 'Entrate per Categoria', y);
    autoTable(doc, {
      startY: y,
      head: [['Categoria', 'Importo', '% sul totale entrate']],
      body: catRows,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3, textColor: [220, 220, 240], fillColor: [24, 24, 36] },
      headStyles: { fillColor: [...ACCENT], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [28, 28, 40] },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Uscite per tipo
  const byExpenseType = getExpenseByType(filtered);
  const expRows = Object.entries(byExpenseType)
    .sort((a, b) => b[1] - a[1])
    .map(([type, val]) => [type, formatCurrency(val), expense > 0 ? `${((val / expense) * 100).toFixed(1)}%` : '—']);

  if (expRows.length > 0) {
    y = addSectionTitle(doc, 'Uscite per Tipo', y);
    autoTable(doc, {
      startY: y,
      head: [['Tipo Spesa', 'Importo', '% sul totale uscite']],
      body: expRows,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3, textColor: [220, 220, 240], fillColor: [24, 24, 36] },
      headStyles: { fillColor: [...ACCENT], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [28, 28, 40] },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // 6 months trend
  const trend = getLast6MonthsData(allTransactions, settings.taxRate);
  y = addSectionTitle(doc, 'Andamento ultimi 6 mesi', y);
  autoTable(doc, {
    startY: y,
    head: [['Mese', 'Entrate', 'Uscite', 'Utile Netto']],
    body: trend.map(row => [row.month, formatCurrency(row['Entrate']), formatCurrency(row['Uscite']), formatCurrency(row['Utile Netto'])]),
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3, textColor: [220, 220, 240], fillColor: [24, 24, 36] },
    headStyles: { fillColor: [...ACCENT], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [28, 28, 40] },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right', fontStyle: 'bold' } },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc);

  const filename = `stylistgo-analisi-${format(new Date(), 'yyyyMMdd-HHmm')}.pdf`;
  doc.save(filename);
}

// ─── 4. FULL BACKUP PDF (SettingsView) ───────────────────────────────────────

export function exportFullBackupPDF(transactions: Transaction[], settings: AppSettings) {
  exportTransactionsPDF(transactions, { type: 'all' });
}
