require('dotenv').config({ quiet: true });

const fs = require('fs');
const path = require('path');

const databaseUrl = String(process.env.DATABASE_URL || '').trim();

if (!databaseUrl.startsWith('file:')) {
  console.error('DATABASE_URL должен указывать на локальный SQLite-файл.');
  process.exit(1);
}

const rawPath = decodeURIComponent(databaseUrl.slice('file:'.length).split('?')[0]);
const databasePath = rawPath.startsWith('./')
  ? path.resolve(__dirname, rawPath.slice(2))
  : path.resolve(rawPath);

fs.mkdirSync(path.dirname(databasePath), { recursive: true });

if (!fs.existsSync(databasePath)) {
  const descriptor = fs.openSync(databasePath, 'a', 0o600);
  fs.closeSync(descriptor);
}

try {
  fs.chmodSync(databasePath, 0o600);
} catch (error) {
  if (process.platform !== 'win32') {
    throw error;
  }
}
