'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowser } from '../../lib/supabase-browser';
import { onboardClinic, getOnboardSession } from '../../lib/api';

function OnboardForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');

  const [step, setStep] = useState('form');
  const [clinicName, setClinicName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sessionId) router.replace('/#pricing');
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
      if (email) await getSupabaseBrowser().auth.signInWithPassword({ email, password });
      setStep('success');
      setTimeout(() => router.push('/dashboard'), 1800);
    } catch (err) {
      setError(err.data?.error || 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  if (step === 'success') {
    return (
      <>
        <style>{`
          @keyframes successPulse {
            0%,100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(59,191,185,0.4); }
            50% { transform: scale(1.04); box-shadow: 0 0 0 20px rgba(59,191,185,0); }
          }
          @keyframes successIn {
            from { opacity:0; transform:translateY(20px) scale(0.96); }
            to   { opacity:1; transform:translateY(0) scale(1); }
          }
          .dp-success-card { animation: successIn 0.6s cubic-bezier(0.16,1,0.3,1) both; }
          .dp-check-ring { animation: successPulse 2s ease-in-out infinite; }
        `}</style>
        <div style={{ ...s.page, background: '#f5f0ea' }}>
          <div className="dp-success-card" style={{ ...s.card, background: '#fff', border: '1px solid #e8f7f6' }}>
            <div className="dp-check-ring" style={s.checkRing}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M4 12l6 6L20 6" stroke="#3bbfb9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 style={{ ...s.h1, color: '#0b1a19' }}>You're all set!</h1>
            <p style={{ ...s.sub, color: '#6b7280' }}>Taking you to your dashboard…</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`
        @keyframes floatOrbA { 0%,100%{transform:translate(0,0) scale(1)} 40%{transform:translate(30px,-40px) scale(1.05)} 70%{transform:translate(-20px,20px) scale(0.97)} }
        @keyframes floatOrbB { 0%,100%{transform:translate(0,0) scale(1)} 35%{transform:translate(-30px,40px) scale(1.03)} 65%{transform:translate(25px,-15px) scale(0.98)} }
        @keyframes cardIn { from{opacity:0;transform:translateY(28px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        .dp-ob-card { animation: cardIn 0.7s cubic-bezier(0.16,1,0.3,1) both; }
        .dp-ob-orba { animation: floatOrbA 16s ease-in-out infinite; }
        .dp-ob-orbb { animation: floatOrbB 20s ease-in-out infinite; }
        .dp-ob-input { transition: border-color 0.2s, box-shadow 0.2s, background 0.2s; }
        .dp-ob-input:focus { border-color: rgba(59,191,185,0.55) !important; box-shadow: 0 0 0 3px rgba(59,191,185,0.1) !important; background: rgba(59,191,185,0.04) !important; outline:none; }
        .dp-ob-input::placeholder { color: rgba(255,255,255,0.2); }
        .dp-ob-btn { transition: transform 0.2s, box-shadow 0.2s; }
        .dp-ob-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 16px 40px rgba(59,191,185,0.4) !important; }
      `}</style>

      <div style={s.page}>
        <div className="dp-ob-orba" style={s.orbA} />
        <div className="dp-ob-orbb" style={s.orbB} />

        <div className="dp-ob-card" style={s.card}>
          <div style={s.logoWrap}>
            <img src="/dentapass-logo.png" alt="DentaPass" style={{ height: 48, width: 'auto' }} />
          </div>

          <div style={s.badge}>Payment confirmed ✓</div>
          <h1 style={s.h1}>Set up your clinic</h1>
          <p style={s.sub}>Just a few details and you're live.</p>

          <form onSubmit={handleSubmit} style={s.form}>
            <div style={s.field}>
              <label style={s.label}>Clinic name</label>
              <input
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
                className="dp-ob-input"
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
                className="dp-ob-input"
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
                className="dp-ob-input"
                style={s.input}
                placeholder="Repeat password"
                required
              />
            </div>

            {error && <p style={s.errText}>{error}</p>}

            <button type="submit" disabled={submitting} className="dp-ob-btn" style={s.btn}>
              {submitting ? 'Creating your account…' : 'Create account →'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

export default function OnboardPage() {
  return <Suspense><OnboardForm /></Suspense>;
}

const s = {
  page: {
    minHeight: '100vh',
    background: '#0b1a19',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
    fontFamily: "'DM Sans', sans-serif",
    position: 'relative',
    overflow: 'hidden',
  },
  orbA: {
    position: 'absolute',
    top: '-20%',
    right: '-10%',
    width: 650,
    height: 650,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(59,191,185,0.16) 0%, transparent 65%)',
    pointerEvents: 'none',
  },
  orbB: {
    position: 'absolute',
    bottom: '-25%',
    left: '-15%',
    width: 550,
    height: 550,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(245,240,234,0.06) 0%, transparent 65%)',
    pointerEvents: 'none',
  },
  card: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(59,191,185,0.18)',
    backdropFilter: 'blur(32px)',
    WebkitBackdropFilter: 'blur(32px)',
    borderRadius: 28,
    padding: '48px 44px',
    width: '100%',
    maxWidth: 460,
    textAlign: 'center',
    position: 'relative',
    zIndex: 1,
    boxShadow: '0 40px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
  },
  logoWrap: { marginBottom: 24 },
  badge: {
    display: 'inline-block',
    background: 'rgba(59,191,185,0.12)',
    border: '1px solid rgba(59,191,185,0.25)',
    color: '#3bbfb9',
    fontSize: 12,
    fontWeight: 600,
    padding: '5px 14px',
    borderRadius: 980,
    marginBottom: 16,
    letterSpacing: '0.02em',
  },
  h1: {
    fontFamily: "'Instrument Serif', serif",
    fontSize: 30,
    fontWeight: 400,
    color: '#fff',
    margin: '0 0 8px',
    letterSpacing: '-0.03em',
  },
  sub: { fontSize: 15, color: 'rgba(255,255,255,0.4)', margin: '0 0 32px', lineHeight: 1.6 },
  form: { display: 'flex', flexDirection: 'column', gap: 18, textAlign: 'left' },
  field: { display: 'flex', flexDirection: 'column', gap: 7 },
  label: { fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.08em', textTransform: 'uppercase' },
  input: {
    padding: '13px 16px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 12,
    fontSize: 15,
    color: '#fff',
    fontFamily: "'DM Sans', sans-serif",
  },
  errText: { fontSize: 13, color: '#f87171', margin: 0, textAlign: 'left' },
  btn: {
    background: '#3bbfb9',
    color: '#081312',
    border: 'none',
    borderRadius: 12,
    padding: '15px',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: 6,
    letterSpacing: '-0.01em',
    boxShadow: '0 8px 24px rgba(59,191,185,0.25)',
    fontFamily: "'DM Sans', sans-serif",
  },
  checkRing: {
    width: 72,
    height: 72,
    borderRadius: '50%',
    background: 'rgba(59,191,185,0.1)',
    border: '1.5px solid rgba(59,191,185,0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 24px',
  },
};
