const Razorpay = require('razorpay');
const crypto = require('crypto');

const KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';

let instance = null;
if (KEY_ID && KEY_SECRET) {
  instance = new Razorpay({ key_id: KEY_ID, key_secret: KEY_SECRET });
} else {
  console.warn('Razorpay keys not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)');
}

async function createOrder({ amount /* in paise */, currency = 'INR', receipt }) {
  if (!instance) throw new Error('Razorpay not configured');
  const opts = { amount: Math.round(amount), currency, receipt: receipt || `rcpt_${Date.now()}` };
  const order = await instance.orders.create(opts);
  return order;
}

function verifyPaymentSignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  const hmac = crypto.createHmac('sha256', KEY_SECRET);
  hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
  const expected = hmac.digest('hex');
  return expected === razorpay_signature;
}

module.exports = { createOrder, verifyPaymentSignature, instance };
