import { fetchInstance, createInstance, getQRCode } from './evolutionClient';

// ─── ensureInstance ───────────────────────────────────────────────────────────

/**
 * Ensures an Evolution API instance exists for the given salon slug.
 * Creates it if it doesn't exist yet. Returns connection state + QR if disconnected.
 */
export async function ensureInstance(
  salonSlug: string,
): Promise<{ connected: boolean; qrcode?: string }> {
  const existing = await fetchInstance(salonSlug);

  if (!existing) {
    // Instance doesn't exist → create it, then fetch QR
    const created = await createInstance(salonSlug);
    // v2 may include QR in create response; if not, fetch it separately
    const qrFromCreate = created?.qrcode?.base64 ?? null;
    if (qrFromCreate) return { connected: false, qrcode: qrFromCreate };
    // Give Evolution API a moment to initialise the instance before fetching QR
    await new Promise(r => setTimeout(r, 1000));
    const qr = await getQRCode(salonSlug);
    return { connected: false, qrcode: qr?.base64 ?? undefined };
  }

  if (existing.connectionStatus === 'WORKING') {
    return { connected: true };
  }

  // Instance exists but not connected → fetch fresh QR
  const qr = await getQRCode(salonSlug);
  return { connected: false, qrcode: qr?.base64 ?? undefined };
}

// ─── refreshQR ────────────────────────────────────────────────────────────────

/**
 * Forces a QR code refresh for an existing instance.
 * Returns the new QR base64 string.
 */
export async function refreshQR(salonSlug: string): Promise<{ qrcode: string }> {
  const qr = await getQRCode(salonSlug);
  if (!qr?.base64) {
    throw new Error(`Impossibile ottenere il QR per l'istanza: ${salonSlug}`);
  }
  return { qrcode: qr.base64 };
}
