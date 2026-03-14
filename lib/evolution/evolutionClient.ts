/**
 * Evolution API client (self-hosted on Railway)
 *
 * Each salon has its own instance named after the salon's user_id
 * (hyphens replaced with underscores for URL safety).
 *
 * Env vars:
 *   EVOLUTION_API_URL  — Railway public URL, e.g. https://evolution-api-xxxx.up.railway.app
 *   EVOLUTION_API_KEY  — same as AUTHENTICATION_API_KEY on Railway
 */

function BASE(): string {
  return (process.env.EVOLUTION_API_URL ?? '').replace(/\/$/, '');
}

function API_KEY(): string {
  return process.env.EVOLUTION_API_KEY ?? '';
}

function headers(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'apikey': API_KEY(),
  };
}

// ─── instanceNameFor ──────────────────────────────────────────────────────────

/** Derives the Evolution API instance name from a salon user_id (UUID). */
export function instanceNameFor(userId: string): string {
  return userId.replace(/-/g, '_');
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConnectionState = 'open' | 'connecting' | 'close';

export interface EvolutionInstance {
  instanceName: string;
  connectionStatus: ConnectionState;
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
 * Returns the connection state of the given Evolution API instance.
 */
export async function fetchInstance(instanceName: string): Promise<EvolutionInstance | null> {
  const base = BASE();
  if (!base) return null;
  try {
    const res = await fetch(`${base}/instance/connectionState/${instanceName}`, {
      headers: headers(),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    const inst = (data.instance as Record<string, unknown>) ?? data;
    return {
      instanceName,
      connectionStatus: (inst.state as ConnectionState) ?? 'close',
      ownerJid: inst.ownerJid as string | undefined,
    };
  } catch {
    return null;
  }
}

// ─── createInstance ───────────────────────────────────────────────────────────

/**
 * Creates a new Evolution API instance for a salon.
 * Instance name is deterministic: instanceNameFor(userId).
 */
export async function createInstance(instanceName: string): Promise<EvolutionCreateResult | null> {
  const base = BASE();
  if (!base) return null;
  try {
    const res = await fetch(`${base}/instance/create`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ instanceName, qrcode: true, integration: 'WHATSAPP-BAILEYS' }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    const inst = (data.instance as Record<string, unknown>) ?? {};
    const qr = data.qrcode as Record<string, unknown> | undefined;
    return {
      instance: {
        instanceName,
        connectionStatus: (inst.status as ConnectionState) ?? 'connecting',
      },
      qrcode: qr ? { base64: qr.base64 as string, code: qr.code as string | undefined } : undefined,
    };
  } catch {
    return null;
  }
}

// ─── listPhones ───────────────────────────────────────────────────────────────

/** Lists all instances in the Evolution API server. */
export async function listPhones(): Promise<string[]> {
  const base = BASE();
  if (!base) return [];
  try {
    const res = await fetch(`${base}/instance/fetchInstances`, {
      headers: headers(),
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const data = (await res.json()) as unknown;
    const list = Array.isArray(data) ? data : [];
    return list
      .map((p: Record<string, unknown>) => {
        const inst = p.instance as Record<string, unknown> | undefined;
        return String(inst?.instanceName ?? p.instanceName ?? '');
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

// ─── getQRCode ────────────────────────────────────────────────────────────────

/**
 * Fetches the QR code for an instance that is not yet connected.
 * Calls GET /instance/connect/{instanceName}.
 */
export async function getQRCode(instanceName: string, retries = 8): Promise<EvolutionQRCode | null> {
  const base = BASE();
  if (!base) return null;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`${base}/instance/connect/${instanceName}`, {
        headers: headers(),
        cache: 'no-store',
      });
      if (!res.ok) {
        if (i < retries - 1) await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      const data = (await res.json()) as Record<string, unknown>;
      if (data.base64) return { base64: data.base64 as string, code: data.code as string | undefined };
    } catch { }
    if (i < retries - 1) await new Promise(r => setTimeout(r, 2000));
  }
  return null;
}

// ─── sendTextMessage ──────────────────────────────────────────────────────────

/**
 * Sends a plain-text WhatsApp message via Evolution API.
 * `phone` must be in international format, e.g. "393331234567".
 */
export async function sendTextMessage(
  instanceName: string,
  phone: string,
  message: string,
): Promise<boolean> {
  const base = BASE();
  if (!base) return false;
  try {
    const number = phone.replace(/\D/g, '');
    if (!number) return false;
    const res = await fetch(`${base}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ number, text: message }),
    });
    if (!res.ok) {
      console.warn('[Evolution] sendText failed for', number, '→ status', res.status);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Evolution] network error for', phone, ':', err);
    return false;
  }
}

// ─── disconnectInstance ───────────────────────────────────────────────────────

/**
 * Logs out and deletes the Evolution API instance for the salon.
 */
export async function disconnectInstance(instanceName: string): Promise<boolean> {
  const base = BASE();
  if (!base) return false;
  try {
    const res = await fetch(`${base}/instance/delete/${instanceName}`, {
      method: 'DELETE',
      headers: headers(),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export { disconnectInstance as deleteInstance };
