import React from 'react';
import usePlayerTheme from '../hooks/usePlayerTheme';

// Simple reusable search + category filter component
export default function SearchFilter({ search, category, categories = [], onChange }) {
  const [isDark] = usePlayerTheme();

  return (
    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
      {/* Search Input */}
      <div style={{ position: 'relative', flex: '1 1 340px', minWidth: 0 }}>
        <i className="fas fa-search" style={{
          position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)',
          color: '#2E8B57', fontSize: '1.2rem', pointerEvents: 'none'
        }} />
        <input
          type="search"
          placeholder="Search products..."
          value={search}
          onChange={(e) => onChange({ search: e.target.value, category })}
          style={{
            width: '100%',
            padding: '0.85rem 1rem 0.85rem 3rem',
            fontSize: '1rem',
            borderRadius: 12,
            border: `2px solid ${isDark ? '#2E8B57' : '#2E8B57'}`,
            backgroundColor: isDark ? '#0d1117' : '#ffffff',
            color: isDark ? '#ffffff' : '#1a1a1a',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.2s, box-shadow 0.2s',
            letterSpacing: '0.3px',
          }}
          onFocus={(e) => { e.target.style.boxShadow = '0 0 0 4px rgba(46,139,87,0.2)'; }}
          onBlur={(e) => { e.target.style.boxShadow = 'none'; }}
        />
      </div>
      {/* Category dropdown */}
      <select
        value={category || ''}
        onChange={(e) => onChange({ search, category: e.target.value })}
        style={{
          flex: '0 0 190px',
          width: '190px',
          maxWidth: '190px',
          minWidth: '160px',
          padding: '0.75rem 1rem',
          fontSize: '1rem',
          borderRadius: 10,
          border: `2px solid ${isDark ? '#555' : '#ccc'}`,
          backgroundColor: isDark ? '#0d1117' : '#ffffff',
          color: isDark ? '#ffffff' : '#1a1a1a',
          outline: 'none',
          cursor: 'pointer',
          boxSizing: 'border-box',
          transition: 'border-color 0.2s',
        }}
        onFocus={(e) => { e.target.style.borderColor = '#2E8B57'; }}
        onBlur={(e) => { e.target.style.borderColor = isDark ? '#555' : '#ccc'; }}
      >
        <option value="">All Categories</option>
        {categories.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
    </div>
  );
}
