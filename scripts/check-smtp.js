require('dotenv').config({ quiet: true });

const nodemailer = require('nodemailer');

function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    throw new Error(`Не задана переменная ${name}.`);
  }
  return value;
}

function smtpHelp(error) {
  const response = `${error?.response || ''} ${error?.message || ''}`;
  if (
    error?.code === 'EAUTH' ||
    /application password|parol prilozheniya|парол[ья] приложения/i.test(response)
  ) {
    return [
      'Mail.ru отклонил авторизацию.',
      'SMTP_PASS должен содержать отдельный пароль для внешнего приложения, а не основной пароль от ящика.',
      'Создай новый пароль в Mail.ru: Настройки -> Все настройки -> Безопасность -> Пароли для внешних приложений.',
    ].join(' ');
  }

  return error?.message || 'Неизвестная SMTP-ошибка.';
}

async function main() {
  const host = required('SMTP_HOST');
  const port = Number(process.env.SMTP_PORT) || 465;
  const secure = String(process.env.SMTP_SECURE || 'true') === 'true';
  const user = required('SMTP_USER');
  const pass = required('SMTP_PASS');

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });

  try {
    await transporter.verify();
    console.log(`SMTP OK: ${user} -> ${host}:${port} (secure=${secure})`);
  } catch (error) {
    console.error(`SMTP FAIL: ${smtpHelp(error)}`);
    process.exitCode = 1;
  } finally {
    transporter.close();
  }
}

main().catch((error) => {
  console.error(`SMTP FAIL: ${smtpHelp(error)}`);
  process.exitCode = 1;
});
