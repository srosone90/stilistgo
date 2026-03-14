/**
 * GDPR: Esportazione e cancellazione dati cliente
 *
 * GET  /api/salon-gdpr?clientId=<id>    → esporta dati cliente in JSON
 * DELETE /api/salon-gdpr                → elimina definitivamente un cliente
 *        body: { clientId: string }
 *
 * Autenticazione: il client invia il proprio access_token come Bearer.
 * Il server lo verifica localmente decodificando il JWT (Node.js crypto built-in)
 * senza fare chiamate di rete verso Supabase, il che evita problemi con
 * la publishable key (sb_publishable_*) che restituisce 403 su /auth/v1/user.
 * Se SUPABASE_JWT_SECRET è configurato, la firma HMAC-SHA256 viene verificata.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { getAdminDb } from '@/lib/adminAuth';

/**
 * Estrae e verifica l'user_id dal token JWT Bearer.
 * - Verifica firma HMAC-SHA256 se SUPABASE_JWT_SECRET è disponibile.
 * - Controlla sempre la scadenza (exp claim).
 * - Nessuna chiamata di rete → funziona con qualsiasi formato di apikey.
 */
function getUserIdFromRequest(req: NextRequest): string | null {
  try {
    const authHeader = req.headers.get('authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) return null;

    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, payload, signature] = parts;

    // Verify HMAC-SHA256 signature if secret is available
    const jwtSecret = process.env.SUPABASE_JWT_SECRET;
    if (jwtSecret) {
      const expected = createHmac('sha256', jwtSecret)
        .update(`${header}.${payload}`)
        .digest('base64url');
      if (expected !== signature) return null;
    }

    // Decode payload
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as {
      sub?: string;
      exp?: number;
      aud?: string;
    };

    // Check expiry
    if (!decoded.exp || decoded.exp < Math.floor(Date.now() / 1000)) return null;

    // Must have a valid UUID sub
    if (!decoded.sub || typeof decoded.sub !== 'string') return null;

    return decoded.sub;
  } catch {
    return null;
  }
}

// ── GET: esporta tutti i dati di un cliente ─────────────────────────────────
export async function GET(req: NextRequest) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const clientId = req.nextUrl.searchParams.get('clientId');
  if (!clientId) return NextResponse.json({ error: 'clientId richiesto' }, { status: 400 });

  const admin = getAdminDb();
  const { data, error } = await admin
    .from('salon_data')
    .select('state')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return NextResponse.json({ error: 'Dati non trovati' }, { status: 404 });

  const state = data.state as Record<string, unknown>;
  const clients = (state.clients as { id: string }[]) ?? [];
  const appointments = (state.appointments as { clientId: string }[]) ?? [];
  const technicalCards = (state.technicalCards as { clientId: string }[]) ?? [];
  const cashEntries = (state.cashEntries as { clientId?: string }[]) ?? [];

  const client = clients.find(c => c.id === clientId);
  if (!client) return NextResponse.json({ error: 'Cliente non trovato' }, { status: 404 });

  const exportData = {
    exportedAt: new Date().toISOString(),
    exportedBy: userId,
    gdprNote: 'Esportazione dati ai sensi del Regolamento UE 2016/679 (GDPR) — Art. 20 Portabilità dei dati',
    client,
    appointments: appointments.filter(a => a.clientId === clientId),
    technicalCards: technicalCards.filter(c => c.clientId === clientId),
    cashEntries: cashEntries.filter(e => e.clientId === clientId),
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="cliente_${clientId}_gdpr_export.json"`,
    },
  });
}

// ── DELETE: eliminazione definitiva cliente ─────────────────────────────────
export async function DELETE(req: NextRequest) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const clientId: string = body?.clientId;
  if (!clientId) return NextResponse.json({ error: 'clientId richiesto' }, { status: 400 });

  const admin = getAdminDb();
  const { data, error } = await admin
    .from('salon_data')
    .select('state')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return NextResponse.json({ error: 'Dati non trovati' }, { status: 404 });

  const state = data.state as Record<string, unknown>;
  const clients = (state.clients as { id: string }[]) ?? [];

  if (!clients.find(c => c.id === clientId)) {
    return NextResponse.json({ error: 'Cliente non trovato' }, { status: 404 });
  }

  // Rimozione fisica di tutti i record collegati
  const newState = {
    ...state,
    clients: (state.clients as { id: string }[]).filter(c => c.id !== clientId),
    appointments: (state.appointments as { clientId: string }[]).filter(a => a.clientId !== clientId),
    technicalCards: (state.technicalCards as { clientId: string }[]).filter(c => c.clientId !== clientId),
    cashEntries: (state.cashEntries as { clientId?: string }[]).map(e =>
      e.clientId === clientId ? { ...e, clientId: undefined } : e
    ),
  };

  const { error: saveError } = await admin
    .from('salon_data')
    .update({ state: newState, updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  if (saveError) return NextResponse.json({ error: saveError.message }, { status: 500 });

  // Log evento cancellazione (best-effort)
  try {
    await admin.from('security_events').insert({
      user_id: userId,
      event_type: 'data_delete',
      metadata: { clientId, reason: 'gdpr_erasure_request' },
    });
  } catch { /* non-critical */ }

  return NextResponse.json({ ok: true, deletedClientId: clientId });
}

// ── POST: registra accettazione consenso GDPR del tenant ───────────────────
export async function POST(req: NextRequest) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const { tosVersion = '1.0', dpaVersion = '1.0' } = body ?? {};

  const admin = getAdminDb();

  const { error } = await admin
    .from('admin_tenants')
    .update({
      legal_consents: {
        tos: { version: tosVersion, accepted_at: new Date().toISOString() },
        dpa: { version: dpaVersion, accepted_at: new Date().toISOString() },
      },
    })
    .eq('user_id', userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Log evento (best-effort)
  try {
    await admin.from('security_events').insert({
      user_id: userId,
      event_type: 'consent',
      metadata: { tosVersion, dpaVersion },
    });
  } catch { /* non-critical */ }

  return NextResponse.json({ ok: true });
}
