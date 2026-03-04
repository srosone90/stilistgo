/**
 * GDPR: Esportazione e cancellazione dati cliente
 *
 * GET  /api/salon-gdpr?clientId=<id>    → esporta dati cliente in JSON
 * DELETE /api/salon-gdpr                → elimina definitivamente un cliente
 *        body: { clientId: string }
 *
 * Autenticazione: sessione Supabase (anon key + RLS).
 * Il salon_id è derivato dalla sessione, quindi un utente
 * può operare SOLO sui propri clienti.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : undefined
  );
}

// ── GET: esporta tutti i dati di un cliente ─────────────────────────────────
export async function GET(req: NextRequest) {
  const supabase = getSupabaseFromRequest(req);
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id ?? null;
  if (!userId) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const clientId = req.nextUrl.searchParams.get('clientId');
  if (!clientId) return NextResponse.json({ error: 'clientId richiesto' }, { status: 400 });

  const { data, error } = await supabase
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
  const supabase = getSupabaseFromRequest(req);
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id ?? null;
  if (!userId) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const clientId: string = body?.clientId;
  if (!clientId) return NextResponse.json({ error: 'clientId richiesto' }, { status: 400 });

  const { data, error } = await supabase
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

  const { error: saveError } = await supabase
    .from('salon_data')
    .update({ state: newState, updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  if (saveError) return NextResponse.json({ error: saveError.message }, { status: 500 });

  // Log evento cancellazione (best-effort)
  try {
    await supabase.from('security_events').insert({
      user_id: userId,
      event_type: 'data_delete',
      metadata: { clientId, reason: 'gdpr_erasure_request' },
    });
  } catch { /* non-critical */ }

  return NextResponse.json({ ok: true, deletedClientId: clientId });
}

// ── POST: registra accettazione consenso GDPR del tenant ───────────────────
export async function POST(req: NextRequest) {
  const supabase = getSupabaseFromRequest(req);
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id ?? null;
  if (!userId) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const { tosVersion = '1.0', dpaVersion = '1.0' } = body ?? {};

  // Usa la service_role per aggiornare admin_tenants (su cui non c'è RLS utente)
  const { createClient: createServiceClient } = await import('@supabase/supabase-js');
  const serviceDb = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { error } = await serviceDb
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
    await supabase.from('security_events').insert({
      user_id: userId,
      event_type: 'consent',
      metadata: { tosVersion, dpaVersion },
    });
  } catch { /* non-critical */ }

  return NextResponse.json({ ok: true });
}
