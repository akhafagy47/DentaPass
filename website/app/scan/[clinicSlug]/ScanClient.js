'use client';

import { useState, useEffect, useRef } from 'react';
import { getPatientBySerial, awardPoints, updatePatient } from '../../../lib/api';
import { getSupabaseBrowser } from '../../../lib/supabase-browser';

const BUILTIN_META = [
  { reason: 'completed_visit',  label: 'Completed visit',    icon: '🦷' },
  { reason: 'left_review',      label: 'Left a review',      icon: '⭐' },
  { reason: 'referred_friend',  label: 'Referred a friend',  icon: '🤝' },
  { reason: 'birthday',         label: 'Birthday bonus',      icon: '🎂' },
];

const DARK = {
  pageBg:    '#0f1f1e',
  cardBg:    'rgba(255,255,255,0.05)',
  cardBdr:   'rgba(255,255,255,0.08)',
  text:      '#fff',
  textMuted: 'rgba(255,255,255,0.5)',
  textSub:   'rgba(255,255,255,0.3)',
  btnBg:     'rgba(255,255,255,0.06)',
  btnBdr:    'rgba(255,255,255,0.1)',
  btnText:   'rgba(255,255,255,0.7)',
  inputBdr:  'rgba(255,255,255,0.12)',
  headerBg:  '#0a1918',
  backBtn:   'rgba(255,255,255,0.4)',
  metaText:  'rgba(255,255,255,0.3)',
};

const LIGHT = {
  pageBg:    '#f5f9f8',
  cardBg:    '#ffffff',
  cardBdr:   'rgba(0,0,0,0.07)',
  text:      '#0b1a19',
  textMuted: 'rgba(0,0,0,0.55)',
  textSub:   'rgba(0,0,0,0.35)',
  btnBg:     '#f8faf9',
  btnBdr:    'rgba(0,0,0,0.1)',
  btnText:   'rgba(0,0,0,0.65)',
  inputBdr:  'rgba(0,0,0,0.12)',
  headerBg:  '#fff',
  backBtn:   'rgba(0,0,0,0.4)',
  metaText:  'rgba(0,0,0,0.35)',
};

const tierColor = { bronze: '#CD7F32', silver: '#9CA3AF', gold: '#F59E0B' };

export default function ScanClient({ clinicSlug, theme = 'auto', actionPoints = {}, customActions = [] }) {
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemDark(mq.matches);
    const handler = (e) => setSystemDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const resolvedTheme = theme === 'auto' ? (systemDark ? 'dark' : 'light') : theme;
  const T = resolvedTheme === 'light' ? LIGHT : DARK;

  const [mode, setMode]         = useState('scan'); // 'scan' | 'patient' | 'awarded'
  const [patient, setPatient]   = useState(null);
  const [awarding, setAwarding] = useState(false);
  const [awardResults, setAwardResults] = useState(null); // { items: [{label,points}], newBalance, tier }
  const [selected, setSelected]         = useState(new Set()); // selected action reasons
  const [customPts, setCustomPts]       = useState('');
  const [showCustom, setShowCustom]     = useState(false);
  const [deductPts, setDeductPts]       = useState('');
  const [showDeduct, setShowDeduct]     = useState(false);
  const [checkupDate, setCheckupDate]   = useState('');
  const [checkupTime, setCheckupTime]   = useState('');
  const [savingCheckup, setSavingCheckup] = useState(false);
  const [checkupSaved, setCheckupSaved]   = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [scanning, setScanning]       = useState(false);
  const [authToken, setAuthToken]     = useState(null);

  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animRef   = useRef(null);

  useEffect(() => {
    getSupabaseBrowser().auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) setAuthToken(session.access_token);
    });
  }, []);

  useEffect(() => {
    if (mode === 'scan') startCamera();
    else stopCamera();
    return () => stopCamera();
  }, [mode]);

  async function startCamera() {
    try {
      setCameraError('');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setScanning(true);
        animRef.current = requestAnimationFrame(scanFrame);
      }
    } catch (err) {
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access and reload.'
          : "Camera not available. Make sure you're on HTTPS."
      );
    }
  }

  function stopCamera() {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setScanning(false);
  }

  async function scanFrame() {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      animRef.current = requestAnimationFrame(scanFrame);
      return;
    }
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    try {
      const jsQR      = (await import('jsqr')).default;
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code      = jsQR(imageData.data, imageData.width, imageData.height);
      if (code?.data) { await handleQRCode(code.data); return; }
    } catch (err) {
      console.error('QR scan frame error:', err);
    }
    animRef.current = requestAnimationFrame(scanFrame);
  }

  async function handleQRCode(data) {
    let serial = data;
    const match = data.match(/\/([A-Za-z0-9_-]{10,})\/?$/);
    if (match) serial = match[1];
    try {
      const p = await getPatientBySerial(serial);
      setPatient(p);
      setCheckupDate(p.next_checkup_date || '');
      setCheckupTime(p.next_checkup_time || '');
      setSelected(new Set());
      setMode('patient');
    } catch (err) {
      setCameraError(err?.message || 'QR code not recognised. Try again.');
      setTimeout(() => setCameraError(''), 2500);
      animRef.current = requestAnimationFrame(scanFrame);
    }
  }

  function toggleAction(reason) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(reason) ? next.delete(reason) : next.add(reason);
      return next;
    });
  }

  async function handleAwardAll() {
    if (awarding) return;
    setAwarding(true);

    const allActions = [
      ...BUILTIN_META.map((m) => ({ ...m, points: actionPoints[m.reason] ?? 0 })),
      ...customActions.map((a) => ({ reason: a.label, label: a.label, icon: '✦', points: a.points })),
    ];
    const toAward = allActions.filter((a) => selected.has(a.reason));

    const items = [];
    let latestBalance = patient.points_balance;
    let latestTier    = patient.tier;

    for (const action of toAward) {
      try {
        const data = await awardPoints({ patientId: patient.id, reason: action.reason, awardedBy: clinicSlug }, authToken);
        latestBalance = data.newBalance;
        latestTier    = data.tier;
        items.push({ label: action.label, points: action.points });
      } catch (err) {
        setCameraError(`Failed to award "${action.label}": ${err?.message}`);
        setTimeout(() => setCameraError(''), 4000);
      }
    }

    if (showCustom && customPts) {
      const pts = parseInt(customPts, 10);
      if (pts > 0) {
        try {
          const data = await awardPoints({ patientId: patient.id, reason: 'custom', customPoints: pts, awardedBy: clinicSlug }, authToken);
          latestBalance = data.newBalance;
          latestTier    = data.tier;
          items.push({ label: 'Custom', points: pts });
        } catch (err) {
          setCameraError(`Custom award failed: ${err?.message}`);
          setTimeout(() => setCameraError(''), 4000);
        }
      }
    }

    if (showDeduct && deductPts) {
      const pts = parseInt(deductPts, 10);
      if (pts > 0) {
        try {
          const data = await awardPoints({ patientId: patient.id, reason: 'custom', customPoints: -pts, awardedBy: clinicSlug }, authToken);
          latestBalance = data.newBalance;
          latestTier    = data.tier;
          items.push({ label: 'Deduction', points: -pts });
        } catch (err) {
          setCameraError(`Deduction failed: ${err?.message}`);
          setTimeout(() => setCameraError(''), 4000);
        }
      }
    }

    if (items.length > 0) {
      setPatient((p) => ({ ...p, points_balance: latestBalance, tier: latestTier }));
      setAwardResults({ items, newBalance: latestBalance, tier: latestTier });
      setMode('awarded');
      setTimeout(() => {
        setMode('scan'); setPatient(null); setAwardResults(null);
        setSelected(new Set()); setShowCustom(false); setCustomPts('');
        setShowDeduct(false); setDeductPts('');
      }, 4000);
    }

    setAwarding(false);
  }

  async function handleSaveCheckup() {
    if (!checkupDate || savingCheckup) return;
    setSavingCheckup(true);
    try {
      await updatePatient(patient.id, {
        next_checkup_date: checkupDate,
        ...(checkupTime ? { next_checkup_time: checkupTime } : { next_checkup_time: null }),
      }, authToken);
      setPatient((p) => ({ ...p, next_checkup_date: checkupDate, next_checkup_time: checkupTime }));
      setCheckupSaved(true);
      setTimeout(() => setCheckupSaved(false), 2000);
    } catch (err) {
      setCameraError(err?.message || 'Failed to save checkup date.');
      setTimeout(() => setCameraError(''), 3000);
    }
    setSavingCheckup(false);
  }

  // ── SUCCESS ─────────────────────────────────────────────────────────────────
  if (mode === 'awarded' && awardResults) {
    const totalPts = awardResults.items.reduce((s, i) => s + i.points, 0);
    return (
      <div style={{ minHeight: '100vh', background: T.pageBg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ background: T.cardBg, border: `1px solid ${T.cardBdr}`, borderRadius: 20, padding: '32px 28px', width: '100%', maxWidth: 420, boxShadow: '0 4px 32px rgba(0,0,0,0.1)', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(52,211,153,0.12)', border: '1.5px solid rgba(52,211,153,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 28, color: '#34d399' }}>✓</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: T.text, margin: '0 0 12px' }}>
            {totalPts >= 0 ? `+${totalPts}` : totalPts} pts for {patient.first_name}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
            {awardResults.items.map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: T.textMuted, background: T.btnBg, borderRadius: 10, padding: '8px 14px' }}>
                <span>{item.label}</span>
                <span style={{ fontWeight: 700, color: item.points < 0 ? '#f87171' : '#34d399' }}>
                  {item.points > 0 ? '+' : ''}{item.points} pts
                </span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 14, color: T.textMuted, margin: '0 0 4px' }}>
            New balance: <strong style={{ color: T.text }}>{awardResults.newBalance} pts</strong>
          </p>
          <p style={{ fontSize: 13, fontWeight: 700, textTransform: 'capitalize', color: tierColor[awardResults.tier] || T.textMuted, margin: '4px 0 0' }}>{awardResults.tier} tier</p>
          <p style={{ fontSize: 13, color: T.metaText, marginTop: 16 }}>Returning to scanner…</p>
        </div>
      </div>
    );
  }

  // ── PATIENT ─────────────────────────────────────────────────────────────────
  if (mode === 'patient' && patient) {
    return (
      <div style={{ minHeight: '100vh', background: T.pageBg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ background: T.cardBg, border: `1px solid ${T.cardBdr}`, borderRadius: 20, padding: '32px 28px', width: '100%', maxWidth: 420, boxShadow: '0 4px 32px rgba(0,0,0,0.1)', textAlign: 'center', position: 'relative' }}>
          <button onClick={() => { setMode('scan'); setPatient(null); setShowCustom(false); }}
            style={{ position: 'absolute', top: 16, left: 16, background: 'none', border: 'none', fontSize: 14, color: T.backBtn, cursor: 'pointer', padding: '4px 8px' }}>
            ← Back
          </button>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(59,191,185,0.12)', border: '1.5px solid rgba(59,191,185,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontWeight: 700, fontSize: 22, color: '#3bbfb9', letterSpacing: '-0.5px' }}>
            {patient.first_name[0]}{patient.last_name[0]}
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: T.text, margin: '0 0 8px' }}>{patient.first_name} {patient.last_name}</h2>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, padding: '4px 10px', borderRadius: 20, background: 'rgba(59,191,185,0.1)', color: '#3bbfb9' }}>
              {patient.points_balance} pts
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, padding: '4px 10px', borderRadius: 20, background: 'rgba(245,158,11,0.1)', color: tierColor[patient.tier] || T.textMuted }}>
              {patient.tier.charAt(0).toUpperCase() + patient.tier.slice(1)}
            </span>
          </div>
          {/* Patient details */}
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5, textAlign: 'left' }}>
            {patient.last_visit_date && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.metaText }}>
                <span>Last visit</span>
                <span>{new Date(patient.last_visit_date).toLocaleDateString('en-CA')}</span>
              </div>
            )}
            {patient.next_checkup_date && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.metaText }}>
                <span>Next checkup</span>
                <span>
                  {new Date(patient.next_checkup_date + 'T00:00:00').toLocaleDateString('en-CA')}
                  {patient.next_checkup_time ? ` · ${patient.next_checkup_time}` : ''}
                </span>
              </div>
            )}
            {patient.date_of_birth && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.metaText }}>
                <span>Date of birth</span>
                <span>
                  {new Date(patient.date_of_birth + 'T00:00:00').toLocaleDateString('en-CA')}
                  {' '}({new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear()} yrs)
                </span>
              </div>
            )}
            {patient.phone && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.metaText }}>
                <span>Phone</span>
                <a href={`tel:${patient.phone}`} style={{ color: '#3bbfb9', textDecoration: 'none' }}>{patient.phone}</a>
              </div>
            )}
            {patient.email && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.metaText }}>
                <span>Email</span>
                <span style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{patient.email}</span>
              </div>
            )}
          </div>

          {/* Actions — multi-select */}
          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              ...BUILTIN_META.map((m) => ({ ...m, points: actionPoints[m.reason] ?? 0 })),
              ...customActions.map((a) => ({ reason: a.label, label: a.label, icon: '✦', points: a.points })),
            ].map((btn) => {
              const isSelected = selected.has(btn.reason);
              return (
                <button
                  key={btn.reason}
                  disabled={awarding}
                  onClick={() => toggleAction(btn.reason)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: isSelected ? 'rgba(52,211,153,0.08)' : T.btnBg,
                    border: `1.5px solid ${isSelected ? 'rgba(52,211,153,0.35)' : T.btnBdr}`,
                    borderRadius: 12, padding: '13px 16px', fontSize: 15,
                    cursor: 'pointer', transition: 'all 0.12s', width: '100%',
                    opacity: awarding ? 0.6 : 1, color: isSelected ? T.text : T.btnText,
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {isSelected && <span style={{ color: '#34d399', fontSize: 13, fontWeight: 700 }}>✓</span>}
                    {btn.icon} {btn.label}
                  </span>
                  <span style={{ background: 'rgba(59,191,185,0.1)', color: '#3bbfb9', fontWeight: 700, fontSize: 13, padding: '3px 10px', borderRadius: 20 }}>+{btn.points}</span>
                </button>
              );
            })}

            {/* Custom add */}
            {!showCustom ? (
              <button onClick={() => setShowCustom(true)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: T.btnBg, border: `1.5px solid ${T.btnBdr}`, borderRadius: 12, padding: '13px 16px', fontSize: 15, cursor: 'pointer', width: '100%', color: T.textSub }}>
                <span>Custom amount</span>
                <span style={{ background: 'rgba(59,191,185,0.1)', color: '#3bbfb9', fontWeight: 700, fontSize: 13, padding: '3px 10px', borderRadius: 20 }}>+?</span>
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 14, color: '#3bbfb9', fontWeight: 700, flexShrink: 0 }}>+</span>
                <input
                  type="number" min="1" max="10000"
                  value={customPts}
                  onChange={(e) => setCustomPts(e.target.value)}
                  placeholder="Custom pts"
                  style={{ flex: 1, padding: '11px 14px', border: `1.5px solid ${T.inputBdr}`, borderRadius: 10, fontSize: 15, outline: 'none', background: T.btnBg, color: T.text }}
                  autoFocus
                />
                <button onClick={() => { setShowCustom(false); setCustomPts(''); }}
                  style={{ background: 'none', border: 'none', color: T.textSub, fontSize: 18, cursor: 'pointer', padding: '0 4px' }}>×</button>
              </div>
            )}

            {/* Remove points */}
            {!showDeduct ? (
              <button onClick={() => setShowDeduct(true)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: T.btnBg, border: `1.5px solid ${T.btnBdr}`, borderRadius: 12, padding: '13px 16px', fontSize: 15, cursor: 'pointer', width: '100%', color: T.textSub }}>
                <span>Remove points</span>
                <span style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171', fontWeight: 700, fontSize: 13, padding: '3px 10px', borderRadius: 20 }}>−?</span>
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 14, color: '#f87171', fontWeight: 700, flexShrink: 0 }}>−</span>
                <input
                  type="number" min="1" max={patient.points_balance}
                  value={deductPts}
                  onChange={(e) => setDeductPts(e.target.value)}
                  placeholder={`Max ${patient.points_balance}`}
                  style={{ flex: 1, padding: '11px 14px', border: `1.5px solid rgba(248,113,113,0.3)`, borderRadius: 10, fontSize: 15, outline: 'none', background: T.btnBg, color: T.text }}
                  autoFocus
                />
                <button onClick={() => { setShowDeduct(false); setDeductPts(''); }}
                  style={{ background: 'none', border: 'none', color: T.textSub, fontSize: 18, cursor: 'pointer', padding: '0 4px' }}>×</button>
              </div>
            )}
          </div>

          {/* Award button */}
          {(selected.size > 0 || (showCustom && customPts) || (showDeduct && deductPts)) && (
            <button
              disabled={awarding}
              onClick={handleAwardAll}
              style={{
                marginTop: 14, width: '100%', background: '#3bbfb9', color: '#081312',
                border: 'none', borderRadius: 12, padding: '14px', fontSize: 16,
                fontWeight: 700, cursor: 'pointer', opacity: awarding ? 0.6 : 1,
              }}
            >
              {awarding ? 'Awarding…' : `Award${selected.size > 1 ? ` (${selected.size} actions)` : ''}`}
            </button>
          )}

          {/* Set next checkup */}
          <div style={{ marginTop: 16, borderTop: `1px solid ${T.cardBdr}`, paddingTop: 14 }}>
            <p style={{ fontSize: 12, color: T.metaText, margin: '0 0 8px', letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600 }}>Next checkup</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="date"
                value={checkupDate}
                onChange={(e) => setCheckupDate(e.target.value)}
                style={{ flex: 1, padding: '10px 12px', border: `1.5px solid ${T.inputBdr}`, borderRadius: 10, fontSize: 14, outline: 'none', background: T.btnBg, color: T.text, colorScheme: resolvedTheme }}
              />
              <input
                type="time"
                value={checkupTime}
                onChange={(e) => setCheckupTime(e.target.value)}
                style={{ width: 110, padding: '10px 12px', border: `1.5px solid ${T.inputBdr}`, borderRadius: 10, fontSize: 14, outline: 'none', background: T.btnBg, color: T.text, colorScheme: resolvedTheme }}
              />
              <button
                disabled={!checkupDate || savingCheckup}
                onClick={handleSaveCheckup}
                style={{
                  background: checkupSaved ? '#34d399' : '#3bbfb9', color: '#081312',
                  border: 'none', borderRadius: 10, padding: '10px 14px',
                  fontWeight: 600, fontSize: 14, cursor: 'pointer',
                  opacity: (!checkupDate || savingCheckup) ? 0.5 : 1,
                  transition: 'background 0.2s', flexShrink: 0,
                }}
              >
                {checkupSaved ? '✓' : savingCheckup ? '…' : 'Set'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── SCAN SCREEN (always dark — camera UI) ────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#111', display: 'flex', flexDirection: 'column', fontFamily: "'DM Sans', sans-serif", color: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 20px', background: T.headerBg, borderBottom: theme === 'light' ? '1px solid rgba(0,0,0,0.08)' : 'none' }}>
        <img src="/dentapass-logo.png" alt="DentaPass" style={{ height: 22, width: 'auto' }} />
        <span style={{ fontWeight: 700, fontSize: 16, color: theme === 'light' ? '#0b1a19' : '#fff' }}>DentaPass Scanner</span>
      </div>

      {cameraError ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32, textAlign: 'center' }}>
          <p style={{ color: '#fff' }}>{cameraError}</p>
          <button onClick={startCamera} style={{ background: '#3bbfb9', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 24px', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Retry</button>
        </div>
      ) : (
        <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
          <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover', flex: 1 }} playsInline muted autoPlay />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 220, height: 220, border: '3px solid #3bbfb9', borderRadius: 16, boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)' }} />
          </div>
          {scanning && (
            <p style={{ position: 'absolute', bottom: 40, left: 0, right: 0, textAlign: 'center', fontSize: 14, color: 'rgba(255,255,255,0.8)' }}>
              Point camera at patient's wallet card QR code
            </p>
          )}
        </div>
      )}
    </div>
  );
}
