'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const AuthForm = dynamic(() => import('@/components/AuthForm'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-sm" style={{ color: '#71717a' }}>
      Caricamento...
    </div>
  ),
});

export default function LoginPage() {
  // Rileva recovery URL PRIMA che AuthForm si monti — evita la race condition
  // con il dynamic import che carica AuthForm più lentamente dell'evento SDK
  const [initialMode, setInitialMode] = useState<'login' | 'reset'>('login');

  useEffect(() => {
    const search = window.location.search;
    const hash = window.location.hash;
    if (search.includes('type=recovery') || hash.includes('type=recovery')) {
      setInitialMode('reset');
      // Pulisci il query param per non riattivare la modalità se l'utente ricarica
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center px-4"
      style={{ background: '#0f0f13' }}
    >
      <AuthForm initialMode={initialMode} />
    </div>
  );
}
