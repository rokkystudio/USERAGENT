var hints = {};

/* hints — client-hints support: reads what family the active UA string
   claims and derives Sec-CH-UA header values plus the JS-side meta blob
   consumed by the MAIN-world spoof module ✓ */

/* grease — Chromium derives the grease brand pair and the brands order
   from the browser's own major version (user_agent_utils.cc ->
   GetGreasedUserAgentBrandVersion + ShuffleBrandList); the fixed
   "Not/A)Brand" a scanner knows is the detection signal this avoids */

hints.grease = function (major) {
  const chars = [' ', '(', ':', '-', '.', '/', ')', ';', '=', '?', '_'];
  const versions = ['8', '99', '24'];
  const orders = [
    [0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]
  ];
  if (!/^\d+$/.test(String(major)) || Number(major) < 0) return null;
  const seed = Number(major);
  return {
    "brand": "Not" + chars[seed % chars.length] + "A" + chars[(seed + 1) % chars.length] + "Brand",
    "version": versions[seed % versions.length]
  };
};

/* brands — Chromium's engine major seeds both the GREASE pair and the
   stable permutation. The same returned list feeds HTTP Sec-CH-UA and
   navigator.userAgentData.brands, including the fixed-list mode. */

hints.orders = [
  [0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]
];

hints.fixedbrands = function (state) {
  if (!state || !state.version) return null;
  const own = state.brand || 'Chromium';
  const list = [
    {"brand": "Not:A-Brand", "version": "8"},
    {"brand": "Chromium", "version": state.version}
  ];
  if (own !== "Chromium") list.push({"brand": own, "version": state.brandversion || state.version});
  return list;
};

hints.brands = function (state) {
  if (!state || !state.version) return null;
  const seed = Number(state.version);
  const own = state.brand || 'Chromium';
  const grease = hints.grease(state.version);
  if (!grease || !Number.isFinite(seed)) return null;
  const list = [
    {"brand": grease.brand, "version": grease.version},
    {"brand": "Chromium", "version": state.version}
  ];
  if (own !== "Chromium") list.push({"brand": own, "version": state.brandversion || state.version});
  /* Chromium uses a stable permutation indexed by the engine major. */
  const shuffled = [];
  if (list.length === 2) {
    [seed % 2, (seed + 1) % 2].forEach(function (pos, i) {shuffled[pos] = list[i]});
  } else {
    hints.orders[seed % hints.orders.length].forEach(function (pos, i) {shuffled[pos] = list[i]});
  }
  return shuffled;
};

hints.brandlist = function (state) {
  if (!state || !state.version) return null;
  return config.settings && config.settings.grease !== false ? hints.brands(state) : hints.fixedbrands(state);
};

/* entropy — the canonical getHighEntropyValues bundle for Chromium-like
   fakes. Core values always stay coherent with the selected UA; the entropy
   option only adds richer model/form-factor details instead of switching to
   browser-major placeholders that disagree with the UA-CH contract. */

hints.entropy = function (state, string) {
  if (!state || !state.version) return null;
  const rich = !config.settings || config.settings.entropy !== false;
  const mobile = state.mobile;
  /* Windows NT 10.0 does not contain the full OS build. The selected
     profile provides a stable platform version without querying the host. */
  let platformversion = '';
  let win = new RegExp("Windows NT ([\\d.]+)").exec(string);
  if (win) {
    platformversion = {"10.0": "13.0.0", "6.3": "0.3.0", "6.2": "0.2.0", "6.1": "0.1.0"}[win[1]] || "13.0.0";
  } else if (/Intel Mac OS X/.test(string)) {
    platformversion = hints.version3(new RegExp("Mac OS X ([\\d_]+)").exec(string), "10.15.7");
  } else if (/Android/.test(string)) {
    platformversion = hints.version3(new RegExp("Android (\\d+(?:\\.\\d+)*)").exec(string), "10.0.0");
  } else if (/iPhone|iPad/.test(string)) {
    platformversion = hints.version3(new RegExp("OS (\\d+(?:[._]\\d+)*) like Mac OS X").exec(string), "10.0.0");
  }
  /* Bitness and architecture derive from the fake platform tokens even in
     the compact mode, because returning browser-major defaults here makes
     getHighEntropyValues contradict navigator.platform. */
  const bitness = mobile ? '' : (/WOW64/i.test(string) ? "32" : "64");
  const architecture = mobile ? '' : (/aarch64|armv[3-8]|\barm\b|arm mac os x/i.test(string) ? "arm" : "x86");
  let model = '';
  if (rich && mobile) {
    const found = new RegExp("Android[^;)]*; ?([^;)]+)").exec(string);
    model = found ? found[1].split(/\s+Build\b/)[0].trim() : '';
  }
  /* uaFullVersion follows the selected browser brand, while Chromium's full
     version remains available through fullVersionList. */
  let full = new RegExp("Chrome\\/([\\d.]+)").exec(string);
  if (state.brand === "Microsoft Edge") full = new RegExp("Edg(?:e|A|iOS)?\\/([\\d.]+)").exec(string) || full;
  else if (state.brand === "Opera") full = new RegExp("OPR\\/([\\d.]+)").exec(string) || full;
  const uafullversion = full ? hints.padded(full[1]) : hints.padded(state.brandversion || state.version);
  /*  */
  return {
    "platformversion": platformversion,
    "bitness": bitness,
    "architecture": architecture,
    "model": model,
    "formfactors": rich ? [mobile ? "Mobile" : "Desktop"] : null,
    "uafullversion": uafullversion
  };
};

hints.version3 = function (match, fallback) {
  const parts = ((match ? match[1] : '') || fallback).replace(/_/g, '.').split('.').map(function (e) {
    return /^\d+$/.test(e) ? e : '0';
  });
  while (parts.length < 3) parts.push('0');
  return parts.slice(0, 3).join('.');
};

hints.padded = function (version) {
  const parts = String(version || '').split('.');
  while (parts.length < 4) parts.push('0');
  return parts.slice(0, 4).join('.');
};

/* languages — what the match-language layer serves: one parsed list feeds
   both the accept-language header and the navigator.languages shape, the
   same lockstep the brand map keeps; null = leave language untouched */

hints.languages = function (string) {
  if (!config.settings || config.settings.matchlang !== true) return null;
  const raw = string !== undefined ? string : config.useragent.langlist;
  if (typeof raw !== "string") return null;
  /* entries survive sanitized AND validated: trimmed, printable only,
     capped at 35 chars, shaped like a language token (BCP47-ish: letters
     with optional script/region/variant runs); invalid tokens drop out
     so a garbage list answers null instead of a broken half-spoof */
  const shaped = /^[a-zA-Z]{1,8}(?:-[a-zA-Z0-9]{1,8})*$/;
  const list = raw.split(',').map(function (e) {
    let value = String(e).replace(/[^\x20-\x7E]/g, '').trim();
    if (value.length > 35) value = value.slice(0, 35);
    return value;
  }).filter(function (e) {return shaped.test(e)}).slice(0, 8);
  /* an unparsable list answers null, so the language layer just leaves
     the real value instead of a broken half-spoof */
  if (!list.length) return null;
  /* the header rides the real chrome q-pattern: first entry plain, the
     rest descending by a tenth starting at 0.9 */
  const header = list.map(function (e, i) {
    return i === 0 ? e : e + ";q=0." + (10 - i);
  }).join(",");
  return {
    "header": header,
    "list": list.slice()
  };
};

hints.state = function (string) {
  if (!string) return null;
  const major = /Chrome\/(\d+)/.exec(string);
  /*  */
  let platform = '';
  if (/Windows Phone/.test(string)) platform = '';
  else if (/Windows NT/.test(string)) platform = "Windows";
  else if (/Intel Mac OS X/.test(string)) platform = "macOS";
  else if (/CrOS/.test(string)) platform = "Chrome OS";
  else if (/Android/.test(string)) platform = "Android";
  else if (/Linux/.test(string)) platform = "Linux";
  else if (/iPhone|iPad/.test(string)) platform = "iOS";
  else if (/Tizen/.test(string)) platform = "Tizen";
  else if (/Symbian/.test(string)) platform = "Symbian";
  /*  */
  let brand = '';
  let brands = [];
  let brandversion = major ? major[1] : '';
  /*  */
  if (major) {
    brand = "Google Chrome";
    /*  */
    /*
      the brand must advertise its own version, not the Chromium engine one;
      the combined token regex covers both the modern Edg/ and the Windows
      Phone edge slots "Edge/15" of the UA lists
    */
    const edge = new RegExp("Edg(?:e|A|iOS)?\\/(\\d+)").exec(string);
    const opera = /OPR\/(\d+)/.exec(string);
    /*  */
    if (edge) brand = "Microsoft Edge";
    else if (opera) brand = "Opera";
    /*  */
    if (edge && brand === "Microsoft Edge") brandversion = edge[1];
    else if (opera && brand === "Opera") brandversion = opera[1];
    /*  */
    brands = [
      {"brand": "Not:A-Brand", "version": "8"},
      {"brand": "Chromium", "version": major[1]},
      {"brand": brand, "version": brandversion}
    ];
  }
  /*  */
  return {
    "brand": brand,
    "brands": brands,
    "platform": platform,
    "brandversion": brandversion,
    "mobile": /Mobile/.test(string),
    "version": major ? major[1] : ''
  };
};

/* headers — what the DNR layer needs: null = no hint rules at all,
   strip = remove every sec-ch-ua* header, else set them; an explicit
   string argument derives from that value, the default rides on the
   active global useragent */

hints.headers = function (string) {
  if (!config.settings || config.settings.spoof === false) return null;
  const value = string !== undefined ? string : config.useragent.string;
  if (!value) return null;
  const state = hints.state(value);
  if (!state) return null;
  /*  */
  const lang = hints.languages();
  if (!state.version) {
    return {"strip": true, "lang": lang ? lang.header : null};
  }
  /* The exact same ordered brand list feeds the network header and the
     JS-side NavigatorUAData shape in both computed and fixed modes. */
  const list = hints.brandlist(state);
  if (!list || !list.length) return {"strip": true, "lang": lang ? lang.header : null};
  const parts = list.map(function (e) {return '"' + e.brand + '";v="' + e.version + '"'});
  /*  */
  return {
    "strip": false,
    "ua": parts.join(", "),
    "text": state.platform,
    "mobile": state.mobile ? "?1" : "?0",
    "lang": lang ? lang.header : null
  };
};

/* meta — what the MAIN-world spoof module needs (serialized to
   sessionStorage by the isolated script): empty string = leave JS
   untouched; the sparse "plain" shape fakes only the UA string */

hints.meta = function (string) {
  const value = string !== undefined ? string : config.useragent.string;
  /* plain-only mode: complete spoof off keeps the UA string fake (the
     request header still rides the pick, so the page must agree) while
     every other property answers the real caller; "plain": true marks
     the sparse shape so readbacks never expect the full field set, and
     the mode flags ride it the same as they ride the full shape */
  if (!config.settings || config.settings.spoof === false) {
    if (!value) return '';
    return JSON.stringify({
      "ua": value,
      "plain": true,
      "hidewd": config.settings && config.settings.hidewebdriver === true,
      "dbgstamp": config.settings && config.settings.debugpayload === true,
      "frames": !config.settings || config.settings.iframes !== false,
      "sandbox": !config.settings || config.settings.spoofsandbox !== false
    });
  }
  if (!value) return '';
  /*  */
  const state = hints.state(value);
  const tokens = hints.platform(value);
  const brands = hints.brandlist(state);
  const fullbrands = hints.fullbrands(state, value, brands);
  /*  */
  let vendor = '';
  if (state && state.version) vendor = "Google Inc.";
  else if (/Safari\/6\d\d/.test(value)) vendor = "Apple Computer, Inc.";
  /*  */
  const native = !config.settings || config.settings.native !== false;
  const entropy = hints.entropy(state, value);
  const lang = hints.languages();
  const firefox = /Firefox\/|FxiOS\//.test(value);
  /* the delete list models the fake's family: a chromium fake strips the
     gecko-only navigator ids, a firefox fake shuts the real shell's
     window.chrome up and drops the IE helper the gecko family never had */
  const dels = config.settings.deleteleftovers === false ? [] : (firefox ? ["chrome", "external"] : ["oscpu", "buildID"]);
  /* the forge set rides the firefox direction only: MDN marks buildID and
     oscpu as gecko-only strings (chrome implements neither), so a chrome
     fake deletes them and a firefox fake gains the fixed build id stamp
     real firefox has reported since version 64 plus the platform oscpu;
     iOS ships the oscpu property on no engine, so the map answers null */
  const oscputable = {"iOS": null, "macOS": "Intel Mac OS X 10.15", "Windows": "Windows NT 10.0; Win64; x64", "Android": "Linux armv81", "Chrome OS": "Linux x86_64", "Linux": "Linux x86_64", "Symbian": "Linux armv8l", "Tizen": "Linux"};
  const oscpu = state ? (Object.prototype.hasOwnProperty.call(oscputable, state.platform) ? oscputable[state.platform] : "Linux x86_64") : "Linux x86_64";
  const forges = config.settings.deleteleftovers === false || !firefox || !state ? null : {"buildID": "20181001000000"};
  if (forges && oscpu) forges.oscpu = oscpu;
  const pin = config.settings.pindevice === false ? null : {"cores": 8, "memory": state && state.mobile ? 4 : 8};
  const appshort = state ? ({"iOS": "iPhone", "Linux": "X11", "macOS": "Macintosh", "Tizen": "X11", "Windows": "Windows", "Android": "X11", "Symbian": "X11", "Chrome OS": "X11"}[state.platform] || 'X11') : 'X11';
  let appversion = value.replace("Mozilla/", '');
  /* real firefox answers the short platform-only form; the option swaps
     the full-string form for the short one on firefox fakes only, since
     real chrome and safari answer with the full string */
  if (config.settings.shortappversion !== false && firefox) {
    /* real firefox answers "5.0 (X11; Linux x86_64)" on the unix family,
       "5.0 (Android)" on mobile and the single-word form on windows and
       mac; the platform token composes the unix detail like the real
       shell's short string would */
    let detail = appshort;
    if (state.platform === "Android") detail = "Android";
    else if ((state.platform === "Linux" || state.platform === "Chrome OS" || state.platform === "Tizen" || state.platform === "Symbian") && tokens) detail = "X11; " + tokens;
    appversion = "5.0 (" + detail + ")";
  }
  /*  */
  return JSON.stringify({
    "ua": value,
    "vendor": vendor,
    /* the option rides the meta so the MAIN world never needs storage
       access: true = keep the browser's real vendor when the fake itself
       has none (firefox fakes), false = report the fake's empty vendor */
    "realvendor": !config.settings || config.settings.realvendor === true,
    /* true = getHighEntropyValues reads the real browser bits, false =
       the derived self-consistent shape answers */
    "realbits": config.settings.realbits === true,
    /* true = the automation flag answers false while the fake rides
       (the flip-back restores the host descriptor) */
    "hidewd": config.settings.hidewebdriver === true,
    /* true = the debug option keeps the Server-Timing marker readable
       in the performance timeline (a testing aid, off keeps the strip) */
    "dbgstamp": config.settings.debugpayload === true,
    /* the frame mode rides in the meta so the MAIN world declines per
       frame without any shared-storage write: false = frames go real */
    "frames": !config.settings || config.settings.iframes !== false,
    /* the sandbox mode rides beside it: the MAIN world forges the
       navigator of frames a page appends while their lock keeps the
       storage channels out; false = locked frames answer real */
    "sandbox": !config.settings || config.settings.spoofsandbox !== false,
    /* the echo guard rides lazy too: true = a page answer whose body is
       exactly the real user agent reads as the fake */
    "echo": !config.settings || config.settings.fakeecho !== false,
    /* hardening flags: native = prototype accessors + native-shaped
       userAgentData, forged = the methods answer "[native code]". The low-
       and high-entropy brand lists are generated as one ordered pair so the
       network and JS surfaces cannot disagree. */
    "native": native,
    "forged": !config.settings || config.settings.forged !== false,
    "brands": brands || [],
    "fullbrands": fullbrands,
    "bundle": entropy,
    /* or null = leave language untouched */
    "languages": lang,
    "attr": tokens || '',
    "text": state ? state.platform : '',
    "version": state ? state.version : '',
    "mobile": state ? state.mobile : false,
    "pin": pin,
    "appversion": appversion,
    "full": entropy && entropy.uafullversion ? entropy.uafullversion : (state ? hints.padded(state.brandversion || state.version) : ''),
    "deletes": dels,
    "forges": forges
  });
};

/* fullbrands — the full-version sibling of the exact low-entropy brand
   list. Order and brand names stay identical; only each version expands to
   the full token carried by the selected UA. */

hints.fullbrands = function (state, string, source) {
  if (!state || !state.version) return null;
  const list = source || hints.brandlist(state);
  if (!list || !list.length) return null;
  const chrome = new RegExp("Chrome\\/([\\d.]+)").exec(string);
  let own = null;
  if (state.brand === "Microsoft Edge") own = new RegExp("Edg(?:e|A|iOS)?\\/([\\d.]+)").exec(string);
  else if (state.brand === "Opera") own = new RegExp("OPR\\/([\\d.]+)").exec(string);
  else own = chrome;
  const chromefull = chrome ? hints.padded(chrome[1]) : hints.padded(state.version);
  const ownfull = own ? hints.padded(own[1]) : hints.padded(state.brandversion || state.version);
  /*  */
  return list.map(function (entry) {
    if (entry.brand === "Chromium") return {"brand": entry.brand, "version": chromefull};
    if (entry.brand === (state.brand || '')) return {"brand": entry.brand, "version": ownfull};
    return {"brand": entry.brand, "version": hints.padded(entry.version)};
  });
};

hints.platform = function (string) {
  if (/Windows NT|Windows Phone/.test(string)) return "Win32";
  if (/Intel Mac OS X/.test(string)) return "MacIntel";
  if (/CrOS/.test(string)) return "Linux x86_64";
  if (/Linux x86/.test(string)) return "Linux x86_64";
  if (/Android/.test(string)) return "Linux armv81";
  if (/iPhone|iPad/.test(string)) return "iPhone";
  /*  */
  return '';
};

uarules.clienthints = {"headers": hints.headers, "meta": hints.meta};
