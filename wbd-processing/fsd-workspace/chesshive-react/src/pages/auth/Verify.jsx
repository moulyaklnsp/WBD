import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';

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
    axios.post('http://localhost:3000/api/verify-magic-link', { token })
      .then(response => {
        if (response.data.success) {
          setStatus('Login successful! Redirecting...');
          // Redirect to dashboard or home
          setTimeout(() => {
            navigate('/'); // or to the redirectUrl from response
          }, 2000);
        } else {
          setStatus(response.data.message || 'Verification failed');
        }
      })
      .catch(error => {
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