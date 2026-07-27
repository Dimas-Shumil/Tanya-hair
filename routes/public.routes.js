const express = require('express');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
const { asyncHandler, cleanText, escapeHtml } = require('../middleware/request.middleware');
const { requireSameOrigin } = require('../middleware/admin.middleware');

const allowedServices = new Set([
  'Стрижка мужская',
  'Стрижка женская',
  'Окрашивание',
  'Укладка и стайлинг',
]);

const leadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Слишком много заявок. Попробуйте чуть позже.',
  },
});


function createMailService(environment) {
  if (!environment.isMailConfigured) {
    return {
      isConfigured: false,
      async verify() { return false; },
      async sendLead() { return false; },
    };
  }

  const transporter = nodemailer.createTransport({
    host: environment.smtpHost,
    port: environment.smtpPort,
    secure: environment.smtpSecure,
    auth: {
      user: environment.smtpUser,
      pass: environment.smtpPass,
    },
  });

  return {
    isConfigured: true,
    verify: () => transporter.verify(),
    async sendLead(lead) {
      const createdAt = new Date(lead.createdAt).toLocaleString('ru-RU', {
        timeZone: 'Asia/Krasnoyarsk',
      });
      const phoneHref = `+${String(lead.phone).replace(/\D/g, '')}`;
      const text = [
        'Новая заявка с сайта СТИЛЬ',
        '',
        `Имя: ${lead.customerName}`,
        `Телефон: ${lead.phone}`,
        `Услуга: ${lead.service}`,
        `Страница: ${lead.page || '—'}`,
        `Дата: ${createdAt}`,
      ].join('\n');
      const html = `
        <div style="background:#111;padding:32px;font-family:Arial,sans-serif;color:#fff">
          <div style="max-width:620px;margin:0 auto;border:1px solid #d6b13f;padding:32px">
            <p style="margin:0 0 12px;color:#d6b13f;text-transform:uppercase;letter-spacing:2px">СТИЛЬ / ЗАЯВКА</p>
            <h1 style="margin:0 0 28px;font-size:28px">Новая заявка</h1>
            <p><strong>Имя:</strong> ${escapeHtml(lead.customerName)}</p>
            <p><strong>Телефон:</strong> <a style="color:#d6b13f" href="tel:${escapeHtml(phoneHref)}">${escapeHtml(lead.phone)}</a></p>
            <p><strong>Услуга:</strong> ${escapeHtml(lead.service)}</p>
            <p><strong>Страница:</strong> ${escapeHtml(lead.page || '—')}</p>
            <p><strong>Дата:</strong> ${escapeHtml(createdAt)}</p>
          </div>
        </div>
      `;

      await transporter.sendMail({
        from: `"СТИЛЬ сайт" <${environment.smtpUser}>`,
        to: environment.toEmail,
        subject: `Заявка СТИЛЬ: ${lead.service}`,
        text,
        html,
      });

      return true;
    },
  };
}

function createPublicRoutes(prisma, environment) {
  const mailService = createMailService(environment);
  const router = express.Router();

  if (!mailService.isConfigured) {
    console.warn('SMTP не настроен. Проверь .env');
  } else {
    mailService
      .verify()
      .then(() => {
        console.log('SMTP готов к отправке писем');
      })
      .catch((error) => {
        console.error('SMTP ошибка:', error.message);
      });
  }

  router.get(
    '/works',
    asyncHandler(async (req, res) => {
      const works = await prisma.work.findMany({
        where: {
          isPublished: true,
        },
        orderBy: [
          {
            sortOrder: 'asc',
          },
          {
            createdAt: 'desc',
          },
        ],
        select: {
          title: true,
          slug: true,
          category: true,
          shortDescription: true,
          images: {
            orderBy: [
              {
                sortOrder: 'asc',
              },
              {
                id: 'asc',
              },
            ],
            take: 1,
            select: {
              path: true,
              alt: true,
            },
          },
        },
      });

      res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      return res.json({
        works,
      });
    }),
  );

  router.post(
    '/send',
    requireSameOrigin,
    leadLimiter,
    asyncHandler(async (req, res) => {
      if (!req.is('application/json')) {
        return res.status(415).json({
          success: false,
          message: 'Некорректный формат запроса.',
        });
      }

      const formTime = Number(req.body?.form_time || 0);
      const name = cleanText(req.body?.name, 80);
      const phone = cleanText(req.body?.phone, 40);
      const service = cleanText(req.body?.service, 80);
      const pageCandidate = cleanText(req.body?.page, 300);
      const website = cleanText(req.body?.website, 120);
      const agreement =
        req.body?.agreement === true ||
        req.body?.agreement === 'true' ||
        req.body?.agreement === 'on';

      if (website) {
        return res.json({
          success: true,
          message: 'Спасибо! Заявка отправлена, мы скоро свяжемся с вами.',
        });
      }

      if (
        !formTime ||
        formTime > Date.now() ||
        Date.now() - formTime < 2000 ||
        Date.now() - formTime > 24 * 60 * 60 * 1000
      ) {
        return res.status(400).json({
          success: false,
          message: 'Обновите страницу и попробуйте ещё раз.',
        });
      }

      if (!agreement) {
        return res.status(400).json({
          success: false,
          message: 'Необходимо согласие на обработку персональных данных.',
        });
      }

      if (name.length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Введите корректное имя.',
        });
      }

      const phoneDigits = phone.replace(/\D/g, '');

      if (!/^7\d{10}$/.test(phoneDigits)) {
        return res.status(400).json({
          success: false,
          message: 'Введите корректный номер телефона в формате +7.',
        });
      }

      if (!allowedServices.has(service)) {
        return res.status(400).json({
          success: false,
          message: 'Выберите корректную услугу.',
        });
      }

      const formattedPhone = `+7 (${phoneDigits.slice(1, 4)}) ${phoneDigits.slice(
        4,
        7,
      )}-${phoneDigits.slice(7, 9)}-${phoneDigits.slice(9, 11)}`;
      let page = null;

      if (pageCandidate) {
        try {
          const pageUrl = new URL(pageCandidate);

          if (
            ['http:', 'https:'].includes(pageUrl.protocol) &&
            pageUrl.host === req.get('host')
          ) {
            page = pageUrl.toString();
          }
        } catch {
          page = null;
        }
      }

      const lead = await prisma.lead.create({
        data: {
          customerName: name,
          phone: formattedPhone,
          service,
          page,
        },
      });

      if (mailService.isConfigured) {
        try {
          await mailService.sendLead(lead);
          await prisma.lead.update({
            where: {
              id: lead.id,
            },
            data: {
              mailSent: true,
            },
          });
        } catch (error) {
          console.error('Lead email error:', error);
        }
      }

      return res.status(201).json({
        success: true,
        message: 'Спасибо! Заявка отправлена, мы скоро свяжемся с вами.',
      });
    }),
  );

  return router;
}

module.exports = createPublicRoutes;
