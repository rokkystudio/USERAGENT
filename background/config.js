var config = {};

config.test = {
  "page": "https://webbrowsertools.com/useragent/?method=normal&verbose=false"
};

config.contentscripts = {
  "filters": [
    {
      "allFrames": true,
      "world": "ISOLATED",
      "matches": ["*://*/*"],
      "matchOriginAsFallback": true,
      "runAt": "document_start",
      "js": ["content/isolated.js"],
      "id": "useragent-switcher-contentscript-isolated"
    },
    {
      "world": "MAIN",
      "allFrames": true,
      "matches": ["*://*/*"],
      "matchOriginAsFallback": true,
      "runAt": "document_start",
      "id": "useragent-switcher-contentscript-main",
      "js": ["content/main.js"]
    }
  ]
};

config.badge = {
  set icon (val) {app.storage.write("badge-icon", val)},
  get icon () {return app.storage.read("badge-icon") !== undefined ? app.storage.read("badge-icon") : ''}
};

config.welcome = {
  set lastupdate (val) {app.storage.write("lastupdate", val)},
  get lastupdate () {return app.storage.read("lastupdate") !== undefined ? app.storage.read("lastupdate") : 0}
};

config.interface = {
  set theme (val) {app.storage.write("interface-theme", val)},
  get theme () {return app.storage.read("interface-theme") !== undefined ? app.storage.read("interface-theme") : ''}
};

/* picks land on every tab by default; "thistab" rides session rules that
   only match the tab the popup was open on when the pick happened */

config.mode = {
  set value (val) {app.storage.write("useragent-option-mode", val === "thistab" ? "thistab" : "global")},
  get value () {return app.storage.read("useragent-option-mode") === "thistab" ? "thistab" : "global"}
};

/* the global domain scope: "include" applies the useragent only on the
   listed domains, "exclude" applies it on every site except the listed ones */

config.scope = {
  set value (val) {app.storage.write("useragent-option-scope", val === "exclude" ? "exclude" : "include")},
  get value () {return app.storage.read("useragent-option-scope") === "exclude" ? "exclude" : "include"}
};

/* custom color for the description header strips: a #rrggbb string, or ''
   for the theme defaults; invalid shapes never reach storage */

config.description = {
  set color (val) {
    const valid = val === '' || /^#[0-9a-fA-F]{6}$/.test(val);
    if (valid) app.storage.write("useragent-option-descriptioncolor", val);
  },
  get color () {
    const value = app.storage.read("useragent-option-descriptioncolor");
    return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value : '';
  }
};

/* option defaults live in the getters; keys are frozen, never re-used */

config.settings = {
  set spoof (val) {app.storage.write("useragent-option-spoof", JSON.stringify(val !== false))},
  set coverage (val) {app.storage.write("useragent-option-coverage", JSON.stringify(val !== false))},
  set liveupdate (val) {app.storage.write("useragent-option-liveupdate", JSON.stringify(val !== false))},
  set confirmreset (val) {app.storage.write("useragent-option-confirmreset", JSON.stringify(val !== false))},
  set confirmdefault (val) {app.storage.write("useragent-option-confirmdefault", JSON.stringify(val !== false))},
  set backbuttons (val) {app.storage.write("useragent-option-backbuttons", JSON.stringify(val === true))},
  //
  get spoof () {
    let value = app.storage.read("useragent-option-spoof");
    if (value === undefined) return true;
    try {return JSON.parse(value) !== false;} catch (err) {return true;}
  },
  get coverage () {
    let value = app.storage.read("useragent-option-coverage");
    if (value === undefined) return true;
    try {return JSON.parse(value) !== false;} catch (err) {return true;}
  },
  get liveupdate () {
    let value = app.storage.read("useragent-option-liveupdate");
    if (value === undefined) return true;
    try {return JSON.parse(value) !== false;} catch (err) {return true;}
  },
  get confirmdefault () {
    let value = app.storage.read("useragent-option-confirmdefault");
    if (value === undefined) return true;
    try {return JSON.parse(value) !== false;} catch (err) {return true;}
  },
  get confirmreset () {
    let value = app.storage.read("useragent-option-confirmreset");
    if (value === undefined) return true;
    try {return JSON.parse(value) !== false;} catch (err) {return true;}
  },
  get backbuttons () {
    let value = app.storage.read("useragent-option-backbuttons");
    if (value === undefined) return false;
    try {return JSON.parse(value) === true;} catch (err) {return false;}
  },
  /* entries and imports get their strings cleaned before the engine sees
     them: printable ASCII only, no line breaks, chopped at the cap */
  set strictclean (val) {app.storage.write("useragent-option-strictclean", JSON.stringify(val !== false))},
  get strictclean () {
    let value = app.storage.read("useragent-option-strictclean");
    if (value === undefined) return true;
    try {return JSON.parse(value) !== false;} catch (err) {return true;}
  },
  /* a fake that has no vendor of its own (firefox, most safari) reports an
     empty vendor by default; the option lets the real one stay visible for
     sites that only trust their own engine's vendor */
  set realvendor (val) {app.storage.write("useragent-option-realvendor", JSON.stringify(val === true))},
  get realvendor () {
    let value = app.storage.read("useragent-option-realvendor");
    if (value === undefined) return false;
    try {return JSON.parse(value) === true;} catch (err) {return false;}
  },
  /* the popup reopens on the panel that was open when it closed: view is
     the stored name, remember is the gate (off means main every time) */
  set remember (val) {app.storage.write("useragent-option-remember", JSON.stringify(val !== false))},
  get remember () {
    let value = app.storage.read("useragent-option-remember");
    if (value === undefined) return true;
    try {return JSON.parse(value) !== false;} catch (err) {return true;}
  },
  /* getHighEntropyValues derives a self-consistent 64-bit x86 shape from
     the fake; the option swaps in the real browser's bitness and
     architecture instead, an opt-in that deliberately reveals hardware */
  set realbits (val) {app.storage.write("useragent-option-realbits", JSON.stringify(val === true))},
  get realbits () {
    let value = app.storage.read("useragent-option-realbits");
    if (value === undefined) return false;
    try {return JSON.parse(value) === true;} catch (err) {return false;}
  },
  /* hardening defaults: native-shaped accessors and Chromium-derived client
     hints stay enabled because they define the visible UA surface; the
     remaining optional layers stay disabled until the user enables them. */
  /* accessors install on Navigator.prototype with native-shaped getters,
     and userAgentData becomes a real NavigatorUAData-shaped instance */
  set native (val) {app.storage.write("useragent-option-native", JSON.stringify(val !== false))},
  get native () {
    let value = app.storage.read("useragent-option-native");
    if (value === undefined) return true;
    try {return JSON.parse(value) !== false;} catch (err) {return true;}
  },
  /* the grease brand pair and the brands order derive from the selected
     Chromium engine major using Chromium's stable algorithm. Default on
     keeps Sec-CH-UA and NavigatorUAData aligned with current Chromium. */
  set grease (val) {app.storage.write("useragent-option-grease", JSON.stringify(val !== false))},
  get grease () {
    let value = app.storage.read("useragent-option-grease");
    if (value === undefined) return true;
    try {return JSON.parse(value) !== false;} catch (err) {return true;}
  },
  /* getHighEntropyValues always returns core values that agree with the
     selected Chromium profile. This option adds richer model/form-factor
     details; default off keeps the smaller standards-compatible shape. */
  set entropy (val) {app.storage.write("useragent-option-entropy", JSON.stringify(val !== false))},
  get entropy () {
    let value = app.storage.read("useragent-option-entropy");
    if (value === undefined) return false;
    try {return JSON.parse(value) !== false;} catch (err) {return false;}
  },
  /* the hardening pack grew past three rows; the follow-up rows keep the
     same contract: defaults are the hardened shape, off dials that
     specific layer back to the permissive historical one */
  /* navigator properties left behind by the fake's shell family
     (Chromium fakes carry oscpu/buildID when the host engine is firefox,
     firefox fakes still see the real window.chrome) get deleted;
     default off (nothing gets removed, sites keep their whole surface) */
  set deleteleftovers (val) {app.storage.write("useragent-option-deleteleftovers", JSON.stringify(val !== false))},
  get deleteleftovers () {
    let value = app.storage.read("useragent-option-deleteleftovers");
    if (value === undefined) return false;
    try {return JSON.parse(value) !== false;} catch (err) {return false;}
  },
  /* firefox fakes answer the short "5.0 (Windows)" appVersion the real
     firefox reports; off keeps the full-string form for them */
  set shortappversion (val) {app.storage.write("useragent-option-shortappversion", JSON.stringify(val !== false))},
  get shortappversion () {
    let value = app.storage.read("useragent-option-shortappversion");
    if (value === undefined) return true;
    try {return JSON.parse(value) !== false;} catch (err) {return true;}
  },
  /* methods and getters answer "[native code]" for their toString; off
     lets them answer their real javascript source (testing aid) */
  set forged (val) {app.storage.write("useragent-option-forged", JSON.stringify(val !== false))},
  get forged () {
    let value = app.storage.read("useragent-option-forged");
    if (value === undefined) return true;
    try {return JSON.parse(value) !== false;} catch (err) {return true;}
  },
  /* hardwareConcurrency and deviceMemory report fake-consistent fixed
     values derived from the fake platform; off passes the real machine
     through; default off (the real numbers stay) */
  set pindevice (val) {app.storage.write("useragent-option-pindevice", JSON.stringify(val !== false))},
  get pindevice () {
    let value = app.storage.read("useragent-option-pindevice");
    if (value === undefined) return false;
    try {return JSON.parse(value) !== false;} catch (err) {return false;}
  },
  /* the fake rides a Server-Timing response header so the page and every
     frame (sandboxed ones included) report it before their first script;
     off keeps today's storage-only round trip */
  set earlypayload (val) {app.storage.write("useragent-option-earlypayload", JSON.stringify(val !== false))},
  get earlypayload () {
    let value = app.storage.read("useragent-option-earlypayload");
    if (value === undefined) return true;
    try {return JSON.parse(value) !== false;} catch (err) {return true;}
  },
  /* frames get the fake too; off narrows every layer to the top document
     only (the resource-type lists drop sub_frame consistently) */
  set iframes (val) {app.storage.write("useragent-option-iframes", JSON.stringify(val !== false))},
  get iframes () {
    let value = app.storage.read("useragent-option-iframes");
    if (value === undefined) return true;
    try {return JSON.parse(value) !== false;} catch (err) {return true;}
  },
  /* navigator.webdriver answers false while a fake is active; off passes
     the real automation flag through */
  set hidewebdriver (val) {app.storage.write("useragent-option-hidewebdriver", JSON.stringify(val === true))},
  get hidewebdriver () {
    let value = app.storage.read("useragent-option-hidewebdriver");
    if (value === undefined) return false;
    try {return JSON.parse(value) === true;} catch (err) {return false;}
  },
  /* frames a page locks down with the sandbox attribute get their fake from
     the moment the page appends them (content scripts arrive too late for
     their own reads); off leaves locked frames untouched */
  set spoofsandbox (val) {app.storage.write("useragent-option-spoofsandbox", JSON.stringify(val !== false))},
  get spoofsandbox () {
    let value = app.storage.read("useragent-option-spoofsandbox");
    if (value === undefined) return true;
    try {return JSON.parse(value) !== false;} catch (err) {return true;}
  },
  /* a page answer whose body is exactly the real user agent string (echo
     endpoints and their like) reads as the fake while a spoof rides; off
     hands the real string through untouched */
  set fakeecho (val) {app.storage.write("useragent-option-fakeecho", JSON.stringify(val !== false))},
  get fakeecho () {
    let value = app.storage.read("useragent-option-fakeecho");
    if (value === undefined) return true;
    try {return JSON.parse(value) !== false;} catch (err) {return true;}
  },
  /* the Server-Timing payload stays readable in the performance timeline
     (a debug/testing aid; off keeps the marker strip active) */
  set debugpayload (val) {app.storage.write("useragent-option-debugpayload", JSON.stringify(val === true))},
  get debugpayload () {
    let value = app.storage.read("useragent-option-debugpayload");
    if (value === undefined) return false;
    try {return JSON.parse(value) === true;} catch (err) {return false;}
  },
  /* the fake speaks the configured language list (accept-language header
     plus navigator.languages); off leaves the real language untouched */
  set matchlang (val) {app.storage.write("useragent-option-matchlang", JSON.stringify(val === true))},
  get matchlang () {
    let value = app.storage.read("useragent-option-matchlang");
    if (value === undefined) return false;
    try {return JSON.parse(value) === true;} catch (err) {return false;}
  },
  /* the footer status strip's looks; all three default off, so the small
     one-line row stays exactly as before; hide collapses the strip and
     wins over the other two looks */
  set statusheight (val) {app.storage.write("useragent-option-statusheight", JSON.stringify(val === true))},
  get statusheight () {
    let value = app.storage.read("useragent-option-statusheight");
    if (value === undefined) return false;
    try {return JSON.parse(value) === true;} catch (err) {return false;}
  },
  set statusplain (val) {app.storage.write("useragent-option-statusplain", JSON.stringify(val === true))},
  get statusplain () {
    let value = app.storage.read("useragent-option-statusplain");
    if (value === undefined) return false;
    try {return JSON.parse(value) === true;} catch (err) {return false;}
  },
  set statusshow (val) {app.storage.write("useragent-option-statusshow", JSON.stringify(val === true))},
  get statusshow () {
    let value = app.storage.read("useragent-option-statusshow");
    if (value === undefined) return true;
    try {return JSON.parse(value) === true;} catch (err) {return true;}
  }
};

/* the last open view travels as a plain name: anything outside the known
   panels reads as main */
config.view = {
  "names": ["settings", "advanced", "domains", "hardening"],
  set name (val) {
    if (typeof val === "string") app.storage.write("user-agent-view", config.view.names.indexOf(val) !== -1 ? val : '');
  },
  get name () {
    const value = app.storage.read("user-agent-view");
    return config.view.names.indexOf(value) !== -1 ? value : '';
  }
};

config.useragent = {
  set url (val) {app.storage.write("user-agent-url", val)},
  set text (val) {app.storage.write("user-agent-text", val)},
  set string (val) {app.storage.write("user-agent-string", val)},
  set key (val) {app.storage.write("user-agent-key", JSON.stringify(val))},
  set last (val) {app.storage.write("user-agent-last", JSON.stringify(val))},
  set library (val) {app.storage.write("user-agent-library", JSON.stringify(val || []))},
  set overrides (val) {app.storage.write("user-agent-overrides", JSON.stringify(val || {}))},
  /* the language list the match-language layer serves; stored raw and
     parsed at derive time (trim, printables, cap per entry and list) */
  set langlist (val) {app.storage.write("useragent-option-langlist", typeof val === "string" ? val : '')},
  //
  get langlist () {return app.storage.read("useragent-option-langlist") !== undefined ? app.storage.read("useragent-option-langlist") : "en-US, en"},
  //
  get hosts () {return config.domain.parse(config.useragent.url)},
  get url () {return app.storage.read("user-agent-url") !== undefined ? app.storage.read("user-agent-url") : "all_urls"},
  get string () {return app.storage.read("user-agent-string") !== undefined ? app.storage.read("user-agent-string") : ''},
  get text () {return app.storage.read("user-agent-text") !== undefined ? app.storage.read("user-agent-text") : "UserAgent: Default"},
  get key () {
    let value = app.storage.read("user-agent-key");
    /* unset or broken storage has to fall back to the default slot: the old
       '[', ' typo built a truthy first slot (", ") and a 2-element array,
       which both misrouted default-state flows */
    try {
      const parsed = JSON.parse(value || '["", "", "default"]');
      return Array.isArray(parsed) ? parsed : ['', '', "default"];
    } catch (err) {
      return ['', '', "default"];
    }
  },
  get last () {
    let value = app.storage.read("user-agent-last");
    if (value === undefined) return null;
    try {
      return JSON.parse(value);
    } catch (err) {
      return null;
    }
  },
  get overrides () {
    let value = app.storage.read("user-agent-overrides");
    if (value === undefined) return {};
    try {
      return JSON.parse(value);
    } catch (err) {
      return {};
    }
  },
  get library () {
    let value = app.storage.read("user-agent-library");
    if (value === undefined) return [];
    try {
      const list = JSON.parse(value);
      return Array.isArray(list) ? list : [];
    } catch (err) {
      return [];
    }
  },
  get obj () {
    const overrides = config.useragent.overrides;
    const merged = JSON.parse(JSON.stringify(config.default.ua.object));
    /*  */
    for (let browser in overrides) {
      if (typeof overrides[browser] === "string") {
        merged[browser] = overrides[browser];
      } else {
        for (let os in overrides[browser]) {
          if (merged[browser]) merged[browser][os] = overrides[browser][os];
        }
      }
    }
    /*  */
    return merged;
  }
};

config.domain = {
  "parse": function (input) {
    const domain = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;
    /* percent-mangled stars heal here: the URL hostname pass encodes a bare
       "*" as %2A, so tokens are decoded and the star check runs on the raw
       value before any hostname extraction can touch it */
    const tokens = String(input || '').replace(/\s+/g, '').split(',').map(function (e) {
      let token = String(e || '').trim().toLowerCase();
      if (!token) return '';
      try {
        const decoded = decodeURIComponent(token);
        if (decoded) token = decoded;
      } catch (err) {}
      return token;
    }).filter(function (e) {return e});
    /*  */
    const hosts = [];
    const invalid = [];
    /*  */
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const wildcard = token === '*' || token === "all_urls";
      const plain = domain.test(token) ? token : '';
      const base = token.indexOf('*.') === 0 ? token.slice(2) : '';
      /*  */
      if (wildcard) {
        if (hosts.indexOf('*') === -1) hosts.push('*');
      } else if (plain) {
        if (hosts.indexOf(token) === -1) hosts.push(token);
      } else if (base && domain.test(base)) {
        /* pasted wildcard subdomains ride the base domain */
        if (hosts.indexOf(base) === -1) hosts.push(base);
      } else {
        /* pasted URLs and odd shapes take the hostname pass */
        const host = config.domain.extract(token);
        if (host && domain.test(host)) {
          if (hosts.indexOf(host) === -1) hosts.push(host);
        } else if (invalid.indexOf(token) === -1) {
          invalid.push(token);
        }
      }
    }
    /*  */
    return {
      "hosts": hosts,
      "invalid": invalid
    };
  },
  "extract": function (url) {
    let host = String(url || '').trim().toLowerCase();
    /*  */
    try {
      host = new URL(host.indexOf("//") === -1 ? "https://" + host : host).hostname;
    } catch (err) {
      return '';
    }
    /*  */
    return host.replace(/^www\./, '');
  },
  "cleanup": function (e) {
    const result = config.domain.parse(e);
    /* keep never widens a bad scope: a broken value stays as stored and
       resurfaces as an apply error, so the stored entry survives */
    const value = result.hosts.length ? result.hosts.join(", ") : '';
    const stored = app.storage.read("user-agent-url");
    /*  */
    if (value && stored !== value) config.useragent.url = value;
    return result;
  },
  "match": function (host, domains) {
    const exclude = config.scope.value === "exclude";
    if (!host) return !exclude;
    /*  */
    if (exclude) {
      /* every site except the listed domains: a listed host (or a
         subdomain of one) is outside the scope, everything else is in */
      if (domains.indexOf('*') !== -1 || domains.indexOf("all_urls") !== -1) return false;
      for (let i = 0; i < domains.length; i++) {
        const domain = domains[i];
        if (domain === host) return false;
        if (host.endsWith('.' + domain)) return false;
      }
      return true;
    }
    /*  */
    if (domains.indexOf('*') !== -1 || domains.indexOf("all_urls") !== -1) return true;
    for (let i = 0; i < domains.length; i++) {
      const domain = domains[i];
      if (domain === host) return true;
      if (host.endsWith('.' + domain)) return true;
    }
    /*  */
    return false;
  }
};

config.default = {
  "ua": {
    "object": {
      /* Mobile — Chrome/Android freeze at "Android 10; K", iOS Safari freezes its iOS token */
      "firefoxos": "Mozilla/5.0 (Android 10; Mobile; rv:159.0) Gecko/159.0 Firefox/159.0",
      "tizen": "Mozilla/5.0 (Linux; Tizen 7.0) AppleWebKit/537.36 (KHTML, like Gecko) Mobile TizenBrowser/7.0",
      "android": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Mobile Safari/537.36",
      "ios": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7 Mobile/15E148 Safari/604.1",
      "symbian": "Nokia5250/10.0.011 (SymbianOS/9.4; U; Series60/5.0 Mozilla/5.0; Profile/MIDP-2.1 Configuration/CLDC-1.1 ) AppleWebKit/525 (KHTML, like Gecko) Safari/525 3gpp-gba",
      "windowsp": "Mozilla/5.0 (Windows Phone 10.0; Android 4.4; Microsoft; Lumia 950) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/52.0.2743.116 Mobile Safari/537.36 Edge/15.14977",
      /* Desktop — reduced format: Chrome 157, Opera 139 (Chromium 155), Firefox 159, Safari 27.1 */
      "chrome": {
        "ibm": "Mozilla/5.0 (OS/2; Warp 4.5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36",
        "linux": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36",
        "mac": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36",
        "freebsd": "Mozilla/5.0 (X11; FreeBSD amd64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36",
        "chromeOS": "Mozilla/5.0 (X11; CrOS x86_64 16181.47.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36",
        "windowsd": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36"
      },
      "opera": {
        "ibm": "Mozilla/5.0 (OS/2; Warp 4.5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36 OPR/139.0.0.0",
        "linux": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36 OPR/139.0.0.0",
        "freebsd": "Mozilla/5.0 (X11; FreeBSD amd64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36 OPR/139.0.0.0",
        "mac": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36 OPR/139.0.0.0",
        "chromeOS": "Mozilla/5.0 (X11; CrOS x86_64 16181.47.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36 OPR/139.0.0.0",
        "windowsd": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36 OPR/139.0.0.0"
      },
      "firefox": {
        "ibm": "Mozilla/5.0 (OS/2; Warp 4.5; rv:159.0) Gecko/20100101 Firefox/159.0",
        "linux": "Mozilla/5.0 (X11; Linux x86_64; rv:159.0) Gecko/20100101 Firefox/159.0",
        "freebsd": "Mozilla/5.0 (X11; FreeBSD amd64; rv:159.0) Gecko/20100101 Firefox/159.0",
        "mac": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:159.0) Gecko/20100101 Firefox/159.0",
        "chromeOS": "Mozilla/5.0 (X11; CrOS x86_64 16181.47.0; rv:159.0) Gecko/20100101 Firefox/159.0",
        "windowsd": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:159.0) Gecko/20100101 Firefox/159.0"
      },
      "safari": {
        "ibm": "Mozilla/5.0 (OS/2; Warp 4.5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.1 Safari/605.1.15",
        "linux": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.1 Safari/605.1.15",
        "freebsd": "Mozilla/5.0 (X11; FreeBSD amd64) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.1 Safari/605.1.15",
        "mac": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.1 Safari/605.1.15",
        "chromeOS": "Mozilla/5.0 (X11; CrOS x86_64 16181.47.0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.1 Safari/605.1.15",
        "windowsd": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.1 Safari/605.1.15"
      },
      "explorer": {
        "ibm": "Mozilla/5.0 (OS/2; Warp 4.5; Trident/7.0; rv:11.0) like Gecko",
        "linux": "Mozilla/5.0 (X11; Linux x86_64; Trident/7.0; rv:11.0) like Gecko",
        "freebsd": "Mozilla/5.0 (X11; FreeBSD amd64; Trident/7.0; rv:11.0) like Gecko",
        "windowsd": "Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko",
        "mac": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7; Trident/7.0; rv:11.0) like Gecko",
        "chromeOS": "Mozilla/5.0 (X11; CrOS x86_64 16181.47.0; Trident/7.0; rv:11.0) like Gecko"
      },
      "edge": {
        "linux": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0",
        "freebsd": "Mozilla/5.0 (X11; FreeBSD amd64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0",
        "ibm": "Mozilla/5.0 (OS/2; Warp 4.5; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0",
        "mac": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0",
        "chromeOS": "Mozilla/5.0 (X11; CrOS x86_64 16181.47.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0",
        "windowsd": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0"
      }
    }
  }
};
