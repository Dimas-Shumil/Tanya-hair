const express = require('express');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const { asyncHandler, cleanText } = require('../middleware/request.middleware');
const {
  requireAdminApi,
  requireCsrf,
  requireSameOrigin,
  getSessionPayload,
  createCsrfToken,
  safeEqual,
} = require('../middleware/admin.middleware');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 7,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    message: 'Слишком много попыток входа. Попробуйте через 15 минут.',
  },
});

function createAdminRoutes(environment) {
  const router = express.Router();

  router.post(
    '/login',
    requireSameOrigin,
    loginLimiter,
    asyncHandler(async (req, res) => {
      const login = cleanText(req.body?.login, 100);
      const password = String(req.body?.password || '').slice(0, 200);

      if (!login || !password) {
        return res.status(400).json({
          message: 'Введите логин и пароль.',
        });
      }

      const isPasswordValid = await bcrypt.compare(
        password,
        environment.adminPasswordHash,
      );
      const isLoginValid = safeEqual(login, environment.adminLogin);

      if (!isLoginValid || !isPasswordValid) {
        return res.status(401).json({
          message: 'Неверный логин или пароль.',
        });
      }

      return req.session.regenerate((regenerateError) => {
        if (regenerateError) {
          return res.status(500).json({
            message: 'Не удалось создать защищённую сессию.',
          });
        }

        req.session.isAdmin = true;
        createCsrfToken(req);

        return req.session.save((saveError) => {
          if (saveError) {
            return res.status(500).json({
              message: 'Не удалось сохранить защищённую сессию.',
            });
          }

          return res.json({
            message: 'Вход выполнен.',
          });
        });
      });
    }),
  );

  router.get('/session', requireAdminApi, (req, res) => {
    res.json(getSessionPayload(req));
  });

  router.post(
    '/logout',
    requireSameOrigin,
    requireAdminApi,
    requireCsrf,
    (req, res) => {
      req.session.destroy((error) => {
        if (error) {
          return res.status(500).json({
            message: 'Не удалось завершить сессию.',
          });
        }

        res.clearCookie('style.sid', {
          path: '/',
          httpOnly: true,
          sameSite: 'strict',
          secure: environment.isProduction,
        });

        return res.json({
          message: 'Вы вышли из админки.',
        });
      });
    },
  );

  return router;
}

module.exports = createAdminRoutes;
