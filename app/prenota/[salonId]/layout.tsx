import type { Metadata } from 'next';

// Metadata is mostly overridden by the dynamic manifest,
// but we still provide fallback values for web crawlers.
export const metadata: Metadata = {
  title: 'Prenota',
  description: 'Prenota il tuo appuntamento',
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
  },
};

export default function PrenotaLayout({ children, params }: {
  children: React.ReactNode;
  params: Promise<{ salonId: string }>;
}) {
  return children;
}
