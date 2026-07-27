function asyncHandler(handler) {
  return function wrappedHandler(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function cleanText(value, maxLength = 500) {
  return String(value ?? '')
    .replace(/\0/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function cleanMultilineText(value, maxLength = 5000) {
  return String(value ?? '')
    .replace(/\0/g, '')
    .replace(/\r\n?/g, '\n')
    .trim()
    .slice(0, maxLength);
}

function nullableText(value, maxLength) {
  return cleanText(value, maxLength) || null;
}

function nullableMultilineText(value, maxLength) {
  return cleanMultilineText(value, maxLength) || null;
}

function normalizeInteger(value, fallback = 0, limits = {}) {
  const number = Number(value);
  const min = limits.min ?? -100000;
  const max = limits.max ?? 100000;

  if (!Number.isInteger(number) || number < min || number > max) {
    return fallback;
  }

  return number;
}

function normalizeBoolean(value) {
  return value === true || value === 'true' || value === '1' || value === 'on';
}

function isValidSlug(value) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(value || ''));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (symbol) => {
    const symbols = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };

    return symbols[symbol];
  });
}

function escapeXml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (symbol) => {
    const symbols = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&apos;',
    };

    return symbols[symbol];
  });
}

function serializeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function truncate(value, maxLength) {
  const normalized = cleanText(value, maxLength + 1);

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trim()}…`;
}

module.exports = {
  asyncHandler,
  cleanText,
  cleanMultilineText,
  nullableText,
  nullableMultilineText,
  normalizeInteger,
  normalizeBoolean,
  isValidSlug,
  escapeHtml,
  escapeXml,
  serializeJson,
  truncate,
};
