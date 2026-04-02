import { Router } from 'express';
import { getSupabase } from '../lib/supabase.js';
import { sendNotification, updatePatientPass } from '../lib/passkit.js';
import { sendRecallEmail, sendReviewRequestEmail } from '../lib/resend.js';

const router = Router();

/**
 * GET /patients/by-serial/:serial
 * Look up a patient by their wallet card QR serial (used by staff scanner).
 */
router.get('/by-serial/:serial', async (req, res) => {
  const { serial } = req.params;
  const supabase = getSupabase();

  const { data: patient } = await supabase
    .from('patients')
    .select(`
      id, first_name, last_name, points_balance, tier,
      last_visit_date, next_checkup_date, referral_code,
      passkit_serial_number, clinic_id,
      clinic:clinics(name, slug)
    `)
    .eq('passkit_serial_number', serial)
    .single();

  if (!patient) return res.status(404).json({ error: 'Patient not found.' });
  res.json(patient);
});

/**
 * PATCH /patients/:id
 * Update safe patient fields (checkup date, contact info).
 * PassKit is updated first — if it rejects, the DB is not touched.
 * last_visit_date has no corresponding pass field so it bypasses PassKit.
 */
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const allowed = ['next_checkup_date', 'next_checkup_time', 'last_visit_date', 'phone', 'email'];
  const updates = Object.fromEntries(
    Object.entries(req.body).filter(([k]) => allowed.includes(k))
  );

  if (!Object.keys(updates).length) {
    return res.status(400).json({ error: 'No valid fields to update.' });
  }

  const supabase = getSupabase();

  // Only fields that map to a pass field require a PassKit round-trip first
  const passFields = ['next_checkup_date', 'next_checkup_time', 'phone', 'email'];
  const hasPassUpdate = Object.keys(updates).some((k) => passFields.includes(k));

  if (hasPassUpdate) {
    const { data: patient } = await supabase
      .from('patients')
      .select('passkit_serial_number, clinic_id, first_name, last_name, email, phone, referral_code, points_balance, tier, next_checkup_date, next_checkup_time, created_at')
      .eq('id', id)
      .single();

    if (patient?.passkit_serial_number) {
      const { data: clinic } = await supabase
        .from('clinics')
        .select('slug, passkit_template_id, passkit_program_id')
        .eq('id', patient.clinic_id)
        .single();

      if (clinic) {
        try {
          await updatePatientPass({ patient: { ...patient, ...updates }, clinic });
        } catch (err) {
          return res.status(502).json({ error: `Wallet pass update failed: ${err.message}` });
        }
      }
    }
  }

  const { error } = await supabase.from('patients').update(updates).eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

/**
 * POST /patients/:id/notify
 * Send a manual notification to a patient via their wallet channel.
 * Apple Wallet patients receive a PassKit field-update notification.
 * Google Wallet patients receive a Resend email.
 */
router.post('/:id/notify', async (req, res) => {
  const { id } = req.params;
  const { type } = req.body;

  if (!['recall', 'review', 'manual'].includes(type)) {
    return res.status(400).json({ error: 'Invalid notification type.' });
  }

  const supabase = getSupabase();

  const { data: patient } = await supabase
    .from('patients')
    .select(`
      first_name, email, wallet_type, points_balance, tier,
      passkit_serial_number, clinic_id,
      clinic:clinics(name, brand_color, booking_url, google_review_url, owner_email)
    `)
    .eq('id', id)
    .single();

  if (!patient) return res.status(404).json({ error: 'Patient not found.' });

  const clinic = patient.clinic;

  try {
    if (patient.wallet_type === 'google' && patient.email) {
      if (type === 'recall') {
        await sendRecallEmail(patient, clinic);
      } else if (type === 'review') {
        await sendReviewRequestEmail(patient, clinic);
      } else {
        // manual — send a generic recall email for now
        await sendRecallEmail(patient, clinic);
      }
    } else if (patient.passkit_serial_number) {
      const messages = {
        recall: `Your checkup at ${clinic.name} is coming up — book your appointment now`,
        review: `How was your visit at ${clinic.name}? Tap to leave us a Google review`,
        manual: `${clinic.name} has a message for you`,
      };
      await sendNotification(patient.passkit_serial_number, messages[type]);
    } else {
      return res.status(400).json({ error: 'Patient has no notification channel configured.' });
    }

    await supabase.from('notifications').insert({ patient_id: id, clinic_id: patient.clinic_id, type });
    res.json({ ok: true });
  } catch (err) {
    console.error('Notification error:', err);
    res.status(500).json({ error: 'Failed to send notification.' });
  }
});

export default router;
