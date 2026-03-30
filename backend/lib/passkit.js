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
  const n = parseInt((hex || '#0ea5a0').replace('#', ''), 16);
  return { r: n >> 16, g: (n >> 8) & 0xff, b: n & 0xff };
}

function deriveTextColor(hex) {
  const { r, g, b } = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55 ? '#1a1a1a' : '#FFFFFF';
}

/**
 * Colors object — matches the PassKit template `colors` schema exactly.
 * Apple Wallet uses backgroundColor for the card strip/header;
 * Google Wallet uses it for the card background.
 */
function buildColors(clinic) {
  const bg   = clinic.brand_color || '#0ea5a0';
  const text = deriveTextColor(bg);
  return { backgroundColor: bg, labelColor: text, textColor: text };
}

/**
 * Data fields — matches the `data.dataFields` array in the PassKit template.
 *
 * fieldType values:  1 = custom metadata, 2 = person field, 3 = back/info field, 4 = system field
 * dataType values:   1 = string, 2 = multiline string, 3 = date, 8 = number
 * section values (Apple Wallet positionSettings):
 *   0 = header, 1 = back, 3 = secondary, 4 = auxiliary, 5 = primary/strip
 */
function buildDataFields(clinic) {
  const label    = clinic.points_label || 'Points';
  const isDiscount = clinic.rewards_mode === 'discounts' && clinic.points_per_dollar;
  const infoText = isDiscount
    ? `Earn ${label} at every visit. Redeem: ${clinic.points_per_dollar} ${label} = $1 discount.`
    : `Earn ${label} at every visit. Bronze → Silver → Gold.`;

  return [
    // Program name — header area on Google Wallet, hidden on Apple Wallet
    {
      uniqueName: 'members.program.name',
      label: '',
      dataType: 'TEXT',
      defaultValue: 'DentaPass',
      usage: ['USAGE_GOOGLE_PAY'],
      appleWalletFieldRenderOptions: {
        textAlignment: 0,
        positionSettings: { section: 0, priority: 0 },
        changeMessage: '',
        dateStyle: 'DATE_TIME_STYLE_DO_NOT_USE',
        timeStyle: 'DATE_TIME_STYLE_DO_NOT_USE',
        numberStyle: 'NUMBER_STYLE_DO_NOT_USE',
      },
      googlePayFieldRenderOptions: { googlePayPosition: 300, textModulePriority: 0 },
    },
    // Points balance — primary strip field on Apple Wallet
    {
      uniqueName: 'members.member.points',
      label,
      dataType: 'INT',
      defaultValue: '0',
      usage: ['USAGE_APPLE_WALLET', 'USAGE_GOOGLE_PAY'],
      appleWalletFieldRenderOptions: {
        textAlignment: 3,
        positionSettings: { section: 5, priority: 0 },
        changeMessage: `You now have %@ ${label}!`,
        dateStyle: 'DATE_TIME_STYLE_DO_NOT_USE',
        timeStyle: 'DATE_TIME_STYLE_DO_NOT_USE',
        numberStyle: 'NUMBER_STYLE_DO_NOT_USE',
      },
      googlePayFieldRenderOptions: { googlePayPosition: 301, textModulePriority: 0 },
    },
    // Patient display name — secondary field, also shown on data collection page
    {
      uniqueName: 'person.displayName',
      isRequired: true,
      label: 'Name',
      dataType: 'TEXT',
      defaultValue: 'N/A',
      userCanSetValue: true,
      usage: ['USAGE_APPLE_WALLET', 'USAGE_GOOGLE_PAY', 'USAGE_DATA_COLLECTION_PAGE'],
      appleWalletFieldRenderOptions: {
        textAlignment: 1,
        positionSettings: { section: 3, priority: 0 },
        changeMessage: '',
        dateStyle: 'DATE_TIME_STYLE_DO_NOT_USE',
        timeStyle: 'DATE_TIME_STYLE_DO_NOT_USE',
        numberStyle: 'NUMBER_STYLE_DO_NOT_USE',
      },
      googlePayFieldRenderOptions: { googlePayPosition: 303, textModulePriority: 0 },
    },
    // Tier name — secondary field alongside patient name
    {
      uniqueName: 'members.tier.name',
      label: isDiscount ? 'Redemption' : 'Tier',
      dataType: 'TEXT',
      defaultValue: isDiscount ? `${clinic.points_per_dollar} ${label} = $1` : 'Base',
      usage: ['USAGE_APPLE_WALLET', 'USAGE_GOOGLE_PAY'],
      appleWalletFieldRenderOptions: {
        textAlignment: 3,
        positionSettings: { section: 3, priority: 1 },
        changeMessage: '',
        dateStyle: 'DATE_TIME_STYLE_DO_NOT_USE',
        timeStyle: 'DATE_TIME_STYLE_DO_NOT_USE',
        numberStyle: 'NUMBER_STYLE_DO_NOT_USE',
      },
      googlePayFieldRenderOptions: { googlePayPosition: 305, textModulePriority: 0 },
    },
    // Info / back field — shown on card back (Apple) and detail view (Google)
    {
      uniqueName: 'universal.info',
      label: 'Information',
      dataType: 'TEXT_LONG',
      defaultValue: infoText,
      usage: ['USAGE_APPLE_WALLET', 'USAGE_GOOGLE_PAY'],
      appleWalletFieldRenderOptions: {
        textAlignment: 0,
        positionSettings: { section: 1, priority: 1 },
        changeMessage: '',
        dateStyle: 'DATE_TIME_STYLE_DO_NOT_USE',
        timeStyle: 'DATE_TIME_STYLE_DO_NOT_USE',
        numberStyle: 'NUMBER_STYLE_DO_NOT_USE',
      },
      googlePayFieldRenderOptions: { googlePayPosition: 1000, textModulePriority: 1 },
    },
    // Next checkup date — Google Wallet detail view only
    {
      uniqueName: 'meta.nextCheckupDate',
      label: 'Next checkup date',
      dataType: 'DATE_YYYYMMDD',
      defaultValue: 'N/A',
      userCanSetValue: true,
      usage: ['USAGE_GOOGLE_PAY'],
      appleWalletFieldRenderOptions: {
        textAlignment: 0,
        positionSettings: { section: 0, priority: 0 },
        changeMessage: '',
        dateStyle: 'DATE_TIME_STYLE_DO_NOT_USE',
        timeStyle: 'DATE_TIME_STYLE_DO_NOT_USE',
        numberStyle: 'NUMBER_STYLE_DO_NOT_USE',
      },
      googlePayFieldRenderOptions: { googlePayPosition: 1000, textModulePriority: 0 },
    },
  ];
}

/**
 * Links shown in Google Wallet's detail view (Leave Review, Book Appointment).
 * Apple Wallet uses back fields for the same info.
 */
function buildLinks(clinic) {
  const links = [];
  if (clinic.address) {
    links.push({
      title: 'Get Directions',
      url:   `https://maps.google.com/?q=${encodeURIComponent(clinic.address)}`,
      type:  'URI_LOCATION',
      usage: ['USAGE_APPLE_WALLET', 'USAGE_GOOGLE_PAY'],
    });
  }
  if (clinic.phone) {
    links.push({
      title: 'Call Us',
      url:   `tel:${clinic.phone.replace(/\s/g, '')}`,
      type:  'URI_WEB',
      usage: ['USAGE_APPLE_WALLET', 'USAGE_GOOGLE_PAY'],
    });
  }
  if (clinic.booking_url) {
    links.push({
      title: 'Book an Appointment',
      url:   clinic.booking_url,
      type:  'URI_WEB',
      usage: ['USAGE_GOOGLE_PAY'],
    });
  }
  if (clinic.google_review_url) {
    links.push({
      title: 'Leave a Review',
      url:   clinic.google_review_url,
      type:  'URI_WEB',
      usage: ['USAGE_GOOGLE_PAY'],
    });
  }
  return links;
}

/**
 * Full tier body sent to PassKit on create and update.
 * Matches the schema of the actual PassKit template object.
 *
 * Note on logos: PassKit requires images to be uploaded separately via
 * POST /membership/image (returns an imageId). The imageId is stored in
 * clinics.passkit_logo_image_id and injected here when present.
 * Until the image is uploaded, the card uses no logo.
 */
function buildTemplateBody(clinic) {
  return {
    name: clinic.name,
    organizationName: clinic.name,
    protocol: 'MEMBERSHIP',
    revision: 1,
    description: `${clinic.name} Loyalty Card`,
    colors: buildColors(clinic),
    imageIds: clinic.passkit_logo_image_id ? {
      icon:      clinic.passkit_logo_image_id,
      logo:      clinic.passkit_logo_image_id,
      thumbnail: clinic.passkit_logo_image_id,
    } : {},
    data: {
      dataFields: buildDataFields(clinic),
      dataCollectionPageSettings: {
        title: 'Register Below',
        submitButtonText: 'Register',
        loadingText: 'Hang on',
        thankYouText: 'Thank you for registering, we will redirect you to your pass.',
      },
    },
    barcode: {
      format: 'QR',
      payload: '${pid}',
      altText: '${pid}',
      messageEncoding: 'utf8',
    },
    links: buildLinks(clinic),
    appleWalletSettings: { passType: 5 },  // 5 = GENERIC
    googlePaySettings:   { passType: 4 },  // 4 = LOYALTY
    expirySettings:      { expiryType: 'EXPIRE_NONE' },
    defaultLanguage: 'EN',
    timezone: clinic.timezone || 'America/Edmonton',
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Create a per-clinic pass template (card design) via POST /template.
 * Returns the PassKit-generated template ID.
 */
async function createPassTemplate({ clinic }) {
  const body = buildTemplateBody(clinic);
  console.log('[PassKit] POST /template body:', JSON.stringify(body, null, 2));
  const data = await pkFetch('/template', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return data.id;
}

/**
 * Update a clinic's pass template design via PUT /template.
 * PassKit automatically pushes the update to all installed passes using this template.
 */
async function updatePassTemplate({ clinic }) {
  if (!clinic.passkit_template_id) return;
  await pkFetch('/template', {
    method: 'PUT',
    body: JSON.stringify({
      ...buildTemplateBody(clinic),
      id: clinic.passkit_template_design_id,
    }),
  });
}

/**
 * Upload a clinic logo image to PassKit and return the PassKit image ID.
 * Call this after the logo is uploaded to Supabase Storage.
 * Store the returned ID in clinics.passkit_logo_image_id.
 */
export async function uploadClinicLogo({ clinic, imageUrl }) {
  const token = await getToken();
  const res   = await fetch(`${PASSKIT_BASE}/images`, {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name:      `${clinic.name} Logo`,
      imageData: {
        icon: imageUrl,
        logo: imageUrl,
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PassKit image upload error ${res.status}: ${body}`);
  }
  const data = await res.json();
  return data.id ?? data.imageId;
}

/**
 * Create a PassKit program, pass template (design), and tier for a clinic.
 * Called when the setup wizard completes — by then the clinic has its logo,
 * brand color, and all required fields. Creates all three in one shot.
 * Returns { programId, templateDesignId, tierId } — store all three on the clinic row.
 *
 * PassKit hierarchy per clinic:
 *   Program → Template (design) → Tier → Members (patients)
 */
export async function createClinicTemplate({ clinic }) {
  // 1. Create program
  const programBody = {
    name:                     `${clinic.name}`,
    status:                   ['PROJECT_ACTIVE_FOR_OBJECT_CREATION', 'PROJECT_DRAFT'],
    pointsType:               { balanceType: 'BALANCE_TYPE_INT64' },
    profileImageSettings:     'PROFILE_IMAGE_NONE',
    autoDeleteDaysAfterExpiry: 0,
    passRecoverySettings: {
      enabled:  true,
      delivery: 'DELIVERY_REDIRECT',
      fieldsToMatchUponRecovery: ['person.emailAddress'],
    },
  };
  console.log('[PassKit] Step 1: creating program for clinic:', clinic.name);
  const program = await pkFetch('/members/program', { method: 'POST', body: JSON.stringify(programBody) });
  console.log('[PassKit] Step 1 success — programId:', program.id);

  // 2. Create pass template
  console.log('[PassKit] Step 2: creating pass template');
  const templateDesignId = await createPassTemplate({ clinic });
  console.log('[PassKit] Step 2 success — templateDesignId:', templateDesignId);

  // 3. Create tier — needs both programId and passTemplateId
  const tierBody = {
    id:               `${clinic.slug}-member`,
    name:             'Member',
    tierIndex:        1,
    programId:        program.id,
    passTemplateId:   templateDesignId,
    expirySettings:   { expiryType: 'EXPIRE_NONE' },
    timezone:         clinic.timezone || 'America/Edmonton',
    allowTierEnrolment: { value: true },
  };
  console.log('[PassKit] Step 3: creating tier');
  const tier = await pkFetch('/members/tier', { method: 'POST', body: JSON.stringify(tierBody) });
  console.log('[PassKit] Step 3 success — tierId:', tier.id);

  return { programId: program.id, templateDesignId, tierId: tier.id };
}

/**
 * Push updated card design (colors, logo, points label, etc.) to all patient passes.
 * Updates the pass template — PassKit automatically propagates to all installed passes.
 */
export async function updateClinicTemplate({ clinic }) {
  await updatePassTemplate({ clinic });
}

/**
 * Enroll a patient and create their wallet pass.
 * Uses the clinic's own program ID (not the global DentaPass one).
 * Returns { serialNumber, walletUrl }.
 */
export async function enrollPatient({ patient, clinic }) {
  const data = await pkFetch('/members/member', {
    method: 'POST',
    body: JSON.stringify({
      tierId:    clinic.passkit_template_id,
      programId: clinic.passkit_program_id,
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
