document.addEventListener('DOMContentLoaded', async () => {
  const tableBody = document.getElementById('requestsTableBody');
  const countElement = document.getElementById('requestsCount');
  const emptyElement = document.getElementById('requestsEmpty');
  const filterButtons = document.querySelectorAll('[data-status-filter]');
  let currentStatus = '';

  if (!tableBody || !countElement || !emptyElement) {
    return;
  }

  try {
    await window.StyleAdmin.init();
    await loadRequests();
  } catch (error) {
    tableBody.innerHTML = '';
    countElement.textContent = error.message;
  }

  filterButtons.forEach((button) => {
    button.addEventListener('click', async () => {
      currentStatus = button.dataset.statusFilter || '';
      filterButtons.forEach((item) => {
        item.classList.toggle('is-active', item === button);
      });
      await loadRequests();
    });
  });

  async function loadRequests() {
    const query = currentStatus
      ? `?status=${encodeURIComponent(currentStatus)}`
      : '';
    const data = await window.StyleAdmin.api(`/api/admin/leads${query}`);
    renderRequests(data.leads);
  }

  function renderRequests(requests) {
    tableBody.innerHTML = '';
    countElement.textContent = `${requests.length} ${declension(
      requests.length,
      ['заявка', 'заявки', 'заявок'],
    )}`;
    emptyElement.hidden = requests.length > 0;

    requests.forEach((request) => {
      const row = document.createElement('tr');
      const clientCell = document.createElement('td');
      const client = document.createElement('div');
      const name = document.createElement('strong');
      const phone = document.createElement('a');
      const serviceCell = document.createElement('td');
      const pageCell = document.createElement('td');
      const pageLink = document.createElement('a');
      const statusCell = document.createElement('td');
      const statusSelect = document.createElement('select');
      const dateCell = document.createElement('td');
      const date = document.createElement('time');
      const mailState = document.createElement('span');
      const actionsCell = document.createElement('td');
      const deleteButton = document.createElement('button');

      client.className = 'admin-client';
      name.textContent = request.customerName;
      phone.href = `tel:+${request.phone.replace(/\D/g, '')}`;
      phone.textContent = request.phone;
      client.append(name, phone);
      clientCell.append(client);
      serviceCell.textContent = request.service;

      if (request.page) {
        pageLink.href = request.page;
        pageLink.target = '_blank';
        pageLink.rel = 'noopener noreferrer';
        pageLink.textContent = 'Открыть';
        pageCell.append(pageLink);
      } else {
        pageCell.textContent = '—';
      }

      statusSelect.className = 'admin-status-select';
      [
        ['new', 'Новая'],
        ['in_progress', 'В работе'],
        ['completed', 'Завершена'],
      ].forEach(([value, label]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        option.selected = request.status === value;
        statusSelect.append(option);
      });
      statusSelect.addEventListener('change', async () => {
        statusSelect.disabled = true;

        try {
          await window.StyleAdmin.api(
            `/api/admin/leads/${request.id}/status`,
            {
              method: 'PATCH',
              body: JSON.stringify({
                status: statusSelect.value,
              }),
            },
          );

          if (currentStatus && currentStatus !== statusSelect.value) {
            await loadRequests();
          }
        } catch (error) {
          window.alert(error.message);
          statusSelect.value = request.status;
        } finally {
          statusSelect.disabled = false;
        }
      });
      statusCell.append(statusSelect);

      date.dateTime = request.createdAt;
      date.textContent = window.StyleAdmin.formatDate(request.createdAt);
      mailState.className = 'admin-mail-state';
      mailState.textContent = request.mailSent
        ? 'Письмо отправлено'
        : 'Сохранена в админке';
      dateCell.append(date, mailState);

      deleteButton.type = 'button';
      deleteButton.className = 'admin-text-button is-danger';
      deleteButton.textContent = 'Удалить';
      deleteButton.addEventListener('click', async () => {
        if (
          !window.confirm(
            `Удалить заявку от ${request.customerName}? Это действие нельзя отменить.`,
          )
        ) {
          return;
        }

        deleteButton.disabled = true;

        try {
          await window.StyleAdmin.api(`/api/admin/leads/${request.id}`, {
            method: 'DELETE',
          });
          await loadRequests();
        } catch (error) {
          window.alert(error.message);
          deleteButton.disabled = false;
        }
      });
      actionsCell.append(deleteButton);
      row.append(
        clientCell,
        serviceCell,
        pageCell,
        statusCell,
        dateCell,
        actionsCell,
      );
      tableBody.append(row);
    });
  }

  function declension(number, words) {
    const cases = [2, 0, 1, 1, 1, 2];
    return words[
      number % 100 > 4 && number % 100 < 20
        ? 2
        : cases[Math.min(number % 10, 5)]
    ];
  }
});
