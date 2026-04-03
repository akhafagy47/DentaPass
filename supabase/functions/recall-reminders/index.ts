/**
 * recall-reminders — Supabase Edge Function
 *
 * Scheduled daily. Finds patients whose next_checkup_date is 30 days from today
 * and sends a notification via the appropriate channel:
 *   - Apple Wallet (wallet_type = 'apple'): PassKit metadata field update
 *   - Google Wallet (wallet_type = 'google'): Resend email
 *
 * Logs every attempt to the notifications table.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const PASSKIT_BASE = Deno.env.get('PASSKIT_API_URL') || 'https://api.pub2.passkit.io';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const RESEND_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') || 'noreply@dentapass.ca';

async function getPasskitToken(): Promise<string> {
  const token = Deno.env.get('PASSKIT_API_TOKEN');
  if (token) return token;
  const res = await fetch(`${PASSKIT_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: Deno.env.get('PASSKIT_API_KEY'),
      password: Deno.env.get('PASSKIT_API_SECRET'),
    }),
  });
  const { token: t } = await res.json();
  return t;
}

async function sendPasskitNotification(serialNumber: string, message: string, passkitToken: string) {
  const res = await fetch(`${PASSKIT_BASE}/members/member`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${passkitToken}` },
    body: JSON.stringify({ id: serialNumber, metaData: { notificationMessage: message } }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PassKit error ${res.status}: ${err}`);
  }
}

async function sendRecallEmail(patient: Record<string, unknown>, clinic: Record<string, unknown>) {
  const accent = (clinic.brand_color as string) || '#3bbfb9';
  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:16px;overflow:hidden;">
  <tr><td style="background:${accent};padding:6px 32px;"></td></tr>
  <tr><td style="padding:32px 32px 24px;">
    <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:${accent};text-transform:uppercase;letter-spacing:0.04em;">${clinic.name}</p>
    <h2 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#111827;">Time for your checkup, ${patient.first_name}</h2>
    <p style="margin:0 0 8px;font-size:15px;color:#374151;line-height:1.65;">Your next checkup at <strong>${clinic.name}</strong> is coming up. Regular visits keep your smile healthy and your points growing.</p>
    <p style="margin:0;font-size:15px;color:#374151;">You currently have <strong>${patient.points_balance ?? 0} points</strong> on your loyalty card.</p>
    ${(() => { const url = ((clinic.passkit_links as any[]) ?? []).find((l: any) => l.title === 'Book an Appointment')?.url; return url ? `<a href="${url}" style="display:inline-block;margin-top:20px;padding:12px 28px;background:${accent};color:#fff;font-size:15px;font-weight:700;text-decoration:none;border-radius:10px;">Book my appointment</a>` : ''; })()}
  </td></tr>
  <tr><td style="padding:0 32px 28px;"><p style="margin:0;font-size:12px;color:#9ca3af;">${clinic.name} team</p></td></tr>
</table>
</td></tr>
</table>
</body></html>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({
      from:     `${clinic.name} <${RESEND_FROM_EMAIL}>`,
      to:       patient.email,
      reply_to: clinic.owner_email,
      subject:  `Time for your checkup, ${patient.first_name}`,
      html,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error ${res.status}: ${err}`);
  }
}

Deno.serve(async () => {
  const today = new Date();
  const target = new Date(today);
  target.setDate(today.getDate() + 30);
  const targetDate = target.toISOString().split('T')[0];

  const { data: patients, error } = await supabase
    .from('patients')
    .select(`
      id, first_name, email, wallet_type, points_balance, tier,
      passkit_serial_number, clinic_id,
      clinic:clinics(name, brand_color, passkit_links, owner_email)
    `)
    .eq('next_checkup_date', targetDate)
    .not('clinic_id', 'is', null);

  if (error) {
    console.error('Query error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  let passkitToken: string | null = null;
  const results = { sent: 0, failed: 0 };

  for (const patient of patients ?? []) {
    const clinic = patient.clinic as Record<string, unknown>;
    try {
      if (patient.wallet_type === 'google' && patient.email) {
        await sendRecallEmail(patient, clinic);
      } else if (patient.passkit_serial_number) {
        if (!passkitToken) passkitToken = await getPasskitToken();
        await sendPasskitNotification(
          patient.passkit_serial_number,
          `Your checkup at ${clinic.name} is coming up — book your appointment now`,
          passkitToken,
        );
      } else {
        continue;
      }

      await supabase.from('notifications').insert({
        patient_id: patient.id,
        clinic_id:  patient.clinic_id,
        type:       'recall',
      });
      results.sent++;
    } catch (err) {
      console.error(`Failed for patient ${patient.id}:`, err);
      results.failed++;
    }
  }

  return new Response(JSON.stringify(results), { headers: { 'Content-Type': 'application/json' } });
});
