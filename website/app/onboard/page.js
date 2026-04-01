'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowser } from '../../lib/supabase-browser';
import { onboardClinic, getOnboardSession } from '../../lib/api';

function OnboardForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');

  const [step, setStep] = useState('form'); // 'form' | 'success' | 'error'
  const [clinicName, setClinicName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sessionId) {
      router.replace('/#pricing');
    }
  }, [sessionId, router]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!clinicName.trim()) return setError('Clinic name is required.');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirmPassword) return setError('Passwords do not match.');

    setSubmitting(true);

    try {
      await onboardClinic({ sessionId, clinicName: clinicName.trim(), password });

      const { email } = await getOnboardSession(sessionId);
      if (email) {
        await getSupabaseBrowser().auth.signInWithPassword({ email, password });
      }

      setStep('success');
      setTimeout(() => router.push('/dashboard'), 1500);
    } catch (err) {
      setError(err.data?.error || 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  if (step === 'success') {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <div style={s.checkCircle}>✓</div>
          <h1 style={s.h1}>You're all set!</h1>
          <p style={s.sub}>Taking you to your dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logo}><img src="/dentapass-logo.png" alt="DentaPass" style={{ height: 40, width: 'auto' }} /></div>
        <h1 style={s.h1}>Set up your clinic</h1>
        <p style={s.sub}>Payment confirmed. Just a few details and you're in.</p>

        <form onSubmit={handleSubmit} style={s.form}>
          <div style={s.field}>
            <label style={s.label}>Clinic name</label>
            <input
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
              style={s.input}
              placeholder="Smart Dental Art"
              required
              autoFocus
            />
          </div>

          <div style={s.field}>
            <label style={s.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={s.input}
              placeholder="At least 8 characters"
              required
            />
          </div>

          <div style={s.field}>
            <label style={s.label}>Confirm password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={s.input}
              placeholder="Repeat password"
              required
            />
          </div>

          {error && <p style={s.errText}>{error}</p>}

          <button type="submit" disabled={submitting} style={s.btn}>
            {submitting ? 'Creating your account…' : 'Create account →'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function OnboardPage() {
  return (
    <Suspense>
      <OnboardForm />
    </Suspense>
  );
}

const s = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #f0f7ff 0%, #e8f4fd 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    fontFamily: "'DM Sans', sans-serif",
  },
  card: {
    background: '#fff',
    borderRadius: 20,
    padding: '40px 36px',
    width: '100%',
    maxWidth: 440,
    boxShadow: '0 4px 32px rgba(0,0,0,0.08)',
    textAlign: 'center',
  },
  logo: { fontSize: 40, marginBottom: 12 },
  checkCircle: {
    width: 64, height: 64, borderRadius: '50%',
    background: '#dcfce7', color: '#16a34a',
    fontSize: 28, display: 'flex', alignItems: 'center',
    justifyContent: 'center', margin: '0 auto 16px',
  },
  h1: { fontSize: 26, fontWeight: 700, color: '#111', margin: '0 0 8px' },
  sub: { fontSize: 15, color: '#64748b', margin: '0 0 28px' },
  form: { display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'left' },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: { fontSize: 13, fontWeight: 600, color: '#374151' },
  input: {
    padding: '11px 14px',
    border: '1.5px solid #e2e8f0',
    borderRadius: 10,
    fontSize: 15,
    outline: 'none',
  },
  errText: { fontSize: 13, color: '#dc2626', margin: 0 },
  btn: {
    background: '#006FEE',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    padding: '14px',
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 4,
  },
};
