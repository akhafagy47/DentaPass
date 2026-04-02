'use client';

import { useState, useEffect, useRef } from 'react';
import { getPatientBySerial, awardPoints } from '../../../lib/api';
import { getSupabaseBrowser } from '../../../lib/supabase-browser';

const POINT_BUTTONS = [
  { label: 'Completed visit', reason: 'completed_visit', points: 100, icon: '🦷' },
  { label: 'Left a review',   reason: 'left_review',     points: 100, icon: '⭐' },
  { label: 'Referred a friend', reason: 'referred_friend', points: 250, icon: '🤝' },
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

export default function ScanClient({ clinicSlug, theme = 'dark' }) {
  const T = theme === 'light' ? LIGHT : DARK;

  const [mode, setMode]         = useState('scan'); // 'scan' | 'patient' | 'awarded'
  const [patient, setPatient]   = useState(null);
  const [awarding, setAwarding] = useState(null);
  const [awardResult, setAwardResult] = useState(null);
  const [customPts, setCustomPts]     = useState('');
  const [showCustom, setShowCustom]   = useState(false);
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
    } catch {}
    animRef.current = requestAnimationFrame(scanFrame);
  }

  async function handleQRCode(data) {
    let serial = data;
    const match = data.match(/\/([A-Za-z0-9_-]{10,})\/?$/);
    if (match) serial = match[1];
    try {
      const p = await getPatientBySerial(serial);
      setPatient(p);
      setMode('patient');
    } catch {
      animRef.current = requestAnimationFrame(scanFrame);
    }
  }

  async function handleAwardPoints(reason, customAmount) {
    if (awarding) return;
    setAwarding(reason);
    try {
      const data = await awardPoints({ patientId: patient.id, reason, customPoints: customAmount, awardedBy: clinicSlug }, authToken);
      if (data.ok) {
        setAwardResult(data);
        setPatient((p) => ({ ...p, points_balance: data.newBalance, tier: data.tier }));
        setMode('awarded');
        setTimeout(() => {
          setMode('scan'); setPatient(null); setAwardResult(null);
          setShowCustom(false); setCustomPts('');
        }, 3000);
      }
    } catch {}
    setAwarding(null);
  }

  // ── SUCCESS ─────────────────────────────────────────────────────────────────
  if (mode === 'awarded' && awardResult) {
    return (
      <div style={{ minHeight: '100vh', background: T.pageBg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ background: T.cardBg, border: `1px solid ${T.cardBdr}`, borderRadius: 20, padding: '32px 28px', width: '100%', maxWidth: 420, boxShadow: '0 4px 32px rgba(0,0,0,0.1)', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(52,211,153,0.12)', border: '1.5px solid rgba(52,211,153,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 28, color: '#34d399' }}>✓</div>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: T.text, margin: '0 0 8px' }}>+{awardResult.pointsAwarded} pts sent!</h2>
          <p style={{ fontSize: 15, color: T.textMuted, margin: '0 0 4px' }}>
            {patient.first_name}'s new balance: <strong>{awardResult.newBalance}</strong> pts
          </p>
          <p style={{ fontSize: 14, fontWeight: 700, textTransform: 'capitalize', color: tierColor[awardResult.tier] || T.textMuted }}>{awardResult.tier} tier</p>
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
          {patient.last_visit_date && (
            <p style={{ fontSize: 13, color: T.metaText, margin: 0 }}>
              Last visit: {new Date(patient.last_visit_date).toLocaleDateString('en-CA')}
            </p>
          )}

          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {POINT_BUTTONS.map((btn) => (
              <button
                key={btn.reason}
                disabled={!!awarding}
                onClick={() => handleAwardPoints(btn.reason)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: awarding === btn.reason ? 'rgba(52,211,153,0.1)' : T.btnBg,
                  border: `1.5px solid ${T.btnBdr}`,
                  borderRadius: 12, padding: '14px 16px', fontSize: 15,
                  cursor: 'pointer', transition: 'background 0.15s', width: '100%',
                  opacity: awarding ? 0.6 : 1, color: T.btnText,
                }}
              >
                <span>{btn.icon} {btn.label}</span>
                <span style={{ background: 'rgba(59,191,185,0.1)', color: '#3bbfb9', fontWeight: 700, fontSize: 13, padding: '3px 10px', borderRadius: 20 }}>+{btn.points}</span>
              </button>
            ))}

            {!showCustom ? (
              <button onClick={() => setShowCustom(true)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: T.btnBg, border: `1.5px solid ${T.btnBdr}`, borderRadius: 12, padding: '14px 16px', fontSize: 15, cursor: 'pointer', width: '100%', color: T.textSub }}>
                <span>Custom amount</span>
                <span style={{ background: 'rgba(59,191,185,0.1)', color: '#3bbfb9', fontWeight: 700, fontSize: 13, padding: '3px 10px', borderRadius: 20 }}>+?</span>
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="number" min="1" max="10000"
                  value={customPts}
                  onChange={(e) => setCustomPts(e.target.value)}
                  placeholder="Points"
                  style={{ flex: 1, padding: '12px 14px', border: `1.5px solid ${T.inputBdr}`, borderRadius: 10, fontSize: 15, outline: 'none', background: T.btnBg, color: T.text }}
                  autoFocus
                />
                <button
                  disabled={!customPts || awarding}
                  onClick={() => handleAwardPoints('custom', customPts)}
                  style={{ background: '#3bbfb9', color: '#081312', border: 'none', borderRadius: 10, padding: '12px 18px', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}
                >
                  Award
                </button>
              </div>
            )}
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
