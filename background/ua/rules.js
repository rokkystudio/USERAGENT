var uarules = {};

/* priority — every header rule rides the top of the engine's priority
   ladder (practical maximum): another installed extension that writes the
   same headers then always scores below, instead of winning by its own
   higher-weighted rules ✓ */
uarules.priority = 1000000;

/* the per-tab lift — session rules carry one step more, so this-tab wins
   the tie against the global payload rule at equal priority instead of
   leaving the tab's request riding the global useragent ✓ */
uarules.tabpriority = 2000000;

/* queue — rule rebuilds run one after another so two fast clicks can never
   interleave the remove and the add step inside the engine ✓ */

uarules.queue = {
  "jobs": [],
  "busy": false,
  "push": function (job) {
    if (typeof job === "function") {
      uarules.queue.jobs.push(job);
      uarules.queue.flush();
    }
  },
  "flush": function () {
    if (!uarules.queue.busy) {
      uarules.queue.busy = true;
      uarules.queue.next();
    }
  },
  "next": function () {
    let job = uarules.queue.jobs.shift();
    if (job) {
      Promise.resolve().then(job).catch(function (err) {
        /* a throw inside a job surfaces instead of dying silently */
        uarules.report.set("Rebuild failed: " + (err && err.message ? err.message : "unknown"));
      }).then(function () {
        uarules.queue.next();
      });
    } else {
      uarules.queue.busy = false;
    }
  }
};

/* report — rule failures surface to the popup instead of dying silently;
   an empty string clears the last reported problem */
uarules.report = {
  "error": '',
  "set": function (message) {
    const clear = !message;
    if (clear && !uarules.report.error) return;
    if (!clear && uarules.report.error === message) return;
    /*  */
    uarules.report.error = message;
    app.popup.send("problem", {"error": message});
  },
  "clear": function () {
    uarules.report.set('');
  }
};

uarules.types = function () {
  /* xmlhttprequest is the exact type chrome tags every fetch and XHR with,
     so the resource coverage (echo endpoints, beacon probes) rides the
     full-coverage list like the reference addon carries it */
  let types = config.settings && config.settings.coverage === false ? ["main_frame", "sub_frame"] : ["main_frame", "sub_frame", "websocket", "script", "stylesheet", "image", "media", "font", "xmlhttprequest", "ping", "other"];
  /* the iframe switch drops sub_frame from every layer so the header side
     and the JS side stay consistent in the top-document-only mode */
  if (config.settings && config.settings.iframes === false) types = types.filter(function (e) {return e !== "sub_frame"});
  //
  return types;
};

/* push — appends one modifyHeaders rule (the engine assigns the final id) */
uarules.push = function (value, condition) {
  app.netrequest.rules.push({
    "action": {
      "type": "modifyHeaders",
      "requestHeaders": [
        {
          "value": value,
          "operation": "set",
          "header": "user-agent"
        }
      ]
    },
    "condition": condition,
    "priority": uarules.priority
  });
};

/* payload — the first-paint value the Server-Timing header rides on: the
   meta rides as a nested object (one parse on the page side) with the fake
   UA; empty string = earlypayload off, spoof off or the size guard tripped
   (an oversized meta can never break every document's response header) */
uarules.payload = function () {
  const value = config.useragent.string;
  if (!value) return '';
  return uarules.stamp(value);
};

/* stamp — the encoded Server-Timing value for one useragent string: shared
   by the global rebuild and the per-tab rules (the per-tab payload derives
   from the tab's own string, never from the global one); the earlypayload
   gate rides HERE so both callers share the toggle */
uarules.stamp = function (value) {
  if (config.settings && config.settings.earlypayload === false) return '';
  const meta = uarules.clienthints.meta(value);
  if (!meta) return '';
  //
  const data = JSON.stringify({"ua": value, "meta": JSON.parse(meta)});
  const payload = "uasw-json-data;dur=0;desc=\"" + encodeURIComponent(data) + "\"";
  return payload.length > 4000 ? '' : payload;
};

/* twin — the response-header sibling of uarules.push: the modified
   document response carries the payload so the page and every frame read
   the fake before their first inline script runs; no-op without payload.
   the twin condition copies the request shape (shallow: the condition
   object is shared with the stack) but rides DOCUMENT types only, so
   subresources never carry the payload and never read it back */
uarules.twin = function (payload, condition) {
  if (!payload) return;
  const scope = Object.assign({}, condition);
  scope.resourceTypes = uarules.types().filter(function (e) {return e === "main_frame" || e === "sub_frame"});
  app.netrequest.rules.push({
    "action": {
      "type": "modifyHeaders",
      "responseHeaders": [{"header": "Server-Timing", "operation": "set", "value": payload}]
    },
    "condition": scope,
    "priority": uarules.priority
  });
};

/* headers — the sec-ch-ua header list shared by the static rules and the
   per-tab session rules; empty list = no client-hint changes at all */
uarules.headers = function (meta) {
  let headers = [];
  if (!meta) return headers;
  /* every sec-ch-ua* header is a leak channel once the brand headers do not
     agree, so the strip pass removes the full family, not a subset */
  const family = [
    "sec-ch-ua",
    "sec-ch-ua-mobile",
    "sec-ch-ua-platform",
    "sec-ch-ua-full-version",
    "sec-ch-ua-full-version-list",
    "sec-ch-ua-platform-version",
    "sec-ch-ua-arch",
    "sec-ch-ua-bitness",
    "sec-ch-ua-model",
    "sec-ch-ua-wow64",
    "sec-ch-ua-form-factors"
  ];
  if (meta.strip) {
    family.forEach(function (header) {
      headers.push({"header": header, "operation": "remove"});
    });
  } else {
    headers.push({"header": "sec-ch-ua", "operation": "set", "value": meta.ua});
    headers.push({"header": "sec-ch-ua-mobile", "operation": "set", "value": meta.mobile});
    if (meta.text) {
      headers.push({"header": "sec-ch-ua-platform", "operation": "set", "value": meta.text});
    } else {
      headers.push({"header": "sec-ch-ua-platform", "operation": "remove"});
    }
    /* set mode fakes only the three brand headers: every other family
       member (full-version, arch, bitness...) would otherwise sail past
       with its REAL value once a site sends Accept-CH */
    const set = {"sec-ch-ua": 1, "sec-ch-ua-mobile": 1, "sec-ch-ua-platform": 1};
    family.forEach(function (header) {
      if (!set[header]) headers.push({"header": header, "operation": "remove"});
    });
  }
  /* the language header rides in both directions (set and strip), since a
     stripped brand family alone never hides the real chrome-language */
  if (meta.lang) headers.push({"header": "accept-language", "operation": "set", "value": meta.lang});
  /*  */
  return headers;
};

/* hint — one high-priority client-hints rule riding on the same condition
   as the UA rule; sec-ch-ua headers are set for chromium-family strings and
   stripped for every other fake (firefox, safari, ie, iphone...) */
uarules.hint = function (meta, condition) {
  const headers = uarules.headers(meta);
  if (!headers.length) return;
  /*  */
  app.netrequest.rules.push({
    "action": {
      "type": "modifyHeaders",
      "requestHeaders": headers
    },
    "condition": condition,
    "priority": uarules.priority
  });
};

/* apply — wipes previous rules, then rebuilds from the current state:
   one main_frame rule per host + one shared initiatorDomains rule so
   cross-origin frames and subresources carry the same fake UA as the page;
   every rebuilt pair gains a response twin that rides the Server-Timing
   header with the first-paint payload when the channel option is on;
   validation runs BEFORE the wipe so a broken scope can never strip the
   working rules and leave the extension UA-less */
uarules.apply = async function () {
  const value = config.useragent.string;
  const parsed = config.useragent.hosts;
  const meta = uarules.clienthints.headers();
  //
  if (!value) {
    await app.netrequest.rules.remove.by.action.type("modifyHeaders", "requestHeaders");
    await app.netrequest.rules.remove.by.action.type("modifyHeaders", "responseHeaders");
    return '';
  }
  //
  if (parsed.invalid.length) {
    return "Invalid entries: " + parsed.invalid.join(", ");
  }
  /* the star is exclusive: alone it matches everything through the literal
      urlFilter "*", the one match-all shape Chrome accepts; mixed with real
      hosts it is dropped because "||*" is an invalid urlFilter that rejects
      the entire rule set */
  let hosts = parsed.hosts.slice();
  let narrowed = '';
  const star = hosts.indexOf('*');
  const sole = star !== -1 && hosts.length === 1;
  if (star !== -1 && !sole) {
    hosts.splice(star, 1);
    narrowed = "Wildcard dropped: mixed with real hosts";
  }
  //
  if (config.scope.value === "exclude") {
    if (hosts.length === 0) {
      return "Exclude list is empty — add at least one domain to exclude";
    }
    if (sole) {
      return "Wildcard cannot be used as an exclusion";
    }
  }
  //
  await app.netrequest.rules.remove.by.action.type("modifyHeaders", "requestHeaders");
  await app.netrequest.rules.remove.by.action.type("modifyHeaders", "responseHeaders");
  const payload = uarules.payload();
  let types = uarules.types();
  if (config.scope.value === "exclude") {
    /* exclude mode inverts the scope: two almost-empty conditions carry
       the excluded domains so every other site gets the fake useragent */
    const condition = {"excludedRequestDomains": hosts.slice(), "resourceTypes": ["main_frame"]};
    uarules.push(value, condition);
    uarules.twin(payload, condition);
    uarules.hint(meta, condition);
    const extra = types.filter(function (e) {return e !== "main_frame"});
    /* Subresources originating outside an excluded host must also leave
       requests to that host untouched, regardless of their initiator. */
    const condition2 = {"excludedInitiatorDomains": hosts.slice(), "excludedRequestDomains": hosts.slice(), "resourceTypes": extra};
    uarules.push(value, condition2);
    uarules.twin(payload, condition2);
    uarules.hint(meta, condition2);
  } else if (sole || hosts.length === 0) {
    /* the match-all build: the literal filter matches every request URL,
       so no per-host or initiator rules ride along */
    const condition = {"urlFilter": '*', "resourceTypes": types};
    uarules.push(value, condition);
    uarules.twin(payload, condition);
    uarules.hint(meta, condition);
  } else {
    hosts.forEach(function (host) {
      const condition = {"urlFilter": "||" + host, "resourceTypes": ["main_frame"]};
      uarules.push(value, condition);
      uarules.twin(payload, condition);
      uarules.hint(meta, condition);
    });
    let extra = types.filter(function (e) {return e !== "main_frame"});
    const condition = {"initiatorDomains": hosts.slice(), "resourceTypes": extra};
    uarules.push(value, condition);
    uarules.twin(payload, condition);
    uarules.hint(meta, condition);
  }
  //
  try {
    await app.netrequest.rules.update();
  } catch (err) {
    return "Rule update failed: " + (err && err.message ? err.message : "unknown");
  }
  //
  return narrowed;
};

/* run — queues a fresh apply so the background never mutates the rule set twice at once */
uarules.run = function () {
  return new Promise(function (resolve) {
    uarules.queue.push(async function () {
      const error = await uarules.apply();
      uarules.report.set(error);
      /*  */
      resolve(error);
    });
  });
};
