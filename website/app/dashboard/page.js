import { redirect } from 'next/navigation';
import QRCode from 'qrcode';
import { createSupabaseServerClient } from '../../lib/supabase-server';

function IconUsers() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}
function IconCalendar() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
}
function IconStar() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  );
}
function IconAward() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="7"/>
      <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>
    </svg>
  );
}
function IconScan() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/>
      <path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
      <line x1="7" y1="12" x2="17" y2="12"/>
    </svg>
  );
}
function IconLink() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
  );
}
function IconPatients() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}
function IconDownload() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  );
}

export default async function DashboardHome() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: clinic } = await supabase
    .from('clinics')
    .select('id, name, slug, plan, patient_limit')
    .eq('owner_email', user.email)
    .maybeSingle();

  if (!clinic) redirect('/dashboard/setup');

  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const thirtyDaysStr = thirtyDaysFromNow.toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [
    { count: totalPatients },
    { count: dueForCheckup },
    { count: reviewsThisMonth },
  ] = await Promise.all([
    supabase.from('patients').select('id', { count: 'exact', head: true }).eq('clinic_id', clinic.id),
    supabase.from('patients').select('id', { count: 'exact', head: true })
      .eq('clinic_id', clinic.id)
      .lte('next_checkup_date', thirtyDaysStr)
      .gte('next_checkup_date', today),
    supabase.from('notifications').select('id', { count: 'exact', head: true })
      .eq('clinic_id', clinic.id).eq('type', 'review')
      .gte('sent_at', startOfMonth.toISOString()),
  ]);

  const { data: ptEvents } = await supabase
    .from('point_events').select('points')
    .eq('clinic_id', clinic.id)
    .gte('created_at', startOfMonth.toISOString());
  const pointsThisMonth = (ptEvents || []).reduce((sum, e) => sum + e.points, 0);

  const usagePercent = clinic.patient_limit
    ? Math.min(100, Math.round(((totalPatients ?? 0) / clinic.patient_limit) * 100))
    : null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const enrollUrl = `${appUrl}/join/${clinic.slug}`;
  const qrDataUrl = await QRCode.toDataURL(enrollUrl, {
    width: 512,
    margin: 2,
    color: { dark: '#111827', light: '#ffffff' },
  });

  const stats = [
    { label: 'Total patients', value: totalPatients ?? 0, Icon: IconUsers, accent: '#3bbfb9', delay: '0.05s' },
    { label: 'Due for checkup', sublabel: 'next 30 days', value: dueForCheckup ?? 0, Icon: IconCalendar, accent: '#f59e0b', delay: '0.1s' },
    { label: 'Reviews requested', sublabel: 'this month', value: reviewsThisMonth ?? 0, Icon: IconStar, accent: '#a78bfa', delay: '0.15s' },
    { label: 'Points awarded', sublabel: 'this month', value: pointsThisMonth.toLocaleString(), Icon: IconAward, accent: '#34d399', delay: '0.2s' },
  ];

  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes progressFill {
          from { width: 0%; }
        }
        @keyframes shimmerGlow {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        .stat-card {
          animation: fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) both;
          transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
        }
        .stat-card:hover {
          transform: translateY(-3px);
          border-color: rgba(59,191,185,0.2) !important;
          box-shadow: 0 16px 40px rgba(0,0,0,0.3) !important;
        }
        .action-btn { transition: transform 0.15s, box-shadow 0.15s, background 0.15s, border-color 0.15s; }
        .action-btn:hover { transform: translateY(-2px); }
        .progress-fill { animation: progressFill 0.8s cubic-bezier(0.16,1,0.3,1) 0.3s both; }
        .dp-glass-card {
          animation: fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.25s both;
        }
      `}</style>

      <div style={s.page}>
        {/* Header */}
        <div style={s.header}>
          <div>
            <h1 style={s.h1}>Good {greeting()}</h1>
            <p style={s.sub}>{clinic.name} · Here's your loyalty program overview.</p>
          </div>
          <div style={s.planBadge}>
            {clinic.plan.charAt(0).toUpperCase() + clinic.plan.slice(1)} plan
          </div>
        </div>

        {/* Stats */}
        <div style={s.grid}>
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="stat-card"
              style={{ ...s.statCard, animationDelay: stat.delay }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{ ...s.iconWrap, color: stat.accent, background: `${stat.accent}18`, border: `1px solid ${stat.accent}30` }}>
                  <stat.Icon />
                </div>
              </div>
              <div style={{ ...s.statValue, color: stat.accent }}>{stat.value}</div>
              <div style={s.statLabel}>{stat.label}</div>
              {stat.sublabel && <div style={s.statSub}>{stat.sublabel}</div>}
            </div>
          ))}
        </div>

        {/* Capacity */}
        {usagePercent !== null && (
          <div className="dp-glass-card" style={s.card}>
            <div style={s.capacityHeader}>
              <div>
                <div style={s.cardTitle}>Patient capacity</div>
                <div style={s.capacitySub}>{totalPatients ?? 0} of {clinic.patient_limit?.toLocaleString()} patients used</div>
              </div>
              <div style={{
                ...s.percentBadge,
                background: usagePercent > 90 ? 'rgba(239,68,68,0.15)' : usagePercent > 70 ? 'rgba(245,158,11,0.15)' : 'rgba(59,191,185,0.15)',
                color: usagePercent > 90 ? '#f87171' : usagePercent > 70 ? '#fbbf24' : '#3bbfb9',
                border: `1px solid ${usagePercent > 90 ? 'rgba(239,68,68,0.3)' : usagePercent > 70 ? 'rgba(245,158,11,0.3)' : 'rgba(59,191,185,0.3)'}`,
              }}>
                {usagePercent}%
              </div>
            </div>
            <div style={s.progressTrack}>
              <div
                className="progress-fill"
                style={{
                  ...s.progressFill,
                  width: `${usagePercent}%`,
                  background: usagePercent > 90
                    ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                    : usagePercent > 70
                    ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                    : 'linear-gradient(90deg, #3bbfb9, #2aa8a2)',
                }}
              />
            </div>
            {usagePercent > 80 && (
              <p style={s.capacityWarn}>Approaching limit — consider upgrading your plan.</p>
            )}
          </div>
        )}

        {/* Quick actions */}
        <div className="dp-glass-card" style={{ ...s.card, animationDelay: '0.35s' }}>
          <div style={s.cardTitle}>Quick actions</div>
          <div style={s.actionRow}>
            <a href={`/scan/${clinic.slug}`} target="_blank" rel="noopener noreferrer" className="action-btn" style={{ ...s.actionBtn, ...s.actionTeal }}>
              <IconScan /> Open QR Scanner
            </a>
            <a href={`/join/${clinic.slug}`} target="_blank" rel="noopener noreferrer" className="action-btn" style={{ ...s.actionBtn, ...s.actionGreen }}>
              <IconLink /> Enrollment Link
            </a>
            <a href="/dashboard/patients" className="action-btn" style={{ ...s.actionBtn, ...s.actionPurple }}>
              <IconPatients /> View Patients
            </a>
          </div>
        </div>

        {/* Enrollment QR code */}
        <div className="dp-glass-card" style={{ ...s.card, animationDelay: '0.4s' }}>
          <div style={s.cardTitle}>Patient enrollment QR code</div>
          <div style={{ display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap' }}>
            <a href={qrDataUrl} download={`${clinic.slug}-enrollment-qr.png`} style={{ flexShrink: 0, lineHeight: 0, borderRadius: 14, overflow: 'hidden', border: '1px solid var(--dp-bdr)', display: 'block' }}>
              <img src={qrDataUrl} alt="Enrollment QR code" width={148} height={148} />
            </a>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--dp-t2)', lineHeight: 1.65 }}>
                Print and display at the front desk. Patients scan to add their loyalty card to Apple or Google Wallet instantly — no app download needed.
              </p>
              <code style={{ fontSize: 12, color: 'var(--dp-t3)', wordBreak: 'break-all', background: 'var(--dp-inp)', border: '1px solid var(--dp-bdr)', borderRadius: 8, padding: '6px 10px', display: 'block' }}>
                {enrollUrl}
              </code>
              <div style={s.actionRow}>
                <a href="/api/qr-pdf" download={`${clinic.slug}-enrollment-card.pdf`} className="action-btn" style={{ ...s.actionBtn, ...s.actionTeal, textDecoration: 'none' }}>
                  <IconDownload /> Download print sheet
                </a>
                <a href={qrDataUrl} download={`${clinic.slug}-enrollment-qr.png`} className="action-btn" style={{ ...s.actionBtn, ...s.actionGreen, textDecoration: 'none' }}>
                  <IconDownload /> Download QR only
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

const s = {
  page: { display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 960 },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 4 },
  h1: {
    fontFamily: "'Instrument Serif', serif",
    fontSize: 32, fontWeight: 400, color: 'var(--dp-t1)',
    margin: '0 0 4px', letterSpacing: '-0.02em',
  },
  sub: { fontSize: 14, color: 'var(--dp-t3)', margin: 0 },
  planBadge: {
    background: 'rgba(59,191,185,0.1)',
    color: '#3bbfb9',
    border: '1px solid rgba(59,191,185,0.25)',
    borderRadius: 20,
    padding: '6px 14px', fontSize: 12, fontWeight: 700,
    letterSpacing: '0.02em',
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 16 },
  statCard: {
    background: 'var(--dp-card)',
    borderRadius: 16,
    padding: '22px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    border: '1px solid var(--dp-bdr)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  },
  iconWrap: {
    width: 42, height: 42, borderRadius: 12,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  statValue: { fontSize: 36, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.03em', marginBottom: 4 },
  statLabel: { fontSize: 13, fontWeight: 600, color: 'var(--dp-t2)' },
  statSub: { fontSize: 12, color: 'var(--dp-t4)', marginTop: 1 },
  card: {
    background: 'var(--dp-card)',
    borderRadius: 16,
    padding: '22px 24px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    border: '1px solid var(--dp-bdr)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    display: 'flex', flexDirection: 'column', gap: 14,
  },
  capacityHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 14, fontWeight: 700, color: 'var(--dp-t2)', letterSpacing: '0.01em' },
  capacitySub: { fontSize: 13, color: 'var(--dp-t4)', marginTop: 2 },
  percentBadge: { fontSize: 13, fontWeight: 700, padding: '4px 12px', borderRadius: 20 },
  progressTrack: { height: 6, background: 'var(--dp-bdr)', borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999 },
  capacityWarn: { fontSize: 13, color: '#f87171', margin: 0 },
  actionRow: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  actionBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '11px 18px', borderRadius: 12,
    fontSize: 14, fontWeight: 600, textDecoration: 'none', cursor: 'pointer',
    border: '1px solid transparent',
  },
  actionTeal: {
    background: 'rgba(59,191,185,0.1)',
    color: '#3bbfb9',
    borderColor: 'rgba(59,191,185,0.25)',
  },
  actionGreen: {
    background: 'rgba(52,211,153,0.1)',
    color: '#34d399',
    borderColor: 'rgba(52,211,153,0.25)',
  },
  actionPurple: {
    background: 'rgba(167,139,250,0.1)',
    color: '#a78bfa',
    borderColor: 'rgba(167,139,250,0.25)',
  },
};
