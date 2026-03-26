'use client';

import { useState } from 'react';
import { createCheckout } from '../../lib/api';

const PLANS = [
  {
    id: 'solo',
    name: 'Solo',
    price: 199,
    setup: 249,
    patients: 500,
    highlight: false,
    features: [
      'Up to 500 patients',
      'Apple & Google Wallet cards',
      'Automated recall reminders',
      'Automated review requests',
      'Referral program',
      'QR scanner for staff',
      'Clinic dashboard',
      '1 location',
    ],
  },
  {
    id: 'clinic',
    name: 'Clinic',
    price: 349,
    setup: 249,
    patients: 2000,
    highlight: true,
    features: [
      'Up to 2,000 patients',
      'Apple & Google Wallet cards',
      'Automated recall reminders',
      'Automated review requests',
      'Referral program',
      'QR scanner for staff',
      'Clinic dashboard',
      '1 location',
    ],
  },
  {
    id: 'group',
    name: 'Group',
    price: 599,
    setup: 399,
    patients: null,
    highlight: false,
    features: [
      'Unlimited patients',
      'Apple & Google Wallet cards',
      'Automated recall reminders',
      'Automated review requests',
      'Referral program',
      'QR scanner for staff',
      'Clinic dashboard',
      'Multi-location support',
    ],
  },
];

export default function PricingPage() {
  const [loading, setLoading] = useState(null);
  const [emailModal, setEmailModal] = useState(null); // plan id
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');

  async function handleGetStarted(planId) {
    setEmailModal(planId);
  }

  async function handleCheckout(e) {
    e.preventDefault();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Please enter a valid email address.');
      return;
    }

    setLoading(emailModal);
    setEmailError('');

    try {
      const { url } = await createCheckout(emailModal, email);
      window.location.href = url;
    } catch (err) {
      setEmailError(err.data?.error || 'Failed to start checkout.');
      setLoading(null);
    }
  }

  return (
    <div style={s.page}>
      <a href="/" style={s.back}>← Back</a>

      <div style={s.header}>
        <div style={s.eyebrow}>Pricing</div>
        <h1 style={s.h1}>Simple, transparent pricing</h1>
        <p style={s.sub}>
          One-time setup fee, then monthly. Cancel anytime.
          All plans include one location.
        </p>
      </div>

      <div style={s.grid}>
        {PLANS.map((plan) => (
          <div key={plan.id} style={{ ...s.card, ...(plan.highlight ? s.cardHighlight : {}) }}>
            {plan.highlight && <div style={s.popularBadge}>Most popular</div>}
            <div style={s.planName}>{plan.name}</div>
            <div style={s.priceRow}>
              <span style={s.price}>${plan.price}</span>
              <span style={s.priceSub}> CAD/mo</span>
            </div>
            <p style={s.setupFee}>+ ${plan.setup} CAD one-time setup</p>
            <p style={s.capacity}>
              {plan.patients ? `Up to ${plan.patients.toLocaleString()} patients` : 'Unlimited patients'}
            </p>

            <ul style={s.features}>
              {plan.features.map((f) => (
                <li key={f} style={s.featureItem}>
                  <span style={s.check}>✓</span> {f}
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleGetStarted(plan.id)}
              disabled={loading === plan.id}
              style={{ ...s.btn, ...(plan.highlight ? s.btnPrimary : s.btnSecondary) }}
            >
              {loading === plan.id ? 'Redirecting…' : 'Get started'}
            </button>
          </div>
        ))}
      </div>

      <div style={s.addons}>
        <h2 style={s.addonsTitle}>Need more capacity?</h2>
        <div style={s.addonRow}>
          {[
            { label: '+250 patients', price: 29 },
            { label: '+500 patients', price: 55 },
            { label: '+1,000 patients', price: 99 },
          ].map((a) => (
            <div key={a.label} style={s.addonCard}>
              <span style={s.addonLabel}>{a.label}</span>
              <span style={s.addonPrice}>${a.price} CAD/mo</span>
            </div>
          ))}
        </div>
      </div>

      <div style={s.founding}>
        <div style={s.foundingInner}>
          <div>
            <h3 style={s.foundingTitle}>Founding clinic offer</h3>
            <p style={s.foundingSub}>
              First 5 clinics get Solo plan at <strong>$149 CAD/month locked for life</strong> — no setup fee.
              In exchange: beta feedback and a testimonial after 60 days.
            </p>
          </div>
          <a href="/#waitlist" style={s.foundingBtn}>Apply for founding pricing →</a>
        </div>
      </div>

      {/* Email modal */}
      {emailModal && (
        <div style={s.overlay} onClick={() => { setEmailModal(null); setEmail(''); setEmailError(''); }}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={s.modalTitle}>
              Get started with {PLANS.find(p => p.id === emailModal)?.name}
            </h2>
            <p style={s.modalSub}>Enter your email to proceed to payment.</p>
            <form onSubmit={handleCheckout} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setEmailError(''); }}
                style={s.input}
                placeholder="owner@yourclinic.com"
                autoFocus
                required
              />
              {emailError && <p style={s.errText}>{emailError}</p>}
              <button type="submit" disabled={!!loading} style={s.btnPrimary}>
                {loading ? 'Redirecting…' : 'Continue to payment →'}
              </button>
              <button type="button" onClick={() => { setEmailModal(null); setEmail(''); setEmailError(''); }} style={s.cancelBtn}>
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  page: {
    minHeight: '100vh',
    background: '#f8fafc',
    padding: '40px 24px 80px',
    fontFamily: "'DM Sans', sans-serif",
    maxWidth: 1100,
    margin: '0 auto',
  },
  back: { fontSize: 14, color: '#64748b', textDecoration: 'none', display: 'inline-block', marginBottom: 32 },
  header: { textAlign: 'center', marginBottom: 56 },
  eyebrow: { fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#006FEE', marginBottom: 12 },
  h1: { fontSize: 40, fontWeight: 800, color: '#0d0f14', margin: '0 0 16px', letterSpacing: '-0.02em' },
  sub: { fontSize: 17, color: '#64748b', maxWidth: 520, margin: '0 auto', lineHeight: 1.6 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, marginBottom: 56 },
  card: {
    background: '#fff',
    borderRadius: 20,
    padding: '32px 28px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    border: '1.5px solid #e2e8f0',
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    position: 'relative',
  },
  cardHighlight: {
    border: '2px solid #006FEE',
    boxShadow: '0 8px 32px rgba(0,111,238,0.12)',
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#006FEE',
    color: '#fff',
    fontSize: 12,
    fontWeight: 700,
    padding: '4px 14px',
    borderRadius: 20,
    whiteSpace: 'nowrap',
  },
  planName: { fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', marginBottom: 16 },
  priceRow: { display: 'flex', alignItems: 'baseline', marginBottom: 4 },
  price: { fontSize: 44, fontWeight: 800, color: '#0d0f14', letterSpacing: '-0.03em' },
  priceSub: { fontSize: 16, color: '#94a3b8', marginLeft: 4 },
  setupFee: { fontSize: 13, color: '#94a3b8', margin: '0 0 4px' },
  capacity: { fontSize: 14, fontWeight: 600, color: '#374151', margin: '0 0 24px' },
  features: { listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 },
  featureItem: { fontSize: 14, color: '#374151', display: 'flex', alignItems: 'center', gap: 8 },
  check: { color: '#16a34a', fontWeight: 700, fontSize: 14, flexShrink: 0 },
  btn: { border: 'none', borderRadius: 12, padding: '14px', fontSize: 15, fontWeight: 600, cursor: 'pointer', width: '100%', marginTop: 'auto' },
  btnPrimary: { background: '#006FEE', color: '#fff' },
  btnSecondary: { background: '#f0f7ff', color: '#006FEE' },
  addons: { background: '#fff', borderRadius: 20, padding: '32px', marginBottom: 32, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  addonsTitle: { fontSize: 18, fontWeight: 700, color: '#111', margin: '0 0 20px' },
  addonRow: { display: 'flex', gap: 16, flexWrap: 'wrap' },
  addonCard: {
    flex: 1, minWidth: 160, background: '#f8fafc', border: '1.5px solid #e2e8f0',
    borderRadius: 12, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  addonLabel: { fontSize: 14, fontWeight: 600, color: '#374151' },
  addonPrice: { fontSize: 14, fontWeight: 700, color: '#006FEE' },
  founding: { background: '#0d0f14', borderRadius: 20, padding: '32px' },
  foundingInner: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' },
  foundingTitle: { fontSize: 18, fontWeight: 700, color: '#fff', margin: '0 0 8px' },
  foundingSub: { fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, maxWidth: 520 },
  foundingBtn: {
    background: '#0ea5a0', color: '#fff', borderRadius: 12,
    padding: '14px 24px', fontSize: 14, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap',
  },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16,
  },
  modal: {
    background: '#fff', borderRadius: 20, padding: '36px 32px',
    width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  },
  modalTitle: { fontSize: 22, fontWeight: 700, color: '#111', margin: '0 0 8px' },
  modalSub: { fontSize: 15, color: '#64748b', margin: '0 0 24px' },
  input: {
    padding: '12px 14px', border: '1.5px solid #e2e8f0',
    borderRadius: 10, fontSize: 15, outline: 'none', width: '100%', boxSizing: 'border-box',
  },
  errText: { fontSize: 13, color: '#dc2626', margin: 0 },
  cancelBtn: {
    background: 'none', border: 'none', color: '#94a3b8',
    fontSize: 14, cursor: 'pointer', padding: '8px',
  },
};
