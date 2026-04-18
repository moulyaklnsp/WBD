import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';

export default function ImageCarousel({ images = [], maxHeight = 400, className = '', style = {} }) {
  const normalized = useMemo(
    () => (Array.isArray(images) ? images.filter((img) => typeof img === 'string' && img.trim()) : []),
    [images]
  );
  const normalizedKey = useMemo(() => normalized.join('|'), [normalized]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [normalizedKey]);

  if (normalized.length === 0) return null;

  const total = normalized.length;
  const current = normalized[index];
  const canNavigate = total > 1;

  const goPrev = () => setIndex((i) => (i - 1 + total) % total);
  const goNext = () => setIndex((i) => (i + 1) % total);

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style
      }}
    >
      <button
        type="button"
        onClick={goPrev}
        disabled={!canNavigate}
        aria-label="Previous image"
        style={{
          position: 'absolute',
          left: 8,
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'rgba(0, 0, 0, 0.45)',
          border: 'none',
          color: '#fff',
          width: 36,
          height: 36,
          borderRadius: 18,
          cursor: canNavigate ? 'pointer' : 'default',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: canNavigate ? 1 : 0.5
        }}
      >
        <i className="fas fa-chevron-left" />
      </button>

      <div
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 44px'
        }}
      >
        <motion.img
          key={current}
          src={current}
          alt="Blog"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
          style={{
            maxWidth: '100%',
            maxHeight: maxHeight,
            width: '100%',
            height: 'auto',
            objectFit: 'contain',
            borderRadius: 8,
            border: '1px solid rgba(46, 139, 87, 0.3)'
          }}
        />
      </div>

      <button
        type="button"
        onClick={goNext}
        disabled={!canNavigate}
        aria-label="Next image"
        style={{
          position: 'absolute',
          right: 8,
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'rgba(0, 0, 0, 0.45)',
          border: 'none',
          color: '#fff',
          width: 36,
          height: 36,
          borderRadius: 18,
          cursor: canNavigate ? 'pointer' : 'default',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: canNavigate ? 1 : 0.5
        }}
      >
        <i className="fas fa-chevron-right" />
      </button>

      {total > 1 && (
        <div
          style={{
            position: 'absolute',
            bottom: 10,
            right: 16,
            background: 'rgba(0, 0, 0, 0.55)',
            color: '#fff',
            padding: '0.2rem 0.6rem',
            borderRadius: 999,
            fontSize: '0.75rem'
          }}
        >
          {index + 1} / {total}
        </div>
      )}
    </div>
  );
}
