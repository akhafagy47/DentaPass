// Supabase Edge Function: recall-reminders
// Scheduled via pg_cron: daily at 9:00 AM UTC
// Sends push notifications to patients whose next_checkup_date = today + 30 days

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PASSKIT_BASE = 'https://api.pub2.passkit.io';

async function pkPush(serialNumber: string, message: string) {
  const res = await fetch(`${PASSKIT_BASE}/members/member`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${Deno.env.get('PASSKIT_API_TOKEN')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id: serialNumber, notes: [{ header: 'DentaPass', body: message }] }),
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

  // Target date: 30 days from today
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 30);
  const targetDateStr = targetDate.toISOString().split('T')[0];

  // Query patients due for checkup in 30 days who have a wallet card
  const { data: patients, error } = await supabase
    .from('patients')
    .select('id, first_name, passkit_serial_number, clinic_id, clinic:clinics(name, passkit_links)')
    .eq('next_checkup_date', targetDateStr)
    .not('passkit_serial_number', 'is', null);

  if (error) {
    console.error('Query error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  console.log(`Found ${patients?.length ?? 0} patients due for recall on ${targetDateStr}`);

  let sent = 0;
  let failed = 0;

  for (const patient of patients ?? []) {
    const message = `Time for your checkup, ${patient.first_name}! Book now and earn 200 bonus points.`;

    try {
      await pkPush(patient.passkit_serial_number, message);

      await supabase.from('notifications').insert({
        patient_id: patient.id,
        clinic_id: patient.clinic_id,
        type: 'recall',
      });

      sent++;
    } catch (err) {
      console.error(`Failed to push to ${patient.passkit_serial_number}:`, err);
      failed++;
    }
  }

  return new Response(
    JSON.stringify({ ok: true, sent, failed, targetDate: targetDateStr }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
