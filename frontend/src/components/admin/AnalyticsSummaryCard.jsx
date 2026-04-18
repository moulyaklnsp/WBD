import React from 'react';

export default function AnalyticsSummaryCard({ icon, label, value }) {
  return (
    <div style={{
      background: 'var(--card-bg)',
      border: '1px solid var(--card-border)',
      borderRadius: 12,
      padding: '1rem'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', color: 'var(--sea-green)', fontFamily: 'Cinzel, serif', fontSize: '0.9rem' }}>
        {icon}
        <span>{label}</span>
      </div>
      <div style={{ marginTop: '0.45rem', fontSize: '1.35rem', fontWeight: 700 }}>
        {value}
      </div>
    </div>
  );
}
