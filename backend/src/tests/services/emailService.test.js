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

  function loadEmailServiceWithSendgrid(sendgridMock) {
    jest.resetModules();
    jest.doMock('@sendgrid/mail', () => sendgridMock);
    // eslint-disable-next-line global-require
    return require('../../services/emailService');
  }

  test('sendOtpEmail: missing SENDGRID_API_KEY => returns sendgrid-not-configured', async () => {
    const sendgrid = { setApiKey: jest.fn(), send: jest.fn() };
    const { sendOtpEmail } = loadEmailServiceWithSendgrid(sendgrid);

    delete process.env.SENDGRID_API_KEY;
    const result = await sendOtpEmail('a@example.com', '123456');

    expect(result).toMatchObject({ sent: false, reason: 'sendgrid-not-configured', previewUrl: null });
    expect(sendgrid.setApiKey).not.toHaveBeenCalled();
    expect(sendgrid.send).not.toHaveBeenCalled();
  });

  test('sendOtpEmail: SendGrid configured => sends email and returns messageId', async () => {
    process.env.SENDGRID_API_KEY = 'SG.key';
    process.env.SMTP_FROM = 'noreply@chesshive.com';

    const sendgrid = {
      setApiKey: jest.fn(),
      send: jest.fn(async () => ([{ headers: { 'x-message-id': 'mid-1' } }]))
    };
    const { sendOtpEmail } = loadEmailServiceWithSendgrid(sendgrid);

    const result = await sendOtpEmail('a@example.com', '654321', 'Test OTP');
    expect(sendgrid.setApiKey).toHaveBeenCalledWith('SG.key');
    expect(sendgrid.send).toHaveBeenCalledWith(expect.objectContaining({
      to: 'a@example.com',
      from: 'noreply@chesshive.com',
      subject: 'Test OTP'
    }));
    expect(result).toMatchObject({ sent: true, messageId: 'mid-1', previewUrl: null });
  });

  test('sendAdminInviteEmail: missing recipient => returns reason', async () => {
    const sendgrid = { setApiKey: jest.fn(), send: jest.fn() };
    const { sendAdminInviteEmail } = loadEmailServiceWithSendgrid(sendgrid);
    const result = await sendAdminInviteEmail('', 'https://invite', 'Admin');
    expect(result).toMatchObject({ attempted: false, sent: false, reason: 'missing-recipient' });
  });

  test('sendAdminInviteEmail: send failure => returns sendgrid-failed and logs response body', async () => {
    process.env.SENDGRID_API_KEY = 'SG.key';
    process.env.SMTP_FROM = 'noreply@chesshive.com';

    const err = new Error('send-failed');
    err.response = { body: { errors: [{ message: 'Bad request' }] } };

    const sendgrid = {
      setApiKey: jest.fn(),
      send: jest.fn(async () => {
        throw err;
      })
    };
    const { sendAdminInviteEmail } = loadEmailServiceWithSendgrid(sendgrid);

    const result = await sendAdminInviteEmail('a@example.com', 'https://invite', 'Admin');
    expect(result).toMatchObject({ attempted: true, sent: false, reason: 'sendgrid-failed', previewUrl: null });
  });
});

