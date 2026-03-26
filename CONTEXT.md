# DentaPass — Development Context

**Version**: MVP
**Last updated**: March 2026
**Stack**: Next.js 14 (App Router), Supabase, PassKit, Stripe

---

## What DentaPass Is

Digital wallet loyalty card platform for dental clinics. Patients scan a QR code at reception → get a branded Apple/Google Wallet card instantly (no app download). The card automates recall reminders, Google review requests, and a referral program.

---

## Repository Structure

```
/website    — Next.js 14 app (landing page + enrollment + dashboard + all API routes)
/backend    — Empty for MVP (Next.js API routes live in /website)
/mobile     — Out of scope for MVP (React Native, post-MVP)
```

---

## Key Architecture Decisions

- **One codebase** (`/website`) for landing page, patient enrollment, staff scanner, and clinic dashboard
- **PassKit** handles wallet pass creation, hosting, and push notifications (not Apple/Google APIs directly)
- **Business logic in API routes** — client components never call PassKit or Stripe directly
- **Patient limits enforced server-side** before calling PassKit
- **Supabase Edge Functions** for automated recall/review jobs (not Vercel cron)
- **RLS on all tables** — service key used only in API routes, never in client code

---

## What's Built (MVP)

### Database
- `supabase/migrations/001_schema.sql` — clinics, patients, point_events, notifications, referrals with RLS + auto-tier trigger
- `supabase/migrations/002_cron_schedules.sql` — pg_cron for recall (daily 9am UTC) and review (every 2h) jobs
- `supabase/waitlist.sql` — waitlist table (already deployed)

### Patient-Facing (no auth)
- `app/join/[clinicSlug]/page.js` — enrollment form, generates wallet pass via PassKit
- `app/join/referral/[referralCode]/page.js` — resolves referral code → redirects to join page

### Staff-Facing (no auth, URL is the access control)
- `app/scan/[clinicSlug]/page.js` — camera QR scanner, awards points, updates wallet card within 3s

### Clinic Dashboard (Supabase Auth, email/password)
- `middleware.js` — protects `/dashboard/**`
- `app/login/page.js` — login form
- `app/dashboard/page.js` — home with stats (patients, checkups, reviews, points)
- `app/dashboard/patients/page.js` — searchable/filterable patient list
- `app/dashboard/patients/[id]/page.js` — patient profile, point history, notifications, award points, set checkup date
- `app/dashboard/settings/page.js` — clinic name, URLs, brand color, billing

### API Routes
| Route | Method | Purpose |
|---|---|---|
| `/api/enroll` | POST | Create patient + PassKit pass + referral credit |
| `/api/points/award` | POST | Award points + push wallet update |
| `/api/patients/by-serial/[serial]` | GET | Look up patient from wallet card QR |
| `/api/patients/[id]` | PATCH | Update checkup date / contact info |
| `/api/patients/[id]/notify` | POST | Send manual push notification |
| `/api/clinic/[slug]` | GET/PATCH | Fetch / update clinic settings |
| `/api/billing/create-checkout` | POST | Stripe checkout session |
| `/api/billing/portal` | GET | Redirect to Stripe billing portal |
| `/api/webhooks/stripe` | POST | Handle subscription events |

### Edge Functions
- `supabase/functions/recall-reminders/` — daily 9am UTC, patients where next_checkup_date = today+30 days
- `supabase/functions/review-requests/` — every 2h, patients visited ~2h ago, 90-day cooldown

### Service Layer (`lib/`)
- `passkit.js` — PassKit REST API wrapper (createClinicTemplate, enrollPatient, updatePatientPass, sendPushNotification, deletePatientPass)
- `stripe.js` — Stripe singleton + plan config + checkout/portal helpers
- `supabase.js` — service key client (API routes only — bypasses RLS)
- `supabase-server.js` — SSR auth client using @supabase/ssr (server components, middleware)
- `supabase-browser.js` — browser client using @supabase/ssr (client components)

---

## Loyalty Tiers

| Tier | Points Required |
|------|----------------|
| Bronze | 0–499 |
| Silver | 500–999 |
| Gold | 1,000+ |

Tier is auto-updated via a Postgres trigger (`update_patient_tier`) when `points_balance` changes.

## Points Reasons

| Reason | Points |
|--------|--------|
| `completed_visit` | +100 |
| `left_review` | +100 |
| `referred_friend` | +250 |
| `custom` | variable |

---

## Plans & Pricing (CAD)

| Plan | Monthly | Patients | Setup Fee |
|------|---------|----------|-----------|
| Solo | $199 | 500 | $249 |
| Clinic | $349 | 2,000 | $249 |
| Group | $599 | Unlimited | $399 |

Founding clinic offer: Solo at $149/month locked for life, no setup fee (first 5 clinics).

---

## Setup Before First Run

1. Copy `.env.local.example` → `.env.local`, fill in all values
2. `cd website && npm install`
3. Run `supabase/migrations/001_schema.sql` in Supabase SQL editor
4. Set up PassKit: create Member Program, get API key/secret
5. Set up Stripe: create products matching the 3 plans, get price IDs
6. Deploy Edge Functions: `supabase functions deploy recall-reminders review-requests`
7. Run `supabase/migrations/002_cron_schedules.sql` (after setting DB app settings)
8. Register Stripe webhook endpoint → `/api/webhooks/stripe`

---

## Known Limitations / Post-MVP

- **Clinic onboarding**: Clinic rows must be inserted manually in Supabase for now (no self-serve signup flow)
- **PassKit template**: Must be created manually in PassKit dashboard for each clinic (one template per clinic)
- **Mobile app**: Out of scope — clinic owners use the web dashboard on mobile browser
- **Scanner HTTPS**: Requires HTTPS — use ngrok or deployed preview for local testing
- **Multi-location**: Not supported in MVP
- **PMS integration**: Not in scope
