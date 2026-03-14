import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim();
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();

// Client lazy — non viene creato a livello di modulo per evitare crash SSR
// se le env var non sono ancora disponibili durante il prerendering
let _supabase: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!_supabase) {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Variabili NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY non configurate.');
    }
    _supabase = createClient(supabaseUrl, supabaseAnonKey);
  }
  return _supabase;
}

// Alias per compatibilità con i posti che importano { supabase }
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabaseClient() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

// ─── Connectivity probe (cached) ─────────────────────────────────────────────
// Only the POSITIVE result is cached: once we know Supabase is reachable we
// keep that knowledge for the session. A negative result (unreachable) is
// never cached so the next call will retry — avoids locking into offline mode
// if Supabase was briefly down at startup.

let _supabaseReachable: boolean | null = null;

async function isSupabaseReachable(): Promise<boolean> {
  if (_supabaseReachable === true) return true; // only cache positive result
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${supabaseUrl}/auth/v1/health`, {
      headers: { apikey: supabaseAnonKey },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.ok) _supabaseReachable = true;
    return res.ok;
  } catch {
    return false; // not cached — will retry next call
  }
}

export function resetSupabaseReachable() {
  _supabaseReachable = null;
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

export async function signUp(email: string, password: string, fullName: string) {
  // Calls the secure server-side route (service key never exposed to browser)
  try {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, fullName }),
    });
    const json = await res.json();

    if (!res.ok) {
      // json.offline = true when the API route itself couldn't reach Supabase
      if (json.offline) {
        return { data: null, error: { message: 'Server non raggiungibile. Verifica la connessione e riprova.' } };
      }
      return { data: null, error: { message: json.error || 'Errore durante la registrazione.' } };
    }

    // Account created — confirmation email sent via Resend
    return { data: { session: null, user: json.user, check_email: true }, error: null };
  } catch {
    return { data: null, error: { message: 'Impossibile contattare il server. Verifica la connessione.' } };
  }
}

function isNetworkError(msg: string) {
  return (
    msg.includes('fetch') ||
    msg.includes('network') ||
    msg.includes('Failed to fetch') ||
    msg.includes('ERR_') ||
    msg.includes('ENOTFOUND') ||
    msg.includes('NetworkError') ||
    msg.includes('Load failed')    // Safari
  );
}

export async function signIn(email: string, password: string) {
  const online = await isSupabaseReachable();

  if (!online) {
    return { data: null, error: { message: 'Server non raggiungibile. Verifica la connessione e riprova.' } };
  }

  try {
    const result = await supabase.auth.signInWithPassword({ email, password });
    if (!result.error) return result;                          // ✅ successo
    if (!isNetworkError(result.error.message)) return result;  // ❌ credenziali errate
    // unexpected network error during the request
    return { data: null, error: { message: 'Errore di rete durante il login. Riprova.' } };
  } catch {
    return { data: null, error: { message: 'Impossibile contattare il server. Verifica la connessione.' } };
  }
}

export async function signOut() {
  try {
    return await supabase.auth.signOut();
  } catch {
    return { error: null };
  }
}

export async function getCurrentUser() {
  // 1. Read Supabase session from the SDK's built-in localStorage token (instant)
  //    This is the most reliable path for an already-logged-in user on page reload.
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) return session.user;
  } catch { /* ignore */ }

  // 2. Validate token with server (covers edge cases like token refresh)
  const online = await isSupabaseReachable();
  if (online) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) return user;
    } catch { /* ignore */ }
  }

  // No valid session — user must log in.
  return null;
}
