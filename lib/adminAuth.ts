/**
 * Server-side only admin auth helpers.
 * Token is a stateless HMAC — no DB needed.
 * Valid for 8 hours, created from ADMIN_PASSWORD.
 */
import { createHmac } from 'crypto';

function getSecret() {
  return process.env.ADMIN_PASSWORD ?? 'changeme';
}

/** Generate a token valid for the current 1-hour bucket (and the next 7). */
export function generateAdminToken(): string {
  const bucket = Math.floor(Date.now() / (1000 * 3600));
  return createHmac('sha256', getSecret()).update(`admin:${bucket}`).digest('hex');
}

/** Verify a token — valid if it matches any of the last 8 hourly buckets. */
export function verifyAdminToken(token: string): boolean {
  if (!token) return false;
  const bucket = Math.floor(Date.now() / (1000 * 3600));
  for (let offset = 0; offset < 8; offset++) {
    const expected = createHmac('sha256', getSecret())
      .update(`admin:${bucket - offset}`)
      .digest('hex');
    if (token === expected) return true;
  }
  return false;
}

/** Extract and verify token from Authorization header: "Bearer <token>" */
export function verifyAdminRequest(authHeader: string | null): boolean {
  if (!authHeader?.startsWith('Bearer ')) return false;
  return verifyAdminToken(authHeader.slice(7));
}

/** A Supabase admin client (server-side only). */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
let _adminDb: SupabaseClient | null = null;
export function getAdminDb(): SupabaseClient {
  // Sempre ricrea il client (no singleton) per evitare cache della chiave errata
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const sk = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!sk) {
    console.error('[adminAuth] SUPABASE_SERVICE_ROLE_KEY mancante.');
  }
  const key = sk ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!_adminDb) {
    _adminDb = createClient(url, key);
  }
  return _adminDb;
}
