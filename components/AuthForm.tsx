'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, signUp } from '@/lib/supabase';
import { Scissors } from 'lucide-react';

type Mode = 'login' | 'register';

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg-input)',
  border: '1px solid var(--border)',
  borderRadius: '10px',
  padding: '11px 14px',
  color: 'var(--text)',
  fontSize: '14px',
  outline: 'none',
  transition: 'border-color 0.2s',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 500,
  color: 'var(--muted)',
  marginBottom: '6px',
};

function Spinner() {
  return (
    <svg
      className="animate-spin"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

export default function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  const reset = () => { setError(''); setSuccess(''); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    reset();

    if (password.length < 6) {
      setError('La password deve essere di almeno 6 caratteri.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const { data, error: err } = await signIn(email, password);
        if (err) { setError(err.message); return; }
        if (data?.session) {
          router.push('/');
          router.refresh();
        }
      } else {
        const { data, error: err } = await signUp(email, password, fullName);
        if (err) { setError(err.message); return; }
        if (data?.session) {
          router.push('/');
          router.refresh();
        } else {
          setSuccess('Account creato! Accesso in corso...');
          setTimeout(() => {
            router.push('/');
            router.refresh();
          }, 1000);
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Errore imprevisto. Riprova.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode(m => (m === 'login' ? 'register' : 'login'));
    reset();
  };

  return (
    <div
      className="w-full max-w-md rounded-2xl p-8 shadow-2xl"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      {/* Logo */}
      <div className="flex flex-col items-center mb-8">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)', boxShadow: '0 0 30px rgba(99,102,241,0.4)' }}
        >
          <Scissors size={26} className="text-white" />
        </div>
        <h1 className="text-xl font-bold text-white">Stylistgo</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          {mode === 'login' ? 'Accedi al gestionale' : 'Crea il tuo account'}
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div
          className="mb-4 px-4 py-3 rounded-xl text-sm"
          style={{
            background: 'rgba(239,68,68,0.1)',
            borderLeft: '3px solid #ef4444',
            color: '#fca5a5',
          }}
        >
          {error}
        </div>
      )}

      {/* Success banner */}
      {success && (
        <div
          className="mb-4 px-4 py-3 rounded-xl text-sm"
          style={{
            background: 'rgba(34,197,94,0.1)',
            borderLeft: '3px solid #22c55e',
            color: '#86efac',
          }}
        >
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Full name — only register */}
        {mode === 'register' && (
          <div>
            <label style={labelStyle}>Nome Completo</label>
            <input
              type="text"
              required
              placeholder="es. Mario Rossi"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              style={inputStyle}
              autoComplete="name"
            />
          </div>
        )}

        <div>
          <label style={labelStyle}>Email</label>
          <input
            type="email"
            required
            placeholder="nome@esempio.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={inputStyle}
            autoComplete="email"
          />
        </div>

        <div>
          <label style={labelStyle}>Password {mode === 'register' && <span style={{ color: 'var(--border-light)' }}>(min. 6 caratteri)</span>}</label>
          <input
            type="password"
            required
            minLength={6}
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={inputStyle}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-60 mt-2"
          style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)', border: 'none' }}
        >
          {loading ? (
            <><Spinner />{mode === 'login' ? 'Accesso...' : 'Registrazione...'}</>
          ) : (
            mode === 'login' ? 'Accedi' : 'Crea Account'
          )}
        </button>
      </form>

      {/* Toggle */}
      <div className="mt-6 text-center">
        <button
          onClick={toggleMode}
          className="text-sm transition-colors"
          style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          {mode === 'login' ? (
            <>Non hai un account? <span style={{ color: 'var(--accent-light)' }}>Registrati</span></>
          ) : (
            <>Hai già un account? <span style={{ color: 'var(--accent-light)' }}>Accedi</span></>
          )}
        </button>
      </div>

      {/* Discrete admin link — visible only on login mode */}
      {mode === 'login' && (
        <div className="mt-8 text-center">
          <a
            href="/admin"
            style={{ fontSize: '10px', color: '#1e1e2a', textDecoration: 'none', letterSpacing: '0.05em' }}
          >
            ···
          </a>
        </div>
      )}
    </div>
  );
}
