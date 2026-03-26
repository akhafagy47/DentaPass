// Supabase Edge Function: review-requests
// Scheduled via pg_cron: every 2 hours
// Sends push notifications to patients who had a visit ~2 hours ago
// 90-day cooldown per patient

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PASSKIT_BASE = 'https://api.pub1.passkit.io';

async function pkPush(serialNumber: string, message: string) {
  const creds = btoa(`${Deno.env.get('PASSKIT_API_KEY')}:${Deno.env.get('PASSKIT_API_SECRET')}`);
  const res = await fetch(`${PASSKIT_BASE}/membership/member/${serialNumber}/push`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${creds}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ pushMessage: message }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PassKit push failed ${res.status}: ${body}`);
  }
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const now = new Date();
  // Window: visits between 1.5h and 2.5h ago (catches the 2-hour mark)
  const windowEnd = new Date(now.getTime() - 90 * 60 * 1000);   // 1.5h ago
  const windowStart = new Date(now.getTime() - 150 * 60 * 1000); // 2.5h ago

  const cooldownCutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); // 90 days ago

  // Patients who visited in the window and have a wallet card
  const { data: candidates, error } = await supabase
    .from('patients')
    .select('id, first_name, passkit_serial_number, clinic_id, clinic:clinics(name, google_review_url)')
    .gte('last_visit_date', windowStart.toISOString())
    .lte('last_visit_date', windowEnd.toISOString())
    .not('passkit_serial_number', 'is', null);

  if (error) {
    console.error('Query error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  console.log(`Found ${candidates?.length ?? 0} review candidates`);

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const patient of candidates ?? []) {
    if (!patient.clinic?.google_review_url) {
      skipped++;
      continue;
    }

    // Check 90-day cooldown: did we send a review notification recently?
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('patient_id', patient.id)
      .eq('type', 'review')
      .gte('sent_at', cooldownCutoff.toISOString());

    if ((count ?? 0) > 0) {
      skipped++;
      continue;
    }

    const message = `How was your visit with ${patient.clinic.name}? Tap to leave a review and earn 100 bonus points!`;

    try {
      await pkPush(patient.passkit_serial_number, message);

      await supabase.from('notifications').insert({
        patient_id: patient.id,
        clinic_id: patient.clinic_id,
        type: 'review',
      });

      sent++;
    } catch (err) {
      console.error(`Failed push to ${patient.passkit_serial_number}:`, err);
      failed++;
    }
  }

  return new Response(
    JSON.stringify({ ok: true, sent, skipped, failed }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
