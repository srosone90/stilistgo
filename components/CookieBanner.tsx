'use client';

/**
 * CookieBanner — zero dipendenze esterne.
 * Gestisce solo cookie tecnici strettamente necessari al funzionamento del SaaS.
 * Non usa analytics, advertising o tracking cookie.
 */

import React, { useState, useEffect } from 'react';

const COOKIE_KEY = 'stylistgo_cookie_consent';
const CONSENT_VERSION = '1';

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(COOKIE_KEY);
      if (!stored) { setVisible(true); return; }
      const parsed = JSON.parse(stored);
      // Mostra di nuovo se la versione del consenso è cambiata
      if (parsed.version !== CONSENT_VERSION) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  const accept = () => {
    try {
      localStorage.setItem(COOKIE_KEY, JSON.stringify({
        version: CONSENT_VERSION,
        acceptedAt: new Date().toISOString(),
        technical: true,
      }));
    } catch { /* private browsing */ }
    setVisible(false);
  };

  if (!visible) return null;

  const banner: React.CSSProperties = {
    position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9998,
    background: 'rgba(19,19,30,0.97)',
    backdropFilter: 'blur(8px)',
    borderTop: '1px solid rgba(46,46,64,0.8)',
    padding: '14px 20px',
  };
  const inner: React.CSSProperties = {
    maxWidth: '900px', margin: '0 auto',
    display: 'flex', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap',
  };
  const btnPrimary: React.CSSProperties = {
    padding: '8px 20px', borderRadius: '8px', border: 'none',
    background: 'linear-gradient(135deg,#6366f1,#818cf8)',
    color: 'white', fontWeight: 600, fontSize: '13px', cursor: 'pointer',
    whiteSpace: 'nowrap', flexShrink: 0,
  };
  const btnLink: React.CSSProperties = {
    background: 'none', border: 'none', color: '#818cf8',
    fontSize: '11px', cursor: 'pointer', padding: '4px 0', textDecoration: 'underline',
  };

  return (
    <div style={banner} role="dialog" aria-label="Cookie Banner">
      <div style={inner}>
        <div style={{ flex: 1, minWidth: '260px' }}>
          <p style={{ color: '#f4f4f5', fontSize: '13px', margin: '0 0 4px', fontWeight: 600 }}>
            🍪 Cookie Tecnici
          </p>
          <p style={{ color: '#a1a1aa', fontSize: '12px', margin: 0, lineHeight: '1.5' }}>
            Stylistgo utilizza <strong>solo cookie tecnici strettamente necessari</strong> al
            funzionamento del servizio: autenticazione sessione, preferenze tema, stato
            offline. Nessun cookie di profilazione o marketing.{' '}
            <button style={btnLink} onClick={() => setExpanded(e => !e)}>
              {expanded ? 'Meno dettagli ▲' : 'Dettagli ▼'}
            </button>
          </p>

          {expanded && (
            <div style={{ marginTop: '8px', background: '#12121a', borderRadius: '8px', padding: '10px', fontSize: '11px', color: '#71717a' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Nome', 'Scopo', 'Durata', 'Tipo'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '3px 8px', color: '#a1a1aa', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['sb-access-token', 'Autenticazione Supabase', 'Sessione', 'Tecnico'],
                    ['sb-refresh-token', 'Rinnovo sessione Supabase', '1 anno', 'Tecnico'],
                    ['stylistgo-theme', 'Preferenza tema (dark/light)', 'Persistente', 'Preferenza'],
                    ['stylistgo_gdpr_accepted', 'Consenso GDPR registrato', 'Persistente', 'Tecnico'],
                    ['stylistgo_cookie_consent', 'Consenso cookie banner', 'Persistente', 'Tecnico'],
                  ].map(([name, scope, dur, type]) => (
                    <tr key={name} style={{ borderTop: '1px solid #1e1e2a' }}>
                      <td style={{ padding: '3px 8px', fontFamily: 'monospace', color: '#f4f4f5' }}>{name}</td>
                      <td style={{ padding: '3px 8px' }}>{scope}</td>
                      <td style={{ padding: '3px 8px' }}>{dur}</td>
                      <td style={{ padding: '3px 8px', color: '#4ade80' }}>{type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ margin: '8px 0 0' }}>
                Tutti i cookie sono di tipo &ldquo;first-party&rdquo; (dominio Stylistgo).
                Nessun cookie di terze parti, analytics o pubblicità.{' '}
                <a href="/legal/privacy" style={{ color: '#818cf8' }}>Privacy Policy completa →</a>
              </p>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
          <button style={btnPrimary} onClick={accept}>
            Accetta cookie tecnici
          </button>
          <p style={{ color: '#3f3f5a', fontSize: '10px', margin: 0, textAlign: 'right' }}>
            Non puoi rifiutare i cookie tecnici in quanto<br/>necessari al funzionamento del servizio.
          </p>
        </div>
      </div>
    </div>
  );
}
