'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateClinic, getBillingPortalUrl } from '../../../lib/api';
import { getSupabaseBrowser } from '../../../lib/supabase-browser';

export default function SettingsClient({ clinic }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: clinic.name || '',
    google_review_url: clinic.google_review_url || '',
    booking_url: clinic.booking_url || '',
    brand_color: clinic.brand_color || '#006FEE',
  });
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');

  function set(key, val) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function getToken() {
    const { data: { session } } = await getSupabaseBrowser().auth.getSession();
    return session?.access_token;
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const token = await getToken();
      await updateClinic(clinic.slug, form, token);
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://dentapass.ca';
  const enrollmentLink = `${appUrl}/join/${clinic.slug}`;
  const scanLink = `${appUrl}/scan/${clinic.slug}`;

  return (
    <div style={s.page}>
      <h1 style={s.h1}>Settings</h1>

      <form onSubmit={handleSave} style={s.form}>
        <div style={s.section}>
          <h2 style={s.sectionTitle}>Clinic details</h2>
          <div style={s.fields}>
            <div style={s.field}>
              <label style={s.label}>Clinic name</label>
              <input
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                style={s.input}
                required
              />
            </div>
            <div style={s.field}>
              <label style={s.label}>Google review URL</label>
              <input
                type="url"
                value={form.google_review_url}
                onChange={(e) => set('google_review_url', e.target.value)}
                style={s.input}
                placeholder="https://g.page/r/your-clinic/review"
              />
            </div>
            <div style={s.field}>
              <label style={s.label}>Booking URL</label>
              <input
                type="url"
                value={form.booking_url}
                onChange={(e) => set('booking_url', e.target.value)}
                style={s.input}
                placeholder="https://yourClinic.com/book"
              />
            </div>
            <div style={s.field}>
              <label style={s.label}>Brand color</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="color"
                  value={form.brand_color}
                  onChange={(e) => set('brand_color', e.target.value)}
                  style={{ width: 48, height: 40, border: 'none', cursor: 'pointer', borderRadius: 8, padding: 2 }}
                />
                <input
                  value={form.brand_color}
                  onChange={(e) => set('brand_color', e.target.value)}
                  style={{ ...s.input, maxWidth: 120 }}
                  placeholder="#006FEE"
                />
              </div>
            </div>
          </div>
        </div>

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

      <div style={s.section}>
        <h2 style={s.sectionTitle}>Your links</h2>
        <div style={s.linkRow}>
          <span style={s.linkLabel}>Enrollment QR page</span>
          <a href={enrollmentLink} target="_blank" rel="noopener noreferrer" style={s.link}>
            {enrollmentLink}
          </a>
        </div>
        <div style={s.linkRow}>
          <span style={s.linkLabel}>QR Scanner (staff)</span>
          <a href={scanLink} target="_blank" rel="noopener noreferrer" style={s.link}>
            {scanLink}
          </a>
        </div>
      </div>

      <div style={s.section}>
        <h2 style={s.sectionTitle}>Plan & billing</h2>
        <div style={s.planCard}>
          <div>
            <div style={s.planName}>
              {clinic.plan.charAt(0).toUpperCase() + clinic.plan.slice(1)} plan
            </div>
            <div style={s.planMeta}>
              {clinic.patient_limit ? `Up to ${clinic.patient_limit} patients` : 'Unlimited patients'}
            </div>
          </div>
          <button onClick={handleBillingPortal} style={s.manageBtn}>
            Manage billing →
          </button>
        </div>
      </div>
    </div>
  );
}

const s = {
  page: { display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 640 },
  h1: { fontSize: 24, fontWeight: 700, color: '#111', margin: 0 },
  form: { display: 'flex', flexDirection: 'column', gap: 24 },
  section: {
    background: '#fff', borderRadius: 16, padding: '24px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    display: 'flex', flexDirection: 'column', gap: 16,
  },
  sectionTitle: { fontSize: 15, fontWeight: 700, color: '#374151', margin: 0 },
  fields: { display: 'flex', flexDirection: 'column', gap: 14 },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: { fontSize: 13, fontWeight: 600, color: '#374151' },
  input: {
    padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10,
    fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box',
  },
  saveBtn: {
    background: '#006FEE', color: '#fff', border: 'none', borderRadius: 12,
    padding: '13px', fontSize: 15, fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start',
    minWidth: 160,
  },
  linkRow: {
    display: 'flex', flexDirection: 'column', gap: 2,
    paddingBottom: 12, borderBottom: '1px solid #f1f5f9',
  },
  linkLabel: { fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' },
  link: { fontSize: 14, color: '#006FEE', wordBreak: 'break-all' },
  planCard: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: '#f8fafc', borderRadius: 10, padding: '16px',
  },
  planName: { fontWeight: 700, fontSize: 16, color: '#111' },
  planMeta: { fontSize: 13, color: '#64748b', marginTop: 2 },
  manageBtn: {
    background: '#006FEE', color: '#fff', borderRadius: 10,
    padding: '10px 16px', fontSize: 14, fontWeight: 600, textDecoration: 'none',
  },
};
