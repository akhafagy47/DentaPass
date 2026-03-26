import { Router } from 'express';
import { getSupabase } from '../lib/supabase.js';
import { sendPushNotification } from '../lib/passkit.js';

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
 */
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const allowed = ['next_checkup_date', 'last_visit_date', 'phone', 'email'];
  const updates = Object.fromEntries(
    Object.entries(req.body).filter(([k]) => allowed.includes(k))
  );

  if (!Object.keys(updates).length) {
    return res.status(400).json({ error: 'No valid fields to update.' });
  }

  const supabase = getSupabase();
  const { error } = await supabase.from('patients').update(updates).eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

/**
 * POST /patients/:id/notify
 * Send a manual push notification to a patient's wallet card.
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
    .select('first_name, passkit_serial_number, clinic_id, clinic:clinics(name, google_review_url)')
    .eq('id', id)
    .single();

  if (!patient?.passkit_serial_number) {
    return res.status(404).json({ error: 'Patient not found or no wallet card.' });
  }

  const messages = {
    recall:  `Time for your checkup, ${patient.first_name}. Book now and earn 200 bonus points.`,
    review:  `How was your visit with ${patient.clinic?.name}? Tap to leave a review.`,
    manual:  `${patient.clinic?.name} has a message for you.`,
  };

  try {
    await sendPushNotification({ serialNumber: patient.passkit_serial_number, message: messages[type] });
    await supabase.from('notifications').insert({ patient_id: id, clinic_id: patient.clinic_id, type });
    res.json({ ok: true });
  } catch (err) {
    console.error('Push notification error:', err);
    res.status(500).json({ error: 'Failed to send notification.' });
  }
});

export default router;
