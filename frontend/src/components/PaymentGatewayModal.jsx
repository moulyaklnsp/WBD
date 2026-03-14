import React, { useState, useEffect } from 'react';

const MAX_TOPUP = 50000;
const MAX_BALANCE = 100000;

function formatCardNumber(v) {
  return v.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ');
}

function formatExpiry(v) {
  const d = v.replace(/\D/g, '').slice(0, 4);
  if (d.length <= 2) return d;
  return d.slice(0, 2) + '/' + d.slice(2);
}

function detectCardType(num) {
  const n = num.replace(/\s/g, '');
  if (n.startsWith('4')) return 'visa';
  if (/^5[1-5]/.test(n)) return 'mastercard';
  if (/^3[47]/.test(n)) return 'amex';
  if (n.startsWith('6')) return 'rupay';
  return null;
}

function CardTypeBadge({ type }) {
  const labels = { visa: 'VISA', mastercard: 'MC', amex: 'AMEX', rupay: 'RuPay' };
  const colors = { visa: '#1a1f71', mastercard: '#eb001b', amex: '#007bc1', rupay: '#097a3e' };
  if (!type) return null;
  return (
    <span style={{
      background: colors[type], color: '#fff', fontSize: '0.65rem', fontWeight: 900,
      padding: '0.15rem 0.4rem', borderRadius: 4, letterSpacing: '0.05em', fontFamily: 'sans-serif'
    }}>{labels[type]}</span>
  );
}

const PROCESSING_STEPS = [
  { label: 'Verifying card details…', dur: 900 },
  { label: 'Contacting bank…', dur: 900 },
  { label: 'Processing payment…', dur: 700 },
];

export default function PaymentGatewayModal({ walletBalance = 0, onClose, onSuccess }) {
  const [step, setStep] = useState('form'); // form | processing | success | error
  const [amount, setAmount] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [showCvv, setShowCvv] = useState(false);
  const [errMsg, setErrMsg] = useState('');
  const [procStep, setProcStep] = useState(0);
  const [resultBalance, setResultBalance] = useState(null);

  const cardType = detectCardType(cardNumber);
  const maxAllowed = Math.min(MAX_TOPUP, Math.max(0, MAX_BALANCE - walletBalance));

  // Processing step animation
  useEffect(() => {
    if (step !== 'processing') return;
    let idx = 0;
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
    if (cardName.trim().length < 2) return 'Enter cardholder name';
    const raw = cardNumber.replace(/\s/g, '');
    if (raw.length !== 16) return 'Card number must be 16 digits';
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry)) return 'Enter valid expiry (MM/YY)';
    const [mm, yy] = expiry.split('/').map(Number);
    const now = new Date();
    const expDate = new Date(2000 + yy, mm - 1, 1);
    if (expDate < new Date(now.getFullYear(), now.getMonth(), 1)) return 'Card has expired';
    if (cvv.length < 3) return 'Enter valid CVV';
    return null;
  };

  const handlePay = async () => {
    const err = validate();
    if (err) { setErrMsg(err); return; }
    setErrMsg('');
    setStep('processing');

    const totalDelay = PROCESSING_STEPS.reduce((s, x) => s + x.dur, 0);
    await new Promise(r => setTimeout(r, totalDelay + 400));

    try {
      const res = await fetch('/player/api/add-funds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ amount: parseFloat(amount) }),
      });
      const data = await res.json();
      if (data.success) {
        setResultBalance(data.walletBalance);
        setStep('success');
        setTimeout(() => { onSuccess(data.walletBalance); onClose(); }, 2000);
      } else {
        setErrMsg(data.error || data.message || 'Payment failed');
        setStep('error');
      }
    } catch {
      setErrMsg('Connection error. Please try again.');
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

              {/* Card visual preview */}
              <div style={{ background: 'linear-gradient(135deg, #1b4332 0%, #2d6a4f 60%, #40916c 100%)', borderRadius: 14, padding: '1.1rem 1.3rem', marginBottom: '1.25rem', position: 'relative', minHeight: 90 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div style={{ width: 36, height: 26, background: 'rgba(255,220,100,0.85)', borderRadius: 4 }} />
                  <CardTypeBadge type={cardType} />
                </div>
                <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: '1.05rem', letterSpacing: '0.18em', fontFamily: 'monospace', marginBottom: '0.4rem' }}>
                  {cardNumber || '•••• •••• •••• ••••'}
                </div>
                <div style={{ display: 'flex', gap: '1.5rem', color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem' }}>
                  <span style={{ textTransform: 'uppercase' }}>{cardName || 'CARDHOLDER NAME'}</span>
                  <span>{expiry || 'MM/YY'}</span>
                </div>
              </div>

              {/* Card Number */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Card Number</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text" inputMode="numeric" maxLength={19}
                    value={cardNumber}
                    onChange={e => { setCardNumber(formatCardNumber(e.target.value)); setErrMsg(''); }}
                    placeholder="1234 5678 9012 3456"
                    style={{ width: '100%', padding: '0.7rem 2.5rem 0.7rem 0.85rem', background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.15)', borderRadius: 10, color: '#fff', fontSize: '1rem', letterSpacing: '0.12em', boxSizing: 'border-box' }}
                  />
                  <i className="fas fa-credit-card" style={{ position: 'absolute', right: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
                </div>
              </div>

              {/* Name */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Cardholder Name</label>
                <input
                  type="text"
                  value={cardName}
                  onChange={e => { setCardName(e.target.value.toUpperCase()); setErrMsg(''); }}
                  placeholder="AS ON CARD"
                  style={{ width: '100%', padding: '0.7rem 0.85rem', background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.15)', borderRadius: 10, color: '#fff', fontSize: '0.95rem', letterSpacing: '0.04em', boxSizing: 'border-box' }}
                />
              </div>

              {/* Expiry + CVV */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Expiry</label>
                  <input
                    type="text" inputMode="numeric" maxLength={5}
                    value={expiry}
                    onChange={e => { setExpiry(formatExpiry(e.target.value)); setErrMsg(''); }}
                    placeholder="MM/YY"
                    style={{ width: '100%', padding: '0.7rem 0.85rem', background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.15)', borderRadius: 10, color: '#fff', fontSize: '0.95rem', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>CVV</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showCvv ? 'text' : 'password'} inputMode="numeric" maxLength={4}
                      value={cvv}
                      onChange={e => { setCvv(e.target.value.replace(/\D/g, '').slice(0, 4)); setErrMsg(''); }}
                      placeholder="•••"
                      style={{ width: '100%', padding: '0.7rem 2.4rem 0.7rem 0.85rem', background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.15)', borderRadius: 10, color: '#fff', fontSize: '0.95rem', boxSizing: 'border-box' }}
                    />
                    <button onClick={() => setShowCvv(!showCvv)} type="button" style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 0 }}>
                      <i className={`fas fa-eye${showCvv ? '-slash' : ''}`} style={{ fontSize: '0.8rem' }} />
                    </button>
                  </div>
                </div>
              </div>

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
                <i className="fas fa-lock" style={{ marginRight: '0.3rem' }} />Your card info is never stored
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
