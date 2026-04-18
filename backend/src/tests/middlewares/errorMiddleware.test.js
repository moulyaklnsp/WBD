const { notFound, errorHandler } = require('../../middlewares/errorMiddleware');

function createRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.send = jest.fn(() => res);
  res.redirect = jest.fn(() => res);
  res.headersSent = false;
  return res;
}

function createReq({ path, origin, acceptsJson } = {}) {
  return {
    path: path || '/',
    xhr: false,
    get(name) {
      if (String(name).toLowerCase() === 'origin') return origin;
      return undefined;
    },
    accepts(type) {
      if (type === 'json') return Boolean(acceptsJson);
      return false;
    }
  };
}

describe('errorMiddleware', () => {
  describe('notFound', () => {
    test('JSON request => 404 JSON', () => {
      const req = createReq({ path: '/api/unknown' });
      const res = createRes();

      notFound(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Not Found' });
    });

    test('explicit /error path => 404 send', () => {
      const req = createReq({ path: '/error' });
      const res = createRes();

      notFound(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith('Not Found');
    });

    test('non-JSON request => 404 redirect to client error page (origin allowlist)', () => {
      const req = createReq({ path: '/some-page', origin: 'http://localhost:3000', acceptsJson: false });
      const res = createRes();

      notFound(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.redirect).toHaveBeenCalled();
      const redirectUrl = res.redirect.mock.calls[0][0];
      expect(redirectUrl).toContain('http://localhost:3000/error?');
      expect(redirectUrl).toContain('code=404');
    });
  });

  describe('errorHandler', () => {
    test('headers already sent => delegates to next(err)', () => {
      const err = new Error('boom');
      const req = createReq({ path: '/api/any' });
      const res = createRes();
      res.headersSent = true;
      const next = jest.fn();

      errorHandler(err, req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });

    test('JSON request => returns status + json', () => {
      const err = Object.assign(new Error('Bad input'), { statusCode: 400 });
      const req = createReq({ path: '/api/any' });
      const res = createRes();
      const next = jest.fn();

      errorHandler(err, req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Bad input' });
    });

    test('non-JSON request => redirects to /error with encoded message', () => {
      const err = Object.assign(new Error('Oops'), { status: 500 });
      const req = createReq({ path: '/page', origin: 'http://localhost:3000', acceptsJson: false });
      const res = createRes();
      const next = jest.fn();

      errorHandler(err, req, res, next);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.redirect).toHaveBeenCalled();
      const redirectUrl = res.redirect.mock.calls[0][0];
      expect(redirectUrl).toContain('/error?');
      expect(redirectUrl).toContain('code=500');
    });
  });
});

