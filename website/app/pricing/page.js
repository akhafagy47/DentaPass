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
  const [emailModal, setEmailModal] = useState(null);
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
    <>
      <style>{`
        @keyframes dp-price-in {
          from { opacity:0; transform:translateY(24px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .dp-price-card {
          animation: dp-price-in 0.6s cubic-bezier(0.16,1,0.3,1) both;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .dp-price-card:hover { transform: translateY(-4px); box-shadow: 0 24px 64px rgba(0,0,0,0.1) !important; }
        .dp-price-card:nth-child(1) { animation-delay: 0s; }
        .dp-price-card:nth-child(2) { animation-delay: 0.07s; }
        .dp-price-card:nth-child(3) { animation-delay: 0.14s; }
        .dp-price-btn { transition: transform 0.15s, box-shadow 0.15s; }
        .dp-price-btn:hover { transform: translateY(-1px); }
        .dp-modal-in { animation: dp-price-in 0.4s cubic-bezier(0.16,1,0.3,1) both; }
        .dp-price-input:focus { border-color: #3bbfb9 !important; box-shadow: 0 0 0 3px rgba(59,191,185,0.1) !important; outline:none; }
      `}</style>

      <div style={s.page}>
        <div style={s.bgTop} />

        <a href="/" style={s.back}>← Back to home</a>

        <div style={s.header}>
          <div style={s.eyebrow}>Pricing</div>
          <h1 style={s.h1}>Simple, transparent pricing</h1>
          <p style={s.sub}>One-time setup fee, then monthly. Cancel anytime.</p>
        </div>

        <div style={s.grid}>
          {PLANS.map((plan, i) => (
            <div
              key={plan.id}
              className="dp-price-card"
              style={{
                ...s.card,
                ...(plan.highlight ? s.cardHighlight : {}),
                animationDelay: `${i * 0.07}s`,
              }}
            >
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
                    <span style={s.check}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M2 7l4 4 6-6" stroke="#3bbfb9" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleGetStarted(plan.id)}
                disabled={loading === plan.id}
                className="dp-price-btn"
                style={{ ...s.btn, ...(plan.highlight ? s.btnPrimary : s.btnSecondary) }}
              >
                {loading === plan.id ? 'Redirecting…' : 'Get started →'}
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

        {emailModal && (
          <div style={s.overlay} onClick={() => { setEmailModal(null); setEmail(''); setEmailError(''); }}>
            <div className="dp-modal-in" style={s.modal} onClick={(e) => e.stopPropagation()}>
              <h2 style={s.modalTitle}>
                Get started with {PLANS.find(p => p.id === emailModal)?.name}
              </h2>
              <p style={s.modalSub}>Enter your email to proceed to payment.</p>
              <form onSubmit={handleCheckout} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setEmailError(''); }}
                  className="dp-price-input"
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
    </>
  );
}

const s = {
  page: {
    minHeight: '100vh',
    background: '#f5f0ea',
    padding: '40px 24px 80px',
    fontFamily: "'DM Sans', sans-serif",
    maxWidth: 1100,
    margin: '0 auto',
    position: 'relative',
  },
  bgTop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    height: 400,
    background: 'radial-gradient(ellipse 80% 100% at 50% -20%, rgba(59,191,185,0.1) 0%, transparent 70%)',
    pointerEvents: 'none',
    zIndex: 0,
  },
  back: {
    fontSize: 14,
    color: '#6b7280',
    textDecoration: 'none',
    display: 'inline-block',
    marginBottom: 40,
    position: 'relative',
    zIndex: 1,
  },
  header: { textAlign: 'center', marginBottom: 60, position: 'relative', zIndex: 1 },
  eyebrow: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#3bbfb9',
    marginBottom: 14,
  },
  h1: {
    fontFamily: "'Instrument Serif', serif",
    fontSize: 'clamp(36px,5vw,56px)',
    fontWeight: 400,
    color: '#0b1a19',
    margin: '0 0 16px',
    letterSpacing: '-0.03em',
    lineHeight: 1.08,
  },
  sub: { fontSize: 17, color: '#6b7280', maxWidth: 480, margin: '0 auto', lineHeight: 1.65 },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: 20,
    marginBottom: 48,
    position: 'relative',
    zIndex: 1,
  },
  card: {
    background: '#fff',
    borderRadius: 24,
    padding: '36px 32px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.06)',
    border: '1px solid rgba(229,226,219,0.8)',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    cursor: 'default',
  },
  cardHighlight: {
    border: '2px solid #3bbfb9',
    boxShadow: '0 4px 16px rgba(59,191,185,0.1), 0 16px 48px rgba(59,191,185,0.12)',
  },
  popularBadge: {
    position: 'absolute',
    top: -13,
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#3bbfb9',
    color: '#081312',
    fontSize: 11,
    fontWeight: 700,
    padding: '4px 16px',
    borderRadius: 980,
    whiteSpace: 'nowrap',
    letterSpacing: '0.03em',
  },
  planName: {
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#9ca3af',
    marginBottom: 16,
  },
  priceRow: { display: 'flex', alignItems: 'baseline', marginBottom: 4 },
  price: {
    fontFamily: "'Instrument Serif', serif",
    fontSize: 52,
    fontWeight: 400,
    color: '#0b1a19',
    letterSpacing: '-0.04em',
    lineHeight: 1,
  },
  priceSub: { fontSize: 16, color: '#9ca3af', marginLeft: 6 },
  setupFee: { fontSize: 13, color: '#9ca3af', margin: '0 0 6px' },
  capacity: { fontSize: 14, fontWeight: 600, color: '#374151', margin: '0 0 24px' },
  features: {
    listStyle: 'none',
    padding: 0,
    margin: '0 0 28px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    flex: 1,
  },
  featureItem: {
    fontSize: 14,
    color: '#374151',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    lineHeight: 1.5,
  },
  check: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 22,
    height: 22,
    borderRadius: '50%',
    background: 'rgba(59,191,185,0.1)',
    flexShrink: 0,
  },
  btn: {
    border: 'none',
    borderRadius: 12,
    padding: '14px',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    width: '100%',
    marginTop: 'auto',
    letterSpacing: '-0.01em',
    fontFamily: "'DM Sans', sans-serif",
  },
  btnPrimary: {
    background: '#3bbfb9',
    color: '#081312',
    boxShadow: '0 4px 16px rgba(59,191,185,0.25)',
  },
  btnSecondary: {
    background: 'rgba(59,191,185,0.08)',
    color: '#2aa8a2',
    border: '1px solid rgba(59,191,185,0.2)',
  },
  addons: {
    background: '#fff',
    borderRadius: 24,
    padding: '36px',
    marginBottom: 24,
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    border: '1px solid rgba(229,226,219,0.8)',
    position: 'relative',
    zIndex: 1,
  },
  addonsTitle: {
    fontFamily: "'Instrument Serif', serif",
    fontSize: 22,
    fontWeight: 400,
    color: '#0b1a19',
    margin: '0 0 20px',
    letterSpacing: '-0.02em',
  },
  addonRow: { display: 'flex', gap: 14, flexWrap: 'wrap' },
  addonCard: {
    flex: 1,
    minWidth: 160,
    background: '#f5f0ea',
    border: '1px solid rgba(229,226,219,0.8)',
    borderRadius: 14,
    padding: '16px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addonLabel: { fontSize: 14, fontWeight: 600, color: '#374151' },
  addonPrice: { fontSize: 14, fontWeight: 700, color: '#3bbfb9' },
  founding: {
    background: '#0b1a19',
    borderRadius: 24,
    padding: '36px 40px',
    position: 'relative',
    zIndex: 1,
    overflow: 'hidden',
  },
  foundingInner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 24,
    flexWrap: 'wrap',
  },
  foundingTitle: {
    fontFamily: "'Instrument Serif', serif",
    fontSize: 22,
    fontWeight: 400,
    color: '#fff',
    margin: '0 0 10px',
    letterSpacing: '-0.02em',
  },
  foundingSub: { fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, maxWidth: 520 },
  foundingBtn: {
    background: '#3bbfb9',
    color: '#081312',
    borderRadius: 12,
    padding: '14px 24px',
    fontSize: 14,
    fontWeight: 700,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    letterSpacing: '-0.01em',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(11,26,25,0.7)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 16,
  },
  modal: {
    background: '#fff',
    borderRadius: 24,
    padding: '40px 36px',
    width: '100%',
    maxWidth: 420,
    boxShadow: '0 24px 80px rgba(0,0,0,0.25)',
  },
  modalTitle: {
    fontFamily: "'Instrument Serif', serif",
    fontSize: 24,
    fontWeight: 400,
    color: '#0b1a19',
    margin: '0 0 8px',
    letterSpacing: '-0.02em',
  },
  modalSub: { fontSize: 15, color: '#6b7280', margin: '0 0 24px' },
  input: {
    padding: '13px 16px',
    border: '1.5px solid #e5e2db',
    borderRadius: 12,
    fontSize: 15,
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: "'DM Sans', sans-serif",
    color: '#0b1a19',
    background: '#fafaf9',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  errText: { fontSize: 13, color: '#ef4444', margin: 0 },
  cancelBtn: {
    background: 'none',
    border: 'none',
    color: '#9ca3af',
    fontSize: 14,
    cursor: 'pointer',
    padding: '8px',
    fontFamily: "'DM Sans', sans-serif",
  },
};
