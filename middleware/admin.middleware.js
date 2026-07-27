const crypto = require('crypto');

function createCsrfToken(req) {
  const token = crypto.randomBytes(32).toString('hex');
  req.session.csrfToken = token;
  return token;
}

function safeEqual(leftValue, rightValue) {
  const left = Buffer.from(String(leftValue || ''));
  const right = Buffer.from(String(rightValue || ''));

  if (left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(left, right);
}

function isSameOrigin(req) {
  const origin = req.get('origin');
  const fetchSite = req.get('sec-fetch-site');

  if (fetchSite && !['same-origin', 'same-site', 'none'].includes(fetchSite)) {
    return false;
  }

  if (!origin) {
    return true;
  }

  try {
    return new URL(origin).host === req.get('host');
  } catch {
    return false;
  }
}

function requireAdminPage(req, res, next) {
  if (req.session?.isAdmin === true) {
    return next();
  }

  return res.redirect('/admin/login');
}

function redirectAuthenticatedAdmin(req, res, next) {
  if (req.session?.isAdmin === true) {
    return res.redirect('/admin/works');
  }

  return next();
}

function requireAdminApi(req, res, next) {
  if (req.session?.isAdmin === true) {
    return next();
  }

  return res.status(401).json({
    message: 'Требуется авторизация.',
  });
}

function requireCsrf(req, res, next) {
  const sessionToken = req.session?.csrfToken;
  const requestToken = req.get('X-CSRF-Token');

  if (!safeEqual(sessionToken, requestToken)) {
    return res.status(403).json({
      message: 'Сессия устарела. Обновите страницу и повторите действие.',
    });
  }

  return next();
}

function requireSameOrigin(req, res, next) {
  if (isSameOrigin(req)) {
    return next();
  }

  return res.status(403).json({
    message: 'Запрос отклонён.',
  });
}

function getSessionPayload(req) {
  return {
    isAdmin: true,
    csrfToken: req.session.csrfToken || createCsrfToken(req),
  };
}

module.exports = {
  createCsrfToken,
  safeEqual,
  requireAdminPage,
  redirectAuthenticatedAdmin,
  requireAdminApi,
  requireCsrf,
  requireSameOrigin,
  getSessionPayload,
};
