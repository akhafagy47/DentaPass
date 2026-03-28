/**
 * PassKit REST API service layer
 * Docs: https://docs.passkit.io/protocols/member/
 *
 * Auth: Bearer JWT token (PASSKIT_API_TOKEN in .env).
 * Token is short-lived (~1hr). When it expires, this module attempts
 * to refresh via POST /login using PASSKIT_API_KEY + PASSKIT_API_SECRET.
 * If refresh fails, restart the backend and regenerate the token from
 * the PassKit portal (Developer Tools → REST Credentials).
 *
 * Structure:
 *   Program  (one per DentaPass account)  →  PASSKIT_MEMBER_PROGRAM_ID
 *   Tier     (one per clinic)             →  clinics.passkit_template_id
 *   Member   (one per patient)
 */

const PASSKIT_BASE = process.env.PASSKIT_API_URL || 'https://api.pub2.passkit.io';
const WALLET_BASE  = 'https://pub2.pskt.io';

// In-memory token cache — seeded from env on startup
let _token  = process.env.PASSKIT_API_TOKEN || null;
let _expiry = _token ? parseExpiry(_token) : 0;

function parseExpiry(token) {
  try {
    // Standard JWT: three dot-separated base64url segments
    const parts = token.split('.');
    if (parts.length !== 3) return Infinity; // long-lived opaque token — never expires
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    return payload.exp ? payload.exp * 1000 : Infinity;
  } catch {
    return Infinity; // if we can't parse it, assume it's long-lived
  }
}

async function refreshToken() {
  const res = await fetch(`${PASSKIT_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: process.env.PASSKIT_API_KEY,
      password: process.env.PASSKIT_API_SECRET,
    }),
  });
  if (!res.ok) {
    throw new Error(
      'PassKit token expired and refresh failed. ' +
      'Regenerate PASSKIT_API_TOKEN in backend/.env from the PassKit portal ' +
      '(Developer Tools → REST Credentials) and restart the backend.'
    );
  }
  const { token } = await res.json();
  _token  = token;
  _expiry = parseExpiry(token);
  return token;
}

async function getToken() {
  // Refresh 60 seconds before expiry
  if (!_token || Date.now() > _expiry - 60_000) {
    await refreshToken();
  }
  return _token;
}

async function pkFetch(path, options = {}, retry = true) {
  const token = await getToken();
  const res   = await fetch(`${PASSKIT_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });

  // Token rejected — force refresh once
  if (res.status === 401 && retry) {
    _token  = null;
    _expiry = 0;
    return pkFetch(path, options, false);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PassKit API error ${res.status}: ${body}`);
  }
  return res.json();
}

// ── Design helpers ─────────────────────────────────────────────────────────────

function hexToRgb(hex) {
  const n = parseInt((hex || '#006FEE').replace('#', ''), 16);
  return { r: n >> 16, g: (n >> 8) & 0xff, b: n & 0xff };
}

/**
 * Build the PassKit tier pass design from clinic settings.
 * Uses Apple Wallet Generic pass conventions — backgroundColor drives the
 * header and strip; foreground and label colors are derived for legibility.
 *
 * PassKit tier pass fields reference:
 *   https://docs.passkit.io/protocols/member/#tag/Membership-Tiers
 */
function buildPassDesign(clinic) {
  const color     = clinic.brand_color || '#006FEE';
  const { r, g, b } = hexToRgb(color);
  const isLight   = (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55;
  const fg        = isLight ? '#1a1a1a' : '#ffffff';
  const fgMuted   = isLight ? 'rgba(0,0,0,0.50)' : 'rgba(255,255,255,0.60)';
  const label     = clinic.points_label || 'Points';

  return {
    backgroundColor: color,
    foregroundColor:  fg,
    labelColor:       fgMuted,
    logoText:         clinic.name,
    // Logo image URL — PassKit renders this in the card header
    ...(clinic.logo_url ? { logoImageUrl: clinic.logo_url } : {}),
    // Strip image — the large colored banner area below the header
    stripColor: color,
    // Primary field: points balance (value populated per-member)
    primaryFields: [
      { key: 'points', label, value: '{{points}}' },
    ],
    // Secondary fields: member name, tier/redemption info, expiry
    secondaryFields: [
      { key: 'member',   label: 'Member',   value: '{{person.forename}} {{person.surname}}' },
      { key: 'tier',     label: clinic.rewards_mode === 'discounts' ? 'Redemption' : 'Tier',
        value: clinic.rewards_mode === 'discounts' && clinic.points_per_dollar
          ? `${clinic.points_per_dollar} pts = $1`
          : '{{metaData.tier}}' },
      { key: 'expires',  label: 'Expires',  value: '03/2028' },
    ],
    // Auxiliary fields: next checkup, member since, referral code
    auxiliaryFields: [
      { key: 'checkup',  label: 'Next checkup',  value: '{{metaData.nextCheckupDate}}' },
      { key: 'since',    label: 'Member since',   value: '{{joinDate}}' },
      { key: 'referral', label: 'Referral code',  value: '{{id}}' },
    ],
    // Back fields shown when card is flipped
    backFields: [
      { key: 'program',  label: 'Program',         value: `${clinic.name} Loyalty` },
      { key: 'earn',     label: 'How to earn',      value: `Visit (+100 ${label})  •  Google review (+100 ${label})  •  Refer a friend (+250 ${label})` },
      ...(clinic.rewards_mode === 'discounts' && clinic.points_per_dollar
        ? [{ key: 'redeem', label: 'Redeeming', value: `${clinic.points_per_dollar} ${label} = $1 discount. Ask at the front desk.` }]
        : [{ key: 'tiers',  label: 'Tiers',     value: 'Bronze → Silver → Gold. Ask staff for tier thresholds.' }]
      ),
      ...(clinic.booking_url ? [{ key: 'booking', label: 'Book online', value: clinic.booking_url }] : []),
      { key: 'terms', label: 'Terms', value: `${label} have no cash value. ${clinic.name} reserves the right to modify the programme at any time.` },
    ],
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Create a PassKit tier (card template) for a clinic.
 * Called during onboarding. Returns the tier ID to store in clinics.passkit_template_id.
 */
export async function createClinicTemplate({ clinic }) {
  const tierId = `clinic-${clinic.slug}`;

  await pkFetch('/membership/tier', {
    method: 'POST',
    body: JSON.stringify({
      id:        tierId,
      programId: process.env.PASSKIT_MEMBER_PROGRAM_ID,
      name:      `${clinic.name} Loyalty Card`,
      pass:      buildPassDesign(clinic),
    }),
  });

  return tierId;
}

/**
 * Update a clinic's PassKit tier template after settings change.
 * PassKit automatically pushes the updated design to all installed passes on this tier.
 */
export async function updateClinicTemplate({ clinic }) {
  if (!clinic.passkit_template_id) return;

  await pkFetch('/membership/tier', {
    method: 'PUT',
    body: JSON.stringify({
      id:        clinic.passkit_template_id,
      programId: process.env.PASSKIT_MEMBER_PROGRAM_ID,
      name:      `${clinic.name} Loyalty Card`,
      pass:      buildPassDesign(clinic),
    }),
  });
}

/**
 * Enroll a patient and create their wallet pass.
 * PassKit emails the patient their wallet link if emailAddress is set.
 * Returns { serialNumber, walletUrl }.
 */
export async function enrollPatient({ patient, clinic }) {
  const data = await pkFetch('/members/member', {
    method: 'POST',
    body: JSON.stringify({
      tierId:    clinic.passkit_template_id || 'base',
      programId: process.env.PASSKIT_MEMBER_PROGRAM_ID,
      person: {
        forename:     patient.first_name,
        surname:      patient.last_name,
        emailAddress: patient.email || undefined,
      },
      points: patient.points_balance ?? 0,
    }),
  });

  return {
    serialNumber: data.id,
    walletUrl:    `${WALLET_BASE}/m/${data.id}`,
  };
}

/**
 * Update a patient's wallet card after a points/tier change.
 * PassKit automatically pushes the update to the installed wallet pass.
 */
export async function updatePatientPass({ patient }) {
  await pkFetch('/members/member', {
    method: 'PUT',
    body: JSON.stringify({
      id:     patient.passkit_serial_number,
      points: patient.points_balance,
      metaData: {
        tier:             patient.tier,
        nextCheckupDate:  patient.next_checkup_date || '',
      },
    }),
  });
}

/**
 * Earn (add) points for a patient.
 * Triggers a wallet push automatically.
 */
export async function earnPoints({ serialNumber, points }) {
  await pkFetch('/members/member/points/earn', {
    method: 'PUT',
    body: JSON.stringify({ id: serialNumber, points }),
  });
}

/**
 * Send a push notification via wallet card update.
 * PassKit pushes to the patient's installed pass whenever member data changes.
 */
export async function sendPushNotification({ serialNumber, message }) {
  await pkFetch('/members/member', {
    method: 'PUT',
    body: JSON.stringify({
      id:    serialNumber,
      notes: [{ header: 'DentaPass', body: message }],
    }),
  });
}

/**
 * Delete a patient's wallet pass (e.g. when a clinic cancels).
 */
export async function deletePatientPass({ serialNumber }) {
  await pkFetch('/members/member', {
    method: 'DELETE',
    body: JSON.stringify({ id: serialNumber }),
  });
}
