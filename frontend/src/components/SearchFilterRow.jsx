import React from 'react';

export default function SearchFilterRow({
  value,
  options,
  onAttrChange,
  onQueryChange,
  placeholder = 'Search...'
}) {
  return (
    <div className="search-row">
      <select
        className="search-select"
        value={value.attr}
        onChange={(e) => onAttrChange(e.target.value)}
      >
        {(options || []).map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <input
        className="search-input"
        placeholder={placeholder}
        value={value.q}
        onChange={(e) => onQueryChange(e.target.value)}
      />
    </div>
  );
}
