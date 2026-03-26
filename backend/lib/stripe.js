import Stripe from 'stripe';

let _stripe = null;

export function getStripe() {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-06-20',
    });
  }
  return _stripe;
}

export const PLANS = {
  solo:   { priceId: process.env.STRIPE_PRICE_SOLO,   patientLimit: 500,  setupFee: 24900 },
  clinic: { priceId: process.env.STRIPE_PRICE_CLINIC, patientLimit: 2000, setupFee: 24900 },
  group:  { priceId: process.env.STRIPE_PRICE_GROUP,  patientLimit: null, setupFee: 39900 },
};

export const ADDONS = {
  addon_250:  { priceId: process.env.STRIPE_PRICE_ADDON_250,  patients: 250  },
  addon_500:  { priceId: process.env.STRIPE_PRICE_ADDON_500,  patients: 500  },
  addon_1000: { priceId: process.env.STRIPE_PRICE_ADDON_1000, patients: 1000 },
};

/**
 * Create a Stripe Checkout session for a new clinic subscription.
 * Returns { url } — redirect the user to this URL.
 */
export async function createCheckoutSession({ plan, clinicId, ownerEmail, successUrl, cancelUrl }) {
  const stripe = getStripe();
  const planConfig = PLANS[plan];
  if (!planConfig) throw new Error(`Unknown plan: ${plan}`);

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: ownerEmail,
    line_items: [{ price: planConfig.priceId, quantity: 1 }],
    metadata: { clinicId, plan },
    success_url: successUrl,
    cancel_url: cancelUrl,
    subscription_data: {
      metadata: { clinicId, plan },
    },
  });

  return { url: session.url };
}

/**
 * Retrieve the Stripe customer portal URL for managing billing.
 */
export async function createBillingPortalSession({ stripeCustomerId, returnUrl }) {
  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: returnUrl,
  });
  return { url: session.url };
}
