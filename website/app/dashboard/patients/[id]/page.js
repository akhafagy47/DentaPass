import { redirect, notFound } from 'next/navigation';
import { createSupabaseServerClient } from '../../../../lib/supabase-server';
import PatientProfileClient from './PatientProfileClient';

export const metadata = { title: 'Patient — DentaPass' };

export default async function PatientProfilePage({ params }) {
  const { id } = params;
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: clinic } = await supabase
    .from('clinics')
    .select('id, passkit_links')
    .eq('owner_email', user.email)
    .maybeSingle();

  if (!clinic) return <div>No clinic found.</div>;

  const { data: patient } = await supabase
    .from('patients')
    .select('*')
    .eq('id', id)
    .eq('clinic_id', clinic.id)
    .maybeSingle();

  if (!patient) notFound();

  const [{ data: pointEvents }, { data: notifications }, { data: referrals }] =
    await Promise.all([
      supabase
        .from('point_events')
        .select('*')
        .eq('patient_id', id)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('notifications')
        .select('*')
        .eq('patient_id', id)
        .order('sent_at', { ascending: false })
        .limit(30),
      supabase
        .from('referrals')
        .select('*, referred:patients!referrals_referred_patient_id_fkey(first_name, last_name)')
        .eq('referrer_patient_id', id)
        .order('created_at', { ascending: false }),
    ]);

  return (
    <PatientProfileClient
      patient={patient}
      pointEvents={pointEvents ?? []}
      notifications={notifications ?? []}
      referrals={referrals ?? []}
      clinicId={clinic.id}
      googleReviewUrl={(clinic.passkit_links || []).find((l) => l.title === 'Leave a Google Review')?.url || ''}
    />
  );
}
