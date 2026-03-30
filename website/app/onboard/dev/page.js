'use client';

// DEV ONLY — bypasses Stripe for local testing.
// This page is only usable when NEXT_PUBLIC_DEV_ONBOARD=true.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '../../../lib/supabase-browser';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4001';

export default function DevOnboardPage() {
  const router = useRouter();

  // Block in production
  if (process.env.NEXT_PUBLIC_DEV_ONBOARD !== 'true') {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <h1 style={s.h1}>Not available</h1>
          <p style={s.sub}>This page is only enabled in development.</p>
        </div>
      </div>
    );
  }

  return <DevForm router={router} />;
}

function DevForm({ router }) {
  const [email, setEmail]             = useState('');
  const [clinicName, setClinicName]   = useState('');
  const [password, setPassword]       = useState('');
  const [plan, setPlan]               = useState('solo');
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState('');
  const [done, setDone]               = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await fetch(`${BACKEND}/clinics/onboard/dev`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, clinicName, password, plan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');

      // Sign in then hard-navigate — full reload avoids the Navigator Lock conflict
      await getSupabaseBrowser().auth.signInWithPassword({ email, password });
      setDone(true);
      setTimeout(() => { window.location.href = '/dashboard/setup'; }, 1200);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <div style={s.check}>✓</div>
          <h1 style={s.h1}>Account created</h1>
          <p style={s.sub}>Taking you to the dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.devBadge}>DEV ONLY — No Stripe required</div>
        <h1 style={s.h1}>Create test clinic</h1>
        <p style={s.sub}>Bypasses payment for local testing.</p>

        <form onSubmit={handleSubmit} style={s.form}>
          <Field label="Email" value={email} onChange={setEmail} placeholder="owner@clinic.com" />
          <Field label="Clinic name" value={clinicName} onChange={setClinicName} placeholder="Clinic Name" />
          <Field label="Password (min 8 chars)" value={password} onChange={setPassword} type="password" placeholder="••••••••" />
          <div style={s.field}>
            <label style={s.label}>Plan</label>
            <select value={plan} onChange={(e) => setPlan(e.target.value)} style={s.input}>
              <option value="solo">Solo (500 patients)</option>
              <option value="growth">Growth (2,000 patients)</option>
              <option value="pro">Pro (10,000 patients)</option>
            </select>
          </div>

          {error && <p style={s.err}>{error}</p>}

          <button type="submit" disabled={submitting} style={s.btn}>
            {submitting ? 'Creating…' : 'Create & sign in →'}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder }) {
  return (
    <div style={s.field}>
      <label style={s.label}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={s.input}
        required
      />
    </div>
  );
}

const s = {
  page: {
    minHeight: '100vh',
    background: '#f4f6f9',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 16, fontFamily: "'DM Sans', sans-serif",
  },
  card: {
    background: '#fff', borderRadius: 20, padding: '36px',
    width: '100%', maxWidth: 420,
    boxShadow: '0 4px 24px rgba(0,0,0,0.07)',
    textAlign: 'center',
  },
  devBadge: {
    display: 'inline-block',
    background: '#fef9c3', color: '#854d0e',
    fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
    padding: '4px 10px', borderRadius: 20, marginBottom: 16,
  },
  check: {
    width: 56, height: 56, borderRadius: '50%',
    background: '#dcfce7', color: '#16a34a',
    fontSize: 24, display: 'flex', alignItems: 'center',
    justifyContent: 'center', margin: '0 auto 16px',
  },
  h1: { fontSize: 22, fontWeight: 700, color: '#111', margin: '0 0 6px' },
  sub: { fontSize: 14, color: '#64748b', margin: '0 0 24px' },
  form: { display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'left' },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: { fontSize: 12, fontWeight: 600, color: '#374151' },
  input: {
    padding: '10px 12px', border: '1.5px solid #e2e8f0',
    borderRadius: 8, fontSize: 14, outline: 'none',
    fontFamily: 'inherit',
  },
  err: { fontSize: 13, color: '#dc2626', margin: 0 },
  btn: {
    background: '#111', color: '#fff', border: 'none',
    borderRadius: 10, padding: '13px', fontSize: 15,
    fontWeight: 600, cursor: 'pointer', marginTop: 4,
  },
};
