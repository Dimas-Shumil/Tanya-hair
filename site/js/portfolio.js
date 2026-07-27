document.addEventListener('DOMContentLoaded', async () => {
  const grid = document.getElementById('portfolioGrid');
  const empty = document.getElementById('portfolioEmpty');

  if (!grid || !empty) {
    return;
  }

  try {
    const response = await fetch('/api/works', {
      headers: {
        Accept: 'application/json',
      },
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error('Не удалось загрузить работы.');
    }

    grid.innerHTML = '';
    empty.hidden = data.works.length > 0;

    data.works.forEach((work) => {
      const card = document.createElement('article');
      const link = document.createElement('a');
      const imageWrap = document.createElement('div');
      const image = document.createElement('img');
      const content = document.createElement('div');
      const category = document.createElement('p');
      const title = document.createElement('h2');
      const description = document.createElement('p');
      const action = document.createElement('span');
      const cover = work.images?.[0];

      card.className = 'portfolio-card';
      link.href = `/work/${encodeURIComponent(work.slug)}`;
      link.className = 'portfolio-card__link';
      imageWrap.className = 'portfolio-card__image';
      image.src = cover?.path || '/site/img/logo.png';
      image.alt = cover?.alt || work.title;
      image.loading = 'lazy';
      image.decoding = 'async';
      image.className = 'portfolio-card__image-source';
      imageWrap.append(image);
      content.className = 'portfolio-card__content';
      category.className = 'portfolio-card__category';
      category.textContent = work.category || 'Работа мастера';
      title.className = 'portfolio-card__title';
      title.textContent = work.title;
      description.className = 'portfolio-card__description';
      description.textContent = work.shortDescription || '';
      action.className = 'portfolio-card__action';
      action.textContent = 'Смотреть работу →';
      content.append(category, title);

      if (work.shortDescription) {
        content.append(description);
      }

      content.append(action);
      link.append(imageWrap, content);
      card.append(link);
      grid.append(card);
    });
  } catch {
    grid.innerHTML = '';
    const error = document.createElement('p');
    error.className = 'portfolio-list__loading';
    error.textContent = 'Не удалось загрузить работы. Обновите страницу.';
    grid.append(error);
  }
});
