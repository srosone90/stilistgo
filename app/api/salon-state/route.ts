import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const BUCKET = 'salon-data';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureBucket(supabase: any) {
  try {
    const { error } = await supabase.storage.getBucket(BUCKET);
    if (error && (error.message.includes('not found') || error.message.includes('does not exist') || error.message.includes('violates'))) {
      await supabase.storage.createBucket(BUCKET, { public: false, allowedMimeTypes: ['application/json'], fileSizeLimit: 10485760 });
    }
  } catch { /* ignore */ }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

    const supabase = getAdminClient() as any;
    await ensureBucket(supabase);

    const { data, error } = await supabase.storage.from(BUCKET).download(`${userId}.json`);
    if (error || !data) return NextResponse.json({ state: null });

    const text = await data.text();
    const state = JSON.parse(text);
    return NextResponse.json({ state });
  } catch {
    return NextResponse.json({ state: null });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

    const body = await req.json();
    const supabase = getAdminClient();
    await ensureBucket(supabase);

    const json = JSON.stringify(body);
    const blob = new Blob([json], { type: 'application/json' });
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(`${userId}.json`, blob, { upsert: true, contentType: 'application/json' });

    if (error) {
      console.error('salon-state save error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('salon-state POST error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
