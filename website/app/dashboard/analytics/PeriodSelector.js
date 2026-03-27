'use client';

import { useRouter, useSearchParams } from 'next/navigation';

const PERIODS = [
  { value: '7d',  label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: '12m', label: '12 months' },
];

export default function PeriodSelector({ current }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function select(value) {
    const p = new URLSearchParams(searchParams.toString());
    p.set('period', value);
    router.push(`/dashboard/analytics?${p.toString()}`);
  }

  return (
    <div style={s.wrap}>
      {PERIODS.map((p) => (
        <button
          key={p.value}
          onClick={() => select(p.value)}
          style={{
            ...s.btn,
            ...(current === p.value ? s.active : {}),
          }}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

const s = {
  wrap: {
    display: 'inline-flex',
    background: '#f1f5f9',
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  btn: {
    padding: '6px 14px',
    borderRadius: 8,
    border: 'none',
    background: 'transparent',
    fontSize: 13,
    fontWeight: 500,
    color: '#64748b',
    cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s',
  },
  active: {
    background: '#fff',
    color: '#006FEE',
    fontWeight: 700,
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
};
