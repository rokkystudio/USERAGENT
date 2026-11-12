var pertab = {};

/* pertab — "this tab" picks: the selected UA rides on a session rule with
   tabIds so only that tab gets it; the mode chooses where a pick lands, the
   active tab is resolved at pick time, and tab closure drops the override ✓ */

pertab.icons = {};
pertab.keys = {};
pertab.base = 1000000;

pertab.id = function (tabId) {
  return pertab.base + tabId;
};

pertab.responseid = function (tabId) {
  return pertab.base + 500000 + tabId;
};

pertab.active = function () {
  return new Promise(function (resolve) {
    app.tab.query.active(function (tab) {
      resolve(tab ? tab.id : null);
    });
  });
};

/* Applies one tab's HTTP User-Agent and page payload to all supported
   resource types except the configured Exclusive domains. Session rules
   preserve the override across worker restarts until the tab closes. */
pertab.set = function (tabId, value) {
  const id = pertab.id(tabId);
  const responseid = pertab.responseid(tabId);
  const payload = pertab.payload(value);
  const types = uarules.types();
  const excluded = config.scope.value === "exclude" ? config.useragent.hosts.hosts.filter(function (host) {return host !== '*'}) : [];
  const condition = {"tabIds": [tabId], "resourceTypes": types};
  if (excluded.length) {
    condition.excludedRequestDomains = excluded.slice();
    condition.excludedInitiatorDomains = excluded.slice();
  }
  /*  */
  return new Promise(function (resolve) {
    try {
      /* An existing request rule or response twin is replaced using its ID.
         Fresh tabs add new IDs without requesting removal of unknown IDs. */
      chrome.declarativeNetRequest.getSessionRules(function (rules) {
        let tmp = chrome.runtime.lastError;
        const list = rules || [];
        const exists = list.some(function (rule) {return rule.id === id});
        const existed = list.some(function (rule) {return rule.id === responseid});
        const options = {"addRules": [
          {
            "id": id,
            "priority": uarules.tabpriority,
            "action": {
              "type": "modifyHeaders",
              "requestHeaders": pertab.headers(value)
            },
            "condition": condition
          }
        ]};
        if (exists || existed) {
          options.removeRuleIds = exists && existed ? [id, responseid] : (exists ? [id] : [responseid]);
        }
        /* The response payload follows the same domain exclusions as the
           request header and applies only to frame navigation responses. */
        if (payload) {
          options.addRules.push({
            "id": responseid,
            "priority": uarules.tabpriority,
            "action": {
              "type": "modifyHeaders",
              "responseHeaders": [{"header": "Server-Timing", "operation": "set", "value": payload}]
            },
            "condition": Object.assign({}, condition, {
              "resourceTypes": types.filter(function (e) {return e === "main_frame" || e === "sub_frame"})
            })
          });
        }
        //
        chrome.declarativeNetRequest.updateSessionRules(options, function () {
          let tmp2 = chrome.runtime.lastError;
          resolve();
        });
      });
    } catch (err) {
      resolve();
    }
  });
};

pertab.payload = function (value) {
  return uarules.stamp(value);
};

pertab.headers = function (value) {
  let headers = [{"header": "user-agent", "operation": "set", "value": value}];
  /* the per-tab hint list derives from the tab's own string, not from the
     global one, so a Firefox-on-one-tab pick cannot ride Chrome hints */
  uarules.headers(uarules.clienthints.headers(value)).forEach(function (header) {
    headers.push(header);
  });
  /*  */
  return headers;
};

pertab.clear = function (tabId) {
  return new Promise(function (resolve) {
    try {
      chrome.declarativeNetRequest.getSessionRules(function (rules) {
        let tmp = chrome.runtime.lastError;
        const responseid = pertab.responseid(tabId);
        const ids = [pertab.id(tabId)];
        (rules || []).some(function (rule) {
          if (rule.id === responseid) {
            ids.push(responseid);
            return true;
          }
          return false;
        });
        //
        try {
          chrome.declarativeNetRequest.updateSessionRules({
            "removeRuleIds": ids
          }, function () {
            let tmp2 = chrome.runtime.lastError;
            resolve();
          });
        } catch (err) {
          resolve();
        }
      });
    } catch (err) {
      resolve();
    }
  });
};

pertab.value = function (tabId) {
  return new Promise(function (resolve) {
    try {
      const id = pertab.id(tabId);
      chrome.declarativeNetRequest.getSessionRules(function (rules) {
        let tmp = chrome.runtime.lastError;
        let ua = '';
        /*  */
        if (rules && rules.length) {
          rules.forEach(function (rule) {
            if (rule.id !== id) return;
            if (rule.action && rule.action.requestHeaders && rule.action.requestHeaders[0]) ua = rule.action.requestHeaders[0].value;
          });
        }
        /*  */
        resolve(ua);
      });
    } catch (err) {
      resolve('');
    }
  });
};

pertab.hosts = function () {
  return new Promise(function (resolve) {
    try {
      chrome.declarativeNetRequest.getSessionRules(function (rules) {
        let tmp = chrome.runtime.lastError;
        const tabIds = [];
        /* the response twin shares the tab condition, so the map stays a
           set of unique tab ids instead of counting every rule shape */
        (rules || []).forEach(function (rule) {
          const tabId = rule.condition && rule.condition.tabIds && rule.condition.tabIds[0];
          if (tabId && tabIds.indexOf(tabId) === -1) tabIds.push(Number(tabId));
        });
        /*  */
        resolve(tabIds);
      });
    } catch (err) {
      resolve([]);
    }
  });
};

pertab.snapshot = async function () {
  const mode = config.mode.value === "thistab" ? true : false;
  const tabId = await pertab.active();
  if (!tabId) return {"mode": false, "string": ''};
  /*  */
  const string = await pertab.value(tabId);
  const key = pertab.keys[tabId] !== undefined ? pertab.keys[tabId].slice() : (string ? ['', '', "custom"] : ['', '', "default"]);
  /*  */
  return {
    "mode": mode,
    "tabId": tabId,
    "string": string,
    "key": key
  };
};

pertab.setMode = async function (value) {
  config.mode.value = value;
  /* switching back to all-tabs restores every tab to the global useragent:
     the session rules die, and the pages learn about it in the same breath
     so their JS layer un-fakes without waiting for a reload */
  if (value !== "thistab") {
    /* the rule list is the source of truth: the memory map can still be
       empty right after a worker restart, when the rebuild has not landed */
    const hosts = await pertab.hosts();
    /*  */
    await pertab.purge();
    pertab.icons = {};
    pertab.keys = {};
    /*  */
    const meta = uarules.clienthints.meta();
    hosts.forEach(function (tabId) {
      /* the explicit clear rides an empty perTab push: that is the one
         signal the override memory accepts as "drop your payload", so the
         JS layer un-fakes instead of riding the remembered string */
      app.page.send("storage", {
        "top": '',
        "url": config.useragent.url,
        "scope": config.scope.value,
        "perTab": true,
        "frames": config.settings && config.settings.iframes === false ? false : true,
        "meta": '',
        "useragent": ''
      }, tabId, null);
      /*  */
      app.page.send("storage", {
        "top": '',
        "url": config.useragent.url,
        "scope": config.scope.value,
        "frames": config.settings && config.settings.iframes === false ? false : true,
        "meta": meta,
        "useragent": config.useragent.string
      }, tabId, null);
    });
  } else {
    /* entering this-tab mode: when no global pick is active the scripts are
       not registered anywhere, so the active tab gets them on the spot */
    app.tab.query.active(function (tab) {
      if (tab && tab.id) core.inject.tab(tab.id);
    });
  }
  /*  */
  if (watcher) watcher.refresh();
  /* the registration context moves with the mode too: thistab counts as an
     active pick for the scripts, and diff-bootstrapping it here means the
     next page load already carries the spoof layer */
  await core.register.ctscripts();
  core.action.popup.load();
};

pertab.pick = async function (state) {
  const resolved = core.resolve.useragent(state);
  const tabId = await pertab.active();
  if (!tabId) return;
  const value = core.sanitize.ua(resolved.string);
  /*  */
  const job = value ? pertab.set(tabId, value) : pertab.clear(tabId);
  await job;
  /* a default pick means the tab rides the global useragent again: the map
     entry dies so the watcher falls through to the global icon path */
  if (value) pertab.icons[tabId] = resolved.key[0];
  else delete pertab.icons[tabId];
  pertab.keys[tabId] = value ? resolved.key.slice() : ['', '', "default"];
  if (watcher) watcher.refresh(tabId);
  /* the page's JS layer needs the same string the headers get, pushed to
     this tab only so the page sees its own override immediately */
  app.page.send("storage", {
    "top": '',
    "url": config.useragent.url,
    "scope": config.scope.value,
    "perTab": true,
    "frames": config.settings && config.settings.iframes === false ? false : true,
    "meta": uarules.clienthints.meta(value || undefined),
    "useragent": value
  }, tabId, null);
  /* the tab may never have carried the content scripts (thistab mode with
     an empty global pick registers nothing): parts them in on the spot so
     the pick applies without a reload */
  core.inject.tab(tabId);
  core.action.popup.load();
};

/* restore — a worker restart wipes the memory-only icon and key maps while
   the session rules survive: rebuild both from the rules, matched table
   strings recover their slot, custom strings fall back to neutral */

pertab.restore = function () {
  try {
    chrome.declarativeNetRequest.getSessionRules(function (rules) {
      let tmp = chrome.runtime.lastError;
      (rules || []).forEach(function (rule) {
        const header = rule.action && rule.action.requestHeaders && rule.action.requestHeaders[0];
        const tabId = rule.condition && rule.condition.tabIds && rule.condition.tabIds[0];
        if (!header || !tabId) return;
        /*  */
        const value = header.value;
        const match = pertab.remember(value);
        /*  */
        pertab.icons[tabId] = match ? match.id : '';
        pertab.keys[tabId] = match ? match.key.slice() : ['', '', "custom"];
      });
    });
  } catch (err) {
    /* no session table = nothing to restore */
  }
};

pertab.remember = function (value) {
  const object = config.default.ua.object;
  /*  */
  for (let id in object) {
    if (typeof object[id] === "string") {
      /* mobile slots ride a 1-slot key, desktop slots a 2-slot one */
      if (object[id] === value) return {"id": id, "key": [id]};
    } else {
      for (let os in object[id]) {
        if (object[id][os] === value) return {"id": id, "key": [id, os]};
      }
    }
  }
  /*  */
  return null;
};

pertab.purge = function () {
  return new Promise(function (resolve) {
    try {
      chrome.declarativeNetRequest.getSessionRules(function (rules) {
        let tmp = chrome.runtime.lastError;
        const ids = (rules || []).map(function (rule) {return rule.id});
        /*  */
        try {
          chrome.declarativeNetRequest.updateSessionRules({"removeRuleIds": ids}, function () {
            let tmp2 = chrome.runtime.lastError;
            resolve();
          });
        } catch (err) {
          resolve();
        }
      });
    } catch (err) {
      resolve();
    }
  });
};

pertab.reset = function () {
  pertab.icons = {};
  pertab.keys = {};
};

app.tab.on.removed(function (tabId) {
  delete pertab.icons[tabId];
  delete pertab.keys[tabId];
  pertab.clear(tabId);
});
