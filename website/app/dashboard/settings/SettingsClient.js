'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateClinic, getBillingPortalUrl } from '../../../lib/api';
import { getSupabaseBrowser } from '../../../lib/supabase-browser';

// ─── Wallet Card Preview ─────────────────────────────────────────────────────

function darken(hex, amt = 30) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (n >> 16) - amt);
  const g = Math.max(0, ((n >> 8) & 0xff) - amt);
  const b = Math.max(0, (n & 0xff) - amt);
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

function textColor(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 0xff) + 0.114 * (n & 0xff)) / 255;
  return lum > 0.55 ? '#111' : '#fff';
}

function WalletCardPreview({ clinicName, brandColor, pointsLabel, rewardsMode, pointsPerDollar, logoUrl }) {
  const color  = brandColor || '#006FEE';
  const fg     = textColor(color);
  const dark   = darken(color, 25);
  const fgMute = fg === '#fff' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.45)';
  const label  = pointsLabel || 'Points';

  return (
    <div style={{
      width: 320, borderRadius: 20, overflow: 'hidden',
      boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
      fontFamily: "'DM Sans', -apple-system, sans-serif",
      userSelect: 'none',
    }}>
      {/* Card header strip */}
      <div style={{
        background: `linear-gradient(135deg, ${color} 0%, ${dark} 100%)`,
        padding: '20px 22px 18px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
          <div>
            {logoUrl
              ? <img src={logoUrl} alt="logo" style={{ height: 32, objectFit: 'contain' }} />
              : <div style={{ fontSize: 13, fontWeight: 700, color: fg, opacity: 0.9, letterSpacing: '0.04em' }}>
                  {clinicName || 'Your Clinic'}
                </div>
            }
          </div>
          <div style={{ fontSize: 10, fontWeight: 600, color: fgMute, letterSpacing: '0.08em' }}>
            DENTAPASS
          </div>
        </div>

        {/* Points / value display */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: fgMute, letterSpacing: '0.06em', marginBottom: 2 }}>
            {label.toUpperCase()}
          </div>
          <div style={{ fontSize: 42, fontWeight: 800, color: fg, lineHeight: 1, letterSpacing: '-0.03em' }}>
            500
          </div>
          {rewardsMode === 'discounts' && pointsPerDollar && (
            <div style={{ fontSize: 12, color: fgMute, marginTop: 4 }}>
              ≈ ${(500 / pointsPerDollar).toFixed(2)} discount value
            </div>
          )}
        </div>
      </div>

      {/* Card body */}
      <div style={{ background: '#fff', padding: '14px 22px 18px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 0', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, letterSpacing: '0.05em' }}>MEMBER</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111', marginTop: 2 }}>Jane Smith</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, letterSpacing: '0.05em' }}>
              {rewardsMode === 'discounts' ? 'REDEMPTION' : 'TIER'}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: color, marginTop: 2 }}>
              {rewardsMode === 'discounts'
                ? `${pointsPerDollar || 5} pts = $1`
                : '🥇 Gold'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, letterSpacing: '0.05em' }}>NEXT CHECKUP</div>
            <div style={{ fontSize: 13, color: '#374151', marginTop: 2 }}>Jun 2026</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, letterSpacing: '0.05em' }}>MEMBER SINCE</div>
            <div style={{ fontSize: 13, color: '#374151', marginTop: 2 }}>Mar 2026</div>
          </div>
        </div>

        {/* Barcode placeholder */}
        <div style={{
          height: 52, background: '#f8fafc', borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="200" height="28" viewBox="0 0 200 28">
            {Array.from({ length: 40 }, (_, i) => (
              <rect key={i} x={i * 5} y={0} width={Math.random() > 0.4 ? 2 : 1} height={28} fill="#374151" opacity={0.7} />
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
}

// ─── Main Settings Client ────────────────────────────────────────────────────

export default function SettingsClient({ clinic }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name:              clinic.name || '',
    google_review_url: clinic.google_review_url || '',
    booking_url:       clinic.booking_url || '',
    brand_color:       clinic.brand_color || '#006FEE',
    logo_url:          clinic.logo_url || '',
    points_label:      clinic.points_label || 'Points',
    rewards_mode:      clinic.rewards_mode || 'tiers',
    points_per_dollar: clinic.points_per_dollar || '',
  });
  const [saving, setSaving]     = useState(false);
  const [feedback, setFeedback] = useState('');

  function set(key, val) { setForm((f) => ({ ...f, [key]: val })); }

  async function getToken() {
    const { data: { session } } = await getSupabaseBrowser().auth.getSession();
    return session?.access_token;
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const token = await getToken();
      const payload = { ...form };
      if (payload.points_per_dollar === '') payload.points_per_dollar = null;
      else payload.points_per_dollar = parseFloat(payload.points_per_dollar);
      await updateClinic(clinic.slug, payload, token);
      setFeedback('Settings saved!');
      setTimeout(() => setFeedback(''), 3000);
      router.refresh();
    } catch {
      setFeedback('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleBillingPortal() {
    try {
      const token = await getToken();
      const { url } = await getBillingPortalUrl(token);
      window.location.href = url;
    } catch {}
  }

  const appUrl       = process.env.NEXT_PUBLIC_APP_URL || 'https://denta-pass.vercel.app';
  const enrollLink   = `${appUrl}/join/${clinic.slug}`;
  const scanLink     = `${appUrl}/scan/${clinic.slug}`;

  return (
    <>
      <style>{`
        .st-toggle { transition: background 0.2s; }
        .st-input:focus { border-color: #006FEE !important; box-shadow: 0 0 0 3px rgba(0,111,238,0.08); }
      `}</style>
      <div style={s.page}>
        <h1 style={s.h1}>Settings</h1>

        <form onSubmit={handleSave} style={s.form}>

          {/* ── Clinic details ── */}
          <Section title="Clinic details">
            <Field label="Clinic name">
              <input className="st-input" value={form.name} onChange={(e) => set('name', e.target.value)} style={s.input} required />
            </Field>
            <Field label="Google review URL">
              <input className="st-input" type="url" value={form.google_review_url} onChange={(e) => set('google_review_url', e.target.value)} style={s.input} placeholder="https://g.page/r/…/review" />
            </Field>
            <Field label="Booking URL">
              <input className="st-input" type="url" value={form.booking_url} onChange={(e) => set('booking_url', e.target.value)} style={s.input} placeholder="https://yourclinic.com/book" />
            </Field>
          </Section>

          {/* ── Wallet card customisation ── */}
          <Section title="Wallet card" subtitle="Customize what your patients see in Apple & Google Wallet">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
              {/* Left: controls */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Field label="Brand color">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="color"
                      value={form.brand_color}
                      onChange={(e) => set('brand_color', e.target.value)}
                      style={{ width: 44, height: 38, border: 'none', cursor: 'pointer', borderRadius: 8, padding: 2 }}
                    />
                    <input className="st-input" value={form.brand_color} onChange={(e) => set('brand_color', e.target.value)} style={{ ...s.input, maxWidth: 110 }} placeholder="#006FEE" />
                  </div>
                </Field>
                <Field label="Logo URL" hint="Paste a direct image link — PNG or SVG recommended">
                  <input className="st-input" type="url" value={form.logo_url} onChange={(e) => set('logo_url', e.target.value)} style={s.input} placeholder="https://…/logo.png" />
                </Field>
                <Field label="Points label" hint="What to call your points (e.g. SmilePoints, DentaPoints)">
                  <input className="st-input" value={form.points_label} onChange={(e) => set('points_label', e.target.value)} style={s.input} placeholder="Points" maxLength={20} />
                </Field>
              </div>

              {/* Right: live preview */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.05em' }}>LIVE PREVIEW</div>
                <WalletCardPreview
                  clinicName={form.name}
                  brandColor={form.brand_color}
                  pointsLabel={form.points_label}
                  rewardsMode={form.rewards_mode}
                  pointsPerDollar={parseFloat(form.points_per_dollar) || null}
                  logoUrl={form.logo_url}
                />
              </div>
            </div>
          </Section>

          {/* ── Rewards mode ── */}
          <Section title="Rewards program" subtitle="Choose how patients benefit from their points">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                {
                  value: 'tiers',
                  label: 'Tier system',
                  desc: 'Patients unlock Bronze → Silver → Gold status as they accumulate points.',
                },
                {
                  value: 'discounts',
                  label: 'Discount redemption',
                  desc: 'Patients redeem points for dollar discounts at the front desk.',
                },
              ].map((opt) => {
                const active = form.rewards_mode === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => set('rewards_mode', opt.value)}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 14,
                      padding: '14px 16px', borderRadius: 12, textAlign: 'left',
                      border: active ? '2px solid #006FEE' : '1.5px solid #e2e8f0',
                      background: active ? '#eff6ff' : '#fff',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                      border: active ? '5px solid #006FEE' : '2px solid #cbd5e1',
                      background: '#fff',
                    }} />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: active ? '#006FEE' : '#111' }}>{opt.label}</div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{opt.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {form.rewards_mode === 'discounts' && (
              <div style={{ marginTop: 4 }}>
                <Field label="Conversion rate" hint="How many points equal $1 in discount">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      className="st-input"
                      type="number"
                      min="1"
                      step="1"
                      value={form.points_per_dollar}
                      onChange={(e) => set('points_per_dollar', e.target.value)}
                      style={{ ...s.input, maxWidth: 100 }}
                      placeholder="5"
                    />
                    <span style={{ fontSize: 14, color: '#64748b' }}>
                      points = $1.00
                      {form.points_per_dollar && ` · 100 pts = $${(100 / parseFloat(form.points_per_dollar)).toFixed(2)}`}
                    </span>
                  </div>
                </Field>
              </div>
            )}
          </Section>

          {feedback && (
            <div style={{
              background: feedback.includes('saved') ? '#dcfce7' : '#fee2e2',
              color: feedback.includes('saved') ? '#16a34a' : '#dc2626',
              borderRadius: 10, padding: '10px 16px', fontSize: 14, fontWeight: 600,
            }}>
              {feedback}
            </div>
          )}

          <button type="submit" disabled={saving} style={s.saveBtn}>
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </form>

        {/* ── Links ── */}
        <Section title="Your links">
          {[
            { label: 'Enrollment QR page', url: enrollLink },
            { label: 'QR Scanner (staff)',  url: scanLink  },
          ].map((l) => (
            <div key={l.label} style={s.linkRow}>
              <span style={s.linkLabel}>{l.label}</span>
              <a href={l.url} target="_blank" rel="noopener noreferrer" style={s.link}>{l.url}</a>
            </div>
          ))}
        </Section>

        {/* ── Billing ── */}
        <Section title="Plan & billing">
          <div style={s.planCard}>
            <div>
              <div style={s.planName}>{clinic.plan.charAt(0).toUpperCase() + clinic.plan.slice(1)} plan</div>
              <div style={s.planMeta}>{clinic.patient_limit ? `Up to ${clinic.patient_limit} patients` : 'Unlimited patients'}</div>
            </div>
            <button onClick={handleBillingPortal} style={s.manageBtn}>Manage billing →</button>
          </div>
        </Section>
      </div>
    </>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 16, padding: '22px 24px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      display: 'flex', flexDirection: 'column', gap: 16,
    }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{label}</label>
      {children}
      {hint && <span style={{ fontSize: 11, color: '#94a3b8' }}>{hint}</span>}
    </div>
  );
}

const s = {
  page:    { display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 860 },
  h1:      { fontSize: 28, fontWeight: 800, color: '#0d0f14', margin: '0 0 4px', letterSpacing: '-0.02em' },
  form:    { display: 'flex', flexDirection: 'column', gap: 20 },
  input:   {
    padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10,
    fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box',
    transition: 'border-color 0.15s, box-shadow 0.15s', fontFamily: 'inherit',
  },
  saveBtn: {
    background: '#006FEE', color: '#fff', border: 'none', borderRadius: 12,
    padding: '13px 28px', fontSize: 15, fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start',
  },
  linkRow:   { display: 'flex', flexDirection: 'column', gap: 2, paddingBottom: 12, borderBottom: '1px solid #f1f5f9' },
  linkLabel: { fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' },
  link:      { fontSize: 14, color: '#006FEE', wordBreak: 'break-all' },
  planCard:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', borderRadius: 10, padding: 16 },
  planName:  { fontWeight: 700, fontSize: 16, color: '#111' },
  planMeta:  { fontSize: 13, color: '#64748b', marginTop: 2 },
  manageBtn: { background: '#006FEE', color: '#fff', borderRadius: 10, padding: '10px 16px', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' },
};
