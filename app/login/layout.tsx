import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Login — Accedi al tuo Account',
  description: 'Accedi al gestionale contabile di Stylistgo. Tieni sotto controllo entrate, uscite e margini del tuo salone.',
  robots: { index: false, follow: true },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
