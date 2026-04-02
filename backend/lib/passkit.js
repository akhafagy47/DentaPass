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

import { createHash } from 'crypto';

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

// Deterministic base58-encoded ID — PassKit's native "uuidCompressedString" format
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58(buf) {
  let n = BigInt('0x' + buf.toString('hex'));
  let s = '';
  while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n; }
  // Pad to 22 chars — PassKit uuidCompressedString is always 22 characters
  // ('1' is the zero character in this base58 alphabet)
  return s.padStart(22, '1');
}
function linkId(name) {
  return base58(createHash('md5').update(name).digest());
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
  const label      = clinic.points_label || 'Points';
  const isDiscount = clinic.rewards_mode === 'discounts' && clinic.points_per_dollar;
  const infoText   = isDiscount
    ? `Earn ${label} at every visit. Redeem: ${clinic.points_per_dollar} ${label} = $1 discount.`
    : `Earn ${label} at every visit. Bronze → Silver → Gold.`;

  return [
    // ── FRONT FIELDS ────────────────────────────────────────────────────────────

    // Clinic name — header bar (Apple Wallet) / program name (Google Wallet)
    {
      uniqueName: 'members.program.name',
      label: '',
      dataType: 'TEXT',
      defaultValue: clinic.name,
      usage: ['USAGE_APPLE_WALLET', 'USAGE_GOOGLE_PAY'],
      appleWalletFieldRenderOptions: {
        textAlignment: 'NATURAL',
        positionSettings: { section: 'HEADER_FIELDS', priority: 0 },
        changeMessage: '',
        dateStyle: 'DATE_TIME_STYLE_DO_NOT_USE',
        timeStyle: 'DATE_TIME_STYLE_DO_NOT_USE',
        numberStyle: 'NUMBER_STYLE_DO_NOT_USE',
      },
      googlePayFieldRenderOptions: { googlePayPosition: 'GOOGLE_PAY_LOYALTY_PROGRAM_NAME', textModulePriority: 0 },
    },

    // Patient name — large primary field with "MEMBER" label
    {
      uniqueName: 'person.displayName',
      isRequired: true,
      label: 'MEMBER',
      dataType: 'TEXT',
      defaultValue: 'N/A',
      userCanSetValue: true,
      usage: ['USAGE_APPLE_WALLET', 'USAGE_GOOGLE_PAY', 'USAGE_DATA_COLLECTION_PAGE'],
      appleWalletFieldRenderOptions: {
        textAlignment: 'LEFT',
        positionSettings: { section: 'PRIMARY_FIELDS', priority: 0 },
        changeMessage: '',
        dateStyle: 'DATE_TIME_STYLE_DO_NOT_USE',
        timeStyle: 'DATE_TIME_STYLE_DO_NOT_USE',
        numberStyle: 'NUMBER_STYLE_DO_NOT_USE',
      },
      googlePayFieldRenderOptions: { googlePayPosition: 'GOOGLE_PAY_LOYALTY_ACCOUNT_NAME', textModulePriority: 0 },
    },

    // Tier badge — secondary row, left side
    {
      uniqueName: 'members.tier.name',
      label: 'Status',
      dataType: 'TEXT',
      defaultValue: isDiscount ? `${clinic.points_per_dollar} ${label} = $1` : 'Bronze Member',
      usage: ['USAGE_APPLE_WALLET', 'USAGE_GOOGLE_PAY'],
      appleWalletFieldRenderOptions: {
        textAlignment: 'LEFT',
        positionSettings: { section: 'SECONDARY_FIELDS', priority: 0 },
        changeMessage: 'You reached %@ status!',
        dateStyle: 'DATE_TIME_STYLE_DO_NOT_USE',
        timeStyle: 'DATE_TIME_STYLE_DO_NOT_USE',
        numberStyle: 'NUMBER_STYLE_DO_NOT_USE',
      },
      googlePayFieldRenderOptions: { googlePayPosition: 'GOOGLE_PAY_LOYALTY_REWARDS_TIER', textModulePriority: 0 },
    },

    // Points balance — auxiliary row, left side (large number)
    {
      uniqueName: 'members.member.points',
      label,
      dataType: 'INT',
      defaultValue: '0',
      usage: ['USAGE_APPLE_WALLET', 'USAGE_GOOGLE_PAY'],
      appleWalletFieldRenderOptions: {
        textAlignment: 'LEFT',
        positionSettings: { section: 'AUXILIARY_FIELDS', priority: 0 },
        changeMessage: `You now have %@ ${label}!`,
        dateStyle: 'DATE_TIME_STYLE_DO_NOT_USE',
        timeStyle: 'DATE_TIME_STYLE_DO_NOT_USE',
        numberStyle: 'NUMBER_STYLE_DO_NOT_USE',
      },
      googlePayFieldRenderOptions: { googlePayPosition: 'GOOGLE_PAY_LOYALTY_POINTS', textModulePriority: 0 },
    },

    // Notification trigger — auxiliary row, front of card.
    // Value is updated by sendNotification(); changeMessage: '%@' causes iOS
    // to display the value as a lock screen alert. Empty label so it stays
    // invisible when blank; Apple Wallet omits empty fields from the visual layout.
    {
      uniqueName: 'meta.notificationMessage',
      label: '',
      dataType: 'TEXT',
      defaultValue: '',
      usage: ['USAGE_APPLE_WALLET'],
      appleWalletFieldRenderOptions: {
        textAlignment: 'LEFT',
        positionSettings: { section: 'AUXILIARY_FIELDS', priority: 2 },
        changeMessage: '%@',
        dateStyle: 'DATE_TIME_STYLE_DO_NOT_USE',
        timeStyle: 'DATE_TIME_STYLE_DO_NOT_USE',
        numberStyle: 'NUMBER_STYLE_DO_NOT_USE',
      },
      googlePayFieldRenderOptions: { googlePayPosition: 'GOOGLE_PAY_FIELD_DO_NOT_USE', textModulePriority: 0 },
    },

    // Next checkup date — auxiliary row, right side (front of card)
    {
      uniqueName: 'meta.nextCheckupDate',
      label: 'Next checkup',
      dataType: 'DATE_YYYYMMDD',
      defaultValue: '',
      usage: ['USAGE_APPLE_WALLET', 'USAGE_GOOGLE_PAY'],
      appleWalletFieldRenderOptions: {
        textAlignment: 'RIGHT',
        positionSettings: { section: 'AUXILIARY_FIELDS', priority: 1 },
        changeMessage: 'Your next checkup is %@.',
        dateStyle: 'DATE_TIME_STYLE_MEDIUM',
        timeStyle: 'DATE_TIME_STYLE_DO_NOT_USE',
        numberStyle: 'NUMBER_STYLE_DO_NOT_USE',
      },
      googlePayFieldRenderOptions: { googlePayPosition: 'GOOGLE_PAY_TEXT_MODULE', textModulePriority: 0 },
    },

    // Appointment time — auxiliary row, front of card (invisible when blank)
    {
      uniqueName: 'meta.appointmentTime',
      label: 'Time',
      dataType: 'TEXT',
      defaultValue: '',
      usage: ['USAGE_APPLE_WALLET', 'USAGE_GOOGLE_PAY'],
      appleWalletFieldRenderOptions: {
        textAlignment: 'RIGHT',
        positionSettings: { section: 'AUXILIARY_FIELDS', priority: 3 },
        changeMessage: '',
        dateStyle: 'DATE_TIME_STYLE_DO_NOT_USE',
        timeStyle: 'DATE_TIME_STYLE_DO_NOT_USE',
        numberStyle: 'NUMBER_STYLE_DO_NOT_USE',
      },
      googlePayFieldRenderOptions: { googlePayPosition: 'GOOGLE_PAY_TEXT_MODULE', textModulePriority: 1 },
    },

    // ── BACK FIELDS (Apple Wallet back + PassKit web/Google Pay detail view) ────

    // Instructions — Apple Wallet only, shown at the top of the back
    {
      uniqueName: 'meta.instructions',
      label: '📋 To access links',
      dataType: 'TEXT',
      defaultValue: 'Open the Wallet app → tap ··· (top right) → Pass Details to book appointments, call us, get directions, and share your referral link.',
      usage: ['USAGE_APPLE_WALLET'],
      appleWalletFieldRenderOptions: {
        textAlignment: 'LEFT',
        positionSettings: { section: 'BACK_FIELDS', priority: 0 },
        changeMessage: '',
        dateStyle: 'DATE_TIME_STYLE_DO_NOT_USE',
        timeStyle: 'DATE_TIME_STYLE_DO_NOT_USE',
        numberStyle: 'NUMBER_STYLE_DO_NOT_USE',
      },
      googlePayFieldRenderOptions: { googlePayPosition: 'GOOGLE_PAY_FIELD_DO_NOT_USE', textModulePriority: 0 },
    },

    // Member since — join date
    {
      uniqueName: 'meta.memberSince',
      label: 'Member since',
      dataType: 'DATE_YYYYMM',
      defaultValue: '',
      usage: ['USAGE_APPLE_WALLET', 'USAGE_GOOGLE_PAY'],
      appleWalletFieldRenderOptions: {
        textAlignment: 'LEFT',
        positionSettings: { section: 'BACK_FIELDS', priority: 1 },
        changeMessage: '',
        dateStyle: 'DATE_TIME_STYLE_MEDIUM',
        timeStyle: 'DATE_TIME_STYLE_DO_NOT_USE',
        numberStyle: 'NUMBER_STYLE_DO_NOT_USE',
      },
      googlePayFieldRenderOptions: { googlePayPosition: 'GOOGLE_PAY_TEXT_MODULE', textModulePriority: 2 },
    },

    // Next checkup date — repeated on back for easy reference
    {
      uniqueName: 'meta.nextCheckupDateBack',
      label: 'Next checkup',
      dataType: 'DATE_YYYYMMDD',
      defaultValue: '',
      usage: ['USAGE_APPLE_WALLET'],
      appleWalletFieldRenderOptions: {
        textAlignment: 'LEFT',
        positionSettings: { section: 'BACK_FIELDS', priority: 1 },
        changeMessage: '',
        dateStyle: 'DATE_TIME_STYLE_MEDIUM',
        timeStyle: 'DATE_TIME_STYLE_DO_NOT_USE',
        numberStyle: 'NUMBER_STYLE_DO_NOT_USE',
      },
      googlePayFieldRenderOptions: { googlePayPosition: 'GOOGLE_PAY_TEXT_MODULE', textModulePriority: 0 },
    },

    // Appointment time — repeated on back alongside the checkup date
    {
      uniqueName: 'meta.appointmentTimeBack',
      label: 'Appointment time',
      dataType: 'TEXT',
      defaultValue: '',
      usage: ['USAGE_APPLE_WALLET', 'USAGE_GOOGLE_PAY'],
      appleWalletFieldRenderOptions: {
        textAlignment: 'LEFT',
        positionSettings: { section: 'BACK_FIELDS', priority: 2 },
        changeMessage: '', //'Your appointment is at %@.',
        dateStyle: 'DATE_TIME_STYLE_DO_NOT_USE',
        timeStyle: 'DATE_TIME_STYLE_DO_NOT_USE',
        numberStyle: 'NUMBER_STYLE_DO_NOT_USE',
      },
      googlePayFieldRenderOptions: { googlePayPosition: 'GOOGLE_PAY_TEXT_MODULE', textModulePriority: 1 },
    },

    // Referral link — patient-specific URL set at enrollment
    {
      uniqueName: 'meta.referralLink',
      label: 'Refer a friend',
      dataType: 'URL',
      defaultValue: '',
      usage: ['USAGE_APPLE_WALLET', 'USAGE_GOOGLE_PAY'],
      appleWalletFieldRenderOptions: {
        textAlignment: 'LEFT',
        positionSettings: { section: 'BACK_FIELDS', priority: 3 },
        changeMessage: '',
        dateStyle: 'DATE_TIME_STYLE_DO_NOT_USE',
        timeStyle: 'DATE_TIME_STYLE_DO_NOT_USE',
        numberStyle: 'NUMBER_STYLE_DO_NOT_USE',
      },
      googlePayFieldRenderOptions: { googlePayPosition: 'GOOGLE_PAY_TEXT_MODULE', textModulePriority: 4 },
    },

    // Program info / rewards explanation
    {
      uniqueName: 'universal.info',
      label: 'About this card',
      dataType: 'TEXT_LONG',
      defaultValue: infoText,
      usage: ['USAGE_APPLE_WALLET', 'USAGE_GOOGLE_PAY'],
      appleWalletFieldRenderOptions: {
        textAlignment: 'LEFT',
        positionSettings: { section: 'BACK_FIELDS', priority: 4 },
        changeMessage: '',
        dateStyle: 'DATE_TIME_STYLE_DO_NOT_USE',
        timeStyle: 'DATE_TIME_STYLE_DO_NOT_USE',
        numberStyle: 'NUMBER_STYLE_DO_NOT_USE',
      },
      googlePayFieldRenderOptions: { googlePayPosition: 'GOOGLE_PAY_TEXT_MODULE', textModulePriority: 1 },
    },
  ];
}

/**
 * Links shown in Google Wallet's detail view (Leave Review, Book Appointment).
 * Apple Wallet uses back fields for the same info.
 */
function buildLinks(clinic) {
  const links = [];
  if (clinic.booking_url) {
    links.push({
      id:    linkId('booking'),
      title: 'Book an Appointment',
      url:   clinic.booking_url,
      type:  'URI_WEB',
      usage: ['USAGE_APPLE_WALLET', 'USAGE_GOOGLE_PAY'],
    });
  }
  if (clinic.phone) {
    links.push({
      id:    linkId('phone'),
      title: 'Call Us',
      url:   `tel:${clinic.phone.replace(/\s/g, '')}`,
      type:  'URI_TEL',
      usage: ['USAGE_APPLE_WALLET', 'USAGE_GOOGLE_PAY'],
    });
  }
  if (clinic.address) {
    links.push({
      id:    linkId('directions'),
      title: 'Get Directions',
      url:   `https://maps.google.com/?q=${encodeURIComponent(clinic.address)}`,
      type:  'URI_LOCATION',
      usage: ['USAGE_APPLE_WALLET', 'USAGE_GOOGLE_PAY'],
    });
  }
  if (clinic.facebook_url) {
    links.push({
      id:    linkId('facebook'),
      title: 'Follow us on Facebook',
      url:   clinic.facebook_url,
      type:  'URI_WEB',
      usage: ['USAGE_APPLE_WALLET', 'USAGE_GOOGLE_PAY'],
    });
  }
  if (clinic.instagram_url) {
    links.push({
      id:    linkId('instagram'),
      title: 'Follow us on Instagram',
      url:   clinic.instagram_url,
      type:  'URI_WEB',
      usage: ['USAGE_APPLE_WALLET', 'USAGE_GOOGLE_PAY'],
    });
  }
  if (clinic.google_review_url) {
    links.push({
      id:    linkId('google-review'),
      title: 'Leave a Google Review',
      url:   clinic.google_review_url,
      type:  'URI_WEB',
      usage: ['USAGE_APPLE_WALLET', 'USAGE_GOOGLE_PAY'],
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
  // Derive the three Supabase image URLs from logo_url.
  // `images` (not `imageIds`) is the correct field for URL-based image injection —
  // PassKit uploads them internally and stores the resulting IDs in imageIds itself.
  const images = clinic.logo_url ? (() => {
    const base = clinic.logo_url.replace(/\/logo\.png(\?.*)?$/, '/');
    return {
      icon:      base + 'logo-icon.png',       // 114×114px
      // thumbnail: base + 'logo-thumbnail.png',  // 320×320px
      logo:      base + 'logo.png',            // 660×660px
    };
  })() : {};

  return {
    name: clinic.name,
    organizationName: clinic.name,
    protocol: 'MEMBERSHIP',
    revision: 1,
    description: `${clinic.name} Loyalty Card`,
    colors: buildColors(clinic),
    images,
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
    appleWalletSettings: { passType: 'GENERIC' },
    googlePaySettings:   { passType: 'LOYALTY' },
    expirySettings:      { expiryType: 'EXPIRE_NONE' },
    defaultLanguage: 'EN',
    timezone: clinic.timezone || 'America/Edmonton',
  };
}

// Format "HH:MM" (24h) → "9:00 AM" for display on the pass
function formatTime(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour   = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
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
  const appUrl      = process.env.WEBSITE_URL || 'https://denta-pass.vercel.app';
  const memberSince = new Date().toISOString().slice(0, 7).replace('-', ''); // YYYYMM
  const referralLink = patient.referral_code
    ? `${appUrl}/join/${clinic.slug}?ref=${patient.referral_code}`
    : '';

  const data = await pkFetch('/members/member', {
    method: 'POST',
    body: JSON.stringify({
      tierId:    clinic.passkit_template_id,
      programId: clinic.passkit_program_id,
      person: {
        forename:     patient.first_name,
        surname:      patient.last_name,
        displayName:  `${patient.first_name} ${patient.last_name}`,
        emailAddress: patient.email        || undefined,
        mobileNumber: patient.phone        || undefined,
      },
      points: patient.points_balance ?? 0,
      metaData: {
        memberSince,
        ...(referralLink ? { referralLink } : {}),
        ...(patient.next_checkup_date ? { nextCheckupDate: patient.next_checkup_date, nextCheckupDateBack: patient.next_checkup_date } : {}),
        ...(patient.next_checkup_time ? { appointmentTime: formatTime(patient.next_checkup_time), appointmentTimeBack: formatTime(patient.next_checkup_time) } : {}),
      },
    }),
  });

  return {
    id:        data.id,
    walletUrl: `${WALLET_BASE}/m/${data.id}`,
  };
}

/**
 * Update a patient's wallet card after a points/tier change.
 * PassKit automatically pushes the update to the installed wallet pass.
 */
export async function updatePatientPass({ patient, clinic }) {
  const appUrl = process.env.WEBSITE_URL || 'https://denta-pass.vercel.app';
  const referralLink = (patient.referral_code && clinic.slug)
    ? `${appUrl}/join/${clinic.slug}?ref=${patient.referral_code}`
    : undefined;

  await pkFetch('/members/member', {
    method: 'PUT',
    body: JSON.stringify({
      id:        patient.passkit_serial_number,
      tierId:    clinic.passkit_template_id,
      programId: clinic.passkit_program_id,
      operation: 'OPERATION_PATCH',
      points:    patient.points_balance,
      person: {
        ...(patient.first_name ? { forename: patient.first_name, displayName: `${patient.first_name} ${patient.last_name || ''}`.trim() } : {}),
        ...(patient.last_name  ? { surname: patient.last_name } : {}),
        ...(patient.email      ? { emailAddress: patient.email } : {}),
        ...(patient.phone      ? { mobileNumber: patient.phone } : {}),
      },
      metaData: {
        tier:                patient.tier || '',
        nextCheckupDate:     patient.next_checkup_date || '',
        nextCheckupDateBack: patient.next_checkup_date || '',
        appointmentTime:     formatTime(patient.next_checkup_time) || '',
        appointmentTimeBack: formatTime(patient.next_checkup_time) || '',
        ...(patient.created_at    ? { memberSince: patient.created_at.slice(0, 7).replace('-', '') } : {}),
        ...(referralLink          ? { referralLink } : {}),
      },
    }),
  });
}

/**
 * Earn (add) points for a patient via the dedicated earn endpoint.
 * Lighter than a full member PUT — use when only points need updating.
 * Identify by PassKit serial number OR externalId + programId.
 */
export async function earnPoints({ serialNumber, externalId, programId, points }) {
  const body = serialNumber
    ? { id: serialNumber, points }
    : { externalId, programId, points };
  const res = await pkFetch('/members/member/points/earn', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  return res.points;
}

/**
 * Set points to a specific balance for a patient.
 * Identify by PassKit serial number OR externalId + programId.
 */
export async function setPoints({ serialNumber, externalId, programId, points, resetPoints = false }) {
  const body = serialNumber
    ? { id: serialNumber, points, resetPoints }
    : { externalId, programId, points, resetPoints };
  const res = await pkFetch('/members/member/points/set', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  return res.points;
}

/**
 * Burn (deduct) points for a patient via the dedicated burn endpoint.
 * Identify by PassKit serial number OR externalId + programId.
 */
export async function burnPoints({ serialNumber, externalId, programId, points }) {
  const body = serialNumber
    ? { id: serialNumber, points }
    : { externalId, programId, points };
  const res = await pkFetch('/members/member/points/burn', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  return res.points;
}

/**
 * Trigger a lock screen notification on an Apple Wallet pass by updating
 * the notificationMessage metadata field. PassKit fires the notification
 * because the PassKit template has changeMessage: "%@" set on this field.
 *
 * This is the ONLY supported notification mechanism — PassKit does not
 * support standalone push messages.
 */
export async function sendNotification(serialNumber, message) {
  const res = await pkFetch('/members/member', {
    method: 'PUT',
    body: JSON.stringify({
      id: serialNumber,
      metaData: { notificationMessage: message },
    }),
  });
  return res;
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
