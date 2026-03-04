import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getPlanFeatures } from '@/lib/planGate';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  if (!userId) return NextResponse.json({ plan: 'trial', features: getPlanFeatures('trial') });

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim()
    );
    const { data } = await supabase
      .from('admin_tenants')
      .select('plan,status')
      .eq('user_id', userId)
      .maybeSingle();

    // Suspended or cancelled → trial features only
    const plan = (data?.status === 'suspended' || data?.status === 'cancelled')
      ? 'trial'
      : (data?.plan ?? 'trial');

    return NextResponse.json({ plan, features: getPlanFeatures(plan) });
  } catch {
    return NextResponse.json({ plan: 'trial', features: getPlanFeatures('trial') });
  }
}
