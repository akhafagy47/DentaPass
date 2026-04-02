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
    background: 'var(--dp-inp)',
    border: '1px solid var(--dp-bdr)',
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
    color: 'var(--dp-t3)',
    cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s',
  },
  active: {
    background: 'rgba(59,191,185,0.15)',
    color: '#3bbfb9',
    fontWeight: 700,
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
  },
};
