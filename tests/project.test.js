const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

/**
 * Reads a UTF-8 release file using its path relative to the project root.
 *
 * @param {string} filename Project-relative file path.
 * @returns {string} File contents.
 */
function read(filename) {
  return fs.readFileSync(path.join(root, filename), 'utf8');
}

/**
 * Resolves one packaged path and verifies that it stays inside the project.
 *
 * @param {string} filename Manifest or HTML resource path.
 * @returns {string} Absolute path of the resource.
 */
function file(filename) {
  const absolute = path.resolve(root, filename);
  assert.ok(absolute.startsWith(root + path.sep), filename);
  assert.ok(fs.statSync(absolute).isFile(), filename);
  return absolute;
}

/**
 * Reads the two Chrome extension locale catalogs for key and translation
 * checks.
 *
 * @returns {{en: object, ru: object}} Supported locale catalogs.
 */
function locales() {
  return {
    en: JSON.parse(read('_locales/en/messages.json')),
    ru: JSON.parse(read('_locales/ru/messages.json'))
  };
}

test('release metadata and packaged manifest paths', function () {
  const manifest = JSON.parse(read('manifest.json'));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.version, '1.0.2');
  assert.equal(manifest.default_locale, 'en');
  assert.equal(manifest.background.service_worker, 'background/service-worker.js');
  assert.equal(manifest.action.default_popup, 'popup/popup.html');
  file(manifest.background.service_worker);
  file(manifest.action.default_popup);
  Object.values(manifest.action.default_icon).forEach(file);
  Object.values(manifest.icons).forEach(file);
  assert.ok(manifest.name.startsWith('__MSG_'));
  assert.ok(manifest.description.startsWith('__MSG_'));
});

test('background importScripts paths resolve relative to their worker entrypoint', function () {
  const worker = 'background/service-worker.js';
  const imports = [...read(worker).matchAll(/importScripts\("([^"]+)"\)/g)].map(match => match[1]);
  assert.equal(imports.length, 10);
  for (const candidate of imports) file(path.posix.join('background', candidate));
  const config = read('background/config.js');
  file('content/main.js');
  file('content/isolated.js');
  assert.ok(config.includes('"js": ["content/main.js"]'));
  assert.ok(config.includes('"js": ["content/isolated.js"]'));
});

test('popup JavaScript, stylesheets and profile icon paths are packaged', function () {
  const html = read('popup/popup.html');
  for (const match of html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="([^"]+)"/g)) {
    const reference = match[1];
    if (!reference.startsWith('http')) file(path.posix.join('popup', reference));
  }
  for (const match of read('popup/popup.css').matchAll(/url\(['"]?(\.\/icons\/[^'")]+)['"]?\)/g)) {
    file(path.posix.join('popup', match[1]));
  }
  file('popup/icons/16/chrome.png');
  file('popup/icons/32/chrome.png');
});

test('English and Russian locale catalogs cover all declared UI bindings', function () {
  const {en,ru} = locales();
  const enKeys = Object.keys(en).sort();
  const ruKeys = Object.keys(ru).sort();
  assert.deepEqual(ruKeys, enKeys);
  assert.ok(enKeys.length >= 200);
  for (const key of enKeys) {
    assert.ok(en[key].message && typeof en[key].message === 'string', key);
    assert.ok(ru[key].message && typeof ru[key].message === 'string', key);
  }
  const html = read('popup/popup.html');
  const bound = [...html.matchAll(/data-i18n(?:-title|-placeholder|-aria-label)?="([^"]+)"/g)].map(match => match[1]);
  assert.ok(bound.length >= 150);
  for (const key of bound) assert.ok(en[key] && ru[key], key);
  for (const key of ['extensionName', 'extensionDescription', 'extensionTitle', 'commandToggleDefault']) {
    assert.ok(en[key] && ru[key], key);
  }
});

test('Russian catalog provides independent translations for the popup', function () {
  const {en,ru} = locales();
  const localized = Object.keys(en).filter(key => en[key].message !== ru[key].message);
  assert.ok(localized.length > 140);
  assert.equal(ru.uiSettings.message, 'Настройки');
  assert.equal(ru.uiLanguage.message, 'Язык интерфейса');
  assert.equal(ru.uiNativeDisguisingCodeReadsBackAsBuiltIn.message, 'Нативная совместимость API');
});

test('language selector translates visible fields without affecting UA settings', async function () {
  const store = {};
  const calls = [];
  const storageListeners = [];
  const elements = [
    {fields: {'data-i18n': 'uiSettings'}, textContent: ''},
    {fields: {'data-i18n-title': 'tipGoBackToTheMainView'}, title: ''},
    {fields: {'data-i18n-placeholder': 'tipIEYahooComWwwGoogleComOrAll'}, placeholder: ''}
  ];
  for (const el of elements) {
    el.getAttribute = function (key) {return el.fields[key]};
  }
  const select = {value: '', addEventListener: function () {}};
  const catalog = locales();
  const mock = {
    chrome: {
      i18n: {
        getUILanguage: function () {return 'en-US';},
        getMessage: function (key) {return catalog.en[key]?.message || '';}
      },
      runtime: {getURL: function (p) {return p;}},
      storage: {
        local: {
          get: async function () {return store;},
          set: async function (value) {Object.assign(store, value);}
        },
        onChanged: {
          addListener: function (callback) {storageListeners.push(callback);}
        }
      }
    },
    document: {
      documentElement: {lang: 'en'},
      querySelectorAll: function (key) {
        if (key === '[data-i18n]') return [elements[0]];
        if (key === '[data-i18n-title]') return [elements[1]];
        if (key === '[data-i18n-placeholder]') return [elements[2]];
        return [];
      },
      getElementById: function () {return select;},
      addEventListener: function () {}
    },
    fetch: async function (url) {
      calls.push(url);
      const locale = url.includes('/ru/') ? catalog.ru : catalog.en;
      return {ok: true, json: async function () {return locale;}};
    },
    background: {send: function (message) {calls.push(message);}},
    console
  };
  vm.runInNewContext(read('popup/i18n.js'), mock, {filename: 'popup/i18n.js'});
  await mock.i18n.init();
  assert.equal(elements[0].textContent, 'Settings');
  await mock.i18n.select('ru', true);
  assert.equal(elements[0].textContent, 'Настройки');
  assert.equal(elements[1].title, 'Вернуться к основному экрану');
  assert.equal(elements[2].placeholder.includes('например:'), true);
  assert.equal(store['useragent-ui-language'], 'ru');
  assert.equal(mock.i18n.t('statusThisTab', ['Chrome']), 'Эта вкладка: Chrome');
  assert.equal(mock.i18n.status('UserAgent: Default'), 'User-Agent: стандартный');
  await mock.i18n.select('en', true);
  assert.equal(elements[0].textContent, 'Settings');
  assert.equal(store['useragent-ui-language'], 'en');

  storageListeners[0]({'useragent-ui-language': {newValue: 'ru'}}, 'local');
  await new Promise(setImmediate);
  assert.equal(elements[0].textContent, 'Настройки');
  assert.equal(select.value, 'ru');

  storageListeners[0]({'useragent-ui-language': {newValue: undefined}}, 'local');
  await new Promise(setImmediate);
  assert.equal(elements[0].textContent, 'Settings');
  assert.equal(select.value, 'auto');
});

test('Russian tooltip translations match their exact interface controls', function () {
  const {ru} = locales();
  assert.equal(ru.tipTypeOrPasteAUseragentString.message, 'Введите или вставьте строку User-Agent');
  assert.ok(ru.tipOneDomainPerLineYahooComGoogleComOr.message.includes('одному домену'));
  assert.ok(ru.tipMakesTheFakeSurviveTheReadBackChecksReading.message.includes('NavigatorUAData'));
  assert.equal(ru.tipMakeADonation.message, 'Поддержать разработку');
});

test('UI language preference is included in settings export', function () {
  assert.ok(read('popup/sections/settings.js').includes('"useragent-ui-language"'));
});


test('toolbar profile and neutral icons use extension-root paths', function () {
  const options = [];
  const messages = [];
  const chrome = {
    runtime: {lastError: null},
    action: {
      setIcon: function (data, callback) {
        options.push(data);
        callback();
      }
    }
  };
  const context = {
    chrome,
    console: {error: function (message) {messages.push(message);}}
  };
  vm.runInNewContext(read('background/chrome.js'), context);
  context.app.button.icon(7, 'chrome');
  context.app.button.icon(null, '');
  assert.equal(options.length, 2);
  assert.equal(options[0].tabId, 7);
  assert.deepEqual(JSON.parse(JSON.stringify(options[0].path)), {
    '16': '/popup/icons/16/chrome.png',
    '32': '/popup/icons/32/chrome.png'
  });
  assert.deepEqual(JSON.parse(JSON.stringify(options[1].path)), {
    '16': '/assets/icons/toolbar/16.png',
    '32': '/assets/icons/toolbar/32.png',
    '48': '/assets/icons/toolbar/48.png',
    '64': '/assets/icons/toolbar/64.png'
  });
  for (const data of options) {
    for (const filename of Object.values(data.path)) {
      assert.ok(filename.startsWith('/'));
      file(filename.slice(1));
    }
  }
  chrome.runtime.lastError = {message: 'icon error'};
  context.app.button.icon(7, 'chrome');
  assert.deepEqual(messages, ['Toolbar icon: icon error']);
});

test('addon recommendation links work without manifest homepage_url', async function () {
  const local = new Map([['explore-count', '50'], ['explore-sort', '1']]);
  const root = {
    children: [],
    dataset: {},
    appendChild: function (node) {this.children.push(node);},
    set textContent(value) {this.children = [];},
    get textContent() {return '';}
  };
  const elements = [];
  const element = function (tag) {
    const node = {
      tag,
      children: [],
      dataset: {},
      style: {},
      classList: {add: function () {}},
      appendChild: function (child) {this.children.push(child);},
      setAttribute: function () {}
    };
    elements.push(node);
    return node;
  };
  const context = {
    document: {
      getElementById: function (id) {assert.equal(id, 'explore'); return root;},
      createElement: element
    },
    localStorage: {
      getItem: function (name) {return local.get(name) || null;},
      setItem: function (name, value) {local.set(name, String(value));}
    },
    chrome: {runtime: {getManifest: function () {throw Error('No homepage is configured');}}},
    i18n: {t: function () {return 'Explore more';}},
    fetch: async function (name) {
      assert.equal(name, 'explore/explore.json');
      return {
        json: async function () {return [{id: 'mute-tab', title: 'Mute Tab'}];}
      };
    },
    URL
  };
  vm.runInNewContext(read('popup/explore/explore.js'), context);
  await new Promise(setImmediate);
  const links = elements.filter(x => x.tag === 'a');
  assert.equal(links.length, 1);
  assert.equal(links[0].href, 'https://mybrowseraddon.com/mute-tab.html?context=explore&from=useragent-switcher');
});
