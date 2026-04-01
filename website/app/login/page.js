'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getSupabaseBrowser } from '../../lib/supabase-browser';
import Spinner from '../../components/Spinner';

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/dashboard';
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const supabase = getSupabaseBrowser();
    const { error: authErr } = await supabase.auth.signInWithPassword({ email, password });
    if (authErr) { setError(authErr.message); setLoading(false); return; }
    window.location.href = next;
  }

  return (
    <>
      <style>{`
        @keyframes floatOrbA {
          0%,100% { transform: translate(0,0) scale(1); }
          40% { transform: translate(40px,-50px) scale(1.06); }
          70% { transform: translate(-25px,25px) scale(0.96); }
        }
        @keyframes floatOrbB {
          0%,100% { transform: translate(0,0) scale(1); }
          35% { transform: translate(-35px,45px) scale(1.04); }
          65% { transform: translate(30px,-20px) scale(0.97); }
        }
        @keyframes cardIn {
          from { opacity:0; transform:translateY(32px) scale(0.97); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
        @keyframes logoIn {
          from { opacity:0; transform:translateY(-12px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .dp-login-card { animation: cardIn 0.75s cubic-bezier(0.16,1,0.3,1) both; }
        .dp-login-logo { animation: logoIn 0.6s cubic-bezier(0.16,1,0.3,1) 0.1s both; }
        .dp-orb-a { animation: floatOrbA 16s ease-in-out infinite; }
        .dp-orb-b { animation: floatOrbB 22s ease-in-out infinite; }
        .dp-login-input { transition: border-color 0.2s, box-shadow 0.2s, background 0.2s; }
        .dp-login-input:focus {
          border-color: rgba(59,191,185,0.55) !important;
          box-shadow: 0 0 0 3px rgba(59,191,185,0.1) !important;
          background: rgba(59,191,185,0.05) !important;
          outline: none;
        }
        .dp-login-input::placeholder { color: rgba(255,255,255,0.2); }
        .dp-login-btn { transition: transform 0.2s, box-shadow 0.2s; }
        .dp-login-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 16px 40px rgba(59,191,185,0.4) !important; }
        .dp-login-btn:active:not(:disabled) { transform: translateY(0); }
      `}</style>

      <div style={s.page}>
        <div className="dp-orb-a" style={s.orbA} />
        <div className="dp-orb-b" style={s.orbB} />
        <div style={s.grain} />

        <div className="dp-login-card" style={s.card}>
          <div className="dp-login-logo" style={s.logoWrap}>
            <img src="/dentapass-logo.png" alt="DentaPass" style={{ height: 52, width: 'auto' }} />
          </div>

          <h1 style={s.h1}>Welcome back</h1>
          <p style={s.sub}>Sign in to your clinic dashboard</p>

          <form onSubmit={handleSubmit} style={s.form}>
            <div style={s.field}>
              <label style={s.label}>Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="dp-login-input"
                style={s.input}
                placeholder="owner@yourclinic.com"
                autoComplete="email"
              />
            </div>
            <div style={s.field}>
              <label style={s.label}>Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="dp-login-input"
                style={s.input}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            {error && <p style={s.errText}>{error}</p>}

            <button type="submit" disabled={loading} className="dp-login-btn" style={s.btn}>
              {loading && <Spinner />}
              {loading ? 'Signing in…' : 'Sign in →'}
            </button>
          </form>

          <div style={s.divider} />
          <p style={s.fine}>
            Don't have an account?{' '}
            <a href="/#waitlist" style={s.link}>Join the waitlist</a>
          </p>
        </div>
      </div>
    </>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}

const s = {
  page: {
    minHeight: '100vh',
    background: '#0b1a19',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
    fontFamily: "'DM Sans', sans-serif",
    position: 'relative',
    overflow: 'hidden',
  },
  orbA: {
    position: 'absolute',
    top: '-20%',
    right: '-10%',
    width: 700,
    height: 700,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(59,191,185,0.18) 0%, transparent 65%)',
    pointerEvents: 'none',
  },
  orbB: {
    position: 'absolute',
    bottom: '-25%',
    left: '-12%',
    width: 600,
    height: 600,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(245,240,234,0.07) 0%, transparent 65%)',
    pointerEvents: 'none',
  },
  grain: {
    position: 'absolute',
    inset: 0,
    backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' opacity=\'0.03\'/%3E%3C/svg%3E")',
    pointerEvents: 'none',
    opacity: 0.4,
  },
  card: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(59,191,185,0.18)',
    backdropFilter: 'blur(32px)',
    WebkitBackdropFilter: 'blur(32px)',
    borderRadius: 28,
    padding: '48px 44px',
    width: '100%',
    maxWidth: 440,
    textAlign: 'center',
    position: 'relative',
    zIndex: 1,
    boxShadow: '0 40px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
  },
  logoWrap: { marginBottom: 32 },
  h1: {
    fontFamily: "'Instrument Serif', serif",
    fontSize: 32,
    fontWeight: 400,
    color: '#fff',
    margin: '0 0 8px',
    letterSpacing: '-0.03em',
  },
  sub: { fontSize: 15, color: 'rgba(255,255,255,0.4)', margin: '0 0 36px', lineHeight: 1.6 },
  form: { display: 'flex', flexDirection: 'column', gap: 18, textAlign: 'left' },
  field: { display: 'flex', flexDirection: 'column', gap: 7 },
  label: {
    fontSize: 11,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  input: {
    padding: '13px 16px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 12,
    fontSize: 15,
    color: '#fff',
    fontFamily: "'DM Sans', sans-serif",
  },
  errText: { fontSize: 13, color: '#f87171', margin: 0, textAlign: 'left' },
  btn: {
    background: '#3bbfb9',
    color: '#081312',
    border: 'none',
    borderRadius: 12,
    padding: '15px',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    letterSpacing: '-0.01em',
    boxShadow: '0 8px 24px rgba(59,191,185,0.25)',
  },
  divider: { height: 1, background: 'rgba(255,255,255,0.06)', margin: '28px 0 24px' },
  fine: { fontSize: 14, color: 'rgba(255,255,255,0.3)' },
  link: { color: '#3bbfb9', textDecoration: 'none', fontWeight: 500 },
};
