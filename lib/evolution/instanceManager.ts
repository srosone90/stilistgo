import { fetchInstance, createInstance, instanceNameFor, getQRCode } from './evolutionClient';

// ─── ensureInstance ───────────────────────────────────────────────────────────

/**
 * Checks or creates the Evolution API instance for the salon.
 *
 * The instance name is deterministic: instanceNameFor(salonId).
 * @param salonId         - the salon's user_id (UUID)
 * @param _existingName   - ignored; kept for API compatibility
 */
export async function ensureInstance(
  salonId: string,
  _existingName?: string,
): Promise<{ connected: boolean; qrcode?: string; phoneId?: string }> {
  const instanceName = instanceNameFor(salonId);

  const existing = await fetchInstance(instanceName);

  if (existing?.connectionStatus === 'open') {
    return { connected: true, phoneId: instanceName };
  }

  if (!existing) {
    // Instance doesn't exist yet → create it
    const created = await createInstance(instanceName);
    if (!created) return { connected: false };
    // If creation returned a QR code immediately, use it
    if (created.qrcode?.base64) {
      return { connected: false, qrcode: created.qrcode.base64, phoneId: instanceName };
    }
    // Give Evolution API a moment to prepare the QR
    await new Promise(r => setTimeout(r, 500));
  }

  const qr = await getQRCode(instanceName);
  return { connected: false, qrcode: qr?.base64, phoneId: instanceName };
}

// ─── refreshQR ────────────────────────────────────────────────────────────────

/**
 * Forces a QR code refresh for an existing instance.
 */
export async function refreshQR(instanceName: string): Promise<{ qrcode: string }> {
  const qr = await getQRCode(instanceName);
  if (!qr?.base64) {
    throw new Error(`Impossibile ottenere il QR per l'istanza: ${instanceName}`);
  }
  return { qrcode: qr.base64 };
}
