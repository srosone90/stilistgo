/**
 * importParser.ts — Parsing, normalization, and validation utilities for CSV client imports.
 * Pure functions only — no React, no side effects, no UI concerns.
 */

import type { Client, ClientGender, AcquisitionSource } from '@/types/salon';

// ─── Encoding detection ───────────────────────────────────────────────────────

/**
 * Decode an ArrayBuffer to a string, automatically handling:
 * - UTF-8 BOM (EF BB BF)
 * - UTF-8 (default)
 * - ISO-8859-1 as fallback when UTF-8 strict decoding fails
 */
export function decodeFileBuffer(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  // BOM UTF-8: EF BB BF
  if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    return new TextDecoder('utf-8').decode(buf.slice(3));
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder('iso-8859-1').decode(buf);
  }
}

// ─── CSV parsing ──────────────────────────────────────────────────────────────

/** Detect the dominant separator of a CSV line (`;`, `,`, or `\t`). */
export function detectSeparator(firstLine: string): string {
  const counts: Record<string, number> = {
    ';': (firstLine.match(/;/g) ?? []).length,
    ',': (firstLine.match(/,/g) ?? []).length,
    '\t': (firstLine.match(/\t/g) ?? []).length,
  };
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

/** Parse a single CSV row, respecting double-quoted fields (RFC 4180). */
export function parseCsvRow(row: string, sep: string): string[] {
  const res: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '"') {
      if (inQ && row[i + 1] === '"') { cur += '"'; i++; }
      else { inQ = !inQ; }
    } else if (ch === sep && !inQ) {
      res.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  res.push(cur);
  return res;
}

/** Parse a full CSV text into headers + data rows. */
export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  const sep = detectSeparator(lines[0]);
  const headers = parseCsvRow(lines[0], sep).map(h => h.trim());
  const rows = lines.slice(1).map(l => parseCsvRow(l, sep));
  return { headers, rows };
}

// ─── Header normalization ─────────────────────────────────────────────────────

/**
 * Normalize a column header for fuzzy matching:
 * lowercase, strip accents (è→e, à→a …), strip spaces/underscores/hyphens/dots.
 */
export function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[\s_\-\.]/g, '');
}

// ─── Target fields ────────────────────────────────────────────────────────────

export type FieldKey = keyof Omit<Client, 'id' | 'createdAt'> | '__ignore__';

export interface TargetField {
  key: FieldKey;
  label: string;      // displayed in Italian
  required?: boolean; // highlights "Nome" as mandatory
  aliases: string[];  // normalized aliases used for auto-matching
}

/** Complete list of importable fields mapped to Client properties. */
export const TARGET_FIELDS: TargetField[] = [
  { key: '__ignore__', label: 'Ignora questo campo', aliases: [] },
  {
    key: 'firstName', label: 'Nome', required: true,
    aliases: ['nome', 'firstname', 'first', 'name', 'nominativo', 'cliente',
              'nomecliente', 'nominativocliente', 'nomepaziente'],
  },
  {
    key: 'lastName', label: 'Cognome',
    aliases: ['cognome', 'lastname', 'last', 'surname', 'cognomecliente', 'cognomepaziente'],
  },
  {
    key: 'phone', label: 'Telefono',
    aliases: ['telefono', 'phone', 'tel', 'cellulare', 'mobile', 'cel', 'cell',
              'numeroditelefono', 'numerocellulare', 'phonenumber', 'telcellulare',
              'numerocell', 'telefonocell'],
  },
  {
    key: 'email', label: 'Email',
    aliases: ['email', 'mail', 'emailcliente', 'indirizzoemail', 'emailaddress', 'e-mail'],
  },
  {
    key: 'birthDate', label: 'Data di nascita',
    aliases: ['datanascita', 'birthdate', 'nascita', 'dob', 'datadinascita',
              'birthday', 'datanascite', 'datanascita'],
  },
  {
    key: 'gender', label: 'Sesso',
    aliases: ['sesso', 'gender', 'sex', 'genere'],
  },
  {
    key: 'address', label: 'Indirizzo',
    aliases: ['indirizzo', 'address', 'via', 'viapiazza', 'addr', 'street', 'indirizzoresidenza'],
  },
  {
    key: 'city', label: 'Città',
    aliases: ['citta', 'city', 'comune', 'localita', 'paese', 'town', 'cittaresidenza'],
  },
  {
    key: 'province', label: 'Provincia',
    aliases: ['provincia', 'province', 'prov', 'pr', 'siglaprovincia'],
  },
  {
    key: 'postalCode', label: 'CAP',
    aliases: ['cap', 'postalcode', 'zipcode', 'zip', 'codiceavviamento', 'codicepostale', 'codiceavviamentopostale'],
  },
  {
    key: 'acquisitionSource', label: 'Fonte di acquisizione',
    aliases: ['fonteacquisizione', 'acquisitionsource', 'fonte', 'provenienza', 'canale', 'sorgente', 'comecihaitrovato'],
  },
  {
    key: 'acquisitionDate', label: 'Data di acquisizione',
    aliases: ['dataacquisizione', 'acquisitiondate', 'dataiscrizione', 'dataregistrazione',
              'dataentrata', 'registrato', 'dataprimoacquisto', 'dataaperturaconto'],
  },
  {
    key: 'loyaltyPoints', label: 'Punti fedeltà',
    aliases: ['puntifedelta', 'loyaltypoints', 'punti', 'points', 'fidelitypoints',
              'puntifedeltà', 'puntiacquisiti', 'pointssaldo'],
  },
  {
    key: 'gdprConsent', label: 'Privacy / Consenso GDPR',
    aliases: ['privacy', 'gdpr', 'consenso', 'gdprconsent', 'consensogdpr',
              'trattamentodati', 'consensoprivacy', 'consensodati', 'trattamentopersonale'],
  },
  {
    key: 'gdprDate', label: 'Data accettazione privacy',
    aliases: ['datagdpr', 'gdprdate', 'dataconsenso', 'dataaccettazioneprivacy',
              'dataprivacy', 'datatrattamento', 'dataaccettazione'],
  },
  {
    key: 'notes', label: 'Note',
    aliases: ['note', 'notes', 'nota', 'commento', 'comments', 'osservazioni', 'annotazioni', 'descrizione'],
  },
  {
    key: 'allergies', label: 'Allergie',
    aliases: ['allergie', 'allergies', 'allergia', 'controindicazioni', 'intolleranze',
              'sensibilita', 'allergieeintolleranze'],
  },
  {
    key: 'tags', label: 'Tag / Etichette',
    aliases: ['tag', 'tags', 'etichette', 'label', 'labels', 'categoria', 'categorie', 'gruppi', 'gruppo'],
  },
  {
    key: 'visitFrequency', label: 'Frequenza visite',
    aliases: ['frequenza', 'visitfrequency', 'frequenzavisita', 'frequenzapassaggi', 'tipofrequenza'],
  },
  {
    key: 'lastVisitDate', label: 'Ultimo passaggio',
    aliases: ['ultimopassaggio', 'lastvisitdate', 'ultimavisita', 'dataultimopalmento',
              'datapassaggio', 'ultimadata', 'datasaloon', 'lastvisit', 'ultimoaccesso'],
  },
  {
    key: 'totalVisits', label: 'N° passaggi totali',
    aliases: ['passaggi', 'totalvisits', 'npassaggi', 'numeropassaggi', 'visitazioni',
              'numeraccessi', 'numerovisite', 'totalvisite', 'nropassaggi'],
  },
  {
    key: 'totalRevenue', label: 'Fatturato totale',
    aliases: ['fatturato', 'totalrevenue', 'fatturatocomplessivo', 'fatturatopieno',
              'totaleacquisti', 'spesatotale', 'spesa', 'revenue', 'turnover', 'importototale'],
  },
];

/** Auto-match a CSV column header to a TargetField key. Returns `__ignore__` if no match. */
export function autoMatch(csvHeader: string): FieldKey {
  const norm = normalizeHeader(csvHeader);
  // Exact match first
  for (const tf of TARGET_FIELDS) {
    if (tf.key === '__ignore__') continue;
    if (tf.aliases.includes(norm)) return tf.key;
  }
  // Substring match (norm contains alias or alias contains norm)
  for (const tf of TARGET_FIELDS) {
    if (tf.key === '__ignore__') continue;
    if (tf.aliases.some(a => norm.includes(a) || a.includes(norm))) return tf.key;
  }
  return '__ignore__';
}

// ─── Data normalization ───────────────────────────────────────────────────────

/** Remove internal whitespace from a phone number, preserve the rest (e.g. +39). */
export function normalizePhone(raw: string): string {
  return raw.replace(/\s+/g, '').trim();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Returns true if the email has a valid format. */
export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}

const ITALIAN_MONTHS: Record<string, string> = {
  gennaio: '01', febbraio: '02', marzo: '03', aprile: '04',
  maggio: '05', giugno: '06', luglio: '07', agosto: '08',
  settembre: '09', ottobre: '10', novembre: '11', dicembre: '12',
};

/**
 * Try to normalize a date string to `YYYY-MM-DD`.
 * Handles: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, "18 aprile 2025", "18 aprile 2025 - 15:36".
 * Returns the original string unchanged if the format is unrecognized.
 */
export function normalizeDate(raw: string): string {
  if (!raw) return '';
  const s = raw.trim();
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  // "18 aprile 2025" or "18 aprile 2025 - 15:36"
  const italian = s.toLowerCase().match(/^(\d{1,2})\s+([a-z]+)\s+(\d{4})/);
  if (italian) {
    const month = ITALIAN_MONTHS[italian[2]];
    if (month) return `${italian[3]}-${month}-${italian[1].padStart(2, '0')}`;
  }
  return s; // return as-is; caller may display a warning
}

/** Normalize gender string: M/F/Maschio/Femmina/Male/Female → `'M'|'F'|''`. */
export function normalizeGender(raw: string): ClientGender {
  const s = raw.trim().toLowerCase();
  if (['m', 'maschio', 'male', 'uomo', 'h', 'homme', 'man'].includes(s)) return 'M';
  if (['f', 'femmina', 'female', 'donna', 'femme', 'woman'].includes(s)) return 'F';
  return '';
}

const ACQSRC_MAP: Record<string, AcquisitionSource> = {
  passaparola: 'passaparola', 'word of mouth': 'passaparola', wordofmouth: 'passaparola', amici: 'passaparola',
  social: 'social', instagram: 'social', facebook: 'social', tiktok: 'social', socialmedia: 'social',
  google: 'google', googlemybusiness: 'google', ricercaweb: 'google',
  volantino: 'volantino', flyer: 'volantino', affissione: 'volantino', locandina: 'volantino',
  sito: 'sito_web', sitoweb: 'sito_web', website: 'sito_web', web: 'sito_web', internet: 'sito_web', online: 'sito_web',
  evento: 'evento', event: 'evento', fiera: 'evento', sagra: 'evento',
};

/** Normalize acquisition source string to the AcquisitionSource enum. Returns `''` if empty. */
export function normalizeAcqSource(raw: string): AcquisitionSource {
  if (!raw.trim()) return '';
  const k = normalizeHeader(raw);
  return ACQSRC_MAP[k] ?? 'altro';
}

// ─── Column mapping ───────────────────────────────────────────────────────────

/** Maps each CSV column header to a TargetField key. */
export type ColumnMapping = Record<string, FieldKey>;

// ─── Row processing ───────────────────────────────────────────────────────────

export interface ParsedRow {
  record: Omit<Client, 'id' | 'createdAt'>;
  warnings: string[]; // human-readable per-row warning messages
  rowIndex: number;   // 1-based row number (2 = first data row, after header)
}

/**
 * Apply the column mapping to one CSV data row and return a Client record.
 * Runs normalization (phone, email, date, gender) and validation (email format).
 * Does NOT check for duplicates — caller handles that.
 */
export function processRow(
  cols: string[],
  headers: string[],
  mapping: ColumnMapping,
  rowIndex: number,
): ParsedRow {
  const warnings: string[] = [];

  /** Get the raw value of the CSV column mapped to `fieldKey`, trimmed. */
  const get = (fieldKey: FieldKey): string => {
    const hdr = headers.find(h => mapping[h] === fieldKey);
    if (!hdr) return '';
    const idx = headers.indexOf(hdr);
    return (cols[idx] ?? '').trim();
  };

  const phone = normalizePhone(get('phone'));
  const emailRaw = get('email').toLowerCase().trim();
  const birthDate = normalizeDate(get('birthDate'));
  const acqDate = normalizeDate(get('acquisitionDate'));
  const gdprDateRaw = normalizeDate(get('gdprDate'));
  const gdprRaw = get('gdprConsent').toLowerCase();
  const gdprConsent = ['sì', 'si', 'yes', 'true', '1', 'ok', 'accettato', 'consenso'].includes(gdprRaw);
  const acqSrcRaw = get('acquisitionSource');
  const tagsRaw = get('tags');

  // Nuovi campi statistiche
  const lastVisitDateRaw = normalizeDate(get('lastVisitDate'));
  const totalVisitsRaw = get('totalVisits');
  const totalRevenueRaw = get('totalRevenue').replace(/[€$,\s]/g, '').replace(',', '.');
  const visitFrequencyRaw = get('visitFrequency').trim();

  if (emailRaw && !isValidEmail(emailRaw)) {
    warnings.push(`Riga ${rowIndex}: email "${emailRaw}" non valida — verrà importata comunque`);
  }

  return {
    rowIndex,
    warnings,
    record: {
      firstName: get('firstName'),
      lastName: get('lastName'),
      phone,
      email: emailRaw,
      birthDate,
      gender: normalizeGender(get('gender')),
      address: get('address'),
      city: get('city'),
      province: get('province').toUpperCase().slice(0, 2),
      postalCode: get('postalCode'),
      acquisitionSource: acqSrcRaw ? normalizeAcqSource(acqSrcRaw) : '',
      acquisitionDate: acqDate,
      loyaltyPoints: Number(get('loyaltyPoints')) || 0,
      gdprConsent,
      gdprDate: gdprConsent ? (gdprDateRaw || new Date().toISOString().slice(0, 10)) : '',
      notes: get('notes'),
      allergies: get('allergies'),
      tags: tagsRaw ? tagsRaw.split(/[|,;]/).map(t => t.trim()).filter(Boolean) : [],
      ...(visitFrequencyRaw ? { visitFrequency: visitFrequencyRaw } : {}),
      ...(lastVisitDateRaw ? { lastVisitDate: lastVisitDateRaw } : {}),
      ...(totalVisitsRaw ? { totalVisits: Math.round(Math.abs(Number(totalVisitsRaw))) || undefined } : {}),
      ...(totalRevenueRaw ? { totalRevenue: parseFloat(totalRevenueRaw) || undefined } : {}),
    },
  };
}

// ─── Import profiles ──────────────────────────────────────────────────────────

export interface ImportProfile {
  id: string;
  name: string;
  mapping: ColumnMapping;
  createdAt: string; // ISO
}

const profilesKey = (salonId: string) => `import_profiles_${salonId}`;

export function loadImportProfiles(salonId: string): ImportProfile[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(profilesKey(salonId)) ?? '[]');
  } catch {
    return [];
  }
}

export function saveImportProfile(salonId: string, profile: ImportProfile): void {
  const profiles = loadImportProfiles(salonId);
  const idx = profiles.findIndex(p => p.id === profile.id);
  if (idx >= 0) profiles[idx] = profile;
  else profiles.push(profile);
  localStorage.setItem(profilesKey(salonId), JSON.stringify(profiles));
}

export function deleteImportProfile(salonId: string, id: string): void {
  const profiles = loadImportProfiles(salonId).filter(p => p.id !== id);
  localStorage.setItem(profilesKey(salonId), JSON.stringify(profiles));
}
