# USERAGENT

A Manifest V3 Chrome/Edge extension for selecting browser User-Agent profiles and related Client Hints.

**Version:** 1.0.2

## Project layout

```text
USERAGENT/
├── manifest.json
├── background/
│   ├── service-worker.js       Background entrypoint
│   ├── config.js               Settings, UA profiles, domain scope
│   ├── core.js                 Profile application and messages
│   ├── chrome.js               Chrome Extension API adapters
│   ├── netrequest.js           declarativeNetRequest rules
│   ├── runtime.js              Lifecycle events
│   ├── ua/                     Header rules and Client Hints
│   └── tabs/                   Per-tab overrides and toolbar state
├── content/
│   ├── isolated.js             ISOLATED-world content script
│   └── main.js                 MAIN-world page script
├── popup/
│   ├── popup.html
│   ├── popup.css
│   ├── popup.js
│   ├── i18n.js
│   ├── sections/               Popup views and styles
│   ├── explore/
│   └── icons/
├── assets/icons/               Extension and toolbar icons
├── _locales/
│   ├── en/messages.json
│   └── ru/messages.json
└── tests/
```

Feature-based directories keep the background worker, page scripts, popup, and assets independent. The classic service worker loads its modules through `importScripts`; paths are relative to `background/`. Chrome scripting API paths are extension-root relative.

## Interface language

Open **Settings → Interface language** and select **Browser language**, **Русский**, or **English**. Browser language follows Chrome/Edge's interface locale. The selected UI language is stored under `useragent-ui-language` in `chrome.storage.local`.

UI language does not modify the active UA profile, `Accept-Language` header, or the **Match browser language** setting. The manifest uses Chrome `__MSG_...__` keys, while the popup loads both Chrome locale catalogs directly to support a manual language choice.

## Install

Open `chrome://extensions/` or `edge://extensions/`, enable developer mode, choose **Load unpacked**, and select `C:\FILES\PROJECTS\USERAGENT`. After source updates, reload the extension and reopen its popup.

## Tests

Run with Node.js; no external dependencies:

```powershell
cd C:\FILES\PROJECTS\USERAGENT
node --test .\tests\*.test.js
```

Syntax validation:

```powershell
Get-ChildItem -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
```

## Release versioning

`manifest.json` is the single release-version source. Each completed release increments the PATCH component by one: `1.0.2 → 1.0.3 → 1.0.4`. Edits within the same release do not increment the number. Both locale catalogs are updated together, and settings keys remain compatible across releases.

## Scope

The extension modifies the User-Agent and selected Client Hints. It does not prevent exposure through IP addresses, cookies, Canvas, WebGL, or every other fingerprinting surface.
