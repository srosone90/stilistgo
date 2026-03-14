import { fetchInstance, createInstance, getQRCode } from './evolutionClient';

// ─── ensureInstance ───────────────────────────────────────────────────────────

/**
 * Checks or creates a Maytapi phone slot for the salon.
 *
 * @param salonSlug       - used as the display name when creating a new phone
 * @param existingPhoneId - Maytapi phoneId already stored in DB (if any)
 * Returns connection state + QR code + phoneId (to persist in DB if new).
 */
export async function ensureInstance(
  salonSlug: string,
  existingPhoneId?: string,
): Promise<{ connected: boolean; qrcode?: string; phoneId?: string }> {
  if (existingPhoneId) {
    const existing = await fetchInstance(existingPhoneId);
    if (existing?.connectionStatus === 'active') {
      return { connected: true, phoneId: existingPhoneId };
    }
    // Phone exists in Maytapi but not yet connected → get QR
    const qr = await getQRCode(existingPhoneId);
    return { connected: false, qrcode: qr?.base64, phoneId: existingPhoneId };
  }

  // No phone yet for this salon → create one in Maytapi
  const created = await createInstance(salonSlug);
  if (!created) return { connected: false };
  const phoneId = created.instance.instanceName;
  // Give Maytapi a moment to prepare the QR
  await new Promise(r => setTimeout(r, 1500));
  const qr = await getQRCode(phoneId);
  return { connected: false, qrcode: qr?.base64, phoneId };
}

// ─── refreshQR ────────────────────────────────────────────────────────────────

/**
 * Forces a QR code refresh for an existing phone.
 */
export async function refreshQR(phoneId: string): Promise<{ qrcode: string }> {
  const qr = await getQRCode(phoneId);
  if (!qr?.base64) {
    throw new Error(`Impossibile ottenere il QR per il telefono: ${phoneId}`);
  }
  return { qrcode: qr.base64 };
}
