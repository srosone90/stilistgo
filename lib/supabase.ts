import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

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

// ─── Fallback local auth (when Supabase is unreachable) ───────────────────────
const LOCAL_USER_KEY = 'leribelle_local_user';

interface LocalUser {
  id: string;
  email: string;
  full_name: string;
  user_metadata: { full_name: string };
}

function getLocalUser(): LocalUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LOCAL_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function setLocalUser(user: LocalUser) {
  localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user));
}

function clearLocalUser() {
  localStorage.removeItem(LOCAL_USER_KEY);
}

// ─── Connectivity probe (cached) ─────────────────────────────────────────────
// Stato: null = non ancora testato, true/false = risultato cachato
let _supabaseReachable: boolean | null = null;

async function isSupabaseReachable(): Promise<boolean> {
  if (_supabaseReachable !== null) return _supabaseReachable;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${supabaseUrl}/auth/v1/health`, {
      headers: { apikey: supabaseAnonKey },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    _supabaseReachable = res.ok;
  } catch {
    _supabaseReachable = false;
  }
  return _supabaseReachable;
}

export function resetSupabaseReachable() {
  _supabaseReachable = null;
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function localSignUp(email: string, password: string, fullName: string) {
  const existingUsers = JSON.parse(localStorage.getItem('leribelle_users') || '[]') as (LocalUser & { password: string })[];
  if (existingUsers.find(u => u.email === email)) {
    return { data: null, error: { message: 'Email già registrata in locale.' } };
  }
  const newUser: LocalUser = {
    id: `local-${Date.now()}`,
    email,
    full_name: fullName,
    user_metadata: { full_name: fullName },
  };
  localStorage.setItem('leribelle_users', JSON.stringify([...existingUsers, { ...newUser, password }]));
  setLocalUser(newUser);
  return { data: { session: { user: newUser }, user: newUser }, error: null };
}

export async function signUp(email: string, password: string, fullName: string) {
  // Chiama la route server-side sicura (la service key non è mai esposta al browser)
  try {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, fullName }),
    });
    const json = await res.json();

    // flag offline → Supabase non raggiungibile → fallback locale
    if (json.offline) {
      return localSignUp(email, password, fullName);
    }

    if (!res.ok) {
      return { data: null, error: { message: json.error || 'Errore durante la registrazione.' } };
    }

    // Utente creato e confermato → accedi subito
    return await signIn(email, password);
  } catch {
    // fetch ha lanciato eccezione (Supabase non raggiungibile) → fallback locale
    return localSignUp(email, password, fullName);
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

  if (online) {
    // Supabase è raggiungibile: prova login cloud
    try {
      const result = await supabase.auth.signInWithPassword({ email, password });
      if (!result.error) return result;                              // ✅ successo
      if (!isNetworkError(result.error.message)) return result;     // ❌ errore reale (es. password sbagliata)
      // errore di rete inaspettato → aggiorna cache e caduta al fallback
      _supabaseReachable = false;
    } catch {
      _supabaseReachable = false;
    }
  }

  // Supabase offline → fallback utenti locali
  const users = JSON.parse(localStorage.getItem('leribelle_users') || '[]') as (LocalUser & { password: string })[];
  const user = users.find(u => u.email === email && u.password === password);
  if (user) {
    const { password: _pw, ...safeUser } = user;
    setLocalUser(safeUser as LocalUser);
    return { data: { session: { user: safeUser }, user: safeUser }, error: null };
  }

  if (!online) {
    return { data: null, error: { message: 'Server non raggiungibile. Verifica la connessione.' } };
  }
  return { data: null, error: { message: 'Email o password non corretti.' } };
}

export async function signOut() {
  clearLocalUser();
  try {
    return await supabase.auth.signOut();
  } catch {
    return { error: null };
  }
}

export async function getCurrentUser() {
  const online = await isSupabaseReachable();
  if (online) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) return user;
    } catch { /* ignora */ }
  }
  // Fallback sessione locale
  const local = getLocalUser();
  return local as unknown as ReturnType<typeof supabase.auth.getUser> extends Promise<{ data: { user: infer U } }> ? U : null;
}
