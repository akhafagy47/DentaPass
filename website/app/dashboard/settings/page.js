import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '../../../lib/supabase-server';
import SettingsClient from './SettingsClient';

export const metadata = { title: 'Settings — DentaPass' };

export default async function SettingsPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: clinic } = await supabase
    .from('clinics')
    .select('*')
    .eq('owner_email', user.email)
    .maybeSingle();

  if (!clinic) return <div>No clinic found.</div>;

  return <SettingsClient clinic={clinic} />;
}
