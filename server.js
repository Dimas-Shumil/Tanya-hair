require('dotenv').config();

const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();

const PORT = Number(process.env.PORT) || 3000;
const MIN_FORM_TIME_MS = 2000;

const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://style-abakan.ru',
  'https://www.style-abakan.ru',
];

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error('CORS blocked'));
    },
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
  }),
);

app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));

app.use(express.static(path.join(__dirname)));

const requiredEnv = [
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'TO_EMAIL',
];

const missingEnv = requiredEnv.filter((key) => !process.env[key]);

if (missingEnv.length) {
  console.error(`Отсутствуют переменные окружения: ${missingEnv.join(', ')}`);
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Слишком много заявок. Попробуйте чуть позже.',
  },
});

const allowedServices = [
  'Стрижка мужская',
  'Стрижка женская',
  'Окрашивание',
  'Укладка и стайлинг',
];

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'STYLE server is running',
  });
});

app.get('/site/privacy-policy.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'site', 'privacy-policy.html'));
});

function checkOrigin(req, res, next) {
  const origin = req.headers.origin;

  if (!origin) return next();

  if (allowedOrigins.includes(origin)) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Access denied',
  });
}

app.post('/api/send', checkOrigin, sendLimiter, async (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Некорректный запрос.',
      });
    }

    const formTime = Number(req.body.form_time || 0);

    if (!formTime || Date.now() - formTime < MIN_FORM_TIME_MS) {
      return res.status(400).json({
        success: false,
        message: 'Попробуйте отправить форму чуть позже.',
      });
    }

    const name = cleanText(req.body.name, 80);
    const phone = cleanText(req.body.phone, 40);
    const service = cleanText(req.body.service, 80);
    const page = cleanText(req.body.page, 200);
    const website = cleanText(req.body.website, 120);

    const agreement =
      req.body.agreement === true ||
      req.body.agreement === 'true' ||
      req.body.agreement === 'on';

    if (website) {
      return res.status(200).json({
        success: true,
        message: 'Спасибо! Заявка отправлена, мы скоро свяжемся с вами.',
      });
    }

    if (!agreement) {
      return res.status(400).json({
        success: false,
        message: 'Необходимо согласие на обработку персональных данных.',
      });
    }

    const phoneDigits = phone.replace(/\D/g, '');

    if (!name || name.length < 2 || name.length > 80) {
      return res.status(400).json({
        success: false,
        message: 'Введите корректное имя.',
      });
    }

    if (phoneDigits.length !== 11 || !/^7\d{10}$/.test(phoneDigits)) {
      return res.status(400).json({
        success: false,
        message: 'Введите корректный номер телефона в формате +7.',
      });
    }

    if (!service) {
      return res.status(400).json({
        success: false,
        message: 'Выберите услугу.',
      });
    }

    if (!allowedServices.includes(service)) {
      return res.status(400).json({
        success: false,
        message: 'Некорректная услуга.',
      });
    }

    const formattedPhone = formatPhone(phoneDigits);
    const telLink = makeTelLink(phoneDigits);

    const createdAt = new Date().toLocaleString('ru-RU', {
      timeZone: 'Asia/Krasnoyarsk',
    });

    const text = `
Новая заявка с сайта СТИЛЬ

Имя: ${name}
Телефон: ${formattedPhone}
Услуга: ${service}
Страница: ${page || '—'}
Дата заявки: ${createdAt}
    `.trim();

    const html = buildEmailTemplate({
      name,
      formattedPhone,
      telLink,
      service,
      page: page || '—',
      createdAt,
    });

    await transporter.sendMail({
      from: `"СТИЛЬ сайт" <${process.env.SMTP_USER}>`,
      to: process.env.TO_EMAIL,
      subject: `Заявка СТИЛЬ: ${service}`,
      text,
      html,
    });

    return res.status(200).json({
      success: true,
      message: 'Спасибо! Заявка отправлена, мы скоро свяжемся с вами.',
    });
  } catch (error) {
    console.error('Ошибка отправки заявки:', error);

    return res.status(500).json({
      success: false,
      message: 'Ошибка сервера. Попробуйте ещё раз чуть позже.',
    });
  }
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

transporter.verify((error) => {
  if (error) {
    console.error('Ошибка подключения к SMTP:', error);
  } else {
    console.log('SMTP готов к отправке писем');
  }
});

app.listen(PORT, () => {
  console.log(`STYLE server started: http://localhost:${PORT}`);
});

function cleanText(value, maxLength = 500) {
  return String(value || '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatPhone(phoneDigits) {
  return `+7 (${phoneDigits.slice(1, 4)}) ${phoneDigits.slice(4, 7)}-${phoneDigits.slice(7, 9)}-${phoneDigits.slice(9, 11)}`;
}

function makeTelLink(phoneDigits) {
  return `+7${phoneDigits.slice(1)}`;
}

function emailRow(label, value) {
  return `
<tr>
  <td style="padding:12px 0 4px; color:#8d8175; font-size:12px; text-transform:uppercase; letter-spacing:1px;">
    ${escapeHtml(label)}
  </td>
</tr>
<tr>
  <td style="padding:4px 0 16px; font-size:18px; font-weight:700; color:#ffffff; line-height:1.5;">
    ${value}
  </td>
</tr>
`;
}

function buildEmailTemplate({
  name,
  formattedPhone,
  telLink,
  service,
  page,
  createdAt,
}) {
  return `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Новая заявка СТИЛЬ</title>
</head>

<body style="margin:0; padding:0; background:#11100f; font-family:Arial, sans-serif; color:#ffffff;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#11100f; padding:32px 12px;">
  <tr>
    <td align="center">

      <table width="100%" cellpadding="0" cellspacing="0" style="
        max-width:640px;
        background:#1a1715;
        border:1px solid rgba(214,178,128,0.25);
        border-radius:20px;
        overflow:hidden;
      ">

        <tr>
          <td style="
            padding:32px;
            background:linear-gradient(135deg,#221d19 0%,#120f0d 100%);
            border-bottom:3px solid #d6b280;
          ">

            <div style="
              font-size:12px;
              letter-spacing:3px;
              text-transform:uppercase;
              color:#d6b280;
              margin-bottom:10px;
            ">
              СТИЛЬ / ЗАЯВКА
            </div>

            <h1 style="
              margin:0;
              font-size:28px;
              line-height:1.2;
              text-transform:uppercase;
              color:#ffffff;
            ">
              Новая заявка<br>
              <span style="color:#d6b280;">на услугу</span>
            </h1>

            <p style="
              margin:14px 0 0;
              color:#b8aca0;
              font-size:14px;
              line-height:1.6;
            ">
              Клиент оставил заявку с формы записи на сайте парикмахерской СТИЛЬ.
            </p>

          </td>
        </tr>

        <tr>
          <td style="padding:28px 32px;">

            <table width="100%" cellpadding="0" cellspacing="0">

              ${emailRow('Имя', escapeHtml(name))}

              ${emailRow(
                'Телефон',
                `<a href="tel:${escapeHtml(telLink)}" style="color:#d6b280; text-decoration:none;">${escapeHtml(formattedPhone)}</a>`,
              )}

              ${emailRow('Услуга', escapeHtml(service))}

              ${emailRow('Страница', escapeHtml(page))}

              ${emailRow('Дата заявки', escapeHtml(createdAt))}

            </table>

          </td>
        </tr>

        <tr>
          <td style="
            padding:24px 32px;
            background:#120f0d;
            border-top:1px solid rgba(255,255,255,0.06);
          ">

            <a href="tel:${escapeHtml(telLink)}" style="
              display:inline-block;
              padding:14px 22px;
              background:linear-gradient(180deg,#d6b280,#a8793f);
              color:#11100f;
              text-decoration:none;
              border-radius:999px;
              font-size:14px;
              font-weight:700;
              text-transform:uppercase;
              letter-spacing:1px;
            ">
              Позвонить клиенту
            </a>

          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>

</body>
</html>
`;
}
