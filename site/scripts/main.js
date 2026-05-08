'use strict';

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  initHeaderScroll();
  initSmoothScroll();
  // initCoachSlider();
  // initCoachModal();
  // initBranchesTabs();
  // initReviewsTabs();
  // initReviewsSliders();
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

  if (!form || !phoneInput) return;

  phoneInput.addEventListener('input', (event) => {
    event.target.value = formatPhone(event.target.value);
  });

  phoneInput.addEventListener('focus', () => {
    if (!phoneInput.value.trim()) {
      phoneInput.value = '+7';
    }
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const formData = new FormData(form);

    const name = String(formData.get('name') || '').trim();
    const phone = String(formData.get('phone') || '').trim();
    const service = String(formData.get('service') || '').trim();
    const phoneDigits = getPhoneDigits(phone);

    if (!name) {
      alert('Введите имя');
      return;
    }

    if (phoneDigits.length !== 11 || !/^7\d{10}$/.test(phoneDigits)) {
      alert('Введите корректный номер телефона');
      phoneInput.focus();
      return;
    }

    console.log({ name, phone, service });

    alert('Заявка отправлена');
    form.reset();
  });
}

// Форматирует строку в телефонный номер в формате +7 (XXX) XXX-XX-XX

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
