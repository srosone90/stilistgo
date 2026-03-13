'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useSalon } from '@/context/SalonContext';
import { Client, TechnicalCard, HairType, HairCondition } from '@/types/salon';
import { salonGenerateId } from '@/lib/salonStorage';
import { getCurrentUser } from '@/lib/supabase';
import { format, parseISO, differenceInDays } from 'date-fns';
import { UserPlus, Search, Trash2, ChevronDown, ChevronUp, X, Star, AlertTriangle, FlaskConical, Clock, Camera, ImagePlus, Download, ShieldOff, Upload } from 'lucide-react';

const card: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px' };
const inputStyle: React.CSSProperties = { background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '10px', padding: '9px 13px', color: 'var(--text)', fontSize: '13px', outline: 'none', width: '100%' };
const labelStyle: React.CSSProperties = { fontSize: '12px', color: 'var(--muted)', marginBottom: '4px', display: 'block' };
const btnPrimary: React.CSSProperties = { background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', color: 'var(--accent-light)', borderRadius: '10px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' };
const btnDanger: React.CSSProperties = { background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' };

const EMPTY_CLIENT: Omit<Client, 'id' | 'createdAt'> = {
  firstName: '', lastName: '', phone: '', email: '', birthDate: '',
  notes: '', allergies: '', tags: [], gdprConsent: false, gdprDate: '', loyaltyPoints: 0,
};

const EMPTY_CARD: Omit<TechnicalCard, 'id' | 'createdAt'> = {
  clientId: '', operatorId: '', date: format(new Date(), 'yyyy-MM-dd'),
  serviceDescription: '', brand: '', formula: '', oxidant: '', oxidantPct: '',
  posaDuration: 0, result: '', notes: '',
  hairType: undefined, hairCondition: undefined, hairLength: undefined,
  photosBefore: [], photosAfter: [], appointmentId: '',
};

export default function ClientsView({ newTrigger }: { newTrigger?: number }) {
  const { clients, addClient, updateClient, deleteClient, technicalCards, addTechnicalCard, deleteTechnicalCard, operators, salonConfig } = useSalon();

  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [currentSalonId, setCurrentSalonId] = useState('');
  useEffect(() => { getCurrentUser().then(u => { if (u) setCurrentSalonId(u.id); }); }, []);

  const [gdprExporting, setGdprExporting] = useState(false);
  const [gdprDeleting, setGdprDeleting] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importData, setImportData] = useState<Omit<Client, 'id' | 'createdAt'>[] | null>(null);
  const [importError, setImportError] = useState('');
  const [importDupCount, setImportDupCount] = useState(0);

  const gdprExport = async (clientId: string) => {
    setGdprExporting(true);
    try {
      const { getSupabaseClient } = await import('@/lib/supabase');
      const session = (await getSupabaseClient().auth.getSession()).data.session;
      const token = session?.access_token ?? '';
      const res = await fetch(`/api/salon-gdpr?clientId=${encodeURIComponent(clientId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { alert('Errore esportazione dati'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cliente_${clientId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setGdprExporting(false);
    }
  };

  const gdprHardDelete = async (client: Client) => {
    const name = `${client.firstName} ${client.lastName}`;
    if (!confirm(`Eliminazione definitiva (GDPR art. 17)\n\nStai per cancellare irreversibilmente tutti i dati di "${name}":\n• Anagrafica\n• Appuntamenti\n• Schede tecniche\n• Transazioni\n\nQuesta azione non può essere annullata. Confermi?`)) return;
    if (!confirm(`Ultima conferma: eliminare definitivamente "${name}"?`)) return;
    setGdprDeleting(true);
    try {
      const { getSupabaseClient } = await import('@/lib/supabase');
      const session = (await getSupabaseClient().auth.getSession()).data.session;
      const token = session?.access_token ?? '';
      const res = await fetch('/api/salon-gdpr', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ clientId: client.id }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); alert(`Errore: ${d.error ?? res.status}`); return; }
      deleteClient(client.id);
      setSelectedId(null);
    } finally {
      setGdprDeleting(false);
    }
  };

  useEffect(() => { if (newTrigger && newTrigger > 0) { setShowForm(true); setEditingClient(null); setForm(EMPTY_CLIENT); } }, [newTrigger]);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [form, setForm] = useState<Omit<Client, 'id' | 'createdAt'>>(EMPTY_CLIENT);
  const [tagInput, setTagInput] = useState('');
  const [showCardForm, setShowCardForm] = useState(false);
  const [cardForm, setCardForm] = useState<Omit<TechnicalCard, 'id' | 'createdAt'>>(EMPTY_CARD);
  const [activeTab, setActiveTab] = useState<'info' | 'cards' | 'history'>('info');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return clients.filter(c =>
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
      c.phone.includes(q) || c.email.toLowerCase().includes(q)
    ).sort((a, b) => `${a.firstName}${a.lastName}`.localeCompare(`${b.firstName}${b.lastName}`));
  }, [clients, search]);

  const selected = selectedId ? clients.find(c => c.id === selectedId) ?? null : null;
  const clientCards = useMemo(() => technicalCards.filter(c => c.clientId === selectedId).sort((a, b) => b.date.localeCompare(a.date)), [technicalCards, selectedId]);

  const isDormant = (c: Client) => {
    const days = salonConfig.dormientiDays || 60;
    return differenceInDays(new Date(), parseISO(c.createdAt)) > days;
  };

  function openNew() {
    setEditingClient(null);
    setForm(EMPTY_CLIENT);
    setTagInput('');
    setShowForm(true);
  }

  function openEdit(c: Client) {
    setEditingClient(c);
    setForm({ firstName: c.firstName, lastName: c.lastName, phone: c.phone, email: c.email, birthDate: c.birthDate, notes: c.notes, allergies: c.allergies, tags: [...c.tags], gdprConsent: c.gdprConsent, gdprDate: c.gdprDate, loyaltyPoints: c.loyaltyPoints });
    setTagInput('');
    setShowForm(true);
  }

  function handleSave() {
    if (!form.firstName.trim()) return;
    if (editingClient) {
      updateClient({ ...editingClient, ...form });
    } else {
      addClient({ ...form, gdprDate: form.gdprConsent ? new Date().toISOString() : '' });
      // Auto-send app install link if automation enabled and client has a phone
      const waCfg = salonConfig.whatsapp;
      if (
        waCfg?.enabled && waCfg?.newClientAppLinkEnabled &&
        waCfg?.ultraMsgInstanceId && waCfg?.ultraMsgToken &&
        form.phone.trim() && currentSalonId
      ) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://stilistgo.vercel.app';
        const salonName = salonConfig.salonName ?? 'il tuo salone';
        const clientName = `${form.firstName} ${form.lastName}`.trim();
        // Fire-and-forget: generate token then send
        fetch('/api/client-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ salonId: currentSalonId, clientPhone: form.phone.trim(), clientName, clientEmail: form.email }),
        })
          .then(r => r.json())
          .then(d => {
            if (!d.token) return;
            const link = `${appUrl}/prenota/${currentSalonId}?t=${d.token}`;
            const template = waCfg.newClientAppLinkMsg
              ?? `Ciao {nome}! 🎉 Scarica l'app di {salone} e prenota direttamente dal tuo telefono: {link}`;
            const message = template
              .replace(/{nome}/g, clientName)
              .replace(/{salone}/g, salonName)
              .replace(/{link}/g, link);
            return fetch('/api/ultramsg/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                instanceId: waCfg.ultraMsgInstanceId,
                token: waCfg.ultraMsgToken,
                to: form.phone.trim(),
                message,
              }),
            });
          })
          .catch(() => { /* silently ignore */ });
      }
    }
    setShowForm(false);
  }

  function handleAddTag() {
    const t = tagInput.trim();
    if (t && !form.tags.includes(t)) setForm(p => ({ ...p, tags: [...p.tags, t] }));
    setTagInput('');
  }

  function handleSaveCard() {
    if (!cardForm.serviceDescription.trim() || !selectedId) return;
    addTechnicalCard({ ...cardForm, clientId: selectedId });
    setShowCardForm(false);
    setCardForm({ ...EMPTY_CARD, clientId: selectedId });
  }

  // ── Export ──────────────────────────────────────────────────────────────────
  function exportClients(fmt: 'csv' | 'json' | 'vcf' | 'xml') {
    const list = clients;
    const today = format(new Date(), 'yyyy-MM-dd');
    let content = '';
    let mimeType = 'text/plain;charset=utf-8';
    let ext = 'txt';

    if (fmt === 'csv') {
      const BOM = '\uFEFF';
      const header = 'Nome;Cognome;Telefono;Email;DataNascita;Note;Allergie;Tag;PuntiFedelta;ConsensoGDPR;DataGDPR;DataCreazione';
      const rows = list.map(c =>
        [c.firstName, c.lastName, c.phone, c.email, c.birthDate, c.notes, c.allergies,
          c.tags.join('|'), String(c.loyaltyPoints), c.gdprConsent ? 'Sì' : 'No', c.gdprDate, c.createdAt]
          .map(v => `"${(v ?? '').replace(/"/g, '""')}"`).join(';')
      );
      content = BOM + [header, ...rows].join('\n');
      mimeType = 'text/csv;charset=utf-8'; ext = 'csv';
    } else if (fmt === 'json') {
      content = JSON.stringify(list.map(c => ({
        nome: c.firstName, cognome: c.lastName, telefono: c.phone, email: c.email,
        dataNascita: c.birthDate, note: c.notes, allergie: c.allergies, tag: c.tags,
        puntiFedelta: c.loyaltyPoints, gdprConsent: c.gdprConsent, gdprDate: c.gdprDate, dataCreazione: c.createdAt,
      })), null, 2);
      mimeType = 'application/json;charset=utf-8'; ext = 'json';
    } else if (fmt === 'vcf') {
      content = list.map(c => {
        const lines = ['BEGIN:VCARD', 'VERSION:3.0',
          `N:${c.lastName};${c.firstName};;;`,
          `FN:${[c.firstName, c.lastName].filter(Boolean).join(' ')}`,
        ];
        if (c.phone) lines.push(`TEL;TYPE=CELL:${c.phone}`);
        if (c.email) lines.push(`EMAIL:${c.email}`);
        if (c.birthDate) lines.push(`BDAY:${c.birthDate.replace(/-/g, '')}`);
        const noteText = [c.notes, c.allergies ? `Allergie: ${c.allergies}` : ''].filter(Boolean).join(' | ');
        if (noteText) lines.push(`NOTE:${noteText}`);
        if (c.tags.length) lines.push(`CATEGORIES:${c.tags.join(',')}`);
        if (c.loyaltyPoints) lines.push(`X-LOYALTY-POINTS:${c.loyaltyPoints}`);
        lines.push('END:VCARD');
        return lines.join('\r\n');
      }).join('\r\n');
      mimeType = 'text/vcard;charset=utf-8'; ext = 'vcf';
    } else if (fmt === 'xml') {
      const esc = (s: string) => (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      content = `<?xml version="1.0" encoding="UTF-8"?>\n<clienti>\n` +
        list.map(c =>
          `  <cliente>\n    <nome>${esc(c.firstName)}</nome>\n    <cognome>${esc(c.lastName)}</cognome>\n` +
          `    <telefono>${esc(c.phone)}</telefono>\n    <email>${esc(c.email)}</email>\n` +
          `    <dataNascita>${esc(c.birthDate)}</dataNascita>\n    <note>${esc(c.notes)}</note>\n` +
          `    <allergie>${esc(c.allergies)}</allergie>\n    <tag>${c.tags.map(t => `<item>${esc(t)}</item>`).join('')}</tag>\n` +
          `    <puntiFedelta>${c.loyaltyPoints}</puntiFedelta>\n    <gdprConsent>${c.gdprConsent}</gdprConsent>\n` +
          `    <gdprDate>${esc(c.gdprDate)}</gdprDate>\n    <dataCreazione>${esc(c.createdAt)}</dataCreazione>\n  </cliente>`
        ).join('\n') + '\n</clienti>';
      mimeType = 'application/xml;charset=utf-8'; ext = 'xml';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clienti_${today}.${ext}`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowExport(false);
  }

  // ── Import ──────────────────────────────────────────────────────────────────
  async function handleImportFile(file: File) {
    setImportError('');
    setImportData(null);
    try {
      const text = await file.text();
      const name = file.name.toLowerCase();
      let parsed: Omit<Client, 'id' | 'createdAt'>[] = [];

      if (name.endsWith('.json')) {
        const raw: unknown = JSON.parse(text);
        const arr = Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
        parsed = arr.map(r => ({
          firstName: String(r.nome ?? r.firstName ?? r.first_name ?? '').trim(),
          lastName: String(r.cognome ?? r.lastName ?? r.last_name ?? '').trim(),
          phone: String(r.telefono ?? r.phone ?? '').trim(),
          email: String(r.email ?? '').trim().toLowerCase(),
          birthDate: String(r.dataNascita ?? r.birthDate ?? '').trim(),
          notes: String(r.note ?? r.notes ?? '').trim(),
          allergies: String(r.allergie ?? r.allergies ?? '').trim(),
          tags: Array.isArray(r.tag) ? (r.tag as string[]) : Array.isArray(r.tags) ? (r.tags as string[]) : [],
          loyaltyPoints: Number(r.puntiFedelta ?? r.loyaltyPoints ?? 0) || 0,
          gdprConsent: Boolean(r.gdprConsent ?? false),
          gdprDate: String(r.gdprDate ?? '').trim(),
        })).filter(c => c.firstName || c.lastName);

      } else if (name.endsWith('.vcf')) {
        const blocks = text.split(/BEGIN:VCARD/i).slice(1);
        parsed = blocks.map(block => {
          const get = (prop: string) => { const m = block.match(new RegExp(`^${prop}[^:\r\n]*:(.+)$`, 'im')); return m ? m[1].trim() : ''; };
          const nParts = get('N').split(';');
          const lastName = nParts[0] ?? '';
          const firstName = nParts[1] ?? '';
          const fn = get('FN');
          const finalFirst = firstName || (fn.includes(' ') ? fn.split(' ')[0] : fn);
          const finalLast = lastName || (fn.includes(' ') ? fn.split(' ').slice(1).join(' ') : '');
          const bday = get('BDAY');
          const bdayFmt = bday.length === 8 ? `${bday.slice(0,4)}-${bday.slice(4,6)}-${bday.slice(6,8)}` : bday;
          const cats = get('CATEGORIES');
          const lm = block.match(/^X-LOYALTY-POINTS[^:]*:(\d+)$/im);
          return {
            firstName: finalFirst, lastName: finalLast,
            phone: get('TEL'), email: get('EMAIL'),
            birthDate: bdayFmt, notes: get('NOTE'),
            allergies: '', tags: cats ? cats.split(',').map(t => t.trim()).filter(Boolean) : [],
            loyaltyPoints: lm ? Number(lm[1]) : 0, gdprConsent: false, gdprDate: '',
          };
        }).filter(c => c.firstName || c.lastName);

      } else if (name.endsWith('.xml')) {
        const doc = new DOMParser().parseFromString(text, 'application/xml');
        const items = Array.from(doc.querySelectorAll('cliente'));
        const txt = (el: Element, tag: string) => el.querySelector(tag)?.textContent?.trim() ?? '';
        parsed = items.map(el => ({
          firstName: txt(el, 'nome'), lastName: txt(el, 'cognome'),
          phone: txt(el, 'telefono'), email: txt(el, 'email'),
          birthDate: txt(el, 'dataNascita'), notes: txt(el, 'note'),
          allergies: txt(el, 'allergie'),
          tags: Array.from(el.querySelectorAll('tag item')).map(i => i.textContent?.trim() ?? '').filter(Boolean),
          loyaltyPoints: Number(txt(el, 'puntiFedelta')) || 0,
          gdprConsent: txt(el, 'gdprConsent') === 'true',
          gdprDate: txt(el, 'gdprDate'),
        })).filter(c => c.firstName || c.lastName);

      } else {
        // CSV — auto-detect separator (semicolon wins for Italian locale)
        const rawText = text.replace(/^\uFEFF/, '');
        const firstLine = rawText.split(/\r?\n/)[0] || '';
        const sep = firstLine.split(';').length > firstLine.split(',').length ? ';' : ',';
        const lines = rawText.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) { setImportError('File CSV vuoto o formato non riconosciuto.'); return; }
        const parseRow = (row: string): string[] => {
          const res: string[] = []; let cur = ''; let inQ = false;
          for (let i = 0; i < row.length; i++) {
            const ch = row[i];
            if (ch === '"') { if (inQ && row[i + 1] === '"') { cur += '"'; i++; } else { inQ = !inQ; } }
            else if (ch === sep && !inQ) { res.push(cur); cur = ''; }
            else { cur += ch; }
          }
          res.push(cur); return res;
        };
        const headers = parseRow(lines[0]).map(h => h.toLowerCase().replace(/[\s_\-]/g, ''));
        const col = (...ns: string[]) => { for (const n of ns) { const i = headers.indexOf(n); if (i >= 0) return i; } return -1; };
        const iFirst = col('nome', 'firstname'); const iLast = col('cognome', 'lastname');
        const iPhone = col('telefono', 'phone', 'tel'); const iEmail = col('email');
        const iBday = col('datanascita', 'birthdate'); const iNotes = col('note', 'notes');
        const iAller = col('allergie', 'allergies'); const iTags = col('tag', 'tags');
        const iLoy = col('puntifedelta', 'loyaltypoints', 'punti'); const iGdpr = col('consensogdpr', 'gdprconsent', 'gdpr');
        parsed = lines.slice(1).map(line => {
          const cols = parseRow(line);
          const get = (i: number) => (i >= 0 ? (cols[i] ?? '').trim() : '');
          return {
            firstName: get(iFirst), lastName: get(iLast), phone: get(iPhone),
            email: get(iEmail).toLowerCase(), birthDate: get(iBday), notes: get(iNotes),
            allergies: get(iAller), tags: get(iTags).split('|').map(t => t.trim()).filter(Boolean),
            loyaltyPoints: Number(get(iLoy)) || 0,
            gdprConsent: ['sì', 'si', 'yes', 'true', '1'].includes(get(iGdpr).toLowerCase()),
            gdprDate: '',
          };
        }).filter(c => c.firstName || c.lastName);
      }

      const existingPhones = new Set(clients.map(c => c.phone.trim()).filter(Boolean));
      const existingEmails = new Set(clients.map(c => c.email.trim().toLowerCase()).filter(Boolean));
      const dups = parsed.filter(c =>
        (c.phone && existingPhones.has(c.phone.trim())) ||
        (c.email && existingEmails.has(c.email.toLowerCase()))
      ).length;
      setImportDupCount(dups);
      setImportData(parsed);
    } catch (_e) {
      setImportError('Errore nella lettura del file. Verifica il formato e riprova.');
    }
  }

  function executeImport() {
    if (!importData) return;
    const existingPhones = new Set(clients.map(c => c.phone.trim()).filter(Boolean));
    const existingEmails = new Set(clients.map(c => c.email.trim().toLowerCase()).filter(Boolean));
    let added = 0;
    for (const c of importData) {
      if ((c.phone && existingPhones.has(c.phone.trim())) ||
          (c.email && existingEmails.has(c.email.toLowerCase()))) continue;
      addClient({ ...c, gdprDate: c.gdprConsent ? (c.gdprDate || new Date().toISOString()) : '' });
      added++;
    }
    setShowImport(false);
    setImportData(null);
    setImportError('');
    alert(`Importazione completata: ${added} nuovi clienti aggiunti${importData.length - added > 0 ? `, ${importData.length - added} duplicati ignorati` : '.'}.`);
  }

  return (
    <div className="flex flex-col md:flex-row gap-4 md:gap-5 h-full" style={{ minHeight: 0 }}>
      {/* ── LEFT: list ── */}
      <div className={`flex flex-col gap-4 md:w-80 md:shrink-0${selectedId ? ' hidden md:flex' : ''}`}>
        <div>
          <h1 className="text-2xl font-bold text-white">Clienti</h1>
          <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{clients.length} clienti registrati</p>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca nome, tel, email…" style={{ ...inputStyle, paddingLeft: '32px' }} />
          </div>
          <button onClick={openNew} style={btnPrimary} title="Nuovo cliente"><UserPlus size={15} /></button>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowExport(true)} style={{ ...btnPrimary, flex: 1, justifyContent: 'center', fontSize: '12px', padding: '6px 10px' }}>
            <Download size={13} /> Esporta
          </button>
          <button onClick={() => { setImportData(null); setImportError(''); setShowImport(true); }} style={{ ...btnPrimary, flex: 1, justifyContent: 'center', fontSize: '12px', padding: '6px 10px' }}>
            <Upload size={13} /> Importa
          </button>
        </div>

        <div className="flex flex-col gap-2 overflow-y-auto" style={{ flex: 1 }}>
          {filtered.length === 0 && <p style={{ color: 'var(--border-light)', fontSize: '13px' }}>Nessun cliente trovato.</p>}
          {filtered.map(c => (
            <button key={c.id} onClick={() => { setSelectedId(c.id); setActiveTab('info'); }}
              className="text-left rounded-xl px-4 py-3 transition-all"
              style={{ background: selectedId === c.id ? 'rgba(99,102,241,0.15)' : 'var(--bg-card)', border: `1px solid ${selectedId === c.id ? 'rgba(99,102,241,0.5)' : 'var(--border)'}` }}>
              <div className="flex items-center justify-between">
                <span className="font-medium text-white text-sm">{c.firstName} {c.lastName}</span>
                <div className="flex items-center gap-1">
                  {c.allergies && <AlertTriangle size={12} style={{ color: '#f59e0b' }} />}
                  {isDormant(c) && <Clock size={12} style={{ color: 'var(--muted)' }} />}
                </div>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--muted)' }}>{c.phone || c.email || '—'}</p>
              {c.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {c.tags.slice(0, 3).map(t => (
                    <span key={t} className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--accent-light)', border: '1px solid rgba(99,102,241,0.2)' }}>{t}</span>
                  ))}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── RIGHT: detail ── */}
      <div className="flex-1 overflow-y-auto">
        {!selected ? (
          <div className="hidden md:flex items-center justify-center h-full" style={{ color: 'var(--border-light)' }}>
            <p>Seleziona un cliente dalla lista</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Back button — mobile only */}
            <button className="md:hidden flex items-center gap-1 text-sm mb-1" style={{ color: 'var(--accent-light)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} onClick={() => setSelectedId(null)}>
              ← Torna alla lista
            </button>
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">{selected.firstName} {selected.lastName}</h2>
                <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Cliente dal {format(parseISO(selected.createdAt), 'dd/MM/yyyy')}</p>
              </div>
              <div className="flex gap-2 flex-wrap justify-end">
                <button onClick={() => openEdit(selected)} style={btnPrimary}>Modifica</button>
                <button onClick={() => gdprExport(selected.id)} disabled={gdprExporting}
                  style={{ ...btnPrimary, opacity: gdprExporting ? 0.6 : 1 }}
                  title="Esporta tutti i dati del cliente (GDPR art. 20)">
                  <Download size={13} />{gdprExporting ? '…' : 'Esporta'}
                </button>
                <button onClick={() => gdprHardDelete(selected)} disabled={gdprDeleting}
                  style={{ ...btnDanger, display: 'flex', alignItems: 'center', gap: '4px', opacity: gdprDeleting ? 0.6 : 1 }}
                  title="Elimina definitivamente tutti i dati (GDPR art. 17)">
                  <ShieldOff size={12} />{gdprDeleting ? '…' : 'Elimina'}
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', width: 'fit-content' }}>
              {(['info', 'cards', 'history'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
                  style={{ background: activeTab === tab ? 'rgba(99,102,241,0.2)' : 'transparent', color: activeTab === tab ? 'var(--accent-light)' : 'var(--muted)' }}>
                  {tab === 'info' ? 'Anagrafica' : tab === 'cards' ? 'Schede Tecniche' : 'Storico'}
                </button>
              ))}
            </div>

            {/* Tab: Info */}
            {activeTab === 'info' && (
              <div className="grid grid-cols-2 gap-4">
                <div style={card}>
                  <h3 className="text-sm font-semibold text-white mb-3">Contatti</h3>
                  <div className="space-y-2 text-sm">
                    <Row label="Telefono" value={selected.phone || '—'} />
                    <Row label="Email" value={selected.email || '—'} />
                    <Row label="Data di nascita" value={selected.birthDate ? format(parseISO(selected.birthDate), 'dd/MM/yyyy') : '—'} />
                  </div>
                </div>

                <div style={card}>
                  <h3 className="text-sm font-semibold text-white mb-3">Fedeltà & GDPR</h3>
                  <div className="space-y-2 text-sm">
                    <Row label="Punti fedeltà" value={String(selected.loyaltyPoints)} highlight="#f59e0b" />
                    <Row label="GDPR" value={selected.gdprConsent ? `✓ Consenso del ${selected.gdprDate ? format(parseISO(selected.gdprDate), 'dd/MM/yyyy') : '—'}` : '✗ Non fornito'} highlight={selected.gdprConsent ? '#22c55e' : '#ef4444'} />
                  </div>
                </div>

                {selected.allergies && (
                  <div className="col-span-2 rounded-xl px-4 py-3 flex gap-2 items-start" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
                    <AlertTriangle size={16} style={{ color: '#f59e0b', marginTop: 2, flexShrink: 0 }} />
                    <div>
                      <p className="text-sm font-semibold" style={{ color: '#f59e0b' }}>Allergie / Controindicazioni</p>
                      <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>{selected.allergies}</p>
                    </div>
                  </div>
                )}

                {selected.notes && (
                  <div className="col-span-2" style={card}>
                    <h3 className="text-sm font-semibold text-white mb-2">Note generali</h3>
                    <p className="text-sm" style={{ color: 'var(--text-2)' }}>{selected.notes}</p>
                  </div>
                )}

                {selected.tags.length > 0 && (
                  <div className="col-span-2" style={card}>
                    <h3 className="text-sm font-semibold text-white mb-2">Tag</h3>
                    <div className="flex flex-wrap gap-2">
                      {selected.tags.map(t => (
                        <span key={t} className="text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--accent-light)', border: '1px solid rgba(99,102,241,0.3)' }}>{t}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Schede Tecniche */}
            {activeTab === 'cards' && (
              <div className="space-y-3">
                <button onClick={() => { setShowCardForm(true); setCardForm({ ...EMPTY_CARD, clientId: selected.id }); }} style={btnPrimary}>
                  <FlaskConical size={14} /> Nuova Scheda Tecnica
                </button>
                {clientCards.length === 0 && <p style={{ color: 'var(--border-light)', fontSize: '13px' }}>Nessuna scheda tecnica registrata.</p>}
                {clientCards.map(tc => (
                  <div key={tc.id} style={card}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold text-white text-sm">{tc.serviceDescription}</p>
                        <p style={{ fontSize: '12px', color: 'var(--muted)' }}>{format(parseISO(tc.date), 'dd/MM/yyyy')} · {operators.find(o => o.id === tc.operatorId)?.name || '—'}</p>
                      </div>
                      <button onClick={() => deleteTechnicalCard(tc.id)} style={{ ...btnDanger, padding: '4px 8px' }}>×</button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs mt-2">
                      {tc.brand && <Row label="Brand" value={tc.brand} />}
                      {tc.formula && <Row label="Formula" value={tc.formula} />}
                      {tc.oxidant && <Row label="Ossidante" value={`${tc.oxidant} ${tc.oxidantPct}%`} />}
                      {tc.posaDuration > 0 && <Row label="Tempo posa" value={`${tc.posaDuration} min`} />}
                      {tc.result && <Row label="Risultato" value={tc.result} />}
                      {tc.hairType && <Row label="Tipo capello" value={tc.hairType} />}
                      {tc.hairCondition && <Row label="Condizione" value={tc.hairCondition} />}
                      {tc.hairLength && <Row label="Lunghezza" value={tc.hairLength} />}
                    </div>
                    {tc.notes && <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>{tc.notes}</p>}
                    {/* Photos */}
                    {((tc.photosBefore?.length ?? 0) > 0 || (tc.photosAfter?.length ?? 0) > 0) && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {tc.photosBefore && tc.photosBefore.length > 0 && (
                          <div>
                            <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>Prima</p>
                            <div className="flex flex-wrap gap-1">
                              {tc.photosBefore.map((src, i) => (
                                <img key={i} src={src} alt="prima" className="w-16 h-16 rounded-lg object-cover cursor-pointer hover:opacity-80" onClick={() => window.open(src, '_blank')} />
                              ))}
                            </div>
                          </div>
                        )}
                        {tc.photosAfter && tc.photosAfter.length > 0 && (
                          <div>
                            <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>Dopo</p>
                            <div className="flex flex-wrap gap-1">
                              {tc.photosAfter.map((src, i) => (
                                <img key={i} src={src} alt="dopo" className="w-16 h-16 rounded-lg object-cover cursor-pointer hover:opacity-80" onClick={() => window.open(src, '_blank')} />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Tab: Storico appuntamenti */}
            {activeTab === 'history' && (
              <AppointmentHistory clientId={selected.id} />
            )}
          </div>
        )}
      </div>

      {/* ── Modal: Client Form ── */}
      {showForm && (
        <Modal title={editingClient ? 'Modifica Cliente' : 'Nuovo Cliente'} onClose={() => setShowForm(false)}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome *"><input value={form.firstName} onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))} style={inputStyle} /></Field>
            <Field label="Cognome"><input value={form.lastName} onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))} style={inputStyle} /></Field>
            <Field label="Telefono"><input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} style={inputStyle} /></Field>
            <Field label="Email"><input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} style={inputStyle} /></Field>
            <Field label="Data di nascita"><input type="date" value={form.birthDate} onChange={e => setForm(p => ({ ...p, birthDate: e.target.value }))} style={inputStyle} /></Field>
            <Field label="Punti fedeltà"><input type="number" min={0} value={form.loyaltyPoints} onChange={e => setForm(p => ({ ...p, loyaltyPoints: Number(e.target.value) }))} style={inputStyle} /></Field>
            <div className="col-span-2"><Field label="Allergie / Controindicazioni"><textarea rows={2} value={form.allergies} onChange={e => setForm(p => ({ ...p, allergies: e.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} /></Field></div>
            <div className="col-span-2"><Field label="Note generali"><textarea rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} /></Field></div>
            <div className="col-span-2">
              <Field label="Tag">
                <div className="flex gap-2">
                  <input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddTag())} placeholder="es. VIP, allergia nichel…" style={{ ...inputStyle, flex: 1 }} />
                  <button type="button" onClick={handleAddTag} style={{ ...btnPrimary, flexShrink: 0 }}>+</button>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {form.tags.map(t => (
                    <span key={t} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--accent-light)', border: '1px solid rgba(99,102,241,0.3)' }}>
                      {t}<button type="button" onClick={() => setForm(p => ({ ...p, tags: p.tags.filter(x => x !== t) }))} style={{ background: 'none', border: 'none', color: 'var(--accent-light)', cursor: 'pointer', padding: 0 }}>×</button>
                    </span>
                  ))}
                </div>
              </Field>
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input type="checkbox" id="gdpr" checked={form.gdprConsent} onChange={e => setForm(p => ({ ...p, gdprConsent: e.target.checked }))} />
              <label htmlFor="gdpr" className="text-sm" style={{ color: 'var(--text-2)' }}>Consenso GDPR ottenuto</label>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setShowForm(false)} style={{ ...btnDanger }}>Annulla</button>
            <button onClick={handleSave} style={btnPrimary}>Salva</button>
          </div>
        </Modal>
      )}

      {/* ── Modal: Technical Card Form ── */}
      {showCardForm && (
        <Modal title="Nuova Scheda Tecnica" onClose={() => setShowCardForm(false)}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Field label="Servizio / Trattamento *"><input value={cardForm.serviceDescription} onChange={e => setCardForm(p => ({ ...p, serviceDescription: e.target.value }))} style={inputStyle} /></Field></div>
            <Field label="Data"><input type="date" value={cardForm.date} onChange={e => setCardForm(p => ({ ...p, date: e.target.value }))} style={inputStyle} /></Field>
            <Field label="Operatore">
              <select value={cardForm.operatorId} onChange={e => setCardForm(p => ({ ...p, operatorId: e.target.value }))} style={{ ...inputStyle }}>
                <option value="">—</option>
                {operators.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </Field>
            <Field label="Brand / Prodotto"><input value={cardForm.brand} onChange={e => setCardForm(p => ({ ...p, brand: e.target.value }))} style={inputStyle} /></Field>
            <Field label="Formula"><input value={cardForm.formula} onChange={e => setCardForm(p => ({ ...p, formula: e.target.value }))} style={inputStyle} /></Field>
            <Field label="Ossidante"><input value={cardForm.oxidant} onChange={e => setCardForm(p => ({ ...p, oxidant: e.target.value }))} style={inputStyle} /></Field>
            <Field label="Percentuale ossidante"><input value={cardForm.oxidantPct} onChange={e => setCardForm(p => ({ ...p, oxidantPct: e.target.value }))} style={inputStyle} /></Field>
            <Field label="Tempo di posa (min)"><input type="number" min={0} value={cardForm.posaDuration} onChange={e => setCardForm(p => ({ ...p, posaDuration: Number(e.target.value) }))} style={inputStyle} /></Field>
            <Field label="Risultato"><input value={cardForm.result} onChange={e => setCardForm(p => ({ ...p, result: e.target.value }))} style={inputStyle} /></Field>
            {/* Hair profile */}
            <Field label="Tipo capello">
              <select value={cardForm.hairType ?? ''} onChange={e => setCardForm(p => ({ ...p, hairType: e.target.value as HairType || undefined }))} style={inputStyle}>
                <option value="">—</option>
                {(['lisci','mossi','ricci','crespi','altro'] as HairType[]).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Condizione capello">
              <select value={cardForm.hairCondition ?? ''} onChange={e => setCardForm(p => ({ ...p, hairCondition: e.target.value as HairCondition || undefined }))} style={inputStyle}>
                <option value="">—</option>
                {(['sani','secchi','grassi','colorati','trattati','rovinati'] as HairCondition[]).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Lunghezza capello">
              <select value={cardForm.hairLength ?? ''} onChange={e => setCardForm(p => ({ ...p, hairLength: e.target.value as 'corti'|'medi'|'lunghi' || undefined }))} style={inputStyle}>
                <option value="">—</option>
                <option value="corti">Corti</option>
                <option value="medi">Medi</option>
                <option value="lunghi">Lunghi</option>
              </select>
            </Field>
            <div className="col-span-2"><Field label="Note"><textarea rows={2} value={cardForm.notes} onChange={e => setCardForm(p => ({ ...p, notes: e.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} /></Field></div>
            {/* Photo upload */}
            <div className="col-span-2">
              <label className="block text-xs mb-2" style={{ color: 'var(--muted)' }}>Foto PRIMA (max 3)</label>
              <div className="flex flex-wrap gap-2 items-center">
                {(cardForm.photosBefore ?? []).map((src, i) => (
                  <div key={i} className="relative w-16 h-16">
                    <img src={src} alt="prima" className="w-16 h-16 rounded-lg object-cover" />
                    <button type="button" onClick={() => setCardForm(p => ({ ...p, photosBefore: p.photosBefore?.filter((_, j) => j !== i) }))}
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-white text-xs"
                      style={{ background: '#ef4444' }}>×</button>
                  </div>
                ))}
                {(cardForm.photosBefore?.length ?? 0) < 3 && (
                  <label className="w-16 h-16 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:opacity-70"
                    style={{ border: '2px dashed var(--border)', color: 'var(--muted)' }}>
                    <ImagePlus size={18} /><span className="text-xs mt-0.5">Prima</span>
                    <input type="file" accept="image/*" className="hidden" onChange={e => {
                      const f = e.target.files?.[0]; if (!f) return;
                      const r = new FileReader(); r.onload = ev => { const d = ev.target?.result as string; setCardForm(p => ({ ...p, photosBefore: [...(p.photosBefore ?? []), d] })); }; r.readAsDataURL(f);
                    }} />
                  </label>
                )}
              </div>
            </div>
            <div className="col-span-2">
              <label className="block text-xs mb-2" style={{ color: 'var(--muted)' }}>Foto DOPO (max 3)</label>
              <div className="flex flex-wrap gap-2 items-center">
                {(cardForm.photosAfter ?? []).map((src, i) => (
                  <div key={i} className="relative w-16 h-16">
                    <img src={src} alt="dopo" className="w-16 h-16 rounded-lg object-cover" />
                    <button type="button" onClick={() => setCardForm(p => ({ ...p, photosAfter: p.photosAfter?.filter((_, j) => j !== i) }))}
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-white text-xs"
                      style={{ background: '#ef4444' }}>×</button>
                  </div>
                ))}
                {(cardForm.photosAfter?.length ?? 0) < 3 && (
                  <label className="w-16 h-16 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:opacity-70"
                    style={{ border: '2px dashed var(--border)', color: 'var(--muted)' }}>
                    <ImagePlus size={18} /><span className="text-xs mt-0.5">Dopo</span>
                    <input type="file" accept="image/*" className="hidden" onChange={e => {
                      const f = e.target.files?.[0]; if (!f) return;
                      const r = new FileReader(); r.onload = ev => { const d = ev.target?.result as string; setCardForm(p => ({ ...p, photosAfter: [...(p.photosAfter ?? []), d] })); }; r.readAsDataURL(f);
                    }} />
                  </label>
                )}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setShowCardForm(false)} style={btnDanger}>Annulla</button>
            <button onClick={handleSaveCard} style={btnPrimary}>Salva</button>
          </div>
        </Modal>
      )}

      {/* ── Modal: Esporta Clienti ── */}
      {showExport && (
        <Modal title={`Esporta Clienti (${clients.length})`} onClose={() => setShowExport(false)}>
          <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>Scegli il formato. Verranno inclusi tutti i {clients.length} clienti.</p>
          <div className="grid grid-cols-2 gap-3">
            {([
              { fmt: 'csv' as const, label: 'CSV', desc: 'Excel / LibreOffice / Numbers', icon: '📊' },
              { fmt: 'json' as const, label: 'JSON', desc: 'Backup / API / sviluppatori', icon: '📋' },
              { fmt: 'vcf' as const, label: 'vCard .vcf', desc: 'Rubrica / Outlook / iPhone', icon: '👤' },
              { fmt: 'xml' as const, label: 'XML', desc: 'Gestionali / TeamSystem / Zucchetti', icon: '🖥️' },
            ]).map(({ fmt, label, desc, icon }) => (
              <button key={fmt} onClick={() => exportClients(fmt)}
                className="flex flex-col items-center gap-1 rounded-xl p-4 transition-all hover:opacity-80"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                <span style={{ fontSize: '28px', lineHeight: 1 }}>{icon}</span>
                <span className="text-sm font-semibold text-white">{label}</span>
                <span className="text-xs text-center" style={{ color: 'var(--muted)' }}>{desc}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* ── Modal: Importa Clienti ── */}
      {showImport && (
        <Modal title="Importa Clienti" onClose={() => { setShowImport(false); setImportData(null); setImportError(''); }}>
          <div className="space-y-4">
            <div className="rounded-xl p-3" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                <strong style={{ color: 'var(--accent-light)' }}>Formati supportati:</strong>{' '}
                CSV (Excel/LibreOffice), JSON, vCard (.vcf), XML<br />
                I duplicati per telefono o email vengono automaticamente ignorati.
              </p>
            </div>
            <label className="flex flex-col items-center justify-center gap-2 rounded-xl cursor-pointer transition-opacity hover:opacity-70"
              style={{ border: '2px dashed var(--border)', padding: '32px', color: 'var(--muted)' }}>
              <Upload size={24} />
              <span className="text-sm font-medium text-white">Clicca per selezionare il file</span>
              <span className="text-xs">.csv · .json · .vcf · .xml</span>
              <input type="file" accept=".csv,.json,.vcf,.xml" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleImportFile(f); e.target.value = ''; }} />
            </label>
            {importError && (
              <div className="rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
                <p className="text-sm" style={{ color: '#f87171' }}>{importError}</p>
              </div>
            )}
            {importData && (
              <div className="space-y-3">
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                  <div className="px-4 py-2 flex justify-between text-sm" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-input)' }}>
                    <span style={{ color: 'var(--text-2)' }}>Clienti trovati nel file</span>
                    <span className="font-semibold text-white">{importData.length}</span>
                  </div>
                  <div className="px-4 py-2 flex justify-between text-sm" style={{ borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--muted)' }}>Già presenti (ignorati)</span>
                    <span style={{ color: '#f59e0b' }}>{importDupCount}</span>
                  </div>
                  <div className="px-4 py-2 flex justify-between text-sm font-semibold" style={{ background: 'rgba(34,197,94,0.05)' }}>
                    <span style={{ color: '#22c55e' }}>Nuovi da importare</span>
                    <span style={{ color: '#22c55e' }}>{importData.length - importDupCount}</span>
                  </div>
                </div>
                {importData.slice(0, 5).length > 0 && (
                  <div className="rounded-xl overflow-hidden text-xs" style={{ border: '1px solid var(--border)' }}>
                    {importData.slice(0, 5).map((c, i) => (
                      <div key={i} className="px-3 py-2" style={{ borderBottom: i < Math.min(importData.length, 5) - 1 ? '1px solid var(--border)' : undefined, color: 'var(--text-2)' }}>
                        {c.firstName} {c.lastName}{c.phone ? ` · ${c.phone}` : ''}{c.email ? ` · ${c.email}` : ''}
                      </div>
                    ))}
                    {importData.length > 5 && (
                      <div className="px-3 py-2 text-center" style={{ color: 'var(--muted)', background: 'var(--bg-input)' }}>…e altri {importData.length - 5} clienti</div>
                    )}
                  </div>
                )}
                {importData.length - importDupCount > 0 ? (
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => { setImportData(null); setImportError(''); }} style={btnDanger}>Annulla</button>
                    <button onClick={executeImport} style={btnPrimary}>
                      <Upload size={13} /> Importa {importData.length - importDupCount} clienti
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-center py-2" style={{ color: 'var(--muted)' }}>Nessun nuovo cliente da aggiungere (tutti già presenti).</p>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

function AppointmentHistory({ clientId }: { clientId: string }) {
  const { appointments, services, operators } = useSalon();
  const clientAppts = appointments
    .filter(a => a.clientId === clientId)
    .sort((a, b) => b.date.localeCompare(a.date));

  if (clientAppts.length === 0) return <p style={{ color: 'var(--border-light)', fontSize: '13px' }}>Nessun appuntamento registrato per questo cliente.</p>;

  return (
    <div className="space-y-2">
      {clientAppts.map(a => {
        const op = operators.find(o => o.id === a.operatorId);
        const svcs = a.serviceIds.map(sid => services.find(s => s.id === sid)?.name).filter(Boolean).join(', ');
        return (
          <div key={a.id} className="rounded-xl px-4 py-3 flex items-center justify-between" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div>
              <p className="text-sm text-white font-medium">{format(parseISO(a.date), 'dd/MM/yyyy')} {a.startTime}–{a.endTime}</p>
              <p style={{ fontSize: '12px', color: 'var(--muted)' }}>{svcs || (a.isBlock ? a.blockReason : '—')} · {op?.name || '—'}</p>
            </div>
            <StatusBadge status={a.status} />
          </div>
        );
      })}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    scheduled: { bg: 'rgba(99,102,241,0.15)', color: 'var(--accent-light)', label: 'Prenotato' },
    confirmed: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e', label: 'Confermato' },
    completed: { bg: 'rgba(168,85,247,0.15)', color: '#c084fc', label: 'Completato' },
    cancelled: { bg: 'rgba(113,113,122,0.15)', color: 'var(--muted)', label: 'Cancellato' },
    'no-show': { bg: 'rgba(239,68,68,0.15)', color: '#f87171', label: 'No-show' },
  };
  const s = map[status] || map.scheduled;
  return <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}40` }}>{s.label}</span>;
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <div>
      <span style={{ color: 'var(--muted)', marginRight: 6 }}>{label}:</span>
      <span style={{ color: highlight || 'var(--text-2)' }}>{value}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6" style={{ background: '#18181f', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white">{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
