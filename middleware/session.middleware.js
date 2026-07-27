const session = require('express-session');

class PrismaSessionStore extends session.Store {
  constructor(prisma, options = {}) {
    super();
    this.prisma = prisma;
    this.defaultTtlMs = options.defaultTtlMs || 1000 * 60 * 60 * 12;
  }

  get(sid, callback) {
    this.prisma.session
      .findUnique({ where: { sid } })
      .then(async (record) => {
        if (!record) {
          return callback(null, null);
        }

        if (record.expiresAt <= new Date()) {
          await this.prisma.session.deleteMany({ where: { sid } });
          return callback(null, null);
        }

        return callback(null, JSON.parse(record.data));
      })
      .catch((error) => callback(error));
  }

  set(sid, sessionData, callback = () => {}) {
    const expiresAt = this.getExpiry(sessionData);
    const data = JSON.stringify(sessionData);

    this.prisma.session
      .upsert({
        where: { sid },
        update: { data, expiresAt },
        create: { sid, data, expiresAt },
      })
      .then(() => callback(null))
      .catch((error) => callback(error));
  }

  destroy(sid, callback = () => {}) {
    this.prisma.session
      .deleteMany({ where: { sid } })
      .then(() => callback(null))
      .catch((error) => callback(error));
  }

  touch(sid, sessionData, callback = () => {}) {
    this.prisma.session
      .updateMany({
        where: { sid },
        data: { expiresAt: this.getExpiry(sessionData) },
      })
      .then(() => callback(null))
      .catch((error) => callback(error));
  }

  getExpiry(sessionData) {
    const cookieExpires = sessionData?.cookie?.expires;
    const expiresAt = cookieExpires ? new Date(cookieExpires) : null;

    if (expiresAt && Number.isFinite(expiresAt.getTime())) {
      return expiresAt;
    }

    return new Date(Date.now() + this.defaultTtlMs);
  }
}

function createSessionMiddleware(prisma, environment) {
  return session({
    name: 'style.sid',
    secret: environment.sessionSecret,
    store: new PrismaSessionStore(prisma),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      path: '/',
      httpOnly: true,
      sameSite: 'strict',
      secure: environment.isProduction,
      maxAge: 1000 * 60 * 60 * 12,
    },
  });
}

module.exports = {
  createSessionMiddleware,
};
