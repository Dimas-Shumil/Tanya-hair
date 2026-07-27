const bcrypt = require('bcrypt');

const password = process.argv.slice(2).join(' ');

if (!password || password.length < 12) {
  console.error('Передайте пароль длиной не менее 12 символов.');
  console.error('Пример: npm run admin:hash -- "Надежный пароль 2026"');
  process.exit(1);
}

bcrypt
  .hash(password, 12)
  .then((hash) => console.log(hash))
  .catch((error) => {
    console.error('Не удалось создать хеш:', error.message);
    process.exit(1);
  });
