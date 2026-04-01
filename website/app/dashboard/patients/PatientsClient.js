'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';

const TIER_COLOR = { bronze: '#b45309', silver: '#475569', gold: '#b45309' };
const TIER_BG    = { bronze: '#fef3c7', silver: '#f1f5f9', gold: '#fef9c3' };
const TIER_DOT   = { bronze: '#d97706', silver: '#94a3b8', gold: '#eab308' };

export default function PatientsClient({ patients }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all');

  const filtered = useMemo(() => {
    return patients.filter((p) => {
      const name  = `${p.first_name} ${p.last_name}`.toLowerCase();
      const email = (p.email || '').toLowerCase();
      const q     = search.toLowerCase();
      return (!q || name.includes(q) || email.includes(q))
        && (tierFilter === 'all' || p.tier === tierFilter);
    });
  }, [patients, search, tierFilter]);

  return (
    <>
      <style>{`
        .pt-row { transition: background 0.12s; cursor: pointer; }
        .pt-row:hover { background: rgba(59,191,185,0.05) !important; }
        .pt-row:hover .pt-name { color: #3bbfb9 !important; }
        .tier-btn { transition: background 0.15s, border-color 0.15s, color 0.15s; }
        .tier-btn:hover { border-color: rgba(255,255,255,0.2) !important; }
        .search-wrap input:focus { border-color: rgba(59,191,185,0.5) !important; box-shadow: 0 0 0 3px rgba(59,191,185,0.1); }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .patients-body { animation: fadeUp 0.3s ease both; }
      `}</style>

      <div style={s.page}>
        {/* Header */}
        <div style={s.header}>
          <div>
            <h1 style={s.h1}>Patients</h1>
            <p style={s.sub}>{patients.length} enrolled</p>
          </div>
        </div>

        {/* Controls */}
        <div style={s.controls}>
          <div className="search-wrap" style={s.searchWrap}>
            <svg style={s.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="search"
              placeholder="Search patients…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={s.searchInput}
            />
          </div>
          <div style={s.filters}>
            {['all', 'bronze', 'silver', 'gold'].map((tier) => (
              <button
                key={tier}
                onClick={() => setTierFilter(tier)}
                className="tier-btn"
                style={{
                  ...s.filterBtn,
                  ...(tierFilter === tier ? s.filterActive : {}),
                }}
              >
                {tier !== 'all' && (
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: TIER_DOT[tier], flexShrink: 0 }} />
                )}
                {tier === 'all' ? 'All' : tier.charAt(0).toUpperCase() + tier.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div style={s.empty}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12 }}>
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
            </svg>
            <p style={{ margin: 0, fontSize: 14, color: '#94a3b8' }}>
              {search ? `No patients matching "${search}"` : 'No patients enrolled yet.'}
            </p>
          </div>
        ) : (
          <div className="patients-body" style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr style={s.thead}>
                  {['Patient', 'Tier', 'Points', 'Last visit', 'Next checkup', 'Joined'].map((h) => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    className="pt-row"
                    style={s.tr}
                    onClick={() => router.push(`/dashboard/patients/${p.id}`)}
                  >
                    <td style={s.td}>
                      <div style={s.nameCell}>
                        <div style={s.avatar}>
                          {p.first_name[0]}{p.last_name[0]}
                        </div>
                        <div>
                          <div className="pt-name" style={s.name}>{p.first_name} {p.last_name}</div>
                          {p.email && <div style={s.email}>{p.email}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={s.td}>
                      <span style={{ ...s.tierBadge, color: TIER_COLOR[p.tier], background: TIER_BG[p.tier] }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: TIER_DOT[p.tier], flexShrink: 0 }} />
                        {p.tier.charAt(0).toUpperCase() + p.tier.slice(1)}
                      </span>
                    </td>
                    <td style={{ ...s.td, ...s.pts }}>{p.points_balance.toLocaleString()}</td>
                    <td style={{ ...s.td, color: '#64748b' }}>
                      {p.last_visit_date ? new Date(p.last_visit_date).toLocaleDateString('en-CA') : '—'}
                    </td>
                    <td style={{ ...s.td, color: '#64748b' }}>
                      {p.next_checkup_date ? new Date(p.next_checkup_date).toLocaleDateString('en-CA') : '—'}
                    </td>
                    <td style={{ ...s.td, color: '#94a3b8' }}>
                      {new Date(p.created_at).toLocaleDateString('en-CA')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

const s = {
  page: { display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1040 },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  h1: {
    fontFamily: "'Instrument Serif', serif",
    fontSize: 32, fontWeight: 400, color: '#fff',
    margin: '0 0 4px', letterSpacing: '-0.02em',
  },
  sub: { fontSize: 14, color: 'rgba(255,255,255,0.35)', margin: 0 },
  controls: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  searchWrap: { position: 'relative', flex: '1', maxWidth: 340 },
  searchIcon: { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' },
  searchInput: {
    width: '100%', padding: '10px 14px 10px 38px',
    border: '1.5px solid rgba(255,255,255,0.1)', borderRadius: 10,
    fontSize: 14, outline: 'none', boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.05)',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    color: '#fff',
    fontFamily: 'inherit',
  },
  filters: { display: 'flex', gap: 6 },
  filterBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '7px 14px', borderRadius: 20,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)',
    fontSize: 13, fontWeight: 500, cursor: 'pointer',
    color: 'rgba(255,255,255,0.5)',
  },
  filterActive: {
    background: 'rgba(59,191,185,0.12)',
    borderColor: 'rgba(59,191,185,0.3)',
    color: '#3bbfb9', fontWeight: 700,
  },
  empty: {
    background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: '56px 24px',
    textAlign: 'center', border: '1px solid rgba(255,255,255,0.07)',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
  },
  tableWrap: {
    background: 'rgba(255,255,255,0.04)', borderRadius: 16, overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.07)', overflowX: 'auto',
    backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  thead: { background: 'rgba(255,255,255,0.03)' },
  th: {
    padding: '11px 16px', textAlign: 'left', fontWeight: 600,
    fontSize: 11, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.05em',
    borderBottom: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap',
  },
  tr: { borderBottom: '1px solid rgba(255,255,255,0.04)' },
  td: { padding: '13px 16px', color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap', fontSize: 14 },
  nameCell: { display: 'flex', alignItems: 'center', gap: 10 },
  avatar: {
    width: 34, height: 34, borderRadius: '50%',
    background: 'rgba(59,191,185,0.15)', color: '#3bbfb9',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 700, fontSize: 12, flexShrink: 0, letterSpacing: '0.02em',
    border: '1px solid rgba(59,191,185,0.2)',
  },
  name: { fontWeight: 600, color: 'rgba(255,255,255,0.85)', fontSize: 14, transition: 'color 0.12s' },
  email: { fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 1 },
  tierBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
  },
  pts: { fontWeight: 700, color: '#3bbfb9' },
};
