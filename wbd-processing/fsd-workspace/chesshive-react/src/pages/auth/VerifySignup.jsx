import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { verifyMagicLink } from '../../features/auth/authSlice';

export default function VerifySignup() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [status, setStatus] = React.useState('verifying');

  React.useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      return;
    }

    const verify = async () => {
      try {
        const result = await dispatch(verifyMagicLink(token));
        if (result.meta.requestStatus === 'fulfilled') {
          setStatus('success');
          const redirectUrl = result.payload?.redirectUrl || '/';
          setTimeout(() => {
            window.location.href = redirectUrl;
          }, 2000);
        } else {
          setStatus('error');
        }
      } catch (err) {
        setStatus('error');
      }
    };

    verify();
  }, [searchParams, dispatch]);

  return (
    <div style={{ textAlign: 'center', padding: '2rem' }}>
      {status === 'verifying' && <p>Verifying your signup...</p>}
      {status === 'success' && <p>Signup verified successfully! Redirecting to your dashboard...</p>}
      {status === 'error' && <p>Verification failed. Please try signing up again.</p>}
    </div>
  );
}
