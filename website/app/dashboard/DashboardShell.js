'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '../../lib/supabase-browser';

function IconGrid() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
    </svg>
  );
}
function IconUsers() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}
function IconSettings() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}
function IconChart() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  );
}
function IconScan() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/>
      <path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
      <line x1="7" y1="12" x2="17" y2="12"/>
    </svg>
  );
}

const NAV = [
  { href: '/dashboard', label: 'Home', Icon: IconGrid, exact: true },
  { href: '/dashboard/patients',  label: 'Patients',  Icon: IconUsers },
  { href: '/dashboard/analytics', label: 'Analytics', Icon: IconChart },
  { href: '/dashboard/settings',  label: 'Settings',  Icon: IconSettings },
];

const DARK_VARS = {
  '--dp-bg':    '#0b1a19',
  '--dp-card':  'rgba(255,255,255,0.04)',
  '--dp-bdr':   'rgba(255,255,255,0.07)',
  '--dp-inp':   'rgba(255,255,255,0.05)',
  '--dp-inbdr': 'rgba(255,255,255,0.1)',
  '--dp-t1':    '#fff',
  '--dp-t2':    'rgba(255,255,255,0.65)',
  '--dp-t3':    'rgba(255,255,255,0.4)',
  '--dp-t4':    'rgba(255,255,255,0.25)',
  '--dp-div':   'rgba(255,255,255,0.06)',
  '--dp-sbg':   'rgba(255,255,255,0.03)',
  '--dp-sbdr':  'rgba(255,255,255,0.06)',
};

const LIGHT_VARS = {
  '--dp-bg':    '#f5f9f8',
  '--dp-card':  '#ffffff',
  '--dp-bdr':   'rgba(0,0,0,0.1)',
  '--dp-inp':   '#ffffff',
  '--dp-inbdr': 'rgba(0,0,0,0.15)',
  '--dp-t1':    '#0b1a19',
  '--dp-t2':    'rgba(0,0,0,0.72)',
  '--dp-t3':    'rgba(0,0,0,0.55)',
  '--dp-t4':    'rgba(0,0,0,0.42)',
  '--dp-div':   'rgba(0,0,0,0.1)',
  '--dp-sbg':   '#ffffff',
  '--dp-sbdr':  'rgba(0,0,0,0.1)',
};

export default function DashboardShell({ children, clinic, userEmail }) {
  const pathname   = usePathname();
  const router     = useRouter();
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemDark(mq.matches);
    const handler = (e) => setSystemDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const savedTheme = clinic?.theme || 'auto';
  const resolvedTheme = savedTheme === 'auto' ? (systemDark ? 'dark' : 'light') : savedTheme;
  const isLight   = resolvedTheme === 'light';
  const cssVars   = isLight ? LIGHT_VARS : DARK_VARS;

  async function handleLogout() {
    await getSupabaseBrowser().auth.signOut();
    router.push('/login');
    router.refresh();
  }

  function isActive(href, exact) {
    return exact ? pathname === href : pathname.startsWith(href);
  }

  return (
    <>
      <style>{`
        @keyframes dpSlideIn { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes orbFloat  { 0%,100%{transform:translate(0,0) scale(1)} 40%{transform:translate(40px,-50px) scale(1.06)} 70%{transform:translate(-25px,30px) scale(0.96)} }
        @keyframes orbFloat2 { 0%,100%{transform:translate(0,0) scale(1)} 35%{transform:translate(-40px,45px) scale(1.04)} 65%{transform:translate(30px,-25px) scale(0.97)} }
        .dp-nav  { transition: background 0.15s, color 0.15s; }
        .dp-nav:hover  { background: ${isLight ? 'rgba(59,191,185,0.07)' : 'rgba(255,255,255,0.05)'} !important; color: ${isLight ? '#0b1a19' : 'rgba(255,255,255,0.9)'} !important; }
        .dp-nav.active { background: rgba(59,191,185,0.12) !important; color: ${isLight ? '#0a6b67' : '#fff'} !important; }
        .dp-logout:hover { background: ${isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.07)'} !important; color: ${isLight ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.7)'} !important; }
        .dp-content { animation: dpSlideIn 0.4s cubic-bezier(0.16,1,0.3,1) both; }
        .dp-orb-1 { animation: orbFloat  20s ease-in-out infinite; }
        .dp-orb-2 { animation: orbFloat2 26s ease-in-out infinite; }
      `}</style>

      <div style={{ ...s.root, ...cssVars, background: 'var(--dp-bg)' }}>
        {/* Background orbs */}
        <div className="dp-orb-1" style={{
          ...s.orb1,
          background: isLight
            ? 'radial-gradient(circle, rgba(59,191,185,0.08) 0%, transparent 65%)'
            : 'radial-gradient(circle, rgba(59,191,185,0.13) 0%, transparent 65%)',
        }} />
        <div className="dp-orb-2" style={{
          ...s.orb2,
          background: isLight
            ? 'radial-gradient(circle, rgba(59,191,185,0.05) 0%, transparent 65%)'
            : 'radial-gradient(circle, rgba(245,240,234,0.05) 0%, transparent 65%)',
        }} />

        {/* Sidebar */}
        <aside style={{
          ...s.sidebar,
          background: 'var(--dp-sbg)',
          borderRight: '1px solid var(--dp-sbdr)',
          backdropFilter: isLight ? 'none' : 'blur(24px)',
          WebkitBackdropFilter: isLight ? 'none' : 'blur(24px)',
          boxShadow: isLight ? '2px 0 12px rgba(0,0,0,0.05)' : 'none',
        }}>
          <div style={s.sidebarTop}>
            <div style={s.brand}>
              <div style={s.brandMark}>
                <img src="/dentapass-logo.png" alt="DentaPass" style={{ width: 22, height: 22, objectFit: 'contain' }} />
              </div>
              <div>
                <div style={{ ...s.brandName, color: 'var(--dp-t1)' }}>DentaPass</div>
                {clinic && <div style={{ ...s.clinicName, color: 'var(--dp-t4)' }}>{clinic.name}</div>}
              </div>
            </div>

            <div style={s.nav}>
              <div style={{ ...s.navLabel, color: isLight ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.18)' }}>MENU</div>
              {NAV.map(({ href, label, Icon, exact }) => {
                const active = isActive(href, exact);
                return (
                  <a
                    key={href}
                    href={href}
                    className={`dp-nav${active ? ' active' : ''}`}
                    style={{
                      ...s.navItem,
                      color: active ? (isLight ? '#0a6b67' : '#fff') : 'var(--dp-t2)',
                      fontWeight: active ? 600 : 500,
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0, color: active ? '#3bbfb9' : 'var(--dp-t3)' }}>
                      <Icon />
                    </span>
                    {label}
                    {active && <span style={s.activePip} />}
                  </a>
                );
              })}
              {clinic && (
                <a
                  href={`/scan/${clinic.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="dp-nav"
                  style={{ ...s.navItem, color: 'var(--dp-t2)' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0, color: 'var(--dp-t3)' }}><IconScan /></span>
                  QR Scanner
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--dp-t4)' }}>↗</span>
                </a>
              )}
            </div>
          </div>

          <div style={s.sidebarBottom}>
            <div style={{ height: 1, background: 'var(--dp-div)', marginBottom: 2 }} />
            <div style={s.userRow}>
              <div style={s.avatar}>{userEmail?.[0]?.toUpperCase()}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...s.userEmail, color: 'var(--dp-t3)' }}>{userEmail}</div>
                {clinic?.plan && (
                  <div style={{ ...s.userPlan, color: 'var(--dp-t4)' }}>
                    {clinic.plan.charAt(0).toUpperCase() + clinic.plan.slice(1)} plan
                  </div>
                )}
              </div>
            </div>
            <button onClick={handleLogout} className="dp-logout" style={{
              ...s.logoutBtn,
              border: '1px solid var(--dp-bdr)',
              color: 'var(--dp-t4)',
            }}>
              Sign out
            </button>
          </div>
        </aside>

        <main style={{ ...s.main, background: 'var(--dp-bg)' }}>
          <div className="dp-content">{children}</div>
        </main>
      </div>
    </>
  );
}

const s = {
  root: {
    display: 'flex',
    minHeight: '100vh',
    fontFamily: "'DM Sans', sans-serif",
    position: 'relative',
    overflow: 'hidden',
  },
  orb1: {
    position: 'fixed',
    top: '-15%', right: '5%',
    width: 700, height: 700,
    borderRadius: '50%',
    pointerEvents: 'none', zIndex: 0,
  },
  orb2: {
    position: 'fixed',
    bottom: '-20%', left: '15%',
    width: 600, height: 600,
    borderRadius: '50%',
    pointerEvents: 'none', zIndex: 0,
  },
  sidebar: {
    width: 240, minWidth: 240,
    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    padding: '24px 0 20px',
    position: 'sticky', top: 0, height: '100vh',
    overflowY: 'auto', zIndex: 10,
  },
  sidebarTop: { display: 'flex', flexDirection: 'column', gap: 28 },
  brand: { display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px' },
  brandMark: {
    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
    background: 'rgba(59,191,185,0.15)',
    border: '1px solid rgba(59,191,185,0.2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  brandName: { fontWeight: 700, fontSize: 15, lineHeight: 1.2 },
  clinicName: {
    fontSize: 11, lineHeight: 1.3, marginTop: 2,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150,
  },
  nav: { display: 'flex', flexDirection: 'column', gap: 1, padding: '0 10px' },
  navLabel: {
    fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
    padding: '0 10px', marginBottom: 6,
  },
  navItem: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '9px 10px', borderRadius: 8,
    textDecoration: 'none', fontSize: 14, fontWeight: 500, position: 'relative',
  },
  activePip: {
    marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%',
    background: '#3bbfb9', flexShrink: 0, boxShadow: '0 0 8px rgba(59,191,185,0.6)',
  },
  sidebarBottom: { padding: '0 14px', display: 'flex', flexDirection: 'column', gap: 10 },
  userRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '2px 0' },
  avatar: {
    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
    background: 'linear-gradient(135deg, #3bbfb9 0%, #2aa8a2 100%)',
    color: '#081312',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 700, fontSize: 13,
  },
  userEmail: {
    fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  userPlan: { fontSize: 11, marginTop: 1 },
  logoutBtn: {
    background: 'none', borderRadius: 8,
    padding: '8px 12px', fontSize: 13, cursor: 'pointer',
    width: '100%', textAlign: 'center',
    transition: 'background 0.15s, color 0.15s',
    fontFamily: "'DM Sans', sans-serif",
  },
  main: {
    flex: 1, padding: '40px 44px',
    overflowY: 'auto', minWidth: 0,
    position: 'relative', zIndex: 1,
  },
};
