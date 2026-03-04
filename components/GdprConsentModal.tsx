'use client';

/**
 * GdprConsentModal
 * Modale bloccante al primo login che richiede l'accettazione di ToS e DPA.
 * Viene mostrato se admin_tenants.legal_consents è vuoto o non ha le versioni correnti.
 */

import React, { useState, useEffect } from 'react';
import { getCurrentUser } from '@/lib/supabase';

const TOS_VERSION = '1.0';
const DPA_VERSION = '1.0';
const STORAGE_KEY = 'stylistgo_gdpr_accepted';

interface ConsentRecord {
  tosVersion: string;
  dpaVersion: string;
  acceptedAt: string;
}

function isConsentValid(record: ConsentRecord | null): boolean {
  if (!record) return false;
  return record.tosVersion === TOS_VERSION && record.dpaVersion === DPA_VERSION;
}

export default function GdprConsentModal() {
  const [show, setShow] = useState(false);
  const [tosChecked, setTosChecked] = useState(false);
  const [dpaChecked, setDpaChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'tos' | 'dpa'>('tos');

  useEffect(() => {
    // Controlla il consenso già registrato in localStorage (fast path)
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const stored: ConsentRecord = JSON.parse(raw);
        if (isConsentValid(stored)) return;
      }
    } catch { /* corrupt storage */ }

    // Controlla sul server se l'utente è loggato
    getCurrentUser().then(async user => {
      if (!user) return;
      try {
        const res = await fetch('/api/salon-gdpr', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        // Se 401, utente non ha sessione — non mostrare il modal
        if (res.status === 401) return;
        // Controlla admin_tenants per consenso già registrato
        const tenantRes = await fetch('/api/user');
        if (tenantRes.ok) {
          const tenant = await tenantRes.json();
          const consents = tenant?.legal_consents;
          if (
            consents?.tos?.version === TOS_VERSION &&
            consents?.dpa?.version === DPA_VERSION
          ) {
            // Salva in locale per evitare richieste future
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
              tosVersion: TOS_VERSION,
              dpaVersion: DPA_VERSION,
              acceptedAt: consents.tos.accepted_at,
            }));
            return;
          }
        }
      } catch { /* ignora errori di rete */ }
      setShow(true);
    });
  }, []);

  const handleAccept = async () => {
    if (!tosChecked || !dpaChecked) return;
    setSaving(true);
    try {
      const user = await getCurrentUser();
      if (!user) { setSaving(false); return; }
      const authToken = (await import('@/lib/supabase')).getSupabaseClient()
        .auth.getSession().then(s => s.data.session?.access_token ?? '');
      const token = await authToken;

      await fetch('/api/salon-gdpr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ tosVersion: TOS_VERSION, dpaVersion: DPA_VERSION }),
      });

      const record: ConsentRecord = {
        tosVersion: TOS_VERSION,
        dpaVersion: DPA_VERSION,
        acceptedAt: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
      setShow(false);
    } catch { /* ignora — l'utente può riprovare */ }
    setSaving(false);
  };

  if (!show) return null;

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
    zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '16px',
  };
  const modal: React.CSSProperties = {
    background: '#1c1c27', border: '1px solid #2e2e40', borderRadius: '20px',
    padding: '28px', width: '100%', maxWidth: '520px', maxHeight: '90vh',
    display: 'flex', flexDirection: 'column', gap: '18px',
  };
  const tabBtn = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '8px', borderRadius: '8px', border: 'none',
    background: active ? '#2e2e40' : 'transparent',
    color: active ? '#f4f4f5' : '#71717a',
    fontWeight: active ? 600 : 400, fontSize: '13px', cursor: 'pointer',
  });
  const scrollBox: React.CSSProperties = {
    background: '#12121a', border: '1px solid #2e2e40', borderRadius: '12px',
    padding: '14px', maxHeight: '220px', overflowY: 'auto',
    fontSize: '12px', lineHeight: '1.6', color: '#a1a1aa',
  };
  const checkLabel: React.CSSProperties = {
    display: 'flex', alignItems: 'flex-start', gap: '10px',
    cursor: 'pointer', fontSize: '13px', color: '#f4f4f5',
  };
  const acceptBtn: React.CSSProperties = {
    padding: '13px', borderRadius: '12px', border: 'none',
    background: (tosChecked && dpaChecked && !saving)
      ? 'linear-gradient(135deg,#6366f1,#818cf8)'
      : '#2e2e40',
    color: 'white', fontWeight: 700, fontSize: '14px',
    cursor: (tosChecked && dpaChecked && !saving) ? 'pointer' : 'not-allowed',
  };

  return (
    <div style={overlay}>
      <div style={modal}>
        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg,#6366f1,#818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <h2 style={{ color: '#f4f4f5', fontSize: '18px', fontWeight: 700, margin: 0 }}>
            Accettazione Termini di Servizio
          </h2>
          <p style={{ color: '#71717a', fontSize: '12px', margin: '6px 0 0' }}>
            Per continuare a usare Stylistgo devi accettare i nostri termini legali.
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', background: '#12121a', borderRadius: '10px', padding: '4px' }}>
          <button style={tabBtn(activeTab === 'tos')} onClick={() => setActiveTab('tos')}>
            📄 Termini di Servizio
          </button>
          <button style={tabBtn(activeTab === 'dpa')} onClick={() => setActiveTab('dpa')}>
            🔒 DPA — Trattamento Dati
          </button>
        </div>

        {/* Documento scrollabile */}
        <div style={scrollBox}>
          {activeTab === 'tos' ? <TosText /> : <DpaText />}
        </div>

        {/* Checkbox */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <label style={checkLabel}>
            <input
              type="checkbox"
              checked={tosChecked}
              onChange={e => setTosChecked(e.target.checked)}
              style={{ marginTop: '2px', accentColor: '#818cf8', width: '15px', height: '15px', flexShrink: 0 }}
            />
            <span>
              Ho letto e accetto i{' '}
              <a href="/legal/tos" target="_blank" rel="noreferrer" style={{ color: '#818cf8' }}>
                Termini e Condizioni
              </a>{' '}
              (versione {TOS_VERSION})
            </span>
          </label>
          <label style={checkLabel}>
            <input
              type="checkbox"
              checked={dpaChecked}
              onChange={e => setDpaChecked(e.target.checked)}
              style={{ marginTop: '2px', accentColor: '#818cf8', width: '15px', height: '15px', flexShrink: 0 }}
            />
            <span>
              Ho letto e accetto il{' '}
              <a href="/legal/dpa" target="_blank" rel="noreferrer" style={{ color: '#818cf8' }}>
                Data Processing Agreement
              </a>{' '}
              e la{' '}
              <a href="/legal/privacy" target="_blank" rel="noreferrer" style={{ color: '#818cf8' }}>
                Privacy Policy
              </a>{' '}
              (versione {DPA_VERSION})
            </span>
          </label>
        </div>

        {/* Accept button */}
        <button style={acceptBtn} onClick={handleAccept} disabled={!tosChecked || !dpaChecked || saving}>
          {saving ? 'Registrazione…' : 'Accetta e continua →'}
        </button>

        <p style={{ color: '#3f3f5a', fontSize: '10px', textAlign: 'center', margin: 0 }}>
          L&apos;accettazione viene registrata con timestamp. Puoi richiedere la revoca del consenso
          contattando support@stylistgo.it
        </p>
      </div>
    </div>
  );
}

function TosText() {
  return (
    <>
      <strong style={{ color: '#f4f4f5', display: 'block', marginBottom: '8px' }}>Termini e Condizioni — v1.0</strong>
      <p><strong style={{ color: '#c084fc' }}>1. Accettazione dei Termini</strong><br/>
      Utilizzando Stylistgo («il Servizio»), l&apos;utente («Titolare del Salone» o «Cliente») accetta integralmente i presenti Termini e Condizioni.</p>
      <p><strong style={{ color: '#c084fc' }}>2. Descrizione del Servizio</strong><br/>
      Stylistgo è un gestionale SaaS per saloni di parrucchieri ed estetiste che include funzioni di agenda, CRM clienti, cassa, magazzino e prenotazioni online.</p>
      <p><strong style={{ color: '#c084fc' }}>3. Piani e Fatturazione</strong><br/>
      L&apos;abbonamento è mensile e si rinnova automaticamente. Il recesso è possibile in qualsiasi momento con effetto al termine del periodo già pagato.</p>
      <p><strong style={{ color: '#c084fc' }}>4. Dati e Privacy</strong><br/>
      I dati inseriti dal Cliente rimangono di proprietà esclusiva del Cliente. Stylistgo li tratta come sub-processore ai sensi del GDPR. I dati sono cifrati a riposo con AES-256 e risiedono su server EU (Supabase — Frankfurt).</p>
      <p><strong style={{ color: '#c084fc' }}>5. Conservazione e Cancellazione</strong><br/>
      I dati dei clienti del salone inattivi da più di 24 mesi vengono eliminati automaticamente per ridurre l&apos;esposizione ai rischi e rispettare il principio di minimizzazione dei dati. Il Titolare può modificare questa soglia o richiedere la cancellazione immediata.</p>
      <p><strong style={{ color: '#c084fc' }}>6. Limitazione di Responsabilità</strong><br/>
      Stylistgo non è responsabile per danni derivanti dall&apos;utilizzo o dall&apos;impossibilità di utilizzo del servizio oltre il valore dell&apos;ultimo canone pagato.</p>
      <p><strong style={{ color: '#c084fc' }}>7. Modifiche</strong><br/>
      Le modifiche ai presenti Termini saranno notificate con almeno 30 giorni di preavviso. Il proseguimento dell&apos;utilizzo costituisce accettazione.</p>
    </>
  );
}

function DpaText() {
  return (
    <>
      <strong style={{ color: '#f4f4f5', display: 'block', marginBottom: '8px' }}>Data Processing Agreement (DPA) — v1.0</strong>
      <p><strong style={{ color: '#c084fc' }}>1. Parti e Ruoli</strong><br/>
      Il Titolare del Salone è il «Titolare del Trattamento» ai sensi del GDPR. Stylistgo agisce come «Responsabile del Trattamento».</p>
      <p><strong style={{ color: '#c084fc' }}>2. Finalità del Trattamento</strong><br/>
      I dati personali dei clienti del salone (nome, telefono, email, storico appuntamenti, schede tecniche) sono trattati esclusivamente per fornire il Servizio al Titolare.</p>
      <p><strong style={{ color: '#c084fc' }}>3. Sicurezza</strong><br/>
      Misure tecniche adottate: crittografia AES-256-GCM per i campi sensibili (telefono, note tecniche), accesso via Row Level Security (RLS) Postgres, audit log di ogni accesso, backup automatici Supabase.</p>
      <p><strong style={{ color: '#c084fc' }}>4. Sub-processori</strong><br/>
      Supabase Inc. (database, EU-West-1 Frankfurt, Germania) — il DPA di Supabase è disponibile su supabase.com/legal/dpa. Vercel Inc. (hosting edge functions) — GDPR DPA disponibile su vercel.com/legal/dpa.</p>
      <p><strong style={{ color: '#c084fc' }}>5. Diritti degli Interessati</strong><br/>
      Il Titolare del Salone può esercitare i diritti degli interessati (accesso, rettifica, cancellazione, portabilità) tramite le funzioni integrate nel pannello o inviando richiesta a privacy@stylistgo.it.</p>
      <p><strong style={{ color: '#c084fc' }}>6. Trasferimenti Internazionali</strong><br/>
      Nessun dato è trasferito fuori dall&apos;UE. I server Supabase utilizzati risiedono in Frankfurt, DE.</p>
      <p><strong style={{ color: '#c084fc' }}>7. Durata</strong><br/>
      Il DPA rimane valido per tutta la durata del contratto di servizio e fino alla cancellazione certificata di tutti i dati.</p>
    </>
  );
}
