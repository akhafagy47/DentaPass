'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateClinic, getBillingPortalUrl } from '../../../lib/api';
import { getSupabaseBrowser } from '../../../lib/supabase-browser';

// ─── Wallet Card Preview ─────────────────────────────────────────────────────
// Accurate replica of a PassKit Apple Wallet Generic pass.
// Dimensions scaled from Apple's 375pt card width → 320px display width.
// Scale factor: 0.853

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return { r: n >> 16, g: (n >> 8) & 0xff, b: n & 0xff };
}
function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
function onColor(hex) {
  return luminance(hex) > 0.55 ? '#1a1a1a' : '#ffffff';
}
function onColorMuted(hex) {
  return luminance(hex) > 0.55 ? 'rgba(0,0,0,0.42)' : 'rgba(255,255,255,0.55)';
}
function mix(hex, ratio = 0.72) {
  // Darken by blending with black
  const { r, g, b } = hexToRgb(hex);
  return `rgb(${Math.round(r * ratio)},${Math.round(g * ratio)},${Math.round(b * ratio)})`;
}

// Deterministic barcode — same every render
const BARCODE_WIDTHS = [2,1,3,1,2,1,1,2,1,3,2,1,1,2,3,1,2,1,1,2,1,1,3,1,2,2,1,1,2,1,3,1,2,1,1,2,1,2,1,1,3,2,1,2,1,1];

function Barcode() {
  let x = 0;
  return (
    <svg width="196" height="52" viewBox="0 0 196 52" style={{ display: 'block' }}>
      {BARCODE_WIDTHS.map((w, i) => {
        const bar = (
          <rect key={i} x={x} y={0} width={w * 2.2} height={52}
            fill={i % 2 === 0 ? '#1a1a1a' : 'transparent'} />
        );
        x += w * 2.2 + (i % 2 === 0 ? 1.1 : 0);
        return bar;
      })}
    </svg>
  );
}

function PassField({ label, value, align = 'left', color }) {
  return (
    <div style={{ textAlign: align }}>
      <div style={{
        fontSize: 8.5, fontWeight: 500, letterSpacing: '0.07em',
        color: '#8e8e93', textTransform: 'uppercase', marginBottom: 2,
        fontFamily: '-apple-system, "SF Pro Text", "Helvetica Neue", sans-serif',
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 13.5, fontWeight: 600, color: color || '#1c1c1e', lineHeight: 1.2,
        fontFamily: '-apple-system, "SF Pro Text", "Helvetica Neue", sans-serif',
      }}>
        {value}
      </div>
    </div>
  );
}

function WalletCardPreview({ clinicName, brandColor, pointsLabel, rewardsMode, pointsPerDollar, logoUrl }) {
  const color     = brandColor || '#006FEE';
  const fg        = onColor(color);
  const fgMuted   = onColorMuted(color);
  const stripDark = mix(color, 0.78);
  const label     = pointsLabel || 'Points';
  const name      = clinicName || 'Your Clinic';

  const tierValue = rewardsMode === 'discounts'
    ? (pointsPerDollar ? `${pointsPerDollar} pts = $1` : '5 pts = $1')
    : 'Gold Member';

  return (
    // Outer wrapper — simulates the wallet card stack + background
    <div style={{ position: 'relative', width: 320 }}>

      {/* Stacked cards behind (depth effect) */}
      <div style={{
        position: 'absolute', bottom: -8, left: 10, right: 10,
        height: 20, background: 'rgba(0,0,0,0.08)', borderRadius: '0 0 18px 18px',
      }} />
      <div style={{
        position: 'absolute', bottom: -4, left: 5, right: 5,
        height: 14, background: 'rgba(0,0,0,0.05)', borderRadius: '0 0 16px 16px',
      }} />

      {/* The actual pass */}
      <div style={{
        width: 320,
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.22), 0 2px 6px rgba(0,0,0,0.1)',
        background: '#ffffff',
        fontFamily: '-apple-system, "SF Pro Text", "Helvetica Neue", sans-serif',
        userSelect: 'none',
        position: 'relative',
        zIndex: 1,
      }}>

        {/* ── HEADER BAR (44pt → 38px) ── */}
        <div style={{
          background: color,
          padding: '0 14px',
          height: 38,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          {/* Logo / clinic name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, maxWidth: 180, overflow: 'hidden' }}>
            {logoUrl ? (
              <img src={logoUrl} alt="logo"
                style={{ height: 22, maxWidth: 120, objectFit: 'contain', display: 'block' }} />
            ) : (
              <span style={{
                fontSize: 13, fontWeight: 700, color: fg,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                letterSpacing: '-0.01em',
              }}>
                {name}
              </span>
            )}
          </div>

          {/* Header field — points balance (top-right) */}
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 7.5, fontWeight: 500, color: fgMuted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {label}
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: fg, lineHeight: 1, letterSpacing: '-0.02em' }}>
              500
            </div>
          </div>
        </div>

        {/* ── STRIP IMAGE AREA (123pt → 105px) ── */}
        {/* This is where PassKit renders the strip image. We simulate it with a gradient. */}
        <div style={{
          height: 105,
          background: `linear-gradient(160deg, ${color} 0%, ${stripDark} 100%)`,
          position: 'relative',
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
        }}>
          {/* Subtle texture overlay */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.015) 2px, rgba(255,255,255,0.015) 4px)',
          }} />

          {/* Primary field — overlaid on strip */}
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 8.5, fontWeight: 500, color: fgMuted, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>
              {label}
            </div>
            <div style={{ fontSize: 40, fontWeight: 800, color: fg, lineHeight: 1, letterSpacing: '-0.04em' }}>
              500
            </div>
            {rewardsMode === 'discounts' && pointsPerDollar && (
              <div style={{ fontSize: 11, color: fgMuted, marginTop: 3, fontWeight: 500 }}>
                ≈ ${(500 / parseFloat(pointsPerDollar)).toFixed(2)} discount value
              </div>
            )}
          </div>
        </div>

        {/* ── SECONDARY FIELDS ── */}
        <div style={{
          padding: '11px 16px 8px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          borderBottom: '0.5px solid rgba(0,0,0,0.08)',
        }}>
          <PassField label="Member" value="Jane Smith" />
          <PassField label={rewardsMode === 'discounts' ? 'Redemption' : 'Tier'} value={tierValue} align="center" color={color} />
          <PassField label="Expires" value="03/2028" align="right" />
        </div>

        {/* ── AUXILIARY FIELDS ── */}
        <div style={{
          padding: '8px 16px 11px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          borderBottom: '0.5px solid rgba(0,0,0,0.08)',
        }}>
          <PassField label="Next checkup" value="Jun 2026" />
          <PassField label="Member since" value="Mar 2026" align="center" />
          <PassField label="Referral code" value="AB3XK9" align="right" color={color} />
        </div>

        {/* ── BARCODE AREA ── */}
        <div style={{
          padding: '14px 16px 16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
          background: '#fafafa',
        }}>
          <Barcode />
          <div style={{
            fontSize: 9, color: '#8e8e93', letterSpacing: '0.12em', fontWeight: 500,
          }}>
            DP-2026-AB3XK9
          </div>
        </div>
      </div>

      {/* "View" label beneath — mimics Wallet UI */}
      <div style={{
        textAlign: 'center', marginTop: 10,
        fontSize: 11, color: 'rgba(0,0,0,0.3)', fontWeight: 500, letterSpacing: '0.02em',
      }}>
        Apple Wallet · PassKit
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
