import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '../../../lib/supabase-server';
import SetupWizard from './SetupWizard';

export const metadata = { title: 'Set up your card — DentaPass' };

export default async function SetupPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: clinic } = await supabase
    .from('clinics')
    .select('*')
    .eq('owner_email', user.email)
    .maybeSingle();

  if (!clinic) redirect('/login');

  // Already set up — send to dashboard
  if (clinic.setup_completed) redirect('/dashboard');

  return <SetupWizard clinic={clinic} />;
}
