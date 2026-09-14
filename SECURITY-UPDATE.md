# Style Abakan — security update 2026-09-14

## 1. Mail.ru / SMTP

Не храните основной пароль Mail.ru в `SMTP_PASS`.
Для SMTP создайте отдельный пароль внешнего приложения и укажите его в `.env`:

```env
SMTP_HOST=smtp.mail.ru
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-mailbox@mail.ru
SMTP_PASS=application-password-from-mailru
TO_EMAIL=recipient@example.com
```

Проверка после настройки:

```bash
npm run smtp:check
```

## 2. Обновить security-зависимости

В песочнице, где подготовлен архив, нет сетевого доступа к npm registry, поэтому `package-lock.json` намеренно оставлен согласованным с исходным проектом.
На рабочем компьютере выполните один раз:

```bash
npm install multer@2.3.0 sharp@0.35.4 nodemailer@10.0.9 --save-exact
npm audit
```

Это обновит и `package.json`, и `package-lock.json`. После этого закоммитьте оба файла.

## 3. Prisma

Добавлена миграция аудита согласия на обработку персональных данных.
После обновления кода:

```bash
npx prisma generate
npx prisma migrate deploy
```

## 4. Smoke-test

После запуска приложения:

```bash
npm run test:smoke
```

Для другого адреса приложения:

```bash
SMOKE_BASE_URL=https://style-abakan.ru npm run test:smoke
```

## 5. Production / PM2

После изменения `.env`:

```bash
pm2 restart style-abakan --update-env
pm2 logs style-abakan --lines 50
```

## 6. Production network bind

Node.js должен слушать только loopback-интерфейс, потому что внешний HTTPS-трафик принимает Nginx:

```js
app.listen(environment.port, '127.0.0.1', () => {
  // ...
});
```

Порты приложения (например, `3001`) не должны быть доступны напрямую из интернета. В production разрешайте наружу только необходимые порты, обычно `22`, `80` и `443` через UFW.

