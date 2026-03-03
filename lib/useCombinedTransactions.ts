import { useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { useSalon } from '@/context/SalonContext';
import { Transaction, CashIn, EntryCategory, EntryMethod } from '@/types';
import { Payment, Service } from '@/types/salon';

const SALON_PAY_PREFIX = 'salon-pay-';

/** Maps a salon Payment to an AppContext CashIn transaction */
function paymentToCashIn(p: Payment, services: Service[]): CashIn {
  // Derive category: if any item is a product → 'Vendita Prodotti'
  // Otherwise look up the actual service category from the salon services list
  const hasProduct = p.items.some(i => i.isProduct);
  let category: EntryCategory = 'Hairstyle Donna';
  if (hasProduct) {
    category = 'Vendita Prodotti';
  } else {
    // Find the first service item with a known serviceId
    const firstServiceItem = p.items.find(i => !i.isProduct && i.serviceId);
    if (firstServiceItem?.serviceId) {
      const svc = services.find(s => s.id === firstServiceItem.serviceId);
      if (svc?.category) {
        // Map the free-form service category to a valid EntryCategory
        const cat = svc.category.toLowerCase();
        if (cat.includes('uomo') || cat.includes('barber') || cat.includes('barba')) {
          category = 'Hairstyle Uomo';
        } else if (cat.includes('nail') || cat.includes('ungh')) {
          category = 'Nail Care';
        } else if (cat.includes('estet') || cat.includes('skin') || cat.includes('facial')) {
          category = 'Estetica';
        } else if (cat.includes('sposa') || cat.includes('bridal')) {
          category = 'Servizio Sposa';
        } else {
          category = 'Hairstyle Donna'; // default
        }
      }
    }
  }

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
    source: 'Prenotato',
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
  const { payments, services } = useSalon();

  return useMemo(() => {
    // manual entries that are NOT already from salon (safety check)
    const manual = transactions.filter(t => !t.id.startsWith(SALON_PAY_PREFIX));
    // convert all salon payments, passing services for proper category mapping
    const salonTx: Transaction[] = payments.map(p => paymentToCashIn(p, services));
    return [...manual, ...salonTx];
  }, [transactions, payments, services]);
}
