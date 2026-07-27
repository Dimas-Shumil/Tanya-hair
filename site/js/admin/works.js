document.addEventListener('DOMContentLoaded', async () => {
  const tableBody = document.getElementById('worksTableBody');
  const countElement = document.getElementById('worksCount');
  const emptyElement = document.getElementById('worksEmpty');

  if (!tableBody || !countElement || !emptyElement) {
    return;
  }

  try {
    await window.StyleAdmin.init();
    await loadWorks();
  } catch (error) {
    tableBody.innerHTML = '';
    countElement.textContent = error.message;
  }

  async function loadWorks() {
    const data = await window.StyleAdmin.api('/api/admin/works');
    renderWorks(data.works);
  }

  function renderWorks(works) {
    tableBody.innerHTML = '';
    countElement.textContent = `${works.length} ${declension(
      works.length,
      ['работа', 'работы', 'работ'],
    )}`;
    emptyElement.hidden = works.length > 0;

    works.forEach((work) => {
      const row = document.createElement('tr');
      const workCell = document.createElement('td');
      const workPreview = document.createElement('div');
      const previewImage = document.createElement('div');
      const info = document.createElement('div');
      const title = document.createElement('strong');
      const category = document.createElement('span');
      const slugCell = document.createElement('td');
      const slugCode = document.createElement('code');
      const photosCell = document.createElement('td');
      const statusCell = document.createElement('td');
      const status = document.createElement('span');
      const orderCell = document.createElement('td');
      const actionsCell = document.createElement('td');
      const actions = document.createElement('div');
      const editLink = document.createElement('a');
      const viewLink = document.createElement('a');
      const deleteButton = document.createElement('button');
      const cover = work.images?.[0];

      workPreview.className = 'admin-work-preview';
      previewImage.className = 'admin-work-preview__image';

      if (cover) {
        const image = document.createElement('img');
        image.src = cover.path;
        image.alt = cover.alt || work.title;
        previewImage.append(image);
      }

      title.textContent = work.title;
      category.textContent = work.category || 'Без категории';
      info.append(title, category);
      workPreview.append(previewImage, info);
      workCell.append(workPreview);

      slugCode.textContent = work.slug;
      slugCell.append(slugCode);
      photosCell.textContent = String(work._count.images);

      status.className = `admin-status ${
        work.isPublished ? 'admin-status--published' : 'admin-status--draft'
      }`;
      status.textContent = work.isPublished ? 'Опубликована' : 'Черновик';
      statusCell.append(status);
      orderCell.textContent = String(work.sortOrder);

      actions.className = 'admin-row-actions';
      editLink.href = `/admin/work-edit?id=${work.id}`;
      editLink.textContent = 'Изменить';
      viewLink.href = `/work/${encodeURIComponent(work.slug)}`;
      viewLink.target = '_blank';
      viewLink.rel = 'noopener noreferrer';
      viewLink.textContent = 'Открыть';
      viewLink.hidden = !work.isPublished;
      deleteButton.type = 'button';
      deleteButton.className = 'is-danger';
      deleteButton.textContent = 'Удалить';
      deleteButton.addEventListener('click', async () => {
        if (!window.confirm(`Удалить работу «${work.title}»?`)) {
          return;
        }

        deleteButton.disabled = true;

        try {
          await window.StyleAdmin.api(`/api/admin/works/${work.id}`, {
            method: 'DELETE',
          });
          await loadWorks();
        } catch (error) {
          window.alert(error.message);
          deleteButton.disabled = false;
        }
      });

      actions.append(editLink, viewLink, deleteButton);
      actionsCell.append(actions);
      row.append(
        workCell,
        slugCell,
        photosCell,
        statusCell,
        orderCell,
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
