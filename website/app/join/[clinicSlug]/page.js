'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { enrollPatient, getClinic } from '../../../lib/api';

export default function JoinPage() {
  const { clinicSlug } = useParams();
  const searchParams = useSearchParams();
  const ref = searchParams.get('ref');

  const [step, setStep]           = useState('form');
  const [submitting, setSubmitting] = useState(false);
  const [walletUrl, setWalletUrl] = useState(null);
  const [errorMsg, setErrorMsg]   = useState('');
  const [clinicName, setClinicName]   = useState('');
  const [actionPoints, setActionPoints] = useState(null);
  const [savedTheme, setSavedTheme]   = useState('auto');
  const [systemDark, setSystemDark] = useState(false);
  const [form, setForm]             = useState({ firstName: '', lastName: '', email: '', phone: '', dateOfBirth: '' });
  const [errors, setErrors]         = useState({});

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemDark(mq.matches);
    const handler = (e) => setSystemDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    getClinic(clinicSlug)
      .then((d) => {
        if (d.name)          setClinicName(d.name);
        if (d.theme)         setSavedTheme(d.theme);
        if (d.action_points) setActionPoints(d.action_points);
      })
      .catch(() => {});
  }, [clinicSlug]);

  const resolvedTheme = savedTheme === 'auto' ? (systemDark ? 'dark' : 'light') : savedTheme;
  const isLight = resolvedTheme === 'light';

  function validate() {
    const e = {};
    if (!form.firstName.trim()) e.firstName = 'Required';
    if (!form.lastName.trim())  e.lastName  = 'Required';
    if (!form.email.trim())     e.email     = 'Required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email';
    if (!form.phone.trim())     e.phone     = 'Required';
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
        firstName:    form.firstName.trim(),
        lastName:     form.lastName.trim(),
        email:        form.email.trim(),
        phone:        form.phone.trim(),
        dateOfBirth:  form.dateOfBirth || undefined,
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

  // ── Success ──────────────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <div style={s.page}>
        <style>{`
          @keyframes successIn { from{opacity:0;transform:scale(0.92) translateY(16px)} to{opacity:1;transform:scale(1) translateY(0)} }
          @keyframes checkPop  { 0%{transform:scale(0)} 70%{transform:scale(1.15)} 100%{transform:scale(1)} }
          .suc-card { animation: successIn 0.5s cubic-bezier(0.16,1,0.3,1) both; }
          .suc-check { animation: checkPop 0.45s cubic-bezier(0.34,1.56,0.64,1) 0.15s both; }
          .wallet-btn:hover { transform: translateY(-2px); box-shadow: 0 20px 48px rgba(59,191,185,0.35) !important; }
        `}</style>
        <div style={s.bgGlow} />
        <div className="suc-card" style={s.successCard}>
          <div className="suc-check" style={s.checkRing}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M4 12l6 6L20 6" stroke="#3bbfb9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 style={s.successH1}>You're in!</h1>
          <p style={s.successSub}>
            {clinicName ? `Welcome to ${clinicName}'s loyalty program.` : 'Your loyalty card is ready.'}
            {' '}Add it to your wallet to start earning points.
          </p>

          <div style={s.perksRow}>
            {[
              { icon: '★', text: 'Earn points every visit' },
              { icon: '↗', text: 'Refer friends for bonuses' },
              { icon: '🔔', text: 'Recall reminders in wallet' },
            ].map((p) => (
              <div key={p.text} style={s.perkChip}>
                <span style={{ fontSize: 14 }}>{p.icon}</span>
                <span>{p.text}</span>
              </div>
            ))}
          </div>

          {walletUrl && (
            <a href={walletUrl} className="wallet-btn" style={{ ...s.walletBtn, transition: 'transform 0.2s, box-shadow 0.2s' }}>
              Add to Wallet →
            </a>
          )}
          {ref && (
            <p style={s.referralNote}>
              Your friend earns {actionPoints?.referred_friend ?? '…'} bonus points for referring you!
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (step === 'error') {
    return (
      <div style={s.page}>
        <div style={s.bgGlow} />
        <div style={s.successCard}>
          <div style={{ ...s.checkRing, background: 'rgba(248,113,113,0.1)', border: '1.5px solid rgba(248,113,113,0.3)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="#f87171" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <h1 style={s.successH1}>Something went wrong</h1>
          <p style={{ ...s.successSub, color: '#f87171' }}>{errorMsg}</p>
          <button onClick={() => setStep('form')} style={s.walletBtn}>Try again →</button>
        </div>
      </div>
    );
  }

  // ── Form ─────────────────────────────────────────────────────────────────────
  return (
    <div style={{ ...s.page, background: isLight ? '#edf7f5' : '#f5f0ea' }}>
      <style>{`
        @keyframes panelIn { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes leftIn  { from{opacity:0;transform:translateX(-16px)} to{opacity:1;transform:translateX(0)} }
        .join-left  { animation: leftIn  0.6s cubic-bezier(0.16,1,0.3,1) both; }
        .join-right { animation: panelIn 0.6s cubic-bezier(0.16,1,0.3,1) 0.08s both; }
        .join-input { transition: border-color 0.15s, box-shadow 0.15s; }
        .join-input:focus { border-color: #3bbfb9 !important; box-shadow: 0 0 0 3px rgba(59,191,185,0.12) !important; outline: none; }
        .join-submit:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 16px 40px rgba(59,191,185,0.35) !important; }
        .join-submit { transition: transform 0.2s, box-shadow 0.2s, opacity 0.15s; }
      `}</style>

      <div style={{ ...s.bgGlow, background: isLight
        ? 'radial-gradient(ellipse 70% 50% at 20% 40%, rgba(59,191,185,0.12) 0%, transparent 55%)'
        : 'radial-gradient(ellipse 70% 50% at 20% 40%, rgba(59,191,185,0.1) 0%, transparent 55%)' }} />
      <div style={s.bgOrb} />

      <div style={{ ...s.shell, background: isLight ? '#f0f9f8' : '#fff' }}>

        {/* ── Left panel ── */}
        <div className="join-left" style={{
          ...s.left,
          background: isLight
            ? 'linear-gradient(160deg, #e2f5f3 0%, #d0eeeb 100%)'
            : 'linear-gradient(160deg, #0b1a19 0%, #122a28 100%)',
        }}>
          <div style={s.logoWrap}>
            <img src="/dentapass-logo.png" alt="DentaPass" style={{ height: 36, width: 'auto', filter: isLight ? 'none' : 'none' }} />
          </div>

          <div style={s.leftBody}>
            <h1 style={{ ...s.leftH1, color: isLight ? '#0b1a19' : '#fff' }}>
              {clinicName ? `${clinicName}'s` : "Your clinic's"}<br />
              loyalty program
            </h1>
            <p style={{ ...s.leftSub, color: isLight ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.4)' }}>
              Earn points, get recall reminders, and share your referral link — all from your Apple or Google Wallet. No app needed.
            </p>

            <div style={s.benefitList}>
              {[
                { icon: '★', label: 'Earn points',  desc: actionPoints ? `${actionPoints.completed_visit} pts per visit, ${actionPoints.left_review} pts per review` : 'Earn points for every visit and review' },
                { icon: '💳', label: 'Wallet card',  desc: 'Lives in Apple Wallet or Google Wallet' },
                { icon: '🔔', label: 'Reminders',    desc: 'Checkup alerts sent straight to your phone' },
                { icon: '↗', label: 'Refer friends', desc: `Share your code — your friend earns you ${actionPoints?.referred_friend ?? '…'} pts` },
              ].map((b) => (
                <div key={b.label} style={s.benefit}>
                  <div style={{ ...s.benefitIcon,
                    background: isLight ? 'rgba(59,191,185,0.15)' : 'rgba(59,191,185,0.1)',
                    border: `1px solid ${isLight ? 'rgba(59,191,185,0.3)' : 'rgba(59,191,185,0.15)'}`,
                  }}>{b.icon}</div>
                  <div>
                    <div style={{ ...s.benefitLabel, color: isLight ? '#0b1a19' : 'rgba(255,255,255,0.85)' }}>{b.label}</div>
                    <div style={{ ...s.benefitDesc,  color: isLight ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.3)' }}>{b.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right panel (form) ── */}
        <div className="join-right" style={s.right}>
          <h2 style={s.formH2}>Join the program</h2>
          {clinicName && <p style={s.formClinic}>{clinicName}</p>}

          {ref && (
            <div style={s.refBanner}>
              <span style={{ fontSize: 15 }}>🎁</span>
              <span>You were referred — you'll both earn bonus points.</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={s.form}>
            <div style={s.row}>
              <div style={s.field}>
                <label style={s.label}>First name <span style={{ color: '#3bbfb9' }}>*</span></label>
                <input
                  className="join-input"
                  style={{ ...s.input, ...(errors.firstName ? s.inputErr : {}) }}
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  placeholder="Jane"
                  autoComplete="given-name"
                />
                {errors.firstName && <span style={s.errText}>{errors.firstName}</span>}
              </div>
              <div style={s.field}>
                <label style={s.label}>Last name <span style={{ color: '#3bbfb9' }}>*</span></label>
                <input
                  className="join-input"
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
              <label style={s.label}>Email <span style={{ color: '#3bbfb9' }}>*</span></label>
              <input
                type="email"
                className="join-input"
                style={{ ...s.input, ...(errors.email ? s.inputErr : {}) }}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="jane@example.com"
                autoComplete="email"
              />
              {errors.email && <span style={s.errText}>{errors.email}</span>}
            </div>

            <div style={s.field}>
              <label style={s.label}>Phone <span style={{ color: '#3bbfb9' }}>*</span></label>
              <input
                type="tel"
                className="join-input"
                style={{ ...s.input, ...(errors.phone ? s.inputErr : {}) }}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+1 780 555 0100"
                autoComplete="tel"
              />
              {errors.phone && <span style={s.errText}>{errors.phone}</span>}
            </div>

            <div style={s.field}>
              <label style={s.label}>Date of birth <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional — unlocks birthday bonus points)</span></label>
              <input
                type="date"
                style={{ ...s.input, colorScheme: isLight ? 'light' : 'dark' }}
                value={form.dateOfBirth}
                onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                max={new Date().toISOString().split('T')[0]}
                autoComplete="bday"
              />
            </div>

            <button type="submit" disabled={submitting} className="join-submit" style={{ ...s.submitBtn, opacity: submitting ? 0.7 : 1 }}>
              {submitting ? 'Setting up your card…' : 'Get my wallet card →'}
            </button>
          </form>

          <p style={s.fine}>
            By joining, you agree to receive push notifications from your dental clinic. No app required.
          </p>
        </div>
      </div>
    </div>
  );
}

const s = {
  page: {
    minHeight: '100vh',
    background: '#f5f0ea',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
    fontFamily: "'DM Sans', sans-serif",
    position: 'relative',
    overflow: 'hidden',
  },
  bgGlow: {
    position: 'fixed',
    inset: 0,
    background: 'radial-gradient(ellipse 70% 50% at 20% 40%, rgba(59,191,185,0.1) 0%, transparent 55%)',
    pointerEvents: 'none',
  },
  bgOrb: {
    position: 'fixed',
    bottom: '-20%', right: '-10%',
    width: 600, height: 600,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(59,191,185,0.07) 0%, transparent 65%)',
    pointerEvents: 'none',
  },
  // ── Shell ──
  shell: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    maxWidth: 900,
    width: '100%',
    background: '#fff',
    borderRadius: 28,
    overflow: 'hidden',
    boxShadow: '0 4px 6px rgba(0,0,0,0.02), 0 32px 80px rgba(0,0,0,0.1)',
    position: 'relative',
    zIndex: 1,
  },
  // ── Left ──
  left: {
    background: 'linear-gradient(160deg, #0b1a19 0%, #122a28 100%)',
    padding: '36px 36px 40px',
    display: 'flex',
    flexDirection: 'column',
    gap: 32,
    position: 'relative',
    overflow: 'hidden',
  },
  logoWrap: {
    display: 'flex', alignItems: 'center',
  },
  leftBody: { display: 'flex', flexDirection: 'column', gap: 20 },
  leftH1: {
    fontFamily: "'Instrument Serif', serif",
    fontSize: 28, fontWeight: 400,
    color: '#fff', margin: 0,
    letterSpacing: '-0.02em',
    lineHeight: 1.2,
  },
  leftSub: {
    fontSize: 14, color: 'rgba(255,255,255,0.4)',
    lineHeight: 1.65, margin: 0,
  },
  benefitList: { display: 'flex', flexDirection: 'column', gap: 14, marginTop: 4 },
  benefit: { display: 'flex', alignItems: 'flex-start', gap: 12 },
  benefitIcon: {
    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
    background: 'rgba(59,191,185,0.1)',
    border: '1px solid rgba(59,191,185,0.15)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 16,
  },
  benefitLabel: { fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.85)', marginBottom: 2 },
  benefitDesc:  { fontSize: 12, color: 'rgba(255,255,255,0.3)', lineHeight: 1.4 },
  // ── Right ──
  right: {
    padding: '36px 36px 40px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  formH2: {
    fontFamily: "'Instrument Serif', serif",
    fontSize: 26, fontWeight: 400,
    color: '#0b1a19', margin: '0 0 4px',
    letterSpacing: '-0.02em',
  },
  formClinic: { fontSize: 13, color: '#3bbfb9', fontWeight: 700, margin: '0 0 16px' },
  refBanner: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: 'rgba(59,191,185,0.07)',
    border: '1px solid rgba(59,191,185,0.2)',
    borderRadius: 10, padding: '10px 14px',
    fontSize: 13, color: '#0d7b77', marginBottom: 16,
  },
  form: { display: 'flex', flexDirection: 'column', gap: 14, marginTop: 8 },
  row:   { display: 'flex', gap: 10 },
  field: { flex: 1, display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontSize: 12, fontWeight: 600, color: '#374151', letterSpacing: '0.02em' },
  input: {
    padding: '11px 13px',
    border: '1.5px solid #e5e2db',
    borderRadius: 10, fontSize: 14,
    color: '#0b1a19', background: '#fafaf9',
    fontFamily: "'DM Sans', sans-serif",
    boxSizing: 'border-box', width: '100%',
  },
  inputErr: { borderColor: '#f87171' },
  errText:  { fontSize: 11, color: '#f87171' },
  hint:     { fontSize: 11, color: '#9ca3af' },
  submitBtn: {
    background: '#3bbfb9', color: '#081312',
    border: 'none', borderRadius: 12,
    padding: '13px', fontSize: 15, fontWeight: 700,
    cursor: 'pointer', marginTop: 4,
    letterSpacing: '-0.01em',
    boxShadow: '0 4px 16px rgba(59,191,185,0.25)',
    fontFamily: "'DM Sans', sans-serif",
  },
  fine: { fontSize: 11, color: '#9ca3af', marginTop: 14, lineHeight: 1.6 },
  // ── Success / error ──
  successCard: {
    background: '#fff', borderRadius: 24, padding: '48px 40px',
    maxWidth: 460, width: '100%',
    boxShadow: '0 4px 6px rgba(0,0,0,0.02), 0 32px 80px rgba(0,0,0,0.1)',
    textAlign: 'center', position: 'relative', zIndex: 1,
    border: '1px solid rgba(59,191,185,0.1)',
  },
  checkRing: {
    width: 68, height: 68, borderRadius: '50%',
    background: 'rgba(59,191,185,0.08)',
    border: '1.5px solid rgba(59,191,185,0.25)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 20px',
  },
  successH1: {
    fontFamily: "'Instrument Serif', serif",
    fontSize: 30, fontWeight: 400,
    color: '#0b1a19', margin: '0 0 10px',
  },
  successSub: { fontSize: 15, color: '#6b7280', lineHeight: 1.65, margin: '0 0 20px' },
  perksRow: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 24 },
  perkChip: {
    display: 'flex', alignItems: 'center', gap: 6,
    background: 'rgba(59,191,185,0.07)',
    border: '1px solid rgba(59,191,185,0.15)',
    borderRadius: 20, padding: '5px 12px',
    fontSize: 12, fontWeight: 600, color: '#0d7b77',
  },
  walletBtn: {
    display: 'block',
    background: '#3bbfb9', color: '#081312',
    borderRadius: 12, padding: '13px',
    fontSize: 15, fontWeight: 700,
    textDecoration: 'none',
    letterSpacing: '-0.01em',
    boxShadow: '0 4px 16px rgba(59,191,185,0.25)',
    border: 'none', cursor: 'pointer', width: '100%',
    fontFamily: "'DM Sans', sans-serif",
  },
  referralNote: {
    fontSize: 13, color: '#0d7b77',
    marginTop: 14,
    background: 'rgba(59,191,185,0.07)',
    borderRadius: 8, padding: '8px 12px',
  },
};
