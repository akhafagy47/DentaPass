# DentaPass — Development Context

**Version**: MVP
**Last updated**: March 2026
**Stack**: Next.js 14 (App Router) · Express.js backend · Supabase · PassKit · Stripe

---

## What DentaPass Is

Digital wallet loyalty card platform for independent dental clinics. Patients scan a QR code at reception → get a branded Apple/Google Wallet card instantly (no app download). The card automates recall reminders, Google review requests, and a referral program.

**Core problem being solved:** Independent dental clinics lose patients due to poor recall systems, get very few Google reviews, and have no structured referral program. Existing tools cost $200–600/month and don't use wallet cards. DentaPass solves all three with a single wallet pass as the primary patient touchpoint.

**Every feature and UX decision should center on the wallet card as the primary patient touchpoint.**

---

## Repository Structure

```
/DentaPass
├── CONTEXT.md                         — This file. Read at the start of every session.
├── /backend                           — Express.js API server (ESM modules, port 4001)
│   ├── index.js                       — Entry point: mounts all routers, CORS, JSON body parser
│   ├── /clinics/index.js              — Clinic routes (see Backend Routes section)
│   ├── /patients/index.js             — Patient routes (see Backend Routes section)
│   ├── /billing/index.js              — Stripe checkout session creation + billing portal redirect
│   └── /lib
│       ├── passkit.js                 — Full PassKit API integration (see PassKit section)
│       ├── stripe.js                  — Stripe client singleton + PLANS config
│       ├── supabase.js                — Supabase admin client using service role key (bypasses RLS)
│       └── authMiddleware.js          — Reads Bearer token, verifies via Supabase, attaches clinic to req
└── /website                           — Next.js 14 App Router (deployed on Vercel)
    ├── middleware.js                  — Protects /dashboard/** — redirects to /login if no session
    ├── /app
    │   ├── globals.css                — Global styles: .dp-spinner keyframes, .reveal animation, CSS vars
    │   ├── layout.js                  — Root layout: DM Sans font, SpeedInsights
    │   ├── page.js                    — Marketing landing page + waitlist form
    │   ├── /login/page.js             — Email/password login via Supabase Auth
    │   ├── /onboard/page.js           — Post-Stripe payment clinic account setup
    │   ├── /onboard/dev/page.js       — DEV ONLY: bypasses Stripe (NEXT_PUBLIC_DEV_ONBOARD=true)
    │   ├── /join/[clinicSlug]/page.js                — Patient enrollment form → generates wallet pass
    │   ├── /join/referral/[referralCode]/page.js     — Resolves referral code → redirects to join page
    │   ├── /scan/[clinicSlug]/page.js                — Camera QR scanner for staff to award points
    │   └── /dashboard
    │       ├── layout.js                             — Auth gate: reads session server-side
    │       ├── DashboardShell.js                     — Sidebar nav + clinic name/plan header
    │       ├── page.js                               — Analytics home: stats cards (patients, checkups, reviews, points)
    │       ├── /setup/page.js                        — Setup page wrapper (server component)
    │       ├── /setup/SetupWizard.js                 — Multi-step setup wizard (client component)
    │       ├── /settings/page.js                     — Settings page wrapper (server component)
    │       ├── /settings/SettingsClient.js            — Full settings form: brand, logo, rewards, links, billing
    │       ├── /patients/page.js                     — Patients page wrapper
    │       ├── /patients/PatientsClient.js            — Searchable/filterable patient list
    │       ├── /patients/[id]/page.js                — Patient page wrapper
    │       ├── /patients/[id]/PatientProfileClient.js — Profile, point history, award points, checkup date, notifications
    │       └── /analytics/page.js                    — Analytics with period selector
    ├── /components
    │   └── Spinner.js                 — Shared <Spinner size color /> component using .dp-spinner CSS class
    └── /lib
        ├── api.js                     — All fetch calls to Express backend (apiFetch throws on non-OK responses)
        ├── supabase-browser.js        — Browser Supabase client singleton (@supabase/ssr)
        └── squareCrop.js              — cropAll(file): 3 PNG blobs (87px icon, 320px thumbnail, 660px logo) via canvas
```

---

## Key Architecture Decisions

- **Separate Express.js backend** (`/backend`, port 4001). NOT Next.js API routes. All business logic, PassKit calls, Stripe calls, and Supabase admin operations live here.
- **`website/lib/api.js` is the only place** the frontend talks to the backend. All functions call `apiFetch` which throws `new Error(data.error)` on any non-OK response, so callers can use `try/catch` cleanly.
- **Supabase Auth email/password** — no magic links, no OAuth. Clinics log in with email + password set at onboard.
- **PassKit** handles wallet pass creation, hosting, push notifications — not Apple/Google APIs directly.
- **Patient limits enforced server-side** in Express before calling PassKit.
- **Supabase Edge Functions + pg_cron** for scheduled tasks (recall reminders, review requests) — NOT Vercel cron.
- **RLS on all tables** — the Supabase service role key is only used in the Express backend, never in client code.
- **One PassKit account (DentaPass-owned)** — one program + template + tier per clinic, one pass per patient.

---

## Database Schema (current)

### `clinics`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| name | text | Clinic display name |
| slug | text | URL-safe identifier, generated from name at onboard. Used in enrollment URL: `dentapass.ca/join/[slug]` |
| owner_email | text | Used for auth lookup |
| plan | text | 'solo' / 'growth' / 'pro' |
| patient_limit | int | Null = unlimited (pro plan) |
| brand_color | text | Hex string e.g. '#0ea5a0' |
| logo_url | text | Supabase public URL of 660×660 logo PNG |
| rewards_mode | text | 'tiers' or 'discounts' |
| points_per_dollar | numeric | Only used when rewards_mode = 'discounts' |
| points_label | text | What to call points on the card (e.g. "Points") |
| booking_url | text | Link on wallet card |
| google_review_url | text | Link for review request push notifications |
| address | text | Optional — powers "Get Directions" on card |
| phone | text | Optional — powers "Call Us" on card |
| timezone | text | Default: 'America/Edmonton' |
| setup_completed | bool | False until setup wizard is fully completed including PassKit |
| stripe_customer_id | text | |
| stripe_subscription_id | text | |
| passkit_program_id | text | PassKit Program ID (created at setup completion) |
| passkit_template_design_id | text | PassKit Template Design ID |
| passkit_template_id | text | PassKit Tier ID — used when enrolling patients and updating cards |
| passkit_logo_image_id | text | JSON string: `{"icon":"cdn_url","thumbnail":"cdn_url","logo":"cdn_url"}` |

### `patients`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| clinic_id | uuid | FK → clinics |
| first_name | text | |
| last_name | text | |
| email | text | |
| phone | text | |
| passkit_serial_number | text | The wallet pass serial number from PassKit |
| points_balance | int | |
| tier | text | 'bronze' / 'silver' / 'gold' — auto-updated by Postgres trigger |
| next_checkup_date | date | |
| last_visit_date | timestamptz | |
| referral_code | text | Unique per patient, used in `dentapass.ca/join/referral/[code]` |
| referred_by | uuid | FK → patients (the referrer) |

### `point_events`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| patient_id | uuid | FK → patients |
| clinic_id | uuid | FK → clinics |
| points | int | Can be negative |
| reason | text | 'completed_visit' / 'left_review' / 'referred_friend' / 'recall_bonus' / 'custom' / 'system' |
| awarded_by | text | 'dashboard' / 'system' / staff identifier |

### `notifications`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| patient_id | uuid | FK → patients |
| clinic_id | uuid | FK → clinics |
| type | text | 'recall' / 'review' / 'referral' / 'manual' |
| sent_at | timestamptz | |
| opened_at | timestamptz | Null until opened |

### `referrals`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| referrer_patient_id | uuid | FK → patients |
| referred_patient_id | uuid | FK → patients |
| clinic_id | uuid | FK → clinics |
| points_awarded | int | |

---

## Loyalty Tiers

| Tier   | Points Required |
|--------|----------------|
| Bronze | 0 – 499        |
| Silver | 500 – 999      |
| Gold   | 1,000+         |

Tier is auto-updated by a Postgres trigger (`update_patient_tier`) on `point_events` insert. Points reasons: `completed_visit` (+100), `left_review` (+100), `referred_friend` (+250), `recall_bonus` (variable), `custom` (variable), `system` (variable).

---

## Plans & Pricing (CAD)

| Plan   | Monthly | Patients  |
|--------|---------|-----------|
| Solo   | $199    | 500       |
| Growth | $349    | 2,000     |
| Pro    | $599    | Unlimited |

Founding clinic offer: Solo at $149/month locked for life, no setup fee (first 5 clinics, beta feedback + testimonial).
Add-ons: +250 patients $29/mo, +500 patients $55/mo, +1000 patients $99/mo.

---

## Go-to-Market

- Target: Independent dental clinics in Edmonton, Alberta
- First client: Dr. Maged Elboraee — Smart Dental Art, Windermere
- Channels: personal outreach, cold email, Instagram organic + $5–10/day story ads

---

## Backend Routes (`/backend`)

### `POST /clinics/onboard`
Called after Stripe payment. Receives `sessionId, clinicName, password`. Verifies payment via Stripe, creates Supabase auth user (email pre-confirmed), generates unique slug, inserts clinic row. **Does NOT create PassKit objects** — that happens at setup wizard completion.

### `POST /clinics/onboard/dev`
DEV ONLY — blocked in production (`NODE_ENV === 'production'` returns 404). Same as above but bypasses Stripe. Accepts `email, clinicName, password, plan`.

### `GET /clinics/onboard/session?session_id=...`
Retrieves the owner email from a Stripe checkout session (used by the /onboard page to pre-fill email).

### `GET /clinics/:slug`
Public — returns `name, brand_color, logo_url, booking_url` for the patient enrollment page.

### `PATCH /clinics/:id` (auth required)
Updates clinic settings. Whitelisted fields only: `name, google_review_url, booking_url, brand_color, logo_url, rewards_mode, points_per_dollar, points_label, setup_completed, address, phone`. All other body fields are silently ignored.

**Special behavior when `setup_completed: true` is sent:**
1. Saves all other fields to DB first — but NOT `setup_completed`
2. Fetches full clinic row from DB
3. Runs PassKit logo upload + program + template + tier creation **synchronously** (not fire-and-forget)
4. Only on full success: saves `setup_completed: true` + all PassKit IDs in one DB update
5. If any step fails: returns `500 { error: message }` — setup wizard catches this and shows the error without advancing to "All set!"

**Special behavior when design fields change** (`name, brand_color, logo_url, points_label, rewards_mode, points_per_dollar, booking_url`):
- Calls `updateClinicTemplate` fire-and-forget after responding — pushes design changes to all existing wallet passes
- If `logo_url` changed: re-uploads to PassKit first to get new CDN URLs, updates `passkit_logo_image_id`
- This path is NOT triggered when `setup_completed` is being set (that returns early)

### Patient routes (all in `/patients/index.js`)
- `POST /enrollment` — create patient + PassKit pass + referral credit
- `GET /patients/by-serial/:serial` — look up patient from wallet card QR scan
- `PATCH /patients/:id` (auth) — update checkup date / contact info
- `POST /points/award` (auth) — award points + push wallet card update via PassKit
- `POST /patients/:id/notify` (auth) — send manual push notification (recall or review)

---

## Auth Flow

1. Clinic owner logs in at `/login` with email/password via `supabase.auth.signInWithPassword`
2. On success: `window.location.href = next` (next defaults to `/dashboard`)
3. Dashboard `middleware.js` reads session server-side, redirects to `/login?next=/dashboard` if unauthenticated
4. Backend auth: `authMiddleware.js` reads `Authorization: Bearer <token>`, verifies via `supabase.auth.getUser(token)`, fetches the clinic row matching `owner_email`, attaches it to `req.clinic`

**CRITICAL:** Never use `router.push() + router.refresh()` after auth state changes. This causes an infinite redirect loop (`SecurityError: history.replaceState called > 100 times`). Always use `window.location.href = '/target'` for post-auth navigation.

**Why:** Next.js App Router's `router.refresh()` triggers a concurrent server re-render that races with the cookie/session state, causing the auth middleware to fire repeatedly.

---

## Setup Wizard (`/dashboard/setup/SetupWizard.js`)

Multi-step wizard shown after Stripe payment and before the clinic can use the dashboard. Blocked until `clinic.setup_completed === true`.

### Steps
0. **Brand** — clinic name, brand color (preset swatches + hex input + live card preview), logo upload
1. **Rewards** — mode: 'tier system' or 'discount redemption'; if discounts: points-per-dollar conversion rate
2. **Links** — online booking URL, Google review URL
3. **Clinic info** — address (optional, powers "Get Directions" on card), phone (optional, powers "Call Us" on card)
4. **Done** — "All set!" screen with "Go to Dashboard" button

### Logo Requirement
A logo is **required** — the wizard blocks advancing past step 0 without one. The error "Please upload a clinic logo — it is required for the wallet card." is shown if you try.

### Logo Upload Process (`website/lib/squareCrop.js`)
1. User selects any image (any aspect ratio, any format)
2. `cropAll(file)` generates three PNG blobs via canvas center-crop:
   - `icon` → 87×87px (Apple Wallet icon slot)
   - `thumbnail` → 320×320px (Google Wallet pass image slot)
   - `logo` → 660×660px (Apple Wallet logo strip slot)
3. All three are uploaded to Supabase Storage concurrently:
   - `{clinicId}/logo-icon.png`
   - `{clinicId}/logo-thumbnail.png`
   - `{clinicId}/logo.png`
4. The 660px public URL is stored as `form.logo_url` (used for display in the card preview)
5. **Minimum source size:** 200×200px. Below this `cropAll` throws and the upload is aborted.

### Final Step Submission
When the user clicks "Finish setup" on the last form step, the wizard sends `PATCH /clinics/:id` with `setup_completed: true` plus all form fields. If the backend returns an error (e.g., PassKit failed), `setError(err.message)` is called and the wizard stays on the current step. Only if the response is successful does `setStep(STEPS.length - 1)` advance to the "Done" screen.

---

## PassKit Integration (`backend/lib/passkit.js`)

### Object Hierarchy
```
Program  (passkit_program_id)          — top-level grouping for a clinic's loyalty scheme
  └── Template Design  (passkit_template_design_id) — visual pass design (colors, fields, images)
        └── Tier  (passkit_template_id)             — links program to design, controls enrollment
              └── Member                            — individual patient wallet pass
                    passkit_serial_number stored in patients table
```

**All three (Program + Template + Tier) must be created sequentially in one shot** at setup wizard completion. Creating them at different times causes race conditions (e.g., program not yet saved to DB when template creation fires).

### PassKit API Auth
- Base URL: `PASSKIT_BASE` env var
- Auth: `getToken()` exchanges `PASSKIT_API_KEY` + `PASSKIT_ACCOUNT_ID` for a short-lived JWT Bearer token

### Image Upload (`uploadClinicLogo`)
**Endpoint:** `POST /images` (JSON body — NOT `POST /membership/image` with binary body)

**Request:**
```json
{
  "name": "Clinic Name Logo",
  "imageData": {
    "icon":      "https://supabase.../logo-icon.png",
    "thumbnail": "https://supabase.../logo-thumbnail.png",
    "logo":      "https://supabase.../logo.png"
  }
}
```

The backend derives icon/thumbnail URLs from `clinic.logo_url`:
```js
const logoBase    = clinic.logo_url.replace(/\/logo\.png(\?.*)?$/, '/');
const iconUrl      = logoBase + 'logo-icon.png';
const thumbnailUrl = logoBase + 'logo-thumbnail.png';
```

**Response:** CDN URLs keyed by image type: `{ icon: "https://cdn...", thumbnail: "https://cdn...", logo: "https://cdn..." }`

**Storage:** `clinics.passkit_logo_image_id` stores the full JSON string:
```json
{"icon":"https://cdn.passkit.com/...","thumbnail":"https://cdn.passkit.com/...","logo":"https://cdn.passkit.com/..."}
```

### Template `imageIds`
`buildTemplateBody` in `passkit.js` parses `passkit_logo_image_id` as JSON to use each CDN URL for its correct slot:
```js
const ids = JSON.parse(clinic.passkit_logo_image_id);
imageIds: { icon: ids.icon, thumbnail: ids.thumbnail, logo: ids.logo }
```
Falls back gracefully to using the plain string for all three slots if JSON.parse fails (legacy data).

**IMPORTANT:** `imageIds` takes the PassKit CDN URLs (from the `POST /images` response), NOT the Supabase Storage URLs.

### Link Types
**All link types must be `URI_WEB`** — never `URI_PHONE`. PassKit proto3 decodes `URI_PHONE` as 0 (the zero value for the enum), causing "validation error Links[n].Type min tag". Even phone number links must use `URI_WEB`.

### Card Design Updates (fire-and-forget)
When design fields change in settings (name, brand_color, logo_url, points_label, rewards_mode, points_per_dollar, booking_url), `updateClinicTemplate` runs fire-and-forget after the PATCH response is sent. This is intentionally non-blocking — pass design updates are best-effort and don't block the save UX.

### PassKit Errors Encountered and Their Fixes

| Error Message | Root Cause | Fix Applied |
|---|---|---|
| "design requires a minimum of an icon image" | Wrong upload endpoint (`POST /membership/image` with binary body) or `imageId` was undefined | Use `POST /images` with JSON `imageData` object |
| "validation error Links[n].Type min" | `URI_PHONE` decodes to 0 in proto3 (zero value) | Changed all link types to `URI_WEB` |
| "logo image width 493px smaller than minimum 660px" | Uploaded same URL for all three slots; logo slot requires 660px minimum | Generate three separate crops at exact required sizes |
| "thumbnail image width smaller than 320px" | Source image too small, no client-side guard | `cropAll` enforces 200px minimum and generates thumbnail at 320px |
| "PassKit setup skipped: clinic not found for id [uuid]" | Used `.single()` which throws on missing row, making `data` null | Switched to `.maybeSingle()` + explicit null check |
| "column clinics.timezone does not exist" | Template body referenced `clinic.timezone` before column was created | Added column via Supabase migration with default `'America/Edmonton'` |
| Template skipped after "program created" in logs | Program was created at onboard, PATCH for setup_completed fired before DB save completed | Moved all three (program + template + tier) to setup completion, created sequentially |

---

## Supabase Storage

**Bucket:** `clinic-logos`

Three PNG files per clinic, all generated client-side by `cropAll()` and uploaded concurrently:

| File | Dimensions | Purpose |
|------|-----------|---------|
| `{clinicId}/logo-icon.png` | 87×87px | PassKit icon slot (Apple Wallet icon) |
| `{clinicId}/logo-thumbnail.png` | 320×320px | PassKit thumbnail slot (Google Wallet pass image) |
| `{clinicId}/logo.png` | 660×660px | PassKit logo slot (Apple Wallet logo strip) + display in dashboard |

`logo_url` in the `clinics` table always stores the public URL of `logo.png`. The backend derives the other two URLs by replacing the filename in `logo_url`.

---

## `website/lib/squareCrop.js`

```
cropAll(file) → Promise<{ icon: Blob, thumbnail: Blob, logo: Blob }>
```

1. Loads the file into an `Image` element
2. Throws `'Logo must be at least 200×200px.'` if source is smaller than 200×200
3. Calculates center-crop: `side = Math.min(w, h)`, `sx = (w - side) / 2`, `sy = (h - side) / 2`
4. Draws onto three canvases (87px, 320px, 660px) and exports each as PNG blob via `canvas.toBlob`
5. All three canvases are processed in `Promise.all` for parallelism

---

## `website/components/Spinner.js`

Shared spinner component. `@keyframes dp-spin` and `.dp-spinner` class are defined in `app/globals.css`.

```jsx
import Spinner from '../../../components/Spinner';

// Props: size (default '1em'), color (default 'currentColor')
<Spinner />
<Spinner size="14px" color="#006FEE" />
```

**Spinner usage pattern for buttons:**
```jsx
<button disabled={saving} style={{ ...s.btn, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
  {saving && <Spinner />}
  {saving ? 'Saving…' : 'Save'}
</button>
```

**Currently used in:**
- `app/login/page.js` — "Signing in…" state
- `SetupWizard.js` — "Saving…" / "Finish setup →" button; logo upload "Uploading…" state
- `SettingsClient.js` — "Save settings" button; logo upload "Uploading…" state
- `PatientProfileClient.js` — "Award" button, "Save" date button, "Send recall reminder" button, "Send review request" button

---

## `website/lib/api.js`

All backend communication goes through `apiFetch`:
```js
async function apiFetch(path, options = {}, authToken = null) {
  const res  = await fetch(`${backendUrl()}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'API error'), { status: res.status, data });
  return data;
}
```

Exported functions: `enrollPatient`, `awardPoints`, `getPatientBySerial`, `updatePatient`, `notifyPatient`, `getClinic`, `updateClinic`, `onboardClinic`, `getOnboardSession`, `createCheckout`, `getBillingPortalUrl`.

---

## Critical Code Patterns and Rules

### 1. Navigation — Always `window.location.href`
**Never use `router.push() + router.refresh()`** after auth state changes. Causes infinite redirect loop: `SecurityError: Blocked a frame from calling history.replaceState() more than 100 times`.

Use `window.location.href = '/target'` for:
- After login
- After dev onboard
- After setup wizard completion
- Any navigation where full page reload is needed

### 2. Supabase Queries — `.maybeSingle()` Not `.single()`
`.single()` throws a PostgREST error when zero rows are found, making `data` null while `error` is non-null. If you don't check `error`, you silently get a null object and crash when reading from it.

`.maybeSingle()` returns `{ data: null, error: null }` cleanly when no row is found.

**Rule:** Always use `.maybeSingle()` when fetching by ID or email. Only use `.single()` when you truly expect exactly one row and want an error if not.

### 3. Supabase Auth in Dev — No Concurrent Auth Operations
The Supabase JS client uses the Navigator Lock API internally. Running two auth operations concurrently causes `NavigatorLockAcquireTimeoutError`.

After dev onboard creates the account and calls `signInWithPassword`, navigate with `window.location.href` (not `router.push`) to force a full page reload and ensure the new session is read cleanly.

### 4. Inline Styles Throughout Dashboard
All dashboard pages use inline style objects — no Tailwind, no CSS modules. Match this pattern when adding new dashboard UI.

Exception: `app/globals.css` defines:
- `.dp-spinner` + `@keyframes dp-spin` — spinner animation
- `.reveal`, `.reveal.up`, `.d1`–`.d5` — scroll reveal animation for landing page
- CSS custom properties (colors, radii) used only by the landing page

### 5. Clinic Slug Generation
Generated at onboard from clinic name: lowercased, spaces → hyphens, non-alphanumeric stripped. Uniqueness guaranteed by suffix loop (`clinic-name`, `clinic-name-2`, `clinic-name-3`, ...). Used as the public enrollment URL: `dentapass.ca/join/[slug]`.

### 6. PATCH `/clinics/:id` Field Whitelist
Only these fields are accepted — all others silently ignored:
`name, google_review_url, booking_url, brand_color, logo_url, rewards_mode, points_per_dollar, points_label, setup_completed, address, phone`

---

## Supabase Edge Functions

- `supabase/functions/recall-reminders/` — runs daily at 9am UTC via pg_cron. Queries patients where `next_checkup_date = today + 30 days`. Sends push notification via PassKit.
- `supabase/functions/review-requests/` — runs every 2 hours via pg_cron. Queries patients where `last_visit_date ≈ now - 2h`. 90-day cooldown per patient (checks notifications table). Sends push via PassKit.

---

## Environment Variables

### Backend (`/backend/.env`)
```
PASSKIT_API_KEY=
PASSKIT_ACCOUNT_ID=
PASSKIT_BASE=https://api.passkit.net/v1
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
NODE_ENV=development
PORT=4001
```

### Website (`/website/.env.local`)
```
NEXT_PUBLIC_BACKEND_URL=http://localhost:4001
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_DEV_ONBOARD=true
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Local Dev Setup

1. `cd backend && npm run dev` — starts Express on port 4001
2. `cd website && npm run dev` — starts Next.js on port 3000
3. Visit `localhost:3000/onboard/dev` to create a test clinic (bypasses Stripe, requires `NEXT_PUBLIC_DEV_ONBOARD=true`)
4. After dev onboard: auto-signs in and redirects to `/dashboard/setup`
5. Complete the setup wizard — this calls PassKit (requires live credentials) to create the program + template + tier
6. Dashboard is accessible once `setup_completed = true` in the DB

**Note:** QR scanner requires HTTPS — use ngrok or a deployed preview environment for local testing.
