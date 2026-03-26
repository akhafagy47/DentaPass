import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '../../../lib/supabase-server';
import SettingsClient from './SettingsClient';

export const metadata = { title: 'Settings — DentaPass' };

export default async function SettingsPage() {
  const supabase = createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) redirect('/login');

  const { data: clinic } = await supabase
    .from('clinics')
    .select('*')
    .eq('owner_email', session.user.email)
    .maybeSingle();

  if (!clinic) return <div>No clinic found.</div>;

  return <SettingsClient clinic={clinic} />;
}
