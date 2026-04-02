'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { awardPoints, updatePatient, notifyPatient } from '../../../../lib/api';
import { getSupabaseBrowser } from '../../../../lib/supabase-browser';
import Spinner from '../../../../components/Spinner';

const TIER_COLOR = { bronze: '#f59e0b', silver: '#94a3b8', gold: '#eab308' };
const TIER_BG    = { bronze: 'rgba(245,158,11,0.12)', silver: 'rgba(148,163,184,0.12)', gold: 'rgba(234,179,8,0.12)' };
const TIER_BORDER = { bronze: 'rgba(245,158,11,0.25)', silver: 'rgba(148,163,184,0.25)', gold: 'rgba(234,179,8,0.25)' };

const REASON_LABEL = {
  completed_visit: 'Completed visit',
  left_review:     'Left a review',
  referred_friend: 'Referred a friend',
  recall_bonus:    'Recall bonus',
  custom:          'Custom award',
  system:          'System',
};

const REASON_COLOR = {
  completed_visit: '#3bbfb9',
  left_review:     '#fbbf24',
  referred_friend: '#a78bfa',
  recall_bonus:    '#34d399',
  custom:          '#94a3b8',
  system:          '#64748b',
};

export default function PatientProfileClient({
  patient, pointEvents, notifications, referrals, clinicId, googleReviewUrl,
}) {
  const router = useRouter();
  const [awarding, setAwarding]       = useState(false);
  const [customPts, setCustomPts]     = useState('');
  const [pts, setPts]                 = useState(patient.points_balance);
  const [tier, setTier]               = useState(patient.tier);
  const [feedback, setFeedback]       = useState('');
  const [sendingNotif, setSendingNotif] = useState(false);
  const [checkupDate, setCheckupDate] = useState(patient.next_checkup_date || '');
  const [checkupTime, setCheckupTime] = useState(patient.next_checkup_time || '');
  const [savingDate, setSavingDate]   = useState(false);

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
    } catch (err) {
      setFeedback(err?.message || 'Failed to award points.');
      setTimeout(() => setFeedback(''), 4000);
    } finally { setAwarding(false); }
  }

  async function saveCheckupDate() {
    setSavingDate(true);
    try {
      const token = await getToken();
      const data = await updatePatient(patient.id, { next_checkup_date: checkupDate || null, next_checkup_time: checkupTime || null }, token);
      if (data?.ok) {
        setFeedback('Checkup date saved!');
        setTimeout(() => setFeedback(''), 3000);
        router.refresh();
      } else {
        setFeedback(data?.error || 'Failed to save date.');
        setTimeout(() => setFeedback(''), 4000);
      }
    } catch (err) {
      setFeedback(err?.message || 'Failed to save date.');
      setTimeout(() => setFeedback(''), 4000);
    } finally { setSavingDate(false); }
  }

  async function sendManualNotification(type) {
    setSendingNotif(true);
    try {
      const token = await getToken();
      const data = await notifyPatient(patient.id, type, token);
      if (data?.ok) {
        setFeedback('Notification sent!');
        setTimeout(() => setFeedback(''), 3000);
        router.refresh();
      } else {
        setFeedback(data?.error || 'Failed to send notification.');
        setTimeout(() => setFeedback(''), 4000);
      }
    } catch (err) {
      setFeedback(err?.message || 'Failed to send notification.');
      setTimeout(() => setFeedback(''), 4000);
    } finally { setSendingNotif(false); }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://dentapass.ca';
  const referralLink = `${appUrl}/join/referral/${patient.referral_code}`;

  return (
    <>
      <style>{`
        .pp-input:focus { border-color: rgba(59,191,185,0.5) !important; box-shadow: 0 0 0 3px rgba(59,191,185,0.1); outline: none; }
        .pp-notif:hover:not(:disabled) { background: var(--dp-bdr) !important; border-color: var(--dp-inbdr) !important; }
        .pp-award:hover:not(:disabled) { filter: brightness(1.08); }
        @keyframes pp-in { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .pp-card { animation: pp-in 0.35s cubic-bezier(0.16,1,0.3,1) both; }
      `}</style>

      <div style={s.page}>
        <button onClick={() => router.back()} style={s.backBtn}>← Back to patients</button>

        {/* ── Profile header ── */}
        <div style={s.profileHeader}>
          <div style={s.avatar}>
            {patient.first_name[0]}{patient.last_name[0]}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={s.name}>{patient.first_name} {patient.last_name}</h1>
            <div style={s.meta}>
              {patient.email && <span>{patient.email}</span>}
              {patient.phone && <span>{patient.phone}</span>}
              <span>Joined {new Date(patient.created_at).toLocaleDateString('en-CA')}</span>
            </div>
          </div>
          <div style={s.statsRow}>
            <div style={s.stat}>
              <span style={{ ...s.statVal, color: '#3bbfb9' }}>{pts.toLocaleString()}</span>
              <span style={s.statLabel}>Points</span>
            </div>
            <div style={s.statDivider} />
            <div style={s.stat}>
              <span style={{ ...s.statVal, color: TIER_COLOR[tier] }}>
                {tier.charAt(0).toUpperCase() + tier.slice(1)}
              </span>
              <span style={s.statLabel}>Tier</span>
            </div>
            <div style={s.statDivider} />
            <div style={s.stat}>
              <span style={{ ...s.statVal, color: 'var(--dp-t2)' }}>{referrals.length}</span>
              <span style={s.statLabel}>Referrals</span>
            </div>
          </div>
        </div>

        {/* ── Feedback ── */}
        {feedback && (
          <div style={s.feedbackBanner}>{feedback}</div>
        )}

        {/* ── Two-column layout ── */}
        <div style={s.cols}>

          {/* Left */}
          <div style={s.col}>

            {/* Award points */}
            <div className="pp-card" style={s.card}>
              <h2 style={s.cardTitle}>Award points</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="number" min="1"
                  className="pp-input"
                  value={customPts}
                  onChange={(e) => setCustomPts(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && awardCustom()}
                  placeholder="Amount"
                  style={s.input}
                />
                <button
                  className="pp-award"
                  disabled={awarding || !customPts}
                  onClick={awardCustom}
                  style={{ ...s.btn, opacity: customPts ? 1 : 0.45 }}
                >
                  {awarding ? <Spinner color="#081312" /> : 'Award'}
                </button>
              </div>
            </div>

            {/* Next checkup */}
            <div className="pp-card" style={{ ...s.card, animationDelay: '0.05s' }}>
              <h2 style={s.cardTitle}>Next checkup</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  type="date"
                  className="pp-input"
                  value={checkupDate}
                  onChange={(e) => setCheckupDate(e.target.value)}
                  style={{ ...s.input, colorScheme: 'dark' }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="time"
                    className="pp-input"
                    value={checkupTime}
                    onChange={(e) => setCheckupTime(e.target.value)}
                    style={{ ...s.input, flex: 1, colorScheme: 'dark' }}
                  />
                  <button
                    className="pp-award"
                    disabled={savingDate}
                    onClick={saveCheckupDate}
                    style={s.btn}
                  >
                    {savingDate ? <Spinner color="#081312" /> : 'Save'}
                  </button>
                </div>
              </div>
            </div>

            {/* Notifications */}
            <div className="pp-card" style={{ ...s.card, animationDelay: '0.1s' }}>
              <h2 style={s.cardTitle}>Send notification</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  className="pp-notif"
                  disabled={sendingNotif}
                  onClick={() => sendManualNotification('recall')}
                  style={s.notifBtn}
                >
                  <span style={s.notifIcon}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                  </span>
                  Send recall reminder
                  {sendingNotif && <Spinner />}
                </button>
                {googleReviewUrl && (
                  <button
                    className="pp-notif"
                    disabled={sendingNotif}
                    onClick={() => sendManualNotification('review')}
                    style={s.notifBtn}
                  >
                    <span style={s.notifIcon}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                      </svg>
                    </span>
                    Send review request
                    {sendingNotif && <Spinner />}
                  </button>
                )}
              </div>
            </div>

            {/* Referral link */}
            <div className="pp-card" style={{ ...s.card, animationDelay: '0.15s' }}>
              <h2 style={s.cardTitle}>Referral link</h2>
              <div style={s.referralBox}>
                <span style={s.referralCode}>{referralLink}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(referralLink);
                    setFeedback('Copied!');
                    setTimeout(() => setFeedback(''), 2000);
                  }}
                  style={s.copyBtn}
                >
                  Copy
                </button>
              </div>
            </div>
          </div>

          {/* Right */}
          <div style={s.col}>

            {/* Point history */}
            <div className="pp-card" style={{ ...s.card, animationDelay: '0.06s' }}>
              <h2 style={s.cardTitle}>Point history</h2>
              {pointEvents.length === 0 ? (
                <p style={s.empty}>No point events yet.</p>
              ) : (
                <div style={s.eventList}>
                  {pointEvents.map((e, i) => (
                    <div key={e.id} style={{ ...s.eventRow, borderBottom: i < pointEvents.length - 1 ? '1px solid var(--dp-inp)' : 'none' }}>
                      <span style={{
                        ...s.reasonTag,
                        color: REASON_COLOR[e.reason] || '#94a3b8',
                        background: `${REASON_COLOR[e.reason] || '#94a3b8'}18`,
                        border: `1px solid ${REASON_COLOR[e.reason] || '#94a3b8'}28`,
                      }}>
                        {REASON_LABEL[e.reason] || e.reason}
                      </span>
                      <span style={{ ...s.eventPts, color: e.points > 0 ? '#34d399' : '#f87171' }}>
                        {e.points > 0 ? '+' : ''}{e.points}
                      </span>
                      <span style={s.eventDate}>{new Date(e.created_at).toLocaleDateString('en-CA')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Notification log */}
            <div className="pp-card" style={{ ...s.card, animationDelay: '0.12s' }}>
              <h2 style={s.cardTitle}>Notification log</h2>
              {notifications.length === 0 ? (
                <p style={s.empty}>No notifications sent yet.</p>
              ) : (
                <div style={s.eventList}>
                  {notifications.map((n, i) => (
                    <div key={n.id} style={{ ...s.eventRow, borderBottom: i < notifications.length - 1 ? '1px solid var(--dp-inp)' : 'none' }}>
                      <span style={{
                        ...s.reasonTag,
                        color: n.type === 'review' ? '#fbbf24' : '#3bbfb9',
                        background: n.type === 'review' ? 'rgba(251,191,36,0.1)' : 'rgba(59,191,185,0.1)',
                        border: n.type === 'review' ? '1px solid rgba(251,191,36,0.2)' : '1px solid rgba(59,191,185,0.2)',
                      }}>
                        {n.type === 'review' ? 'Review request' : 'Recall reminder'}
                      </span>
                      <span style={{ ...s.eventDate, marginLeft: 'auto' }}>
                        {new Date(n.sent_at).toLocaleDateString('en-CA')}
                        {n.opened_at && <span style={{ color: '#34d399', marginLeft: 6 }}>· opened</span>}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const s = {
  page: { display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1000 },
  backBtn: {
    background: 'none', border: 'none',
    color: 'var(--dp-t4)', fontSize: 13,
    cursor: 'pointer', padding: '4px 0',
    alignSelf: 'flex-start',
    transition: 'color 0.15s',
    fontFamily: "'DM Sans', sans-serif",
  },
  profileHeader: {
    background: 'var(--dp-card)',
    borderRadius: 16, padding: '22px 24px',
    border: '1px solid var(--dp-bdr)',
    backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
    display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap',
  },
  avatar: {
    width: 56, height: 56, borderRadius: '50%',
    background: 'rgba(59,191,185,0.15)', color: '#3bbfb9',
    border: '1.5px solid rgba(59,191,185,0.25)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 700, fontSize: 20, flexShrink: 0, letterSpacing: '0.02em',
  },
  name: { fontSize: 20, fontWeight: 700, color: 'var(--dp-t1)', margin: '0 0 4px', letterSpacing: '-0.01em' },
  meta: { display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13, color: 'var(--dp-t4)' },
  statsRow: { display: 'flex', alignItems: 'center', gap: 20, marginLeft: 'auto', flexWrap: 'wrap' },
  stat: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 },
  statVal: { fontSize: 22, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em' },
  statLabel: { fontSize: 10, color: 'var(--dp-t4)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 },
  statDivider: { width: 1, height: 32, background: 'var(--dp-bdr)' },
  feedbackBanner: {
    background: 'rgba(52,211,153,0.1)',
    color: '#34d399',
    border: '1px solid rgba(52,211,153,0.2)',
    borderRadius: 10, padding: '10px 16px', fontSize: 14, fontWeight: 600,
  },
  cols: { display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 16 },
  col: { display: 'flex', flexDirection: 'column', gap: 14 },
  card: {
    background: 'var(--dp-card)',
    borderRadius: 14, padding: '18px 20px',
    border: '1px solid var(--dp-bdr)',
    backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
  },
  cardTitle: {
    fontSize: 12, fontWeight: 700,
    color: 'var(--dp-t4)',
    margin: '0 0 14px',
    textTransform: 'uppercase', letterSpacing: '0.07em',
  },
  input: {
    flex: 1, padding: '10px 13px',
    border: '1.5px solid var(--dp-inbdr)',
    borderRadius: 10, fontSize: 14,
    background: 'var(--dp-inp)',
    color: 'var(--dp-t1)',
    fontFamily: "'DM Sans', sans-serif",
    transition: 'border-color 0.15s, box-shadow 0.15s',
  },
  btn: {
    background: '#3bbfb9', color: '#081312',
    border: 'none', borderRadius: 10,
    padding: '10px 16px', fontSize: 14, fontWeight: 700,
    cursor: 'pointer', whiteSpace: 'nowrap',
    display: 'flex', alignItems: 'center', gap: 6,
    transition: 'filter 0.15s, opacity 0.15s',
    fontFamily: "'DM Sans', sans-serif",
  },
  notifBtn: {
    background: 'var(--dp-card)',
    border: '1px solid var(--dp-bdr)',
    borderRadius: 10, padding: '11px 14px',
    fontSize: 14, cursor: 'pointer',
    color: 'var(--dp-t2)',
    display: 'flex', alignItems: 'center', gap: 10,
    transition: 'background 0.15s, border-color 0.15s',
    fontFamily: "'DM Sans', sans-serif",
  },
  notifIcon: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 28, height: 28, borderRadius: 8, flexShrink: 0,
    background: 'rgba(59,191,185,0.1)', color: '#3bbfb9',
    border: '1px solid rgba(59,191,185,0.2)',
  },
  referralBox: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: 'var(--dp-card)',
    borderRadius: 8, padding: '10px 12px',
    border: '1px solid var(--dp-div)',
  },
  referralCode: { fontSize: 12, color: 'var(--dp-t4)', flex: 1, wordBreak: 'break-all' },
  copyBtn: {
    background: 'rgba(59,191,185,0.12)', color: '#3bbfb9',
    border: '1px solid rgba(59,191,185,0.2)', borderRadius: 6,
    padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
    fontFamily: "'DM Sans', sans-serif",
  },
  eventList: { display: 'flex', flexDirection: 'column', gap: 0 },
  eventRow: { display: 'flex', alignItems: 'center', gap: 10, paddingTop: 10, paddingBottom: 10, fontSize: 13 },
  reasonTag: {
    fontSize: 12, fontWeight: 600, padding: '3px 9px', borderRadius: 20,
    flex: 1,
  },
  eventPts: { fontWeight: 700, fontSize: 14, minWidth: 36, textAlign: 'right' },
  eventDate: { color: 'var(--dp-t4)', fontSize: 12, whiteSpace: 'nowrap' },
  empty: { fontSize: 13, color: 'var(--dp-t4)', margin: 0 },
};
