/**
 * PassKit API service layer
 * Docs: https://docs.passkit.com
 *
 * DentaPass uses PassKit's Membership (loyalty) product:
 * - One program per DentaPass account
 * - One tier/template per clinic (created during clinic onboarding)
 * - One membership pass per patient
 */

const PASSKIT_BASE = 'https://api.pub1.passkit.io';

function authHeader() {
  const creds = Buffer.from(
    `${process.env.PASSKIT_API_KEY}:${process.env.PASSKIT_API_SECRET}`
  ).toString('base64');
  return { Authorization: `Basic ${creds}`, 'Content-Type': 'application/json' };
}

async function pkFetch(path, options = {}) {
  const res = await fetch(`${PASSKIT_BASE}${path}`, {
    ...options,
    headers: { ...authHeader(), ...(options.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PassKit API error ${res.status}: ${body}`);
  }
  return res.json();
}

/**
 * Create a membership program tier (template) for a clinic.
 * Called once during clinic onboarding.
 * Returns the tier ID to store as clinic.passkit_template_id.
 */
export async function createClinicTemplate({ clinic }) {
  const payload = {
    programId: process.env.PASSKIT_MEMBER_PROGRAM_ID,
    name: clinic.name,
    tierName: clinic.name,
    primaryFields: [
      { key: 'points', label: 'Points', value: '0' },
      { key: 'tier', label: 'Tier', value: 'Bronze' },
    ],
    secondaryFields: [
      { key: 'nextCheckup', label: 'Next Checkup', value: '' },
    ],
    backFields: [
      { key: 'referralCode', label: 'Referral Code', value: '' },
      { key: 'bookingUrl', label: 'Book Appointment', value: clinic.booking_url || '' },
    ],
    backgroundColor: clinic.brand_color || '#006FEE',
    logoText: clinic.name,
  };

  const data = await pkFetch('/membership/tier', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return data.id;
}

/**
 * Enroll a patient — creates a PassKit membership pass.
 * Returns { serialNumber, walletUrl }
 */
export async function enrollPatient({ patient, clinic }) {
  const payload = {
    tierId: clinic.passkit_template_id,
    membershipId: patient.id,
    person: {
      forename: patient.first_name,
      surname: patient.last_name,
      emailAddress: patient.email || undefined,
    },
    points: { balance: patient.points_balance ?? 0, lifetime: 0 },
    metaData: {
      referralCode: patient.referral_code,
      nextCheckupDate: patient.next_checkup_date || '',
    },
  };

  const data = await pkFetch('/membership/member', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return {
    serialNumber: data.id,
    // PassKit returns a universal link that routes to Apple/Google Wallet
    walletUrl: `https://pub1.pskt.io/${data.id}`,
  };
}

/**
 * Update a patient's pass after points change or tier update.
 * PassKit pushes the update to the patient's device automatically.
 */
export async function updatePatientPass({ patient }) {
  const payload = {
    points: { balance: patient.points_balance, lifetime: patient.points_balance },
    metaData: {
      nextCheckupDate: patient.next_checkup_date || '',
      tier: patient.tier,
    },
  };

  await pkFetch(`/membership/member/${patient.passkit_serial_number}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

/**
 * Send a push notification to a single patient's wallet card.
 */
export async function sendPushNotification({ serialNumber, message }) {
  const payload = {
    pushMessage: message,
  };

  await pkFetch(`/membership/member/${serialNumber}/push`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Delete a patient's pass (e.g. clinic cancels subscription).
 */
export async function deletePatientPass({ serialNumber }) {
  await pkFetch(`/membership/member/${serialNumber}`, { method: 'DELETE' });
}
