import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

function from(clinic) {
  return `${clinic.name} <${process.env.RESEND_FROM_EMAIL || 'noreply@dentapass.ca'}>`;
}

function accentColor(clinic) {
  return clinic.brand_color || '#3bbfb9';
}

function tierBadge(tier) {
  if (!tier || tier === 'bronze') return '';
  const label = tier.charAt(0).toUpperCase() + tier.slice(1);
  const color = tier === 'gold' ? '#d97706' : '#6b7280';
  return `<span style="display:inline-block;padding:2px 10px;border-radius:20px;background:${color}20;color:${color};font-size:12px;font-weight:700;letter-spacing:0.04em;margin-left:8px;">${label}</span>`;
}

function baseHtml({ clinic, title, body }) {
  const accent = accentColor(clinic);
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'DM Sans',system-ui,-apple-system,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
  <tr><td style="background:${accent};padding:6px 32px;"></td></tr>
  <tr><td style="padding:32px 32px 24px;">
    <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:${accent};letter-spacing:0.04em;text-transform:uppercase;">${clinic.name}</p>
    ${body}
  </td></tr>
  <tr><td style="padding:0 32px 28px;">
    <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
      ${clinic.name} team<br>
      This message was sent to you because you are a member of the ${clinic.name} loyalty program.
    </p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

function ctaButton(label, url, accent) {
  return `<a href="${url}" style="display:inline-block;margin-top:20px;padding:12px 28px;background:${accent};color:#fff;font-size:15px;font-weight:700;text-decoration:none;border-radius:10px;letter-spacing:-0.01em;">${label}</a>`;
}

/**
 * Recall reminder email — sent to Google Wallet patients ~30 days before checkup.
 */
export async function sendRecallEmail(patient, clinic) {
  const accent = accentColor(clinic);
  const body = `
    <h2 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#111827;letter-spacing:-0.02em;">
      Time for your checkup, ${patient.first_name}
    </h2>
    <p style="margin:0 0 8px;font-size:15px;color:#374151;line-height:1.65;">
      Your next checkup at <strong>${clinic.name}</strong> is coming up. Don't let it slip by — regular visits keep your smile healthy and your points growing.
    </p>
    <p style="margin:0;font-size:15px;color:#374151;line-height:1.65;">
      You currently have <strong>${patient.points_balance ?? 0} points</strong>${tierBadge(patient.tier)} on your loyalty card.
    </p>
    ${clinic.booking_url ? ctaButton('Book my appointment', clinic.booking_url, accent) : ''}
  `;

  await resend.emails.send({
    from:     from(clinic),
    to:       patient.email,
    reply_to: clinic.owner_email,
    subject:  `Time for your checkup, ${patient.first_name}`,
    html:     baseHtml({ clinic, title: 'Checkup reminder', body }),
  });
}

/**
 * Review request email — sent to Google Wallet patients after a visit.
 */
export async function sendReviewRequestEmail(patient, clinic) {
  const accent = accentColor(clinic);
  const body = `
    <h2 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#111827;letter-spacing:-0.02em;">
      How was your visit today, ${patient.first_name}?
    </h2>
    <p style="margin:0;font-size:15px;color:#374151;line-height:1.65;">
      We hope your visit to <strong>${clinic.name}</strong> went great. If you have a moment, we'd love a Google review — it means a lot to our team and helps other patients find us.
    </p>
    ${clinic.google_review_url ? ctaButton('Leave a review', clinic.google_review_url, accent) : ''}
  `;

  await resend.emails.send({
    from:     from(clinic),
    to:       patient.email,
    reply_to: clinic.owner_email,
    subject:  `How was your visit today, ${patient.first_name}?`,
    html:     baseHtml({ clinic, title: 'How was your visit?', body }),
  });
}

/**
 * Points awarded email — sent to Google Wallet patients after a points award.
 */
export async function sendPointsAwardedEmail(patient, clinic, pointsAwarded, newBalance) {
  const accent = accentColor(clinic);
  const tierLine = patient.tier && patient.tier !== 'bronze'
    ? `<p style="margin:12px 0 0;font-size:14px;color:#6b7280;">Your current status: ${tierBadge(patient.tier)}</p>`
    : '';

  const body = `
    <h2 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#111827;letter-spacing:-0.02em;">
      +${pointsAwarded} points added to your card
    </h2>
    <p style="margin:0;font-size:15px;color:#374151;line-height:1.65;">
      You just earned <strong>${pointsAwarded} points</strong> at <strong>${clinic.name}</strong>. Your new balance is <strong>${newBalance} points</strong>.
    </p>
    ${tierLine}
  `;

  await resend.emails.send({
    from:     from(clinic),
    to:       patient.email,
    reply_to: clinic.owner_email,
    subject:  `${pointsAwarded} points added to your ${clinic.name} card`,
    html:     baseHtml({ clinic, title: 'Points added', body }),
  });
}
