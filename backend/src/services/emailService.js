let nodemailer;
try { nodemailer = require('nodemailer'); } catch (e) { nodemailer = null; }

async function sendOtpEmail(to, otp, subject = 'Your ChessHive OTP') {
  console.log(`Generated OTP for ${to}: ${otp}`);

  if (!nodemailer) {
    console.log(`nodemailer not installed. OTP for ${to}: ${otp}`);
    return { previewUrl: null, messageId: null, info: null };
  }

  if (!process.env.SMTP_HOST) {
    try {
      const testAccount = await nodemailer.createTestAccount();
      const transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: { user: testAccount.user, pass: testAccount.pass }
      });
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || '',
        to,
        subject,
        text: `Your OTP is: ${otp}. It expires in 5 minutes.`
      });
      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log(`Ethereal OTP preview for ${to}: ${previewUrl}`);
      return { previewUrl, messageId: info && info.messageId, info };
    } catch (err) {
      console.error('Failed to send via Ethereal, falling back to console:', err);
      console.log(`OTP for ${to}: ${otp}`);
      return { previewUrl: null, messageId: null, info: null };
    }
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: (process.env.SMTP_SECURE === 'true'),
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
    });
    try {
      await transporter.verify();
      console.log('SMTP transporter verified');
    } catch (verErr) {
      console.warn('SMTP transporter verification failed:', verErr);
    }
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '',
      to,
      subject,
      text: `Your OTP is: ${otp}. It expires in 5 minutes.`
    });
    console.log('OTP email sent:', info && info.messageId, 'envelope:', info && info.envelope);
    return { previewUrl: null, messageId: info && info.messageId, info };
  } catch (err) {
    console.error('Failed to send OTP email, falling back to console:', err);
    console.log(`OTP for ${to}: ${otp}`);
    return { previewUrl: null, messageId: null, info: null };
  }
}

async function sendForgotPasswordOtp(to, otp) {
  console.log(`Generated Forgot Password OTP for ${to}: ${otp}`);

  if (!nodemailer) {
    console.log(`nodemailer not installed. OTP for ${to}: ${otp}`);
    return;
  }

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

  if (!process.env.SMTP_HOST) {
    try {
      const testAccount = await nodemailer.createTestAccount();
      const transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: { user: testAccount.user, pass: testAccount.pass }
      });
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || '"ChessHive" <noreply@chesshive.com>',
        to,
        subject: 'ChessHive Password Reset OTP',
        text: `Your password reset OTP is: ${otp}\n\nThis OTP is valid for 10 minutes.\n\nIf you did not request this, please ignore this email.`,
        html: htmlTemplate
      });
      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log(`Ethereal OTP preview for ${to}: ${previewUrl}`);
    } catch (err) {
      console.error('Failed to send via Ethereal:', err);
    }
  } else {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: (process.env.SMTP_SECURE === 'true'),
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
      });
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || '"ChessHive" <noreply@chesshive.com>',
        to,
        subject: 'ChessHive Password Reset OTP',
        text: `Your password reset OTP is: ${otp}\n\nThis OTP is valid for 10 minutes.\n\nIf you did not request this, please ignore this email.`,
        html: htmlTemplate
      });
      console.log('Password reset OTP email sent:', info && info.messageId);
    } catch (err) {
      console.error('Failed to send OTP email:', err);
    }
  }
}

async function sendContactStatusEmail(to, payload = {}) {
  const safeTo = String(to || '').trim();
  if (!safeTo) return { sent: false, reason: 'missing-recipient' };

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

  if (!nodemailer) {
    console.log(`Contact status update for ${safeTo}:`, { status, adminMessage });
    return { sent: false, reason: 'nodemailer-missing' };
  }

  const smtpHost = String(process.env.SMTP_HOST || '').trim();
  const smtpUser = String(process.env.SMTP_USER || '').trim();
  const smtpPass = String(process.env.SMTP_PASS || '').trim();
  const smtpFrom = String(process.env.SMTP_FROM || '').trim() || '"ChessHive" <noreply@chesshive.com>';

  if (!smtpHost && !(smtpUser && smtpPass)) {
    try {
      const testAccount = await nodemailer.createTestAccount();
      const transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: { user: testAccount.user, pass: testAccount.pass }
      });
      const info = await transporter.sendMail({
        from: smtpFrom,
        to: safeTo,
        subject,
        text,
        html
      });
      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log(`Ethereal contact update preview for ${safeTo}: ${previewUrl}`);
      return { sent: true, previewUrl, messageId: info?.messageId };
    } catch (err) {
      console.error('Failed to send contact update via Ethereal:', err);
      return { sent: false, reason: 'ethereal-failed' };
    }
  }

  try {
    const transporter = smtpHost
      ? nodemailer.createTransport({
          host: smtpHost,
          port: parseInt(process.env.SMTP_PORT || '587', 10),
          secure: (process.env.SMTP_SECURE === 'true'),
          auth: smtpUser ? { user: smtpUser, pass: smtpPass } : undefined
        })
      : nodemailer.createTransport({
          service: 'gmail',
          auth: { user: smtpUser, pass: smtpPass }
        });
    const info = await transporter.sendMail({
      from: smtpFrom,
      to: safeTo,
      subject,
      text,
      html
    });
    console.log('Contact status update email sent:', info?.messageId);
    return { sent: true, messageId: info?.messageId };
  } catch (err) {
    console.error('Failed to send contact status email:', err);
    return { sent: false, reason: 'smtp-failed' };
  }
}

async function sendAdminInviteEmail(to, inviteUrl, invitedBy) {
  const safeTo = String(to || '').trim();
  if (!safeTo) return { sent: false, reason: 'missing-recipient' };

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

  if (!nodemailer) {
    console.log(`Admin invite for ${safeTo}: ${inviteUrl}`);
    return { sent: false, reason: 'nodemailer-missing' };
  }

  const smtpHost = String(process.env.SMTP_HOST || '').trim();
  const smtpUser = String(process.env.SMTP_USER || '').trim();
  const smtpPass = String(process.env.SMTP_PASS || '').trim();
  const smtpFrom = String(process.env.SMTP_FROM || '').trim() || '"ChessHive" <noreply@chesshive.com>';

  if (!smtpHost && !(smtpUser && smtpPass)) {
    try {
      const testAccount = await nodemailer.createTestAccount();
      const transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: { user: testAccount.user, pass: testAccount.pass }
      });
      const info = await transporter.sendMail({
        from: smtpFrom,
        to: safeTo,
        subject,
        text,
        html
      });
      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log(`Ethereal admin invite preview for ${safeTo}: ${previewUrl}`);
      return { sent: true, previewUrl, messageId: info?.messageId };
    } catch (err) {
      console.error('Failed to send admin invite via Ethereal:', err);
      return { sent: false, reason: 'ethereal-failed' };
    }
  }

  try {
    const transporter = smtpHost
      ? nodemailer.createTransport({
          host: smtpHost,
          port: parseInt(process.env.SMTP_PORT || '587', 10),
          secure: (process.env.SMTP_SECURE === 'true'),
          auth: smtpUser ? { user: smtpUser, pass: smtpPass } : undefined
        })
      : nodemailer.createTransport({
          service: 'gmail',
          auth: { user: smtpUser, pass: smtpPass }
        });
    const info = await transporter.sendMail({
      from: smtpFrom,
      to: safeTo,
      subject,
      text,
      html
    });
    console.log('Admin invite email sent:', info?.messageId);
    return { sent: true, messageId: info?.messageId };
  } catch (err) {
    console.error('Failed to send admin invite email:', err);
    return { sent: false, reason: 'smtp-failed' };
  }
}

module.exports = { sendOtpEmail, sendForgotPasswordOtp, sendContactStatusEmail, sendAdminInviteEmail };
