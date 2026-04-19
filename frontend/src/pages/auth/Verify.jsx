import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const Verify = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('Verifying...');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('Invalid link');
      return;
    }

    // Send token to backend
    fetch('/api/verify-magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token })
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (data.success) {
          setStatus('Login successful! Redirecting...');
          setTimeout(() => {
            navigate(data.redirectUrl || '/');
          }, 2000);
        } else {
          setStatus(data.message || 'Verification failed');
        }
      })
      .catch((error) => {
        setStatus('Verification failed');
        console.error('Verify error:', error);
      });
  }, [searchParams, navigate]);

  return (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      <h2>{status}</h2>
    </div>
  );
};

export default Verify;
