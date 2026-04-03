# PassKit REST API — Object Schemas

Reference for all PassKit objects used in DentaPass.
API base: `https://api.pub2.passkit.io`
Auth: `Authorization: Bearer <PASSKIT_API_TOKEN>`

---

## POST /template — Create Pass Template

**Request body** (schema name: `PassTemplate`):

```json
{
  "name": "Clinic Name",
  "organizationName": "Clinic Name",
  "protocol": "MEMBERSHIP",
  "revision": 1,
  "description": "Clinic Name Loyalty Card",
  "defaultLanguage": "EN",
  "timezone": "America/Edmonton",

  "colors": {
    "backgroundColor": "#3bbfb9",
    "labelColor": "#ffffff",
    "textColor": "#ffffff"
  },

  "images": {
    "icon": "https://...supabase.co/.../logo-icon.png",
    "logo": "https://...supabase.co/.../logo.png"
  },

  "barcode": {
    "format": "QR",
    "payload": "${pid}",
    "altText": "${pid}",
    "messageEncoding": "utf8"
  },

  "links": [
    {
      "position": 10,
      "title": "Book an Appointment",
      "url": "https://...",
      "type": "URI_WEB",
      "usage": ["USAGE_APPLE_WALLET", "USAGE_GOOGLE_PAY"]
    }
  ],

  "data": {
    "dataFields": [ /* see Data Field schema below */ ],
    "dataCollectionPageSettings": {
      "title": "Register Below",
      "submitButtonText": "Register",
      "loadingText": "Hang on",
      "thankYouText": "Thank you for registering, we will redirect you to your pass."
    }
  },

  "appleWalletSettings": { "passType": "GENERIC" },
  "googlePaySettings":   { "passType": "LOYALTY" },
  "expirySettings":      { "expiryType": "EXPIRE_NONE" }
}
```

**Response** — only returns `id`. Links are NOT in the response:

```json
{ "id": "string" }
```

> After POST, call GET /template/{id} to retrieve PassKit-assigned link IDs.

---

## GET /template/{id} — Retrieve Pass Template

**Response** — full template wrapped in `template` key:

```json
{
  "template": {
    "id": "string",
    "name": "string",
    "protocol": "MEMBERSHIP",
    "revision": 1,
    "defaultLanguage": "EN",
    "organizationName": "string",
    "description": "string",
    "colors": { "backgroundColor": "#...", "labelColor": "#...", "textColor": "#..." },
    "imageIds": {
      "icon": "passkit-image-id",
      "logo": "passkit-image-id"
    },
    "images": {
      "icon": "https://original-url",
      "logo": "https://original-url"
    },
    "links": [
      {
        "id": "string (PassKit-assigned, NOT writable on create/update)",
        "url": "https://...",
        "title": "Book an Appointment",
        "type": "URI_WEB",
        "usage": ["USAGE_APPLE_WALLET", "USAGE_GOOGLE_PAY"],
        "position": 10
      }
    ],
    "data": { /* dataFields */ },
    "barcode": { /* ... */ },
    "appleWalletSettings": { "passType": "GENERIC" },
    "googlePaySettings":   { "passType": "LOYALTY" },
    "expirySettings":      { "expiryType": "EXPIRE_NONE" },
    "timezone": "America/Edmonton",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
}
```

> `imageIds` is `null` if PassKit could not fetch the image URLs — causes PassKit portal UI crash
> (`this.template.imageIds[e]`). This is a PassKit portal bug.

---

## PUT /template — Update Pass Template

**Request body** — same as POST but:
- Add `"id": "templateDesignId"` at root level
- Links **require** the PassKit-assigned `id` field (from GET /template). Sending links without `id` causes:
  `400 validation error: Key: 'PassTemplate.Links[0].Id' Error: Field validation for 'Id' failed on the 'uuidCompressedString' tag`
- If no link IDs are stored, **omit `links` entirely** — PassKit preserves existing links server-side

```json
{
  "id": "templateDesignId",
  "name": "...",
  "colors": { ... },
  "links": [
    {
      "id": "PassKit-assigned-link-id",
      "position": 10,
      "title": "Book an Appointment",
      "url": "https://...",
      "type": "URI_WEB",
      "usage": ["USAGE_APPLE_WALLET", "USAGE_GOOGLE_PAY"]
    }
  ],
  ...
}
```

---

## Link Object

| Field      | Type     | Notes |
|------------|----------|-------|
| `id`       | string   | PassKit-assigned. NOT writable on create. Required on PUT. |
| `url`      | string   | The link destination |
| `title`    | string   | Display label |
| `type`     | enum     | See below |
| `usage`    | string[] | Which wallets show this link |
| `position` | integer  | Render order, lowest first |

**Link types (`type`):**

| Value           | Description        |
|-----------------|--------------------|
| `URI_WEB`       | Website URL        |
| `URI_TEL`       | Phone number `tel:…` |
| `URI_EMAIL`     | Email address      |
| `URI_LOCATION`  | Maps address       |
| `URI_CALENDAR`  | Calendar event     |

**Usage values:**
- `USAGE_APPLE_WALLET`
- `USAGE_GOOGLE_PAY`
- `USAGE_DATA_COLLECTION_PAGE`

**DentaPass link titles** (used as keys in `passkit_links` DB column):

| Title                     | Position | Type            |
|---------------------------|----------|-----------------|
| `Book an Appointment`     | 10       | URI_WEB         |
| `Call Us`                 | 20       | URI_TEL         |
| `Get Directions`          | 30       | URI_LOCATION    |
| `Follow us on Facebook`   | 40       | URI_WEB         |
| `Follow us on Instagram`  | 50       | URI_WEB         |
| `Leave a Google Review`   | 60       | URI_WEB         |

> `Call Us` and `Get Directions` are built dynamically from `clinic.phone` / `clinic.address` — not stored in `passkit_links`.
> The other 4 are stored in `passkit_links` with `{ title, url, type, position, usage, id }`.

---

## POST /members/program — Create Program

```json
{
  "name": "Clinic Name",
  "status": ["PROJECT_ACTIVE_FOR_OBJECT_CREATION", "PROJECT_DRAFT"],
  "pointsType": { "balanceType": "BALANCE_TYPE_INT64" },
  "profileImageSettings": "PROFILE_IMAGE_NONE",
  "autoDeleteDaysAfterExpiry": 0,
  "passRecoverySettings": {
    "enabled": true,
    "delivery": "DELIVERY_REDIRECT",
    "fieldsToMatchUponRecovery": ["person.emailAddress"]
  }
}
```

**Response:** `{ "id": "programId" }`

---

## POST /members/tier — Create Tier

```json
{
  "id": "clinic-slug-member",
  "name": "Member",
  "tierIndex": 1,
  "programId": "programId",
  "passTemplateId": "templateDesignId",
  "expirySettings": { "expiryType": "EXPIRE_NONE" },
  "timezone": "America/Edmonton",
  "allowTierEnrolment": { "value": true }
}
```

**Response:** `{ "id": "tierId" }`

---

## POST /members/member — Enroll Patient

```json
{
  "tierId": "clinic-slug-member",
  "programId": "programId",
  "person": {
    "forename": "Jane",
    "surname": "Smith",
    "displayName": "Jane Smith",
    "emailAddress": "jane@example.com",
    "mobileNumber": "+17805550100"
  },
  "points": 0,
  "metaData": {
    "memberSince": "202401",
    "referralLink": "https://denta-pass.vercel.app/join/slug?ref=CODE",
    "nextCheckupDate": "2026-06-15",
    "nextCheckupDateBack": "2026-06-15",
    "appointmentTime": "9:00 AM",
    "appointmentTimeBack": "9:00 AM"
  }
}
```

**Response:** `{ "id": "serialNumber" }` — serial number = wallet card QR code value

> Wallet URL: `https://pub2.pskt.io/m/{serialNumber}`

---

## PUT /members/member — Update Patient Pass

```json
{
  "id": "serialNumber",
  "tierId": "clinic-slug-member",
  "programId": "programId",
  "operation": "OPERATION_PATCH",
  "points": 750,
  "person": {
    "forename": "Jane",
    "displayName": "Jane Smith",
    "surname": "Smith",
    "emailAddress": "jane@example.com",
    "mobileNumber": "+17805550100"
  },
  "metaData": {
    "tier": "silver",
    "nextCheckupDate": "2026-06-15",
    "nextCheckupDateBack": "2026-06-15",
    "appointmentTime": "9:00 AM",
    "appointmentTimeBack": "9:00 AM",
    "memberSince": "202401",
    "referralLink": "https://..."
  }
}
```

---

## PUT /members/member — Send Notification (Apple Wallet only)

```json
{
  "id": "serialNumber",
  "metaData": { "notificationMessage": "Your checkup is coming up — book now" }
}
```

> Triggers lock screen notification because `meta.notificationMessage` field in template has `changeMessage: "%@"`.
> Google Wallet patients receive Resend email instead.

---

## PUT /members/member/points/earn — Earn Points

```json
{ "id": "serialNumber", "points": 500 }
```

## PUT /members/member/points/set — Set Points Balance

```json
{ "id": "serialNumber", "points": 1500, "resetPoints": false }
```

## PUT /members/member/points/burn — Burn Points

```json
{ "id": "serialNumber", "points": 200 }
```

---

## Data Field Schema (`dataFields` array entry)

```json
{
  "uniqueName": "meta.nextCheckupDate",
  "label": "Next checkup",
  "dataType": "DATE_YYYYMMDD",
  "defaultValue": "",
  "isRequired": false,
  "userCanSetValue": false,
  "usage": ["USAGE_APPLE_WALLET", "USAGE_GOOGLE_PAY"],
  "appleWalletFieldRenderOptions": {
    "textAlignment": "RIGHT",
    "positionSettings": {
      "section": "AUXILIARY_FIELDS",
      "priority": 1
    },
    "changeMessage": "Your next checkup is %@.",
    "dateStyle": "DATE_TIME_STYLE_MEDIUM",
    "timeStyle": "DATE_TIME_STYLE_DO_NOT_USE",
    "numberStyle": "NUMBER_STYLE_DO_NOT_USE"
  },
  "googlePayFieldRenderOptions": {
    "googlePayPosition": "GOOGLE_PAY_TEXT_MODULE",
    "textModulePriority": 0
  }
}
```

**`dataType` values:**
- `TEXT`, `TEXT_LONG`, `URL`, `INT`, `DATE_YYYYMMDD`, `DATE_YYYYMM`

**Apple Wallet sections (`section`):**
- `HEADER_FIELDS` — top bar
- `PRIMARY_FIELDS` — large text (patient name)
- `SECONDARY_FIELDS` — row below primary
- `AUXILIARY_FIELDS` — row below secondary (points balance, checkup date)
- `BACK_FIELDS` — back of pass (scrollable)

**Apple Wallet `changeMessage`:**
- `"%@"` — triggers lock screen notification when value changes
- `"You now have %@ Points!"` — points-specific notification
- `""` — no notification on change

**Google Pay positions (`googlePayPosition`):**
- `GOOGLE_PAY_LOYALTY_PROGRAM_NAME`
- `GOOGLE_PAY_LOYALTY_ACCOUNT_NAME`
- `GOOGLE_PAY_LOYALTY_REWARDS_TIER`
- `GOOGLE_PAY_LOYALTY_POINTS`
- `GOOGLE_PAY_TEXT_MODULE`
- `GOOGLE_PAY_FIELD_DO_NOT_USE` — hidden on Google Pay

---

## DentaPass `passkit_links` DB Column

Stored on `clinics` table as JSONB. Each entry:

```json
{
  "id": "PassKit-assigned link ID (from GET /template after creation)",
  "title": "Book an Appointment",
  "url": "https://...",
  "type": "URI_WEB",
  "position": 10,
  "usage": ["USAGE_APPLE_WALLET", "USAGE_GOOGLE_PAY"]
}
```

> `id` is populated by calling `GET /template/{templateDesignId}` immediately after `POST /template`.
> Stored IDs are injected into `buildLinks()` for PUT /template calls.
> If no IDs are stored, links are omitted from PUT entirely (PassKit preserves existing ones).

---

## Image Sizes (for `images` field)

| Key         | Size        | Notes                                   |
|-------------|-------------|----------------------------------------|
| `icon`      | 87×87px     | Required — Apple Wallet lock screen     |
| `logo`      | 660×660px   | Required — circle-cropped by Google Pay |
| `appleLogo` | ≤480×150px  | Optional — rectangular Apple-only logo  |
| `hero`      | 1032×336px  | Google Pay strip + install dialog       |
| `thumbnail` | ≥320×320px  | Membership passes (2:3–3:2 ratio)       |
| `banner`    | any         | Landing page / email, treated as @2x    |

> Images are sent as Supabase public URLs. PassKit downloads and stores them internally,
> populating `imageIds`. If PassKit cannot fetch the URLs, `imageIds` is `null`, which
> causes the PassKit portal to crash (`this.template.imageIds[e]`). This is a PassKit portal bug.

---

## POST /link — Create Link

**Request body:**

```json
{
  "url": "https://...",
  "title": "Book an Appointment",
  "type": "URI_WEB",
  "usage": ["USAGE_APPLE_WALLET", "USAGE_GOOGLE_PAY"],
  "position": 10
}
```

> `id` field is **not writable** — PassKit assigns it on creation.

**Response:** `{ "id": "string" }`

---

## PUT /link — Update Link

**Request body** — same shape as Create, but include the PassKit-assigned `id`:

```json
{
  "id": "PassKit-assigned-link-id",
  "url": "https://...",
  "title": "Book an Appointment",
  "type": "URI_WEB",
  "usage": ["USAGE_APPLE_WALLET", "USAGE_GOOGLE_PAY"],
  "position": 10
}
```

**Response:** full link object (same fields as request, `id` is not writable note still applies).

**`type` enum:**

| Value            | Description      |
|------------------|------------------|
| `URI_DO_NOT_USE` | (avoid)          |
| `URI_WEB`        | Website URL      |
| `URI_TEL`        | Phone `tel:…`    |
| `URI_EMAIL`      | Email address    |
| `URI_LOCATION`   | Maps/address     |
| `URI_CALENDAR`   | Calendar event   |

**`usage` enum:** `NO_USAGE` | `USAGE_APPLE_WALLET` | `USAGE_GOOGLE_PAY` | `USAGE_DATA_COLLECTION_PAGE`

---

## POST /template/location — Create Location

**Request body:**

```json
{
  "name": "Clinic Name",
  "lat": 53.5461,
  "lon": -113.4938,
  "alt": 0,
  "lockScreenMessage": "You're near us — tap to open your pass!",
  "position": 10
}
```

> `id` is system-generated. `lat` and `lockScreenMessage` are required. iOS only for lock screen message.

**Response:** `{ "id": "string" }`

---

## PUT /template/location — Update Location

**Request body:** same as Create but with `id`. **Response:** full location object.

---

## POST /template/beacon — Create Beacon

**Request body:**

```json
{
  "uuid": "valid-uuid",
  "name": "Reception Beacon",
  "major": 1,
  "minor": 1,
  "lockScreenMessage": "Welcome! Tap to open your pass.",
  "position": 10
}
```

> `uuid` and `lockScreenMessage` are required. Beacons are **Apple Wallet only**.

**Response:** `{ "id": "string" }`

---

## PUT /template/beacon — Update Beacon

**Request body:** same as Create but with `id`. **Response:** full beacon object.

---

## POST /images — Create Images

**Request body:**

```json
{
  "name": "Clinic Logo",
  "imageData": {
    "icon": "https://...supabase.co/.../icon.png",
    "logo": "https://...supabase.co/.../logo.png"
  }
}
```

> `name` and `imageData` are required. Values can be public URLs or base64-encoded data.

**Response:** `imageIds` object — keys are image type names (`icon`, `logo`, etc.), values are PassKit-assigned IDs.

---

## PUT /image — Update Image

**Request body:**

```json
{
  "id": "passkit-image-id",
  "name": "Updated Name",
  "imageData": "optional-new-image-url-or-base64"
}
```

**Response:**

```json
{
  "id": "passkit-image-id",
  "name": "Clinic Logo",
  "url": "https://hosted-url",
  "use": "logo",
  "languages": ["EN"],
  "ownerUsername": "...",
  "createdAt": "...",
  "updatedAt": "..."
}
```

**`use` enum** (image type): `icon` | `logo` | `appleLogo` | `hero` | `eventStrip` | `strip` | `thumbnail` | `background` | `footer` | `security` | `privilege` | `airlineAlliance` | `personalization` | `banner` | `message` | `profile` | `appImage` | `stampedImage` | `unstampedImage` | `stampImage` | `wideLogo` | `secondaryLogo` | `artwork` | `primaryLogo` | `venueMap`

---

## Pass Template — Full Field Reference

Additional fields available on `POST /template` and `PUT /template` beyond what DentaPass currently uses:

### `colors` object

| Field                 | Notes                                              |
|-----------------------|----------------------------------------------------|
| `backgroundColor`     | Card background hex (with or without `#` prefix)  |
| `labelColor`          | Apple Wallet field label color                     |
| `textColor`           | Apple Wallet field value color                     |
| `stripColor`          | Text over strip image (Apple, optional)            |

### `barcode` object

| Field              | Notes                                         |
|--------------------|-----------------------------------------------|
| `format`           | `QR` \| `AZTEC` \| `PDF417` \| `CODE128` \| `NONE` |
| `payload`          | Data encoded; use `${pid}` for serial number  |
| `altText`          | Text below barcode                            |
| `messageEncoding`  | e.g. `"utf8"`                                 |
| `suppressSecurity` | Set `true` to disable Google Pay shimmer      |
| `rotatingBarcode`  | TOTP rotating barcode (Google Pay)            |

### `appleWalletSettings` object

| Field         | Notes                                                      |
|---------------|------------------------------------------------------------|
| `passType`    | `GENERIC` \| `STORE_CARD` \| `COUPON` \| `EVENT_TICKET` \| `BOARDING_PASS` |
| `logoText`    | Text in place of (or alongside) logo                       |
| `userInfo`    | JSON string passed to companion app (not shown on pass)    |
| `maxDistance` | GPS lock screen trigger radius (metres)                    |

### `googlePaySettings` object

| Field      | Notes                                                        |
|------------|--------------------------------------------------------------|
| `passType` | `LOYALTY` \| `OFFER` \| `GIFT` \| `EVENT` \| `FLIGHT` \| `TRANSIT` |

### `expirySettings` object

```json
{ "expiryType": "EXPIRE_NONE" }
```

Other values: `EXPIRE_DATE` (set fixed date), `EXPIRE_DAYS_AFTER_ISSUE`.

### `sharing` object

```json
{
  "prohibitSharing": false,
  "url": "https://...",
  "description": "Share your pass"
}
```

> If `url` is provided, Apple's "Share Pass" button redirects to this URL instead of sharing the pass file.

### `protocol` enum

| Value              | Description                  |
|--------------------|------------------------------|
| `MEMBERSHIP`       | Generic membership (DentaPass uses this) |
| `SINGLE_USE_COUPON`| One-time coupon              |
| `EVENT_TICKETING`  | Event tickets                |
| `FLIGHT_PROTOCOL`  | Boarding passes              |
