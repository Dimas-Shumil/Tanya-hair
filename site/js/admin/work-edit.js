document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('workForm');
  const titleElement = document.getElementById('workEditTitle');
  const saveButton = document.getElementById('workSaveButton');
  const errorElement = document.getElementById('workFormError');
  const successElement = document.getElementById('workFormSuccess');
  const dropzone = document.getElementById('workDropzone');
  const fileInput = document.getElementById('workImageInput');
  const pendingElement = document.getElementById('pendingFiles');
  const pendingGroup = document.getElementById('pendingGroup');
  const savedPhotosHeading = document.getElementById('savedPhotosHeading');
  const galleryElement = document.getElementById('workGallery');
  const galleryEmpty = document.getElementById('workGalleryEmpty');
  const params = new URLSearchParams(window.location.search);
  let workId = Number(params.get('id')) || null;
  let pendingFiles = [];
  const previewUrls = new Map();
  let currentImages = [];
  let draggedImageId = null;
  let slugWasEdited = false;

  if (
    !form ||
    !titleElement ||
    !saveButton ||
    !errorElement ||
    !successElement ||
    !dropzone ||
    !fileInput ||
    !pendingElement ||
    !pendingGroup ||
    !savedPhotosHeading ||
    !galleryElement ||
    !galleryEmpty
  ) {
    return;
  }

  try {
    await window.StyleAdmin.init();

    if (workId) {
      await loadWork();
    }
  } catch (error) {
    showMessage('error', error.message);
  }

  window.addEventListener('pagehide', () => {
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    previewUrls.clear();
  });

  form.elements.title.addEventListener('input', () => {
    if (!slugWasEdited) {
      form.elements.slug.value = createSlug(form.elements.title.value);
    }
  });

  form.elements.slug.addEventListener('input', () => {
    slugWasEdited = true;
    form.elements.slug.value = form.elements.slug.value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-{2,}/g, '-');
  });

  ['dragenter', 'dragover'].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.add('is-dragging');
    });
  });

  ['dragleave', 'drop'].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.remove('is-dragging');
    });
  });

  dropzone.addEventListener('drop', (event) => {
    addPendingFiles(event.dataTransfer.files);
  });

  fileInput.addEventListener('change', () => {
    addPendingFiles(fileInput.files);
    fileInput.value = '';
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    showMessage();

    if (!form.reportValidity()) {
      return;
    }

    saveButton.disabled = true;
    saveButton.textContent = 'Сохраняем...';

    try {
      const payload = getFormPayload();
      const publishAfterUpload =
        payload.isPublished && currentImages.length === 0;
      const initialPayload = publishAfterUpload
        ? {
            ...payload,
            isPublished: false,
          }
        : payload;
      const data = await window.StyleAdmin.api(
        workId ? `/api/admin/works/${workId}` : '/api/admin/works',
        {
          method: workId ? 'PATCH' : 'POST',
          body: JSON.stringify(initialPayload),
        },
      );

      if (!workId) {
        workId = data.work.id;
        window.history.replaceState(
          {},
          '',
          `/admin/work-edit?id=${workId}`,
        );
        titleElement.textContent = 'Редактирование работы';
      }

      if (pendingFiles.length) {
        saveButton.textContent = 'Загружаем фото...';
        await uploadPendingFiles();
      }

      if (publishAfterUpload) {
        await window.StyleAdmin.api(`/api/admin/works/${workId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      }

      await loadWork();
      showMessage('success', 'Работа и фотографии сохранены.');
    } catch (error) {
      showMessage('error', error.message);
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = 'Сохранить';
    }
  });

  async function loadWork() {
    const data = await window.StyleAdmin.api(`/api/admin/works/${workId}`);
    const work = data.work;

    titleElement.textContent = 'Редактирование работы';
    form.elements.title.value = work.title || '';
    form.elements.slug.value = work.slug || '';
    form.elements.category.value = work.category || '';
    form.elements.sortOrder.value = String(work.sortOrder ?? 100);
    form.elements.shortDescription.value = work.shortDescription || '';
    form.elements.description.value = work.description || '';
    form.elements.seoTitle.value = work.seoTitle || '';
    form.elements.seoDescription.value = work.seoDescription || '';
    form.elements.isPublished.checked = Boolean(work.isPublished);
    slugWasEdited = true;
    currentImages = work.images || [];
    renderGallery();
  }

  function getFormPayload() {
    const data = new FormData(form);

    return {
      title: data.get('title'),
      slug: data.get('slug'),
      category: data.get('category'),
      sortOrder: Number(data.get('sortOrder')),
      shortDescription: data.get('shortDescription'),
      description: data.get('description'),
      seoTitle: data.get('seoTitle'),
      seoDescription: data.get('seoDescription'),
      isPublished: data.get('isPublished') === 'on',
    };
  }

  function addPendingFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    const acceptedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
    const invalidFile = files.find(
      (file) => !acceptedTypes.has(file.type) || file.size > 8 * 1024 * 1024,
    );
    if (invalidFile) {
      showMessage('error', 'Разрешены JPG, PNG и WEBP не больше 8 МБ каждый.');
      return;
    }
    if (currentImages.length + pendingFiles.length + files.length > 20) {
      showMessage('error', 'Для одной работы можно сохранить не больше 20 фото.');
      return;
    }

    files.forEach((file) => {
      pendingFiles.push(file);
      previewUrls.set(file, URL.createObjectURL(file));
    });
    renderPendingFiles();
    showMessage();
  }

  function renderPendingFiles() {
    pendingElement.replaceChildren();
    pendingGroup.hidden = pendingFiles.length === 0;

    pendingFiles.forEach((file, index) => {
      const card = document.createElement('div');
      const preview = document.createElement('div');
      const img = document.createElement('img');
      const caption = document.createElement('div');
      const name = document.createElement('strong');
      const size = document.createElement('small');
      const removeButton = document.createElement('button');

      card.className = 'admin-pending-card';
      preview.className = 'admin-pending-card__preview';
      img.src = previewUrls.get(file);
      img.alt = file.name;
      caption.className = 'admin-pending-card__caption';
      name.textContent = file.name;
      size.textContent = formatBytes(file.size);
      caption.append(name, size);
      removeButton.type = 'button';
      removeButton.className = 'admin-photo-remove';
      removeButton.textContent = '×';
      removeButton.setAttribute('aria-label', `Убрать ${file.name} из загрузки`);
      removeButton.title = 'Убрать фото';
      removeButton.addEventListener('click', () => {
        URL.revokeObjectURL(previewUrls.get(file));
        previewUrls.delete(file);
        pendingFiles.splice(index, 1);
        renderPendingFiles();
      });
      preview.append(img, removeButton);
      card.append(preview, caption);
      pendingElement.append(card);
    });
  }

  async function uploadPendingFiles() {
    // Сервер разрешает до 12 файлов в одном запросе; общий лимит работы — 20.
    while (pendingFiles.length) {
      const batch = pendingFiles.slice(0, 12);
      const formData = new FormData();
      batch.forEach((file) => formData.append('images', file));
      const data = await window.StyleAdmin.api(`/api/admin/works/${workId}/images`, {
        method: 'POST', body: formData,
      });
      batch.forEach((file) => {
        URL.revokeObjectURL(previewUrls.get(file));
        previewUrls.delete(file);
      });
      pendingFiles = pendingFiles.slice(batch.length);
      currentImages = data.images;
      renderPendingFiles();
      renderGallery();
    }
  }

  function renderGallery() {
    galleryElement.replaceChildren();
    galleryEmpty.hidden = currentImages.length > 0;
    savedPhotosHeading.hidden = currentImages.length === 0;

    currentImages.forEach((image, index) => {
      const card = document.createElement('article');
      const preview = document.createElement('div');
      const img = document.createElement('img');
      const deleteButton = document.createElement('button');
      const dragHandle = document.createElement('span');
      const altLabel = document.createElement('label');
      const altTitle = document.createElement('span');
      const altInput = document.createElement('input');
      const actions = document.createElement('div');
      const saveAltButton = document.createElement('button');

      card.className = 'admin-gallery-card';
      card.draggable = true;
      card.dataset.imageId = String(image.id);
      preview.className = 'admin-gallery-card__preview';
      img.src = image.path;
      img.alt = image.alt || 'Фотография работы';
      preview.append(img);

      if (index === 0) {
        const badge = document.createElement('span');
        badge.className = 'admin-gallery-card__cover';
        badge.textContent = 'Обложка';
        preview.append(badge);
      }

      deleteButton.type = 'button';
      deleteButton.className = 'admin-photo-remove';
      deleteButton.textContent = '×';
      deleteButton.title = 'Удалить фото';
      deleteButton.setAttribute('aria-label', `Удалить фотографию ${index + 1}`);
      deleteButton.addEventListener('click', async () => {
        const approved = await window.StyleAdmin.confirmDelete('Удалить эту фотографию? Это действие нельзя отменить.');
        if (!approved) return;
        deleteButton.disabled = true;
        try {
          const result = await window.StyleAdmin.api(
            `/api/admin/works/${workId}/images/${image.id}`,
            { method: 'DELETE' },
          );
          currentImages = currentImages.filter((item) => item.id !== image.id);
          if (result.unpublished) form.elements.isPublished.checked = false;
          renderGallery();
          showMessage('success', result.message || 'Фотография удалена.');
        } catch (error) {
          showMessage('error', error.message);
          deleteButton.disabled = false;
        }
      });
      preview.append(deleteButton);

      dragHandle.className = 'admin-gallery-card__drag';
      dragHandle.textContent = 'Перетащите для изменения порядка на компьютере';
      altLabel.className = 'admin-field admin-field--compact';
      altTitle.textContent = 'Описание фото';
      altInput.type = 'text';
      altInput.maxLength = 180;
      altInput.value = image.alt || '';
      altLabel.append(altTitle, altInput);

      actions.className = 'admin-gallery-card__actions';
      saveAltButton.type = 'button';
      saveAltButton.textContent = 'Сохранить текст';
      saveAltButton.addEventListener('click', async () => {
        saveAltButton.disabled = true;
        try {
          await window.StyleAdmin.api(`/api/admin/works/${workId}/images/${image.id}`, {
            method: 'PATCH', body: JSON.stringify({ alt: altInput.value }),
          });
          image.alt = altInput.value.trim();
          showMessage('success', 'Описание фотографии сохранено.');
        } catch (error) {
          showMessage('error', error.message);
        } finally {
          saveAltButton.disabled = false;
        }
      });
      actions.append(saveAltButton);

      card.addEventListener('dragstart', (event) => {
        if (event.target.closest('button, input')) {
          event.preventDefault();
          return;
        }
        draggedImageId = image.id;
        card.classList.add('is-dragging');
      });
      card.addEventListener('dragend', () => {
        draggedImageId = null;
        card.classList.remove('is-dragging');
      });
      card.addEventListener('dragover', (event) => event.preventDefault());
      card.addEventListener('drop', async (event) => {
        event.preventDefault();
        if (!draggedImageId || draggedImageId === image.id) return;
        const fromIndex = currentImages.findIndex((item) => item.id === draggedImageId);
        const toIndex = currentImages.findIndex((item) => item.id === image.id);
        if (fromIndex < 0 || toIndex < 0) return;
        const previousOrder = [...currentImages];
        const [movedImage] = currentImages.splice(fromIndex, 1);
        currentImages.splice(toIndex, 0, movedImage);
        renderGallery();
        try {
          await window.StyleAdmin.api(`/api/admin/works/${workId}/images/order`, {
            method: 'PATCH',
            body: JSON.stringify({ imageIds: currentImages.map((item) => item.id) }),
          });
          showMessage('success', 'Порядок фотографий сохранён.');
        } catch (error) {
          currentImages = previousOrder;
          renderGallery();
          showMessage('error', error.message);
        }
      });

      card.append(preview, dragHandle, altLabel, actions);
      galleryElement.append(card);
    });
  }

  function showMessage(type, message = '') {
    errorElement.hidden = true;
    successElement.hidden = true;
    errorElement.textContent = '';
    successElement.textContent = '';

    if (type === 'error') {
      errorElement.textContent = message;
      errorElement.hidden = false;
    }

    if (type === 'success') {
      successElement.textContent = message;
      successElement.hidden = false;
    }
  }

  function createSlug(value) {
    const map = {
      а: 'a',
      б: 'b',
      в: 'v',
      г: 'g',
      д: 'd',
      е: 'e',
      ё: 'e',
      ж: 'zh',
      з: 'z',
      и: 'i',
      й: 'y',
      к: 'k',
      л: 'l',
      м: 'm',
      н: 'n',
      о: 'o',
      п: 'p',
      р: 'r',
      с: 's',
      т: 't',
      у: 'u',
      ф: 'f',
      х: 'h',
      ц: 'ts',
      ч: 'ch',
      ш: 'sh',
      щ: 'sch',
      ъ: '',
      ы: 'y',
      ь: '',
      э: 'e',
      ю: 'yu',
      я: 'ya',
    };

    return String(value || '')
      .toLowerCase()
      .split('')
      .map((letter) => map[letter] ?? letter)
      .join('')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 100);
  }

  function formatBytes(value) {
    return `${(value / (1024 * 1024)).toFixed(1)} МБ`;
  }
});
