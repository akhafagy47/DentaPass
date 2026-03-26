'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';

const TIER_COLOR = { bronze: '#CD7F32', silver: '#9CA3AF', gold: '#F59E0B' };
const TIER_BG = { bronze: '#fef9f0', silver: '#f8fafc', gold: '#fffbeb' };

export default function PatientsClient({ patients }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all');

  const filtered = useMemo(() => {
    return patients.filter((p) => {
      const name = `${p.first_name} ${p.last_name}`.toLowerCase();
      const email = (p.email || '').toLowerCase();
      const q = search.toLowerCase();
      const matchesSearch = !q || name.includes(q) || email.includes(q);
      const matchesTier = tierFilter === 'all' || p.tier === tierFilter;
      return matchesSearch && matchesTier;
    });
  }, [patients, search, tierFilter]);

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.h1}>Patients</h1>
        <span style={s.count}>{patients.length} enrolled</span>
      </div>

      <div style={s.controls}>
        <input
          type="search"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={s.searchInput}
        />
        <div style={s.filterRow}>
          {['all', 'bronze', 'silver', 'gold'].map((tier) => (
            <button
              key={tier}
              onClick={() => setTierFilter(tier)}
              style={{
                ...s.filterBtn,
                ...(tierFilter === tier ? s.filterActive : {}),
                ...(tier !== 'all' ? { color: TIER_COLOR[tier] } : {}),
              }}
            >
              {tier === 'all' ? 'All tiers' : tier.charAt(0).toUpperCase() + tier.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={s.empty}>
          <p>No patients found{search ? ' for that search' : ''}.</p>
        </div>
      ) : (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                {['Patient', 'Tier', 'Points', 'Last visit', 'Next checkup', 'Joined'].map((h) => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  style={s.tr}
                  onClick={() => router.push(`/dashboard/patients/${p.id}`)}
                >
                  <td style={s.td}>
                    <div style={s.nameCell}>
                      <div style={s.initials}>
                        {p.first_name[0]}{p.last_name[0]}
                      </div>
                      <div>
                        <div style={s.name}>{p.first_name} {p.last_name}</div>
                        {p.email && <div style={s.email}>{p.email}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={s.td}>
                    <span style={{ ...s.tierBadge, color: TIER_COLOR[p.tier], background: TIER_BG[p.tier] }}>
                      {p.tier.charAt(0).toUpperCase() + p.tier.slice(1)}
                    </span>
                  </td>
                  <td style={{ ...s.td, fontWeight: 600 }}>{p.points_balance}</td>
                  <td style={s.td}>
                    {p.last_visit_date
                      ? new Date(p.last_visit_date).toLocaleDateString('en-CA')
                      : '—'}
                  </td>
                  <td style={s.td}>
                    {p.next_checkup_date
                      ? new Date(p.next_checkup_date).toLocaleDateString('en-CA')
                      : '—'}
                  </td>
                  <td style={s.td}>
                    {new Date(p.created_at).toLocaleDateString('en-CA')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const s = {
  page: { display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1000 },
  header: { display: 'flex', alignItems: 'center', gap: 12 },
  h1: { fontSize: 24, fontWeight: 700, color: '#111', margin: 0 },
  count: {
    background: '#eff6ff', color: '#006FEE', borderRadius: 20,
    padding: '4px 12px', fontSize: 13, fontWeight: 600,
  },
  controls: { display: 'flex', flexDirection: 'column', gap: 10 },
  searchInput: {
    padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10,
    fontSize: 14, outline: 'none', width: '100%', maxWidth: 400, boxSizing: 'border-box',
  },
  filterRow: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  filterBtn: {
    padding: '6px 14px', borderRadius: 20, border: '1.5px solid #e2e8f0',
    background: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', color: '#374151',
  },
  filterActive: { background: '#eff6ff', borderColor: '#bfdbfe', color: '#006FEE', fontWeight: 600 },
  empty: {
    background: '#fff', borderRadius: 16, padding: '40px',
    textAlign: 'center', color: '#64748b', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  tableWrap: {
    background: '#fff', borderRadius: 16, overflow: 'hidden',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflowX: 'auto',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th: {
    padding: '12px 16px', textAlign: 'left', fontWeight: 600,
    color: '#64748b', fontSize: 12, textTransform: 'uppercase',
    borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap',
  },
  tr: { cursor: 'pointer', transition: 'background 0.1s', borderBottom: '1px solid #f1f5f9' },
  td: { padding: '13px 16px', color: '#374151', whiteSpace: 'nowrap' },
  nameCell: { display: 'flex', alignItems: 'center', gap: 10 },
  initials: {
    width: 34, height: 34, borderRadius: '50%', background: '#eff6ff', color: '#006FEE',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 700, fontSize: 13, flexShrink: 0,
  },
  name: { fontWeight: 600, color: '#111' },
  email: { fontSize: 12, color: '#94a3b8' },
  tierBadge: {
    padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
  },
};
