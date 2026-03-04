import { NextRequest, NextResponse } from 'next/server';
import { generateAdminToken, verifyAdminRequest } from '@/lib/adminAuth';

/** POST /api/admin/auth  — login with email+password → returns token */
export async function POST(req: NextRequest) {
  const { email, password } = await req.json().catch(() => ({}));
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPass  = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPass) {
    console.error('ADMIN_EMAIL and ADMIN_PASSWORD env vars are not set.');
    return NextResponse.json({ error: 'Server non configurato correttamente.' }, { status: 500 });
  }
  console.log('[admin/auth] emailMatch:', email === adminEmail, '| passMatch:', password === adminPass, '| emailLen:', email.length, adminEmail.length, '| passLen:', password.length, adminPass.length);
  if (email !== adminEmail || password !== adminPass) {
    return NextResponse.json({ error: 'Credenziali non valide.' }, { status: 401 });
  }
  const token = generateAdminToken();
  return NextResponse.json({ token, expiresIn: '8h' });
}

/** GET /api/admin/auth — verify existing token */
export async function GET(req: NextRequest) {
  if (!verifyAdminRequest(req.headers.get('authorization'))) {
    return NextResponse.json({ valid: false }, { status: 401 });
  }
  return NextResponse.json({ valid: true });
}
