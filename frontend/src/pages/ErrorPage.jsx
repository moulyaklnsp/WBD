import React, { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function ErrorPage() {
  const location = useLocation();
  const [imageFailed, setImageFailed] = useState(false);
  const publicUrl = process.env.PUBLIC_URL || '';

  const { title, message, code } = useMemo(() => {
    const params = new URLSearchParams(location.search || '');
    return {
      title: params.get('title') || 'Error',
      message: params.get('message') || 'An unexpected error occurred. Please try again.',
      code: params.get('code') || ''
    };
  }, [location.search]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px',
        background: 'radial-gradient(1200px 500px at 50% 0%, rgba(255, 77, 0, 0.18), rgba(0,0,0,0) 60%), #0b0f16',
        color: '#e8eefc'
      }}
    >
      <div
        style={{
          width: 'min(980px, 100%)',
          borderRadius: 16,
          padding: 24,
          border: '1px solid rgba(255,255,255,0.12)',
          background: 'rgba(10, 14, 22, 0.78)',
          boxShadow: '0 16px 40px rgba(0,0,0,0.45)'
        }}
      >
        <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 380px' }}>
            <h1 style={{ margin: 0, fontSize: 42, letterSpacing: 1 }}>
              {title}{code ? ` (${code})` : ''}
            </h1>
            <p style={{ marginTop: 12, marginBottom: 18, fontSize: 16, lineHeight: 1.5, color: 'rgba(232,238,252,0.88)' }}>
              {message}
            </p>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link
                to="/"
                style={{
                  display: 'inline-block',
                  padding: '10px 14px',
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #ff5a1f, #ff2d55)',
                  color: '#fff',
                  textDecoration: 'none',
                  fontWeight: 700
                }}
              >
                Go Home
              </Link>
              <button
                type="button"
                onClick={() => window.location.reload()}
                style={{
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.18)',
                  background: 'transparent',
                  color: '#e8eefc',
                  cursor: 'pointer',
                  fontWeight: 700
                }}
              >
                Try Again
              </button>
            </div>
          </div>

          <div style={{ flex: '1 1 420px', display: 'flex', justifyContent: 'center' }}>
            <img
              src={imageFailed ? `${publicUrl}/images/error.svg` : `${publicUrl}/images/error.png`}
              alt="Error"
              onError={() => setImageFailed(true)}
              style={{ width: 'min(520px, 100%)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.12)' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

