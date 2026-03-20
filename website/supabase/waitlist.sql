create table waitlist (
  id uuid default gen_random_uuid() primary key,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  clinic_name text not null,
  patient_count text,
  locations text,
  challenge text,
  created_at timestamptz default now()
);
