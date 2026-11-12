var app = {};

app.error = function () {
  return chrome.runtime.lastError;
};

app.hotkey = {
  "on": {
    "pressed": function (callback) {
      chrome.commands.onCommand.addListener(function (e) {
        if (callback) callback(e);
      });
    }
  }
};

app.contentscripts = {
  "query": function (filter) {
    if (chrome.scripting) {
      return chrome.scripting.getRegisteredContentScripts(filter);
    }
  },
  "register": function (scripts) {
    if (chrome.scripting) {
      return chrome.scripting.registerContentScripts(scripts);
    }
  },
  "unregister": function (filter) {
    if (chrome.scripting) {
      if (filter) {
        return chrome.scripting.unregisterContentScripts(filter);
      } else {
        return chrome.scripting.unregisterContentScripts();
      }
    }
  }
};

app.popup = {
  "port": null,
  "message": {},
  "receive": function (id, callback) {
    if (id) {
      app.popup.message[id] = callback;
    }
  },
  "send": function (id, data) {
    if (id) {
      chrome.runtime.sendMessage({"data": data, "method": id, "path": "background-to-popup"}, app.error);
    }
  },
  "post": function (id, data) {
    if (id) {
      if (app.popup.port) {
        app.popup.port.postMessage({"data": data, "method": id, "path": "background-to-popup"});
      }
    }
  }
};

app.button = {
  /**
   * Displays the selected profile icon or the neutral toolbar icon.
   * Built-in image paths start at the extension root and are independent
   * of the background service worker's directory.
   *
   * @param {number|null|undefined} tabId Target tab or global toolbar.
   * @param {string|Object<string,string>} path Profile name or explicit icon paths.
   * @param {function(Error|null):void} callback Receives an optional Chrome API error.
   * @returns {void}
   */
  "icon": function (tabId, path, callback) {
    let icons = {};
    if (path && typeof path === "object") {
      icons = path;
    } else if (path) {
      icons = {
        "16": "/popup/icons/16/" + path + ".png",
        "32": "/popup/icons/32/" + path + ".png"
      };
    } else {
      icons = {
        "16": "/assets/icons/toolbar/16.png",
        "32": "/assets/icons/toolbar/32.png",
        "48": "/assets/icons/toolbar/48.png",
        "64": "/assets/icons/toolbar/64.png"
      };
    }
    /*  */
    const options = {"path": icons};
    if (tabId) options["tabId"] = tabId;
    chrome.action.setIcon(options, function () {
      const error = chrome.runtime.lastError;
      if (error) console.error("Toolbar icon: " + error.message);
      if (callback) callback(error || null);
    });
  }
};

app.storage = {
  "local": {},
  "read": function (id) {
    return app.storage.local[id];
  },
  "update": function (callback) {
    chrome.storage.local.get(null, function (e) {
      app.storage.local = e;
      if (callback) {
        callback("update");
      }
    });
  },
  "write": function (id, data, callback) {
    let tmp = {};
    tmp[id] = data;
    app.storage.local[id] = data;
    /*  */
    chrome.storage.local.set(tmp, function (e) {
      if (callback) {
        callback(e);
      }
    });
  },
  "remove": function (id, callback) {
    delete app.storage.local[id];
    chrome.storage.local.remove(id, function (e) {
      if (callback) {
        callback(e);
      }
    });
  },
  "clear": function (callback) {
    app.storage.local = {};
    chrome.storage.local.clear(function (e) {
      if (callback) {
        callback(e);
      }
    });
  },
  "load": function (callback) {
    const keys = Object.keys(app.storage.local);
    if (keys && keys.length) {
      if (callback) {
        callback("cache");
      }
    } else {
      app.storage.update(function () {
        if (callback) callback("disk");
      });
    }
  } 
};

app.on = {
  "management": function (callback) {
    chrome.management.getSelf(callback);
  },
  /* Registers an HTTP(S) uninstall destination or clears it with an empty
     string. Invalid input raises an error; Chrome failures reach the console. */
  "uninstalled": function (url) {
    if (typeof url !== "string") throw new TypeError("Uninstall URL must be a string");
    if (url) {
      const target = new URL(url);
      if (target.protocol !== "http:" && target.protocol !== "https:") throw new TypeError("Uninstall URL must use HTTP(S)");
      if (url.length > 1023) throw new RangeError("Uninstall URL exceeds 1023 characters");
    }
    chrome.runtime.setUninstallURL(url, function () {
      const error = chrome.runtime.lastError;
      if (error) console.error("Uninstall URL: " + error.message);
    });
  },
  "installed": function (callback) {
    chrome.runtime.onInstalled.addListener(function (e) {
      app.storage.load(function () {
        callback(e);
      });
    });
  },
  "startup": function (callback) {
    chrome.runtime.onStartup.addListener(function (e) {
      app.storage.load(function () {
        callback(e);
      });
    });
  },
  "connect": function (callback) {
    chrome.runtime.onConnect.addListener(function (e) {
      app.storage.load(function () {
        if (callback) callback(e);
      });
    });
  },
  "storage": function (callback) {
    chrome.storage.onChanged.addListener(function (changes, namespace) {
      app.storage.update(function () {
        if (callback) {
          callback(changes, namespace);
        }
      });
    });
  },
  "message": function (callback) {
    chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
      app.storage.load(function () {
        callback(request, sender, sendResponse);
      });
      /*  */
      return true;
    });
  }
};

app.page = {
  "port": null,
  "message": {},
  "sender": {
    "port": {}
  },
  "receive": function (id, callback) {
    if (id) {
      app.page.message[id] = callback;
    }
  },
  "post": function (id, data, tabId) {
    if (id) {
      if (tabId) {
        if (app.page.sender.port[tabId]) {
          app.page.sender.port[tabId].postMessage({"data": data, "method": id, "path": "background-to-page"});
        }
      } else if (app.page.port) {
        app.page.port.postMessage({"data": data, "method": id, "path": "background-to-page"});
      }
    }
  },
  "send": function (id, data, tabId, frameId) {
    if (id) {
      chrome.tabs.query({}, function (tabs) {
        let tmp = chrome.runtime.lastError;
        if (tabs && tabs.length) {
          const message = {
            "method": id, 
            "data": data ? data : {}, 
            "path": "background-to-page"
          };
          /*  */
          tabs.forEach(function (tab) {
            if (tab) {
              message.data.tabId = tab.id;
              message.data.top = tab.url ? tab.url : '';
              message.data.title = tab.title ? tab.title : '';
              /*  */
              if (tabId !== null && tabId !== undefined) {
                if (tabId === tab.id) {
                  if (frameId !== null && frameId !== undefined) {
                    chrome.tabs.sendMessage(tab.id, message, {"frameId": frameId}, app.error);
                  } else {
                    chrome.tabs.sendMessage(tab.id, message, app.error);
                  }
                }
              } else {
                chrome.tabs.sendMessage(tab.id, message, app.error);
              }
            }
          });
        }
      });
    }
  }
};

app.tab = {
  "open": function (url, index, active, callback) {
    const properties = {
      "url": url, 
      "active": active !== undefined ? active : true
    };
    /*  */
    if (index !== undefined) {
      if (typeof index === "number") {
        properties.index = index + 1;
      }
    }
    /*  */
    chrome.tabs.create(properties, function (tab) {
      if (callback) callback(tab);
    }); 
  },
  "query": {
    "index": function (callback) {
      chrome.tabs.query({"active": true, "currentWindow": true}, function (tabs) {
        let tmp = chrome.runtime.lastError;
        if (tabs && tabs.length) {
          callback(tabs[0].index);
        } else callback(undefined);
      });
    },
    "active": function (callback) {
      chrome.tabs.query({"active": true, "currentWindow": true}, function (tabs) {
        let tmp = chrome.runtime.lastError;
        if (tabs && tabs.length) {
          callback(tabs[0]);
        } else callback(undefined);
      });
    }
  },
  "reload": function (tabId, options, callback) {
    if (tabId) {
      if (options && typeof options === "object") {
        chrome.tabs.reload(tabId, options, function (e) {
          if (callback) callback(e);
        });
      } else {
        chrome.tabs.reload(tabId, {
          "bypassCache": options !== undefined ? options : false
        }, function (e) {
          if (callback) callback(e);
        }); 
      }
    } else {
      chrome.tabs.query({"active": true, "currentWindow": true}, function (tabs) {
        let tmp = chrome.runtime.lastError;
        if (tabs && tabs.length) {
          if (options && typeof options === "object") {
            chrome.tabs.reload(tabs[0].id, options, function (e) {
              if (callback) callback(e);
            });
          } else {
            chrome.tabs.reload(tabs[0].id, {
              "bypassCache": options !== undefined ? options : false
            }, function (e) {
              if (callback) callback(e);
            }); 
          }
        }
      });
    }
  },
  "on": {
    "updated": function (callback) {
      chrome.tabs.onUpdated.addListener(function (tabId, info, tab) {
        if (callback) callback(tabId, info, tab);
      });
    },
    "activated": function (callback) {
      chrome.tabs.onActivated.addListener(function (e) {
        if (callback) callback(e.tabId);
      });
    },
    "removed": function (callback) {
      chrome.tabs.onRemoved.addListener(function (tabId) {
        if (callback) callback(tabId);
      });
    }
  }
};

app.inject = {
  "js": function (options, callback) {
    if (chrome.scripting) {
      chrome.scripting.executeScript(options, function (e) {
        let tmp = chrome.runtime.lastError;
        if (callback) callback(e);
      });
    }
  },
  "css": function (options, callback) {
    if (chrome.scripting) {
      chrome.scripting.insertCSS(options, function (e) {
        let tmp = chrome.runtime.lastError;
        if (callback) callback(e);
      });
    }
  }
};
