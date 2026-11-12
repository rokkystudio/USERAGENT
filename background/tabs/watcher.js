var watcher = {};

/* scope — a tab shows the browser logo only when its host sits inside the
   active domain scope; tabs outside the scope and the default state keep
   the neutral toolbar icon ✓ */

watcher.active = undefined;

/* Paints the selected browser icon only where its global or per-tab
   user agent can actually apply. Exclusive domains keep the neutral icon. */
watcher.paint = function (tab) {
  const host = config.domain.extract(tab.url ? tab.url : '');
  const inside = host ? config.domain.match(host, config.useragent.hosts.hosts) : false;
  const cached = pertab.icons !== undefined ? pertab.icons[tab.id] : undefined;
  if (cached !== undefined) {
    app.button.icon(tab.id, config.scope.value === "exclude" && !inside ? '' : cached);
    return;
  }
  /*  */
  const value = config.useragent.string;
  /* no shortcut for empty hosts: a chrome://-type page carries no initiator,
     so an include rule can never cover it — and in exclude-shaped scopes
     the empty-host reply would widen the badge by mistake, so no badge */
  const icon = value && inside && config.badge.icon ? config.badge.icon : '';
  app.button.icon(tab.id, icon);
};

watcher.refresh = async function (tabId) {
  if (!Object.keys(app.storage.local).length) {
    await new Promise(function (resolve) {
      app.storage.update(function () {
        resolve('update');
      });
    });
  }
  /*  */
  if (tabId) {
    chrome.tabs.get(tabId, function (tab) {
      let tmp = chrome.runtime.lastError;
      if (tab) watcher.paint(tab);
    });
  } else {
    chrome.tabs.query({}, function (tabs) {
      let tmp = chrome.runtime.lastError;
      if (tabs && tabs.length) {
        tabs.forEach(function (tab) {
          if (tab) watcher.paint(tab);
        });
      }
    });
  }
};

watcher.on = {
  "updated": function (tabId, info) {
    if (info.url || info.status === "complete") watcher.refresh(tabId);
  },
  "activated": function (tabId) {
    /* the readout relay filters on this cache: only the active tab's
       report may reach the popup readout row */
    watcher.active = tabId;
    watcher.refresh(tabId);
  }
};

app.tab.on.updated(watcher.on.updated);
app.tab.on.activated(watcher.on.activated);
