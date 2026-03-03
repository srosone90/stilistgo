import { createHmac } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

const SECRET = process.env.CLIENT_TOKEN_SECRET ?? 'dev-secret-change-me';
const ALGO = 'sha256';
const TOKEN_TTL_DAYS = 365 * 5; // 5 years — link is permanent for a client

interface TokenPayload {
  salonId: string;
  clientPhone: string;
  clientName: string;
  clientEmail?: string;
  exp: number; // unix timestamp seconds
}

function sign(payload: TokenPayload): string {
  const data = JSON.stringify(payload);
  const b64 = Buffer.from(data).toString('base64url');
  const sig = createHmac(ALGO, SECRET).update(b64).digest('base64url');
  return `${b64}.${sig}`;
}

function verify(token: string): TokenPayload | null {
  try {
    const [b64, sig] = token.split('.');
    if (!b64 || !sig) return null;
    const expected = createHmac(ALGO, SECRET).update(b64).digest('base64url');
    // Constant-time comparison
    if (expected.length !== sig.length) return null;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
    if (diff !== 0) return null;
    const payload: TokenPayload = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
    if (Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

// POST /api/client-token  { salonId, clientPhone, clientName, clientEmail? }
// → { token }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { salonId, clientPhone, clientName, clientEmail } = body;
    if (!salonId || !clientPhone || !clientName) {
      return NextResponse.json({ error: 'salonId, clientPhone, clientName required' }, { status: 400 });
    }
    const payload: TokenPayload = {
      salonId,
      clientPhone,
      clientName,
      clientEmail: clientEmail ?? '',
      exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_DAYS * 86400,
    };
    return NextResponse.json({ token: sign(payload) });
  } catch {
    return NextResponse.json({ error: 'bad request' }, { status: 400 });
  }
}

// GET /api/client-token?t=TOKEN
// → { valid: true, payload } or { valid: false }
export async function GET(req: NextRequest) {
  const t = req.nextUrl.searchParams.get('t');
  if (!t) return NextResponse.json({ valid: false });
  const payload = verify(t);
  if (!payload) return NextResponse.json({ valid: false });
  return NextResponse.json({ valid: true, payload });
}
