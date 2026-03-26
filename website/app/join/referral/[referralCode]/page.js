import { redirect } from 'next/navigation';
import { getSupabase } from '../../../../lib/supabase';

export default async function ReferralRedirectPage({ params }) {
  const { referralCode } = params;

  const supabase = getSupabase();

  // Look up the patient + their clinic via the referral code
  const { data: patient } = await supabase
    .from('patients')
    .select('referral_code, clinic:clinics(slug)')
    .eq('referral_code', referralCode)
    .maybeSingle();

  if (!patient || !patient.clinic?.slug) {
    // Invalid referral code — redirect to homepage
    redirect('/');
  }

  redirect(`/join/${patient.clinic.slug}?ref=${referralCode}`);
}
