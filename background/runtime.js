app.version = function () {return chrome.runtime.getManifest().version};
/* Returns the normalized HTTP(S) homepage from the manifest.
   An absent or invalid homepage has no destination and returns an empty string. */
app.homepage = function () {
  const value = chrome.runtime.getManifest().homepage_url;
  if (typeof value !== "string" || !value) return '';
  /*  */
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : '';
  } catch (err) {
    return '';
  }
};

if (!navigator.webdriver) {
  const homepage = app.homepage();
  const uninstall = homepage ? new URL(homepage) : null;
  /* Builds a valid uninstall destination from the manifest URL, or clears
     the uninstall destination when the manifest provides no homepage. */
  if (uninstall) {
    uninstall.searchParams.set("v", app.version());
    uninstall.searchParams.set("type", "uninstall");
  }
  app.on.uninstalled(uninstall ? uninstall.href : '');
  app.on.installed(function (e) {
    app.on.management(function (result) {
      if (result.installType === "normal") {
        app.tab.query.index(function (index) {
          let previous = e.previousVersion !== undefined && e.previousVersion !== app.version();
          let doupdate = previous && parseInt((Date.now() - config.welcome.lastupdate) / (24 * 3600 * 1000)) > 45;
          if (homepage && (e.reason === "install" || (e.reason === "update" && doupdate))) {
            const url = new URL(homepage);
            url.searchParams.set("v", app.version());
            if (e.previousVersion) url.searchParams.set("p", e.previousVersion);
            url.searchParams.set("type", e.reason);
            app.tab.open(url.href, index, e.reason === "install");
            config.welcome.lastupdate = Date.now();
          }
        });
      }
    });
  });
}

app.on.message(function (request, sender) {
  if (request) {
    if (request.path === "popup-to-background") {
      for (let id in app.popup.message) {
        if (app.popup.message[id]) {
          if ((typeof app.popup.message[id]) === "function") {
            if (id === request.method) {
              app.popup.message[id](request.data);
            }
          }
        }
      }
    }
    /*  */
    if (request.path === "page-to-background") {
      for (let id in app.page.message) {
        if (app.page.message[id]) {
          if ((typeof app.page.message[id]) === "function") {
            if (id === request.method) {
              let a = request.data || {};
              if (sender) {
                a.frameId = sender.frameId;
                /*  */
                if (sender.tab) {
                  if (a.tabId === undefined) a.tabId = sender.tab.id;
                  if (a.title === undefined) a.title = sender.tab.title ? sender.tab.title : '';
                  if (a.top === undefined) a.top = sender.tab.url ? sender.tab.url : (sender.url ? sender.url : '');
                }
              }
              /*  */
              app.page.message[id](a);
            }
          }
        }
      }
    }
  }
});

app.on.connect(function (port) {
  if (port) {
    if (port.name) {
      if (port.name in app) {
        app[port.name].port = port;
      }
    }
    /*  */
    port.onDisconnect.addListener(function (e) {
      app.storage.load(function () {
        if (e) {
          if (e.name) {
            if (e.name in app) {
              app[e.name].port = null;
            }
          }
        }
      });
    });
    /*  */
    port.onMessage.addListener(function (e) {
      app.storage.load(function () {
        if (e) {
          if (e.path) {
            if (e.port) {
              if (e.port in app) {
                if (e.path === (e.port + "-to-background")) {
                  for (let id in app[e.port].message) {
                    if (app[e.port].message[id]) {
                      if ((typeof app[e.port].message[id]) === "function") {
                        if (id === e.method) {
                          app[e.port].message[id](e.data);
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      });
    });
  }
});
