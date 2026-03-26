-- DentaPass full schema migration
-- Run this in Supabase SQL editor or via supabase db push

-- ─────────────────────────────────────────────
-- EXTENSIONS
-- ─────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────
-- CLINICS
-- ─────────────────────────────────────────────
create table clinics (
  id                     uuid default gen_random_uuid() primary key,
  name                   text not null,
  slug                   text not null unique,
  owner_email            text not null unique,
  passkit_template_id    text,
  google_review_url      text,
  booking_url            text,
  brand_color            text default '#006FEE',
  logo_url               text,
  plan                   text not null default 'solo' check (plan in ('solo', 'clinic', 'group')),
  patient_limit          integer not null default 500,
  stripe_customer_id     text,
  stripe_subscription_id text,
  created_at             timestamptz default now()
);

-- ─────────────────────────────────────────────
-- PATIENTS
-- ─────────────────────────────────────────────
create table patients (
  id                    uuid default gen_random_uuid() primary key,
  clinic_id             uuid not null references clinics(id) on delete cascade,
  first_name            text not null,
  last_name             text not null,
  email                 text,
  phone                 text,
  passkit_serial_number text unique,
  points_balance        integer not null default 0,
  tier                  text not null default 'bronze' check (tier in ('bronze', 'silver', 'gold')),
  next_checkup_date     date,
  last_visit_date       timestamptz,
  referral_code         text not null unique,
  referred_by           uuid references patients(id),
  created_at            timestamptz default now()
);

create index patients_clinic_id_idx on patients(clinic_id);
create index patients_referral_code_idx on patients(referral_code);
create index patients_passkit_serial_idx on patients(passkit_serial_number);
create index patients_next_checkup_idx on patients(next_checkup_date);
create index patients_last_visit_idx on patients(last_visit_date);

-- ─────────────────────────────────────────────
-- POINT EVENTS
-- ─────────────────────────────────────────────
create table point_events (
  id          uuid default gen_random_uuid() primary key,
  patient_id  uuid not null references patients(id) on delete cascade,
  clinic_id   uuid not null references clinics(id) on delete cascade,
  points      integer not null,
  reason      text not null,  -- 'completed_visit' | 'left_review' | 'referred_friend' | 'custom' | 'recall_bonus'
  awarded_by  text,           -- staff identifier or 'system'
  created_at  timestamptz default now()
);

create index point_events_patient_id_idx on point_events(patient_id);
create index point_events_clinic_id_idx on point_events(clinic_id);

-- ─────────────────────────────────────────────
-- NOTIFICATIONS
-- ─────────────────────────────────────────────
create table notifications (
  id          uuid default gen_random_uuid() primary key,
  patient_id  uuid not null references patients(id) on delete cascade,
  clinic_id   uuid not null references clinics(id) on delete cascade,
  type        text not null check (type in ('recall', 'review', 'referral', 'manual')),
  sent_at     timestamptz default now(),
  opened_at   timestamptz
);

create index notifications_patient_id_idx on notifications(patient_id);
create index notifications_clinic_id_idx on notifications(clinic_id);
create index notifications_type_sent_idx on notifications(type, sent_at);

-- ─────────────────────────────────────────────
-- REFERRALS
-- ─────────────────────────────────────────────
create table referrals (
  id                  uuid default gen_random_uuid() primary key,
  referrer_patient_id uuid not null references patients(id) on delete cascade,
  referred_patient_id uuid not null references patients(id) on delete cascade,
  clinic_id           uuid not null references clinics(id) on delete cascade,
  points_awarded      integer not null default 250,
  created_at          timestamptz default now(),
  unique(referrer_patient_id, referred_patient_id)
);

create index referrals_referrer_idx on referrals(referrer_patient_id);
create index referrals_clinic_id_idx on referrals(clinic_id);

-- ─────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────

-- Clinics: only the owner can read/update their own clinic
alter table clinics enable row level security;

create policy "Clinic owners can read own clinic"
  on clinics for select
  using (owner_email = auth.jwt() ->> 'email');

create policy "Clinic owners can update own clinic"
  on clinics for update
  using (owner_email = auth.jwt() ->> 'email');

-- Service role bypass (for Edge Functions + API routes using service key)
-- The service key bypasses RLS entirely, so API routes use it safely.

-- Patients: clinic owners can only see their own patients
alter table patients enable row level security;

create policy "Clinic owners can read own patients"
  on patients for select
  using (
    clinic_id in (
      select id from clinics where owner_email = auth.jwt() ->> 'email'
    )
  );

create policy "Clinic owners can update own patients"
  on patients for update
  using (
    clinic_id in (
      select id from clinics where owner_email = auth.jwt() ->> 'email'
    )
  );

-- Point events
alter table point_events enable row level security;

create policy "Clinic owners can read own point events"
  on point_events for select
  using (
    clinic_id in (
      select id from clinics where owner_email = auth.jwt() ->> 'email'
    )
  );

-- Notifications
alter table notifications enable row level security;

create policy "Clinic owners can read own notifications"
  on notifications for select
  using (
    clinic_id in (
      select id from clinics where owner_email = auth.jwt() ->> 'email'
    )
  );

-- Referrals
alter table referrals enable row level security;

create policy "Clinic owners can read own referrals"
  on referrals for select
  using (
    clinic_id in (
      select id from clinics where owner_email = auth.jwt() ->> 'email'
    )
  );

-- ─────────────────────────────────────────────
-- HELPER FUNCTION: compute tier from points
-- ─────────────────────────────────────────────
create or replace function compute_tier(points integer)
returns text language sql immutable as $$
  select case
    when points >= 1000 then 'gold'
    when points >= 500  then 'silver'
    else 'bronze'
  end;
$$;

-- ─────────────────────────────────────────────
-- TRIGGER: auto-update tier on points change
-- ─────────────────────────────────────────────
create or replace function update_patient_tier()
returns trigger language plpgsql as $$
begin
  new.tier := compute_tier(new.points_balance);
  return new;
end;
$$;

create trigger patient_tier_update
  before insert or update of points_balance on patients
  for each row execute function update_patient_tier();
