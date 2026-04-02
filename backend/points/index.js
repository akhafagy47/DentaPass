import { Router } from 'express';
import { getSupabase, verifyToken } from '../lib/supabase.js';
import { updatePatientPass, sendNotification } from '../lib/passkit.js';
import { sendPointsAwardedEmail } from '../lib/resend.js';

const router = Router();

const FALLBACK_POINTS = {
  completed_visit: 500,
  left_review:     500,
  referred_friend: 500,
  birthday:        250,
};

/**
 * POST /points/award
 * Award points to a patient and push the update to their wallet card.
 */
router.post('/award', async (req, res) => {
  try {
    const user = await verifyToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'Unauthorized.' });

    const { patientId, reason, customPoints, awardedBy } = req.body;

    if (!patientId || !reason) {
      return res.status(400).json({ error: 'patientId and reason are required.' });
    }

    const supabase = getSupabase();

    const { data: patient } = await supabase
      .from('patients')
      .select('id, first_name, last_name, email, phone, referral_code, clinic_id, points_balance, tier, next_checkup_date, passkit_serial_number, wallet_type, created_at')
      .eq('id', patientId)
      .single();

    if (!patient) return res.status(404).json({ error: 'Patient not found.' });

    const { data: clinic } = await supabase
      .from('clinics')
      .select('name, slug, brand_color, passkit_template_id, passkit_program_id, owner_email, action_points, custom_actions')
      .eq('id', patient.clinic_id)
      .single();

    if (!clinic || clinic.owner_email !== user.email) {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    const clinicActionPoints = clinic.action_points || FALLBACK_POINTS;
    const customActionsList  = clinic.custom_actions || [];

    let points;
    if (reason === 'custom') {
      points = parseInt(customPoints, 10);
      if (!points || points <= 0 || points > 10000) {
        return res.status(400).json({ error: 'Invalid custom point amount.' });
      }
    } else if (clinicActionPoints[reason] !== undefined) {
      points = clinicActionPoints[reason];
    } else {
      const customMatch = customActionsList.find((a) => a.label === reason);
      if (customMatch) {
        points = customMatch.points;
      } else {
        return res.status(400).json({ error: 'Invalid reason.' });
      }
    }

    const newBalance = patient.points_balance + points;

    // Update PassKit first — if it rejects, abort before touching the DB
    if (patient.passkit_serial_number) {
      try {
        await updatePatientPass({
          patient: { ...patient, points_balance: newBalance },
          clinic,
        });
      } catch (err) {
        return res.status(502).json({ error: `Wallet pass update failed: ${err.message}` });
      }
    }

    // PassKit accepted — now persist to DB
    const dbUpdates = { points_balance: newBalance };
    if (reason === 'completed_visit') dbUpdates.last_visit_date = new Date().toISOString();

    const { data: updated } = await supabase
      .from('patients')
      .update(dbUpdates)
      .eq('id', patientId)
      .select('points_balance, tier, passkit_serial_number, next_checkup_date, created_at')
      .single();

    await supabase.from('point_events').insert({
      patient_id: patientId,
      clinic_id: patient.clinic_id,
      points,
      reason,
      awarded_by: awardedBy || 'staff',
    });

    // Send notification via appropriate channel (fire-and-forget)
    if (patient.wallet_type === 'google' && patient.email) {
      sendPointsAwardedEmail(
        { ...patient, tier: updated.tier },
        clinic,
        points,
        newBalance,
      ).catch((err) => console.error('Resend points email failed:', err));
    } else if (patient.passkit_serial_number) {
      sendNotification(
        patient.passkit_serial_number,
        `You now have ${newBalance} points at ${clinic.name}!`,
      ).catch((err) => console.error('PassKit notification failed:', err));
    }

    res.json({ ok: true, newBalance, tier: updated.tier, pointsAwarded: points });
  } catch (err) {
    console.error('Award points error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * POST /points/redeem
 * Deduct points from a patient (discount redemption mode).
 * Validates the clinic is in discounts mode and patient has enough balance.
 */
router.post('/redeem', async (req, res) => {
  try {
    const { patientId, points, note, redeemedBy } = req.body;

    if (!patientId || !points || points <= 0) {
      return res.status(400).json({ error: 'patientId and a positive points amount are required.' });
    }

    const supabase = getSupabase();

    const { data: patient } = await supabase
      .from('patients')
      .select('id, first_name, last_name, email, phone, referral_code, clinic_id, points_balance, tier, next_checkup_date, passkit_serial_number, created_at')
      .eq('id', patientId)
      .single();

    if (!patient) return res.status(404).json({ error: 'Patient not found.' });

    const { data: clinic } = await supabase
      .from('clinics')
      .select('slug, rewards_mode, points_per_dollar, passkit_template_id, passkit_program_id')
      .eq('id', patient.clinic_id)
      .single();

    if (clinic?.rewards_mode !== 'discounts') {
      return res.status(400).json({ error: 'This clinic is not in discount redemption mode.' });
    }
    if (patient.points_balance < points) {
      return res.status(400).json({ error: 'Insufficient points balance.' });
    }

    const newBalance = patient.points_balance - points;
    const dollarValue = clinic.points_per_dollar
      ? parseFloat((points / clinic.points_per_dollar).toFixed(2))
      : null;

    // Update PassKit first — if it rejects, abort before touching the DB
    if (patient.passkit_serial_number) {
      try {
        await updatePatientPass({
          patient: { ...patient, points_balance: newBalance },
          clinic,
        });
      } catch (err) {
        return res.status(502).json({ error: `Wallet pass update failed: ${err.message}` });
      }
    }

    // PassKit accepted — now persist to DB
    const { data: updated } = await supabase
      .from('patients')
      .update({ points_balance: newBalance })
      .eq('id', patientId)
      .select('points_balance, tier, passkit_serial_number, next_checkup_date, created_at')
      .single();

    await supabase.from('redemptions').insert({
      patient_id:   patientId,
      clinic_id:    patient.clinic_id,
      points,
      dollar_value: dollarValue,
      note:         note || null,
      redeemed_by:  redeemedBy || 'staff',
    });

    res.json({ ok: true, newBalance: updated.points_balance, pointsRedeemed: points, dollarValue });
  } catch (err) {
    console.error('Redeem points error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
