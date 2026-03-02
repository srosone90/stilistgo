import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/whatsapp/exchange-token
 *
 * Called after Meta Embedded Signup completes.
 * Receives the short-lived code and exchanges it for a long-lived
 * access token, then fetches the phone number details.
 *
 * Body: { code: string; phoneNumberId: string }
 * Returns: { accessToken: string; phoneNumberId: string; displayPhoneNumber: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { code, phoneNumberId } = await req.json();

    if (!code) {
      return NextResponse.json({ error: 'Missing code' }, { status: 400 });
    }

    const appId     = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;

    if (!appId || !appSecret) {
      return NextResponse.json(
        { error: 'META_APP_ID / META_APP_SECRET non configurati nel server.' },
        { status: 500 }
      );
    }

    // 1 — Exchange short-lived code for user access token
    const tokenUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token');
    tokenUrl.searchParams.set('client_id',     appId);
    tokenUrl.searchParams.set('client_secret', appSecret);
    tokenUrl.searchParams.set('code',          code);

    const tokenRes = await fetch(tokenUrl.toString());
    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || tokenData.error) {
      return NextResponse.json(
        { error: tokenData.error?.message ?? 'Errore scambio token' },
        { status: 400 }
      );
    }

    const accessToken: string = tokenData.access_token;

    // 2 — If phoneNumberId was provided by Embedded Signup session info,
    //     fetch the display number for confirmation; otherwise just return.
    let displayPhoneNumber = '';
    if (phoneNumberId) {
      const numRes = await fetch(
        `https://graph.facebook.com/v19.0/${phoneNumberId}?fields=display_phone_number,verified_name`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const numData = await numRes.json();
      displayPhoneNumber = numData.display_phone_number ?? '';
    }

    return NextResponse.json({
      success: true,
      accessToken,
      phoneNumberId: phoneNumberId ?? '',
      displayPhoneNumber,
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Errore sconosciuto';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
