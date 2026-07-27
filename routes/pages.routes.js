const fs = require('fs');
const path = require('path');
const express = require('express');
const {
  asyncHandler,
  escapeHtml,
  escapeXml,
  isValidSlug,
  serializeJson,
  truncate,
} = require('../middleware/request.middleware');
const {
  requireAdminPage,
  redirectAuthenticatedAdmin,
} = require('../middleware/admin.middleware');

function replacePlaceholders(template, replacements) {
  return Object.entries(replacements).reduce((html, [key, value]) => {
    return html.split(`{{${key}}}`).join(String(value ?? ''));
  }, template);
}

function absoluteUrl(siteUrl, value) {
  const source = String(value || '/site/img/logo.png');

  if (/^https?:\/\//i.test(source)) {
    return source;
  }

  return `${siteUrl}/${source.replace(/^\/+/, '')}`;
}

function renderParagraphs(description) {
  return String(description || '')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map(
      (paragraph) =>
        `<p class="work-description__paragraph">${escapeHtml(paragraph).replace(/\n/g, '<br />')}</p>`,
    )
    .join('');
}

function renderWorkPage(template, work, siteUrl) {
  const title = escapeHtml(work.title);
  const category = escapeHtml(work.category || 'Работа мастера');
  const shortDescription = escapeHtml(work.shortDescription || '');
  const description = renderParagraphs(work.description || work.shortDescription || '');
  const canonical = `${siteUrl}/work/${encodeURIComponent(work.slug)}`;
  const cover = work.images[0] || {
    path: '/site/img/logo.png',
    alt: work.title,
  };
  const metaDescription = truncate(
    work.seoDescription ||
      work.shortDescription ||
      `${work.title} — работа мастеров парикмахерской СТИЛЬ в Абакане.`,
    160,
  );
  const pageTitle = work.seoTitle || `${work.title} — парикмахерская СТИЛЬ в Абакане`;
  const gallery = work.images
    .slice(1)
    .map(
      (image) => `
        <figure class="work-gallery__item">
          <img
            class="work-gallery__image"
            src="${escapeHtml(image.path)}"
            alt="${escapeHtml(image.alt || work.title)}"
            loading="lazy"
            decoding="async"
          />
        </figure>
      `,
    )
    .join('');
  const gallerySection = gallery
    ? `
      <section class="work-gallery" aria-labelledby="workGalleryTitle">
        <div class="work-page__container">
          <div class="work-page__section-head work-gallery__head">
            <p class="work-page__section-label">Детали</p>
            <h2 class="work-page__section-title" id="workGalleryTitle">Фотографии работы</h2>
          </div>
          <div class="work-gallery__grid">${gallery}</div>
        </div>
      </section>
    `
    : '';
  const content = `
    <section class="work-hero">
      <div class="work-page__container">
        <nav class="work-breadcrumbs" aria-label="Хлебные крошки">
          <a class="work-breadcrumbs__link" href="/">Главная</a>
          <span class="work-breadcrumbs__separator" aria-hidden="true">/</span>
          <a class="work-breadcrumbs__link" href="/portfolio">Портфолио</a>
          <span class="work-breadcrumbs__separator" aria-hidden="true">/</span>
          <span class="work-breadcrumbs__current" aria-current="page">${title}</span>
        </nav>

        <div class="work-hero__grid">
          <div class="work-hero__content">
            <p class="work-hero__category">${category}</p>
            <h1 class="work-hero__title">${title}</h1>
            ${shortDescription ? `<p class="work-hero__lead">${shortDescription}</p>` : ''}
            <a class="work-page__button" href="/#contacts">Записаться</a>
          </div>

          <figure class="work-hero__image">
            <img
              class="work-hero__image-source"
              src="${escapeHtml(cover.path)}"
              alt="${escapeHtml(cover.alt || work.title)}"
              width="1600"
              height="1600"
              fetchpriority="high"
            />
          </figure>
        </div>
      </div>
    </section>

    ${
      description
        ? `
          <section class="work-description">
            <div class="work-page__container work-description__grid">
              <div class="work-page__section-head">
                <p class="work-page__section-label">О работе</p>
                <h2 class="work-page__section-title">Результат</h2>
              </div>
              <div class="work-description__text">${description}</div>
            </div>
          </section>
        `
        : ''
    }

    ${gallerySection}

    <section class="work-cta">
      <div class="work-page__container work-cta__inner">
        <div class="work-cta__content">
          <p class="work-cta__label">Хотите такой результат?</p>
          <h2 class="work-cta__title">Запишитесь на консультацию</h2>
        </div>
        <a class="work-page__button" href="/#contacts">Записаться</a>
      </div>
    </section>
  `;
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: work.title,
    description: metaDescription,
    url: canonical,
    image: work.images.length
      ? work.images.map((image) => absoluteUrl(siteUrl, image.path))
      : [absoluteUrl(siteUrl, cover.path)],
    creator: {
      '@type': 'HairSalon',
      name: 'Парикмахерская СТИЛЬ',
      url: siteUrl,
    },
  };

  return replacePlaceholders(template, {
    WORK_PAGE_TITLE: escapeHtml(pageTitle),
    WORK_META_DESCRIPTION: escapeHtml(metaDescription),
    WORK_CANONICAL: escapeHtml(canonical),
    WORK_OG_IMAGE: escapeHtml(absoluteUrl(siteUrl, cover.path)),
    WORK_CONTENT: content,
    WORK_SCHEMA: serializeJson(schema),
  });
}

function createPagesRoutes({ prisma, environment, publicPath, rootPath }) {
  const router = express.Router();
  const adminPath = path.join(publicPath, 'admin');
  const workTemplate = fs.readFileSync(path.join(publicPath, 'work.html'), 'utf8');

  router.get('/health', (req, res) => {
    res.set('Cache-Control', 'no-store').json({
      success: true,
      service: 'style-abakan',
    });
  });

  router.get('/robots.txt', (req, res) => {
    res.type('text/plain').sendFile(path.join(rootPath, 'robots.txt'));
  });

  router.get(
    '/sitemap.xml',
    asyncHandler(async (req, res) => {
      const works = await prisma.work.findMany({
        where: { isPublished: true },
        select: { slug: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
      });
      const staticUrls = [
        ['/', 'weekly', '1.0'],
        ['/portfolio', 'weekly', '0.9'],
        ['/mens-haircuts.html', 'monthly', '0.9'],
        ['/womens-haircuts.html', 'monthly', '0.9'],
        ['/coloring.html', 'monthly', '0.9'],
        ['/styling.html', 'monthly', '0.9'],
        ['/privacy-policy.html', 'yearly', '0.3'],
      ];
      const staticEntries = staticUrls
        .map(
          ([url, frequency, priority]) => `
  <url>
    <loc>${escapeXml(`${environment.siteUrl}${url}`)}</loc>
    <changefreq>${frequency}</changefreq>
    <priority>${priority}</priority>
  </url>`,
        )
        .join('');
      const workEntries = works
        .map(
          (work) => `
  <url>
    <loc>${escapeXml(`${environment.siteUrl}/work/${work.slug}`)}</loc>
    <lastmod>${work.updatedAt.toISOString()}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`,
        )
        .join('');

      res.set('Cache-Control', 'public, max-age=300');
      return res.type('application/xml').send(
        `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${staticEntries}${workEntries}
</urlset>`,
      );
    }),
  );

  router.get(['/admin', '/admin/'], (req, res) => {
    return res.redirect(req.session?.isAdmin ? '/admin/works' : '/admin/login');
  });

  router.get(
    ['/admin/login', '/admin/login.html'],
    redirectAuthenticatedAdmin,
    (req, res) => {
      res.set('Cache-Control', 'no-store');
      return res.sendFile(path.join(adminPath, 'login.html'));
    },
  );

  router.get(
    ['/admin/works', '/admin/works.html'],
    requireAdminPage,
    (req, res) => {
      res.set('Cache-Control', 'no-store');
      return res.sendFile(path.join(adminPath, 'works.html'));
    },
  );

  router.get(
    ['/admin/work-edit', '/admin/work-edit.html'],
    requireAdminPage,
    (req, res) => {
      res.set('Cache-Control', 'no-store');
      return res.sendFile(path.join(adminPath, 'work-edit.html'));
    },
  );

  router.get(
    ['/admin/requests', '/admin/requests.html'],
    requireAdminPage,
    (req, res) => {
      res.set('Cache-Control', 'no-store');
      return res.sendFile(path.join(adminPath, 'requests.html'));
    },
  );

  router.get(['/portfolio', '/portfolio/'], (req, res) => {
    return res.sendFile(path.join(publicPath, 'portfolio.html'));
  });

  router.get(['/privacy-policy', '/privacy-policy/'], (req, res) => {
    return res.redirect(301, '/privacy-policy.html');
  });

  router.get('/site/privacy-policy.html', (req, res) => {
    return res.redirect(301, '/privacy-policy.html');
  });

  router.get('/work.html', (req, res) => {
    return res.status(404).sendFile(path.join(publicPath, '404.html'));
  });

  router.get(
    '/work/:slug',
    asyncHandler(async (req, res) => {
      const slug = String(req.params.slug || '').toLowerCase();

      if (!isValidSlug(slug)) {
        return res.status(404).sendFile(path.join(publicPath, '404.html'));
      }

      const work = await prisma.work.findFirst({
        where: { slug, isPublished: true },
        include: {
          images: {
            orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          },
        },
      });

      if (!work) {
        return res.status(404).sendFile(path.join(publicPath, '404.html'));
      }

      const html = renderWorkPage(workTemplate, work, environment.siteUrl);
      res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      return res.type('html').send(html);
    }),
  );

  router.get('/', (req, res) => {
    return res.sendFile(path.join(publicPath, 'index.html'));
  });

  return router;
}

module.exports = createPagesRoutes;
