import { verifyToken, getSupabase } from './supabase.js';

/**
 * Verifies the Supabase JWT and attaches req.user + req.clinic.
 * Rejects with 401 if unauthenticated, 403 if no clinic found.
 */
export async function requireAuth(req, res, next) {
  const user = await verifyToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: 'Unauthorized.' });

  const supabase = getSupabase();
  const { data: clinic } = await supabase
    .from('clinics')
    .select('id, slug, name, plan, patient_limit, passkit_template_id, google_review_url, booking_url, brand_color, stripe_customer_id')
    .eq('owner_email', user.email)
    .maybeSingle();

  if (!clinic) return res.status(403).json({ error: 'No clinic found for this account.' });

  req.user = user;
  req.clinic = clinic;
  next();
}
