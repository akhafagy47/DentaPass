'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { enrollPatient, getClinic } from '../../../lib/api';

export default function JoinPage() {
  const { clinicSlug } = useParams();
  const searchParams = useSearchParams();
  const ref = searchParams.get('ref');

  const [step, setStep] = useState('form'); // 'form' | 'success' | 'error'
  const [submitting, setSubmitting] = useState(false);
  const [walletUrl, setWalletUrl] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [clinicName, setClinicName] = useState('');

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });
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
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      e.email = 'Invalid email';
    }
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
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.iconCircle}>✓</div>
          <h1 style={styles.h1}>You're in!</h1>
          <p style={styles.subtitle}>
            {clinicName ? `Welcome to ${clinicName}'s loyalty program.` : 'Your loyalty card is ready.'}
            {' '}Add it to your wallet to start earning points.
          </p>

          {walletUrl && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}>
              <a href={walletUrl} style={styles.universalBtn}>
                Add to Wallet
              </a>
            </div>
          )}

          {ref && (
            <p style={styles.referralNote}>
              Your friend will receive 250 bonus points for referring you!
            </p>
          )}
        </div>
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{ ...styles.iconCircle, background: '#fee2e2', color: '#dc2626' }}>✕</div>
          <h1 style={styles.h1}>Oops</h1>
          <p style={styles.subtitle}>{errorMsg}</p>
          <button onClick={() => setStep('form')} style={styles.submitBtn}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}><img src="/dentapass-logo.png" alt="DentaPass" style={{ height: 40, width: 'auto' }} /></div>
        <h1 style={styles.h1}>Join the loyalty program</h1>
        {clinicName && <p style={styles.clinicName}>{clinicName}</p>}
        <p style={styles.subtitle}>
          Earn points, get recall reminders, and share your referral link — all from your Apple or Google Wallet.
        </p>

        {ref && (
          <div style={styles.refBanner}>
            🎁 You were referred! You'll both earn bonus points.
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>First name *</label>
              <input
                style={{ ...styles.input, ...(errors.firstName ? styles.inputError : {}) }}
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                placeholder="Jane"
                autoComplete="given-name"
              />
              {errors.firstName && <span style={styles.errText}>{errors.firstName}</span>}
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Last name *</label>
              <input
                style={{ ...styles.input, ...(errors.lastName ? styles.inputError : {}) }}
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                placeholder="Smith"
                autoComplete="family-name"
              />
              {errors.lastName && <span style={styles.errText}>{errors.lastName}</span>}
            </div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              style={{ ...styles.input, ...(errors.email ? styles.inputError : {}) }}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="jane@example.com"
              autoComplete="email"
            />
            {errors.email && <span style={styles.errText}>{errors.email}</span>}
            <span style={styles.hint}>Recommended — used for recall reminders</span>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Phone</label>
            <input
              type="tel"
              style={styles.input}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+1 780 555 0100"
              autoComplete="tel"
            />
          </div>

          <button type="submit" disabled={submitting} style={styles.submitBtn}>
            {submitting ? 'Adding you…' : 'Get my wallet card →'}
          </button>
        </form>

        <p style={styles.fine}>
          By joining, you agree to receive push notifications from your dental clinic.
          No app download required.
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #f0f7ff 0%, #e8f4fd 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
    fontFamily: "'DM Sans', sans-serif",
  },
  card: {
    background: '#fff',
    borderRadius: 20,
    padding: '40px 32px',
    maxWidth: 480,
    width: '100%',
    boxShadow: '0 4px 32px rgba(0,0,0,0.08)',
    textAlign: 'center',
  },
  logo: { fontSize: 40, marginBottom: 16 },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    background: '#dcfce7',
    color: '#16a34a',
    fontSize: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px',
  },
  h1: { fontSize: 26, fontWeight: 700, color: '#111', margin: '0 0 8px' },
  clinicName: { fontSize: 14, color: '#006FEE', fontWeight: 600, margin: '0 0 8px' },
  subtitle: { fontSize: 15, color: '#555', lineHeight: 1.5, margin: '0 0 4px' },
  refBanner: {
    background: '#fefce8',
    border: '1px solid #fde047',
    borderRadius: 10,
    padding: '10px 16px',
    fontSize: 14,
    color: '#713f12',
    marginTop: 16,
  },
  row: { display: 'flex', gap: 12 },
  field: { flex: 1, display: 'flex', flexDirection: 'column', gap: 4, textAlign: 'left' },
  label: { fontSize: 13, fontWeight: 600, color: '#333' },
  input: {
    padding: '10px 14px',
    border: '1.5px solid #e2e8f0',
    borderRadius: 10,
    fontSize: 15,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  },
  inputError: { borderColor: '#dc2626' },
  errText: { fontSize: 12, color: '#dc2626' },
  hint: { fontSize: 12, color: '#94a3b8' },
  submitBtn: {
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
  walletBtn: {
    display: 'flex',
    justifyContent: 'center',
    textDecoration: 'none',
  },
  universalBtn: {
    background: '#111',
    color: '#fff',
    borderRadius: 12,
    padding: '14px',
    fontSize: 15,
    fontWeight: 600,
    textDecoration: 'none',
    display: 'block',
  },
  referralNote: {
    fontSize: 13,
    color: '#16a34a',
    marginTop: 16,
    background: '#dcfce7',
    borderRadius: 8,
    padding: '8px 12px',
  },
  fine: { fontSize: 12, color: '#94a3b8', marginTop: 20, lineHeight: 1.5 },
};
