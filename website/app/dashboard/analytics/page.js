import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '../../../lib/supabase-server';
import { Suspense } from 'react';
import PeriodSelector from './PeriodSelector';

// ─── Helpers ────────────────────────────────────────────────────────────────

function periodToDays(period) {
  if (period === '7d')  return 7;
  if (period === '90d') return 90;
  if (period === '12m') return 365;
  return 30; // default 30d
}

function bucketLabel(dateStr, period) {
  const d = new Date(dateStr);
  if (period === '12m') return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  if (period === '90d') return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function bucketKey(date, period) {
  const d = new Date(date);
  if (period === '12m') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return d.toISOString().split('T')[0];
}

function generateBuckets(days, period) {
  const buckets = [];
  const now = new Date();
  if (period === '12m') {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      buckets.push({ key, label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) });
    }
  } else {
    const step = days <= 30 ? 1 : 7;
    for (let i = days - 1; i >= 0; i -= step) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      buckets.push({ key, label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) });
    }
  }
  return buckets;
}

function pct(a, b) {
  if (!b) return 0;
  return Math.round((a / b) * 100);
}

// ─── SVG Charts ─────────────────────────────────────────────────────────────

function AreaChart({ data, color = '#006FEE', height = 120 }) {
  if (!data || data.length < 2) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#cbd5e1', fontSize: 13 }}>Not enough data</p>
      </div>
    );
  }

  const W = 560, H = height;
  const pad = { top: 12, right: 8, bottom: 28, left: 36 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  const values = data.map((d) => d.value);
  const maxV = Math.max(...values) || 1;
  const minV = 0;

  const xScale = (i) => pad.left + (i / (data.length - 1)) * innerW;
  const yScale = (v) => pad.top + innerH - ((v - minV) / (maxV - minV)) * innerH;

  const points = data.map((d, i) => `${xScale(i)},${yScale(d.value)}`).join(' ');
  const areaPath = `M${xScale(0)},${yScale(data[0].value)} ` +
    data.slice(1).map((d, i) => `L${xScale(i + 1)},${yScale(d.value)}`).join(' ') +
    ` L${xScale(data.length - 1)},${pad.top + innerH} L${xScale(0)},${pad.top + innerH} Z`;

  // Y-axis ticks
  const yTicks = [0, Math.round(maxV / 2), maxV];

  // X-axis labels (show first, middle, last)
  const xLabels = data.length <= 8
    ? data.map((d, i) => ({ i, label: d.label }))
    : [
        { i: 0, label: data[0].label },
        { i: Math.floor(data.length / 2), label: data[Math.floor(data.length / 2)].label },
        { i: data.length - 1, label: data[data.length - 1].label },
      ];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {yTicks.map((v) => (
        <g key={v}>
          <line
            x1={pad.left} y1={yScale(v)}
            x2={pad.left + innerW} y2={yScale(v)}
            stroke="#f1f5f9" strokeWidth="1"
          />
          <text x={pad.left - 6} y={yScale(v) + 4} textAnchor="end" fontSize="9" fill="#94a3b8">
            {v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
          </text>
        </g>
      ))}

      {/* Area fill */}
      <path d={areaPath} fill={`url(#grad-${color.replace('#', '')})`} />

      {/* Line */}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Dots on last point */}
      <circle
        cx={xScale(data.length - 1)}
        cy={yScale(data[data.length - 1].value)}
        r="3.5"
        fill={color}
      />

      {/* X labels */}
      {xLabels.map(({ i, label }) => (
        <text key={i} x={xScale(i)} y={H - 4} textAnchor="middle" fontSize="9" fill="#94a3b8">
          {label}
        </text>
      ))}
    </svg>
  );
}

function DonutChart({ segments, size = 140 }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (!total) {
    return (
      <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size }}>
        <circle cx={size / 2} cy={size / 2} r={size * 0.38} fill="none" stroke="#f1f5f9" strokeWidth={size * 0.18} />
        <text x={size / 2} y={size / 2 + 5} textAnchor="middle" fontSize="11" fill="#94a3b8">—</text>
      </svg>
    );
  }

  const cx = size / 2, cy = size / 2, r = size * 0.38;
  const stroke = size * 0.18;
  const circ = 2 * Math.PI * r;

  let offset = 0;
  const arcs = segments.map((seg) => {
    const dash = (seg.value / total) * circ;
    const gap = circ - dash;
    const arc = { ...seg, dash, gap, offset };
    offset += dash;
    return arc;
  });

  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
      {arcs.map((arc) => (
        <circle
          key={arc.label}
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={arc.color}
          strokeWidth={stroke}
          strokeDasharray={`${arc.dash} ${arc.gap}`}
          strokeDashoffset={-arc.offset}
          strokeLinecap="butt"
          style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
        />
      ))}
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize="18" fontWeight="800" fill="#111">
        {total.toLocaleString()}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9" fill="#94a3b8">total</text>
    </svg>
  );
}

function HBarChart({ bars, maxValue }) {
  const max = maxValue || Math.max(...bars.map((b) => b.value), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {bars.map((bar) => (
        <div key={bar.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>{bar.label}</span>
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
              {bar.value.toLocaleString()}
            </span>
          </div>
          <div style={{ height: 6, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${(bar.value / max) * 100}%`,
              background: bar.color || '#006FEE',
              borderRadius: 99,
              transition: 'width 0.6s cubic-bezier(0.16,1,0.3,1)',
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, delta, color = '#006FEE', bg = '#eff6ff', delay = '0s' }) {
  const isPositive = delta > 0;
  const isNeutral = delta === 0 || delta === null || delta === undefined;
  return (
    <div className="an-card" style={{ ...s.statCard, animationDelay: delay }}>
      <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      <div style={{ fontSize: 34, fontWeight: 800, color: color, letterSpacing: '-0.03em', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
        {sub && <span style={{ fontSize: 12, color: '#94a3b8' }}>{sub}</span>}
        {!isNeutral && (
          <span style={{
            fontSize: 11, fontWeight: 700,
            color: isPositive ? '#16a34a' : '#dc2626',
            background: isPositive ? '#f0fdf4' : '#fef2f2',
            padding: '2px 7px', borderRadius: 20,
          }}>
            {isPositive ? '↑' : '↓'} {Math.abs(delta)}%
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Section Card wrapper ────────────────────────────────────────────────────

function Card({ title, subtitle, children, className }) {
  return (
    <div className={`an-card ${className || ''}`} style={s.card}>
      {(title || subtitle) && (
        <div style={{ marginBottom: 20 }}>
          {title && <div style={s.cardTitle}>{title}</div>}
          {subtitle && <div style={s.cardSub}>{subtitle}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default async function AnalyticsPage({ searchParams }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: clinic } = await supabase
    .from('clinics')
    .select('id, name')
    .eq('owner_email', user.email)
    .maybeSingle();

  if (!clinic) redirect('/dashboard');

  const period = ['7d', '30d', '90d', '12m'].includes(searchParams?.period)
    ? searchParams.period
    : '30d';

  const days = periodToDays(period);
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceISO = since.toISOString();

  // Previous period for delta
  const prevSince = new Date(since);
  prevSince.setDate(prevSince.getDate() - days);
  const prevISO = prevSince.toISOString();

  const cid = clinic.id;

  const [
    { count: totalPatients },
    { count: newPatients },
    { count: prevNewPatients },
    { data: enrollments },
    { data: pointEvents },
    { data: notificationsRaw },
    { data: tierRows },
    { data: referrerRows },
  ] = await Promise.all([
    supabase.from('patients').select('id', { count: 'exact', head: true }).eq('clinic_id', cid),
    supabase.from('patients').select('id', { count: 'exact', head: true })
      .eq('clinic_id', cid).gte('created_at', sinceISO),
    supabase.from('patients').select('id', { count: 'exact', head: true })
      .eq('clinic_id', cid).gte('created_at', prevISO).lt('created_at', sinceISO),
    supabase.from('patients').select('created_at').eq('clinic_id', cid)
      .gte('created_at', sinceISO).order('created_at'),
    supabase.from('point_events').select('points, reason, created_at').eq('clinic_id', cid)
      .gte('created_at', sinceISO),
    // Include clicked_at so we can compute CTR and click trends
    supabase.from('notifications').select('type, sent_at, clicked_at').eq('clinic_id', cid)
      .gte('sent_at', sinceISO),
    supabase.from('patients').select('tier').eq('clinic_id', cid),
    supabase.from('patients').select('referred_by').eq('clinic_id', cid)
      .not('referred_by', 'is', null).gte('created_at', sinceISO),
  ]);

  // ── Enrollment trend ──
  const buckets = generateBuckets(days, period);
  const enrollMap = {};
  (enrollments || []).forEach((e) => {
    const k = bucketKey(e.created_at, period);
    enrollMap[k] = (enrollMap[k] || 0) + 1;
  });
  const enrollTrend = buckets.map((b) => ({ label: b.label, value: enrollMap[b.key] || 0 }));

  // ── Tier distribution ──
  const tierCount = { bronze: 0, silver: 0, gold: 0 };
  (tierRows || []).forEach((r) => { if (tierCount[r.tier] !== undefined) tierCount[r.tier]++; });
  const tierSegments = [
    { label: 'Bronze', value: tierCount.bronze, color: '#d97706' },
    { label: 'Silver', value: tierCount.silver, color: '#64748b' },
    { label: 'Gold',   value: tierCount.gold,   color: '#eab308' },
  ];

  // ── Points by reason ──
  const reasonMap = {};
  let totalPoints = 0;
  (pointEvents || []).forEach((e) => {
    const label = {
      completed_visit: 'Completed visit',
      left_review: 'Left a review',
      referred_friend: 'Referral',
      custom: 'Custom award',
    }[e.reason] || e.reason;
    reasonMap[label] = (reasonMap[label] || 0) + e.points;
    totalPoints += e.points;
  });
  const reasonBars = Object.entries(reasonMap)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value], i) => ({
      label, value,
      color: ['#006FEE', '#7c3aed', '#059669', '#d97706'][i] || '#94a3b8',
    }));

  // ── Points trend ──
  const pointsMap = {};
  (pointEvents || []).forEach((e) => {
    const k = bucketKey(e.created_at, period);
    pointsMap[k] = (pointsMap[k] || 0) + e.points;
  });
  const pointsTrend = buckets.map((b) => ({ label: b.label, value: pointsMap[b.key] || 0 }));

  // ── Notifications + Review click tracking ──
  const notifCounts  = { review: 0, recall: 0 };
  let reviewClicks   = 0;
  const clickTrendMap = {};

  (notificationsRaw || []).forEach((n) => {
    if (notifCounts[n.type] !== undefined) notifCounts[n.type]++;
    if (n.type === 'review' && n.clicked_at) {
      reviewClicks++;
      const k = bucketKey(n.clicked_at, period);
      clickTrendMap[k] = (clickTrendMap[k] || 0) + 1;
    }
  });

  const totalNotifs   = notifCounts.review + notifCounts.recall;
  const reviewCTR     = notifCounts.review > 0
    ? Math.round((reviewClicks / notifCounts.review) * 100)
    : 0;
  const clickTrend    = buckets.map((b) => ({ label: b.label, value: clickTrendMap[b.key] || 0 }));

  // Average time-to-click (hours) for clicked reviews
  const clickedNotifs = (notificationsRaw || []).filter(
    (n) => n.type === 'review' && n.clicked_at && n.sent_at
  );
  const avgHoursToClick = clickedNotifs.length === 0 ? null : Math.round(
    clickedNotifs.reduce((sum, n) =>
      sum + (new Date(n.clicked_at) - new Date(n.sent_at)) / (1000 * 60 * 60), 0
    ) / clickedNotifs.length
  );

  // ── Top referrers ──
  const refMap = {};
  (referrerRows || []).forEach((r) => {
    if (r.referred_by) refMap[r.referred_by] = (refMap[r.referred_by] || 0) + 1;
  });

  // Fetch names for top referrers (up to 5)
  const topRefIds = Object.entries(refMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id]) => id);
  let topReferrers = [];
  if (topRefIds.length > 0) {
    const { data: refPatients } = await supabase
      .from('patients').select('id, first_name, last_name').in('id', topRefIds);
    topReferrers = topRefIds.map((id) => {
      const p = refPatients?.find((r) => r.id === id);
      return { name: p ? `${p.first_name} ${p.last_name}` : id, count: refMap[id] };
    });
  }

  // ── Delta calculations ──
  const enrollDelta = prevNewPatients === 0
    ? null
    : Math.round(((newPatients - prevNewPatients) / prevNewPatients) * 100);

  const prevPointEvents = await supabase
    .from('point_events').select('points').eq('clinic_id', cid)
    .gte('created_at', prevISO).lt('created_at', sinceISO);
  const prevPoints = (prevPointEvents.data || []).reduce((s, e) => s + e.points, 0);
  const pointsDelta = prevPoints === 0 ? null : Math.round(((totalPoints - prevPoints) / prevPoints) * 100);

  const periodLabel = { '7d': 'last 7 days', '30d': 'last 30 days', '90d': 'last 90 days', '12m': 'last 12 months' }[period];

  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .an-card {
          animation: fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) both;
        }
        .an-two-col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        @media (max-width: 720px) {
          .an-two-col { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div style={s.page}>
        {/* Header */}
        <div style={s.header}>
          <div>
            <h1 style={s.h1}>Analytics</h1>
            <p style={s.sub}>{clinic.name} · {periodLabel}</p>
          </div>
          <Suspense>
            <PeriodSelector current={period} />
          </Suspense>
        </div>

        {/* KPI row */}
        <div style={s.kpiGrid}>
          <StatCard
            label="Total patients"
            value={totalPatients?.toLocaleString() ?? '0'}
            sub="all time"
            color="#006FEE"
            delay="0.04s"
          />
          <StatCard
            label="New enrollments"
            value={newPatients?.toLocaleString() ?? '0'}
            sub={periodLabel}
            delta={enrollDelta}
            color="#7c3aed"
            delay="0.08s"
          />
          <StatCard
            label="Points awarded"
            value={totalPoints.toLocaleString()}
            sub={periodLabel}
            delta={pointsDelta}
            color="#059669"
            delay="0.12s"
          />
          <StatCard
            label="Notifications sent"
            value={totalNotifs.toLocaleString()}
            sub={periodLabel}
            color="#d97706"
            delay="0.16s"
          />
          <StatCard
            label="Review click rate"
            value={`${reviewCTR}%`}
            sub={`${reviewClicks} of ${notifCounts.review} tapped`}
            color="#e11d48"
            delay="0.2s"
          />
        </div>

        {/* Enrollment trend + Points trend */}
        <div className="an-two-col">
          <Card title="Enrollment trend" subtitle={`New patients · ${periodLabel}`} className="" style={{ animationDelay: '0.2s' }}>
            <AreaChart data={enrollTrend} color="#006FEE" height={130} />
          </Card>
          <Card title="Points awarded" subtitle={`Total points · ${periodLabel}`} style={{ animationDelay: '0.24s' }}>
            <AreaChart data={pointsTrend} color="#059669" height={130} />
          </Card>
        </div>

        {/* Tier + Points by reason */}
        <div className="an-two-col">
          <Card title="Tier distribution" subtitle="All enrolled patients">
            <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
              <DonutChart segments={tierSegments} size={148} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                {tierSegments.map((seg) => (
                  <div key={seg.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: seg.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: '#374151', flex: 1 }}>{seg.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{seg.value}</span>
                    <span style={{ fontSize: 11, color: '#94a3b8', width: 32, textAlign: 'right' }}>
                      {pct(seg.value, tierRows?.length)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card title="Points by reason" subtitle={`What drove engagement · ${periodLabel}`}>
            {reasonBars.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>No points awarded yet.</p>
            ) : (
              <HBarChart bars={reasonBars} />
            )}
          </Card>
        </div>

        {/* Google Review performance + Referrers */}
        <div className="an-two-col">
          <Card title="Google Review performance" subtitle={`Tap-through from wallet notifications · ${periodLabel}`}>
            {/* CTR meter */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>Click-through rate</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: '#e11d48', letterSpacing: '-0.03em' }}>
                  {reviewCTR}%
                </span>
              </div>
              <div style={{ height: 8, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 99,
                  width: `${reviewCTR}%`,
                  background: reviewCTR >= 30
                    ? 'linear-gradient(90deg,#16a34a,#22c55e)'
                    : reviewCTR >= 15
                    ? 'linear-gradient(90deg,#d97706,#f59e0b)'
                    : 'linear-gradient(90deg,#e11d48,#f43f5e)',
                  minWidth: reviewCTR > 0 ? 6 : 0,
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>0%</span>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>
                  {reviewCTR >= 30 ? '🟢 Strong' : reviewCTR >= 15 ? '🟡 Average' : reviewCTR > 0 ? '🔴 Low' : 'No data yet'}
                </span>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>Industry avg ~20%</span>
              </div>
            </div>

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Sent',    value: notifCounts.review, color: '#7c3aed' },
                { label: 'Clicked', value: reviewClicks,        color: '#e11d48' },
                { label: 'Avg response', value: avgHoursToClick !== null ? `${avgHoursToClick}h` : '—', color: '#059669' },
              ].map((item) => (
                <div key={item.label} style={{
                  background: '#f8fafc', borderRadius: 10, padding: '10px 12px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: item.color, letterSpacing: '-0.02em' }}>
                    {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{item.label}</div>
                </div>
              ))}
            </div>

            {/* Click trend */}
            <div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>Clicks over time</div>
              <AreaChart data={clickTrend} color="#e11d48" height={90} />
            </div>
          </Card>

          <Card title="Top referrers" subtitle={`Patients who drove the most sign-ups · ${periodLabel}`}>
            {topReferrers.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>No referrals recorded yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {topReferrers.map((r, i) => (
                  <div key={r.name} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 0',
                    borderBottom: i < topReferrers.length - 1 ? '1px solid #f1f5f9' : 'none',
                  }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: '50%',
                      background: '#eff6ff', color: '#006FEE',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700, flexShrink: 0,
                    }}>
                      {i + 1}
                    </div>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#374151' }}>{r.name}</span>
                    <span style={{
                      fontSize: 12, fontWeight: 700, color: '#059669',
                      background: '#f0fdf4', padding: '2px 8px', borderRadius: 20,
                    }}>
                      {r.count} {r.count === 1 ? 'referral' : 'referrals'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

const s = {
  page: { display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1040 },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  h1: { fontSize: 28, fontWeight: 800, color: '#0d0f14', margin: '0 0 4px', letterSpacing: '-0.02em' },
  sub: { fontSize: 14, color: '#64748b', margin: 0 },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 },
  statCard: {
    background: '#fff', borderRadius: 16, padding: '20px 22px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    border: '1px solid rgba(0,0,0,0.04)',
  },
  card: {
    background: '#fff', borderRadius: 16, padding: '22px 24px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    border: '1px solid rgba(0,0,0,0.04)',
  },
  cardTitle: { fontSize: 14, fontWeight: 700, color: '#111', marginBottom: 2 },
  cardSub: { fontSize: 12, color: '#94a3b8' },
};
