import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '../../lib/supabase-server';
import DashboardShell from './DashboardShell';

export const metadata = { title: 'Dashboard — DentaPass' };

export default async function DashboardLayout({ children }) {
  const supabase = createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  // Fetch clinic for this owner
  const { data: clinic } = await supabase
    .from('clinics')
    .select('id, name, slug, plan, patient_limit')
    .eq('owner_email', session.user.email)
    .maybeSingle();

  return (
    <DashboardShell clinic={clinic} userEmail={session.user.email}>
      {children}
    </DashboardShell>
  );
}
