'use strict';

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  initHeaderScroll();
  initSmoothScroll();
  initSignupForm();
});

/* =========================
   Mobile menu
========================= */

function initMobileMenu() {
  const burger = document.querySelector('.header__burger');
  const mobileMenu = document.querySelector('.mobile-menu');
  const overlay = document.querySelector('.mobile-menu-overlay');
  const mobileLinks = document.querySelectorAll('.mobile-menu a');

  if (!burger || !mobileMenu || !overlay) return;

  const closeMenu = () => {
    burger.classList.remove('active');
    mobileMenu.classList.remove('active');
    overlay.classList.remove('active');
    document.body.classList.remove('menu-open');
    burger.setAttribute('aria-expanded', 'false');
  };

  const openMenu = () => {
    burger.classList.add('active');
    mobileMenu.classList.add('active');
    overlay.classList.add('active');
    document.body.classList.add('menu-open');
    burger.setAttribute('aria-expanded', 'true');
  };

  burger.setAttribute('aria-expanded', 'false');

  burger.addEventListener('click', () => {
    const isOpen = mobileMenu.classList.contains('active');

    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  overlay.addEventListener('click', closeMenu);

  mobileLinks.forEach((link) => {
    link.addEventListener('click', closeMenu);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && mobileMenu.classList.contains('active')) {
      closeMenu();
    }
  });
}

/* =========================
   Header scroll behavior
========================= */

function initHeaderScroll() {
  const header = document.querySelector('.header');

  if (!header) return;

  let lastScrollY = window.scrollY;
  let ticking = false;

  const updateHeader = () => {
    const currentScrollY = window.scrollY;

    header.classList.toggle('scrolled', currentScrollY > 30);

    if (document.body.classList.contains('menu-open')) {
      header.classList.remove('header--hidden');
      lastScrollY = currentScrollY;
      ticking = false;
      return;
    }

    if (currentScrollY <= 10) {
      header.classList.remove('header--hidden');
    } else if (currentScrollY > lastScrollY && currentScrollY > 100) {
      header.classList.add('header--hidden');
    } else if (currentScrollY < lastScrollY) {
      header.classList.remove('header--hidden');
    }

    lastScrollY = currentScrollY;
    ticking = false;
  };

  updateHeader();

  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        window.requestAnimationFrame(updateHeader);
        ticking = true;
      }
    },
    { passive: true },
  );
}

/* =========================
   Smooth scroll
========================= */

function initSmoothScroll() {
  const header = document.querySelector('.header');
  const links = document.querySelectorAll('a[href^="#"]');

  links.forEach((link) => {
    link.addEventListener('click', (event) => {
      const href = link.getAttribute('href');

      if (!href || href === '#') return;

      const target = document.querySelector(href);

      if (!target) return;

      event.preventDefault();

      const headerHeight = header ? header.offsetHeight : 0;
      const topOffset = headerHeight + 20;
      const topPosition =
        target.getBoundingClientRect().top + window.pageYOffset - topOffset;

      window.scrollTo({
        top: topPosition,
        behavior: 'smooth',
      });
    });
  });
}

/* =========================
   Signup form
========================= */

function initSignupForm() {
  const form = document.getElementById('signupForm');
  const phoneInput = document.getElementById('signupPhone');
  const serviceSelect = document.getElementById('signupService');
  const agreementInput = document.getElementById('signupAgreement');
  const submitButton = document.getElementById('signupSubmitBtn');
  const buttonText = submitButton
    ? submitButton.querySelector('.btn-text')
    : null;
  const successMessage = document.getElementById('signupSuccessMessage');
  const errorMessage = document.getElementById('signupErrorMessage');

  if (
    !form ||
    !phoneInput ||
    !serviceSelect ||
    !agreementInput ||
    !submitButton ||
    !buttonText ||
    !successMessage ||
    !errorMessage
  ) {
    return;
  }

  const formStartTime = Date.now();
  let isSending = false;

  const allowedServices = [
    'Стрижка мужская',
    'Стрижка женская',
    'Окрашивание',
    'Укладка и стайлинг',
  ];

  const setStatus = (type, message = '') => {
    successMessage.classList.remove('active');
    errorMessage.classList.remove('active');

    successMessage.textContent = '';
    errorMessage.textContent = '';

    if (type === 'success') {
      successMessage.textContent = message;
      successMessage.classList.add('active');
    }

    if (type === 'error') {
      errorMessage.textContent = message;
      errorMessage.classList.add('active');
    }
  };

  const setLoading = (state) => {
    isSending = state;
    submitButton.disabled = state;
    buttonText.textContent = state ? 'Отправляем...' : 'Отправить заявку';
  };

  phoneInput.addEventListener('input', (event) => {
    event.target.value = formatPhone(event.target.value);
  });

  phoneInput.addEventListener('focus', () => {
    if (!phoneInput.value.trim()) {
      phoneInput.value = '+7';
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (isSending) return;

    setStatus();

    const formData = new FormData(form);

    const name = String(formData.get('name') || '').trim();
    const phone = String(formData.get('phone') || '').trim();
    const service = String(formData.get('service') || '').trim();
    const phoneDigits = getPhoneDigits(phone);
    const agreement = formData.get('agreement') === 'on';

    if (!agreement) {
      setStatus(
        'error',
        'Необходимо согласие на обработку персональных данных.',
      );
      agreementInput.focus();
      return;
    }

    if (!name || name.length < 2 || name.length > 80) {
      setStatus('error', 'Введите корректное имя.');
      form.elements.name?.focus();
      return;
    }

    if (phoneDigits.length !== 11 || !/^7\d{10}$/.test(phoneDigits)) {
      setStatus('error', 'Введите корректный номер телефона в формате +7.');
      phoneInput.focus();
      return;
    }

    if (!service) {
      setStatus('error', 'Выберите услугу.');
      serviceSelect.focus();
      return;
    }

    if (!allowedServices.includes(service)) {
      setStatus('error', 'Некорректная услуга.');
      return;
    }

    const website = String(formData.get('website') || '').trim();

    const payload = {
      name,
      phone,
      service,
      website,
      agreement,
      page: window.location.href,
      form_time: formStartTime,
    };

    try {
      setLoading(true);

      const response = await fetch('/api/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({
        success: false,
        message: 'Некорректный ответ сервера.',
      }));

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Не удалось отправить заявку.');
      }

      setStatus(
        'success',
        data.message || 'Спасибо! Заявка отправлена, мы скоро свяжемся с вами.',
      );

      form.reset();
    } catch (error) {
      setStatus(
        'error',
        error.message || 'Ошибка отправки. Попробуйте ещё раз чуть позже.',
      );
    } finally {
      setLoading(false);
    }
  });
}

function formatPhone(value) {
  const rawDigits = String(value || '')
    .replace(/\D/g, '')
    .slice(0, 11);

  let normalized = rawDigits;

  if (normalized.startsWith('8')) {
    normalized = '7' + normalized.slice(1);
  }

  if (!normalized.startsWith('7') && normalized.length > 0) {
    normalized = '7' + normalized.slice(0, 10);
  }

  let result = '+7';

  if (normalized.length > 1) {
    result += ` (${normalized.slice(1, 4)}`;
  }

  if (normalized.length >= 5) {
    result += `) ${normalized.slice(4, 7)}`;
  }

  if (normalized.length >= 8) {
    result += `-${normalized.slice(7, 9)}`;
  }

  if (normalized.length >= 10) {
    result += `-${normalized.slice(9, 11)}`;
  }

  return result;
}

function getPhoneDigits(value) {
  return String(value || '').replace(/\D/g, '');
}
