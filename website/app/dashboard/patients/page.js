import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '../../../lib/supabase-server';
import PatientsClient from './PatientsClient';

export const metadata = { title: 'Patients — DentaPass' };

export default async function PatientsPage() {
  const supabase = createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) redirect('/login');

  const { data: clinic } = await supabase
    .from('clinics')
    .select('id')
    .eq('owner_email', session.user.email)
    .maybeSingle();

  if (!clinic) return <div>No clinic found.</div>;

  const { data: patients } = await supabase
    .from('patients')
    .select('id, first_name, last_name, email, points_balance, tier, last_visit_date, next_checkup_date, created_at')
    .eq('clinic_id', clinic.id)
    .order('created_at', { ascending: false });

  return <PatientsClient patients={patients ?? []} />;
}
