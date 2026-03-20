import { NextResponse } from 'next/server';
import { getSupabase } from '../../../lib/supabase';

export async function POST(request) {
  try {
    const { firstName, lastName, email, phone, clinicName, patientCount, locations, challenge } =
      await request.json();

    const supabase = getSupabase();
    const { error } = await supabase.from('waitlist').insert([
      {
        first_name: firstName,
        last_name: lastName,
        email,
        phone: phone || null,
        clinic_name: clinicName,
        patient_count: patientCount || null,
        locations: locations || null,
        challenge: challenge || null,
      },
    ]);

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ ok: false }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Waitlist API error:', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
