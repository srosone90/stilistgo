'use client';

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
  return (
    <div
      className="min-h-screen w-full flex items-center justify-center px-4"
      style={{ background: '#0f0f13' }}
    >
      <AuthForm />
    </div>
  );
}
