'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { updateClinic } from '../../../lib/api';
import { getSupabaseBrowser } from '../../../lib/supabase-browser';

// ─── Colour helpers (duplicated from SettingsClient to keep this self-contained) ───

function hexToRgb(hex) {
  const n = parseInt((hex || '#006FEE').replace('#', ''), 16);
  return { r: n >> 16, g: (n >> 8) & 0xff, b: n & 0xff };
}
function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
function onColor(hex) { return luminance(hex) > 0.55 ? '#1a1a1a' : '#ffffff'; }
function onColorMuted(hex) { return luminance(hex) > 0.55 ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.55)'; }
function darkenHex(hex, r = 0.72) {
  const c = hexToRgb(hex);
  return `rgb(${Math.round(c.r * r)},${Math.round(c.g * r)},${Math.round(c.b * r)})`;
}

// ─── Preset brand colours ──────────────────────────────────────────────────────

const PRESETS = [
  '#0ea5a0', '#2563eb', '#7c3aed', '#db2777',
  '#059669', '#d97706', '#dc2626', '#0f172a',
];

// ─── Barcode ──────────────────────────────────────────────────────────────────

const BAR_WIDTHS = [2,1,3,1,2,1,1,2,1,3,2,1,1,2,3,1,2,1,1,2,1,1,3,1,2,2,1,1,2,1,3,1,2,1,1,2,1,2,1,1,3,2,1,2];

function Barcode({ width = 200, height = 44 }) {
  const totalW = BAR_WIDTHS.reduce((s, w, i) => s + w * 2.2 + (i % 2 === 0 ? 1.1 : 0), 0);
  let x = 0;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${totalW} ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      {BAR_WIDTHS.map((w, i) => {
        const bw = w * 2.2;
        const bar = i % 2 === 0 ? <rect key={i} x={x} y={0} width={bw} height={height} fill="#1a1a1a" /> : null;
        x += bw + (i % 2 === 0 ? 1.1 : 0);
        return bar;
      })}
    </svg>
  );
}

// ─── Live card preview ────────────────────────────────────────────────────────

function CardPreview({ form }) {
  const [flipped, setFlipped] = useState(false);
  const color   = form.brand_color || '#0ea5a0';
  const fg      = onColor(color);
  const fgMuted = onColorMuted(color);
  const stripBg = darkenHex(color, 0.78);
  const label   = form.points_label || 'Points';
  const isDiscount = form.rewards_mode === 'discounts';
  const tierVal = isDiscount
    ? (form.points_per_dollar ? `${form.points_per_dollar} pts = $1` : '5 pts = $1')
    : 'Gold Member';
  const FONT = '-apple-system,"SF Pro Text","Helvetica Neue",sans-serif';

  return (
    <div style={{ perspective: 900, width: 320, userSelect: 'none' }}>
      <style>{`
        .sw-card-inner { transform-style: preserve-3d; transition: transform 0.55s cubic-bezier(0.4,0.2,0.2,1); position: relative; }
        .sw-card-inner.flipped { transform: rotateY(180deg); }
        .sw-card-face { backface-visibility: hidden; -webkit-backface-visibility: hidden; border-radius: 16px; overflow: hidden; box-shadow: 0 12px 40px rgba(0,0,0,0.18); }
        .sw-card-back-face { position: absolute; top: 0; left: 0; width: 100%; transform: rotateY(180deg); }
      `}</style>

      {/* Ghost cards for depth */}
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', top: 10, left: 8, right: 8, height: '100%', background: color, opacity: 0.18, borderRadius: 16, filter: 'blur(2px)' }} />
        <div style={{ position: 'absolute', top: 5, left: 4, right: 4, height: '100%', background: color, opacity: 0.28, borderRadius: 16 }} />

        <div className={`sw-card-inner${flipped ? ' flipped' : ''}`} style={{ width: 320 }}>
          {/* Front */}
          <div className="sw-card-face" style={{ background: '#fff', fontFamily: FONT, width: 320 }}>
            {/* Header */}
            <div style={{ height: 38, background: color, padding: '0 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ maxWidth: 170, overflow: 'hidden' }}>
                {form.logo_url
                  ? <img src={form.logo_url} alt="" style={{ height: 22, maxWidth: 120, objectFit: 'contain', display: 'block' }} />
                  : <span style={{ fontSize: 12.5, fontWeight: 700, color: fg, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                      {form.name || 'Your Clinic'}
                    </span>
                }
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                <div style={{ fontSize: 7.5, fontWeight: 500, color: fgMuted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: fg, lineHeight: 1, letterSpacing: '-0.02em' }}>500</div>
              </div>
            </div>
            {/* Strip */}
            <div style={{ height: 105, background: `linear-gradient(155deg, ${color} 0%, ${stripBg} 100%)`, position: 'relative', padding: '0 16px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(45deg,transparent,transparent 3px,rgba(255,255,255,0.018) 3px,rgba(255,255,255,0.018) 6px)' }} />
              <div style={{ position: 'relative' }}>
                <div style={{ fontSize: 8, fontWeight: 500, color: fgMuted, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 1 }}>{label}</div>
                <div style={{ fontSize: 40, fontWeight: 800, color: fg, lineHeight: 1, letterSpacing: '-0.04em' }}>500</div>
                {isDiscount && form.points_per_dollar && (
                  <div style={{ fontSize: 10.5, color: fgMuted, marginTop: 3, fontWeight: 500 }}>
                    ≈ ${(500 / parseFloat(form.points_per_dollar)).toFixed(2)} discount value
                  </div>
                )}
              </div>
            </div>
            {/* Secondary fields */}
            <div style={{ padding: '10px 14px 8px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '0.5px solid rgba(0,0,0,0.07)' }}>
              {[['Member','Jane Smith','left'],[ isDiscount ? 'Redemption' : 'Tier', tierVal,'center'], ['Expires','03/2028','right']].map(([lbl,val,align]) => (
                <div key={lbl} style={{ textAlign: align }}>
                  <div style={{ fontSize: 8, fontWeight: 500, letterSpacing: '0.07em', color: '#8e8e93', textTransform: 'uppercase', marginBottom: 2 }}>{lbl}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: lbl === (isDiscount ? 'Redemption':'Tier') ? color : '#1c1c1e', lineHeight: 1.2 }}>{val}</div>
                </div>
              ))}
            </div>
            {/* Auxiliary fields */}
            <div style={{ padding: '8px 14px 10px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '0.5px solid rgba(0,0,0,0.07)' }}>
              {[['Next checkup','Jun 2026','left'],['Member since','Mar 2026','center'],['Referral code','AB3XK9','right']].map(([lbl,val,align]) => (
                <div key={lbl} style={{ textAlign: align }}>
                  <div style={{ fontSize: 8, fontWeight: 500, letterSpacing: '0.07em', color: '#8e8e93', textTransform: 'uppercase', marginBottom: 2 }}>{lbl}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: lbl === 'Referral code' ? color : '#1c1c1e', lineHeight: 1.2 }}>{val}</div>
                </div>
              ))}
            </div>
            {/* Barcode */}
            <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, background: '#fafafa' }}>
              <Barcode width={200} height={44} />
              <div style={{ fontSize: 8.5, color: '#8e8e93', letterSpacing: '0.12em', fontWeight: 500 }}>DP-2026-AB3XK9</div>
            </div>
          </div>

          {/* Back */}
          <div className="sw-card-face sw-card-back-face" style={{ background: '#f1f5f9', fontFamily: FONT, width: 320, minHeight: 380, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              ['Program',    `${form.name || 'Your Clinic'} Loyalty`],
              ['How to earn', `Visit (+100 ${label})  ·  Review (+100 ${label})  ·  Refer (+250 ${label})`],
              isDiscount && form.points_per_dollar
                ? ['Redeeming', `${form.points_per_dollar} ${label} = $1 discount at checkout`]
                : ['Tiers', 'Bronze → Silver → Gold as you accumulate points'],
              form.address   ? ['Address',     form.address]      : null,
            form.phone     ? ['Phone',       form.phone]        : null,
            form.booking_url ? ['Book online', form.booking_url] : null,
              ['Terms', `${label} have no cash value. ${form.name || 'The clinic'} may modify the programme at any time.`],
            ].filter(Boolean).map(([lbl, val]) => (
              <div key={lbl} style={{ background: '#fff', borderRadius: 10, padding: '10px 12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', color: color, textTransform: 'uppercase', marginBottom: 3 }}>{lbl}</div>
                <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.45 }}>{val}</div>
              </div>
            ))}
          </div>
        </div>
        {/* Flip button — absolute overlay so it's never covered by the taller back face */}
        <button
          type="button"
          onClick={() => setFlipped(f => !f)}
          style={{ position: 'absolute', top: 10, right: 10, zIndex: 20, display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(6px)', border: '1.5px solid rgba(0,0,0,0.1)', borderRadius: 20, padding: '5px 12px', fontSize: 12, color: '#374151', cursor: 'pointer', fontFamily: FONT, boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"/>
          </svg>
          {flipped ? 'Front' : 'Back'}
        </button>
      </div>
    </div>
  );
}

// ─── Step components ──────────────────────────────────────────────────────────

function StepBrand({ form, set, fileRef, uploading, onLogoChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <label style={s.label}>Clinic name</label>
        <input style={s.input} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Bright Smile Dental" />
      </div>

      <div>
        <label style={s.label}>Brand colour</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          {PRESETS.map(c => (
            <button key={c} type="button" onClick={() => set('brand_color', c)}
              style={{ width: 32, height: 32, borderRadius: 8, background: c, border: form.brand_color === c ? '3px solid #111' : '2px solid transparent', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.15)', transition: 'transform 0.1s', flexShrink: 0 }}
              title={c}
            />
          ))}
          <input type="color" value={form.brand_color || '#0ea5a0'} onChange={e => set('brand_color', e.target.value)}
            style={{ width: 32, height: 32, border: 'none', borderRadius: 8, padding: 0, cursor: 'pointer', background: 'none' }} title="Custom colour" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: form.brand_color || '#0ea5a0', flexShrink: 0 }} />
          <input style={{ ...s.input, maxWidth: 120, fontFamily: 'monospace', fontSize: 13 }}
            value={form.brand_color || ''} onChange={e => set('brand_color', e.target.value)} placeholder="#0ea5a0" maxLength={7} />
        </div>
      </div>

      <div>
        <label style={s.label}>Logo <span style={s.hint}>(PNG, JPG, SVG or WebP · max 2 MB — optional)</span></label>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" style={{ display: 'none' }} onChange={onLogoChange} />
        <button type="button" onClick={() => fileRef.current?.click()}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: '1.5px dashed #e2e8f0', borderRadius: 10, background: '#fafafa', cursor: 'pointer', fontSize: 13, color: '#64748b', width: '100%', boxSizing: 'border-box' }}>
          {uploading ? <span style={{ color: '#2563eb', fontWeight: 600 }}>Uploading…</span>
            : form.logo_url ? <>
                <img src={form.logo_url} alt="logo" style={{ height: 28, maxWidth: 80, objectFit: 'contain', borderRadius: 4 }} />
                <span style={{ color: '#2563eb', fontSize: 12 }}>Change logo</span>
              </>
            : <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                Upload logo
              </>
          }
        </button>
        {form.logo_url && (
          <button type="button" onClick={() => set('logo_url', '')}
            style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: 11, cursor: 'pointer', padding: '4px 0' }}>
            Remove logo
          </button>
        )}
      </div>
    </div>
  );
}

function StepLoyalty({ form, set }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <label style={s.label}>Points label <span style={s.hint}>What to call your currency on the card</span></label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          {['Points', 'Stars', 'Smiles', 'Coins', 'Rewards'].map(opt => (
            <button key={opt} type="button" onClick={() => set('points_label', opt)}
              style={{ padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: form.points_label === opt ? '2px solid #2563eb' : '1.5px solid #e2e8f0', background: form.points_label === opt ? '#eff6ff' : '#fff', color: form.points_label === opt ? '#2563eb' : '#374151', transition: 'all 0.1s' }}>
              {opt}
            </button>
          ))}
        </div>
        <input style={{ ...s.input, maxWidth: 180 }} value={form.points_label} onChange={e => set('points_label', e.target.value)} placeholder="Or type your own…" maxLength={20} />
      </div>

      <div>
        <label style={s.label}>Rewards mode</label>
        {[
          { value: 'tiers',     label: 'Tier system',         desc: 'Patients unlock Bronze → Silver → Gold as they accumulate points.' },
          { value: 'discounts', label: 'Discount redemption', desc: 'Patients redeem points for dollar discounts at the front desk.' },
        ].map(opt => {
          const active = form.rewards_mode === opt.value;
          return (
            <button key={opt.value} type="button" onClick={() => set('rewards_mode', opt.value)}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', borderRadius: 12, textAlign: 'left', cursor: 'pointer', width: '100%', marginBottom: 8, border: active ? '2px solid #2563eb' : '1.5px solid #e2e8f0', background: active ? '#eff6ff' : '#fff', transition: 'all 0.15s' }}>
              <div style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 1, border: active ? '5px solid #2563eb' : '2px solid #cbd5e1', background: '#fff' }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: active ? '#2563eb' : '#111' }}>{opt.label}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{opt.desc}</div>
              </div>
            </button>
          );
        })}
      </div>

      {form.rewards_mode === 'discounts' && (
        <div>
          <label style={s.label}>Conversion rate</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="number" min="1" step="1" style={{ ...s.input, maxWidth: 80 }} value={form.points_per_dollar} onChange={e => set('points_per_dollar', e.target.value)} placeholder="5" />
            <span style={{ fontSize: 13, color: '#64748b' }}>
              {form.points_label || 'points'} = $1.00
              {form.points_per_dollar && ` · 100 pts = $${(100 / parseFloat(form.points_per_dollar)).toFixed(2)}`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function StepLinks({ form, set }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <p style={{ margin: 0, fontSize: 14, color: '#64748b', lineHeight: 1.6 }}>
        These appear on the back of your patients' wallet card as tappable buttons.
      </p>

      <div>
        <label style={s.label}>Clinic address <span style={s.hint}>optional — powers "Get Directions" on the card</span></label>
        <input style={s.input} value={form.address} onChange={e => set('address', e.target.value)} placeholder="123 Main St, Edmonton, AB T6W 0L7" />
        <p style={{ margin: '6px 0 0', fontSize: 12, color: '#94a3b8' }}>
          Opens Google Maps on Android and Apple Maps on iOS.
        </p>
      </div>

      <div>
        <label style={s.label}>Phone number <span style={s.hint}>optional — powers "Call Us" on the card</span></label>
        <input style={s.input} type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+1 (780) 555-0100" />
      </div>

      <div>
        <label style={s.label}>Online booking URL <span style={s.hint}>optional</span></label>
        <input style={s.input} type="url" value={form.booking_url} onChange={e => set('booking_url', e.target.value)} placeholder="https://yoursite.com/book" />
      </div>

      <div>
        <label style={s.label}>Google Review URL <span style={s.hint}>optional — patients earn 100 pts for leaving a review</span></label>
        <input style={s.input} type="url" value={form.google_review_url} onChange={e => set('google_review_url', e.target.value)} placeholder="https://g.page/r/…/review" />
        <p style={{ margin: '6px 0 0', fontSize: 12, color: '#94a3b8' }}>
          Find this in Google Business Profile → Get more reviews → Share review form
        </p>
      </div>
    </div>
  );
}

function StepDone({ clinicName }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 20 }}>
      <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      <div>
        <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 800, color: '#111' }}>Your card is ready!</h2>
        <p style={{ margin: 0, fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
          <strong>{clinicName}</strong>'s loyalty card has been created and is live in the PassKit network. Patients can now scan your enrollment QR code to add it to their Apple or Google Wallet.
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
        {[
          ['Share your enrollment link', 'Go to Dashboard → copy the QR code or link to send to patients.'],
          ['Award points at checkout', 'Open a patient\'s profile and tap "Award Points" after each visit.'],
          ['Customise anytime', 'Head to Settings to update your colours, logo, or rewards mode later.'],
        ].map(([title, desc]) => (
          <div key={title} style={{ display: 'flex', gap: 12, padding: '12px 14px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#2563eb', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 2 }}>{title}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

const STEPS = [
  { id: 'brand',   title: 'Your brand',       subtitle: 'Give your card an identity' },
  { id: 'loyalty', title: 'Loyalty program',  subtitle: 'How patients earn & redeem' },
  { id: 'links',   title: 'Clinic links',     subtitle: 'Booking and reviews' },
  { id: 'done',    title: 'All set!',          subtitle: 'Your card is live' },
];

export default function SetupWizard({ clinic }) {
  const router  = useRouter();
  const fileRef = useRef(null);

  const [step,      setStep]      = useState(0);
  const [saving,    setSaving]    = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error,     setError]     = useState('');

  const [form, setForm] = useState({
    name:             clinic.name  || '',
    brand_color:      clinic.brand_color  || '#0ea5a0',
    logo_url:         clinic.logo_url     || '',
    points_label:     clinic.points_label || 'Points',
    rewards_mode:     clinic.rewards_mode || 'tiers',
    points_per_dollar: clinic.points_per_dollar ? String(clinic.points_per_dollar) : '5',
    address:           clinic.address           || '',
    phone:             clinic.phone             || '',
    booking_url:       clinic.booking_url       || '',
    google_review_url: clinic.google_review_url || '',
  });

  function set(key, val) { setForm(f => ({ ...f, [key]: val })); }

  async function handleLogoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const sb  = getSupabaseBrowser();
      const ext = file.name.split('.').pop();
      const path = `${clinic.id}/logo.${ext}`;
      await sb.storage.from('clinic-logos').upload(path, file, { upsert: true });
      const { data: { publicUrl } } = sb.storage.from('clinic-logos').getPublicUrl(path);
      set('logo_url', publicUrl);
    } catch {
      setError('Logo upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  async function handleNext() {
    if (step < STEPS.length - 2) {
      setStep(s => s + 1);
      return;
    }
    // Final step — save everything
    setSaving(true);
    setError('');
    try {
      const { data: { session } } = await getSupabaseBrowser().auth.getSession();
      const payload = {
        ...form,
        points_per_dollar: form.rewards_mode === 'discounts' && form.points_per_dollar ? parseFloat(form.points_per_dollar) : null,
        setup_completed: true,
      };
      await updateClinic(clinic.id, payload, session?.access_token);
      setStep(STEPS.length - 1);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const isLast    = step === STEPS.length - 2; // last form step before done
  const isDone    = step === STEPS.length - 1;
  const canGoBack = step > 0 && !isDone;

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f0f4ff 0%, #fafafa 60%)', display: 'flex', flexDirection: 'column', fontFamily: "-apple-system,'Segoe UI',sans-serif" }}>

      {/* Top bar */}
      <div style={{ height: 56, borderBottom: '1px solid rgba(0,0,0,0.07)', background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', padding: '0 32px', gap: 12, position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ width: 28, height: 28, background: '#111', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </div>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#111', letterSpacing: '-0.01em' }}>DentaPass Setup</span>

        {/* Step pills */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {STEPS.slice(0, -1).map((st, i) => (
            <div key={st.id} style={{ width: 28, height: 6, borderRadius: 3, background: i <= step ? '#2563eb' : '#e2e8f0', transition: 'background 0.3s' }} />
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '48px 24px', gap: 64, flexWrap: 'wrap' }}>

        {/* Left — form */}
        <div style={{ flex: '0 0 420px', maxWidth: 420 }}>
          {/* Step header */}
          <div style={{ marginBottom: 32 }}>
            {!isDone && (
              <div style={{ fontSize: 12, fontWeight: 700, color: '#2563eb', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
                Step {step + 1} of {STEPS.length - 1}
              </div>
            )}
            <h1 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 800, color: '#111', letterSpacing: '-0.02em' }}>
              {STEPS[step].title}
            </h1>
            <p style={{ margin: 0, fontSize: 14, color: '#64748b' }}>{STEPS[step].subtitle}</p>
          </div>

          {/* Step content */}
          {step === 0 && <StepBrand form={form} set={set} fileRef={fileRef} uploading={uploading} onLogoChange={handleLogoUpload} />}
          {step === 1 && <StepLoyalty form={form} set={set} />}
          {step === 2 && <StepLinks form={form} set={set} />}
          {step === 3 && <StepDone clinicName={form.name} />}

          {error && <p style={{ marginTop: 16, fontSize: 13, color: '#dc2626' }}>{error}</p>}

          {/* Navigation */}
          <div style={{ marginTop: 36, display: 'flex', gap: 10 }}>
            {canGoBack && (
              <button type="button" onClick={() => setStep(s => s - 1)}
                style={{ padding: '12px 22px', border: '1.5px solid #e2e8f0', borderRadius: 10, background: '#fff', fontSize: 14, fontWeight: 600, color: '#374151', cursor: 'pointer' }}>
                ← Back
              </button>
            )}
            {isDone ? (
              <button type="button" onClick={() => router.push('/dashboard')}
                style={{ flex: 1, padding: '13px', background: '#111', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', letterSpacing: '-0.01em' }}>
                Go to Dashboard →
              </button>
            ) : (
              <button type="button" onClick={handleNext} disabled={saving}
                style={{ flex: 1, padding: '13px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, letterSpacing: '-0.01em' }}>
                {saving ? 'Saving…' : isLast ? 'Finish setup →' : 'Next →'}
              </button>
            )}
          </div>
        </div>

        {/* Right — live card preview */}
        {!isDone && (
          <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, paddingTop: 56 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Live preview</div>
            <CardPreview form={form} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = {
  label: { display: 'block', fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 6 },
  hint:  { fontWeight: 400, color: '#94a3b8', fontSize: 12 },
  input: {
    display: 'block', width: '100%', padding: '10px 12px',
    border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14,
    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
    color: '#111', background: '#fff',
  },
};
