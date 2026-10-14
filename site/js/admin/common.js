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
    const logoutButton = document.querySelector('[data-admin-logout]');
    logoutButton?.addEventListener('click', () => endSession(logoutButton));
  }

  async function endSession(button) {
    const originalText = button.innerHTML;
    button.disabled = true;
    button.querySelector('span').textContent = 'Выходим...';

    try {
      await api('/api/admin/logout', { method: 'POST' });
      csrfToken = '';
      window.location.replace('/admin/login');
    } catch (error) {
      button.disabled = false;
      button.innerHTML = originalText;
      window.alert(error.message || 'Не удалось выйти. Попробуйте ещё раз.');
    }
  }

  // Кастомное окно подтверждения: не зависит от блокировки window.confirm в PWA.
  function confirmDelete(message) {
    if (typeof HTMLDialogElement === 'undefined') return Promise.resolve(window.confirm(message));
    return new Promise((resolve) => {
      const dialog = document.createElement('dialog');
      dialog.className = 'admin-confirm';
      const heading = document.createElement('h2');
      heading.textContent = 'Подтвердите удаление';
      const description = document.createElement('p');
      description.textContent = message;
      const buttons = document.createElement('div');
      buttons.className = 'admin-confirm__actions';
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.textContent = 'Отмена';
      cancel.className = 'admin-confirm__cancel';
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Удалить';
      remove.className = 'admin-confirm__delete';
      buttons.append(cancel, remove);
      dialog.append(heading, description, buttons);
      document.body.append(dialog);
      let decision = false;
      cancel.addEventListener('click', () => dialog.close());
      remove.addEventListener('click', () => { decision = true; dialog.close(); });
      dialog.addEventListener('click', (event) => {
        if (event.target === dialog) dialog.close();
      });
      dialog.addEventListener('close', () => {
        dialog.remove();
        resolve(decision);
      }, { once: true });
      try {
        dialog.showModal();
        cancel.focus();
      } catch {
        dialog.remove();
        resolve(window.confirm(message));
      }
    });
  }

  async function api(url, options = {}) {
    const method = String(options.method || 'GET').toUpperCase();
    const canRetry = !['GET', 'HEAD'].includes(method);
    async function execute(retry = false) {
      const headers = new Headers(options.headers || {});
      headers.set('Accept', 'application/json');
      if (canRetry) headers.set('X-CSRF-Token', csrfToken);
      if (options.body && !(options.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
      }
      const response = await fetch(url, {
        ...options,
        method,
        headers,
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));

      if (response.status === 401) {
        window.location.replace('/admin/login');
        throw new Error('Сессия завершена.');
      }
      // При устаревшем токене получаем новый из той же авторизованной сессии.
      // Никаких повторов при 403 Origin или других ошибках доступа.
      if (response.status === 403 && !retry && canRetry &&
          data.message?.startsWith('Сессия устарела.')) {
        const sessionResponse = await fetch('/api/admin/session', {
          credentials: 'same-origin', cache: 'no-store',
          headers: { Accept: 'application/json' },
        });
        if (sessionResponse.status === 401) {
          window.location.replace('/admin/login');
          throw new Error('Сессия завершена.');
        }
        if (!sessionResponse.ok) throw new Error('Не удалось восстановить сессию.');
        const session = await sessionResponse.json();
        if (!session.csrfToken) throw new Error('Не удалось восстановить защиту сессии.');
        csrfToken = session.csrfToken;
        return execute(true);
      }
      if (!response.ok) throw new Error(data.message || 'Не удалось выполнить действие.');
      return data;
    }
    return execute();
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
    confirmDelete,
  };
})();
