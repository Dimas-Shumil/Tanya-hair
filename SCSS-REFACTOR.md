# Рефакторинг SCSS — СТИЛЬ Абакан

## Что исправлено

- `portfolio.html` теперь подключает только `/site/css/portfolio.min.css`.
- `portfolio.scss` самостоятельно подключает global, header, footer и floating-call через `@use`.
- `main.scss` отвечает только за главную страницу и больше не содержит стили страниц услуг.
- Страницы услуг используют отдельный entry-файл `service-pages.scss`.
- `work.scss` и `privacy-policy.scss` стали самостоятельными entry-файлами.
- Все публичные HTML-страницы подключают ровно один CSS-файл.
- Header, footer, global и floating-call вынесены в partial-модули.
- Удалены лишние отдельные `header.css`, `footer.css` и их min-версии: partial-файлы не должны компилироваться отдельно.
- Команды `npm run scss` и `npm run build:css` обновлены для сборки `service-pages.scss`.

## Структура

```text
site/scss/
├── base/
│   └── _global.scss
├── components/
│   └── _floating-call.scss
├── layout/
│   ├── _footer.scss
│   └── _header.scss
├── admin.scss
├── main.scss
├── portfolio.scss
├── privacy-policy.scss
├── service-pages.scss
└── work.scss
```

## Проверено

- CSS expanded/minified: синтаксических ошибок нет.
- Селекторы всех страниц сохранены относительно старой фактической связки CSS.
- Динамические классы страницы работы сохранены.
- Все `@use` находятся в начале entry-файлов и ведут на существующие partial-модули.
