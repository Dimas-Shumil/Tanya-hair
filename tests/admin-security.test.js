const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createCsrfToken,
  requireCsrf,
  requireSameOrigin,
  safeEqual,
} = require('../middleware/admin.middleware');

function callMiddleware(middleware, overrides = {}) {
  const req = {
    protocol: 'https',
    session: { isAdmin: true, csrfToken: 'server-csrf-token' },
    get(name) {
      const values = {
        'X-CSRF-Token': 'server-csrf-token',
        Origin: 'https://style-abakan.ru',
        Host: 'style-abakan.ru',
        'Sec-Fetch-Site': 'same-origin',
        ...overrides.headers,
      };
      const entry = Object.entries(values).find(([key]) => key.toLowerCase() === name.toLowerCase());
      return entry?.[1];
    },
    ...overrides,
  };
  let allowed = false;
  let status = 200;
  let response;
  const res = {
    status(code) { status = code; return this; },
    json(value) { response = value; return this; },
  };
  middleware(req, res, () => { allowed = true; });
  return { allowed, status, response };
}

test('strict same-origin request is permitted', () => {
  assert.equal(callMiddleware(requireSameOrigin).allowed, true);
});

test('cross-origin blocked, including same-site sibling origin', () => {
  const result = callMiddleware(requireSameOrigin, {
    headers: { Origin: 'https://evil.style-abakan.ru', 'Sec-Fetch-Site': 'same-site' },
  });
  assert.equal(result.status, 403);
  assert.equal(result.allowed, false);
});

test('http origin blocked for https origin target', () => {
  const result = callMiddleware(requireSameOrigin, {
    headers: { Origin: 'http://style-abakan.ru' },
  });
  assert.equal(result.status, 403);
});

test('CSRF token is mandatory for destructive requests', () => {
  const result = callMiddleware(requireCsrf, { headers: { 'X-CSRF-Token': '' } });
  assert.equal(result.status, 403);
  assert.equal(result.allowed, false);
  assert.equal(callMiddleware(requireCsrf).allowed, true);
});

test('CSRF stale token rejected with recoverable message', () => {
  const result = callMiddleware(requireCsrf, { headers: { 'X-CSRF-Token': 'stale' } });
  assert.equal(result.status, 403);
  assert.match(result.response.message, /^Сессия устарела\./);
});

test('constant-time equality, regenerated csrf', () => {
  assert.equal(safeEqual('a','a'), true);
  assert.equal(safeEqual('a','different'), false);
  const req = {session:{}};
  const token = createCsrfToken(req);
  assert.match(token,/^[a-f0-9]{64}$/);
  assert.equal(req.session.csrfToken,token);
});
