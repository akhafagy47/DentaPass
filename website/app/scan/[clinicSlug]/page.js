'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { getPatientBySerial, awardPoints } from '../../../lib/api';

const POINT_BUTTONS = [
  { label: 'Completed visit', reason: 'completed_visit', points: 100, icon: '🦷' },
  { label: 'Left a review', reason: 'left_review', points: 100, icon: '⭐' },
  { label: 'Referred a friend', reason: 'referred_friend', points: 250, icon: '🤝' },
];

export default function ScanPage() {
  const { clinicSlug } = useParams();

  const [mode, setMode] = useState('scan'); // 'scan' | 'patient' | 'awarded'
  const [patient, setPatient] = useState(null);
  const [awarding, setAwarding] = useState(null);
  const [awardResult, setAwardResult] = useState(null);
  const [customPts, setCustomPts] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [scanning, setScanning] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    if (mode === 'scan') {
      startCamera();
    } else {
      stopCamera();
    }
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
          : 'Camera not available. Make sure you\'re on HTTPS.'
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
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      animRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    try {
      // Dynamic import jsQR so it doesn't block initial render
      const jsQR = (await import('jsqr')).default;
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      if (code?.data) {
        await handleQRCode(code.data);
        return; // Stop scanning after a hit
      }
    } catch {}

    animRef.current = requestAnimationFrame(scanFrame);
  }

  async function handleQRCode(data) {
    // PassKit QR data is typically the serial number or a URL containing it
    // Extract serial from URL if needed
    let serial = data;
    const match = data.match(/\/([A-Za-z0-9_-]{10,})\/?$/);
    if (match) serial = match[1];

    try {
      const p = await getPatientBySerial(serial);
      setPatient(p);
      setMode('patient');
    } catch {
      // Not a valid DentaPass card — keep scanning
      animRef.current = requestAnimationFrame(scanFrame);
    }
  }

  async function awardPoints(reason, customAmount) {
    if (awarding) return;
    setAwarding(reason);

    try {
      const data = await awardPoints({
        patientId: patient.id,
        reason,
        customPoints: customAmount,
        awardedBy: clinicSlug,
      });

      if (data.ok) {
        setAwardResult(data);
        setPatient((p) => ({ ...p, points_balance: data.newBalance, tier: data.tier }));
        setMode('awarded');

        // Auto-return to scan after 3 seconds
        setTimeout(() => {
          setMode('scan');
          setPatient(null);
          setAwardResult(null);
          setShowCustom(false);
          setCustomPts('');
        }, 3000);
      }
    } catch {}

    setAwarding(null);
  }

  const tierColor = { bronze: '#CD7F32', silver: '#9CA3AF', gold: '#F59E0B' };

  // ── SUCCESS SCREEN ──────────────────────────────────────────────────────────
  if (mode === 'awarded' && awardResult) {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <div style={{ ...s.circle, background: '#dcfce7', color: '#16a34a', fontSize: 36 }}>✓</div>
          <h2 style={s.h2}>+{awardResult.pointsAwarded} pts sent!</h2>
          <p style={s.sub}>
            {patient.first_name}'s new balance:{' '}
            <strong>{awardResult.newBalance}</strong> pts
          </p>
          <p style={{ ...s.tier, color: tierColor[awardResult.tier] || '#333' }}>
            {awardResult.tier.charAt(0).toUpperCase() + awardResult.tier.slice(1)} tier
          </p>
          <p style={s.auto}>Returning to scanner…</p>
        </div>
      </div>
    );
  }

  // ── PATIENT SCREEN ──────────────────────────────────────────────────────────
  if (mode === 'patient' && patient) {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <button onClick={() => { setMode('scan'); setPatient(null); setShowCustom(false); }} style={s.backBtn}>
            ← Back
          </button>
          <div style={{ ...s.circle, background: '#eff6ff', color: '#006FEE', fontSize: 24 }}>
            {patient.first_name[0]}{patient.last_name[0]}
          </div>
          <h2 style={s.h2}>{patient.first_name} {patient.last_name}</h2>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 8 }}>
            <span style={{ ...s.badge, background: '#eff6ff', color: '#006FEE' }}>
              {patient.points_balance} pts
            </span>
            <span style={{ ...s.badge, color: tierColor[patient.tier] || '#333', background: '#fef9f0' }}>
              {patient.tier.charAt(0).toUpperCase() + patient.tier.slice(1)}
            </span>
          </div>
          {patient.last_visit_date && (
            <p style={s.meta}>
              Last visit: {new Date(patient.last_visit_date).toLocaleDateString('en-CA')}
            </p>
          )}

          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {POINT_BUTTONS.map((btn) => (
              <button
                key={btn.reason}
                disabled={!!awarding}
                onClick={() => awardPoints(btn.reason)}
                style={{
                  ...s.ptBtn,
                  opacity: awarding ? 0.6 : 1,
                  background: awarding === btn.reason ? '#dcfce7' : '#f8fafc',
                }}
              >
                <span>{btn.icon} {btn.label}</span>
                <span style={s.ptsBadge}>+{btn.points}</span>
              </button>
            ))}

            {!showCustom ? (
              <button onClick={() => setShowCustom(true)} style={{ ...s.ptBtn, color: '#64748b' }}>
                <span>Custom amount</span>
                <span style={s.ptsBadge}>+?</span>
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={customPts}
                  onChange={(e) => setCustomPts(e.target.value)}
                  placeholder="Points"
                  style={s.customInput}
                  autoFocus
                />
                <button
                  disabled={!customPts || awarding}
                  onClick={() => awardPoints('custom', customPts)}
                  style={s.customSubmit}
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

  // ── SCAN SCREEN ─────────────────────────────────────────────────────────────
  return (
    <div style={s.scanPage}>
      <div style={s.header}>
        <span style={s.logo}>🦷</span>
        <span style={s.headerText}>DentaPass Scanner</span>
      </div>

      {cameraError ? (
        <div style={s.errorBox}>
          <p>{cameraError}</p>
          <button onClick={startCamera} style={s.retryBtn}>Retry</button>
        </div>
      ) : (
        <div style={s.viewfinder}>
          <video
            ref={videoRef}
            style={s.video}
            playsInline
            muted
            autoPlay
          />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          <div style={s.overlay}>
            <div style={s.scanBox} />
          </div>
          {scanning && <p style={s.hint}>Point camera at patient's wallet card QR code</p>}
        </div>
      )}
    </div>
  );
}

const s = {
  page: {
    minHeight: '100vh',
    background: '#f8fafc',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    fontFamily: "'DM Sans', sans-serif",
  },
  scanPage: {
    minHeight: '100vh',
    background: '#111',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'DM Sans', sans-serif",
    color: '#fff',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '16px 20px',
    background: '#1a1a1a',
  },
  logo: { fontSize: 22 },
  headerText: { fontWeight: 700, fontSize: 16 },
  viewfinder: { flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' },
  video: { width: '100%', height: '100%', objectFit: 'cover', flex: 1 },
  overlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanBox: {
    width: 220,
    height: 220,
    border: '3px solid #006FEE',
    borderRadius: 16,
    boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
  },
  hint: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  errorBox: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 32,
    textAlign: 'center',
  },
  retryBtn: {
    background: '#006FEE',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '12px 24px',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
  },
  card: {
    background: '#fff',
    borderRadius: 20,
    padding: '32px 28px',
    width: '100%',
    maxWidth: 420,
    boxShadow: '0 4px 32px rgba(0,0,0,0.1)',
    textAlign: 'center',
    position: 'relative',
  },
  backBtn: {
    position: 'absolute',
    top: 16,
    left: 16,
    background: 'none',
    border: 'none',
    fontSize: 14,
    color: '#64748b',
    cursor: 'pointer',
    padding: '4px 8px',
  },
  circle: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 12px',
    fontWeight: 700,
    fontSize: 22,
    letterSpacing: '-0.5px',
  },
  h2: { fontSize: 24, fontWeight: 700, color: '#111', margin: '0 0 8px' },
  sub: { fontSize: 15, color: '#555', margin: '0 0 4px' },
  tier: { fontSize: 14, fontWeight: 700, textTransform: 'capitalize', margin: '0 0 4px' },
  meta: { fontSize: 13, color: '#94a3b8', margin: 0 },
  badge: {
    fontSize: 13,
    fontWeight: 600,
    padding: '4px 10px',
    borderRadius: 20,
  },
  ptBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#f8fafc',
    border: '1.5px solid #e2e8f0',
    borderRadius: 12,
    padding: '14px 16px',
    fontSize: 15,
    cursor: 'pointer',
    transition: 'background 0.15s',
    width: '100%',
  },
  ptsBadge: {
    background: '#eff6ff',
    color: '#006FEE',
    fontWeight: 700,
    fontSize: 13,
    padding: '3px 10px',
    borderRadius: 20,
  },
  customInput: {
    flex: 1,
    padding: '12px 14px',
    border: '1.5px solid #e2e8f0',
    borderRadius: 10,
    fontSize: 15,
    outline: 'none',
  },
  customSubmit: {
    background: '#006FEE',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '12px 18px',
    fontWeight: 600,
    fontSize: 15,
    cursor: 'pointer',
  },
  auto: { fontSize: 13, color: '#94a3b8', marginTop: 16 },
};
