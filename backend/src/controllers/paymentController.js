const { createOrder, verifyPaymentSignature } = require('../services/razorpayService');
const { connectDB } = require('../config/database');

const createRazorpayOrder = async (req, res) => {
  if (!req.session.userEmail) return res.status(401).json({ error: 'Please log in' });
  const { amount } = req.body;
  const numeric = Number(amount);
  if (!Number.isFinite(numeric) || numeric <= 0) return res.status(400).json({ error: 'Invalid amount' });
  try {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      console.error('Razorpay keys missing in environment');
      return res.status(500).json({ error: 'Razorpay not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend/.env' });
    }
    // Razorpay expects amount in paise
    const order = await createOrder({ amount: Math.round(numeric * 100), currency: 'INR', receipt: `topup_${Date.now()}` });
    return res.json({ success: true, orderId: order.id, amount: order.amount, currency: order.currency, keyId: process.env.RAZORPAY_KEY_ID });
  } catch (e) {
    console.error('Failed to create razorpay order:', e);
    return res.status(500).json({ error: 'Failed to create order' });
  }
};

const verifyRazorpayPayment = async (req, res) => {
  if (!req.session.userEmail) return res.status(401).json({ error: 'Please log in' });
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount, purpose } = req.body || {};
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) return res.status(400).json({ error: 'Missing payment fields' });
  try {
    const ok = verifyPaymentSignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature });
    if (!ok) return res.status(400).json({ error: 'Invalid signature' });

    // Persist payment and apply business logic
    const db = await connectDB();
    const user = await db.collection('users').findOne({ email: req.session.userEmail, role: 'player' });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const rupees = (Number(amount) || 0) / 100; // convert paise to INR

    if (purpose === 'topup') {
      const balanceDoc = await db.collection('user_balances').findOne({ user_id: user._id });
      const newBalance = Math.min(Number(balanceDoc?.wallet_balance || 0) + rupees, 100000);
      await db.collection('user_balances').updateOne({ user_id: user._id }, { $set: { wallet_balance: newBalance } }, { upsert: true });
      await db.collection('payments').insertOne({ user_id: user._id, amount: rupees, method: 'razorpay', razorpay: { order_id: razorpay_order_id, payment_id: razorpay_payment_id }, purpose: 'topup', createdAt: new Date() });
      return res.json({ success: true, walletBalance: newBalance });
    }

    // Fallback: record payment only
    await db.collection('payments').insertOne({ user_id: user._id, amount: rupees, method: 'razorpay', razorpay: { order_id: razorpay_order_id, payment_id: razorpay_payment_id }, purpose: purpose || 'unknown', createdAt: new Date() });
    return res.json({ success: true });
  } catch (e) {
    console.error('Failed to verify razorpay payment:', e);
    return res.status(500).json({ error: 'Verification failed' });
  }
};

module.exports = { createRazorpayOrder, verifyRazorpayPayment };
