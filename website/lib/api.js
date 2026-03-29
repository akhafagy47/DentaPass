/**
 * DentaPass API client
 * All calls go to the backend service (NEXT_PUBLIC_BACKEND_URL).
 * Server-side calls use BACKEND_URL (not exposed to browser).
 */

function backendUrl() {
  return (
    (typeof window === 'undefined'
      ? process.env.BACKEND_URL          // server-side (SSR, API routes)
      : process.env.NEXT_PUBLIC_BACKEND_URL) // client-side
    || 'http://localhost:4000'
  );
}

async function apiFetch(path, options = {}, authToken = null) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  const res = await fetch(`${backendUrl()}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) throw Object.assign(new Error(data.error || 'API error'), { status: res.status, data });
  return data;
}

// ── Enrollment ────────────────────────────────────────────────────────────────

export function enrollPatient(body) {
  return apiFetch('/enrollment', { method: 'POST', body: JSON.stringify(body) });
}

// ── Points ────────────────────────────────────────────────────────────────────

export function awardPoints(body, authToken) {
  return apiFetch('/points/award', { method: 'POST', body: JSON.stringify(body) }, authToken);
}

// ── Patients ──────────────────────────────────────────────────────────────────

export function getPatientBySerial(serial) {
  return apiFetch(`/patients/by-serial/${encodeURIComponent(serial)}`);
}

export function updatePatient(id, body, authToken) {
  return apiFetch(`/patients/${id}`, { method: 'PATCH', body: JSON.stringify(body) }, authToken);
}

export function notifyPatient(id, type, authToken) {
  return apiFetch(`/patients/${id}/notify`, { method: 'POST', body: JSON.stringify({ type }) }, authToken);
}

// ── Clinics ───────────────────────────────────────────────────────────────────

export function getClinic(slug) {
  return apiFetch(`/clinics/${slug}`);
}

export function updateClinic(id, body, authToken) {
  return apiFetch(`/clinics/${id}`, { method: 'PATCH', body: JSON.stringify(body) }, authToken);
}

export function onboardClinic(body) {
  return apiFetch('/clinics/onboard', { method: 'POST', body: JSON.stringify(body) });
}

export function getOnboardSession(sessionId) {
  return apiFetch(`/clinics/onboard/session?session_id=${sessionId}`);
}

// ── Billing ───────────────────────────────────────────────────────────────────

export function createCheckout(plan, email) {
  return apiFetch('/billing/checkout', { method: 'POST', body: JSON.stringify({ plan, email }) });
}

export function getBillingPortalUrl(authToken) {
  return apiFetch('/billing/portal', {}, authToken);
}
