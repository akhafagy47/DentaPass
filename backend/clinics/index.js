import { Router } from 'express';
import { getSupabase } from '../lib/supabase.js';
import { getStripe, PLANS } from '../lib/stripe.js';
import { requireAuth } from '../lib/authMiddleware.js';
import { createClinicTemplate, updateClinicTemplate } from '../lib/passkit.js';

const router = Router();

function slugify(text) {
  return text.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// ── IMPORTANT: fixed routes must come before /:slug ──────────────────────────

/**
 * GET /clinics/onboard/session?session_id=...
 * Retrieve owner email from a Stripe checkout session (used by /onboard page).
 */
router.get('/onboard/session', async (req, res) => {
  const { session_id } = req.query;
  if (!session_id) return res.status(400).json({ error: 'session_id required.' });

  try {
    const session = await getStripe().checkout.sessions.retrieve(session_id);
    if (session.payment_status !== 'paid') {
      return res.status(402).json({ error: 'Payment not completed.' });
    }
    res.json({ email: session.metadata?.ownerEmail });
  } catch {
    res.status(400).json({ error: 'Invalid session.' });
  }
});

/**
 * POST /clinics/onboard
 * Called after Stripe payment — creates the auth user + clinic row.
 */
router.post('/onboard', async (req, res) => {
  const { sessionId, clinicName, password } = req.body;

  if (!sessionId || !clinicName || !password) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['subscription'] });

    if (session.payment_status !== 'paid') {
      return res.status(402).json({ error: 'Payment not completed.' });
    }

    const { plan, ownerEmail } = session.metadata || {};
    if (!plan || !ownerEmail) return res.status(400).json({ error: 'Invalid session.' });

    const supabase = getSupabase();
    const planConfig = PLANS[plan];

    // Idempotency check
    const { data: existing } = await supabase
      .from('clinics').select('id').eq('owner_email', ownerEmail).maybeSingle();
    if (existing) return res.json({ ok: true, alreadyExists: true });

    // Create auth user (email pre-confirmed — they paid, that's confirmation enough)
    const { error: authErr } = await supabase.auth.admin.createUser({
      email: ownerEmail,
      password,
      email_confirm: true,
    });
    if (authErr && !authErr.message.includes('already been registered')) {
      return res.status(400).json({ error: authErr.message });
    }

    // Generate unique slug
    let slug = slugify(clinicName);
    for (let suffix = 2; ; suffix++) {
      const { count } = await supabase
        .from('clinics').select('id', { count: 'exact', head: true }).eq('slug', slug);
      if (!count) break;
      slug = `${slugify(clinicName)}-${suffix}`;
    }

    const { error: clinicErr } = await supabase.from('clinics').insert({
      name: clinicName,
      slug,
      owner_email: ownerEmail,
      plan,
      patient_limit: planConfig?.patientLimit ?? null,
      stripe_customer_id: session.customer,
      stripe_subscription_id: session.subscription?.id ?? null,
    });

    if (clinicErr) return res.status(500).json({ error: 'Failed to create clinic.' });

    res.json({ ok: true });
  } catch (err) {
    console.error('Onboard error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * POST /clinics/onboard/dev
 * DEV ONLY — bypasses Stripe, creates auth user + clinic directly.
 * Blocked in production.
 */
router.post('/onboard/dev', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found.' });
  }

  const { email, clinicName, password, plan = 'solo' } = req.body;
  if (!email || !clinicName || !password) {
    return res.status(400).json({ error: 'email, clinicName, and password are required.' });
  }
  if (!PLANS[plan]) return res.status(400).json({ error: 'Invalid plan.' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

  const supabase = getSupabase();

  // Idempotency
  const { data: existing } = await supabase
    .from('clinics').select('id').eq('owner_email', email).maybeSingle();
  if (existing) return res.json({ ok: true, alreadyExists: true });

  const { error: authErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authErr && !authErr.message.includes('already been registered')) {
    return res.status(400).json({ error: authErr.message });
  }

  let slug = slugify(clinicName);
  for (let suffix = 2; ; suffix++) {
    const { count } = await supabase
      .from('clinics').select('id', { count: 'exact', head: true }).eq('slug', slug);
    if (!count) break;
    slug = `${slugify(clinicName)}-${suffix}`;
  }

  const { error: clinicErr } = await supabase.from('clinics').insert({
    name: clinicName,
    slug,
    owner_email: email,
    plan,
    patient_limit: PLANS[plan]?.patientLimit ?? null,
  });

  if (clinicErr) return res.status(500).json({ error: 'Failed to create clinic.' });

  res.json({ ok: true, email, slug });
});

// ── Dynamic :slug routes must come after fixed paths ─────────────────────────

/**
 * GET /clinics/:slug
 * Public — clinic info for the enrollment page.
 */
router.get('/:slug', async (req, res) => {
  const { data: clinic } = await getSupabase()
    .from('clinics')
    .select('name, brand_color, logo_url, booking_url, theme')
    .eq('slug', req.params.slug)
    .single();

  if (!clinic) return res.status(404).json({ error: 'Not found.' });
  res.json(clinic);
});

/**
 * PATCH /clinics/:id
 * Auth protected — update clinic settings.
 */
router.patch('/:id', requireAuth, async (req, res) => {
  if (req.clinic.id !== req.params.id) {
    return res.status(403).json({ error: 'Forbidden.' });
  }

  const allowed = ['name', 'google_review_url', 'booking_url', 'brand_color', 'logo_url',
                   'rewards_mode', 'points_per_dollar', 'points_label', 'setup_completed',
                   'address', 'phone', 'facebook_url', 'instagram_url', 'theme'];
  if (req.body.theme && !['dark', 'light', 'auto'].includes(req.body.theme)) {
    return res.status(400).json({ error: 'Invalid theme value.' });
  }
  const updates = Object.fromEntries(
    Object.entries(req.body).filter(([k]) => allowed.includes(k))
  );

  if (!Object.keys(updates).length) {
    return res.status(400).json({ error: 'No valid fields.' });
  }

  const supabase = getSupabase();

  // When setup wizard completes, run PassKit setup synchronously before saving setup_completed
  if (updates.setup_completed === true) {
    // Don't write setup_completed yet — only save it if PassKit succeeds
    const { setup_completed: _, ...updatesWithoutSetup } = updates;

    if (Object.keys(updatesWithoutSetup).length) {
      const { error: partialErr } = await supabase.from('clinics').update(updatesWithoutSetup).eq('id', req.params.id);
      if (partialErr) return res.status(500).json({ error: partialErr.message });
    }

    try {
      const { data: clinic, error: clinicFetchErr } = await supabase
        .from('clinics')
        .select('name, slug, brand_color, logo_url, points_label, rewards_mode, points_per_dollar, booking_url, google_review_url, address, phone, facebook_url, instagram_url, timezone')
        .eq('id', req.params.id)
        .maybeSingle();

      if (clinicFetchErr) throw new Error(`DB error: ${clinicFetchErr.message}`);
      if (!clinic) throw new Error('Clinic not found.');
      if (!clinic.logo_url) throw new Error('A logo is required before completing setup.');

      const { programId, templateDesignId, tierId } = await createClinicTemplate({ clinic });
      const { error: finalErr } = await supabase.from('clinics')
        .update({ setup_completed: true, passkit_program_id: programId, passkit_template_design_id: templateDesignId, passkit_template_id: tierId })
        .eq('id', req.params.id);
      if (finalErr) throw new Error(`Failed to save PassKit IDs: ${finalErr.message}`);
      console.log('[PassKit] Program + template + tier created for clinic', clinic.slug);
    } catch (pkErr) {
      console.error('PassKit setup failed:', pkErr.message);
      return res.status(500).json({ error: pkErr.message });
    }

    return res.json({ ok: true });
  }

  const { error } = await supabase.from('clinics').update(updates).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });

  // Push updated card design to all patients' wallet passes if any design field changed
  const DESIGN_FIELDS = ['name', 'brand_color', 'logo_url', 'points_label', 'rewards_mode',
                         'points_per_dollar', 'booking_url'];
  const designChanged = !updates.setup_completed && Object.keys(updates).some((k) => DESIGN_FIELDS.includes(k));

  if (designChanged) {
    // Fire-and-forget — don't block the response
    (async () => {
      try {
        const { data: clinic } = await supabase
          .from('clinics')
          .select('name, slug, brand_color, logo_url, points_label, rewards_mode, points_per_dollar, booking_url, google_review_url, address, phone, timezone, passkit_template_id, passkit_template_design_id')
          .eq('id', req.params.id)
          .single();
        if (!clinic?.passkit_template_id) return;

        await updateClinicTemplate({ clinic });
      } catch (pkErr) {
        console.error('PassKit tier update failed:', pkErr.message);
      }
    })();
  }

  res.json({ ok: true });
});

export default router;
