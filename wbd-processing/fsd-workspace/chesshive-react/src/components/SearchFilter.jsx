import React from 'react';
import usePlayerTheme from '../hooks/usePlayerTheme';

// Simple reusable search + category filter component
export default function SearchFilter({ search, category, categories = [], onChange }) {
  const [isDark] = usePlayerTheme();

  const baseStyles = {
    padding: 8,
    borderRadius: 6,
    border: `1px solid ${isDark ? '#444' : '#ddd'}`,
  };

  const fieldStyles = {
    ...baseStyles,
    backgroundColor: isDark ? '#000' : '#fff',
    color: isDark ? '#fff' : '#000',
  };

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
      <input
        type="search"
        placeholder="Search items..."
        value={search}
        onChange={(e) => onChange({ search: e.target.value, category })}
        style={{ ...fieldStyles, flex: 1 }}
      />
      <select
        value={category || ''}
        onChange={(e) => onChange({ search, category: e.target.value })}
        style={fieldStyles}
      >
        <option value="">All Categories</option>
        {categories.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
    </div>
  );
}
