import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Public endpoint — no user auth needed, just logs a click and redirects
export async function GET(request, { params }) {
  const { id } = params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  // Fetch the notification to get the clinic's review URL
  const { data: notif } = await supabase
    .from('notifications')
    .select('id, clicked_at, clinic:clinics(passkit_links)')
    .eq('id', id)
    .eq('type', 'review')
    .maybeSingle();

  // Log the click (only first tap — don't overwrite existing click)
  if (notif && !notif.clicked_at) {
    await supabase
      .from('notifications')
      .update({ clicked_at: new Date().toISOString() })
      .eq('id', id);
  }

  const reviewUrl = (notif?.clinic?.passkit_links || []).find((l) => l.title === 'Leave a Google Review')?.url;
  if (!reviewUrl) {
    return new NextResponse('Not found', { status: 404 });
  }

  return NextResponse.redirect(reviewUrl, { status: 302 });
}
