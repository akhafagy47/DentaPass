import { Router } from 'express';
import { customAlphabet } from 'nanoid';
import { getSupabase } from '../lib/supabase.js';
import { enrollPatient, updatePatientPass } from '../lib/passkit.js';

const router = Router();
const nanoid = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 8);

/**
 * POST /enrollment
 * Enroll a new patient — creates DB record, generates wallet pass, credits referrer.
 */
router.post('/', async (req, res) => {
  try {
    const { firstName, lastName, email, phone, clinicSlug, referralCode } = req.body;

    if (!firstName || !lastName || !clinicSlug) {
      return res.status(400).json({ error: 'First name, last name, and clinic are required.' });
    }

    const supabase = getSupabase();

    // 1. Fetch clinic
    const { data: clinic } = await supabase
      .from('clinics')
      .select('id, name, slug, passkit_template_id, passkit_program_id, patient_limit, brand_color, booking_url')
      .eq('slug', clinicSlug)
      .single();

    if (!clinic) return res.status(404).json({ error: 'Clinic not found.' });

    // 2. Enforce patient limit
    const { count } = await supabase
      .from('patients')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', clinic.id);

    if (count >= clinic.patient_limit) {
      return res.status(409).json({ error: 'This clinic has reached its patient capacity.' });
    }

    // 3. Prevent duplicate enrollment (same email + clinic)
    if (email) {
      const { data: existing } = await supabase
        .from('patients')
        .select('id, passkit_serial_number')
        .eq('clinic_id', clinic.id)
        .eq('email', email)
        .maybeSingle();

      if (existing) {
        return res.json({
          ok: true,
          walletUrl: `https://pub2.pskt.io/m/${existing.passkit_serial_number}`,
          alreadyEnrolled: true,
        });
      }
    }

    // 4. Resolve referral code
    let referredByPatient = null;
    if (referralCode) {
      const { data: referrer } = await supabase
        .from('patients')
        .select('id, points_balance, passkit_serial_number')
        .eq('referral_code', referralCode)
        .eq('clinic_id', clinic.id)
        .maybeSingle();
      referredByPatient = referrer || null;
    }

    // 5. Create patient
    const { data: patient, error: patientErr } = await supabase
      .from('patients')
      .insert({
        clinic_id: clinic.id,
        first_name: firstName,
        last_name: lastName,
        email: email || null,
        phone: phone || null,
        referral_code: nanoid(),
        referred_by: referredByPatient?.id || null,
        points_balance: 0,
        tier: 'bronze',
        last_visit_date: new Date().toISOString(),
      })
      .select()
      .single();

    if (patientErr || !patient) {
      console.error('Patient insert error:', patientErr);
      return res.status(500).json({ error: 'Failed to create patient.' });
    }

    // 6. Generate PassKit wallet pass
    let walletUrl = null;
    try {
      const { serialNumber, walletUrl: pkUrl } = await enrollPatient({ patient, clinic });
      walletUrl = pkUrl;
      await supabase
        .from('patients')
        .update({ passkit_serial_number: serialNumber })
        .eq('id', patient.id);
    } catch (pkErr) {
      console.error('PassKit enrollment error:', pkErr);
    }

    // 7. Credit referrer with 250 points
    if (referredByPatient) {
      const newPoints = referredByPatient.points_balance + 250;

      await Promise.all([
        supabase.from('patients').update({ points_balance: newPoints }).eq('id', referredByPatient.id),
        supabase.from('point_events').insert({
          patient_id: referredByPatient.id,
          clinic_id: clinic.id,
          points: 250,
          reason: 'referred_friend',
          awarded_by: 'system',
        }),
        supabase.from('referrals').insert({
          referrer_patient_id: referredByPatient.id,
          referred_patient_id: patient.id,
          clinic_id: clinic.id,
          points_awarded: 250,
        }),
      ]);

      if (referredByPatient.passkit_serial_number) {
        const { data: updatedReferrer } = await supabase
          .from('patients').select('*').eq('id', referredByPatient.id).single();
        try { await updatePatientPass({ patient: updatedReferrer, clinic }); } catch {}
      }
    }

    res.json({ ok: true, walletUrl });
  } catch (err) {
    console.error('Enrollment error:', err);
    res.status(500).json({ error: err.message || 'Internal server error.' });
  }
});

export default router;
