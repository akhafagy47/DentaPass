'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { awardPoints, updatePatient, notifyPatient } from '../../../../lib/api';
import { getSupabaseBrowser } from '../../../../lib/supabase-browser';

const TIER_COLOR = { bronze: '#CD7F32', silver: '#9CA3AF', gold: '#F59E0B' };
const REASON_LABEL = {
  completed_visit: '🦷 Completed visit',
  left_review: '⭐ Left a review',
  referred_friend: '🤝 Referred a friend',
  recall_bonus: '📅 Recall bonus',
  custom: '✏️ Custom',
  system: '⚙️ System',
};

export default function PatientProfileClient({
  patient, pointEvents, notifications, referrals, clinicId, googleReviewUrl,
}) {
  const router = useRouter();
  const [awarding, setAwarding] = useState(false);
  const [customPts, setCustomPts] = useState('');
  const [pts, setPts] = useState(patient.points_balance);
  const [tier, setTier] = useState(patient.tier);
  const [feedback, setFeedback] = useState('');
  const [sendingNotif, setSendingNotif] = useState(false);
  const [checkupDate, setCheckupDate] = useState(patient.next_checkup_date || '');
  const [savingDate, setSavingDate] = useState(false);

  async function getToken() {
    const { data: { session } } = await getSupabaseBrowser().auth.getSession();
    return session?.access_token;
  }

  async function awardCustom() {
    const amount = parseInt(customPts, 10);
    if (!amount || amount <= 0) return;
    setAwarding(true);
    try {
      const token = await getToken();
      const data = await awardPoints({ patientId: patient.id, reason: 'custom', customPoints: amount, awardedBy: 'dashboard' }, token);
      if (data.ok) {
        setPts(data.newBalance);
        setTier(data.tier);
        setCustomPts('');
        setFeedback(`+${amount} points awarded!`);
        setTimeout(() => setFeedback(''), 3000);
        router.refresh();
      }
    } catch {} finally { setAwarding(false); }
  }

  async function saveCheckupDate() {
    setSavingDate(true);
    try {
      const token = await getToken();
      await updatePatient(patient.id, { next_checkup_date: checkupDate || null }, token);
      router.refresh();
    } catch {} finally { setSavingDate(false); }
  }

  async function sendManualNotification(type) {
    setSendingNotif(true);
    try {
      const token = await getToken();
      await notifyPatient(patient.id, type, token);
      setFeedback('Notification sent!');
      setTimeout(() => setFeedback(''), 3000);
      router.refresh();
    } catch {} finally { setSendingNotif(false); }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://dentapass.ca';
  const referralLink = `${appUrl}/join/referral/${patient.referral_code}`;

  return (
    <div style={s.page}>
      <button onClick={() => router.back()} style={s.backBtn}>← Back to patients</button>

      {/* Header */}
      <div style={s.profileHeader}>
        <div style={s.avatar}>
          {patient.first_name[0]}{patient.last_name[0]}
        </div>
        <div>
          <h1 style={s.name}>{patient.first_name} {patient.last_name}</h1>
          <div style={s.meta}>
            {patient.email && <span>{patient.email}</span>}
            {patient.phone && <span>{patient.phone}</span>}
            <span>Joined {new Date(patient.created_at).toLocaleDateString('en-CA')}</span>
          </div>
        </div>
        <div style={s.statsRow}>
          <div style={s.stat}>
            <span style={{ ...s.statVal, color: '#006FEE' }}>{pts}</span>
            <span style={s.statLabel}>Points</span>
          </div>
          <div style={s.stat}>
            <span style={{ ...s.statVal, color: TIER_COLOR[tier] }}>
              {tier.charAt(0).toUpperCase() + tier.slice(1)}
            </span>
            <span style={s.statLabel}>Tier</span>
          </div>
          <div style={s.stat}>
            <span style={s.statVal}>{referrals.length}</span>
            <span style={s.statLabel}>Referrals</span>
          </div>
        </div>
      </div>

      {feedback && <div style={s.feedbackBanner}>{feedback}</div>}

      <div style={s.cols}>
        {/* Left column */}
        <div style={s.colLeft}>
          {/* Award points */}
          <div style={s.card}>
            <h2 style={s.cardTitle}>Award points</h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="number"
                min="1"
                value={customPts}
                onChange={(e) => setCustomPts(e.target.value)}
                placeholder="Amount"
                style={s.input}
              />
              <button
                disabled={awarding || !customPts}
                onClick={awardCustom}
                style={s.btn}
              >
                Award
              </button>
            </div>
          </div>

          {/* Next checkup */}
          <div style={s.card}>
            <h2 style={s.cardTitle}>Next checkup date</h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="date"
                value={checkupDate}
                onChange={(e) => setCheckupDate(e.target.value)}
                style={s.input}
              />
              <button disabled={savingDate} onClick={saveCheckupDate} style={s.btn}>
                Save
              </button>
            </div>
          </div>

          {/* Notifications */}
          <div style={s.card}>
            <h2 style={s.cardTitle}>Send notification</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                disabled={sendingNotif}
                onClick={() => sendManualNotification('recall')}
                style={s.notifBtn}
              >
                📅 Send recall reminder
              </button>
              {googleReviewUrl && (
                <button
                  disabled={sendingNotif}
                  onClick={() => sendManualNotification('review')}
                  style={s.notifBtn}
                >
                  ⭐ Send review request
                </button>
              )}
            </div>
          </div>

          {/* Referral link */}
          <div style={s.card}>
            <h2 style={s.cardTitle}>Referral link</h2>
            <div style={s.referralLink}>
              <span style={s.referralCode}>{referralLink}</span>
              <button
                onClick={() => { navigator.clipboard.writeText(referralLink); setFeedback('Copied!'); setTimeout(() => setFeedback(''), 2000); }}
                style={s.copyBtn}
              >
                Copy
              </button>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div style={s.colRight}>
          {/* Point history */}
          <div style={s.card}>
            <h2 style={s.cardTitle}>Point history</h2>
            {pointEvents.length === 0 ? (
              <p style={s.empty}>No point events yet.</p>
            ) : (
              <div style={s.eventList}>
                {pointEvents.map((e) => (
                  <div key={e.id} style={s.eventRow}>
                    <span style={s.eventReason}>{REASON_LABEL[e.reason] || e.reason}</span>
                    <span style={{ ...s.eventPts, color: e.points > 0 ? '#16a34a' : '#dc2626' }}>
                      {e.points > 0 ? '+' : ''}{e.points}
                    </span>
                    <span style={s.eventDate}>{new Date(e.created_at).toLocaleDateString('en-CA')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notification log */}
          <div style={s.card}>
            <h2 style={s.cardTitle}>Notification log</h2>
            {notifications.length === 0 ? (
              <p style={s.empty}>No notifications sent yet.</p>
            ) : (
              <div style={s.eventList}>
                {notifications.map((n) => (
                  <div key={n.id} style={s.eventRow}>
                    <span style={s.eventReason}>{n.type}</span>
                    <span style={{ ...s.eventDate, flex: 1, textAlign: 'right' }}>
                      {new Date(n.sent_at).toLocaleDateString('en-CA')}
                      {n.opened_at && ' · opened'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const s = {
  page: { display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1000 },
  backBtn: { background: 'none', border: 'none', color: '#64748b', fontSize: 14, cursor: 'pointer', padding: '4px 0', alignSelf: 'flex-start' },
  profileHeader: {
    background: '#fff', borderRadius: 16, padding: '24px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
  },
  avatar: {
    width: 60, height: 60, borderRadius: '50%', background: '#eff6ff', color: '#006FEE',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 700, fontSize: 22, flexShrink: 0,
  },
  name: { fontSize: 22, fontWeight: 700, color: '#111', margin: 0 },
  meta: { display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 13, color: '#64748b', marginTop: 4 },
  statsRow: { display: 'flex', gap: 24, marginLeft: 'auto', flexWrap: 'wrap' },
  stat: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 },
  statVal: { fontSize: 24, fontWeight: 800, color: '#111' },
  statLabel: { fontSize: 12, color: '#94a3b8', textTransform: 'uppercase' },
  feedbackBanner: {
    background: '#dcfce7', color: '#16a34a', borderRadius: 10,
    padding: '10px 16px', fontSize: 14, fontWeight: 600,
  },
  cols: { display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 20 },
  colLeft: { display: 'flex', flexDirection: 'column', gap: 16 },
  colRight: { display: 'flex', flexDirection: 'column', gap: 16 },
  card: {
    background: '#fff', borderRadius: 16, padding: '20px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  cardTitle: { fontSize: 14, fontWeight: 700, color: '#374151', margin: '0 0 12px' },
  input: {
    flex: 1, padding: '10px 14px', border: '1.5px solid #e2e8f0',
    borderRadius: 10, fontSize: 14, outline: 'none',
  },
  btn: {
    background: '#006FEE', color: '#fff', border: 'none', borderRadius: 10,
    padding: '10px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  notifBtn: {
    background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 10,
    padding: '10px 14px', fontSize: 14, cursor: 'pointer', textAlign: 'left',
  },
  referralLink: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: '#f8fafc', borderRadius: 8, padding: '8px 12px',
  },
  referralCode: { fontSize: 12, color: '#64748b', flex: 1, wordBreak: 'break-all' },
  copyBtn: {
    background: '#eff6ff', color: '#006FEE', border: 'none', borderRadius: 6,
    padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
  },
  eventList: { display: 'flex', flexDirection: 'column', gap: 8 },
  eventRow: {
    display: 'flex', alignItems: 'center', gap: 8,
    borderBottom: '1px solid #f1f5f9', paddingBottom: 8, fontSize: 13,
  },
  eventReason: { flex: 1, color: '#374151' },
  eventPts: { fontWeight: 700, minWidth: 40 },
  eventDate: { color: '#94a3b8', fontSize: 12 },
  empty: { fontSize: 13, color: '#94a3b8' },
};
