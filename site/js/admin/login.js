document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('adminLoginForm');
  const errorElement = document.getElementById('adminLoginError');
  const submitButton = form?.querySelector('button[type="submit"]');

  if (!form || !errorElement || !submitButton) {
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorElement.hidden = true;
    submitButton.disabled = true;
    submitButton.textContent = 'Проверяем...';

    const formData = new FormData(form);

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          login: formData.get('login'),
          password: formData.get('password'),
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Не удалось выполнить вход.');
      }

      window.location.replace('/admin/works');
    } catch (error) {
      errorElement.textContent =
        error.message || 'Не удалось выполнить вход.';
      errorElement.hidden = false;
      submitButton.disabled = false;
      submitButton.textContent = 'Войти';
    }
  });
});
