import { Router } from 'express';
import { getStripe, PLANS } from '../lib/stripe.js';
import { getSupabase } from '../lib/supabase.js';
import { requireAuth } from '../lib/authMiddleware.js';

const router = Router();

/**
 * POST /billing/checkout
 * Create a Stripe Checkout session for a new clinic subscription.
 */
router.post('/checkout', async (req, res) => {
  const { plan, email } = req.body;

  if (!PLANS[plan]) return res.status(400).json({ error: 'Invalid plan.' });
  if (!email)       return res.status(400).json({ error: 'Email is required.' });

  const websiteUrl = process.env.WEBSITE_URL || 'http://localhost:3000';

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: 'subscription',
      customer_email: email,
      line_items: [{ price: PLANS[plan].priceId, quantity: 1 }],
      metadata: { plan, ownerEmail: email },
      subscription_data: { metadata: { plan, ownerEmail: email } },
      success_url: `${websiteUrl}/onboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${websiteUrl}/#pricing`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: 'Failed to create checkout session.' });
  }
});

/**
 * GET /billing/portal
 * Redirect authenticated clinic owner to Stripe billing portal.
 */
router.get('/portal', requireAuth, async (req, res) => {
  if (!req.clinic.stripe_customer_id) {
    return res.status(400).json({ error: 'No Stripe customer found.' });
  }

  const websiteUrl = process.env.WEBSITE_URL || 'http://localhost:3000';

  try {
    const { url } = await getStripe().billingPortal.sessions.create({
      customer: req.clinic.stripe_customer_id,
      return_url: `${websiteUrl}/dashboard/settings`,
    });
    res.json({ url });
  } catch (err) {
    console.error('Billing portal error:', err);
    res.status(500).json({ error: 'Failed to open billing portal.' });
  }
});

/**
 * POST /billing/webhook
 * Stripe subscription lifecycle events.
 * Note: body is raw Buffer (mounted before express.json() in server.js).
 */
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = getStripe().webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).json({ error: `Webhook signature error: ${err.message}` });
  }

  const supabase = getSupabase();

  switch (event.type) {
    case 'checkout.session.completed': {
      const { clinicId, plan } = event.data.object.metadata || {};
      if (plan) {
        await supabase.from('clinics').update({
          plan,
          patient_limit: PLANS[plan]?.patientLimit ?? null,
          stripe_customer_id: event.data.object.customer,
          stripe_subscription_id: event.data.object.subscription,
        }).eq('id', clinicId);
      }
      break;
    }
    case 'customer.subscription.updated': {
      const { clinicId, plan } = event.data.object.metadata || {};
      if (clinicId && plan) {
        await supabase.from('clinics').update({
          plan,
          patient_limit: PLANS[plan]?.patientLimit ?? null,
        }).eq('id', clinicId);
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const { clinicId } = event.data.object.metadata || {};
      if (clinicId) {
        await supabase.from('clinics').update({ plan: 'solo', patient_limit: 500 }).eq('id', clinicId);
      }
      break;
    }
    case 'invoice.payment_failed':
      console.warn('Payment failed for customer:', event.data.object.customer);
      break;
  }

  res.json({ received: true });
});

export default router;
