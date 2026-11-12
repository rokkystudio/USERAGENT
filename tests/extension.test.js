const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

/* Loads one extension script in a separate context with supplied Chrome
   interfaces so each test runs without modifying the installed browser. */
function evaluate(file, context) {
  vm.runInNewContext(fs.readFileSync(path.join(root, file), 'utf8'), context, {filename: file});
}

/* Creates the background scope controller with registered-script operations
   represented by an in-memory registry. */
function createCore(scope, mode, hosts, useragent) {
  let registered = [];
  const removed = [];
  const app = {
    contentscripts: {
      query: async function () {return registered.slice();},
      unregister: async function (options) {
        removed.push(...options.ids);
        registered = registered.filter(function (e) {return options.ids.indexOf(e.id) === -1});
      },
      register: async function (filters) {registered.push(...filters);}
    },
    storage: {load: function () {}},
    hotkey: {on: {pressed: function () {}}},
    page: {receive: function () {}},
    popup: {receive: function () {}},
    on: {startup: function () {}, installed: function () {}, storage: function () {}}
  };
  const config = {
    scope: {value: scope},
    mode: {value: mode},
    useragent: {string: useragent, hosts: {hosts: hosts, invalid: []}},
    contentscripts: {filters: [
      {id: 'isolated', allFrames: true, world: 'ISOLATED', matches: ['*://*/*'], runAt: 'document_start', matchOriginAsFallback: true, js: ['inject.js']},
      {id: 'main', allFrames: true, world: 'MAIN', matches: ['*://*/*'], runAt: 'document_start', matchOriginAsFallback: true, js: ['spoof.js']}
    ]}
  };
  const context = {app, config, uarules: {report: {set: function (e) {throw Error(e)}}}, pertab: {}, watcher: {}};
  evaluate('background/core.js', context);
  return {core: context.core, config, registered: function () {return registered}, removed};
}

/* Runs runtime initialization with a controlled extension manifest and
   records the URL supplied to Chrome when the worker starts. */
function uninstallDestination(homepage) {
  const calls = [];
  const chrome = {
    runtime: {
      getManifest: function () {return {version: '1.0.0', homepage_url: homepage};},
      setUninstallURL: function (value, callback) {calls.push(value); callback();},
      lastError: null,
      onInstalled: {addListener: function () {}},
      onConnect: {addListener: function () {}},
      onMessage: {addListener: function () {}}
    }
  };
  const context = {chrome, URL, navigator: {webdriver: false}, console};
  evaluate('background/chrome.js', context);
  evaluate('background/runtime.js', context);
  return {calls, homepage: context.app.homepage()};
}

test('missing homepage clears the uninstall URL without an invalid request', function () {
  const result = uninstallDestination(undefined);
  assert.deepEqual(result.calls, ['']);
  assert.equal(result.homepage, '');
});

test('invalid homepage does not register an uninstall URL', function () {
  const result = uninstallDestination('undefined');
  assert.deepEqual(result.calls, ['']);
  assert.equal(result.homepage, '');
});

test('valid homepage retains its query parameters on the uninstall URL', function () {
  const result = uninstallDestination('https://example.org/help?source=store');
  const actual = new URL(result.calls[0]);
  assert.equal(actual.hostname, 'example.org');
  assert.equal(actual.searchParams.get('source'), 'store');
  assert.equal(actual.searchParams.get('v'), '1.0.0');
  assert.equal(actual.searchParams.get('type'), 'uninstall');
});

test('Exclusive scope prevents both script worlds from running on excluded hosts', async function () {
  const state = createCore('exclude', 'global', ['ozon.ru'], 'custom UA');
  await state.core.register.ctscripts();
  assert.equal(state.registered().length, 2);
  for (const filter of state.registered()) {
    assert.deepEqual([...filter.matches], ['*://*/*']);
    assert.deepEqual([...filter.excludeMatches], ['*://*.ozon.ru/*']);
  }
});

test('Inclusive scope restricts content script registration to selected domains', async function () {
  const state = createCore('include', 'global', ['example.org'], 'custom UA');
  await state.core.register.ctscripts();
  for (const filter of state.registered()) {
    assert.deepEqual([...filter.matches], ['*://*.example.org/*']);
    assert.equal(filter.excludeMatches, undefined);
  }
});

test('this-tab scope permits other domains unless explicitly excluded', async function () {
  const state = createCore('include', 'thistab', ['example.org'], '');
  await state.core.register.ctscripts();
  for (const filter of state.registered()) {
    assert.deepEqual([...filter.matches], ['*://*/*']);
  }
});

test('scope changes replace registered script patterns', async function () {
  const state = createCore('include', 'global', ['example.org'], 'custom UA');
  await state.core.register.ctscripts();
  state.config.scope.value = 'exclude';
  state.config.useragent.hosts.hosts = ['ozon.ru'];
  await state.core.register.ctscripts();
  assert.deepEqual([...state.removed].sort(), ['isolated', 'main']);
  for (const filter of state.registered()) {
    assert.deepEqual([...filter.excludeMatches], ['*://*.ozon.ru/*']);
  }
});

test('a default global user agent has no registered page scripts', async function () {
  const state = createCore('include', 'global', ['*'], '');
  await state.core.register.ctscripts();
  assert.equal(state.registered().length, 0);
});

test('per-tab session rules exclude both requests and page payloads on Exclusive hosts', async function () {
  const updates = [];
  const chrome = {
    runtime: {lastError: null},
    declarativeNetRequest: {
      getSessionRules: function (callback) {callback([]);},
      updateSessionRules: function (options, callback) {updates.push(options); callback();}
    }
  };
  const app = {tab: {on: {removed: function () {}}}};
  const config = {scope: {value: 'exclude'}, useragent: {hosts: {hosts: ['ozon.ru']}}};
  const uarules = {
    tabpriority: 2000000,
    types: function () {return ['main_frame', 'sub_frame', 'xmlhttprequest'];},
    stamp: function () {return 'payload';},
    clienthints: {headers: function () {return null;}},
    headers: function () {return [];}
  };
  const context = {chrome, app, config, uarules};
  evaluate('background/tabs/pertab.js', context);
  await context.pertab.set(5, 'custom UA');
  assert.equal(updates.length, 1);
  const rules = updates[0].addRules;
  assert.equal(rules.length, 2);
  for (const rule of rules) {
    assert.deepEqual([...rule.condition.excludedRequestDomains], ['ozon.ru']);
    assert.deepEqual([...rule.condition.excludedInitiatorDomains], ['ozon.ru']);
  }
});

test('a remembered per-tab value is cleared on an Exclusive domain', function () {
  const values = new Map();
  const listeners = [];
  const chrome = {runtime: {
    lastError: null,
    onMessage: {addListener: function (handler) {listeners.push(handler);}},
    sendMessage: function (message, callback) {callback();}
  }};
  const window = {};
  window.top = window;
  const context = {
    window,
    chrome,
    navigator: {userAgent: 'real UA'},
    sessionStorage: {
      setItem: function (key, value) {values.set(key, value);},
      getItem: function (key) {return values.has(key) ? values.get(key) : null;},
      removeItem: function (key) {values.delete(key);}
    },
    URL
  };
  evaluate('content/isolated.js', context);
  const send = function (data) {
    listeners[0]({path: 'background-to-page', method: 'storage', data: data});
  };
  send({top: 'https://example.org/', url: 'ozon.ru', scope: 'exclude', perTab: true, useragent: 'custom UA', meta: ''});
  assert.equal(values.get('useragent-switcher-uastring'), 'custom UA');
  send({top: 'https://www.ozon.ru/', url: 'ozon.ru', scope: 'exclude', perTab: true, useragent: 'custom UA', meta: ''});
  assert.equal(values.has('useragent-switcher-uastring'), false);
  assert.equal(values.get('useragent-switcher-metahints'), '');
});


test('Exclusive global rules protect destination and initiator domains', async function () {
  const added = [];
  const rules = {
    push: function (rule) {added.push(rule);},
    remove: {by: {action: {type: async function () {}}}},
    update: async function () {}
  };
  const context = {
    app: {netrequest: {rules}},
    config: {
      useragent: {string: 'custom UA', hosts: {hosts: ['ozon.ru'], invalid: []}},
      scope: {value: 'exclude'},
      settings: {earlypayload: false}
    }
  };
  evaluate('background/ua/rules.js', context);
  context.uarules.clienthints = {headers: function () {return null;}, meta: function () {return '';}};
  assert.equal(await context.uarules.apply(), '');
  assert.equal(added.length, 2);
  const main = added.find(function (rule) {return rule.condition.resourceTypes.includes('main_frame')});
  const resources = added.find(function (rule) {return rule.condition.resourceTypes.includes('xmlhttprequest')});
  assert.deepEqual([...main.condition.excludedRequestDomains], ['ozon.ru']);
  assert.deepEqual([...resources.condition.excludedRequestDomains], ['ozon.ru']);
  assert.deepEqual([...resources.condition.excludedInitiatorDomains], ['ozon.ru']);
});

/* Runs the document-start UA shim with a real-looking native UAData object
   and synthetic selected-profile metadata to check which values reach sites. */
function pageFingerprint(realbits) {
  const actual = [];
  const slots = new WeakSet();
  const nativeBrands = [
    {brand: 'Chromium', version: '156'},
    {brand: 'Google Chrome', version: '156'}
  ];
  /* Provides Chrome-shaped descriptors with native receiver checks so a
     fabricated NavigatorUAData instance cannot pass as a genuine one. */
  class NavigatorUAData {
    constructor() {
      slots.add(this);
    }
    get brands() {
      if (!slots.has(this)) throw new TypeError('Illegal invocation');
      return nativeBrands;
    }
    get mobile() {
      if (!slots.has(this)) throw new TypeError('Illegal invocation');
      return false;
    }
    get platform() {
      if (!slots.has(this)) throw new TypeError('Illegal invocation');
      return 'Windows';
    }
    toJSON() {
      if (!slots.has(this)) throw new TypeError('Illegal invocation');
      return {brands: this.brands, mobile: this.mobile, platform: this.platform};
    }
    async getHighEntropyValues(fields) {
      if (!slots.has(this)) throw new TypeError('Illegal invocation');
      actual.push([...fields]);
      return {
        platformVersion: '27.0.0',
        fullVersionList: [
          {brand: 'Chromium', version: '156.0.9123.45'},
          {brand: 'Google Chrome', version: '156.0.9123.45'}
        ],
        uaFullVersion: '156.0.9123.45',
        bitness: '32',
        architecture: 'arm'
      };
    }
  }
  Object.defineProperty(NavigatorUAData.prototype, Symbol.toStringTag, {value: 'NavigatorUAData'});
  const realData = new NavigatorUAData();
  const nativeProto = Object.getPrototypeOf(realData);
  const nativeGetBrands = Object.getOwnPropertyDescriptor(nativeProto, 'brands').get;
  const nativeHighEntropy = nativeProto.getHighEntropyValues;
  const proto = {
    vendor: 'Google Inc.',
    platform: 'Win32',
    userAgent: 'real Chrome 156',
    appVersion: 'real version',
    userAgentData: realData,
    language: 'en-US',
    languages: ['en-US', 'en'],
    hardwareConcurrency: 16,
    deviceMemory: 8
  };
  const navigator = Object.create(proto);
  const window = {top: {}};
  const meta = JSON.stringify({
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/156.0.0.0',
    vendor: 'Google Inc.',
    appversion: '5.0 (Windows NT 10.0; Win64; x64) Chrome/156.0.0.0',
    attr: 'Win32',
    text: 'Windows',
    version: '156',
    mobile: false,
    native: true,
    realbits: realbits,
    frames: true,
    brands: [
      {brand: 'Chromium', version: '156'},
      {brand: 'Google Chrome', version: '156'}
    ],
    fullbrands: [
      {brand: 'Chromium', version: '156.0.0.0'},
      {brand: 'Google Chrome', version: '156.0.0.0'}
    ],
    bundle: {
      platformversion: '13.0.0',
      bitness: '64',
      architecture: 'x86',
      model: '',
      uafullversion: '156.0.0.0'
    }
  });
  const storage = new Map([['useragent-switcher-metahints', meta]]);
  const context = {
    window,
    navigator,
    sessionStorage: {
      getItem: function (key) {return storage.has(key) ? storage.get(key) : null;}
    },
    performance: {getEntriesByType: function () {return [];}}
  };
  evaluate('content/main.js', context);
  return {navigator, actual, realData, nativeProto, nativeGetBrands, nativeHighEntropy, storage, meta};
}

test('selected profile does not disclose host OS version or Chrome build', async function () {
  const {navigator, actual} = pageFingerprint(false);
  const data = await navigator.userAgentData.getHighEntropyValues([
    'platformVersion', 'fullVersionList', 'uaFullVersion', 'bitness', 'architecture'
  ]);
  assert.equal(navigator.userAgent.includes('Chrome/156.0.0.0'), true);
  assert.equal(data.platformVersion, '13.0.0');
  assert.equal(data.uaFullVersion, '156.0.0.0');
  assert.equal(data.fullVersionList[1].version, '156.0.0.0');
  assert.equal(data.bitness, '64');
  assert.equal(data.architecture, 'x86');
  assert.equal(actual.length, 0);
});

test('explicit realbits opt-in reads only host architecture and bitness', async function () {
  const {navigator, actual} = pageFingerprint(true);
  const data = await navigator.userAgentData.getHighEntropyValues([
    'platformVersion', 'fullVersionList', 'uaFullVersion', 'bitness', 'architecture'
  ]);
  assert.deepEqual(actual, [['bitness', 'architecture']]);
  assert.equal(data.platformVersion, '13.0.0');
  assert.equal(data.uaFullVersion, '156.0.0.0');
  assert.equal(data.bitness, '32');
  assert.equal(data.architecture, 'arm');
});

/* Confirms that the hardened identity retains Chromium's native instance,
   interface prototype, and the receiver checks used by native methods. */
test('Native disguising keeps genuine NavigatorUAData internal slots', async function () {
  const {navigator, realData, nativeProto, nativeGetBrands, nativeHighEntropy} = pageFingerprint(false);
  const actual = navigator.userAgentData;
  assert.strictEqual(actual, realData);
  assert.strictEqual(Object.getPrototypeOf(actual), nativeProto);
  assert.equal(actual.constructor.name, 'NavigatorUAData');
  assert.equal(Object.prototype.toString.call(actual), '[object NavigatorUAData]');
  assert.deepEqual([...nativeGetBrands.call(actual)], [
    {brand: 'Chromium', version: '156'},
    {brand: 'Google Chrome', version: '156'}
  ]);
  assert.throws(function () {nativeGetBrands.call({})}, /Illegal invocation/);
  assert.throws(function () {actual.toJSON.call({})}, /Illegal invocation/);
  await assert.rejects(nativeHighEntropy.call({}, ['platformVersion']), /Illegal invocation/);
  assert.deepEqual(JSON.parse(JSON.stringify(actual.toJSON().brands)), [
    {brand: 'Chromium', version: '156'},
    {brand: 'Google Chrome', version: '156'}
  ]);
});

/* Checks that retained native UAData references use the active profile,
   and that restoring default mode delegates to Chrome's original methods. */
test('Native disguising reacts to profile updates and default mode', async function () {
  const {navigator, realData, storage} = pageFingerprint(false);
  const reference = navigator.userAgentData;
  const key = 'useragent-switcher-metahints';
  const next = JSON.parse(storage.get(key));
  next.brands = [{brand: 'Chromium', version: '158'}];
  next.bundle.uafullversion = '158.0.0.0';
  storage.set(key, JSON.stringify(next));
  assert.strictEqual(navigator.userAgentData, reference);
  assert.equal(reference.brands[0].version, '158');
  assert.equal((await reference.getHighEntropyValues(['uaFullVersion'])).uaFullVersion, '158.0.0.0');
  storage.delete(key);
  assert.strictEqual(navigator.userAgentData, realData);
  assert.equal(realData.brands[0].version, '156');
  assert.equal((await realData.getHighEntropyValues(['platformVersion'])).platformVersion, '27.0.0');
});
