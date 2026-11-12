(function () {
  /* a second injection pass (a pick re-parts the scripts into a running
     tab) would add a second listener pair over the same world: one copy
     only, and the marker lives in the isolated world so the page never
     sees it */
  if (window.__uas_isolated) return;
  window.__uas_isolated = true;
  /*  */

var background = (function () {
  let tmp = {};
  /*  */
  chrome.runtime.onMessage.addListener(function (request) {
    for (let id in tmp) {
      if (tmp[id] && (typeof tmp[id] === "function")) {
        if (request.path === "background-to-page") {
          if (request.method === id) {
            tmp[id](request.data);
          }
        }
      }
    }
  });
  /*  */
  return {
    "receive": function (id, callback) {
      tmp[id] = callback;
    },
    "send": function (id, data) {
      chrome.runtime.sendMessage({
        "method": id, 
        "data": data,
        "path": "page-to-background"
      }, function () {
        return chrome.runtime.lastError;
      });
    }
  }
})();

var config = {
  "key": "useragent-switcher-uastring",
  "metakey": "useragent-switcher-metahints",
  /* this tab's own override rides here on a perTab push: a later global
     broadcast (scope flip, spoof toggle, import) must not erase it */
  "perTab": null,
  "page": function () {
    /* sessionStorage is shared with the MAIN world, so this value is exactly
       what the page's JS sees; falls back to the real UA on any error */
    try {
      const spoofed = sessionStorage.getItem(config.key);
      return spoofed ? spoofed : navigator.userAgent;
    } catch (err) {
      return navigator.userAgent;
    }
  },
  "paint": function (useragent, meta) {
    try {
      if (useragent === null) sessionStorage.removeItem(config.key);
      else sessionStorage.setItem(config.key, useragent);
      sessionStorage.setItem(config.metakey, meta);
      return true;
    } catch (err) {
      /* sandboxed frames deny storage: the payload still reaches the
         MAIN world of the same document through the relay pack */
      return false;
    }
  },
  "relay": function (useragent, meta) {
    /* only a frame with denied storage publishes the pack: it lands on
       this document's element attribute, so the MAIN world reads it at
       pull time without any task-queue hop the host could beat */
    let denied = false;
    try {
      sessionStorage.getItem(config.key);
    } catch (err) {
      denied = true;
    }
    if (!denied) return;
    try {
      document.documentElement.setAttribute("data-uasw-relaydata", JSON.stringify({"useragent": useragent || '', "meta": meta || ''}));
    } catch (err) {}
  },
  "render": function (e) {
    const top = e.top;
    const useragent = e.useragent;
    const domains = e.url ? e.url.replace(/\s+/g, '').split(',') : [];
    /* the top-document-only mode: a same-origin frame shares the top's
       storage, so it writes NOTHING at all here (the top's own render
       publishes the frame mode inside the meta and the MAIN world
       declines); a private frame clears its own container, and an opaque
       frame relays the off payload when the writes refuse */
    if (e.frames === false && window !== window.top) {
      let sameorigin = false;
      try {
        sameorigin = Boolean(window.top.document);
      } catch (err) {
        sameorigin = false;
      }
      if (!sameorigin) {
        try {
          sessionStorage.removeItem(config.key);
          sessionStorage.setItem(config.metakey, '');
        } catch (err) {}
        config.relay('', '');
      }
      return;
    }
    /* An Exclusive domain has priority over any remembered this-tab pick.
       A page outside the scope receives no spoof metadata in either world. */
    try {
      let payload = null;
      const excluded = e.scope === "exclude" && !config.domain.match(top, domains, e.scope);
      if (excluded) {
        config.perTab = null;
        payload = [null, ''];
      } else if (e.perTab) {
        /* A this-tab override applies independently of Inclusive hosts.
           Exclusive hosts take precedence in the check above. */
        if (useragent) {
          config.perTab = e;
          payload = [useragent, e.meta || ''];
        } else {
          /* an empty perTab push is the explicit clear: the empty
              sentinel keeps the cached header payload from resurrecting */
          config.perTab = null;
          payload = [null, ''];
        }
      } else if (config.perTab && config.perTab.useragent) {
        /* a global broadcast reaches every tab: an overridden one re-applies
           its remembered payload instead of falling back to the global pick */
        payload = [config.perTab.useragent, config.perTab.meta || ''];
      } else if (useragent && config.domain.match(top, domains, e.scope)) {
        payload = [useragent, e.meta || ''];
      } else {
        payload = [null, ''];
      }
      /* a refused write means this frame keeps no state: the payload
         hands to the MAIN world relay pack for the same document */
      if (config.paint(payload[0], payload[1]) === false) config.relay(payload[0] === null ? '' : payload[0], payload[1]);
      /* the readout row belongs to the tab, not a frame: only the top
         document reports */
      if (window === window.top) background.send("agent", {"useragent": config.page()});
    } catch (err) {
      /* sandboxed or restricted frames: storage access throws, the real page
         UA survives untouched in those frames */
    }
  },
  "domain": {
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
    "match": function (top, domains, scope) {
      const host = config.domain.extract(top);
      if (!host) return true;
      /*  */
      if (scope === "exclude") {
        /* every site except the listed domains: a listed host (or a
           subdomain of one) is outside the scope, everything else is in */
        if (domains.indexOf('*') !== -1 || domains.indexOf("all_urls") !== -1) return false;
        /*  */
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
  }
};

background.receive("storage", config.render);
background.receive("report", function () {
  /* one-off probe from a freshly opened popup: the readout row asks the
     active page what it currently reports; the top document answers */
  if (window === window.top) background.send("agent", {"useragent": config.page()});
});
/* a fresh document never starts with the previous document's session
   values: sessionStorage rides the per-tab shared container (reload,
   back-forward, prerender), so the stale bytes would answer the MAIN
   world before this script's first roundtrip repaints them */
try {
  sessionStorage.removeItem(config.key);
  sessionStorage.removeItem(config.metakey);
} catch (err) {}
background.send("load", {"useragent": config.page()});
})();
