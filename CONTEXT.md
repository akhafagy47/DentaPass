# DentaPass — Development Context

**Version**: MVP
**Last updated**: April 2026
**Stack**: Next.js 14 (App Router) · Express.js backend · Supabase · PassKit · Stripe · Resend

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
│   ├── server.js                      — Entry point: mounts all routers, CORS, JSON body parser
│   ├── /enrollment/index.js           — POST /enrollment — patient signup + PassKit pass creation
│   ├── /points/index.js               — POST /points/award, POST /points/redeem
│   ├── /patients/index.js             — GET /patients/by-serial/:serial, PATCH /patients/:id, POST /patients/:id/notify
│   ├── /clinics/index.js              — Clinic routes: onboard, settings, PassKit template mgmt
│   ├── /billing/index.js              — Stripe checkout, billing portal, webhook handler
│   └── /lib
│       ├── passkit.js                 — Full PassKit API integration (see PassKit section)
│       ├── stripe.js                  — Stripe client singleton + PLANS/ADDONS config
│       ├── resend.js                  — Resend email integration (recall, review, points emails)
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
        └── squareCrop.js              — cropAll(file): 3 PNG blobs (114px icon, 660px logo, 480×150px appleLogo) via canvas
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
- **PassKit-first pattern** — PassKit API is called before any DB write. If PassKit fails, the DB is not touched and the route returns 502.

---

## Database Schema (current)

### `clinics`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| name | text | Clinic display name |
| slug | text | URL-safe identifier, generated from name at onboard. Used in enrollment URL: `dentapass.ca/join/[slug]` |
| owner_email | text | Used for auth lookup |
| plan | text | `'solo'` / `'clinic'` / `'group'` |
| patient_limit | int | Null = unlimited (group plan) |
| brand_color | text | Hex string e.g. `'#0ea5a0'` |
| logo_url | text | Supabase public URL of 660×660 logo PNG (`{clinicId}/{timestamp}/logo.png`) |
| rewards_mode | text | `'tiers'` or `'discounts'` |
| points_per_dollar | numeric | Only used when `rewards_mode = 'discounts'`. E.g. `100` means 100 points = $1 |
| points_label | text | What to call points on the card (e.g. `"Points"`) |
| address | text | Optional — powers "Get Directions" link on wallet card |
| phone | text | Optional — powers "Call Us" link on wallet card |
| timezone | text | Default: `'America/Edmonton'` |
| setup_completed | bool | False until setup wizard is fully completed including PassKit |
| stripe_customer_id | text | |
| stripe_subscription_id | text | |
| passkit_program_id | text | PassKit Program ID (created at setup completion) |
| passkit_template_design_id | text | PassKit Template Design ID |
| passkit_template_id | text | PassKit Tier ID — used when enrolling patients and updating cards |
| passkit_image_ids | jsonb | `{"icon":"pk-id","logo":"pk-id","appleLogo":"pk-id"}` — PassKit-assigned image record IDs |
| passkit_links | jsonb | Array of link objects with PassKit-assigned IDs: `[{id, title, url, type, position, usage}]` |
| theme | text | `'dark'` / `'light'` / `'auto'` — dashboard display theme |
| action_points | jsonb | Per-clinic configurable points per action: `{completed_visit, left_review, referred_friend, birthday}` |
| custom_actions | jsonb | Array of custom point events: `[{label: string, points: number}]` |
| tier_thresholds | jsonb | Custom tier breakpoints (future feature) |
| tier_incentives | jsonb | Custom tier rewards descriptions (future feature) |

### `patients`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| clinic_id | uuid | FK → clinics |
| first_name | text | |
| last_name | text | |
| email | text | Optional |
| phone | text | Optional |
| date_of_birth | date | Optional — collected at enrollment |
| passkit_serial_number | text | The wallet pass serial number from PassKit — also used as member ID |
| wallet_type | text | `'apple'` or `'google'` — determines notification channel |
| points_balance | int | Current balance |
| tier | text | `'bronze'` / `'silver'` / `'gold'` — auto-updated by Postgres trigger on `point_events` insert |
| next_checkup_date | date | |
| next_checkup_time | text | `'HH:MM'` 24h format — displayed as formatted string on pass |
| last_visit_date | timestamptz | Updated on `completed_visit` points award |
| referral_code | text | Unique 8-char NANOID per patient (A-Z 2-9 charset), used in `dentapass.ca/join/[slug]?ref=[code]` |
| referred_by | uuid | FK → patients (the referrer patient) |
| created_at | timestamptz | Used as `memberSince` on wallet card (YYYYMM format) |

### `point_events`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| patient_id | uuid | FK → patients |
| clinic_id | uuid | FK → clinics |
| points | int | Can be negative |
| reason | text | `'completed_visit'` / `'left_review'` / `'referred_friend'` / `'birthday'` / `'custom'` / `'system'` / or a custom action label |
| awarded_by | text | `'dashboard'` / `'system'` / `'staff'` / staff identifier |

### `notifications`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| patient_id | uuid | FK → patients |
| clinic_id | uuid | FK → clinics |
| type | text | `'recall'` / `'review'` / `'referral'` / `'manual'` |
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

### `redemptions`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| patient_id | uuid | FK → patients |
| clinic_id | uuid | FK → clinics |
| points | int | Points deducted |
| dollar_value | numeric | Calculated: `points / points_per_dollar` |
| note | text | Optional staff note |
| redeemed_by | text | Staff identifier |

---

## Loyalty Tiers

| Tier   | Points Required |
|--------|----------------|
| Bronze | 0 – 499        |
| Silver | 500 – 999      |
| Gold   | 1,000+         |

Tier is auto-updated by a Postgres trigger (`update_patient_tier`) on `point_events` insert.

**Default action points** (used if `clinic.action_points` is not set):
| Action | Default Points |
|--------|---------------|
| `completed_visit` | 500 |
| `left_review` | 500 |
| `referred_friend` | 500 |
| `birthday` | 250 |

Referral credit (`referred_friend`) is pulled from `clinic.action_points.referred_friend ?? 500` and awarded to the referrer automatically at enrollment.

---

## Plans & Pricing (CAD)

| Plan   | Stripe key | Monthly | Patients  | Setup Fee |
|--------|------------|---------|-----------|-----------|
| Solo   | `solo`   | $199    | 500       | $249 |
| Clinic | `clinic` | $349    | 2,000     | $249 |
| Group  | `group`  | $599    | Unlimited | $399 |

**Important:** Plan keys in code and DB are `solo`, `clinic`, `group` — NOT `solo/growth/pro`.

Add-ons: `addon_250` (+250 patients), `addon_500` (+500 patients), `addon_1000` (+1000 patients).

Founding clinic offer: Solo at $149/month locked for life, no setup fee (first 5 clinics, beta feedback + testimonial).

Stripe webhook events handled:
- `checkout.session.completed` → updates `plan` + `patient_limit` + `stripe_customer_id` + `stripe_subscription_id`
- `customer.subscription.updated` → updates `plan` + `patient_limit`
- `customer.subscription.deleted` → downgrades to `solo` / 500 patients
- `invoice.payment_failed` → logs warning (no action taken)

Raw body for webhook mounted **before** `express.json()` in `server.js` so Stripe signature verification works:
```js
app.use('/billing/webhook', express.raw({ type: 'application/json' }));
```

---

## Go-to-Market

- Target: Independent dental clinics in Edmonton, Alberta
- First client: Dr. Maged Elboraee — Smart Dental Art, Windermere
- Channels: personal outreach, cold email, Instagram organic + $5–10/day story ads

---

## Backend Routes (`/backend`)

### `server.js` — Route Mounts
```
POST/GET /enrollment/*    → enrollment/index.js
POST     /points/*        → points/index.js
GET/PATCH/POST /patients/* → patients/index.js
GET/POST/PATCH /clinics/* → clinics/index.js
POST/GET /billing/*       → billing/index.js
GET      /health          → { ok: true }
```

CORS allows `process.env.WEBSITE_URL` (default `http://localhost:3000`) and any `*.vercel.app`.

---

### `POST /enrollment`
Enrolls a new patient. **No auth required** — public endpoint.

**Request body:** `firstName, lastName, email?, phone?, dateOfBirth?, clinicSlug, referralCode?, walletType`

**Flow:**
1. Fetch clinic by slug (selects `id, name, slug, passkit_template_id, passkit_program_id, patient_limit, brand_color, action_points`)
2. Enforce `patient_limit` — returns 409 if at capacity (`patient_limit` null = unlimited)
3. Duplicate check: if email exists in this clinic → return `{ ok: true, walletUrl, alreadyEnrolled: true }` (no error, just return existing pass URL)
4. Resolve `referralCode` to a referrer patient (by `referral_code` + `clinic_id`)
5. **PassKit-first**: call `enrollPatient()` → creates wallet pass → returns `{ id: serialNumber, walletUrl }`
6. Insert patient row with `passkit_serial_number` already set, `wallet_type` = `'google'` if sent else `'apple'`
7. If referrer found: credit referral points (`action_points.referred_friend ?? 500`), update referrer's `points_balance`, insert `point_events` + `referrals`, call `updatePatientPass` for referrer (best-effort)
8. Return `{ ok: true, walletUrl }`

`walletUrl` format: `https://pub2.pskt.io/m/${serialNumber}`

---

### `POST /points/award`
Awards points to a patient and pushes the update to their wallet card.

**Auth:** `verifyToken` (reads Bearer token, verifies with Supabase) — not `requireAuth` middleware. Checks `clinic.owner_email === user.email`.

**Request body:** `patientId, reason, customPoints? (if reason=custom), awardedBy?`

**Flow:**
1. Verify token, fetch patient + clinic
2. Resolve points amount:
   - `reason = 'custom'` → use `customPoints` (1–10000 range enforced)
   - `reason` in `clinic.action_points` → use configured amount
   - `reason` matches a `clinic.custom_actions` label → use that amount
   - Otherwise → 400 error
3. **PassKit-first**: `updatePatientPass` with new balance — if fails, return 502
4. Update `patients.points_balance` + `last_visit_date` if `completed_visit`
5. Insert `point_events`
6. Fire-and-forget notification (no await, `.catch()` logs):
   - `wallet_type === 'google'` + email → `sendPointsAwardedEmail`
   - else if `passkit_serial_number` → `sendNotification` (PassKit lock screen)
7. Return `{ ok: true, newBalance, tier, pointsAwarded }`

---

### `POST /points/redeem`
Deducts points (discount redemption mode only).

**No auth token check** — currently unauthenticated (staff-side action).

**Request body:** `patientId, points, note?, redeemedBy?`

**Flow:**
1. Fetch patient + clinic, verify `rewards_mode === 'discounts'`
2. Verify patient has sufficient balance
3. Calculate `dollarValue = points / points_per_dollar`
4. **PassKit-first**: `updatePatientPass` with new balance
5. Update `patients.points_balance`
6. Insert `redemptions` row with `dollar_value`
7. Return `{ ok: true, newBalance, pointsRedeemed, dollarValue }`

---

### `GET /patients/by-serial/:serial`
Look up patient from wallet card QR scan (used by `POST /scan/[clinicSlug]` page). Returns patient + nested clinic `{ name, slug }`.

### `PATCH /patients/:id`
Update patient fields. **No auth** (staff-facing).

Whitelisted fields: `next_checkup_date, next_checkup_time, last_visit_date, phone, email`

Pass fields (`next_checkup_date, next_checkup_time, phone, email`) require a PassKit round-trip first — `last_visit_date` does not (no corresponding pass field).

### `POST /patients/:id/notify`
Send manual notification. **No auth**.

**Request body:** `type` — one of `'recall'` / `'review'` / `'manual'`

**Channel routing:**
- `wallet_type === 'google'` and patient has email:
  - `recall` → `sendRecallEmail`
  - `review` → `sendReviewRequestEmail`
  - `manual` → `sendRecallEmail` (generic)
- else if `passkit_serial_number`:
  - Calls `sendNotification(serial, message)` with type-specific message
- else → 400 (no channel)

Inserts a `notifications` row on success.

---

### `GET /clinics/:slug`
Public — returns `name, brand_color, logo_url, passkit_links, theme, action_points, custom_actions` for the patient enrollment page.

### `PATCH /clinics/:id` (auth required)
Updates clinic settings.

**Whitelisted fields:** `name, brand_color, logo_url, rewards_mode, points_per_dollar, points_label, setup_completed, address, phone, passkit_links, passkit_image_ids, theme, tier_thresholds, tier_incentives, action_points, custom_actions`

**Special behavior when `setup_completed: true` is sent:**
1. Saves all other fields in one DB update first — but NOT `setup_completed`
2. Fetches full clinic row (using `TEMPLATE_BUILD_FIELDS`)
3. Validates `clinic.logo_url` exists (throws if missing)
4. Calls `createClinicTemplate({ clinic, onProgress })` — each step saves its IDs immediately via `onProgress`
5. Only on full success: saves `setup_completed: true` + all PassKit IDs in one final DB update
6. If any step fails: returns `500 { error: message }` — setup wizard stays on current step

**Special behavior when design fields change** (`name, brand_color, logo_url, points_label, rewards_mode, points_per_dollar, address, phone, passkit_links, passkit_image_ids, timezone`):
- Only if `clinic.passkit_template_design_id` exists
- Merges `passkit_links`: preserves stored PassKit IDs, applies new URLs from update body
- Calls `updateClinicTemplate({ clinic: mergedClinic })` — must succeed before DB write
- If `updateClinicTemplate` returns `newImageIds`: those are stored in `updates.passkit_image_ids` before DB write
- If PassKit fails: returns 502

### `POST /billing/checkout`
Creates Stripe Checkout session. Redirects to Stripe, success URL = `/onboard?session_id=...`.

### `GET /billing/portal` (auth required)
Redirects to Stripe billing portal. Returns URL, client redirects with `window.location.href`.

### `POST /billing/webhook`
Stripe webhook handler. Raw body (mounted before `express.json()`).

### `POST /clinics/onboard`
Called after Stripe payment. Receives `sessionId, clinicName, password`. Verifies payment via Stripe, creates Supabase auth user (email pre-confirmed), generates unique slug, inserts clinic row. **Does NOT create PassKit objects** — that happens at setup wizard completion.

### `POST /clinics/onboard/dev`
DEV ONLY — blocked in production (`NODE_ENV === 'production'` returns 404). Accepts `email, clinicName, password, plan`.

### `GET /clinics/onboard/session?session_id=...`
Retrieves owner email from a Stripe checkout session (used by the `/onboard` page to pre-fill email).

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
1. **Rewards** — mode: `'tier system'` or `'discount redemption'`; if discounts: points-per-dollar conversion rate
2. **Links** — online booking URL, Google review URL
3. **Clinic info** — address (optional, powers "Get Directions" on card), phone (optional, powers "Call Us" on card)
4. **Done** — "All set!" screen with "Go to Dashboard" button

### Logo Requirement
A logo is **required** — the wizard blocks advancing past step 0 without one. The error `"Please upload a clinic logo — it is required for the wallet card."` is shown if you try.

### Logo Upload Process (`website/lib/squareCrop.js`)
1. User selects any image (any aspect ratio, any format)
2. `cropAll(file)` generates three PNG blobs via canvas:
   - `icon` → 114×114px square center-crop (Apple Wallet icon — minimum 114px enforced by PassKit)
   - `logo` → 660×660px square center-crop (Google Pay circle-cropped logo)
   - `appleLogo` → 480×150px rectangular center-crop (Apple Wallet logo strip)
3. All three are uploaded to Supabase Storage concurrently under a **timestamped folder** to bust CDN cache:
   - `{clinicId}/{timestamp}/logo-icon.png`
   - `{clinicId}/{timestamp}/logo.png`
   - `{clinicId}/{timestamp}/logo-apple.png`
4. The 660px public URL (no query param — path is inherently unique) is stored as `logo_url`
5. The old timestamped folder is deleted from storage after a successful upload (best-effort, `.catch(() => {})`)
6. **Minimum source size:** 200×200px. Below this `cropAll` throws and the upload is aborted.

**In SettingsClient.js:** Logo upload immediately calls `PATCH /clinics/:id` (not waiting for Save). PassKit must update successfully before `logo_url` is saved to DB or shown in the UI.

**In SetupWizard.js:** Logo upload only stages `form.logo_url` locally. PassKit update happens at final submission.

### Final Step Submission
When the user clicks "Finish setup" on the last form step, the wizard sends `PATCH /clinics/:id` with `setup_completed: true` plus all form fields. If the backend returns an error, `setError(err.message)` is called and the wizard stays on the current step. Only if the response is successful does it advance to the "Done" screen.

### Setup Resilience (Retry Safety)
`createClinicTemplate` accepts an `onProgress(data)` callback. After each step succeeds, `onProgress` saves that step's IDs to the DB immediately. On retry, the function checks whether each ID already exists and skips completed steps:

| Step | Skipped if |
|------|-----------|
| 1. Program | `clinic.passkit_program_id` exists |
| 2. Images | `passkit_image_ids` has `icon` + `logo` + `appleLogo` |
| 3. Links | `passkit_links` has any entry with an `id` |
| 4. Template | `clinic.passkit_template_design_id` exists |
| 5. Tier | `clinic.passkit_template_id` exists |

This prevents duplicate programs/links/tiers from being created when the user submits the setup form multiple times due to a transient error.

---

## PassKit Integration (`backend/lib/passkit.js`)

### Object Hierarchy
```
Program  (passkit_program_id)          — top-level loyalty program for the clinic
  └── Template Design  (passkit_template_design_id) — visual pass design (colors, fields, images)
        └── Tier  (passkit_template_id)             — links program to design, controls enrollment
              └── Member                            — individual patient wallet pass
                    passkit_serial_number stored in patients table
```

**All three (Program + Template + Tier) must be created sequentially in one shot** at setup wizard completion.

### PassKit API Auth

- `PASSKIT_BASE` = `process.env.PASSKIT_API_URL` (default `https://api.pub2.passkit.io`)
- `WALLET_BASE` = `https://pub2.pskt.io` (hardcoded — where wallet passes are served)
- Auth: Bearer JWT token stored in `PASSKIT_API_TOKEN` env var

**Token management (in-memory cache):**
```js
let _token  = process.env.PASSKIT_API_TOKEN || null;
let _expiry = _token ? parseExpiry(_token) : 0;
```
- `parseExpiry(token)` — decodes JWT `exp` claim. If token has < 3 parts (non-JWT), returns `Infinity`.
- `getToken()` — returns cached token; refreshes 60 seconds before expiry.
- `refreshToken()` — calls `POST /login` with `PASSKIT_API_KEY` + `PASSKIT_API_SECRET`. Updates `_token` and `_expiry`.
- `pkFetch(path, options, retry=true)` — wraps all API calls. On 401: force-clears token and retries once.

If refresh fails, the error message says: *"Regenerate PASSKIT_API_TOKEN in backend/.env from the PassKit portal (Developer Tools → REST Credentials) and restart the backend."*

### Image Management

**Three image slots used:**
| Slot | Size | Purpose |
|------|------|---------|
| `icon` | 114×114px | Apple Wallet lock screen icon (min 114px enforced by PassKit) |
| `logo` | 660×660px | Google Pay circle-cropped logo |
| `appleLogo` | 480×150px | Apple Wallet rectangular logo strip |

**On setup / logo change — `createImages(clinic)` → `POST /images`:**
```json
{
  "name": "Clinic Name",
  "imageData": {
    "icon":      "https://supabase.../{clinicId}/{ts}/logo-icon.png",
    "logo":      "https://supabase.../{clinicId}/{ts}/logo.png",
    "appleLogo": "https://supabase.../{clinicId}/{ts}/logo-apple.png"
  }
}
```
Response: `{ icon: "pk-id", logo: "pk-id", appleLogo: "pk-id" }` — stored as `passkit_image_ids` (jsonb).

The backend derives image URLs from `clinic.logo_url`:
```js
const base = clinic.logo_url.replace(/\/logo\.png.*$/, '/');
// base = "https://supabase.../{clinicId}/{timestamp}/"
```

**Always `POST /images` (never `PUT /image`):** `PUT /image` does NOT trigger PassKit to re-download. Always create new image records to force re-download.

**CDN cache busting:** Supabase Storage CDN caches by path (ignores query params). Timestamped folder = unique URL per upload — no `?t=` needed.

### Template `imageIds`
`buildTemplateBody` prefers `imageIds` (stored PassKit-internal IDs):
```js
if (imageIds && (imageIds.icon || imageIds.logo)) {
  imageField = { imageIds };
} else if (clinic.logo_url) {
  imageField = { images: { icon, logo, appleLogo } }; // first creation only
}
```
`imageIds` and `images` are `oneof` in PassKit's proto3 — cannot send both. Using `imageIds` prevents the PassKit portal from crashing (`this.template.imageIds[e]` — portal bug when null).

### Link Types
Links are built by `buildRawLinks(clinic)`:

| Title | Type | Source |
|-------|------|--------|
| `Book an Appointment` | `URI_WEB` | `passkit_links` stored URL |
| `Call Us` | `URI_TEL` | `clinic.phone` → `tel:+...` |
| `Get Directions` | `URI_LOCATION` | `clinic.address` → Google Maps URL |
| `Follow us on Facebook` | `URI_WEB` | `passkit_links` stored URL |
| `Follow us on Instagram` | `URI_WEB` | `passkit_links` stored URL |
| `Leave a Google Review` | `URI_WEB` | `passkit_links` stored URL |

**Template PUT must only include links that have a stored PassKit ID.** `buildLinks()` maps all current clinic links, but the template body filters to `links.filter(l => l.id)` — sending links without `id` causes `400: Field validation for 'Id' failed on the 'required' tag`.

### Template Data Fields

**Front fields:**
| `uniqueName` | Label | Apple Wallet section | Google Pay position |
|---|---|---|---|
| `members.program.name` | (empty) | `HEADER_FIELDS` | `GOOGLE_PAY_LOYALTY_PROGRAM_NAME` |
| `person.displayName` | `MEMBER` | `PRIMARY_FIELDS` | `GOOGLE_PAY_LOYALTY_ACCOUNT_NAME` |
| `members.tier.name` | `Status` | `SECONDARY_FIELDS` | `GOOGLE_PAY_LOYALTY_REWARDS_TIER` |
| `members.member.points` | `{points_label}` | `AUXILIARY_FIELDS p0` | `GOOGLE_PAY_LOYALTY_POINTS` |
| `meta.notificationMessage` | (empty) | `AUXILIARY_FIELDS p2` | `GOOGLE_PAY_FIELD_DO_NOT_USE` |
| `meta.nextCheckupDate` | `Next checkup` | `AUXILIARY_FIELDS p1` | `GOOGLE_PAY_TEXT_MODULE` |
| `meta.appointmentTime` | `Time` | `AUXILIARY_FIELDS p3` | `GOOGLE_PAY_TEXT_MODULE` |

**Back fields:**
| `uniqueName` | Label | Notes |
|---|---|---|
| `meta.instructions` | `📋 To access links` | Apple only — instructions to find links via `···` |
| `meta.memberSince` | `Member since` | `DATE_YYYYMM` format |
| `meta.nextCheckupDateBack` | `Next checkup` | Apple only back repeat |
| `meta.appointmentTimeBack` | `Appointment time` | |
| `meta.referralLink` | `Refer a friend` | `URL` type — patient-specific referral URL |
| `universal.info` | `About this card` | Rewards program explanation |

**Notification mechanism:** `meta.notificationMessage` has `changeMessage: '%@'`. Updating this field via `PUT /members/member` triggers an iOS lock screen alert with the new value. This is the **only** supported PassKit push notification mechanism.

### `updatePatientPass` payload
```js
PUT /members/member {
  id: passkit_serial_number,
  tierId, programId,
  operation: 'OPERATION_PATCH',
  points: points_balance,
  person: { forename, surname, displayName, emailAddress?, mobileNumber? },
  metaData: {
    tier, nextCheckupDate, nextCheckupDateBack,
    appointmentTime,   // formatTime(HH:MM) → "9:00 AM"
    appointmentTimeBack,
    memberSince,       // "YYYYMM" from created_at
    referralLink,      // "https://dentapass.ca/join/{slug}?ref={code}"
  }
}
```

### Additional PassKit exports
- `earnPoints({ serialNumber?, externalId?, programId?, points })` → `PUT /members/member/points/earn`
- `setPoints({ serialNumber?, externalId?, programId?, points, resetPoints? })` → `PUT /members/member/points/set`
- `burnPoints({ serialNumber?, externalId?, programId?, points })` → `PUT /members/member/points/burn`
- `sendNotification(serialNumber, message)` → `PUT /members/member` with `metaData.notificationMessage`
- `deletePatientPass({ serialNumber })` → `DELETE /members/member`

### Card Design Updates
When design fields change, `updateClinicTemplate` runs **before** the DB write (blocking). Order:
1. `PUT /link` for each link with stored ID (non-fatal — template PUT below carries links anyway)
2. `POST /images` to create fresh image records — new IDs returned (non-fatal)
3. `PUT /template` with fresh `imageIds` and filtered links (fatal — throws on failure)

Returns `{ newImageIds }` when images were re-created (caller must save to DB).

### PassKit Errors Encountered and Their Fixes

| Error Message | Root Cause | Fix Applied |
|---|---|---|
| "design requires a minimum of an icon image" | Wrong upload endpoint or `imageId` was undefined | Use `POST /images` with JSON `imageData` object |
| "validation error Links[n].Type min" | `URI_PHONE` decodes to 0 in proto3 (zero value) | Changed phone links to `URI_TEL` |
| "logo image width 493px smaller than minimum 660px" | Uploaded same URL for all three slots | Generate three separate crops at exact required sizes |
| "PassKit setup skipped: clinic not found for id [uuid]" | Used `.single()` which throws on missing row | Switched to `.maybeSingle()` + explicit null check |
| "column clinics.timezone does not exist" | Template body referenced `clinic.timezone` before column was created | Added column via Supabase migration with default `'America/Edmonton'` |
| "Field validation for 'Id' failed on the 'required' tag" (Links[n]) | Template PUT included links without a PassKit ID | Filter to `links.filter(l => l.id)` before including in template body |
| "proto: error parsing imageIds, oneof io.PassTemplate.ImageAssets is already set" | Sent both `images` and `imageIds` in template body | Send `imageIds` when available, `images` only on first creation |
| "icon image width of 87px smaller than minimum width of 114px" | `cropAll` was generating icon at 87px | Changed `cropToSize(img, 87)` → `cropToSize(img, 114)` |
| Portal crash: "this.template.imageIds[e]" | PassKit portal bug: crashes when `imageIds` is null on the template | Always send stored `passkit_image_ids` in template PUT body |
| Logo not updating in portal after settings change | `PUT /image` doesn't trigger re-download; Supabase CDN caches by path | Always `POST /images`; use timestamped folder paths |
| Duplicate programs on setup retry | Program created at step 1, template fails at step 4 — retry creates another program | `onProgress` callback saves each step's IDs immediately; steps skip if ID already exists |

---

## Notification System

**Dual-channel based on `patient.wallet_type`:**

| Channel | Condition | Mechanism |
|---------|-----------|-----------|
| Apple Wallet | `wallet_type !== 'google'` (default) | PassKit `sendNotification` — updates `meta.notificationMessage`, triggers iOS lock screen |
| Google Wallet email | `wallet_type === 'google'` + email exists | Resend transactional email |

### Resend Email Integration (`backend/lib/resend.js`)

All emails use `RESEND_API_KEY`. From address: `{clinic.name} <noreply@dentapass.ca>` (override via `RESEND_FROM_EMAIL`). Reply-to: `clinic.owner_email`.

HTML emails are full inline-styled HTML with brand color accent bar, tier badge, and CTA buttons.

**Three email functions:**

`sendRecallEmail(patient, clinic)` — checkup reminder
- Subject: `"Time for your checkup, {first_name}"`
- Content: mentions points balance + tier badge, CTA button to `Book an Appointment` link (from `passkit_links`)

`sendReviewRequestEmail(patient, clinic)` — post-visit review request
- Subject: `"How was your visit today, {first_name}?"`
- Content: CTA button to `Leave a Google Review` link (from `passkit_links`)

`sendPointsAwardedEmail(patient, clinic, pointsAwarded, newBalance)` — points confirmation
- Subject: `"{pointsAwarded} points added to your {clinic.name} card"`
- Content: shows points earned + new balance + tier badge (if silver/gold)

### When Notifications Fire
- **Manual** (from dashboard): `POST /patients/:id/notify` with `type: recall|review|manual`
- **Points awarded**: fire-and-forget after `POST /points/award` DB write (no retry)
- **Scheduled** (edge functions): recall 30 days before checkup, review 2h after visit (90-day cooldown)

---

## Supabase Storage

**Bucket:** `clinic-logos`

Three PNG files per clinic version, all generated client-side by `cropAll()` and uploaded concurrently. Each upload uses a **new timestamped folder** to guarantee CDN cache misses on PassKit:

| File | Dimensions | Purpose |
|------|-----------|---------|
| `{clinicId}/{timestamp}/logo-icon.png` | 114×114px | PassKit icon slot (Apple Wallet lock screen) |
| `{clinicId}/{timestamp}/logo.png` | 660×660px | PassKit logo slot (Google Pay circle-crop) + dashboard display |
| `{clinicId}/{timestamp}/logo-apple.png` | 480×150px | PassKit appleLogo slot (Apple Wallet rectangular logo strip) |

`logo_url` in the `clinics` table stores the public URL of `logo.png` (no `?t=` query param — the timestamp is in the path). The backend derives the other URLs by stripping `/logo.png` from `logo_url` and appending the filename.

Old timestamped folders are deleted from storage after each successful upload (best-effort). The regex to extract the bucket-relative path prefix:
```js
const oldMatch = logo_url.match(/clinic-logos\/(.+)\/logo\.png/);
// oldMatch[1] = "{clinicId}/{oldTimestamp}"
sb.storage.from('clinic-logos').remove([
  `${oldMatch[1]}/logo.png`,
  `${oldMatch[1]}/logo-icon.png`,
  `${oldMatch[1]}/logo-apple.png`,
]).catch(() => {});
```

---

## `website/lib/squareCrop.js`

```
cropAll(file) → Promise<{ icon: Blob, logo: Blob, appleLogo: Blob }>
```

1. Loads the file into an `Image` element
2. Throws `'Logo must be at least 200×200px.'` if source is smaller than 200×200
3. `cropToSize(img, size)` — square center-crop: `side = Math.min(w, h)`, draws to `size×size` canvas
4. `cropToRect(img, tw, th)` — rectangular center-crop: matches target aspect ratio, crops sides or top/bottom accordingly
5. Generates three blobs in `Promise.all`:
   - `icon` → `cropToSize(img, 114)` — 114×114px square
   - `logo` → `cropToSize(img, 660)` — 660×660px square
   - `appleLogo` → `cropToRect(img, 480, 150)` — 480×150px rectangle

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

Exported functions: `enrollPatient`, `awardPoints`, `redeemPoints`, `getPatientBySerial`, `updatePatient`, `notifyPatient`, `getClinic`, `updateClinic`, `onboardClinic`, `getOnboardSession`, `createCheckout`, `getBillingPortalUrl`.

---

## `website/components/Spinner.js`

```jsx
// Props: size (default '1em'), color (default 'currentColor')
<Spinner />
<Spinner size="14px" color="#006FEE" />
```

`@keyframes dp-spin` and `.dp-spinner` defined in `app/globals.css`.

**Button pattern:**
```jsx
<button disabled={saving} style={{ ...s.btn, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
  {saving && <Spinner />}
  {saving ? 'Saving…' : 'Save'}
</button>
```

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
`.single()` throws a PostgREST error when zero rows are found, making `data` null while `error` is non-null. If you don't check `error`, you silently get a null object and crash.

`.maybeSingle()` returns `{ data: null, error: null }` cleanly when no row is found.

**Rule:** Always use `.maybeSingle()` when fetching by ID or email. Only use `.single()` when you truly expect exactly one row and want an error if not.

### 3. Supabase Auth in Dev — No Concurrent Auth Operations
The Supabase JS client uses the Navigator Lock API internally. Running two auth operations concurrently causes `NavigatorLockAcquireTimeoutError`.

After dev onboard creates the account and calls `signInWithPassword`, navigate with `window.location.href` to force a full page reload.

### 4. Inline Styles Throughout Dashboard
All dashboard pages use inline style objects — no Tailwind, no CSS modules. Match this pattern when adding new dashboard UI.

Exception: `app/globals.css` defines:
- `.dp-spinner` + `@keyframes dp-spin` — spinner animation
- `.reveal`, `.reveal.up`, `.d1`–`.d5` — scroll reveal animation for landing page
- CSS custom properties (colors, radii) used only by the landing page

### 5. Clinic Slug Generation
Generated at onboard from clinic name: lowercased, spaces → hyphens, non-alphanumeric stripped. Uniqueness guaranteed by suffix loop (`clinic-name`, `clinic-name-2`, ...). Used as public enrollment URL: `dentapass.ca/join/[slug]`.

### 6. PATCH `/clinics/:id` Field Whitelist
Only these fields are accepted — all others silently ignored:
`name, brand_color, logo_url, rewards_mode, points_per_dollar, points_label, setup_completed, address, phone, passkit_links, passkit_image_ids, theme, tier_thresholds, tier_incentives, action_points, custom_actions`

### 7. Dark Mode — Inline Style Rules
All dashboard UI uses inline styles with `var(--dp-*)` CSS variables (set by `DashboardShell.js`). Never use hardcoded light-mode colors (`#fff`, `#1c1c1e`, `rgba(0,0,0,...)`) in dashboard UI components. Card previews (SetupWizard, SettingsClient) that simulate the actual wallet pass appearance are exempt — they intentionally use fixed colors to match the real pass.

Key variables:
- `--dp-card`: card/surface background
- `--dp-t1/t2/t3`: text hierarchy
- `--dp-bdr`: border color
- `--dp-inp` / `--dp-inbdr`: input background / border
- `--dp-bg`: page background

For active selection states (e.g. selected radio option), use `rgba(37,99,235,0.12)` instead of `#eff6ff` — the rgba form adapts to both light and dark mode.

### 8. PassKit-First Pattern
All writes that affect a patient's wallet pass follow this order:
1. Call PassKit API
2. If PassKit fails → return 502, do NOT touch the DB
3. If PassKit succeeds → write to DB

This applies to: enrollment, points award, points redeem, patient field updates (checkup date, contact info), clinic template updates (logo, colors, etc.).

---

## Supabase Edge Functions

- `supabase/functions/recall-reminders/` — runs daily at 9am UTC via pg_cron. Queries patients where `next_checkup_date = today + 30 days`. Sends push notification via PassKit.
- `supabase/functions/review-requests/` — runs every 2 hours via pg_cron. Queries patients where `last_visit_date ≈ now - 2h`. 90-day cooldown per patient (checks notifications table). Sends push via PassKit.

---

## Environment Variables

### Backend (`/backend/.env`)
```
PASSKIT_API_TOKEN=          # Short-lived JWT — auto-refreshed using KEY + SECRET below
PASSKIT_API_KEY=            # PassKit login username (for token refresh)
PASSKIT_API_SECRET=         # PassKit login password (for token refresh)
PASSKIT_API_URL=            # Default: https://api.pub2.passkit.io
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=      # For Stripe webhook signature verification
STRIPE_PRICE_SOLO=          # Stripe price ID for solo plan
STRIPE_PRICE_CLINIC=        # Stripe price ID for clinic plan
STRIPE_PRICE_GROUP=         # Stripe price ID for group plan
STRIPE_PRICE_ADDON_250=     # +250 patients add-on price ID
STRIPE_PRICE_ADDON_500=     # +500 patients add-on price ID
STRIPE_PRICE_ADDON_1000=    # +1000 patients add-on price ID
RESEND_API_KEY=             # Resend transactional email API key
RESEND_FROM_EMAIL=          # Default: noreply@dentapass.ca
WEBSITE_URL=                # Default: http://localhost:3000 (used in enrollment referral URLs)
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
