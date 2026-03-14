/**
 * Evolution API client
 *
 * All requests use the server-side EVOLUTION_API_URL and EVOLUTION_API_KEY
 * environment variables. Never expose these to the client.
 */

const BASE_URL = (): string | null => {
  const url = process.env.EVOLUTION_API_URL;
  return url ? url.replace(/\/$/, '') : null;
};

const API_KEY = (): string | null => {
  return process.env.EVOLUTION_API_KEY ?? null;
};

function headers(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    apikey: API_KEY() ?? '',
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EvolutionInstance {
  instanceName: string;
  connectionStatus: string; // 'open' | 'close' | 'connecting' | ...
  profilePictureUrl?: string;
  profileName?: string;
  ownerJid?: string; // phone@s.whatsapp.net when connected
}

export interface EvolutionQRCode {
  base64: string;
  code?: string;
}

export interface EvolutionCreateResult {
  instance: EvolutionInstance;
  qrcode?: EvolutionQRCode;
  hash?: Record<string, string>;
}

// ─── fetchInstance ────────────────────────────────────────────────────────────

/**
 * Returns the instance state or null if the instance does not exist.
 */
export async function fetchInstance(instanceName: string): Promise<EvolutionInstance | null> {
  try {
    const base = BASE_URL();
    if (!base) return null;
    const res = await fetch(
      `${base}/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`,
      { headers: headers(), cache: 'no-store' },
    );
    if (!res.ok) return null;
    const data: unknown = await res.json();
    // Evolution API returns an array of instances
    const list = Array.isArray(data) ? data : [data];
    const found = list.find(
      (i: Record<string, unknown>) =>
        (i.instance as Record<string, unknown> | undefined)?.instanceName === instanceName ||
        i.instanceName === instanceName,
    );
    if (!found) return null;
    const raw = (found.instance as Record<string, unknown> | undefined) ?? found;
    return {
      instanceName: raw.instanceName as string,
      connectionStatus: (raw.connectionStatus ?? raw.state ?? 'close') as string,
      profileName: raw.profileName as string | undefined,
      ownerJid: raw.ownerJid as string | undefined,
    };
  } catch {
    return null;
  }
}

// ─── createInstance ───────────────────────────────────────────────────────────

/**
 * Creates a new Evolution API instance and returns the QR code.
 */
export async function createInstance(instanceName: string): Promise<EvolutionCreateResult | null> {
  try {
    const base = BASE_URL();
    if (!base) return null;
    const res = await fetch(`${base}/instance/create`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
      }),
    });
    if (!res.ok) return null;
    return (await res.json()) as EvolutionCreateResult;
  } catch {
    return null;
  }
}

// ─── getQRCode ────────────────────────────────────────────────────────────────

/**
 * Fetches a fresh QR code for an existing disconnected instance.
 */
export async function getQRCode(instanceName: string): Promise<EvolutionQRCode | null> {
  try {
    const base = BASE_URL();
    if (!base) return null;
    const res = await fetch(
      `${base}/instance/connect/${encodeURIComponent(instanceName)}`,
      { headers: headers(), cache: 'no-store' },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    const qr = (data.qrcode ?? data) as Record<string, unknown> | undefined;
    const base64 = qr?.base64 as string | undefined;
    if (!base64) return null;
    return { base64, code: qr?.code as string | undefined };
  } catch {
    return null;
  }
}

// ─── sendTextMessage ──────────────────────────────────────────────────────────

/**
 * Sends a plain-text WhatsApp message.
 * `phone` must be in international format without '+', e.g. "393331234567".
 */
export async function sendTextMessage(
  instanceName: string,
  phone: string,
  message: string,
): Promise<boolean> {
  try {
    const base = BASE_URL();
    if (!base) return false;
    const res = await fetch(
      `${base}/message/sendText/${encodeURIComponent(instanceName)}`,
      {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ number: phone, text: message }),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

// ─── disconnectInstance ───────────────────────────────────────────────────────

/**
 * Logs out the WhatsApp session without deleting the instance.
 */
export async function disconnectInstance(instanceName: string): Promise<boolean> {
  try {
    const base = BASE_URL();
    if (!base) return false;
    const res = await fetch(
      `${base}/instance/logout/${encodeURIComponent(instanceName)}`,
      { method: 'DELETE', headers: headers() },
    );
    return res.ok;
  } catch {
    return false;
  }
}

// ─── deleteInstance ───────────────────────────────────────────────────────────

/**
 * Permanently deletes an Evolution API instance.
 */
export async function deleteInstance(instanceName: string): Promise<boolean> {
  try {
    const base = BASE_URL();
    if (!base) return false;
    const res = await fetch(
      `${base}/instance/delete/${encodeURIComponent(instanceName)}`,
      { method: 'DELETE', headers: headers() },
    );
    return res.ok;
  } catch {
    return false;
  }
}
