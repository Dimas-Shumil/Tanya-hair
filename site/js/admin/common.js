(function initAdminNamespace() {
  let csrfToken = '';

  async function init() {
    const response = await fetch('/api/admin/session', {
      credentials: 'same-origin',
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

    bindSessionActions();
  }

  function bindSessionActions() {
    const returnToSiteButton = document.querySelector(
      '[data-admin-return-site]',
    );
    const logoutButton = document.querySelector('[data-admin-logout]');
    const actionButtons = [returnToSiteButton, logoutButton].filter(Boolean);

    returnToSiteButton?.addEventListener('click', () => {
      endSession({
        redirectUrl: '/',
        activeButton: returnToSiteButton,
        loadingText: 'Переходим на сайт...',
        actionButtons,
      });
    });

    logoutButton?.addEventListener('click', () => {
      endSession({
        redirectUrl: '/admin/login',
        activeButton: logoutButton,
        loadingText: 'Выходим...',
        actionButtons,
      });
    });
  }

  async function endSession({
    redirectUrl,
    activeButton,
    loadingText,
    actionButtons,
  }) {
    const originalText = activeButton.textContent;

    actionButtons.forEach((button) => {
      button.disabled = true;
    });
    activeButton.textContent = loadingText;

    try {
      const response = await fetch('/api/admin/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          'X-CSRF-Token': csrfToken,
        },
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok && response.status !== 401) {
        throw new Error(data.message || 'Не удалось завершить сессию.');
      }

      csrfToken = '';
      window.location.replace(redirectUrl);
    } catch (error) {
      console.error('Admin logout error:', error);

      actionButtons.forEach((button) => {
        button.disabled = false;
      });
      activeButton.textContent = originalText;

      window.alert(
        error.message || 'Не удалось завершить сессию. Попробуйте ещё раз.',
      );
    }
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
      credentials: 'same-origin',
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
