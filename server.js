require('dotenv').config({ quiet: true });

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { PrismaClient } = require('@prisma/client');
const { createSessionMiddleware } = require('./middleware/session.middleware');
const createAdminRoutes = require('./routes/admin.routes');
const createLeadsRoutes = require('./routes/leads.routes');
const createPublicRoutes = require('./routes/public.routes');
const createWorksRoutes = require('./routes/works.routes');
const createPagesRoutes = require('./routes/pages.routes');

function getEnvironment() {
  const environment = {
    nodeEnv: String(process.env.NODE_ENV || 'development').trim(),
    port: Number(process.env.PORT) || 3000,
    siteUrl: String(process.env.SITE_URL || 'https://style-abakan.ru').replace(/\/+$/, ''),
    databaseUrl: String(process.env.DATABASE_URL || '').trim(),
    sessionSecret: String(process.env.SESSION_SECRET || ''),
    adminLogin: String(process.env.ADMIN_LOGIN || '').trim(),
    adminPasswordHash: String(process.env.ADMIN_PASSWORD_HASH || '').trim(),
    smtpHost: String(process.env.SMTP_HOST || '').trim(),
    smtpPort: Number(process.env.SMTP_PORT) || 465,
    smtpSecure: String(process.env.SMTP_SECURE || 'true') === 'true',
    smtpUser: String(process.env.SMTP_USER || '').trim(),
    smtpPass: String(process.env.SMTP_PASS || ''),
    toEmail: String(process.env.TO_EMAIL || '').trim(),
  };
  const missing = [];

  if (!environment.databaseUrl) missing.push('DATABASE_URL');
  if (!environment.adminLogin) missing.push('ADMIN_LOGIN');
  if (!environment.adminPasswordHash) missing.push('ADMIN_PASSWORD_HASH');
  if (environment.sessionSecret.length < 32) {
    missing.push('SESSION_SECRET (минимум 32 символа)');
  }

  if (environment.adminPasswordHash && !/^\$2[aby]\$\d{2}\$/.test(environment.adminPasswordHash)) {
    throw new Error('ADMIN_PASSWORD_HASH должен содержать bcrypt-хеш.');
  }

  if (missing.length) {
    throw new Error(`Не настроены переменные окружения: ${missing.join(', ')}`);
  }

  const mailValues = [
    environment.smtpHost,
    environment.smtpUser,
    environment.smtpPass,
    environment.toEmail,
  ];
  const configuredMailValues = mailValues.filter(Boolean).length;

  if (configuredMailValues > 0 && configuredMailValues !== mailValues.length) {
    throw new Error('SMTP_HOST, SMTP_USER, SMTP_PASS и TO_EMAIL должны быть заполнены вместе.');
  }

  environment.isProduction = environment.nodeEnv === 'production';
  environment.isMailConfigured = configuredMailValues === mailValues.length;
  return environment;
}

const environment = getEnvironment();
const prisma = new PrismaClient();
const app = express();
const rootPath = __dirname;
const publicPath = path.join(rootPath, 'public');
const sitePath = path.join(rootPath, 'site');

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", 'data:'],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        imgSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        upgradeInsecureRequests: environment.isProduction ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'same-site' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }),
);

app.use(createSessionMiddleware(prisma, environment));
app.use(express.json({ limit: '100kb', strict: true }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

app.use(
  '/site',
  express.static(sitePath, {
    dotfiles: 'deny',
    etag: true,
    index: false,
    maxAge: environment.isProduction ? '1h' : 0,
    redirect: false,
  }),
);

app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.use('/api', createPublicRoutes(prisma, environment));
app.use('/api/admin', createAdminRoutes(environment));
app.use('/api/admin/works', createWorksRoutes(prisma));
app.use('/api/admin/leads', createLeadsRoutes(prisma));
app.use(createPagesRoutes({ prisma, environment, publicPath, rootPath }));

app.use(
  express.static(publicPath, {
    dotfiles: 'deny',
    etag: true,
    index: false,
    maxAge: environment.isProduction ? '1h' : 0,
    redirect: false,
  }),
);

app.use('/api', (req, res) => {
  return res.status(404).json({ message: 'Маршрут API не найден.' });
});

app.use((req, res) => {
  return res.status(404).sendFile(path.join(publicPath, '404.html'));
});

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  console.error('Unhandled request error:', error);

  if (req.path.startsWith('/api/')) {
    return res.status(500).json({ message: 'Ошибка сервера. Попробуйте ещё раз.' });
  }

  return res.status(500).sendFile(path.join(publicPath, '500.html'));
});

const server = app.listen(environment.port, 'localhost', () => {
  console.log(`STYLE server started: http://localhost:${environment.port}`);
});

const sessionCleanupTimer = setInterval(() => {
  prisma.session
    .deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .catch((error) => console.error('Expired session cleanup error:', error));
}, 60 * 60 * 1000);

sessionCleanupTimer.unref();

function shutdown(signal) {
  console.log(`${signal}: завершение работы сервера.`);

  server.close(async () => {
    clearInterval(sessionCleanupTimer);
    await prisma.$disconnect();
    process.exit(0);
  });

  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
