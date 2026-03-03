'use client';

import { usePathname } from 'next/navigation';

/**
 * Shows a fullscreen "rotate device" overlay when the user opens the
 * management app in portrait mode on a small screen.
 * The overlay is NOT shown on the client-facing booking page (/prenota/...).
 */
export default function LandscapeGuard() {
  const pathname = usePathname();

  // Don't restrict orientation on the public booking PWA
  if (pathname?.startsWith('/prenota') || pathname?.startsWith('/booking') || pathname?.startsWith('/api')) {
    return null;
  }

  return (
    <div
      className="landscape-guard-overlay"
      aria-hidden="true"
      style={{
        display: 'none', // overridden by CSS media query below
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: '#0d0d14',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        textAlign: 'center',
        padding: '2rem',
        gap: '1rem',
      }}
    >
      {/* Rotation icon */}
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="rgba(168,85,247,0.9)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
        <line x1="12" y1="18" x2="12.01" y2="18" />
        {/* Arrow curving from portrait to landscape */}
        <path d="M7 11 Q12 6 17 11" markerEnd="url(#arr)" />
      </svg>
      <p style={{ fontSize: '1.15rem', fontWeight: 700, color: 'rgba(168,85,247,1)' }}>
        Ruota il dispositivo
      </p>
      <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', maxWidth: 260, lineHeight: 1.5 }}>
        L&rsquo;app di gestione funziona meglio in modalità orizzontale.<br />
        Ruota lo smartphone per continuare.
      </p>
    </div>
  );
}
