# История версий / Changelog

## 1.0.2 — 2026-11-12

- Иконки панели инструментов загружаются от корня расширения: `/assets/icons/toolbar/` и `/popup/icons/`.
- Ошибки `chrome.action.setIcon` попадают в консоль через callback с `chrome.runtime.lastError`.
- Блок Explore строит ссылки из явно заданного каталога расширений, независимо от отсутствующего `manifest.homepage_url`.
- Скрипт MAIN world обрабатывает чтение `HTMLIFrameElement.contentWindow` и сохраняет нативные методы вставки DOM-элементов.
- 25 автоматических тестов и браузерная проверка 12 свойств iframe/DOM в Chrome 157.
- Значения пользовательских настроек, области действия и профилей UA не требуют миграции.

**Следующий релиз:** `1.0.3`.

## 1.0.1 — 2026-11-12

- Каталоги по назначению: `background/`, `content/`, `popup/`, `assets/`, `_locales/`, `tests/`.
- Русский и английский интерфейс через Chrome Extension i18n, с самостоятельным выбором языка.
- Переводы заголовков, элементов настроек, подсказок, сообщений, подтверждений и команд манифеста.
- Язык интерфейса сохраняется отдельно от профиля User-Agent и включается в экспорт/импорт настроек.
- 23 автоматических теста проверяют маршруты файлов, словари, выбор языка, настройки и работу UA API.
- Документация на русском и английском.

**Версионирование:** каждый следующий завершённый релиз увеличивает PATCH на один: `1.0.2 → 1.0.3`.

## 1.0.0

- User-Agent profiles, Client Hints, global/per-tab switching and hardening settings.

---

## English

### 1.0.2 — 2026-11-12

- Toolbar icons use extension-root paths and report Chrome API errors.
- The optional Explore catalog does not depend on a missing manifest homepage.
- Sandbox iframe support uses the native `contentWindow` read boundary; common DOM insertion methods remain native.
- 25 Node.js regression tests, plus 12 real Chrome DOM/iframe checks.
- Profile, domain-scope, and persisted preferences keep their existing formats.

### 1.0.1 — 2026-11-12

- Feature-based directories for background tasks, page injection, popup UI, assets, locales, and tests.
- English and Russian Chrome extension catalogs with a separate interface-language selection.
- Localized labels, hints, dialogs, status messages, and manifest metadata.
- UI-language preference participates in settings export/import without affecting User-Agent settings.
- 23 automated tests for resources, translations, language selection and UA behavior.
- Russian and English documentation.

Each subsequent release increments PATCH exactly once.
