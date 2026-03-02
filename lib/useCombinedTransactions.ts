import { useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { useSalon } from '@/context/SalonContext';
import { Transaction, CashIn, EntryCategory, EntryMethod } from '@/types';
import { Payment } from '@/types/salon';

const SALON_PAY_PREFIX = 'salon-pay-';

/** Maps a salon Payment to an AppContext CashIn transaction */
function paymentToCashIn(p: Payment): CashIn {
  // Derive category: if any item is a product → 'Vendita Prodotti', else map by service items
  const hasProduct = p.items.some(i => i.isProduct);
  const category: EntryCategory = hasProduct ? 'Vendita Prodotti' : 'Hairstyle Donna';

  const methodMap: Record<string, EntryMethod> = {
    cash: 'Contanti',
    card: 'POS',
    gift_card: 'Gift Card',
    mixed: 'Contanti',
  };

  return {
    id: `${SALON_PAY_PREFIX}${p.id}`,
    type: 'income',
    date: p.date,
    amount: p.total,
    category,
    source: 'Diretta',
    method: methodMap[p.paymentMethod] ?? 'Contanti',
    notes: `Cassa salon${p.clientName ? ' — ' + p.clientName : ''}${p.notes ? ' — ' + p.notes : ''}`,
    createdAt: p.createdAt,
  };
}

/**
 * Returns merged transactions: manual AppContext entries + auto-imported salon payments.
 * Salon payments are prefixed with `salon-pay-` so they are never counted twice.
 */
export function useCombinedTransactions(): Transaction[] {
  const { transactions } = useApp();
  const { payments } = useSalon();

  return useMemo(() => {
    // manual entries that are NOT already from salon (safety check)
    const manual = transactions.filter(t => !t.id.startsWith(SALON_PAY_PREFIX));
    // convert all salon payments
    const salonTx: Transaction[] = payments.map(paymentToCashIn);
    return [...manual, ...salonTx];
  }, [transactions, payments]);
}
