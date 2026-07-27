(function initAdminNamespace() {
  let csrfToken = '';

  async function init() {
    const response = await fetch('/api/admin/session', {
      headers: {
        Accept: 'application/json',
      },
    });

    if (response.status === 401) {
      window.location.replace('/admin/login');
      throw new Error('Требуется авторизация.');
    }

    if (!response.ok) {
      throw new Error('Не удалось проверить сессию.');
    }

    const data = await response.json();
    csrfToken = data.csrfToken;

    const currentPage = document.body.dataset.adminPage;

    document.querySelectorAll('[data-admin-nav]').forEach((link) => {
      link.classList.toggle(
        'is-active',
        link.dataset.adminNav === currentPage,
      );
    });

    document.querySelector('[data-admin-logout]')?.addEventListener(
      'click',
      async () => {
        try {
          await api('/api/admin/logout', {
            method: 'POST',
          });
        } finally {
          window.location.replace('/admin/login');
        }
      },
    );
  }

  async function api(url, options = {}) {
    const method = String(options.method || 'GET').toUpperCase();
    const headers = new Headers(options.headers || {});

    headers.set('Accept', 'application/json');

    if (!['GET', 'HEAD'].includes(method)) {
      headers.set('X-CSRF-Token', csrfToken);
    }

    if (options.body && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(url, {
      ...options,
      method,
      headers,
    });
    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      window.location.replace('/admin/login');
      throw new Error('Сессия завершена.');
    }

    if (!response.ok) {
      throw new Error(data.message || 'Не удалось выполнить действие.');
    }

    return data;
  }

  function formatDate(value) {
    return new Intl.DateTimeFormat('ru-RU', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Krasnoyarsk',
    }).format(new Date(value));
  }

  window.StyleAdmin = {
    init,
    api,
    formatDate,
  };
})();
