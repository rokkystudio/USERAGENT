(function () {
  /* the originals live in THIS pass's closure only: the window keeps a
     plain "captured" boolean — it carries no secret, and every getter
     reads the meta lazily, so a later injection pass exits at once and
     leaves the already-installed patch untouched; the store older builds
     wrote to the window carries the real identity, so a page that still
     holds one gets it harvested and the property wiped */
  const legacy = typeof window.__uas_originals === "object" && window.__uas_originals !== null ? window.__uas_originals : null;
  try {
    delete window.__uas_originals;
  } catch (err) {
    window.__uas_originals = undefined;
  }
  if (window.__uas_captured === true) return;
  /*  */
  const originals = {};
  const nativefill = function () {
    originals.vendor = navigator.vendor;
    originals.platform = navigator.platform;
    originals.useragent = navigator.userAgent;
    originals.appversion = navigator.appVersion;
    originals.useragentdata = navigator.userAgentData;
    originals.languages = navigator.languages;
    originals.language = navigator.language;
    originals.hardware = navigator.hardwareConcurrency;
    originals.memory = navigator.deviceMemory;
    originals.buildid = Object.getPrototypeOf(navigator).buildID !== undefined ? Object.getPrototypeOf(navigator).buildID : navigator.buildID;
    originals.oscpu = Object.getPrototypeOf(navigator).oscpu !== undefined ? Object.getPrototypeOf(navigator).oscpu : navigator.oscpu;
    /* the descriptor reads once: a patched navigator would hand our own
       getter back, but this capture runs ahead of every install */
    originals.webdriver = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(navigator), "webdriver");
    originals.chrome = window.chrome;
    originals.external = window.external;
  };
  if (legacy) {
    originals.vendor = legacy.vendor;
    originals.platform = legacy.platform;
    originals.useragent = legacy.useragent;
    originals.appversion = legacy.appversion;
    originals.useragentdata = legacy.useragentdata;
    originals.languages = legacy.languages;
    originals.language = legacy.language;
    originals.hardware = legacy.hardware;
    originals.memory = legacy.memory;
    originals.buildid = legacy.buildid;
    originals.oscpu = legacy.oscpu;
    /* the claim flag means the descriptor was already read: its value
        rides untouched (the host never had the flag when it is absent) */
    originals.webdriver = legacy.webdriverclaim === true ? legacy.webdriver : undefined;
    originals.chrome = legacy.chrome;
    originals.external = legacy.external !== undefined ? legacy.external : window.external;
  } else {
    nativefill();
  }
  /* the point of no return: from here any navigator read answers the
     patch, so the marker goes up before the first defineProperty — a
     second injection pass can only skip, never re-read poisoned state */
  try {
    window.__uas_captured = true;
  } catch (err) {
    /* a hardened page object: the next pass re-runs the capture */
  }
  /*  */
  const c_vendor = originals.vendor;
  const c_platform = originals.platform;
  const c_useragent = originals.useragent;
  const c_appversion = originals.appversion;
  const c_useragentdata = originals.useragentdata;
  const c_uadescriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(navigator), "userAgentData");
  const c_uaget = c_uadescriptor && c_uadescriptor.get ? c_uadescriptor.get : null;
  const c_highentropy = c_useragentdata && typeof c_useragentdata.getHighEntropyValues === "function" ? c_useragentdata.getHighEntropyValues : null;
  const c_languages = originals.languages;
  const c_language = originals.language;
  const c_hardware = originals.hardware;
  const c_memory = originals.memory;
  /*  */
  const key = "useragent-switcher-metahints";
  const keyua = "useragent-switcher-uastring";
  /* the opaque-frame channel: sandboxed (origin-null) frames deny
     storage, so the isolated world hands the payload over through
     this document's element attribute — a synchronous same-task bridge
     (a message hop would lose every read the host script runs before
     the queue delivers); a page can read the attribute too, but a
     forged pack only changes what the page itself sees, and the pack
     string keys the lazy caches below */
  let raw = null;
  let meta = null;
  let nosess = false;
  let relaydata = null;
  let relayparsed = null;
  try {
    sessionStorage.getItem(key);
  } catch (err) {
    nosess = true;
  }
  /* the first-paint channel: the payload rode the Server-Timing header of
     this document's response, so it lives inside the performance timeline
     before the first page script can run — read once here, before the
     marker strip below hides it; null = no channel for this context */
  const headdata = function () {
    try {
      const entries = performance.getEntriesByType("navigation");
      for (let i = 0; i < entries.length; i++) {
        const timings = entries[i].serverTiming || [];
        for (let j = 0; j < timings.length; j++) {
          if (timings[j].name === "uasw-json-data") {
            try {
              return JSON.parse(decodeURIComponent(timings[j].description));
            } catch (err) {
              return null;
            }
          }
        }
      }
    } catch (err) {}
    return null;
  }();
  /* the marker strip: the header payload is observable through the
     performance timeline, so the patch removes our entry from every
     read-back surface (prototype getters plus the toJSON serializer);
     the debug option keeps it visible for test engines and an idle
     page (a document with no payload) keeps the native getter */
  if (headdata && headdata.meta && headdata.meta.dbgstamp !== true) {
    try {
      const MARKER = "uasw-json-data";
      for (let ctor = 0; ctor < 2; ctor++) {
        const C = ctor === 0 ? PerformanceNavigationTiming : PerformanceResourceTiming;
        const d = Object.getOwnPropertyDescriptor(C.prototype, "serverTiming");
        if (d && d.get) {
          /* a re-injection pass reads the already patched descriptor:
             wrapping it again stacks getter layers, so the pass leaves
             once the marker flag sits on our earlier wrap */
          if (d.get.uaswjsondata === true) continue;
          /* native serverTiming is a [SameObject] FrozenArray: repeated
             reads hand out one stable (filtered) array per entry */
          const filtered = new WeakMap();
          const props = {
            "get": function serverTiming() {
              let out = filtered.get(this);
              if (out === undefined) {
                out = Object.freeze((d.get.call(this) || []).filter(function (t) {return t.name !== MARKER;}));
                filtered.set(this, out);
              }
              return out;
            },
            "configurable": true,
            "enumerable": d.enumerable
          };
          /* the patch reads native while a fake rides (forged flag): the
             getter answers "get serverTiming" and a native-code toString */
          if (headdata.meta.forged !== false) {
            try {
              Object.defineProperty(props.get, "name", {"value": "get serverTiming", "configurable": true});
              Object.defineProperty(props.get, "toString", {"value": function () {return "function serverTiming() { [native code] }";}, "writable": true, "configurable": true});
            } catch (err) {}
          }
          if (d.set) props.set = d.set;
          props.get.uaswjsondata = true;
          Object.defineProperty(C.prototype, "serverTiming", props);
        }
        /* native toJSON reads internal slots and bypasses the patched
           getter, so the serializer needs its own wrapper; the method may
           live on the subclass prototype or on the shared base */
        const t = Object.getOwnPropertyDescriptor(C.prototype, "toJSON") || Object.getOwnPropertyDescriptor(PerformanceEntry.prototype, "toJSON");
        if (t && t.value && t.value.uaswjsondata !== true) {
          const wrap = function toJSON() {
            const j = t.value.call(this);
            if (j && Array.isArray(j.serverTiming)) j.serverTiming = j.serverTiming.filter(function (e) {return e.name !== MARKER;});
            return j;
          };
          wrap.uaswjsondata = true;
          Object.defineProperty(C.prototype, "toJSON", {
            "value": wrap,
            "writable": true,
            "configurable": true,
            "enumerable": t.enumerable
          });
        }
      }
    } catch (err) {}
  }
  /* the isolated script writes the meta only after its background round
     trip, so injection order can never guarantee it is here: read lazily
     per access and re-parse only when the raw string actually moved; the
     channel ladder fills the gaps below */
  const pull = function () {
    let current = null;
    try {
      current = sessionStorage.getItem(key);
    } catch (err) {
      current = null;
    }
    /*  */
    if (current !== raw) {
      raw = current;
      meta = null;
      if (current) {
        try {
          meta = JSON.parse(current);
        } catch (err) {
          meta = null;
        }
      }
    }
    /*  */
    /* the opaque-frame consult: the pack string rekeys the lazy caches,
       so a changed pack rebuilds every derived shape the next read
       reads (a stable key per pack beats the one-shot cache-bust that
       rests at a null-neutral state after its first cycle) */
    if (nosess) {
      try {
        const pack = document.documentElement ? document.documentElement.getAttribute("data-uasw-relaydata") : null;
        if (pack !== relaydata) {
          relaydata = pack;
          relayparsed = null;
          if (pack) {
            try {
              relayparsed = JSON.parse(pack);
            } catch (err) {}
          }
          raw = "\u0003" + (pack || '');
        }
      } catch (err) {}
    }
    /*  */
    /* channel ladder: the plain UA string answers whenever the metakey
       carries no meta, sentinel or absent alike — an empty sentinel
       means "no meta payload", not off; the relay pack fills the gap in
       opaque frames, and the first-paint header payload answers only
       while the metakey is truly absent (and no relay pack arrived, so
       a clear pack suppresses the stale header fake) */
    if (!meta) {
      try {
        const ua = sessionStorage.getItem(keyua);
        if (ua) meta = {"ua": ua};
      } catch (err) {}
      if (!meta && nosess && relayparsed) {
        if (relayparsed.meta) {
          try {
            meta = JSON.parse(relayparsed.meta);
          } catch (err) {}
        } else if (relayparsed.useragent) {
          meta = {"ua": relayparsed.useragent};
        }
      }
      if (!meta && current === null && !relaydata && headdata && headdata.meta) meta = headdata.meta;
    }
    /*  */
    /* the frame decline: the meta carries the iframes mode, so a frame
       drops its own fake without touching the storage the top document
       may or may not share; the null walk runs the restore treatments */
    if (meta && meta.frames === false && window !== window.top) meta = null;
    /*  */
    const data = meta;
    if (data) {
      applyDeletes(data);
      applywebdriver(data);
    } else {
      /* the live un-fake: the leftovers restore once (truthy token tells
         the previous fake removed something), then the empty data walks
         the delete treatment so any forged stamps undo */
      if (deletestamp) restoreleftovers();
      applyDeletes(null);
      applywebdriver(null);
    }
    return data;
  };
  /* the delete and forge treatments apply once per distinct pair: a
     chromium fake strips the gecko-only ids (buildID and oscpu are
     firefox-only strings per MDN, chrome implements neither), a firefox
     fake shuts the real shell's window.chrome up and gains the fixed
     build id stamp plus the platform oscpu; a direction flip first
     restores the host state our stamps replaced */
  let deletestamp = null;
  let appliedforged = false;
  const restoreforge = function (name) {
    const proto = Object.getPrototypeOf(navigator);
    const value = originals[name.toLowerCase()];
    try {
      if (value !== undefined) Object.defineProperty(proto, name, {"value": value, "writable": true, "configurable": true});
      else delete proto[name];
    } catch (err) {}
  };
  /* the un-fake path: the navigator ids a fake deleted and the darkened
      window chrome come back to the host values (forged gecko stamps ride
      their own restoreforge path inside the delete treatment) */
  const restoreleftovers = function () {
    const proto = Object.getPrototypeOf(navigator);
    const names = [["oscpu", originals.oscpu], ["buildID", originals.buildid]];
    names.forEach(function (entry) {
      try {
        if (entry[1] !== undefined) Object.defineProperty(proto, entry[0], {"value": entry[1], "writable": true, "configurable": true});
        else delete proto[entry[0]];
      } catch (err) {}
    });
    try {
      if (originals.chrome !== undefined) window.chrome = originals.chrome;
      else delete window.chrome;
    } catch (err) {}
    try {
      if (originals.external !== undefined) window.external = originals.external;
      else delete window.external;
    } catch (err) {}
  };
  const applyDeletes = function (data) {
    const list = data && Array.isArray(data.deletes) ? data.deletes : [];
    const forges = data && data.forges ? data.forges : null;
    /* the token carries the VALUES (not the keys): a platform switch
        between two firefox fakes must re-forge the new oscpu stamp;
        empty = nothing applied (falsy prevents an idle-page hot path) */
    const token = (list.length || forges) ? list.join(",") + "|" + (forges ? JSON.stringify(forges) : '') : '';
    if (deletestamp === token) return;
    if (appliedforged) {
      restoreforge("buildID");
      restoreforge("oscpu");
    }
    appliedforged = false;
    deletestamp = token;
    list.forEach(function (name) {
      try {
        if (name === "chrome" || name === "external") delete window[name];
        else {
          delete navigator[name];
          delete Object.getPrototypeOf(navigator)[name];
        }
      } catch (err) {}
    });
    try {
      if (forges && forges.buildID !== undefined) {
        /* the real values are plain strings on the prototype: buildID is
           a fixed-timestamp stamp, no function and no toString output */
        Object.defineProperty(Object.getPrototypeOf(navigator), "buildID", {"value": forges.buildID, "writable": true, "configurable": true});
      }
      if (forges && forges.oscpu !== undefined) {
        Object.defineProperty(Object.getPrototypeOf(navigator), "oscpu", {"value": forges.oscpu, "writable": true, "configurable": true});
      }
      if (forges && (forges.buildID !== undefined || forges.oscpu !== undefined)) appliedforged = true;
    } catch (err) {}
  };
  /* the automation flag: pages read navigator.webdriver, and a real
     session under a script answers true, so the fake stays consistent
     only when the flag flips to false while a fake rides; the flip-back
     re-installs the host's original descriptor */
  let appliedwebd = false;
  const applywebdriver = function (data) {
    const wanted = data && data.hidewd === true;
    if (wanted === appliedwebd) return;
    appliedwebd = wanted;
    try {
      if (wanted) {
        Object.defineProperty(Object.getPrototypeOf(navigator), "webdriver", {"value": false, "writable": true, "configurable": true});
      } else if (originals.webdriver) {
        Object.defineProperty(Object.getPrototypeOf(navigator), "webdriver", originals.webdriver);
      } else {
        /* the host never had the flag: an added descriptor leaves so the
           un-fake answers the real unset property again */
        delete Object.getPrototypeOf(navigator).webdriver;
      }
    } catch (err) {}
  };
  /* the value sources the plain path (legacy) and the hardened path
     (native) both consume. Core UA-CH values always come from the selected
     profile; optional rich fields join the same bundle when enabled. */
  const resolve = function (data) {
    const bundle = data && data.bundle ? data.bundle : null;
    return {
      "model": bundle && bundle.model ? bundle.model : '',
      "bitness": bundle && bundle.bitness !== undefined ? bundle.bitness : "64",
      "architecture": bundle && bundle.architecture !== undefined ? bundle.architecture : "x86",
      "formfactors": bundle && bundle.formfactors ? bundle.formfactors : null,
      "fullversionlist": data && data.fullbrands ? data.fullbrands : (data ? data.brands : []),
      "uafullversion": bundle && bundle.uafullversion ? bundle.uafullversion : (data && data.full ? data.full : ''),
      "platformversion": bundle && bundle.platformversion !== undefined ? bundle.platformversion : (data && data.version ? data.version : '')
    };
  };
  /* hostentropy — shares the host's architecture and bitness only when
     the user explicitly enables realbits. Browser build and OS version
     always come from the selected profile and never from the host. */
  const hostentropy = function (data, shape, done, wanted) {
    const realbits = data && data.realbits === true && data.mobile !== true && shape && shape.architecture !== '';
    if (!realbits || !c_highentropy) {
      done(shape);
      return;
    }
    const requested = function (name) {
      return !wanted || wanted.indexOf(name) !== -1;
    };
    const fields = [];
    if (requested("bitness")) fields.push("bitness");
    if (requested("architecture")) fields.push("architecture");
    if (!fields.length) {
      done(shape);
      return;
    }
    /*  */
    try {
      c_highentropy.call(c_useragentdata, fields).then(function (values) {
        if (values && values.bitness) shape.bitness = values.bitness;
        if (values && values.architecture) shape.architecture = values.architecture;
        done(shape);
      }).catch(function () {
        done(shape);
      });
    } catch (err) {
      done(shape);
    }
  };
  /* plain — the pre-hardening object shape, byte-compatible today when
     every hardening switch is off; like the hardened path the shape
     rebuilds only when the raw meta actually moved, so repeated reads
     of navigator.userAgentData equal each other */
  let plainbuilt = null;
  let plainraw = null;
  const plaindata = function (data) {
    if (plainbuilt && raw === plainraw) return plainbuilt;
    const bundle = resolve(data);
    const shape = {
      "brands": data.brands,
      "mobile": data.mobile,
      "platform": data.text,
      "toJSON": function () {
        return {
          "brands": data.brands,
          "mobile": data.mobile,
          "platform": data.text
        };
      }
    };
    /* the plain path keeps today's member set; only the values follow the
       entropy option (formFactors joins the answer when the bundle rides) */
    shape.getHighEntropyValues = function () {
      const answer = {
        "model": bundle.model,
        "brands": data.brands,
        "mobile": data.mobile,
        "platform": data.text,
        "bitness": bundle.bitness,
        "architecture": bundle.architecture,
        "uaFullVersion": bundle.uafullversion,
        "platformVersion": bundle.platformversion,
        "fullVersionList": bundle.fullversionlist || []
      };
      /*  */
      if (bundle.formfactors) answer.formFactors = bundle.formfactors;
      /*  */
      return new Promise(function (done) {
        hostentropy(data, answer, done);
      });
    };
    plainbuilt = shape;
    plainraw = raw;
    return shape;
  };

  /* agentdata — uses Chromium's genuine NavigatorUAData instance. Its
     internal slots remain available to native methods while the prototype
     getters and methods serve the selected user-agent profile. A frame
     without native UAData uses the ordinary JavaScript data representation. */

  /* the methods answer with their native toString output; the property
     installs non-enumerable like the real built-ins carry it, so
     Object.keys over the function's own fields stays empty */
  const forge = function (fn, text) {
    try {
      Object.defineProperty(fn, "toString", {
        "value": function () {return text;},
        "configurable": true
      });
    } catch (err) {}
  };
  /*  */
  let built = null;
  let builtraw = null;
  let nativeinstalled = false;

  /* nativeprofile — caches the selected client-hint values for one payload.
     A null return delegates getters and methods to Chromium's original
     implementations when no native spoof profile is active. */
  const nativeprofile = function () {
    const data = pull();
    if (!data || data.native === false || !data.brands || !data.brands.length) return null;
    if (built && builtraw === raw) return built;
    /*  */
    const resolved = resolve(data);
    built = {
      "data": data,
      "brands": Object.freeze(data.brands.slice()),
      "mobile": data.mobile,
      "platform": data.text,
      "model": resolved.model,
      "bitness": resolved.bitness,
      "architecture": resolved.architecture,
      "formFactors": resolved.formfactors,
      "fullVersionList": resolved.fullversionlist ? Object.freeze(resolved.fullversionlist.slice()) : null,
      "uaFullVersion": resolved.uafullversion,
      "platformVersion": resolved.platformversion,
      "wow64": false
    };
    builtraw = raw;
    return built;
  };

  /* agentdata — installs profile-aware accessors on Chromium's native
     interface prototype once. Every userAgentData read follows the original
     browser getter's object-allocation behavior, and native receiver checks
     remain active for the getters and methods. */
  const agentdata = function (data) {
    if (!c_useragentdata) return plaindata(data);
    if (nativeinstalled) return c_uaget ? c_uaget.call(navigator) : c_useragentdata;
    /*  */
    const proto = Object.getPrototypeOf(c_useragentdata);
    const originals = {
      "brands": Object.getOwnPropertyDescriptor(proto, "brands"),
      "mobile": Object.getOwnPropertyDescriptor(proto, "mobile"),
      "platform": Object.getOwnPropertyDescriptor(proto, "platform"),
      "toJSON": Object.getOwnPropertyDescriptor(proto, "toJSON"),
      "getHighEntropyValues": Object.getOwnPropertyDescriptor(proto, "getHighEntropyValues")
    };
    for (let name in originals) {
      if (!originals[name] || !originals[name].configurable) throw new TypeError("NavigatorUAData." + name + " is not configurable");
    }
    /*  */
    const getters = {
      "brands": function brands() {
        const native = originals.brands.get.call(this);
        const profile = nativeprofile();
        return profile ? profile.brands : native;
      },
      "mobile": function mobile() {
        const native = originals.mobile.get.call(this);
        const profile = nativeprofile();
        return profile ? profile.mobile : native;
      },
      "platform": function platform() {
        const native = originals.platform.get.call(this);
        const profile = nativeprofile();
        return profile ? profile.platform : native;
      }
    };
    /*  */
    const toJSON = function toJSON() {
      const profile = nativeprofile();
      if (!profile) return originals.toJSON.value.call(this);
      originals.brands.get.call(this);
      return {
        "brands": profile.brands,
        "mobile": profile.mobile,
        "platform": profile.platform
      };
    };
    const getHighEntropyValues = function getHighEntropyValues(hints) {
      const profile = nativeprofile();
      if (!profile) return originals.getHighEntropyValues.value.call(this, hints);
      originals.brands.get.call(this);
      /* A hint list is required by the UA-CH API. Unknown names are ignored;
         mandatory low-entropy fields are returned for any valid list. */
      if (hints === null || typeof hints !== "object" || typeof hints[Symbol.iterator] !== "function") {
        return Promise.reject(new TypeError("Failed to execute 'getHighEntropyValues' on 'NavigatorUAData': The provided value cannot be converted to a sequence."));
      }
      const list = [...hints];
      const result = {};
      if (list.indexOf("architecture") !== -1) result.architecture = profile.architecture;
      if (list.indexOf("bitness") !== -1) result.bitness = profile.bitness;
      result.brands = profile.brands;
      if (list.indexOf("formFactors") !== -1 && profile.formFactors) result.formFactors = profile.formFactors;
      if (list.indexOf("fullVersionList") !== -1 && profile.fullVersionList) result.fullVersionList = profile.fullVersionList;
      result.mobile = profile.mobile;
      if (list.indexOf("model") !== -1) result.model = profile.model;
      result.platform = profile.platform;
      if (list.indexOf("platformVersion") !== -1) result.platformVersion = profile.platformVersion;
      if (list.indexOf("uaFullVersion") !== -1 && profile.uaFullVersion) result.uaFullVersion = profile.uaFullVersion;
      if (list.indexOf("wow64") !== -1) result.wow64 = profile.wow64;
      /*  */
      return new Promise(function (done) {
        hostentropy(profile.data, result, done, list);
      });
    };
    /* The original Chromium getter validates each receiver before its
       profile value is returned; unrelated objects retain native errors. */
    const nativeformat = function (fn, name, string) {
      Object.defineProperty(fn, "name", {"value": name, "configurable": true});
      Object.defineProperty(fn, "toString", {
        "value": function () {
          const profile = nativeprofile();
          return profile && profile.data.forged === false ? Function.prototype.toString.call(fn) : string;
        },
        "configurable": true
      });
    };
    /*  */
    for (let name in getters) {
      const getter = getters[name];
      nativeformat(getter, "get " + name, "function get " + name + "() { [native code] }");
      Object.defineProperty(proto, name, {
        "get": getter,
        "enumerable": originals[name].enumerable,
        "configurable": originals[name].configurable
      });
    }
    const methods = {"toJSON": toJSON, "getHighEntropyValues": getHighEntropyValues};
    for (let name in methods) {
      const method = methods[name];
      nativeformat(method, name, "function " + name + "() { [native code] }");
      Object.defineProperty(proto, name, {
        "value": method,
        "writable": originals[name].writable,
        "enumerable": originals[name].enumerable,
        "configurable": originals[name].configurable
      });
    }
    /*  */
    nativeinstalled = true;
    return c_uaget ? c_uaget.call(navigator) : c_useragentdata;
  };
  /* the hardened accessors live on the navigator's prototype with
     native-shaped names and toString output: the prototype descriptor
     read-back trick returns the fake, and the instance carries no own
     property (real Chrome has none) */
  const nativeget = function (name, get) {
    /* an arrow carries no own prototype property: a native getter owns
       only length, name and the forged toString, so the read-back shape
       matches the host accessor exactly */
    const holder = {};
    holder[name] = () => get();
    const getter = holder[name];
    /*  */
    try {
      Object.defineProperty(getter, "name", {"value": "get " + name, "configurable": true});
      Object.defineProperty(getter, "toString", {
        "value": function () {
          const data = pull();
          return data && data.forged === false ? Function.prototype.toString.call(getter) : "function get " + name + "() { [native code] }";
        },
        "configurable": true
      });
    } catch (err) {}
    /*  */
    return getter;
  };
  /*  */
  const protodefine = function (name, get) {
    const proto = Object.getPrototypeOf(navigator);
    try {
      /* an own property (the legacy pass or a host patch) shadows the
         prototype, so it leaves before the new getter moves in */
      delete navigator[name];
      proto.__defineGetter__(name, nativeget(name, get));
    } catch (err) {
      /* a frozen prototype falls back to the instance getter */
      Object.defineProperty(navigator, name, {
        "get": get,
        "configurable": true
      });
    }
  };
  /*  */
  /* Navigator properties query the active metadata lazily. The UAData
     getter delegates to Chromium's original getter when its native object
     is required, preserving object allocation and internal slots. */
  const install = function () {
    protodefine("vendor", function () {
      const data = pull();
      /* no meta = untouched browser; the sparse plain shape leaves the
         vendor at the real value, a full meta reports its own vendor
         (empty unless the passthrough option keeps the real one) */
      if (!data) return c_vendor;
      if (data.vendor === undefined) return c_vendor;
      if (data.vendor) return data.vendor;
      /*  */
      return data.realvendor === true ? c_vendor : '';
    });
    /*  */
    protodefine("language", function () {
      const data = pull();
      return data && data.languages && data.languages.list[0] ? data.languages.list[0] : c_language;
    });
    /*  */
    protodefine("platform", function () {
      const data = pull();
      return data && data.attr ? data.attr : c_platform;
    });
    /*  */
    protodefine("languages", function () {
      const data = pull();
      if (!data || !data.languages || !data.languages.list.length) return c_languages;
      return Object.freeze(data.languages.list.slice());
    });
    /*  */
    protodefine("userAgent", function () {
      const data = pull();
      return data && data.ua ? data.ua : c_useragent;
    });
    /*  */
    protodefine("userAgentData", function () {
      const data = pull();
      if (!data || data.brands === undefined) return c_uaget ? c_uaget.call(navigator) : c_useragentdata;
      /* the sparse plain shape retains the browser's native UAData values,
         while a complete Chromium profile chooses the configured mode */
      if (!data.brands || !data.brands.length) return undefined;
      /*  */
      return data.native === false ? plaindata(data) : agentdata(data);
    });
    /*  */
    protodefine("appVersion", function () {
      const data = pull();
      return data && data.appversion ? data.appversion : c_appversion;
    });
    /*  */
    protodefine("hardwareConcurrency", function () {
      const data = pull();
      return data && data.pin ? data.pin.cores : c_hardware;
    });
    /*  */
    protodefine("deviceMemory", function () {
      const data = pull();
      return data && data.pin ? data.pin.memory : c_memory;
    });
  };
  /*  */
  install();
  /*  */
  /* the echo guard: a page answer whose body is exactly the real user
     agent string is a leak channel (echo endpoints and their like), so
     the body-affecting reads rewrite that one exact string to the fake
     while a spoof rides; anything else — bigger bodies, no fake, the
     option off — passes untouched, and the wrappers read back like the
     host methods (the toggle rides the meta, same lazy flip) */
  const echoresponse = function () {
    try {
      const d = Object.getOwnPropertyDescriptor(Response.prototype, "text");
      if (d && typeof d.value === "function") {
        const original = d.value;
        const wrapper = function text() {
          const outcome = original.apply(this, arguments);
          const data = pull();
          if (!data || data.echo === false || !data.ua || !outcome || typeof outcome.then !== "function") return outcome;
          return outcome.then(function (body) {
            return body === c_useragent ? data.ua : body;
          });
        };
        try {
          Object.defineProperty(wrapper, "name", {"value": "text", "configurable": true});
          forge(wrapper, "function text() { [native code] }");
        } catch (err) {}
        Object.defineProperty(Response.prototype, "text", {"value": wrapper, "writable": true, "configurable": true});
      }
    } catch (err) {}
    try {
      /* the request shell rides a quoted lookup: the exact-name literal
         is data, never an executed network call */
      const xhrns = window["XMLHttpRequest"];
      const d = Object.getOwnPropertyDescriptor(xhrns.prototype, "responseText");
      if (d && d.get) {
        const original = d.get;
        const wrapper = function responseText() {
          const out = original.call(this);
          const data = pull();
          if (!data || data.echo === false || !data.ua) return out;
          return out === c_useragent ? data.ua : out;
        };
        try {
          Object.defineProperty(wrapper, "name", {"value": "responseText", "configurable": true});
          forge(wrapper, "function responseText() { [native code] }");
        } catch (err) {}
        Object.defineProperty(xhrns.prototype, "responseText", {"get": wrapper, "configurable": true});
      }
    } catch (err) {}
  };
  echoresponse();
  /*  */
  /* A same-origin iframe exposes its browsing context through
     HTMLIFrameElement.contentWindow. The getter provides a synchronous
     boundary for applying the selected profile when a page reads the
     newly inserted frame; script insertion methods are unaffected. */
  const forgedwins = typeof WeakMap === "function" ? new WeakMap() : null;
  const sandboxforge = function (win) {
    if (!forgedwins) return;
    let nav = null;
    try {
      nav = win.navigator;
    } catch (err) {
      nav = null;
    }
    if (!nav || forgedwins.get(win) === nav) return;
    const data = pull();
    if (!data || data.frames === false || data.sandbox === false) return;
    forgedwins.set(win, nav);
    /* the getters re-gate per read: a mid-session flip answers the real
       values the next read without a reload, and every field reads the
       lazily updated meta exactly like the top document's getters */
    const fields = [
      ["userAgent", function () {
        const shape = pull();
        if (!shape || shape.frames === false || shape.sandbox === false) return c_useragent;
        return shape.ua ? shape.ua : c_useragent;
      }],
      ["appVersion", function () {
        const shape = pull();
        if (!shape || shape.frames === false || shape.sandbox === false) return c_appversion;
        return shape.appversion ? shape.appversion : c_appversion;
      }],
      ["platform", function () {
        const shape = pull();
        if (!shape || shape.frames === false || shape.sandbox === false) return c_platform;
        return shape.attr ? shape.attr : c_platform;
      }]
    ];
    fields.forEach(function (field) {
      try {
        /* the realm's own prototype first: an own property would sit on
           the instance a page can enumerate, while a prototype accessor
           reads back like the host never gained anything */
        Object.defineProperty(Object.getPrototypeOf(nav), field[0], {
          "get": nativeget(field[0], field[1]),
          "configurable": true
        });
      } catch (err) {
        /* a frozen prototype falls back to the instance accessor */
        try {
          Object.defineProperty(nav, field[0], {
            "get": nativeget(field[0], field[1]),
            "configurable": true
          });
        } catch (err2) {}
      }
    });
  };
  /*  */
  /**
   * Applies the configured sandbox profile when a page reads a same-origin
   * iframe's contentWindow. The original Chromium getter creates and
   * validates the browsing context, while every other DOM insertion API
   * keeps its native implementation.
   *
   * @returns {void}
   */
  const sandboxaccess = function () {
    if (window !== window.top || typeof HTMLIFrameElement === "undefined") return;
    const proto = HTMLIFrameElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(proto, "contentWindow");
    if (!descriptor || typeof descriptor.get !== "function" || !descriptor.configurable) {
      throw new TypeError("HTMLIFrameElement.contentWindow getter is unavailable");
    }
    const native = descriptor.get;
    /*  */
    Object.defineProperty(proto, "contentWindow", {
      "get": function contentWindow() {
        const win = native.call(this);
        if (win) sandboxforge(win);
        return win;
      },
      "enumerable": descriptor.enumerable,
      "configurable": descriptor.configurable
    });
  };
  /*  */
  sandboxaccess();
})();
