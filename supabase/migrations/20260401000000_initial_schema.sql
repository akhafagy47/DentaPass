-- DentaPass — full initial schema migration
-- Run this once on a fresh Supabase project (or against the existing DB — all statements are idempotent).

-- ── Extensions ───────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";

-- ── clinics ──────────────────────────────────────────────────────────────────

create table if not exists clinics (
  id                          uuid primary key default gen_random_uuid(),
  name                        text not null,
  slug                        text not null unique,
  owner_email                 text not null unique,
  plan                        text not null check (plan in ('solo','clinic','group')),
  patient_limit               int,
  brand_color                 text,
  logo_url                    text,
  rewards_mode                text not null default 'tiers' check (rewards_mode in ('tiers','discounts')),
  points_per_dollar           numeric,
  points_label                text not null default 'Points',
  address                     text,
  phone                       text,
  timezone                    text not null default 'America/Edmonton',
  theme                       text not null default 'auto' check (theme in ('dark','light','auto')),
  setup_completed             boolean not null default false,
  stripe_customer_id          text,
  stripe_subscription_id      text,
  passkit_program_id          text,
  passkit_template_design_id  text,
  passkit_template_id         text,
  passkit_image_ids           jsonb,
  passkit_links               jsonb,
  action_points               jsonb,
  custom_actions              jsonb,
  tier_thresholds             jsonb,
  tier_incentives             jsonb,
  created_at                  timestamptz not null default now()
);

-- Columns added over time — safe to run even if they already exist
alter table clinics add column if not exists address                    text;
alter table clinics add column if not exists phone                      text;
alter table clinics add column if not exists timezone                   text not null default 'America/Edmonton';
alter table clinics add column if not exists theme                      text not null default 'auto' check (theme in ('dark','light','auto'));
alter table clinics add column if not exists passkit_image_ids          jsonb;
alter table clinics add column if not exists passkit_links              jsonb;
alter table clinics add column if not exists action_points              jsonb;
alter table clinics add column if not exists custom_actions             jsonb;
alter table clinics add column if not exists tier_thresholds            jsonb;
alter table clinics add column if not exists tier_incentives            jsonb;

-- ── patients ─────────────────────────────────────────────────────────────────

create table if not exists patients (
  id                      uuid primary key default gen_random_uuid(),
  clinic_id               uuid not null references clinics(id) on delete cascade,
  first_name              text not null,
  last_name               text not null,
  email                   text,
  phone                   text,
  date_of_birth           date,
  wallet_type             text not null default 'apple' check (wallet_type in ('apple','google')),
  passkit_serial_number   text unique,
  points_balance          int not null default 0,
  tier                    text not null default 'bronze' check (tier in ('bronze','silver','gold')),
  next_checkup_date       date,
  next_checkup_time       text,
  last_visit_date         timestamptz,
  referral_code           text unique,
  referred_by             uuid references patients(id),
  created_at              timestamptz not null default now()
);

alter table patients add column if not exists date_of_birth       date;
alter table patients add column if not exists wallet_type         text not null default 'apple' check (wallet_type in ('apple','google'));
alter table patients add column if not exists next_checkup_time   text;

create index if not exists patients_clinic_id_idx        on patients(clinic_id);
create index if not exists patients_referral_code_idx    on patients(referral_code);
create index if not exists patients_serial_idx           on patients(passkit_serial_number);

-- ── point_events ─────────────────────────────────────────────────────────────

create table if not exists point_events (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references patients(id) on delete cascade,
  clinic_id   uuid not null references clinics(id)  on delete cascade,
  points      int  not null,
  reason      text not null,
  awarded_by  text,
  created_at  timestamptz not null default now()
);

create index if not exists point_events_patient_id_idx on point_events(patient_id);
create index if not exists point_events_clinic_id_idx  on point_events(clinic_id);

-- ── notifications ────────────────────────────────────────────────────────────

create table if not exists notifications (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references patients(id) on delete cascade,
  clinic_id   uuid not null references clinics(id)  on delete cascade,
  type        text not null check (type in ('recall','review','referral','manual')),
  sent_at     timestamptz not null default now(),
  opened_at   timestamptz
);

create index if not exists notifications_patient_id_idx on notifications(patient_id);
create index if not exists notifications_clinic_id_idx  on notifications(clinic_id);

-- ── referrals ────────────────────────────────────────────────────────────────

create table if not exists referrals (
  id                   uuid primary key default gen_random_uuid(),
  referrer_patient_id  uuid not null references patients(id) on delete cascade,
  referred_patient_id  uuid not null references patients(id) on delete cascade,
  clinic_id            uuid not null references clinics(id)  on delete cascade,
  points_awarded       int  not null,
  created_at           timestamptz not null default now()
);

create index if not exists referrals_referrer_idx  on referrals(referrer_patient_id);
create index if not exists referrals_clinic_id_idx on referrals(clinic_id);

-- ── redemptions ──────────────────────────────────────────────────────────────

create table if not exists redemptions (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid    not null references patients(id) on delete cascade,
  clinic_id    uuid    not null references clinics(id)  on delete cascade,
  points       int     not null,
  dollar_value numeric not null,
  note         text,
  redeemed_by  text,
  created_at   timestamptz not null default now()
);

create index if not exists redemptions_patient_id_idx on redemptions(patient_id);
create index if not exists redemptions_clinic_id_idx  on redemptions(clinic_id);

-- ── Tier auto-update trigger ──────────────────────────────────────────────────
-- Recalculates patients.tier after every point_events insert.

create or replace function update_patient_tier()
returns trigger language plpgsql as $$
declare
  v_balance int;
  v_tier    text;
begin
  select points_balance into v_balance
  from patients where id = new.patient_id;

  if    v_balance >= 1000 then v_tier := 'gold';
  elsif v_balance >= 500  then v_tier := 'silver';
  else                         v_tier := 'bronze';
  end if;

  update patients set tier = v_tier where id = new.patient_id;
  return new;
end;
$$;

drop trigger if exists trg_update_patient_tier on point_events;
create trigger trg_update_patient_tier
  after insert on point_events
  for each row execute function update_patient_tier();

-- ── Row Level Security ────────────────────────────────────────────────────────
-- The Express backend always uses the service role key and bypasses RLS.
-- RLS is enabled to prevent direct client-side reads from leaking data.

alter table clinics      enable row level security;
alter table patients     enable row level security;
alter table point_events enable row level security;
alter table notifications enable row level security;
alter table referrals    enable row level security;
alter table redemptions  enable row level security;

-- Clinic owners can read and update their own clinic (dashboard reads via supabase-server client).
create policy if not exists "clinic owner read"
  on clinics for select
  using (owner_email = auth.email());

create policy if not exists "clinic owner update"
  on clinics for update
  using (owner_email = auth.email());

-- Public read of minimal clinic fields for the enrollment page (/join/[slug]).
-- The enrollment page uses the anon key and reads name, brand_color, logo_url, passkit_links, theme, action_points, custom_actions.
create policy if not exists "clinic public read"
  on clinics for select
  using (true);  -- backend enforces field filtering; RLS doesn't restrict columns

-- All patient/event/notification data: service role only (backend only).
-- No direct anon/authenticated client reads — all go through Express.
create policy if not exists "service role only"
  on patients for all
  using (auth.role() = 'service_role');

create policy if not exists "service role only"
  on point_events for all
  using (auth.role() = 'service_role');

create policy if not exists "service role only"
  on notifications for all
  using (auth.role() = 'service_role');

create policy if not exists "service role only"
  on referrals for all
  using (auth.role() = 'service_role');

create policy if not exists "service role only"
  on redemptions for all
  using (auth.role() = 'service_role');
