import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '../../lib/supabase-server';

export default async function DashboardHome() {
  const supabase = createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) redirect('/login');

  const { data: clinic } = await supabase
    .from('clinics')
    .select('id, name, slug, plan, patient_limit')
    .eq('owner_email', session.user.email)
    .maybeSingle();

  if (!clinic) {
    return (
      <div style={s.page}>
        <h1 style={s.h1}>Welcome to DentaPass</h1>
        <p style={s.sub}>Your clinic account is being set up. Please contact support.</p>
      </div>
    );
  }

  // Fetch stats in parallel
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const thirtyDaysStr = thirtyDaysFromNow.toISOString().split('T')[0];

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [
    { count: totalPatients },
    { count: dueForCheckup },
    { count: reviewsThisMonth },
    { count: pointsEventsThisMonth },
  ] = await Promise.all([
    supabase.from('patients').select('id', { count: 'exact', head: true }).eq('clinic_id', clinic.id),
    supabase.from('patients').select('id', { count: 'exact', head: true })
      .eq('clinic_id', clinic.id)
      .lte('next_checkup_date', thirtyDaysStr)
      .gte('next_checkup_date', new Date().toISOString().split('T')[0]),
    supabase.from('notifications').select('id', { count: 'exact', head: true })
      .eq('clinic_id', clinic.id)
      .eq('type', 'review')
      .gte('sent_at', startOfMonth.toISOString()),
    supabase.from('point_events').select('id', { count: 'exact', head: true })
      .eq('clinic_id', clinic.id)
      .gte('created_at', startOfMonth.toISOString()),
  ]);

  // Points total this month
  const { data: ptEvents } = await supabase
    .from('point_events')
    .select('points')
    .eq('clinic_id', clinic.id)
    .gte('created_at', startOfMonth.toISOString());
  const pointsThisMonth = (ptEvents || []).reduce((sum, e) => sum + e.points, 0);

  const stats = [
    { label: 'Total patients', value: totalPatients ?? 0, icon: '👥', color: '#006FEE' },
    { label: 'Due for checkup (30 days)', value: dueForCheckup ?? 0, icon: '📅', color: '#f59e0b' },
    { label: 'Reviews requested this month', value: reviewsThisMonth ?? 0, icon: '⭐', color: '#8b5cf6' },
    { label: 'Points awarded this month', value: pointsThisMonth.toLocaleString(), icon: '🏅', color: '#16a34a' },
  ];

  const usagePercent = clinic.patient_limit
    ? Math.min(100, Math.round(((totalPatients ?? 0) / clinic.patient_limit) * 100))
    : null;

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={s.h1}>Good {greeting()}, {clinic.name}</h1>
          <p style={s.sub}>Here's what's happening with your loyalty program.</p>
        </div>
        <div style={s.planBadge}>
          {clinic.plan.charAt(0).toUpperCase() + clinic.plan.slice(1)} plan
        </div>
      </div>

      <div style={s.grid}>
        {stats.map((stat) => (
          <div key={stat.label} style={s.statCard}>
            <div style={{ ...s.statIcon, background: stat.color + '18' }}>{stat.icon}</div>
            <div style={{ ...s.statValue, color: stat.color }}>{stat.value}</div>
            <div style={s.statLabel}>{stat.label}</div>
          </div>
        ))}
      </div>

      {usagePercent !== null && (
        <div style={s.usageCard}>
          <div style={s.usageHeader}>
            <span style={s.usageLabel}>Patient capacity</span>
            <span style={s.usageMeta}>
              {totalPatients ?? 0} / {clinic.patient_limit} ({usagePercent}%)
            </span>
          </div>
          <div style={s.progressTrack}>
            <div
              style={{
                ...s.progressFill,
                width: `${usagePercent}%`,
                background: usagePercent > 90 ? '#dc2626' : usagePercent > 70 ? '#f59e0b' : '#006FEE',
              }}
            />
          </div>
          {usagePercent > 80 && (
            <p style={s.usageWarn}>
              You're approaching your limit. Consider upgrading your plan.
            </p>
          )}
        </div>
      )}

      <div style={s.quickActions}>
        <h2 style={s.sectionTitle}>Quick actions</h2>
        <div style={s.actionRow}>
          <a href={`/scan/${clinic.slug}`} target="_blank" rel="noopener noreferrer" style={s.actionBtn}>
            📷 Open QR Scanner
          </a>
          <a href={`/join/${clinic.slug}`} target="_blank" rel="noopener noreferrer" style={{ ...s.actionBtn, background: '#f0fdf4', color: '#16a34a', borderColor: '#bbf7d0' }}>
            🔗 Enrollment Link
          </a>
          <a href="/dashboard/patients" style={{ ...s.actionBtn, background: '#fdf4ff', color: '#7c3aed', borderColor: '#e9d5ff' }}>
            👥 View Patients
          </a>
        </div>
      </div>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

const s = {
  page: { display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 900 },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  h1: { fontSize: 26, fontWeight: 700, color: '#111', margin: 0 },
  sub: { fontSize: 15, color: '#64748b', margin: '4px 0 0' },
  planBadge: {
    background: '#eff6ff',
    color: '#006FEE',
    border: '1px solid #bfdbfe',
    borderRadius: 20,
    padding: '6px 14px',
    fontSize: 13,
    fontWeight: 600,
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 },
  statCard: {
    background: '#fff',
    borderRadius: 16,
    padding: '20px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  statIcon: { width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 },
  statValue: { fontSize: 30, fontWeight: 800, lineHeight: 1 },
  statLabel: { fontSize: 13, color: '#64748b', lineHeight: 1.3 },
  usageCard: {
    background: '#fff',
    borderRadius: 16,
    padding: '20px 24px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  usageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  usageLabel: { fontWeight: 600, fontSize: 14, color: '#374151' },
  usageMeta: { fontSize: 13, color: '#64748b' },
  progressTrack: { height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4, transition: 'width 0.4s' },
  usageWarn: { fontSize: 13, color: '#dc2626', margin: 0 },
  quickActions: { display: 'flex', flexDirection: 'column', gap: 12 },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: '#111', margin: 0 },
  actionRow: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  actionBtn: {
    background: '#f0f7ff',
    color: '#006FEE',
    border: '1px solid #bfdbfe',
    borderRadius: 12,
    padding: '12px 18px',
    fontSize: 14,
    fontWeight: 600,
    textDecoration: 'none',
    cursor: 'pointer',
    display: 'inline-block',
  },
};
