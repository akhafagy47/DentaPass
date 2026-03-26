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
 *   Tier     (one per DentaPass account, shared across clinics for MVP)  →  "base"
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

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * For MVP all clinics share the single "base" tier in the DentaPass program.
 * Call this during clinic onboarding and store the returned value in
 * clinics.passkit_template_id.
 */
export async function createClinicTemplate(/* { clinic } */) {
  return 'base';
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
