-- Add social media URL columns to clinics
alter table clinics add column if not exists facebook_url  text;
alter table clinics add column if not exists instagram_url text;
