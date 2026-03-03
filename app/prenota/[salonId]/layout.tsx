import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Prenota',
  description: 'Prenota il tuo appuntamento',
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
  },
};

export default function PrenotaLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
