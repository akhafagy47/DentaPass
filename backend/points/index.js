import { Router } from 'express';
import { getSupabase } from '../lib/supabase.js';
import { updatePatientPass } from '../lib/passkit.js';

const router = Router();

const PRESET_POINTS = {
  completed_visit: 100,
  left_review:     100,
  referred_friend: 250,
};

/**
 * POST /points/award
 * Award points to a patient and push the update to their wallet card.
 */
router.post('/award', async (req, res) => {
  try {
    const { patientId, reason, customPoints, awardedBy } = req.body;

    if (!patientId || !reason) {
      return res.status(400).json({ error: 'patientId and reason are required.' });
    }

    let points;
    if (reason === 'custom') {
      points = parseInt(customPoints, 10);
      if (!points || points <= 0 || points > 10000) {
        return res.status(400).json({ error: 'Invalid custom point amount.' });
      }
    } else if (PRESET_POINTS[reason] !== undefined) {
      points = PRESET_POINTS[reason];
    } else {
      return res.status(400).json({ error: 'Invalid reason.' });
    }

    const supabase = getSupabase();

    const { data: patient } = await supabase
      .from('patients')
      .select('id, clinic_id, points_balance, passkit_serial_number')
      .eq('id', patientId)
      .single();

    if (!patient) return res.status(404).json({ error: 'Patient not found.' });

    const updates = { points_balance: patient.points_balance + points };
    if (reason === 'completed_visit') updates.last_visit_date = new Date().toISOString();

    const { data: updated } = await supabase
      .from('patients')
      .update(updates)
      .eq('id', patientId)
      .select('points_balance, tier, passkit_serial_number, next_checkup_date')
      .single();

    await supabase.from('point_events').insert({
      patient_id: patientId,
      clinic_id: patient.clinic_id,
      points,
      reason,
      awarded_by: awardedBy || 'staff',
    });

    // Push wallet update — must complete before responding to meet 3s requirement
    if (patient.passkit_serial_number) {
      try {
        await updatePatientPass({
          patient: { ...updated, passkit_serial_number: patient.passkit_serial_number },
        });
      } catch (pkErr) {
        console.error('PassKit push failed:', pkErr);
      }
    }

    res.json({ ok: true, newBalance: updated.points_balance, tier: updated.tier, pointsAwarded: points });
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
      .select('id, clinic_id, points_balance, passkit_serial_number, tier, next_checkup_date')
      .eq('id', patientId)
      .single();

    if (!patient) return res.status(404).json({ error: 'Patient not found.' });

    const { data: clinic } = await supabase
      .from('clinics')
      .select('rewards_mode, points_per_dollar')
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

    const { data: updated } = await supabase
      .from('patients')
      .update({ points_balance: newBalance })
      .eq('id', patientId)
      .select('points_balance, tier, passkit_serial_number, next_checkup_date')
      .single();

    await supabase.from('redemptions').insert({
      patient_id:   patientId,
      clinic_id:    patient.clinic_id,
      points,
      dollar_value: dollarValue,
      note:         note || null,
      redeemed_by:  redeemedBy || 'staff',
    });

    if (patient.passkit_serial_number) {
      try {
        await updatePatientPass({
          patient: { ...updated, passkit_serial_number: patient.passkit_serial_number },
        });
      } catch (pkErr) {
        console.error('PassKit push failed:', pkErr);
      }
    }

    res.json({ ok: true, newBalance: updated.points_balance, pointsRedeemed: points, dollarValue });
  } catch (err) {
    console.error('Redeem points error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
