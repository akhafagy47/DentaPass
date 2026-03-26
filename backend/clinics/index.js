import { Router } from 'express';
import { getSupabase } from '../lib/supabase.js';
import { getStripe, PLANS } from '../lib/stripe.js';
import { requireAuth } from '../lib/authMiddleware.js';

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
    const { count } = await supabase
      .from('clinics').select('id', { count: 'exact', head: true }).eq('slug', slug);
    if (count > 0) slug = `${slug}-${Date.now().toString(36)}`;

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

// ── Dynamic :slug routes must come after fixed paths ─────────────────────────

/**
 * GET /clinics/:slug
 * Public — clinic info for the enrollment page.
 */
router.get('/:slug', async (req, res) => {
  const { data: clinic } = await getSupabase()
    .from('clinics')
    .select('name, brand_color, logo_url, booking_url')
    .eq('slug', req.params.slug)
    .single();

  if (!clinic) return res.status(404).json({ error: 'Not found.' });
  res.json(clinic);
});

/**
 * PATCH /clinics/:slug
 * Auth protected — update clinic settings.
 */
router.patch('/:slug', requireAuth, async (req, res) => {
  if (req.clinic.slug !== req.params.slug) {
    return res.status(403).json({ error: 'Forbidden.' });
  }

  const allowed = ['name', 'google_review_url', 'booking_url', 'brand_color', 'logo_url'];
  const updates = Object.fromEntries(
    Object.entries(req.body).filter(([k]) => allowed.includes(k))
  );

  if (!Object.keys(updates).length) {
    return res.status(400).json({ error: 'No valid fields.' });
  }

  const { error } = await getSupabase().from('clinics').update(updates).eq('slug', req.params.slug);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

export default router;
