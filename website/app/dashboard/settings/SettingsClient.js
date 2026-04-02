'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { updateClinic, getBillingPortalUrl } from '../../../lib/api';
import { getSupabaseBrowser } from '../../../lib/supabase-browser';
import Spinner from '../../../components/Spinner';
import { cropAll } from '../../../lib/squareCrop';

// ─── Color helpers ────────────────────────────────────────────────────────────

function hexToRgb(hex) {
  const n = parseInt((hex || '#3bbfb9').replace('#', ''), 16);
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

// ─── Barcode ─────────────────────────────────────────────────────────────────

const BAR_WIDTHS = [2,1,3,1,2,1,1,2,1,3,2,1,1,2,3,1,2,1,1,2,1,1,3,1,2,2,1,1,2,1,3,1,2,1,1,2,1,2,1,1,3,2,1,2];

function Barcode({ width = 200, height = 48 }) {
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
  const color   = brandColor || '#3bbfb9';
  const fg      = onColor(color);
  const fgMuted = onColorMuted(color);
  const stripBg = darkenHex(color, 0.78);
  const label   = pointsLabel || 'Points';
  const FONT    = '-apple-system,"SF Pro Text","Helvetica Neue",sans-serif';
  const tierVal = rewardsMode === 'discounts'
    ? (pointsPerDollar ? `${pointsPerDollar} pts = $1` : '5 pts = $1')
    : 'Gold Member';

  return (
    <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', fontFamily: FONT }}>
      <div style={{ height: 38, background: color, padding: '0 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ maxWidth: 170, overflow: 'hidden' }}>
          {logoUrl
            ? <img src={logoUrl} alt="" style={{ height: 22, maxWidth: 120, objectFit: 'contain', display: 'block' }} />
            : <span style={{ fontSize: 12.5, fontWeight: 700, color: fg, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                {clinicName || 'Your Clinic'}
              </span>
          }
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
          <div style={{ fontSize: 7.5, fontWeight: 500, color: fgMuted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: fg, lineHeight: 1, letterSpacing: '-0.02em' }}>500</div>
        </div>
      </div>
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
      <div style={{ padding: '10px 14px 8px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '0.5px solid rgba(0,0,0,0.07)' }}>
        <PF label="Member" value="Jane Smith" />
        <PF label={rewardsMode === 'discounts' ? 'Redemption' : 'Tier'} value={tierVal} align="center" accent={color} />
        <PF label="Expires" value="03/2028" align="right" />
      </div>
      <div style={{ padding: '8px 14px 10px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '0.5px solid rgba(0,0,0,0.07)' }}>
        <PF label="Next checkup" value="Jun 2026" />
        <PF label="Member since" value="Mar 2026" align="center" />
        <PF label="Referral code" value="AB3XK9" align="right" accent={color} />
      </div>
      <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, background: '#fafafa' }}>
        <Barcode width={200} height={44} />
        <div style={{ fontFamily: FONT, fontSize: 8.5, color: '#8e8e93', letterSpacing: '0.12em', fontWeight: 500 }}>DP-2026-AB3XK9</div>
      </div>
    </div>
  );
}

// ─── Card back ────────────────────────────────────────────────────────────────

function CardBack({ clinicName, brandColor, pointsLabel, rewardsMode, pointsPerDollar, bookingUrl, address, phone }) {
  const color  = brandColor || '#3bbfb9';
  const label  = pointsLabel || 'Points';
  const FONT   = '-apple-system,"SF Pro Text","Helvetica Neue",sans-serif';
  const earnRows = [
    { action: 'Visit the clinic',      pts: '+100' },
    { action: 'Leave a Google review', pts: '+100' },
    { action: 'Refer a friend',        pts: '+250' },
  ];
  const redeemText = rewardsMode === 'discounts' && pointsPerDollar
    ? `${pointsPerDollar} ${label} = $1 discount. Ask the receptionist to redeem at checkout.`
    : 'Unlock Bronze, Silver, and Gold tiers as you accumulate points and enjoy exclusive perks.';

  return (
    <div style={{ background: '#f2f2f7', borderRadius: 16, overflow: 'hidden', fontFamily: FONT, minHeight: 370 }}>
      <div style={{ background: color, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: onColor(color), letterSpacing: '0.04em' }}>
          {clinicName || 'Your Clinic'} — Card Info
        </span>
      </div>
      <div style={{ padding: '0 0 14px' }}>
        {[
          { label: 'Program', value: `DentaPass Loyalty — ${clinicName || 'Your Clinic'}` },
          { label: 'How to earn ' + label, value: null, custom: (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
              {earnRows.map((r) => (
                <div key={r.action} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#3c3c43' }}>{r.action}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: color }}>{r.pts} {label}</span>
                </div>
              ))}
            </div>
          )},
          { label: rewardsMode === 'discounts' ? 'Redeem discount' : 'Tier rewards', value: redeemText },
          address && { label: 'Get directions', value: address },
          phone   && { label: 'Call us', value: phone },
          bookingUrl && { label: 'Book an appointment', value: bookingUrl, isLink: true },
          { label: 'Terms & conditions', value: 'Points have no cash value except where redeemable. DentaPass reserves the right to modify or terminate the program at any time.' },
        ].filter(Boolean).map((field, i) => (
          <div key={i} style={{ margin: '8px 10px 0', background: '#fff', borderRadius: 10, padding: '10px 12px' }}>
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
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <style>{`
        .card-scene { width: 300px; perspective: 900px; }
        .card-inner-flip { position: relative; width: 100%; transform-style: preserve-3d; transition: transform 0.55s cubic-bezier(0.4,0.2,0.2,1); }
        .card-inner-flip.is-flipped { transform: rotateY(180deg); }
        .card-face { width: 100%; backface-visibility: hidden; -webkit-backface-visibility: hidden; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.35), 0 2px 6px rgba(0,0,0,0.15); }
        .card-face-back { position: absolute; top: 0; left: 0; transform: rotateY(180deg); }
      `}</style>
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', bottom: -8, left: 10, right: 10, height: 18, background: 'rgba(0,0,0,0.12)', borderRadius: '0 0 16px 16px' }} />
        <div style={{ position: 'absolute', bottom: -4, left: 5, right: 5, height: 12, background: 'rgba(0,0,0,0.07)', borderRadius: '0 0 15px 15px' }} />
        <div className="card-scene">
          <div className={`card-inner-flip${flipped ? ' is-flipped' : ''}`}>
            <div className="card-face"><CardFront {...props} /></div>
            <div className="card-face card-face-back"><CardBack {...props} /></div>
          </div>
        </div>
      </div>
      <button type="button" onClick={() => setFlipped((f) => !f)} style={{
        marginTop: 8, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5,
        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20,
        padding: '6px 12px', fontSize: 11, color: 'rgba(255,255,255,0.4)',
        cursor: 'pointer', fontFamily: '-apple-system,sans-serif', whiteSpace: 'nowrap',
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        {flipped ? 'Front' : 'Back'}
      </button>
    </div>
  );
}

// ─── Account tab ─────────────────────────────────────────────────────────────

function AccountTab() {
  const sb = getSupabaseBrowser();

  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwStatus, setPwStatus] = useState('');  // '' | 'loading' | 'done' | 'error'
  const [pwErr, setPwErr] = useState('');

  async function handlePasswordChange(e) {
    e.preventDefault();
    const { current, next, confirm } = pwForm;
    if (next !== confirm) { setPwErr('Passwords do not match.'); return; }
    if (next.length < 8)  { setPwErr('Password must be at least 8 characters.'); return; }
    setPwStatus('loading');
    setPwErr('');

    // Re-authenticate with current password first
    const { data: { user } } = await sb.auth.getUser();
    const { error: signInErr } = await sb.auth.signInWithPassword({
      email: user.email,
      password: current,
    });
    if (signInErr) {
      setPwErr('Current password is incorrect.');
      setPwStatus('error');
      return;
    }

    const { error: updateErr } = await sb.auth.updateUser({ password: next });
    if (updateErr) {
      setPwErr(updateErr.message);
      setPwStatus('error');
    } else {
      setPwStatus('done');
      setPwForm({ current: '', next: '', confirm: '' });
    }
  }

  const INPUT = {
    padding: '10px 14px',
    border: '1.5px solid var(--dp-inbdr)',
    borderRadius: 10, fontSize: 14,
    background: 'var(--dp-inp)',
    color: 'var(--dp-t1)',
    fontFamily: "'DM Sans', sans-serif",
    outline: 'none',
    width: '100%', boxSizing: 'border-box',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{`.acc-input:focus{border-color:rgba(59,191,185,0.5)!important;box-shadow:0 0 0 3px rgba(59,191,185,0.1);outline:none}`}</style>

      {/* ── Change password ── */}
      <form onSubmit={handlePasswordChange} style={PANEL}>
        <div style={SECTION_TITLE}>Change password</div>
        <div style={{ fontSize: 13, color: 'var(--dp-t3)', marginBottom: 16, marginTop: -8 }}>
          Enter your current password to verify it's you, then choose a new one.
        </div>

        <Field label="Current password">
          <input
            className="acc-input"
            type="password" required
            value={pwForm.current}
            onChange={(e) => { setPwForm((f) => ({ ...f, current: e.target.value })); setPwStatus(''); setPwErr(''); }}
            placeholder="••••••••"
            style={INPUT}
            autoComplete="current-password"
          />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="New password">
            <input
              className="acc-input"
              type="password" required
              value={pwForm.next}
              onChange={(e) => { setPwForm((f) => ({ ...f, next: e.target.value })); setPwStatus(''); setPwErr(''); }}
              placeholder="Min. 8 characters"
              style={INPUT}
              autoComplete="new-password"
            />
          </Field>
          <Field label="Confirm new password">
            <input
              className="acc-input"
              type="password" required
              value={pwForm.confirm}
              onChange={(e) => { setPwForm((f) => ({ ...f, confirm: e.target.value })); setPwStatus(''); setPwErr(''); }}
              placeholder="Repeat password"
              style={INPUT}
              autoComplete="new-password"
            />
          </Field>
        </div>

        {pwErr && <div style={ERR_BANNER}>{pwErr}</div>}
        {pwStatus === 'done' && <div style={OK_BANNER}>Password updated successfully.</div>}

        <button type="submit" disabled={pwStatus === 'loading'} style={{
          ...SUBMIT_BTN,
          opacity: pwStatus === 'loading' ? 0.5 : 1,
          cursor: pwStatus === 'loading' ? 'not-allowed' : 'pointer',
        }}>
          {pwStatus === 'loading' ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </div>
  );
}

const PANEL = {
  display: 'flex', flexDirection: 'column', gap: 16,
  background: 'var(--dp-card)',
  borderRadius: 16, padding: '24px 28px',
  border: '1px solid var(--dp-bdr)',
  backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
};
const SECTION_TITLE = {
  fontSize: 15, fontWeight: 700, color: 'var(--dp-t2)', marginBottom: 4,
};
const SUBMIT_BTN = {
  alignSelf: 'flex-start',
  background: '#3bbfb9', color: '#081312',
  border: 'none', borderRadius: 8,
  padding: '9px 20px', fontSize: 13, fontWeight: 700,
  fontFamily: "'DM Sans', sans-serif",
  transition: 'opacity 0.2s',
};
const OK_BANNER = {
  fontSize: 13, fontWeight: 600, color: '#34d399',
  background: 'rgba(52,211,153,0.1)',
  border: '1px solid rgba(52,211,153,0.2)',
  borderRadius: 8, padding: '9px 14px',
};
const ERR_BANNER = {
  fontSize: 13, fontWeight: 600, color: '#f87171',
  background: 'rgba(248,113,113,0.1)',
  border: '1px solid rgba(248,113,113,0.2)',
  borderRadius: 8, padding: '9px 14px',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function Field({ label, hint, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--dp-t3)', letterSpacing: '0.01em' }}>{label}</label>
      {children}
      {hint && <span style={{ fontSize: 11, color: 'var(--dp-t4)' }}>{hint}</span>}
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'clinic',   label: 'Clinic details' },
  { id: 'wallet',   label: 'Wallet card' },
  { id: 'rewards',  label: 'Rewards' },
  { id: 'links',    label: 'Links' },
  { id: 'billing',  label: 'Billing' },
  { id: 'account',  label: 'Account' },
];

// ─── CycleText ────────────────────────────────────────────────────────────────
function CycleText({ examples, style }) {
  const [idx, setIdx] = useState(0);
  const [vis, setVis] = useState(true);
  useEffect(() => {
    if (!examples || examples.length <= 1) return;
    const id = setInterval(() => {
      setVis(false);
      setTimeout(() => { setIdx((i) => (i + 1) % examples.length); setVis(true); }, 400);
    }, 3200);
    return () => clearInterval(id);
  }, [examples?.length]);
  if (!examples?.length) return null;
  return (
    <div style={{ ...style, opacity: vis ? 0.75 : 0, transition: 'opacity 0.4s ease' }}>
      {examples[idx]}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SettingsClient({ clinic }) {
  const router  = useRouter();
  const fileRef = useRef(null);
  const [tab, setTab] = useState('clinic');

  const initialForm = useMemo(() => ({
    name:              clinic.name              || '',
    google_review_url: clinic.google_review_url || '',
    booking_url:       clinic.booking_url       || '',
    brand_color:       clinic.brand_color       || '#3bbfb9',
    logo_url:          clinic.logo_url          || '',
    points_label:      clinic.points_label      || 'Points',
    rewards_mode:      clinic.rewards_mode      || 'tiers',
    points_per_dollar: clinic.points_per_dollar || '',
    address:           clinic.address           || '',
    phone:             clinic.phone             || '',
    facebook_url:      clinic.facebook_url      || '',
    instagram_url:     clinic.instagram_url     || '',
    theme:             clinic.theme             || 'auto',
    tier_thresholds:   clinic.tier_thresholds   || { bronze: 0, silver: 5000, gold: 10000 },
    tier_incentives:   clinic.tier_incentives   || {
      bronze: ['Priority scheduling', '10% off cosmetic treatments', 'Birthday discount'],
      silver: ['All Bronze perks', 'Free cleaning every 6 months', '15% off cosmetic treatments'],
      gold:   ['All Silver perks', 'Free annual whitening kit', '25% off all treatments'],
    },
    action_points:     clinic.action_points     || { completed_visit: 500, left_review: 500, referred_friend: 500, birthday: 250 },
    custom_actions:    clinic.custom_actions    || [],
  }), []);

  const [form, setForm]         = useState(initialForm);
  const [saving, setSaving]     = useState(false);
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [copiedUrl, setCopiedUrl] = useState(null);

  function copyUrl(url) {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2000);
    });
  }

  const isDirty = useMemo(() =>
    Object.keys(initialForm).some((k) => {
      const a = initialForm[k], b = form[k];
      if (typeof a === 'object' || typeof b === 'object') return JSON.stringify(a) !== JSON.stringify(b);
      return String(a) !== String(b);
    })
  , [form]);

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
      const blobs = await cropAll(file);
      const sb    = getSupabaseBrowser();
      const base  = `${clinic.id}`;
      const results = await Promise.all([
        sb.storage.from('clinic-logos').upload(`${base}/logo-icon.png`,      blobs.icon,      { upsert: true, contentType: 'image/png' }),
        sb.storage.from('clinic-logos').upload(`${base}/logo-thumbnail.png`, blobs.thumbnail, { upsert: true, contentType: 'image/png' }),
        sb.storage.from('clinic-logos').upload(`${base}/logo.png`,           blobs.logo,      { upsert: true, contentType: 'image/png' }),
      ]);
      const uploadErr = results.find(r => r.error)?.error;
      if (uploadErr) throw uploadErr;
      const { data: { publicUrl } } = sb.storage.from('clinic-logos').getPublicUrl(`${base}/logo.png`);
      set('logo_url', `${publicUrl}?t=${Date.now()}`);
      e.target.value = '';
    } catch (err) {
      setFeedback(err.message || 'Logo upload failed.');
      e.target.value = '';
      setTimeout(() => setFeedback(''), 4000);
    } finally {
      setUploading(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!isDirty) return;
    setSaving(true);
    try {
      const token   = await getToken();
      const payload = { ...form };
      payload.points_per_dollar = payload.points_per_dollar === ''
        ? null
        : parseFloat(payload.points_per_dollar);
      await updateClinic(clinic.id, payload, token);
      setFeedback('Saved!');
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

  const appUrl     = process.env.NEXT_PUBLIC_APP_URL || 'https://denta-pass.vercel.app';
  const enrollLink = `${appUrl}/join/${clinic.slug}`;
  const scanLink   = `${appUrl}/scan/${clinic.slug}`;

  const FORM_TABS = ['clinic', 'wallet', 'rewards'];

  return (
    <>
      <style>{`
        .st-input { transition: border-color 0.15s, box-shadow 0.15s; }
        .st-input:focus { border-color: rgba(59,191,185,0.5) !important; box-shadow: 0 0 0 3px rgba(59,191,185,0.1); outline: none; }
        .st-upload:hover { border-color: rgba(59,191,185,0.4) !important; background: rgba(59,191,185,0.05) !important; }
        .st-tab { transition: color 0.15s, border-color 0.15s; }
        .st-tab:hover { color: rgba(255,255,255,0.7) !important; }
      `}</style>

      <div style={s.page}>
        {/* Page title */}
        <div style={s.titleRow}>
          <h1 style={s.h1}>Settings</h1>
        </div>

        {/* Tab bar + save button */}
        <div style={s.tabBar}>
          <div style={s.tabList}>
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className="st-tab"
                onClick={() => setTab(t.id)}
                style={{
                  ...s.tab,
                  ...(tab === t.id ? s.tabActive : {}),
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {FORM_TABS.includes(tab) && (
            <button
              form="settings-form"
              type="submit"
              disabled={!isDirty || saving}
              style={{
                ...s.saveBtn,
                opacity: isDirty ? 1 : 0.3,
                cursor: isDirty ? 'pointer' : 'not-allowed',
              }}
            >
              {saving ? <><Spinner color="#081312" /> Saving…</> : feedback === 'Saved!' ? 'Saved ✓' : 'Save changes'}
            </button>
          )}
        </div>

        {/* Tab content */}
        <form id="settings-form" onSubmit={handleSave} style={s.form}>

          {/* ── CLINIC ── */}
          {tab === 'clinic' && (
            <div style={s.panel}>
              {/* Row 1: Clinic name + Phone */}
              <div style={s.formRow}>
                <Field label="Clinic name">
                  <input className="st-input" value={form.name} onChange={(e) => set('name', e.target.value)} style={s.input} required />
                </Field>
                <Field label="Phone" hint="Shown as a 'Call Us' button on the wallet pass">
                  <input className="st-input" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} style={s.input} placeholder="+1 (780) 555-0100" />
                </Field>
              </div>
              {/* Row 2: Address full-width */}
              <Field label="Address" hint="Shown as a 'Get Directions' button on the wallet pass">
                <input className="st-input" value={form.address} onChange={(e) => set('address', e.target.value)} style={s.input} placeholder="123 Main St, Edmonton, AB T5J 2Z2" />
              </Field>
              {/* Row 3: Google review + Booking side by side */}
              <div style={s.formRow}>
                <Field label="Google review URL">
                  <input className="st-input" type="url" value={form.google_review_url} onChange={(e) => set('google_review_url', e.target.value)} style={s.input} placeholder="https://g.page/r/…/review" />
                </Field>
                <Field label="Booking URL">
                  <input className="st-input" type="url" value={form.booking_url} onChange={(e) => set('booking_url', e.target.value)} style={s.input} placeholder="https://yourclinic.com/book" />
                </Field>
              </div>
              {/* Row 4: Facebook + Instagram side by side */}
              <div style={s.formRow}>
                <Field label="Facebook URL" hint="'Follow us on Facebook' on wallet pass">
                  <input className="st-input" type="url" value={form.facebook_url} onChange={(e) => set('facebook_url', e.target.value)} style={s.input} placeholder="https://facebook.com/yourclinic" />
                </Field>
                <Field label="Instagram URL" hint="'Follow us on Instagram' on wallet pass">
                  <input className="st-input" type="url" value={form.instagram_url} onChange={(e) => set('instagram_url', e.target.value)} style={s.input} placeholder="https://instagram.com/yourclinic" />
                </Field>
              </div>

              {/* Row 5: Page theme */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dp-t3)', marginBottom: 10, letterSpacing: '0.01em' }}>
                  Dashboard &amp; patient page theme
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  {[
                    { value: 'auto',  label: 'Auto',  icon: '💻', desc: 'Follows device setting' },
                    { value: 'light', label: 'Light', icon: '☀️', desc: 'Clean white, soft tones' },
                    { value: 'dark',  label: 'Dark',  icon: '🌙', desc: 'Deep teal, dark panels' },
                  ].map((opt) => {
                    const active = form.theme === opt.value;
                    return (
                      <button key={opt.value} type="button" onClick={() => set('theme', opt.value)} style={{
                        flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                        borderRadius: 12, textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s',
                        border: active ? '1.5px solid rgba(59,191,185,0.4)' : '1px solid var(--dp-bdr)',
                        background: active ? 'rgba(59,191,185,0.08)' : 'var(--dp-bg)',
                      }}>
                        <span style={{ fontSize: 20 }}>{opt.icon}</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: active ? '#3bbfb9' : 'var(--dp-t2)' }}>{opt.label}</div>
                          <div style={{ fontSize: 11, color: 'var(--dp-t4)', marginTop: 1 }}>{opt.desc}</div>
                        </div>
                        {active && (
                          <span style={{ marginLeft: 'auto', width: 8, height: 8, borderRadius: '50%', background: '#3bbfb9', flexShrink: 0 }} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── WALLET ── */}
          {tab === 'wallet' && (
            <div style={s.walletGrid}>
              {/* Controls */}
              <div style={s.panel}>
                <Field label="Brand color">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input type="color" value={form.brand_color} onChange={(e) => set('brand_color', e.target.value)}
                      style={{ width: 44, height: 38, border: 'none', cursor: 'pointer', borderRadius: 8, padding: 2, background: 'none' }} />
                    <input className="st-input" value={form.brand_color} onChange={(e) => set('brand_color', e.target.value)}
                      style={{ ...s.input, maxWidth: 110 }} placeholder="#3bbfb9" />
                  </div>
                </Field>

                <Field label="Clinic logo" hint="PNG, JPG or WebP · at least 200×200px · auto-cropped to square">
                  <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" style={{ display: 'none' }} onChange={handleLogoUpload} />
                  <button type="button" className="st-upload" onClick={() => fileRef.current?.click()} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', border: '1.5px dashed rgba(255,255,255,0.12)',
                    borderRadius: 10, background: 'rgba(255,255,255,0.03)', cursor: 'pointer',
                    fontSize: 13, color: 'rgba(255,255,255,0.4)', transition: 'border-color 0.15s, background 0.15s',
                    width: '100%', boxSizing: 'border-box',
                  }}>
                    {uploading ? (
                      <span style={{ color: '#3bbfb9', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Spinner color="#3bbfb9" />Uploading…
                      </span>
                    ) : form.logo_url ? (
                      <>
                        <img src={form.logo_url} alt="logo" style={{ height: 28, maxWidth: 80, objectFit: 'contain', borderRadius: 4 }} />
                        <span style={{ color: '#3bbfb9', fontSize: 12 }}>Change logo</span>
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                        </svg>
                        Upload logo
                      </>
                    )}
                  </button>
                  {form.logo_url && (
                    <button type="button" onClick={() => set('logo_url', '')}
                      style={{ background: 'none', border: 'none', color: '#f87171', fontSize: 11, cursor: 'pointer', padding: '2px 0', textAlign: 'left' }}>
                      Remove logo
                    </button>
                  )}
                </Field>

                <Field label="Points label" hint="What to call your points on the wallet card">
                  <input className="st-input" value={form.points_label} onChange={(e) => set('points_label', e.target.value)}
                    style={s.input} placeholder="Points" maxLength={20} />
                </Field>
              </div>

              {/* Live preview */}
              <div style={s.previewCol}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.08em', marginBottom: 10 }}>LIVE PREVIEW</div>
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
          )}

          {/* ── REWARDS ── */}
          {tab === 'rewards' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* System selector */}
              <div style={s.panel}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { value: 'tiers',     label: 'Tier system',         desc: 'Patients unlock Bronze → Silver → Gold status as they accumulate points.' },
                    { value: 'discounts', label: 'Discount redemption', desc: 'Patients redeem points for dollar discounts at the front desk.' },
                  ].map((opt) => {
                    const active = form.rewards_mode === opt.value;
                    return (
                      <button key={opt.value} type="button" onClick={() => set('rewards_mode', opt.value)} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 16px',
                        borderRadius: 12, textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s',
                        border: active ? '1.5px solid rgba(59,191,185,0.4)' : '1px solid var(--dp-bdr)',
                        background: active ? 'rgba(59,191,185,0.08)' : 'var(--dp-card)',
                      }}>
                        <div style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                          border: active ? '5px solid #3bbfb9' : '2px solid var(--dp-inbdr)', background: 'transparent' }} />
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: active ? '#3bbfb9' : 'var(--dp-t2)' }}>{opt.label}</div>
                          <div style={{ fontSize: 12, color: 'var(--dp-t3)', marginTop: 2 }}>{opt.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Motivational tip */}
              <div style={{ background: 'rgba(59,191,185,0.06)', border: '1px solid rgba(59,191,185,0.2)', borderRadius: 12, padding: '14px 18px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#3bbfb9', marginBottom: 5 }}>💡 This is the most important part of your loyalty program</div>
                <div style={{ fontSize: 13, color: 'var(--dp-t2)', lineHeight: 1.65 }}>
                  The right incentives turn one-time patients into loyal advocates who drive more revenue and Google reviews. Set perks that genuinely excite your patients — exclusive discounts, free treatments, and VIP access are far more effective than generic points. Take a few minutes to customize these carefully.
                </div>
              </div>

              {/* How patients earn points */}
              <div style={s.panel}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--dp-t1)', marginBottom: 2 }}>How patients earn points</div>
                <div style={{ fontSize: 13, color: 'var(--dp-t3)', marginBottom: 16, lineHeight: 1.5 }}>Customize how many points each action earns. Staff award these from the QR scanner when patients visit.</div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { key: 'completed_visit',  label: 'Completed a visit',    icon: '🦷' },
                    { key: 'left_review',      label: 'Left a Google review',  icon: '⭐' },
                    { key: 'referred_friend',  label: 'Referred a friend',     icon: '🤝' },
                    { key: 'birthday',         label: 'Birthday bonus',        icon: '🎂' },
                  ].map(({ key, label, icon }) => (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--dp-bg)', borderRadius: 10, border: '1px solid var(--dp-bdr)' }}>
                      <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
                      <span style={{ flex: 1, fontSize: 14, color: 'var(--dp-t1)' }}>{label}</span>
                      <input
                        type="number" min="0" max="10000" step="10"
                        value={form.action_points[key] ?? ''}
                        onChange={(e) => set('action_points', { ...form.action_points, [key]: parseInt(e.target.value, 10) || 0 })}
                        style={{ ...s.input, width: 76, textAlign: 'center', padding: '6px 10px' }}
                      />
                      <span style={{ fontSize: 13, color: 'var(--dp-t3)', whiteSpace: 'nowrap' }}>pts</span>
                    </div>
                  ))}
                </div>

                {/* Custom actions */}
                <div style={{ marginTop: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--dp-t1)', marginBottom: 4 }}>Custom actions</div>
                  <div style={{ fontSize: 12, color: 'var(--dp-t3)', marginBottom: 10, lineHeight: 1.55 }}>
                    Add clinic-specific actions to incentivize the treatments you want to grow. Award these manually from the QR scanner.
                  </div>
                  <CycleText
                    examples={[
                      '"Complete a root canal session → +500 pts"',
                      '"Try our new teeth whitening treatment → +400 pts"',
                      '"Book 3 consecutive cleanings → +750 pts"',
                      '"Accept a recommended crown treatment → +500 pts"',
                      '"Complete an Invisalign consultation → +350 pts"',
                      '"Bring a family member for their first exam → +600 pts"',
                    ]}
                    style={{ fontSize: 12, color: '#3bbfb9', fontStyle: 'italic', marginBottom: 12, minHeight: 18 }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {form.custom_actions.map((action, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          type="text"
                          value={action.label}
                          onChange={(e) => {
                            const next = [...form.custom_actions];
                            next[i] = { ...next[i], label: e.target.value };
                            set('custom_actions', next);
                          }}
                          placeholder="e.g. Complete a whitening session"
                          style={{ ...s.input, flex: 1 }}
                        />
                        <input
                          type="number" min="0" max="10000" step="10"
                          value={action.points}
                          onChange={(e) => {
                            const next = [...form.custom_actions];
                            next[i] = { ...next[i], points: parseInt(e.target.value, 10) || 0 };
                            set('custom_actions', next);
                          }}
                          style={{ ...s.input, width: 76, textAlign: 'center', padding: '6px 10px' }}
                        />
                        <span style={{ fontSize: 13, color: 'var(--dp-t3)' }}>pts</span>
                        <button type="button"
                          onClick={() => set('custom_actions', form.custom_actions.filter((_, j) => j !== i))}
                          style={{ background: 'none', border: 'none', color: 'var(--dp-t4)', cursor: 'pointer', fontSize: 20, padding: '0 4px', lineHeight: 1 }}>×</button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => set('custom_actions', [...form.custom_actions, { label: '', points: 500 }])}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1.5px dashed var(--dp-bdr)', borderRadius: 10, padding: '10px 14px', cursor: 'pointer', color: 'var(--dp-t3)', fontSize: 13, fontWeight: 500 }}
                    >
                      <span style={{ fontSize: 16 }}>+</span> Add custom action
                    </button>
                  </div>
                </div>
              </div>

              {/* Tier config */}
              {form.rewards_mode === 'tiers' && (
                <div style={s.panel}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--dp-t1)', marginBottom: 2 }}>Tier rewards</div>
                  <div style={{ fontSize: 13, color: 'var(--dp-t3)', marginBottom: 20, lineHeight: 1.5 }}>Set the points needed to unlock each tier and the perks patients receive. Make these compelling enough that patients actively work to level up.</div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {[
                      { key: 'bronze', label: 'Bronze', emoji: '🥉', color: '#CD7F32', bg: 'rgba(205,127,50,0.07)', bdr: 'rgba(205,127,50,0.22)',
                        examples: ['"Priority scheduling"', '"10% off cosmetic treatments"', '"Free fluoride treatment"', '"Birthday discount card"'] },
                      { key: 'silver', label: 'Silver', emoji: '🥈', color: '#9CA3AF', bg: 'rgba(156,163,175,0.07)', bdr: 'rgba(156,163,175,0.22)',
                        examples: ['"All Bronze perks"', '"Free cleaning every 6 months"', '"15% off cosmetic treatments"', '"Priority emergency slots"'] },
                      { key: 'gold',   label: 'Gold',   emoji: '🥇', color: '#F59E0B', bg: 'rgba(245,158,11,0.07)',  bdr: 'rgba(245,158,11,0.22)',
                        examples: ['"All Silver perks"', '"Free annual whitening kit"', '"25% off all treatments"', '"VIP same-day appointments"'] },
                    ].map(({ key, label, emoji, color, bg, bdr, examples }) => (
                      <div key={key} style={{ background: bg, border: `1px solid ${bdr}`, borderRadius: 12, padding: '16px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                          <span style={{ fontSize: 22 }}>{emoji}</span>
                          <span style={{ fontSize: 15, fontWeight: 700, color, flex: 1 }}>{label}</span>
                          <input
                            type="number" min="0" step="100"
                            value={form.tier_thresholds[key] ?? 0}
                            onChange={(e) => set('tier_thresholds', { ...form.tier_thresholds, [key]: parseInt(e.target.value, 10) || 0 })}
                            disabled={key === 'bronze'}
                            style={{ ...s.input, width: 88, textAlign: 'center', padding: '6px 10px', opacity: key === 'bronze' ? 0.5 : 1 }}
                          />
                          <span style={{ fontSize: 13, color: 'var(--dp-t3)', whiteSpace: 'nowrap' }}>pts to unlock</span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {(form.tier_incentives[key] || []).map((inc, i) => (
                            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <input
                                type="text" value={inc}
                                onChange={(e) => {
                                  const next = { ...form.tier_incentives, [key]: [...(form.tier_incentives[key] || [])] };
                                  next[key][i] = e.target.value;
                                  set('tier_incentives', next);
                                }}
                                style={{ ...s.input, flex: 1 }}
                              />
                              <button type="button"
                                onClick={() => {
                                  const next = { ...form.tier_incentives, [key]: form.tier_incentives[key].filter((_, j) => j !== i) };
                                  set('tier_incentives', next);
                                }}
                                style={{ background: 'none', border: 'none', color: 'var(--dp-t4)', cursor: 'pointer', fontSize: 20, padding: '0 4px', lineHeight: 1 }}>×</button>
                            </div>
                          ))}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 2 }}>
                            <CycleText
                              examples={examples}
                              style={{ fontSize: 11, color, fontStyle: 'italic', flex: 1, minHeight: 16 }}
                            />
                            <button type="button"
                              onClick={() => set('tier_incentives', { ...form.tier_incentives, [key]: [...(form.tier_incentives[key] || []), ''] })}
                              style={{ background: 'none', border: `1.5px dashed ${bdr}`, borderRadius: 8, padding: '5px 12px', cursor: 'pointer', color, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
                              + Add perk
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Discount config */}
              {form.rewards_mode === 'discounts' && (
                <div style={s.panel}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--dp-t1)', marginBottom: 16 }}>Discount conversion rate</div>
                  <Field label="Points per dollar" hint="How many points equal $1 off at checkout">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input className="st-input" type="number" min="1" step="1" value={form.points_per_dollar}
                        onChange={(e) => set('points_per_dollar', e.target.value)}
                        style={{ ...s.input, maxWidth: 90 }} placeholder="10" />
                      <span style={{ fontSize: 13, color: 'var(--dp-t3)' }}>
                        points = $1.00
                        {form.points_per_dollar && ` · 1,000 pts = $${(1000 / parseFloat(form.points_per_dollar)).toFixed(2)}`}
                      </span>
                    </div>
                  </Field>
                </div>
              )}

            </div>
          )}

          {/* ── LINKS (no save) ── */}
          {tab === 'links' && (
            <div style={s.panel}>
              {[
                { label: 'Patient enrollment page', desc: 'Share this link (or QR code) so patients can join your loyalty program.', url: enrollLink },
                { label: 'QR scanner — staff only',  desc: 'Open on a tablet at the front desk to scan patients\' wallet cards.', url: scanLink },
              ].map((l) => (
                <div key={l.label} style={s.linkCard}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--dp-t2)', marginBottom: 2 }}>{l.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--dp-t4)', marginBottom: 8 }}>{l.desc}</div>
                    <a href={l.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: '#3bbfb9', wordBreak: 'break-all' }}>
                      {l.url}
                    </a>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => copyUrl(l.url)}
                      style={{
                        background: copiedUrl === l.url ? 'rgba(52,211,153,0.12)' : 'var(--dp-bg)',
                        border: `1px solid ${copiedUrl === l.url ? 'rgba(52,211,153,0.3)' : 'var(--dp-bdr)'}`,
                        borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 600,
                        color: copiedUrl === l.url ? '#34d399' : 'var(--dp-t2)',
                        cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
                      }}
                    >
                      {copiedUrl === l.url ? '✓ Copied' : 'Copy'}
                    </button>
                    <a href={l.url} target="_blank" rel="noopener noreferrer" style={s.openBtn}>
                      Open ↗
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── BILLING (no save) ── */}
          {tab === 'billing' && (
            <div style={s.panel}>
              <div style={s.planRow}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--dp-t1)', marginBottom: 4 }}>
                    {clinic.plan.charAt(0).toUpperCase() + clinic.plan.slice(1)} plan
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--dp-t3)' }}>
                    {clinic.patient_limit ? `Up to ${clinic.patient_limit.toLocaleString()} patients` : 'Unlimited patients'}
                  </div>
                </div>
                <button type="button" onClick={handleBillingPortal} style={s.manageBtn}>
                  Manage billing →
                </button>
              </div>
            </div>
          )}

          {/* ── ACCOUNT (no clinic save) ── */}
          {tab === 'account' && (
            <AccountTab />
          )}

        </form>
      </div>
    </>
  );
}

const s = {
  page: { display: 'flex', flexDirection: 'column', gap: 0, maxWidth: 900 },
  titleRow: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 },
  h1: {
    fontFamily: "'Instrument Serif', serif",
    fontSize: 32, fontWeight: 400, color: 'var(--dp-t1)',
    margin: 0, letterSpacing: '-0.02em',
  },
  tabBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid var(--dp-bdr)',
    marginBottom: 28,
  },
  tabList: {
    display: 'flex',
    gap: 0,
  },
  tab: {
    padding: '10px 18px',
    background: 'none', border: 'none',
    borderBottom: '2px solid transparent',
    fontSize: 14, fontWeight: 500,
    color: 'var(--dp-t3)',
    cursor: 'pointer',
    marginBottom: -1,
    transition: 'color 0.15s, border-color 0.15s',
    fontFamily: "'DM Sans', sans-serif",
  },
  tabActive: {
    color: 'var(--dp-t1)',
    borderBottomColor: '#3bbfb9',
    fontWeight: 600,
  },
  form: { display: 'flex', flexDirection: 'column', gap: 0 },
  formRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  panel: {
    display: 'flex', flexDirection: 'column', gap: 20,
    background: 'var(--dp-card)',
    borderRadius: 16,
    padding: '28px 28px',
    border: '1px solid var(--dp-bdr)',
    backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
  },
  walletGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    gap: 32,
    alignItems: 'start',
  },
  previewCol: {
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
    paddingTop: 28,
  },
  input: {
    padding: '10px 14px',
    border: '1.5px solid var(--dp-inbdr)',
    borderRadius: 10, fontSize: 14,
    outline: 'none',
    width: '100%', boxSizing: 'border-box',
    background: 'var(--dp-inp)',
    color: 'var(--dp-t1)',
    fontFamily: "'DM Sans', sans-serif",
  },
  linkCard: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16,
    padding: '18px 20px',
    background: 'var(--dp-card)',
    borderRadius: 12,
    border: '1px solid var(--dp-bdr)',
  },
  openBtn: {
    flexShrink: 0,
    background: 'rgba(59,191,185,0.1)',
    color: '#3bbfb9',
    border: '1px solid rgba(59,191,185,0.2)',
    borderRadius: 8,
    padding: '8px 14px',
    fontSize: 13, fontWeight: 600,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  },
  planRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '4px 0',
  },
  manageBtn: {
    background: 'rgba(59,191,185,0.1)', color: '#3bbfb9',
    borderRadius: 10, padding: '11px 18px', fontSize: 14, fontWeight: 600,
    border: '1px solid rgba(59,191,185,0.25)', cursor: 'pointer',
  },
  saveBtn: {
    background: '#3bbfb9', color: '#081312',
    border: 'none', borderRadius: 8,
    padding: '8px 18px',
    fontSize: 13, fontWeight: 700,
    display: 'flex', alignItems: 'center', gap: 6,
    transition: 'opacity 0.2s',
    fontFamily: "'DM Sans', sans-serif",
    marginBottom: 1,
    whiteSpace: 'nowrap',
  },
};
