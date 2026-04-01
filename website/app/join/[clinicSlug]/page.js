'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { enrollPatient, getClinic } from '../../../lib/api';

export default function JoinPage() {
  const { clinicSlug } = useParams();
  const searchParams = useSearchParams();
  const ref = searchParams.get('ref');

  const [step, setStep] = useState('form');
  const [submitting, setSubmitting] = useState(false);
  const [walletUrl, setWalletUrl] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    getClinic(clinicSlug)
      .then((d) => { if (d.name) setClinicName(d.name); })
      .catch(() => {});
  }, [clinicSlug]);

  function validate() {
    const e = {};
    if (!form.firstName.trim()) e.firstName = 'Required';
    if (!form.lastName.trim()) e.lastName = 'Required';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setErrorMsg('');
    try {
      const data = await enrollPatient({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        clinicSlug,
        referralCode: ref || undefined,
      });
      setWalletUrl(data.walletUrl);
      setStep('success');
    } catch (err) {
      const detail = [
        err.data?.error || err.message || 'Unknown error',
        err.status ? `(status ${err.status})` : '',
      ].filter(Boolean).join(' ');
      setErrorMsg(detail);
      setStep('error');
    } finally {
      setSubmitting(false);
    }
  }

  if (step === 'success') {
    return (
      <>
        <style>{`
          @keyframes dp-join-in { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
          @keyframes dp-check-in { from{opacity:0;transform:scale(0.5)} to{opacity:1;transform:scale(1)} }
          @keyframes dp-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
          .dp-join-card { animation: dp-join-in 0.6s cubic-bezier(0.16,1,0.3,1) both; }
          .dp-check-circle { animation: dp-check-in 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.1s both; }
          .dp-wallet-btn { transition: transform 0.2s, box-shadow 0.2s; }
          .dp-wallet-btn:hover { transform: translateY(-2px); box-shadow: 0 16px 40px rgba(59,191,185,0.4) !important; }
        `}</style>
        <div style={s.page}>
          <div style={s.bgGradient} />
          <div className="dp-join-card" style={s.card}>
            <div className="dp-check-circle" style={s.checkCircle}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M4 12l6 6L20 6" stroke="#3bbfb9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 style={s.h1}>You're in!</h1>
            <p style={s.subtitle}>
              {clinicName ? `Welcome to ${clinicName}'s loyalty program.` : 'Your loyalty card is ready.'}
              {' '}Add it to your wallet to start earning points.
            </p>
            {walletUrl && (
              <div style={{ marginTop: 28 }}>
                <a href={walletUrl} className="dp-wallet-btn" style={s.walletBtn}>
                  Add to Wallet →
                </a>
              </div>
            )}
            {ref && (
              <p style={s.referralNote}>
                Your friend will receive 250 bonus points for referring you!
              </p>
            )}
          </div>
        </div>
      </>
    );
  }

  if (step === 'error') {
    return (
      <>
        <style>{`@keyframes dp-join-in{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}.dp-join-card{animation:dp-join-in 0.6s cubic-bezier(0.16,1,0.3,1) both}`}</style>
        <div style={s.page}>
          <div style={s.bgGradient} />
          <div className="dp-join-card" style={s.card}>
            <div style={{ ...s.checkCircle, background: '#fef2f2', border: '1.5px solid #fecaca' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <h1 style={s.h1}>Something went wrong</h1>
            <p style={s.subtitle}>{errorMsg}</p>
            <button onClick={() => setStep('form')} style={s.submitBtn}>
              Try again →
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`
        @keyframes dp-join-in { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes dp-bg-float { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(20px,-20px) scale(1.03)} }
        .dp-join-card { animation: dp-join-in 0.7s cubic-bezier(0.16,1,0.3,1) both; }
        .dp-join-bg-orb { animation: dp-bg-float 18s ease-in-out infinite; }
        .dp-join-input { transition: border-color 0.2s, box-shadow 0.2s; }
        .dp-join-input:focus { border-color: #3bbfb9 !important; box-shadow: 0 0 0 3px rgba(59,191,185,0.1) !important; outline: none; }
        .dp-join-submit { transition: transform 0.2s, box-shadow 0.2s; }
        .dp-join-submit:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 16px 40px rgba(59,191,185,0.35) !important; }
      `}</style>

      <div style={s.page}>
        <div style={s.bgGradient} />
        <div className="dp-join-bg-orb" style={s.bgOrb} />

        <div className="dp-join-card" style={s.card}>
          <div style={s.logoWrap}>
            <img src="/dentapass-logo.png" alt="DentaPass" style={{ height: 44, width: 'auto' }} />
          </div>

          <h1 style={s.h1}>Join the loyalty program</h1>
          {clinicName && <p style={s.clinicName}>{clinicName}</p>}
          <p style={s.subtitle}>
            Earn points, get recall reminders, and share your referral link — all from your Apple or Google Wallet.
          </p>

          {ref && (
            <div style={s.refBanner}>
              <span style={{ fontSize: 16 }}>🎁</span>
              <span>You were referred — you'll both earn bonus points.</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={s.form}>
            <div style={s.row}>
              <div style={s.field}>
                <label style={s.label}>First name *</label>
                <input
                  className="dp-join-input"
                  style={{ ...s.input, ...(errors.firstName ? s.inputErr : {}) }}
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  placeholder="Jane"
                  autoComplete="given-name"
                />
                {errors.firstName && <span style={s.errText}>{errors.firstName}</span>}
              </div>
              <div style={s.field}>
                <label style={s.label}>Last name *</label>
                <input
                  className="dp-join-input"
                  style={{ ...s.input, ...(errors.lastName ? s.inputErr : {}) }}
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  placeholder="Smith"
                  autoComplete="family-name"
                />
                {errors.lastName && <span style={s.errText}>{errors.lastName}</span>}
              </div>
            </div>

            <div style={s.field}>
              <label style={s.label}>Email</label>
              <input
                type="email"
                className="dp-join-input"
                style={{ ...s.input, ...(errors.email ? s.inputErr : {}) }}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="jane@example.com"
                autoComplete="email"
              />
              {errors.email && <span style={s.errText}>{errors.email}</span>}
              <span style={s.hint}>Recommended — used for recall reminders</span>
            </div>

            <div style={s.field}>
              <label style={s.label}>Phone</label>
              <input
                type="tel"
                className="dp-join-input"
                style={s.input}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+1 780 555 0100"
                autoComplete="tel"
              />
            </div>

            <button type="submit" disabled={submitting} className="dp-join-submit" style={s.submitBtn}>
              {submitting ? 'Adding you…' : 'Get my wallet card →'}
            </button>
          </form>

          <p style={s.fine}>
            By joining, you agree to receive push notifications from your dental clinic. No app required.
          </p>
        </div>
      </div>
    </>
  );
}

const s = {
  page: {
    minHeight: '100vh',
    background: '#f5f0ea',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 16px',
    fontFamily: "'DM Sans', sans-serif",
    position: 'relative',
    overflow: 'hidden',
  },
  bgGradient: {
    position: 'absolute',
    inset: 0,
    background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(59,191,185,0.12) 0%, transparent 60%)',
    pointerEvents: 'none',
  },
  bgOrb: {
    position: 'absolute',
    bottom: '-20%',
    right: '-10%',
    width: 500,
    height: 500,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(59,191,185,0.1) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  card: {
    background: '#fff',
    borderRadius: 28,
    padding: '44px 36px',
    maxWidth: 500,
    width: '100%',
    boxShadow: '0 4px 6px rgba(0,0,0,0.02), 0 24px 64px rgba(0,0,0,0.08)',
    textAlign: 'center',
    position: 'relative',
    zIndex: 1,
    border: '1px solid rgba(59,191,185,0.12)',
  },
  logoWrap: { marginBottom: 24 },
  checkCircle: {
    width: 72,
    height: 72,
    borderRadius: '50%',
    background: 'rgba(59,191,185,0.08)',
    border: '1.5px solid rgba(59,191,185,0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 24px',
  },
  h1: {
    fontFamily: "'Instrument Serif', serif",
    fontSize: 28,
    fontWeight: 400,
    color: '#0b1a19',
    margin: '0 0 8px',
    letterSpacing: '-0.02em',
  },
  clinicName: { fontSize: 14, color: '#3bbfb9', fontWeight: 600, margin: '0 0 10px' },
  subtitle: { fontSize: 15, color: '#6b7280', lineHeight: 1.65, margin: '0 0 4px' },
  refBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: 'rgba(59,191,185,0.07)',
    border: '1px solid rgba(59,191,185,0.2)',
    borderRadius: 12,
    padding: '10px 16px',
    fontSize: 14,
    color: '#0d7b77',
    marginTop: 16,
    textAlign: 'left',
  },
  form: { marginTop: 28, display: 'flex', flexDirection: 'column', gap: 16 },
  row: { display: 'flex', gap: 12 },
  field: { flex: 1, display: 'flex', flexDirection: 'column', gap: 5, textAlign: 'left' },
  label: { fontSize: 12, fontWeight: 600, color: '#374151', letterSpacing: '0.02em' },
  input: {
    padding: '11px 14px',
    border: '1.5px solid #e5e2db',
    borderRadius: 10,
    fontSize: 15,
    color: '#0b1a19',
    background: '#fafaf9',
    fontFamily: "'DM Sans', sans-serif",
    boxSizing: 'border-box',
    width: '100%',
  },
  inputErr: { borderColor: '#ef4444' },
  errText: { fontSize: 12, color: '#ef4444' },
  hint: { fontSize: 12, color: '#9ca3af' },
  submitBtn: {
    background: '#3bbfb9',
    color: '#081312',
    border: 'none',
    borderRadius: 12,
    padding: '14px',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: 4,
    letterSpacing: '-0.01em',
    boxShadow: '0 4px 16px rgba(59,191,185,0.2)',
    fontFamily: "'DM Sans', sans-serif",
  },
  walletBtn: {
    display: 'block',
    background: '#3bbfb9',
    color: '#081312',
    borderRadius: 12,
    padding: '14px',
    fontSize: 16,
    fontWeight: 700,
    textDecoration: 'none',
    letterSpacing: '-0.01em',
    boxShadow: '0 4px 16px rgba(59,191,185,0.25)',
  },
  referralNote: {
    fontSize: 13,
    color: '#0d7b77',
    marginTop: 16,
    background: 'rgba(59,191,185,0.07)',
    borderRadius: 8,
    padding: '8px 12px',
  },
  fine: { fontSize: 12, color: '#9ca3af', marginTop: 20, lineHeight: 1.6 },
};
