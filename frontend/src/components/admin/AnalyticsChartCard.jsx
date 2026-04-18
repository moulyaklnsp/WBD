import React from 'react';
import { motion } from 'framer-motion';

export default function AnalyticsChartCard({ title, icon, children, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        borderRadius: 14,
        padding: '1rem'
      }}
    >
      <h3 style={{ margin: 0, marginBottom: '0.8rem', color: 'var(--sea-green)', fontFamily: 'Cinzel, serif', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
        {icon}
        {title}
      </h3>
      <div style={{ height: 320 }}>
        {children}
      </div>
    </motion.div>
  );
}
