-- Add per-clinic rewards configuration columns
alter table clinics
  add column if not exists tier_thresholds jsonb not null default '{"bronze":0,"silver":5000,"gold":10000}',
  add column if not exists tier_incentives jsonb not null default '{"bronze":["Priority scheduling","10% off cosmetic treatments","Birthday discount"],"silver":["All Bronze perks","Free cleaning every 6 months","15% off cosmetic treatments"],"gold":["All Silver perks","Free annual whitening kit","25% off all treatments"]}',
  add column if not exists action_points   jsonb not null default '{"completed_visit":500,"left_review":500,"referred_friend":500,"birthday":250}',
  add column if not exists custom_actions  jsonb not null default '[]';

-- Add date of birth to patients
alter table patients
  add column if not exists date_of_birth date;

-- Update tier trigger to use per-clinic thresholds instead of hardcoded values
create or replace function update_patient_tier()
returns trigger language plpgsql as $$
declare
  thresholds jsonb;
  silver_t   integer;
  gold_t     integer;
begin
  select tier_thresholds into thresholds
  from clinics where id = new.clinic_id;

  silver_t := coalesce((thresholds->>'silver')::integer, 5000);
  gold_t   := coalesce((thresholds->>'gold')::integer, 10000);

  if new.points_balance >= gold_t then
    new.tier := 'gold';
  elsif new.points_balance >= silver_t then
    new.tier := 'silver';
  else
    new.tier := 'bronze';
  end if;
  return new;
end;
$$;
