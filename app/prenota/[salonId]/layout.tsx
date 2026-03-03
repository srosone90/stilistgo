import type { Metadata } from 'next';
import type { ReactNode } from 'react';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://stylistgo.netlify.app';

export const metadata: Metadata = {
  title: 'Prenota',
  description: 'Prenota il tuo appuntamento',
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'apple-touch-icon': `${APP_URL}/icons/icon-192.png`,
  },
};

export default function PrenotaLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
