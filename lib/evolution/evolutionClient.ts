/**
 * WAHA (WhatsApp HTTP API) client — replaces Evolution API
 *
 * WAHA Core supports only a single "default" session.
 * All instanceName parameters are accepted for interface compatibility
 * but are ignored — every call targets the "default" session.
 *
 * Env vars (same names as before, no Vercel changes needed):
 *   EVOLUTION_API_URL   — Railway WAHA URL
 *   EVOLUTION_API_KEY   — WAHA_API_KEY value
 */

const SESSION = 'default';

const BASE_URL = (): string | null => {
  const url = process.env.EVOLUTION_API_URL;
  return url ? url.replace(/\/$/, '') : null;
};

const API_KEY = (): string | null => process.env.EVOLUTION_API_KEY ?? null;

function headers(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Api-Key': API_KEY() ?? '',
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EvolutionInstance {
  instanceName: string;
  connectionStatus: string; // 'WORKING' | 'STARTING' | 'STOPPED' | 'SCAN_QR_CODE' | 'FAILED'
  profileName?: string;
  ownerJid?: string;
}

export interface EvolutionQRCode {
  base64: string;
  code?: string;
}

export interface EvolutionCreateResult {
  instance: EvolutionInstance;
  qrcode?: EvolutionQRCode;
}

// ─── fetchInstance ────────────────────────────────────────────────────────────

/**
 * Returns the WAHA default session state, or null if unreachable.
 * The `_instanceName` parameter is ignored — WAHA Core uses "default" only.
 */
export async function fetchInstance(_instanceName: string): Promise<EvolutionInstance | null> {
  try {
    const base = BASE_URL();
    if (!base) return null;
    const res = await fetch(`${base}/api/sessions/${SESSION}`, {
      headers: headers(),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    const me = data.me as Record<string, unknown> | null | undefined;
    return {
      instanceName: SESSION,
      connectionStatus: (data.status as string) ?? 'STOPPED',
      profileName: me?.pushName as string | undefined,
      ownerJid: me?.id as string | undefined,
    };
  } catch {
    return null;
  }
}

// ─── createInstance ───────────────────────────────────────────────────────────

/**
 * Starts the WAHA default session (creates it if not yet running).
 */
export async function createInstance(_instanceName: string): Promise<EvolutionCreateResult | null> {
  try {
    const base = BASE_URL();
    if (!base) return null;
    const res = await fetch(`${base}/api/sessions/${SESSION}/start`, {
      method: 'POST',
      headers: headers(),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    return {
      instance: {
        instanceName: SESSION,
        connectionStatus: (data.status as string) ?? 'STARTING',
      },
    };
  } catch {
    return null;
  }
}

// ─── getQRCode ────────────────────────────────────────────────────────────────

/**
 * Fetches the QR code image from WAHA and returns it as a base64 data URI.
 * WAHA returns a PNG binary for GET /api/{session}/auth/qr.
 */
export async function getQRCode(_instanceName: string, retries = 8): Promise<EvolutionQRCode | null> {
  const base = BASE_URL();
  if (!base) return null;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`${base}/api/${SESSION}/auth/qr`, {
        headers: { 'X-Api-Key': API_KEY() ?? '' },
        cache: 'no-store',
      });
      if (!res.ok) {
        if (i < retries - 1) await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      const contentType = res.headers.get('content-type') ?? '';
      if (contentType.includes('image/')) {
        const buf = await res.arrayBuffer();
        const b64 = Buffer.from(buf).toString('base64');
        return { base64: `data:image/png;base64,${b64}` };
      }
      // Fallback: JSON response with value field
      const data = (await res.json()) as Record<string, unknown>;
      if (data.value) return { base64: data.value as string };
    } catch {
      // session not ready yet — retry
    }
    if (i < retries - 1) await new Promise(r => setTimeout(r, 2000));
  }
  return null;
}

// ─── sendTextMessage ──────────────────────────────────────────────────────────

/**
 * Sends a plain-text WhatsApp message via WAHA.
 * `phone` must be in international format without '+', e.g. "393331234567".
 */
export async function sendTextMessage(
  _instanceName: string,
  phone: string,
  message: string,
): Promise<boolean> {
  try {
    const base = BASE_URL();
    if (!base) return false;
    const chatId = phone.includes('@') ? phone : `${phone}@c.us`;
    const res = await fetch(`${base}/api/sendText`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ session: SESSION, chatId, text: message }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── disconnectInstance ───────────────────────────────────────────────────────

/**
 * Stops the WAHA default session (logs out WhatsApp).
 */
export async function disconnectInstance(_instanceName: string): Promise<boolean> {
  try {
    const base = BASE_URL();
    if (!base) return false;
    const res = await fetch(`${base}/api/sessions/${SESSION}/stop`, {
      method: 'POST',
      headers: headers(),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── deleteInstance ───────────────────────────────────────────────────────────

/**
 * Alias for disconnectInstance — WAHA Core has no per-session delete.
 */
export async function deleteInstance(_instanceName: string): Promise<boolean> {
  return disconnectInstance(_instanceName);
}
