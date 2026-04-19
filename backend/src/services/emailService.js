let sgMail;
try { sgMail = require('@sendgrid/mail'); } catch (e) { sgMail = null; }

const SENDGRID_TIMEOUT_MS = 7000;

let sendgridInitialized = false;

function initSendgrid() {
  if (sendgridInitialized) return true;
  if (!sgMail) {
    console.error('[email] @sendgrid/mail not installed');
    return false;
  }
  const apiKey = process.env.SENDGRID_API_KEY?.trim();
  if (!apiKey) {
    console.error('[email] SENDGRID_API_KEY is missing');
    return false;
  }
  sgMail.setApiKey(apiKey);
  sendgridInitialized = true;
  return true;
}

function withTimeout(promise, timeoutMs, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label || 'operation'} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    Promise.resolve(promise)
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function extractSendgridMessageId(sendResult) {
  const response = Array.isArray(sendResult) ? sendResult[0] : sendResult;
  const headers = response?.headers || {};
  return headers['x-message-id'] || headers['X-Message-Id'] || headers['x-message-id'.toLowerCase()] || null;
}

async function sendEmail({ to, subject, text, html }) {
  const safeTo = String(to || '').trim();
  if (!safeTo) return { attempted: false, sent: false, success: false, emailSent: false, messageId: null, reason: 'missing-recipient', provider: 'sendgrid' };

  if (!initSendgrid()) {
    return { attempted: true, sent: false, success: false, emailSent: false, messageId: null, reason: 'sendgrid-not-configured', provider: 'sendgrid' };
  }

  const msg = {
    to: safeTo,
    from: process.env.SMTP_FROM || 'noreply@chesshive.com',
    subject: subject || '',
    text: text || ''
  };
  if (html) msg.html = html;

  try {
    const sendResult = await withTimeout(sgMail.send(msg), SENDGRID_TIMEOUT_MS, 'SendGrid send');
    const messageId = extractSendgridMessageId(sendResult);
    return { attempted: true, sent: true, success: true, emailSent: true, messageId, provider: 'sendgrid' };
  } catch (err) {
    console.error('[email] SendGrid send failed:', err?.message || err);
    if (err?.response?.body) {
      console.error('[email] SendGrid error response body:', err.response.body);
    }
    return { attempted: true, sent: false, success: false, emailSent: false, messageId: null, reason: 'sendgrid-failed', provider: 'sendgrid', error: err?.message || String(err) };
  }
}

async function sendOtpEmail(to, otp, subject = 'Your ChessHive OTP') {
  const safeTo = String(to || '').trim();
  console.log(`Generated OTP for ${safeTo}: ${otp}`);

  try {
    const result = await sendEmail({
      to: safeTo,
      subject,
      text: `Your OTP is: ${otp}. It expires in 5 minutes.`
    });

    if (!result?.sent) {
      console.log(`OTP for ${safeTo}: ${otp}`);
    }

    // Keep legacy fields for callers/tests that may read them.
    return { ...result, previewUrl: null, info: null };
  } catch (err) {
    console.error('[email] Unexpected sendOtpEmail error:', err);
    console.log(`OTP for ${safeTo}: ${otp}`);
    return { attempted: true, sent: false, success: false, emailSent: false, messageId: null, reason: 'unexpected-error', provider: 'sendgrid', previewUrl: null, info: null };
  }
}

async function sendForgotPasswordOtp(to, otp) {
  const safeTo = String(to || '').trim();
  console.log(`Generated Forgot Password OTP for ${safeTo}: ${otp}`);

  const htmlTemplate = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #071327; color: #FFFDD0;">
      <h2 style="color: #2E8B57; text-align: center;">ChessHive Password Reset</h2>
      <p>You have requested to reset your password.</p>
      <div style="background-color: rgba(46, 139, 87, 0.2); padding: 20px; border-radius: 10px; text-align: center; margin: 20px 0;">
        <p style="margin: 0; font-size: 14px;">Your OTP is:</p>
        <h1 style="color: #2E8B57; letter-spacing: 8px; margin: 10px 0;">${otp}</h1>
      </div>
      <p style="color: #ff6b6b; font-size: 12px;">This OTP is valid for 10 minutes only.</p>
      <p style="font-size: 12px; color: rgba(255, 253, 208, 0.7);">If you did not request this password reset, please ignore this email.</p>
    </div>
  `;

  try {
    const result = await sendEmail({
      to: safeTo,
      subject: 'ChessHive Password Reset OTP',
      text: `Your password reset OTP is: ${otp}\n\nThis OTP is valid for 10 minutes.\n\nIf you did not request this, please ignore this email.`,
      html: htmlTemplate
    });

    if (!result?.sent) {
      console.log(`OTP for ${safeTo}: ${otp}`);
    }

    return result;
  } catch (err) {
    console.error('[email] Unexpected sendForgotPasswordOtp error:', err);
    console.log(`OTP for ${safeTo}: ${otp}`);
    return { attempted: true, sent: false, success: false, emailSent: false, messageId: null, reason: 'unexpected-error', provider: 'sendgrid' };
  }
}

async function sendContactStatusEmail(to, payload = {}) {
  const safeTo = String(to || '').trim();
  if (!safeTo) return { attempted: false, sent: false, success: false, emailSent: false, messageId: null, reason: 'missing-recipient', provider: 'sendgrid' };

  const status = String(payload.status || 'pending').replace('_', ' ');
  const adminMessage = String(payload.adminMessage || '').trim();
  const userMessage = String(payload.userMessage || '').trim();
  const subject = `ChessHive Support Update: ${status}`;
  const text = [
    `Your support query status is now: ${status}.`,
    adminMessage ? `Admin message: ${adminMessage}` : '',
    userMessage ? `Your original query: ${userMessage}` : '',
    '',
    'Thank you,',
    'ChessHive Support Team'
  ].filter(Boolean).join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 20px; background:#071327; color:#FFFDD0;">
      <h2 style="color:#2E8B57;">ChessHive Support Update</h2>
      <p>Your support query status is now: <strong>${status}</strong></p>
      ${adminMessage ? `<p><strong>Admin message:</strong> ${adminMessage}</p>` : ''}
      ${userMessage ? `<p><strong>Your original query:</strong> ${userMessage}</p>` : ''}
    </div>
  `;

  const result = await sendEmail({ to: safeTo, subject, text, html });
  return { ...result, previewUrl: null };
}

async function sendAdminInviteEmail(to, inviteUrl, invitedBy) {
  const safeTo = String(to || '').trim();
  if (!safeTo) return { attempted: false, sent: false, success: false, emailSent: false, messageId: null, reason: 'missing-recipient', provider: 'sendgrid' };

  const inviter = String(invitedBy || 'ChessHive Admin').trim();
  const subject = 'ChessHive Admin Invite';
  const text = [
    `You have been invited by ${inviter} to join ChessHive as an admin.`,
    `Set your password using this link: ${inviteUrl}`,
    'This link expires in 24 hours.',
    '',
    'If you did not expect this invite, you can ignore this email.'
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 20px; background:#071327; color:#FFFDD0;">
      <h2 style="color:#2E8B57;">ChessHive Admin Invite</h2>
      <p>You have been invited by <strong>${inviter}</strong> to join ChessHive as an admin.</p>
      <p>Set your password using this link (valid for 24 hours):</p>
      <p><a href="${inviteUrl}" style="color:#2E8B57;">${inviteUrl}</a></p>
      <p style="font-size: 12px; color: rgba(255, 253, 208, 0.7);">If you did not expect this invite, you can ignore this email.</p>
    </div>
  `;

  const result = await sendEmail({ to: safeTo, subject, text, html });
  return { ...result, previewUrl: null };
}

module.exports = { sendOtpEmail, sendForgotPasswordOtp, sendContactStatusEmail, sendAdminInviteEmail };
