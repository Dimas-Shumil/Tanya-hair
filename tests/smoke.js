const baseUrl = String(process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000').replace(/\/+$/, '');

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    redirect: 'manual',
    ...options,
  });
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : await response.text().catch(() => '');

  return { response, body };
}

function expectStatus(name, actual, expected) {
  if (!expected.includes(actual)) {
    throw new Error(`${name}: ожидался HTTP ${expected.join(' или ')}, получен ${actual}`);
  }
  console.log(`OK  ${name}: HTTP ${actual}`);
}

async function main() {
  const health = await request('/health');
  expectStatus('health', health.response.status, [200]);
  if (!health.body || health.body.success !== true || health.body.service !== 'style-abakan') {
    throw new Error('health: неожиданный JSON-ответ');
  }

  const home = await request('/');
  expectStatus('home', home.response.status, [200]);

  const portfolio = await request('/portfolio');
  expectStatus('portfolio', portfolio.response.status, [200]);

  const adminPage = await request('/admin/works');
  expectStatus('admin page protection', adminPage.response.status, [302]);
  if (adminPage.response.headers.get('location') !== '/admin/login') {
    throw new Error('admin page protection: ожидался redirect на /admin/login');
  }

  const adminApi = await request('/api/admin/session');
  expectStatus('admin API protection', adminApi.response.status, [401]);

  const missing = await request('/definitely-not-existing-page');
  expectStatus('404 page', missing.response.status, [404]);

  const badContentType = await request('/api/send', {
    method: 'POST',
    headers: {
      Origin: baseUrl,
      'Content-Type': 'text/plain',
    },
    body: 'test',
  });
  expectStatus('lead content-type protection', badContentType.response.status, [415]);

  const crossOrigin = await request('/api/send', {
    method: 'POST',
    headers: {
      Origin: 'https://example.invalid',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });
  expectStatus('lead same-origin protection', crossOrigin.response.status, [403]);

  console.log('\nSmoke tests passed.');
}

main().catch((error) => {
  if (error?.cause?.code === 'ECONNREFUSED') {
    console.error(`Smoke tests failed: сервер недоступен по ${baseUrl}. Сначала запусти npm run dev.`);
  } else {
    console.error(`Smoke tests failed: ${error.message}`);
  }
  process.exitCode = 1;
});
