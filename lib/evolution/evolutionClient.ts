/**
 * Maytapi WhatsApp client
 *
 * Each salon has its own "phone" in Maytapi (phoneId stored in admin_tenants.whatsapp_instance_name).
 *
 * Env vars (add to Vercel):
 *   MAYTAPI_PRODUCT_ID — your Maytapi Product ID
 *   MAYTAPI_TOKEN      — your Maytapi API token
 */

const BASE = 'https://api.maytapi.com/api';

const PRODUCT_ID = (): string | null => process.env.MAYTAPI_PRODUCT_ID ?? null;
const TOKEN = (): string | null => process.env.MAYTAPI_TOKEN ?? null;

function headers(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-maytapi-key': TOKEN() ?? '',
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EvolutionInstance {
  instanceName: string; // Maytapi phoneId (as string)
  connectionStatus: string; // 'active' | 'loading' | 'qr' | 'timeout'
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
 * Returns the Maytapi phone status for the given phoneId.
 */
export async function fetchInstance(phoneId: string): Promise<EvolutionInstance | null> {
  try {
    const pid = PRODUCT_ID();
    if (!pid) return null;
    const res = await fetch(`${BASE}/${pid}/${phoneId}/status`, {
      headers: headers(),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    return {
      instanceName: String(data.id ?? phoneId),
      connectionStatus: (data.status as string) ?? 'loading',
      ownerJid: data.phone as string | undefined,
    };
  } catch {
    return null;
  }
}

// ─── createInstance ───────────────────────────────────────────────────────────

/**
 * Creates a new phone slot in Maytapi for this salon.
 * Returns the phoneId which must be stored in admin_tenants.whatsapp_instance_name.
 */
export async function createInstance(salonSlug: string): Promise<EvolutionCreateResult | null> {
  try {
    const pid = PRODUCT_ID();
    if (!pid) return null;
    const res = await fetch(`${BASE}/${pid}/createPhone`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ name: salonSlug }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    // Maytapi returns { success: true, data: { id, status, ... } }
    const phone = (data.data as Record<string, unknown> | undefined) ?? data;
    const id = String(phone.id ?? '');
    return {
      instance: {
        instanceName: id,
        connectionStatus: (phone.status as string) ?? 'loading',
      },
    };
  } catch {
    return null;
  }
}

// ─── getQRCode ────────────────────────────────────────────────────────────────

/**
 * Fetches the QR code for the given Maytapi phoneId.
 * Returns { type: 'qrCode'|'screen', data: 'data:image/png;base64,...' }
 */
export async function getQRCode(phoneId: string, retries = 8): Promise<EvolutionQRCode | null> {
  const pid = PRODUCT_ID();
  if (!pid) return null;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`${BASE}/${pid}/${phoneId}/qrCode`, {
        headers: headers(),
        cache: 'no-store',
      });
      if (!res.ok) {
        if (i < retries - 1) await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      const data = (await res.json()) as Record<string, unknown>;
      // Maytapi returns { type: 'qrCode'|'screen'|'loading', data: 'data:image/...' }
      if (data.type === 'loading') {
        if (i < retries - 1) await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      if (data.data) return { base64: data.data as string };
    } catch { }
    if (i < retries - 1) await new Promise(r => setTimeout(r, 2000));
  }
  return null;
}

// ─── sendTextMessage ──────────────────────────────────────────────────────────

/**
 * Sends a plain-text WhatsApp message via Maytapi.
 * `phone` must be in international format without '+', e.g. "393331234567".
 */
export async function sendTextMessage(
  phoneId: string,
  phone: string,
  message: string,
): Promise<boolean> {
  try {
    const pid = PRODUCT_ID();
    if (!pid) return false;
    const toNumber = phone.replace(/\D/g, '');
    const res = await fetch(`${BASE}/${pid}/${phoneId}/sendMessage`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ to_number: toNumber, type: 'text', message }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── disconnectInstance ───────────────────────────────────────────────────────

/**
 * Deletes the Maytapi phone slot (logs out and removes the phone from Maytapi).
 */
export async function disconnectInstance(phoneId: string): Promise<boolean> {
  try {
    const pid = PRODUCT_ID();
    if (!pid) return false;
    const res = await fetch(`${BASE}/${pid}/${phoneId}`, {
      method: 'DELETE',
      headers: headers(),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── deleteInstance ───────────────────────────────────────────────────────────

export async function deleteInstance(phoneId: string): Promise<boolean> {
  return disconnectInstance(phoneId);
}
