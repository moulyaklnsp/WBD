function loadEmailServiceWithNodemailer(nodemailerMock) {
  jest.resetModules();
  jest.doMock('nodemailer', () => nodemailerMock);
  // eslint-disable-next-line global-require
  return require('../../services/emailService');
}

describe('emailService', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  test('sendOtpEmail: nodemailer missing => returns safe placeholder', async () => {
    const { sendOtpEmail } = loadEmailServiceWithNodemailer(null);
    const result = await sendOtpEmail('a@example.com', '123456');
    expect(result).toEqual({ previewUrl: null, messageId: null, info: null });
  });

  test('sendOtpEmail: no SMTP_HOST => uses Ethereal mocked transport', async () => {
    delete process.env.SMTP_HOST;
    const transporter = {
      sendMail: jest.fn(async () => ({ messageId: 'm1' }))
    };
    const nodemailer = {
      createTestAccount: jest.fn(async () => ({
        user: 'u',
        pass: 'p',
        smtp: { host: 'h', port: 123, secure: false }
      })),
      createTransport: jest.fn(() => transporter),
      getTestMessageUrl: jest.fn(() => 'https://preview.local/msg')
    };
    const { sendOtpEmail } = loadEmailServiceWithNodemailer(nodemailer);

    const result = await sendOtpEmail('a@example.com', '123456');
    expect(nodemailer.createTestAccount).toHaveBeenCalledTimes(1);
    expect(transporter.sendMail).toHaveBeenCalledTimes(1);
    expect(result.previewUrl).toBe('https://preview.local/msg');
    expect(result.messageId).toBe('m1');
  });

  test('sendOtpEmail: SMTP_HOST set => uses SMTP transport and tolerates verify() errors', async () => {
    process.env.SMTP_HOST = 'smtp.local';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_SECURE = 'false';
    process.env.SMTP_USER = 'user';
    process.env.SMTP_PASS = 'pass';
    process.env.SMTP_FROM = '"ChessHive" <noreply@local>';

    const transporter = {
      verify: jest.fn(async () => {
        throw new Error('verify-failed');
      }),
      sendMail: jest.fn(async () => ({ messageId: 'm2', envelope: { to: ['a@example.com'] } }))
    };
    const nodemailer = {
      createTestAccount: jest.fn(),
      createTransport: jest.fn(() => transporter),
      getTestMessageUrl: jest.fn()
    };
    const { sendOtpEmail } = loadEmailServiceWithNodemailer(nodemailer);

    const result = await sendOtpEmail('a@example.com', '654321');
    expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
    expect(transporter.verify).toHaveBeenCalledTimes(1);
    expect(transporter.sendMail).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ previewUrl: null, messageId: 'm2' });
  });

  test('sendAdminInviteEmail: missing recipient => returns reason', async () => {
    const { sendAdminInviteEmail } = loadEmailServiceWithNodemailer(null);
    const result = await sendAdminInviteEmail('', 'https://invite', 'Admin');
    expect(result).toMatchObject({ sent: false, reason: 'missing-recipient' });
  });

  test('sendAdminInviteEmail: nodemailer missing => returns nodemailer-missing', async () => {
    const { sendAdminInviteEmail } = loadEmailServiceWithNodemailer(null);
    const result = await sendAdminInviteEmail('a@example.com', 'https://invite', 'Admin');
    expect(result).toMatchObject({ sent: false, reason: 'nodemailer-missing' });
  });

  test('sendAdminInviteEmail: no SMTP config => uses Ethereal mocked transport', async () => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;

    const transporter = {
      sendMail: jest.fn(async () => ({ messageId: 'mid' }))
    };
    const nodemailer = {
      createTestAccount: jest.fn(async () => ({
        user: 'u',
        pass: 'p',
        smtp: { host: 'h', port: 123, secure: false }
      })),
      createTransport: jest.fn(() => transporter),
      getTestMessageUrl: jest.fn(() => 'https://preview.local/invite')
    };
    const { sendAdminInviteEmail } = loadEmailServiceWithNodemailer(nodemailer);

    const result = await sendAdminInviteEmail('a@example.com', 'https://invite', 'Admin');
    expect(result).toMatchObject({ sent: true, previewUrl: 'https://preview.local/invite', messageId: 'mid' });
  });

  test('sendAdminInviteEmail: SMTP transport failure => smtp-failed', async () => {
    process.env.SMTP_HOST = 'smtp.local';
    const transporter = {
      sendMail: jest.fn(async () => {
        throw new Error('send-failed');
      })
    };
    const nodemailer = {
      createTestAccount: jest.fn(),
      createTransport: jest.fn(() => transporter),
      getTestMessageUrl: jest.fn()
    };
    const { sendAdminInviteEmail } = loadEmailServiceWithNodemailer(nodemailer);

    const result = await sendAdminInviteEmail('a@example.com', 'https://invite', 'Admin');
    expect(result).toMatchObject({ sent: false, reason: 'smtp-failed' });
  });
});

