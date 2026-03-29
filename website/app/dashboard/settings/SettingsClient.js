'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { updateClinic, getBillingPortalUrl } from '../../../lib/api';
import { getSupabaseBrowser } from '../../../lib/supabase-browser';

// ─── Color helpers ────────────────────────────────────────────────────────────

function hexToRgb(hex) {
  const n = parseInt((hex || '#006FEE').replace('#', ''), 16);
  return { r: n >> 16, g: (n >> 8) & 0xff, b: n & 0xff };
}
function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
function onColor(hex)      { return luminance(hex) > 0.55 ? '#1a1a1a' : '#ffffff'; }
function onColorMuted(hex) { return luminance(hex) > 0.55 ? 'rgba(0,0,0,0.42)' : 'rgba(255,255,255,0.55)'; }
function darkenHex(hex, ratio = 0.72) {
  const { r, g, b } = hexToRgb(hex);
  return `rgb(${Math.round(r * ratio)},${Math.round(g * ratio)},${Math.round(b * ratio)})`;
}

// ─── Barcode (deterministic) ──────────────────────────────────────────────────

const BAR_WIDTHS = [2,1,3,1,2,1,1,2,1,3,2,1,1,2,3,1,2,1,1,2,1,1,3,1,2,2,1,1,2,1,3,1,2,1,1,2,1,2,1,1,3,2,1,2];

function Barcode({ width = 200, height = 48 }) {
  const totalW = BAR_WIDTHS.reduce((s, w, i) => s + w * 2.2 + (i % 2 === 0 ? 1.1 : 0), 0);
  const scaleX = width / totalW;
  let x = 0;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${totalW} ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      {BAR_WIDTHS.map((w, i) => {
        const bw = w * 2.2;
        const bar = i % 2 === 0
          ? <rect key={i} x={x} y={0} width={bw} height={height} fill="#1a1a1a" />
          : null;
        x += bw + (i % 2 === 0 ? 1.1 : 0);
        return bar;
      })}
    </svg>
  );
}

// ─── Pass field ───────────────────────────────────────────────────────────────

function PF({ label, value, align = 'left', accent }) {
  const FONT = '-apple-system,"SF Pro Text","Helvetica Neue",sans-serif';
  return (
    <div style={{ textAlign: align }}>
      <div style={{ fontFamily: FONT, fontSize: 8, fontWeight: 500, letterSpacing: '0.07em', color: '#8e8e93', textTransform: 'uppercase', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: accent || '#1c1c1e', lineHeight: 1.2 }}>
        {value}
      </div>
    </div>
  );
}

// ─── Card front ───────────────────────────────────────────────────────────────

function CardFront({ clinicName, brandColor, pointsLabel, rewardsMode, pointsPerDollar, logoUrl }) {
  const color    = brandColor || '#006FEE';
  const fg       = onColor(color);
  const fgMuted  = onColorMuted(color);
  const stripBg  = darkenHex(color, 0.78);
  const label    = pointsLabel || 'Points';
  const FONT     = '-apple-system,"SF Pro Text","Helvetica Neue",sans-serif';
  const tierVal  = rewardsMode === 'discounts'
    ? (pointsPerDollar ? `${pointsPerDollar} pts = $1` : '5 pts = $1')
    : 'Gold Member';

  return (
    <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', fontFamily: FONT }}>

      {/* Header bar — 38px, exact PassKit header zone */}
      <div style={{ height: 38, background: color, padding: '0 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ maxWidth: 170, overflow: 'hidden' }}>
          {logoUrl
            ? <img src={logoUrl} alt="" style={{ height: 22, maxWidth: 120, objectFit: 'contain', display: 'block' }} />
            : <span style={{ fontSize: 12.5, fontWeight: 700, color: fg, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                {clinicName || 'Your Clinic'}
              </span>
          }
        </div>
        {/* Header field — points summary top-right */}
        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
          <div style={{ fontSize: 7.5, fontWeight: 500, color: fgMuted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: fg, lineHeight: 1, letterSpacing: '-0.02em' }}>500</div>
        </div>
      </div>

      {/* Strip image area — 105px, gradient simulating PassKit strip */}
      <div style={{ height: 105, background: `linear-gradient(155deg, ${color} 0%, ${stripBg} 100%)`, position: 'relative', padding: '0 16px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(45deg,transparent,transparent 3px,rgba(255,255,255,0.018) 3px,rgba(255,255,255,0.018) 6px)' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 8, fontWeight: 500, color: fgMuted, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 1 }}>{label}</div>
          <div style={{ fontSize: 40, fontWeight: 800, color: fg, lineHeight: 1, letterSpacing: '-0.04em' }}>500</div>
          {rewardsMode === 'discounts' && pointsPerDollar && (
            <div style={{ fontSize: 10.5, color: fgMuted, marginTop: 3, fontWeight: 500 }}>
              ≈ ${(500 / parseFloat(pointsPerDollar)).toFixed(2)} discount value
            </div>
          )}
        </div>
      </div>

      {/* Secondary fields */}
      <div style={{ padding: '10px 14px 8px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '0.5px solid rgba(0,0,0,0.07)' }}>
        <PF label="Member" value="Jane Smith" />
        <PF label={rewardsMode === 'discounts' ? 'Redemption' : 'Tier'} value={tierVal} align="center" accent={color} />
        <PF label="Expires" value="03/2028" align="right" />
      </div>

      {/* Auxiliary fields */}
      <div style={{ padding: '8px 14px 10px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '0.5px solid rgba(0,0,0,0.07)' }}>
        <PF label="Next checkup" value="Jun 2026" />
        <PF label="Member since" value="Mar 2026" align="center" />
        <PF label="Referral code" value="AB3XK9" align="right" accent={color} />
      </div>

      {/* Barcode zone */}
      <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, background: '#fafafa' }}>
        <Barcode width={200} height={44} />
        <div style={{ fontFamily: FONT, fontSize: 8.5, color: '#8e8e93', letterSpacing: '0.12em', fontWeight: 500 }}>DP-2026-AB3XK9</div>
      </div>
    </div>
  );
}

// ─── Card back ────────────────────────────────────────────────────────────────

function CardBack({ clinicName, brandColor, pointsLabel, rewardsMode, pointsPerDollar, bookingUrl, address, phone }) {
  const color   = brandColor || '#006FEE';
  const label   = pointsLabel || 'Points';
  const FONT    = '-apple-system,"SF Pro Text","Helvetica Neue",sans-serif';

  const earnRows = [
    { action: 'Visit the clinic',     pts: '+100' },
    { action: 'Leave a Google review',pts: '+100' },
    { action: 'Refer a friend',       pts: '+250' },
  ];

  const redeemText = rewardsMode === 'discounts' && pointsPerDollar
    ? `${pointsPerDollar} ${label} = $1 discount. Ask the receptionist to redeem at checkout.`
    : 'Unlock Bronze, Silver, and Gold tiers as you accumulate points and enjoy exclusive perks.';

  return (
    <div style={{ background: '#f2f2f7', borderRadius: 16, overflow: 'hidden', fontFamily: FONT, minHeight: 370 }}>

      {/* Back header */}
      <div style={{ background: color, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: onColor(color), letterSpacing: '0.04em' }}>
          {clinicName || 'Your Clinic'} — Card Info
        </span>
      </div>

      <div style={{ padding: '0 0 14px' }}>

        {/* Back fields — each is a rounded white row */}
        {[
          {
            label: 'Program',
            value: `DentaPass Loyalty — ${clinicName || 'Your Clinic'}`,
          },
          {
            label: 'How to earn ' + label,
            value: null,
            custom: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                {earnRows.map((r) => (
                  <div key={r.action} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: '#3c3c43' }}>{r.action}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: color }}>{r.pts} {label}</span>
                  </div>
                ))}
              </div>
            ),
          },
          {
            label: rewardsMode === 'discounts' ? 'Redeem discount' : 'Tier rewards',
            value: redeemText,
          },
          address && {
            label: 'Get directions',
            value: address,
          },
          phone && {
            label: 'Call us',
            value: phone,
          },
          bookingUrl && {
            label: 'Book an appointment',
            value: bookingUrl,
            isLink: true,
          },
          {
            label: 'Terms & conditions',
            value: 'Points have no cash value except where redeemable. DentaPass reserves the right to modify or terminate the program at any time.',
          },
        ].filter(Boolean).map((field, i) => (
          <div key={i} style={{
            margin: '8px 10px 0',
            background: '#fff',
            borderRadius: 10,
            padding: '10px 12px',
          }}>
            <div style={{ fontSize: 8, fontWeight: 500, letterSpacing: '0.07em', color: '#8e8e93', textTransform: 'uppercase', marginBottom: 4 }}>
              {field.label}
            </div>
            {field.custom || (
              <div style={{ fontSize: 11.5, color: field.isLink ? color : '#3c3c43', lineHeight: 1.45, wordBreak: 'break-all' }}>
                {field.value}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Flippable wallet card preview ───────────────────────────────────────────

function WalletCardPreview(props) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div style={{ width: 320 }}>
      <style>{`
        .card-scene { width: 320px; perspective: 900px; }
        .card-inner-flip {
          position: relative; width: 100%;
          transform-style: preserve-3d;
          transition: transform 0.55s cubic-bezier(0.4,0.2,0.2,1);
        }
        .card-inner-flip.is-flipped { transform: rotateY(180deg); }
        .card-face {
          width: 100%; backface-visibility: hidden; -webkit-backface-visibility: hidden;
          border-radius: 16px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.2), 0 2px 6px rgba(0,0,0,0.08);
        }
        .card-face-back {
          position: absolute; top: 0; left: 0;
          transform: rotateY(180deg);
        }
      `}</style>

      {/* Stack shadows */}
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', bottom: -8, left: 10, right: 10, height: 18, background: 'rgba(0,0,0,0.07)', borderRadius: '0 0 16px 16px' }} />
        <div style={{ position: 'absolute', bottom: -4, left: 5, right: 5,  height: 12, background: 'rgba(0,0,0,0.04)', borderRadius: '0 0 15px 15px' }} />

        <div className="card-scene">
          <div className={`card-inner-flip${flipped ? ' is-flipped' : ''}`}>
            <div className="card-face">
              <CardFront {...props} />
            </div>
            <div className="card-face card-face-back">
              <CardBack {...props} />
            </div>
          </div>
        </div>
      </div>

      {/* Flip button — mimics Apple Wallet ⓘ button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10, paddingRight: 4 }}>
        <button
          type="button"
          onClick={() => setFlipped((f) => !f)}
          title={flipped ? 'Show front' : 'Show back'}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 11, color: '#8e8e93', fontFamily: '-apple-system,sans-serif',
            padding: '4px 2px',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {flipped ? 'Front' : 'Back of card'}
        </button>
      </div>
    </div>
  );
}

// ─── Main Settings Client ────────────────────────────────────────────────────

export default function SettingsClient({ clinic }) {
  const router    = useRouter();
  const fileRef   = useRef(null);
  const [form, setForm] = useState({
    name:              clinic.name              || '',
    google_review_url: clinic.google_review_url || '',
    booking_url:       clinic.booking_url       || '',
    brand_color:       clinic.brand_color       || '#006FEE',
    logo_url:          clinic.logo_url          || '',
    points_label:      clinic.points_label      || 'Points',
    rewards_mode:      clinic.rewards_mode      || 'tiers',
    points_per_dollar: clinic.points_per_dollar || '',
    address:           clinic.address           || '',
    phone:             clinic.phone             || '',
  });
  const [saving, setSaving]         = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [feedback, setFeedback]     = useState('');

  function set(key, val) { setForm((f) => ({ ...f, [key]: val })); }

  async function getToken() {
    const { data: { session } } = await getSupabaseBrowser().auth.getSession();
    return session?.access_token;
  }

  async function handleLogoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const sb   = getSupabaseBrowser();
      const ext  = file.name.split('.').pop();
      const path = `${clinic.id}/logo.${ext}`;
      const { error } = await sb.storage.from('clinic-logos').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = sb.storage.from('clinic-logos').getPublicUrl(path);
      set('logo_url', publicUrl);
    } catch (err) {
      setFeedback('Logo upload failed: ' + (err.message || 'unknown error'));
      setTimeout(() => setFeedback(''), 4000);
    } finally {
      setUploading(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const token   = await getToken();
      const payload = { ...form };
      payload.points_per_dollar = payload.points_per_dollar === ''
        ? null
        : parseFloat(payload.points_per_dollar);
      await updateClinic(clinic.id, payload, token);
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
      const token  = await getToken();
      const { url } = await getBillingPortalUrl(token);
      window.location.href = url;
    } catch {}
  }

  const appUrl    = process.env.NEXT_PUBLIC_APP_URL || 'https://denta-pass.vercel.app';
  const enrollLink = `${appUrl}/join/${clinic.slug}`;
  const scanLink   = `${appUrl}/scan/${clinic.slug}`;

  return (
    <>
      <style>{`
        .st-input:focus { border-color: #006FEE !important; box-shadow: 0 0 0 3px rgba(0,111,238,0.08); }
        .st-upload:hover { border-color: #006FEE !important; background: #f0f7ff !important; }
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
            <Field label="Address" hint="Shown as a 'Get Directions' button on the wallet pass">
              <input className="st-input" value={form.address} onChange={(e) => set('address', e.target.value)} style={s.input} placeholder="123 Main St, Edmonton, AB T5J 2Z2" />
            </Field>
            <Field label="Phone" hint="Shown as a 'Call Us' button on the wallet pass">
              <input className="st-input" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} style={s.input} placeholder="+1 (780) 555-0100" />
            </Field>
          </Section>

          {/* ── Wallet card ── */}
          <Section title="Wallet card" subtitle="Customize what your patients see in Apple & Google Wallet">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 28, alignItems: 'start' }}>

              {/* Controls */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <Field label="Brand color">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input type="color" value={form.brand_color} onChange={(e) => set('brand_color', e.target.value)}
                      style={{ width: 44, height: 38, border: 'none', cursor: 'pointer', borderRadius: 8, padding: 2 }} />
                    <input className="st-input" value={form.brand_color} onChange={(e) => set('brand_color', e.target.value)}
                      style={{ ...s.input, maxWidth: 110 }} placeholder="#006FEE" />
                  </div>
                </Field>

                <Field label="Clinic logo" hint="PNG, JPG, SVG or WebP · max 2 MB">
                  {/* Hidden file input */}
                  <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    style={{ display: 'none' }} onChange={handleLogoUpload} />

                  {/* Upload button */}
                  <button type="button" className="st-upload" onClick={() => fileRef.current?.click()}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 14px', border: '1.5px dashed #e2e8f0',
                      borderRadius: 10, background: '#fafafa', cursor: 'pointer',
                      fontSize: 13, color: '#64748b', transition: 'border-color 0.15s, background 0.15s',
                      width: '100%', boxSizing: 'border-box',
                    }}>
                    {uploading ? (
                      <span style={{ color: '#006FEE', fontWeight: 600 }}>Uploading…</span>
                    ) : form.logo_url ? (
                      <>
                        <img src={form.logo_url} alt="logo" style={{ height: 28, maxWidth: 80, objectFit: 'contain', borderRadius: 4 }} />
                        <span style={{ color: '#006FEE', fontSize: 12 }}>Change logo</span>
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                        </svg>
                        Upload logo
                      </>
                    )}
                  </button>

                  {form.logo_url && (
                    <button type="button" onClick={() => set('logo_url', '')}
                      style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: 11, cursor: 'pointer', padding: '2px 0', textAlign: 'left' }}>
                      Remove logo
                    </button>
                  )}
                </Field>

                <Field label="Points label" hint="What to call your points on the card">
                  <input className="st-input" value={form.points_label} onChange={(e) => set('points_label', e.target.value)}
                    style={s.input} placeholder="Points" maxLength={20} />
                </Field>
              </div>

              {/* Live card preview */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.06em' }}>LIVE PREVIEW</div>
                <WalletCardPreview
                  clinicName={form.name}
                  brandColor={form.brand_color}
                  pointsLabel={form.points_label}
                  rewardsMode={form.rewards_mode}
                  pointsPerDollar={parseFloat(form.points_per_dollar) || null}
                  logoUrl={form.logo_url}
                  bookingUrl={form.booking_url}
                  address={form.address}
                  phone={form.phone}
                />
              </div>
            </div>
          </Section>

          {/* ── Rewards program ── */}
          <Section title="Rewards program" subtitle="Choose how patients benefit from their points">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { value: 'tiers',     label: 'Tier system',         desc: 'Patients unlock Bronze → Silver → Gold status as they accumulate points.' },
                { value: 'discounts', label: 'Discount redemption', desc: 'Patients redeem points for dollar discounts at the front desk.' },
              ].map((opt) => {
                const active = form.rewards_mode === opt.value;
                return (
                  <button key={opt.value} type="button" onClick={() => set('rewards_mode', opt.value)}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 16px',
                      borderRadius: 12, textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s',
                      border: active ? '2px solid #006FEE' : '1.5px solid #e2e8f0',
                      background: active ? '#eff6ff' : '#fff',
                    }}>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                      border: active ? '5px solid #006FEE' : '2px solid #cbd5e1', background: '#fff' }} />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: active ? '#006FEE' : '#111' }}>{opt.label}</div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{opt.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {form.rewards_mode === 'discounts' && (
              <Field label="Conversion rate" hint="How many points equal $1 in discount">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input className="st-input" type="number" min="1" step="1" value={form.points_per_dollar}
                    onChange={(e) => set('points_per_dollar', e.target.value)}
                    style={{ ...s.input, maxWidth: 90 }} placeholder="5" />
                  <span style={{ fontSize: 13, color: '#64748b' }}>
                    points = $1.00
                    {form.points_per_dollar && ` · 100 pts = $${(100 / parseFloat(form.points_per_dollar)).toFixed(2)}`}
                  </span>
                </div>
              </Field>
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
    <div style={{ background: '#fff', borderRadius: 16, padding: '22px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 16 }}>
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
  page:    { display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 920 },
  h1:      { fontSize: 28, fontWeight: 800, color: '#0d0f14', margin: '0 0 4px', letterSpacing: '-0.02em' },
  form:    { display: 'flex', flexDirection: 'column', gap: 20 },
  input:   { padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box', transition: 'border-color 0.15s, box-shadow 0.15s', fontFamily: 'inherit' },
  saveBtn: { background: '#006FEE', color: '#fff', border: 'none', borderRadius: 12, padding: '13px 28px', fontSize: 15, fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start' },
  linkRow:   { display: 'flex', flexDirection: 'column', gap: 2, paddingBottom: 12, borderBottom: '1px solid #f1f5f9' },
  linkLabel: { fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' },
  link:      { fontSize: 14, color: '#006FEE', wordBreak: 'break-all' },
  planCard:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', borderRadius: 10, padding: 16 },
  planName:  { fontWeight: 700, fontSize: 16, color: '#111' },
  planMeta:  { fontSize: 13, color: '#64748b', marginTop: 2 },
  manageBtn: { background: '#006FEE', color: '#fff', borderRadius: 10, padding: '10px 16px', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' },
};
