import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '../../../lib/supabase-server';
import ScanClient from './ScanClient';

export const metadata = { title: 'Scanner — DentaPass' };

export default async function ScanPage({ params }) {
  const { clinicSlug } = params;

  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: clinic } = await supabase
    .from('clinics')
    .select('id, slug')
    .eq('owner_email', user.email)
    .eq('slug', clinicSlug)
    .maybeSingle();

  if (!clinic) redirect('/dashboard');

  return <ScanClient clinicSlug={clinicSlug} />;
}
