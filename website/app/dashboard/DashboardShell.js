'use client';

import { usePathname, useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '../../lib/supabase-browser';

const NAV = [
  { href: '/dashboard', label: 'Home', icon: '📊', exact: true },
  { href: '/dashboard/patients', label: 'Patients', icon: '👥' },
  { href: '/dashboard/settings', label: 'Settings', icon: '⚙️' },
];

export default function DashboardShell({ children, clinic, userEmail }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = getSupabaseBrowser();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  function isActive(href, exact) {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <div style={shell.root}>
      {/* Sidebar */}
      <aside style={shell.sidebar}>
        <div style={shell.sidebarTop}>
          <div style={shell.brand}>
            <span style={shell.brandIcon}>🦷</span>
            <div>
              <div style={shell.brandName}>DentaPass</div>
              {clinic && <div style={shell.clinicName}>{clinic.name}</div>}
            </div>
          </div>

          <nav style={shell.nav}>
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                style={{
                  ...shell.navItem,
                  ...(isActive(item.href, item.exact) ? shell.navActive : {}),
                }}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </a>
            ))}
            {clinic && (
              <a
                href={`/scan/${clinic.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                style={shell.navItem}
              >
                <span>📷</span>
                <span>QR Scanner</span>
              </a>
            )}
          </nav>
        </div>

        <div style={shell.sidebarBottom}>
          <div style={shell.userRow}>
            <div style={shell.avatar}>{userEmail?.[0]?.toUpperCase()}</div>
            <div style={shell.userEmail}>{userEmail}</div>
          </div>
          <button onClick={handleLogout} style={shell.logoutBtn}>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={shell.main}>{children}</main>
    </div>
  );
}

const shell = {
  root: {
    display: 'flex',
    minHeight: '100vh',
    fontFamily: "'DM Sans', sans-serif",
    background: '#f8fafc',
  },
  sidebar: {
    width: 220,
    minWidth: 220,
    background: '#fff',
    borderRight: '1px solid #e2e8f0',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: '24px 0',
    position: 'sticky',
    top: 0,
    height: '100vh',
    overflowY: 'auto',
  },
  sidebarTop: { display: 'flex', flexDirection: 'column', gap: 24 },
  brand: { display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px' },
  brandIcon: { fontSize: 26 },
  brandName: { fontWeight: 700, fontSize: 15, color: '#111', lineHeight: 1.2 },
  clinicName: { fontSize: 12, color: '#64748b', lineHeight: 1.3 },
  nav: { display: 'flex', flexDirection: 'column', gap: 2, padding: '0 12px' },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 10,
    textDecoration: 'none',
    color: '#374151',
    fontSize: 14,
    fontWeight: 500,
    transition: 'background 0.15s',
  },
  navActive: {
    background: '#eff6ff',
    color: '#006FEE',
    fontWeight: 600,
  },
  sidebarBottom: { padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 },
  userRow: { display: 'flex', alignItems: 'center', gap: 8 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: '#006FEE',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: 14,
    flexShrink: 0,
  },
  userEmail: { fontSize: 12, color: '#64748b', wordBreak: 'break-all' },
  logoutBtn: {
    background: 'none',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    padding: '8px',
    fontSize: 13,
    color: '#64748b',
    cursor: 'pointer',
    width: '100%',
  },
  main: { flex: 1, padding: '32px', overflowY: 'auto' },
};
