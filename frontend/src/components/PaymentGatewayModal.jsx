import React, { useState, useEffect } from 'react';

const MAX_TOPUP = 50000;
const MAX_BALANCE = 100000;

const PROCESSING_STEPS = [
  { label: 'Creating payment order…', dur: 700 },
  { label: 'Opening checkout…', dur: 500 },
  { label: 'Verifying payment…', dur: 800 },
];

export default function PaymentGatewayModal({ walletBalance = 0, onClose, onSuccess }) {
  const [step, setStep] = useState('form'); // form | processing | success | error
  const [amount, setAmount] = useState('');
  const [errMsg, setErrMsg] = useState('');
  const [procStep, setProcStep] = useState(0);
  const [resultBalance, setResultBalance] = useState(null);
  const maxAllowed = Math.min(MAX_TOPUP, Math.max(0, MAX_BALANCE - walletBalance));

  // Processing step animation
  useEffect(() => {
    if (step !== 'processing') return;
    setProcStep(0);
    const timers = [];
    let cumulative = 0;
    PROCESSING_STEPS.forEach((s, i) => {
      const t = setTimeout(() => setProcStep(i + 1), cumulative);
      timers.push(t);
      cumulative += s.dur;
    });
    return () => timers.forEach(clearTimeout);
  }, [step]);

  const validate = () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return 'Enter a valid amount';
    if (amt > MAX_TOPUP) return `Max ₹${MAX_TOPUP.toLocaleString('en-IN')} per transaction`;
    if (walletBalance >= MAX_BALANCE) return `Wallet limit of ₹${MAX_BALANCE.toLocaleString('en-IN')} reached`;
    if (walletBalance + amt > MAX_BALANCE)
      return `You can add only ₹${maxAllowed.toLocaleString('en-IN')} more (wallet limit ₹${MAX_BALANCE.toLocaleString('en-IN')})`;
    return null;
  };

  const handlePay = async () => {
    const err = validate();
    if (err) { setErrMsg(err); return; }
    setErrMsg('');
    setStep('processing');

    try {
      const res = await fetch('/player/api/razorpay/create-order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ amount: parseFloat(amount) })
      });
      const data = await res.json();
      if (!data || !data.success) {
        setErrMsg(data?.error || 'Failed to create payment order');
        setStep('error');
        return;
      }

      const { orderId, amount: orderAmount, currency, keyId } = data;

      // Fetch profile to prefill checkout fields (name, email, contact)
      let profile = null;
      try {
        const pRes = await fetch('/player/api/profile', { credentials: 'include' });
        if (pRes.ok) profile = await pRes.json();
      } catch (e) {
        console.warn('Failed to fetch profile for prefill', e);
      }

      // Load Razorpay checkout script if not present
      if (!window.Razorpay) {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://checkout.razorpay.com/v1/checkout.js';
          s.async = true;
          s.onload = resolve; s.onerror = reject;
          document.body.appendChild(s);
        });
      }

      const options = {
        key: keyId || process.env.REACT_APP_RAZORPAY_KEY_ID || '',
        amount: orderAmount, // in paise
        currency: currency || 'INR',
        name: 'ChessHive Wallet Top-up',
        description: 'Add funds to wallet',
        order_id: orderId,
        prefill: {
          name: profile?.player?.name || '',
          email: profile?.player?.email || '',
          contact: profile?.player?.phone || ''
        },
        notes: { purpose: 'wallet_topup' },
        handler: async function (resp) {
          try {
            const verifyRes = await fetch('/player/api/razorpay/verify', {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
              body: JSON.stringify({ razorpay_order_id: resp.razorpay_order_id, razorpay_payment_id: resp.razorpay_payment_id, razorpay_signature: resp.razorpay_signature, amount: orderAmount, purpose: 'topup' })
            });
            const vdata = await verifyRes.json();
            if (vdata && vdata.success) {
              setResultBalance(vdata.walletBalance ?? null);
              setStep('success');
              setTimeout(() => { onSuccess(vdata.walletBalance); onClose(); }, 1500);
            } else {
              setErrMsg(vdata?.error || 'Verification failed');
              setStep('error');
            }
          } catch (e) {
            console.error('Verification request failed', e);
            setErrMsg('Verification request failed');
            setStep('error');
          }
        },
        modal: { ondismiss: () => { if (step !== 'processing') setStep('form'); } }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();

    } catch (e) {
      console.error('Razorpay flow failed', e);
      setErrMsg('Payment initialization failed. Try again.');
      setStep('error');
    }
  };

  const overlay = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 9999, padding: '1rem',
  };
  const modal = {
    background: '#1a1d2e', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 18, width: '100%', maxWidth: 420,
    boxShadow: '0 24px 64px rgba(0,0,0,0.6)', overflow: 'hidden',
    fontFamily: "'Segoe UI', sans-serif",
  };

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && step !== 'processing' && onClose()}>
      <div style={modal}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #1b4332 0%, #2d6a4f 100%)', padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fas fa-lock" style={{ color: '#fff', fontSize: '1rem' }} />
            </div>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: '1rem', letterSpacing: '0.02em' }}>Secure Payment</div>
              <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.75rem' }}>256-bit SSL encrypted</div>
            </div>
          </div>
          {step !== 'processing' && (
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', width: 30, height: 30, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fas fa-times" />
            </button>
          )}
        </div>

        <div style={{ padding: '1.5rem' }}>

          {/* ─── FORM STATE ─── */}
          {step === 'form' && (
            <>
              {/* Amount */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Amount to Add
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.5)', fontSize: '1rem', fontWeight: 700 }}>₹</span>
                  <input
                    type="number" min="1" max={maxAllowed} step="1"
                    value={amount}
                    onChange={e => { setAmount(e.target.value); setErrMsg(''); }}
                    placeholder={`1 – ${maxAllowed.toLocaleString('en-IN')}`}
                    style={{ width: '100%', padding: '0.75rem 0.85rem 0.75rem 2rem', background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.15)', borderRadius: 10, color: '#fff', fontSize: '1.1rem', fontWeight: 700, boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem', marginTop: '0.35rem' }}>
                  Wallet: ₹{walletBalance.toLocaleString('en-IN')} / ₹{MAX_BALANCE.toLocaleString('en-IN')} &nbsp;|&nbsp; Max per transaction: ₹{MAX_TOPUP.toLocaleString('en-IN')}
                </div>
              </div>

              {/* Card fields removed — using Razorpay checkout directly */}

              {errMsg && (
                <div style={{ background: 'rgba(231,76,60,0.15)', border: '1px solid rgba(231,76,60,0.4)', borderRadius: 8, padding: '0.6rem 0.85rem', color: '#ff7675', fontSize: '0.85rem', marginBottom: '1rem' }}>
                  <i className="fas fa-exclamation-circle" style={{ marginRight: '0.4rem' }} />{errMsg}
                </div>
              )}

              <button
                onClick={handlePay}
                style={{ width: '100%', padding: '0.9rem', background: 'linear-gradient(135deg, #2d6a4f, #40916c)', border: 'none', borderRadius: 12, color: '#fff', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.03em', transition: 'filter 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.1)'}
                onMouseLeave={e => e.currentTarget.style.filter = ''}
              >
                <i className="fas fa-shield-alt" style={{ marginRight: '0.5rem' }} />
                Pay ₹{parseFloat(amount) > 0 ? parseFloat(amount).toLocaleString('en-IN') : '–'}
              </button>

              <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '0.72rem', marginTop: '0.75rem' }}>
                <i className="fas fa-lock" style={{ marginRight: '0.3rem' }} />You will be redirected to Razorpay checkout to enter card or UPI details securely
              </div>
            </>
          )}

          {/* ─── PROCESSING STATE ─── */}
          {step === 'processing' && (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <div style={{ width: 64, height: 64, border: '4px solid rgba(255,255,255,0.1)', borderTop: '4px solid #40916c', borderRadius: '50%', margin: '0 auto 1.5rem', animation: 'spin 1s linear infinite' }} />
              <div style={{ color: '#fff', fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.5rem' }}>Processing Payment…</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', textAlign: 'left', maxWidth: 260, margin: '0 auto' }}>
                {PROCESSING_STEPS.map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: procStep > i ? '#40916c' : procStep === i ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.3)', fontSize: '0.9rem', transition: 'color 0.4s' }}>
                    {procStep > i
                      ? <i className="fas fa-check-circle" style={{ color: '#40916c', fontSize: '1rem' }} />
                      : procStep === i
                        ? <span style={{ width: 16, height: 16, border: '2px solid currentColor', borderTop: '2px solid transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                        : <span style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid currentColor', display: 'inline-block' }} />
                    }
                    {s.label}
                  </div>
                ))}
              </div>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* ─── SUCCESS STATE ─── */}
          {step === 'success' && (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <div style={{ width: 70, height: 70, borderRadius: '50%', background: 'rgba(64,145,108,0.2)', border: '3px solid #40916c', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                <i className="fas fa-check" style={{ fontSize: '2rem', color: '#40916c' }} />
              </div>
              <div style={{ color: '#40916c', fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.4rem' }}>Payment Successful!</div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>₹{parseFloat(amount).toLocaleString('en-IN')} added to your wallet</div>
              {resultBalance !== null && (
                <div style={{ color: '#fff', fontWeight: 700, fontSize: '1rem' }}>New Balance: ₹{Number(resultBalance).toLocaleString('en-IN')}</div>
              )}
            </div>
          )}

          {/* ─── ERROR STATE ─── */}
          {step === 'error' && (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <div style={{ width: 70, height: 70, borderRadius: '50%', background: 'rgba(231,76,60,0.15)', border: '3px solid #e74c3c', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                <i className="fas fa-times" style={{ fontSize: '2rem', color: '#e74c3c' }} />
              </div>
              <div style={{ color: '#e74c3c', fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>Payment Failed</div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>{errMsg}</div>
              <button onClick={() => { setStep('form'); setErrMsg(''); }}
                style={{ background: '#2d6a4f', border: 'none', color: '#fff', padding: '0.6rem 1.5rem', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>
                <i className="fas fa-redo" style={{ marginRight: '0.4rem' }} />Try Again
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
