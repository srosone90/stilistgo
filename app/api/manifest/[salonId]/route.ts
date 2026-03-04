import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_COLOR = '#c084fc';
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://stilistgo.vercel.app').trim();

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ salonId: string }> }
) {
  const { salonId } = await params;

  let salonName = 'La mia App';
  let themeColor = DEFAULT_COLOR;

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim()
    );
    const { data } = await supabase
      .from('salon_data')
      .select('state')
      .eq('user_id', salonId)
      .maybeSingle();

    const state = data?.state as Record<string, unknown> | null;
    const salonConfig = state?.salonConfig as Record<string, string> | null;
    const clientAppConfig = state?.clientAppConfig as Record<string, string> | null;

    if (salonConfig?.salonName) salonName = salonConfig.salonName;
    if (clientAppConfig?.accentColor) themeColor = clientAppConfig.accentColor;
  } catch {
    // fallback to defaults
  }

  const manifest = {
    name: salonName,
    short_name: salonName,
    description: `Prenota il tuo appuntamento da ${salonName}`,
    start_url: `${APP_URL}/prenota/${salonId}`,
    scope: `${APP_URL}/prenota/${salonId}`,
    display: 'standalone',
    orientation: 'portrait',
    theme_color: themeColor,
    background_color: '#0f0f13',
    categories: ['lifestyle', 'beauty'],
    icons: [
      { src: `${APP_URL}/icons/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `${APP_URL}/icons/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: `${APP_URL}/icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: `${APP_URL}/icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    screenshots: [],
  };

  return new NextResponse(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
