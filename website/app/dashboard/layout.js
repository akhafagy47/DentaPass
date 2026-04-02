import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createSupabaseServerClient } from '../../lib/supabase-server';
import DashboardShell from './DashboardShell';

export const metadata = { title: 'Dashboard — DentaPass' };

export default async function DashboardLayout({ children }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: clinic } = await supabase
    .from('clinics')
    .select('id, name, slug, plan, patient_limit, setup_completed, theme')
    .eq('owner_email', user.email)
    .maybeSingle();

  // Redirect to setup wizard on first login — skip if already on the setup page
  const pathname = headers().get('x-pathname') || '';
  if (clinic && !clinic.setup_completed && !pathname.includes('/setup')) {
    redirect('/dashboard/setup');
  }

  return (
    <DashboardShell clinic={clinic} userEmail={user.email}>
      {children}
    </DashboardShell>
  );
}
