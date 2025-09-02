import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { isAdminId } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabaseAdmin';

export async function POST(req: Request) {
  try {
    const { userId } = auth();
    if (!isAdminId(userId)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { image_id, cx, cy, radius = 50 } = body || {};
    if (!image_id || typeof cx !== 'number' || typeof cy !== 'number') {
      return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from('targets')
      .upsert({ image_id, cx, cy, radius }, { onConflict: 'image_id' });

    if (error) {
      console.error('targets upsert error', error);
      return NextResponse.json({ error: 'db_error' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('targets api error', e);
    return NextResponse.json({ error: 'unexpected' }, { status: 500 });
  }
}
