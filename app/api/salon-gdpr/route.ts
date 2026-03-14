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
import { createClient } from '@supabase/supabase-js';

/**
 * Estrae e verifica l'user_id dal token JWT Bearer — nessuna chiamata di rete.
 * Verifica firma HMAC-SHA256 se SUPABASE_JWT_SECRET è disponibile.
 */
function getUserIdFromRequest(req: NextRequest): string | null {
  try {
    const authHeader = req.headers.get('authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) return null;

    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, payload, signature] = parts;

    const jwtSecret = process.env.SUPABASE_JWT_SECRET;
    if (jwtSecret) {
      const expected = createHmac('sha256', jwtSecret)
        .update(`${header}.${payload}`)
        .digest('base64url');
      if (expected !== signature) return null;
    }

    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as {
      sub?: string; exp?: number;
    };
    if (!decoded.exp || decoded.exp < Math.floor(Date.now() / 1000)) return null;
    if (!decoded.sub || typeof decoded.sub !== 'string') return null;
    return decoded.sub;
  } catch {
    return null;
  }
}

/**
 * Crea un client Supabase autenticato come l'utente, passando il suo JWT
 * come Authorization header. PostgREST lo usa direttamente per RLS
 * (auth.uid() = sub del token) senza passare per GoTrue.
 * Non richiede SUPABASE_SERVICE_ROLE_KEY.
 */
function getUserClient(req: NextRequest) {
  const url  = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/^\uFEFF/, '').trim();
  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').replace(/^\uFEFF/, '').trim();
  const authHeader = req.headers.get('authorization') ?? '';
  return createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ── GET: esporta tutti i dati di un cliente ─────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

    const clientId = req.nextUrl.searchParams.get('clientId');
    if (!clientId) return NextResponse.json({ error: 'clientId richiesto' }, { status: 400 });

    const db = getUserClient(req);
    const { data, error } = await db
      .from('salon_data')
      .select('state')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) return NextResponse.json({ error: `Dati non trovati: ${error?.message ?? 'nessun record'}` }, { status: 404 });

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
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Errore interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ── DELETE: eliminazione definitiva cliente ─────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

    const body = await req.json().catch(() => null);
    const clientId: string = body?.clientId;
    if (!clientId) return NextResponse.json({ error: 'clientId richiesto' }, { status: 400 });

    const db = getUserClient(req);
    const { data, error } = await db
      .from('salon_data')
      .select('state')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) return NextResponse.json({ error: `Dati non trovati: ${error?.message ?? 'nessun record'}` }, { status: 404 });

    const state = data.state as Record<string, unknown>;
    const clients = (state.clients as { id: string }[]) ?? [];

    if (!clients.find(c => c.id === clientId)) {
      return NextResponse.json({ error: 'Cliente non trovato' }, { status: 404 });
    }

    const newState = {
      ...state,
      clients: ((state.clients as { id: string }[]) ?? []).filter(c => c.id !== clientId),
      appointments: ((state.appointments as { clientId: string }[]) ?? []).filter(a => a.clientId !== clientId),
      technicalCards: ((state.technicalCards as { clientId: string }[]) ?? []).filter(c => c.clientId !== clientId),
      cashEntries: ((state.cashEntries as { clientId?: string }[]) ?? []).map(e =>
        e.clientId === clientId ? { ...e, clientId: undefined } : e
      ),
    };

    const { error: saveError } = await db
      .from('salon_data')
      .update({ state: newState, updated_at: new Date().toISOString() })
      .eq('user_id', userId);

    if (saveError) return NextResponse.json({ error: saveError.message }, { status: 500 });

    return NextResponse.json({ ok: true, deletedClientId: clientId });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Errore interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ── POST: registra accettazione consenso GDPR del tenant ───────────────────
export async function POST(req: NextRequest) {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

    const body = await req.json().catch(() => null);
    const { tosVersion = '1.0', dpaVersion = '1.0' } = body ?? {};

    const db = getUserClient(req);
    const { error } = await db
      .from('admin_tenants')
      .update({
        legal_consents: {
          tos: { version: tosVersion, accepted_at: new Date().toISOString() },
          dpa: { version: dpaVersion, accepted_at: new Date().toISOString() },
        },
      })
      .eq('user_id', userId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Errore interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
