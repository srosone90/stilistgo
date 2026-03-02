'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Loader2 } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const inp: React.CSSProperties = { width: '100%', background: '#12121a', border: '1px solid #2e2e40', borderRadius: '10px', padding: '11px 14px', color: '#f4f4f5', fontSize: '14px', outline: 'none', boxSizing: 'border-box' };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Errore di autenticazione.'); return; }
      sessionStorage.setItem('stylistgo_admin_token', data.token);
      router.push('/admin');
      router.refresh();
    } catch {
      setError('Server non raggiungibile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#0f0f13,#13131e)', padding: '16px' }}>
      <div style={{ width: '100%', maxWidth: '400px', background: '#1c1c27', border: '1px solid #2e2e40', borderRadius: '20px', padding: '40px' }}>

        {/* Icon */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '32px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px', boxShadow: '0 0 30px rgba(245,158,11,0.35)' }}>
            <ShieldCheck size={26} color="white" />
          </div>
          <h1 style={{ color: '#f4f4f5', fontSize: '18px', fontWeight: 700, margin: 0 }}>Admin — Stylistgo</h1>
          <p style={{ color: '#71717a', fontSize: '13px', marginTop: '4px' }}>Accesso riservato al gestore</p>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '10px 14px', color: '#f87171', fontSize: '13px', marginBottom: '20px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#71717a', marginBottom: '6px', fontWeight: 500 }}>Email admin</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} style={inp} placeholder="admin@stylistgo.it" autoComplete="off" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#71717a', marginBottom: '6px', fontWeight: 500 }}>Password</label>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)} style={inp} placeholder="••••••••" />
          </div>
          <button type="submit" disabled={loading} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '12px', border: 'none', background: loading ? '#2e2e40' : 'linear-gradient(135deg,#f59e0b,#ef4444)', color: 'white', fontWeight: 600, fontSize: '14px', cursor: loading ? 'not-allowed' : 'pointer', marginTop: '4px' }}>
            {loading ? <><Loader2 size={16} className="animate-spin" /> Accesso...</> : 'Accedi al pannello admin'}
          </button>
        </form>

        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <a href="/login" style={{ fontSize: '12px', color: '#3f3f5a', textDecoration: 'none' }}>← Torna al gestionale</a>
        </div>
      </div>
    </div>
  );
}
