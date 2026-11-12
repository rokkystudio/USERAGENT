var core = {
  "start": function () {
    core.load();
  },
  "install": function () {
    core.load();
  },
  "load": function () {
    config.domain.cleanup(config.useragent.url);
    /*  */
    if (watcher) watcher.refresh();
    core.register.netrequest();
  },
  "broadcast": function () {
    if (!config.settings.liveupdate) return;
    /*  */
    app.page.send("storage", {
      "top": '',
      "url": config.useragent.url,
      "scope": config.scope.value,
      "frames": config.settings && config.settings.iframes === false ? false : true,
      "meta": uarules.clienthints.meta(),
      "useragent": config.useragent.string
    });
  },
  "reapply": function () {
    /* one queue job owns the rule wipe, the rebuild, the content script swap
       and the page broadcast so fast clicks can never run interleaved ✓ */
    return new Promise(function (resolve) {
      uarules.queue.push(async function () {
        const error = await uarules.apply();
        /* the report fires both ways: the setter dedupes, so a success
           clears a stale problem row and an unchanged error stays silent */
        uarules.report.set(error);
        /*  */
        await core.register.ctscripts();
        core.broadcast();
        /*  */
        resolve(error);
      });
    });
  },
  "sanitize": {
    "ua": function (string) {
      /* entry-point guard: printable ASCII only, no line breaks, chopped
         at 512 — a junk string can no longer reject the whole rule set;
         the option off keeps the raw input for exotic pastes */
      if (config.settings.strictclean === false) return string;
      if (typeof string !== "string") return '';
      let value = string.replace(/[^\x20-\x7E]/g, '').trim();
      /*  */
      if (value.length > 512) value = value.slice(0, 512);
      /*  */
      return value;
    }
  },
  "register": {
    /* Registers both script worlds only where the selected domain scope
       applies. Exclusive domains receive no MAIN-world interception; a
       this-tab selection still works outside the global inclusive list. */
    "ctscripts": async function () {
      const active = Boolean(config.useragent.string || config.mode.value === "thistab");
      const parsed = config.useragent.hosts;
      let hosts = parsed.hosts.slice();
      if (hosts.length > 1) hosts = hosts.filter(function (host) {return host !== '*'});
      const wildcard = hosts.length === 1 && hosts[0] === '*';
      const excluded = config.scope.value === "exclude";
      const valid = !parsed.invalid.length && (!excluded || (hosts.length && !wildcard));
      let wanted = [];
      /*  */
      if (active && valid) {
        const matches = !excluded && config.mode.value !== "thistab" && hosts.length && !wildcard ?
          hosts.map(function (host) {return "*://*." + host + "/*"}) : ["*://*/*"];
        const excludeMatches = excluded ? hosts.map(function (host) {return "*://*." + host + "/*"}) : [];
        /* each registration owns its own match arrays; the source filters
           stay available for explicit injection into an existing tab */
        wanted = config.contentscripts.filters.map(function (filter) {
          const item = Object.assign({}, filter);
          item.matches = matches.slice();
          if (excludeMatches.length) item.excludeMatches = excludeMatches.slice();
          return item;
        });
      }
      /* Compare the complete registration definition before updating Chrome:
         a scope change unregisters stale patterns and registers new ones. */
      const fresh = [];
      const staleIds = [];
      /*  */
      const signature = function (e) {
        return JSON.stringify({"allFrames": e.allFrames, "excludeMatches": e.excludeMatches || [], "js": e.js, "matchOriginAsFallback": e.matchOriginAsFallback, "matches": e.matches, "runAt": e.runAt, "world": e.world});
      };
      /*  */
      try {
        const registered = (await app.contentscripts.query()) || [];
        /*  */
        wanted.forEach(function (item) {
          const current = registered.filter(function (entry) {return entry.id === item.id})[0] || null;
          if (current && signature(current) === signature(item)) return;
          /*  */
          if (current) staleIds.push(item.id);
          fresh.push(item);
        });
        /*  */
        registered.forEach(function (entry) {
          const kept = wanted.some(function (item) {return item.id === entry.id && signature(entry) === signature(item)});
          if (!kept && staleIds.indexOf(entry.id) === -1) staleIds.push(entry.id);
        });
        /*  */
        if (staleIds.length) await app.contentscripts.unregister({"ids": staleIds});
        if (fresh.length) await app.contentscripts.register(fresh);
      } catch (err) {
        uarules.report.set("Injection failed: " + (err && err.message ? err.message : String(err)));
      }
    },
    "netrequest": async function () {
      await app.netrequest.display.badge.text(false);
      await uarules.run();
    }
  },
  "inject": {
    /* Applies scripts to an existing top-level document only when its host
       belongs to the effective scope. Registered scripts cover new frames
       according to their independent URL match patterns. */
    "tab": function (tabId) {
      if (!tabId) return;
      chrome.tabs.get(tabId, function (tab) {
        const error = chrome.runtime.lastError;
        if (error || !tab || !tab.url) return;
        const host = config.domain.extract(tab.url);
        if (!host) return;
        const inScope = config.domain.match(host, config.useragent.hosts.hosts);
        if (config.scope.value === "exclude" && !inScope) return;
        if (config.mode.value !== "thistab" && !inScope) return;
        /*  */
        config.contentscripts.filters.forEach(function (filter) {
          app.inject.js({
            "target": {"tabId": tabId},
            "world": filter.world,
            "injectImmediately": true,
            "files": filter.js
          });
        });
      });
    }
  },
  "resolve": {
    "useragent": function (state) {
      const object = config.useragent.obj;
      const overrides = config.useragent.overrides;
      const hasKey = state.id ? !!state.id.length : false;
      /* a table-shaped key plus an explicit string = that slot's value is
         being overridden; an empty slot key rides the plain custom path */
      const tableKey = state.string !== undefined && hasKey && state.id[0] ? state.id.slice() : (state.string === undefined && hasKey ? state.id : null);
      const key = tableKey || ['', '', "custom"];
      /*  */
      let string = '';
      /*  */
      if (state.string !== undefined) string = state.string;
      else if (key[2] === "default") string = '';
      else if (key.length === 1) string = typeof overrides[key[0]] === "string" ? overrides[key[0]] : (object[key[0]] || '');
      else if (key.length === 2) string = overrides[key[0]] && overrides[key[0]][key[1]] !== undefined ? overrides[key[0]][key[1]] : (object[key[0]] ? (object[key[0]][key[1]] || '') : '');
      /*  */
      return {
        "key": key,
        "string": string
      };
    }
  },
  "update": {
    "useragent": async function (state) {
      if (!state) return;
      /*  */
      const resolved = core.resolve.useragent(state);
      /*  */
      const key = resolved.key;
      const string = core.sanitize.ua(resolved.string);
      const object = config.default.ua.object;
      /*  */
      config.useragent.key = key;
      config.useragent.string = string;
      /* an edit stays pinned to its slot: the stored string only becomes an
         override when it differs from the table pick, so a plain re-pick and
         a hotkey restore never write needless override data */
      if (state.string !== undefined && key[0] && key[1]) {
        const tableString = object[key[0]] ? (object[key[0]][key[1]] || '') : '';
        /* an edit that squares with the stock value must DELETE any pinned
           override: overrides outrank the table at resolve time, so a left
           over entry would keep the slot pinned forever */
        if (tableString && tableString === string) {
          const overrides = config.useragent.overrides;
          if (overrides[key[0]] && typeof overrides[key[0]] === "object" && overrides[key[0]][key[1]] !== undefined) {
            delete overrides[key[0]][key[1]];
            if (Object.keys(overrides[key[0]]).length === 0) delete overrides[key[0]];
            config.useragent.overrides = overrides;
          }
        } else if (tableString && tableString !== string) {
          const overrides = config.useragent.overrides;
          if (typeof overrides[key[0]] !== "object" || overrides[key[0]] === null) overrides[key[0]] = {};
          /*  */
          overrides[key[0]][key[1]] = string;
          config.useragent.overrides = overrides;
        }
      } else if (state.string !== undefined && key[0] && !key[1]) {
        const tableString = object[key[0]] || '';
        /*  */
        if (tableString && tableString === string) {
          const overrides = config.useragent.overrides;
          if (typeof overrides[key[0]] === "string") {
            delete overrides[key[0]];
            config.useragent.overrides = overrides;
          }
        } else if (tableString !== string) {
          const overrides = config.useragent.overrides;
          /*  */
          overrides[key[0]] = string;
          config.useragent.overrides = overrides;
        }
      }
      /* the text label: the popup's own status relay owns the keyed slot
         picks, so the engine only labels the keyless custom strings and
         the default state itself */
      if (state.text) config.useragent.text = state.text;
      else if (!key[0] && key[2] === "custom" && string) config.useragent.text = "UserAgent: Custom";
      else if (key[2] === "default" || !key[0]) config.useragent.text = "UserAgent: Default";
      /*  */
      if (string) config.useragent.last = {"id": key.slice(), "string": string, "text": config.useragent.text};
      config.badge.icon = string ? key[0] : '';
      /*  */
      await core.reapply();
      /*  */
      app.button.icon(null, config.badge.icon);
      if (watcher) watcher.refresh();
      core.action.popup.load();
    }
  },
  "action": {
    "storage": function (changes, namespace) {
      /*  */
    },
    "page": {
      "load": async function (e) {
        const tabId = e ? e.tabId : null;
        /* this-tab mode answers the page with its own override when the tab
           has one, and rides the regular domain-gated global payload when it
           does not, so headers and page JS always agree */
        if (tabId !== null && tabId !== undefined && config.mode.value === "thistab") {
          const override = await pertab.value(tabId);
          if (override) {
            app.page.send("storage", {
              "url": config.useragent.url,
              "scope": config.scope.value,
              "perTab": true,
              "top": e ? e.top : '',
              "frames": config.settings && config.settings.iframes === false ? false : true,
              "useragent": override,
              "meta": uarules.clienthints.meta(override)
            }, tabId, e ? e.frameId : null);
          } else {
            app.page.send("storage", {
              "top": e ? e.top : '',
              "url": config.useragent.url,
              "scope": config.scope.value,
              "frames": config.settings && config.settings.iframes === false ? false : true,
              "meta": uarules.clienthints.meta(),
              "useragent": config.useragent.string
            }, tabId, e ? e.frameId : null);
          }
          /*  */
          core.action.page.agent({
            "tabId": tabId,
            "top": e ? e.top : '',
            "useragent": e.useragent
          });
          return;
        }
        /*  */
        core.action.page.agent({
          "top": e ? e.top : '',
          "useragent": e.useragent,
          "tabId": e ? e.tabId : ''
        });
        /*  */
        app.page.send("storage", {
          "top": e ? e.top : '',
          "url": config.useragent.url,
          "scope": config.scope.value,
          "frames": config.settings && config.settings.iframes === false ? false : true,
          "meta": uarules.clienthints.meta(),
          "useragent": config.useragent.string,
        }, e ? e.tabId : null, e ? e.frameId : null);
      },
      "agent": function (e) {
        /* the readout row belongs to the active tab: a background page that
           loads in the meantime must not overwrite the popup's value; no
           cache yet (worker restart) = forward, the ping re-anchors it */
        if (watcher.active !== undefined && e && e.tabId !== undefined) {
          const reported = String(e.tabId);
          if (reported !== String(watcher.active)) return;
        }
        /*  */
        app.popup.send("useragent", {
          "top": e ? e.top : '',
          "tabId": e ? e.tabId : '',
          "useragent": e.useragent !== undefined ? e.useragent : ''
        });
      }
    },
    "hotkey": async function (e) {
      if (e === "toggle-default-mode") {
        /* the toggle follows the mode: in this-tab mode the flip touches the
           active tab's override, everywhere else it flips the global pick */
        const dispatch = function (state) {return config.mode.value === "thistab" ? pertab.pick(state) : core.update.useragent(state)};
        /* this-tab mode branches on the tab's own override: with a global
           pick live the tab flip is about the tab, not about the global */
        let cleared = false;
        if (config.mode.value === "thistab") {
          const tabId = await pertab.active();
          const override = tabId ? await pertab.value(tabId) : '';
          cleared = Boolean(override);
        } else {
          cleared = Boolean(config.useragent.string);
        }
        if (cleared) {
          dispatch({"id": ['', '', "default"]});
        } else {
          let last = config.useragent.last;
          if (last && last.id && last.id.length) {
            const state = {"id": last.id};
            /*  */
            if (last.string !== undefined) state.string = last.string;
            if (last.text) state.text = last.text;
            /*  */
            dispatch(state);
          }
        }
      }
    },
    "settings": {
      "langlist": async function (e) {
        if (typeof e !== "string") return;
        config.useragent.langlist = e;
        /* the list feeds the accept-language header and the JS shape at
           once, so live rules and pages re-learn the payload together
           (nothing to re-push while the language option is off) */
        if (config.settings.matchlang === true) await core.action.settings.repush();
        core.action.popup.load();
      },
      "update": async function (e) {
        if (!e) return;
        const writable = [
          "spoof",
          "coverage",
          "liveupdate",
          "confirmreset",
          "confirmdefault",
          "backbuttons",
          "remember",
          "strictclean",
          "realvendor",
          "realbits",
          "native",
          "grease",
          "entropy",
          "deleteleftovers",
          "shortappversion",
          "forged",
          "pindevice",
          "matchlang",
          "earlypayload",
          "iframes",
          "hidewebdriver",
          "spoofsandbox",
          "fakeecho",
          "debugpayload",
          "statusheight",
          "statusplain",
          "statusshow"
        ];
        /* the flips that change derived headers or the JS meta rebuild the
           rule set and the per-tab payloads instead of waiting for reload */
        const reaffect = [
          "spoof",
          "coverage",
          "realvendor",
          "realbits",
          "native",
          "grease",
          "entropy",
          "deleteleftovers",
          "shortappversion",
          "forged",
          "pindevice",
          "matchlang",
          "earlypayload",
          "iframes",
          "hidewebdriver",
          "spoofsandbox",
          "fakeecho",
          "debugpayload"
        ];
        /*  */
        if (writable.indexOf(e.key) === -1) return;
        /*  */
        config.settings[e.key] = e.value;
        /*  */
        if (reaffect.indexOf(e.key) !== -1) await core.action.settings.repush();
        /*  */
        core.action.popup.load();
      },
      "repush": async function () {
        await core.reapply();
        /* session rules carry their own header list, so a spoof, coverage
           or vendor flip has to rebuild every live tab override too */
        const ids = Object.keys(pertab.keys || {});
        for (let i = 0; i < ids.length; i++) {
          const tabId = Number(ids[i]);
          const value = await pertab.value(tabId);
          if (value) {
            await pertab.set(tabId, value);
            /* the tab's JS layer re-learns its own meta in the same
               breath, so navigator.userAgent and the page memory agree */
            app.page.send("storage", {
              "top": '',
              "url": config.useragent.url,
              "scope": config.scope.value,
              "perTab": true,
              "frames": config.settings && config.settings.iframes === false ? false : true,
              "meta": uarules.clienthints.meta(value),
              "useragent": value
            }, tabId, null);
            core.inject.tab(tabId);
          }
        }
        if (watcher) watcher.refresh();
      },
      "imported": async function () {
        /* the file was written from the popup side, so the cache mirror can
           still hold the pre-import state when this message wins the race
           against the storage onChanged reload — pull the disk once */
        await new Promise(function (resolve) {app.storage.update(resolve)});
        /* imported files can predate the cleanup or come from anywhere, so
           the ride-along strings get the same entry treatment as fresh ones;
           a value that survives the pass unchanged is written nowhere */
        const string = core.sanitize.ua(config.useragent.string);
        if (string !== config.useragent.string) config.useragent.string = string;
        const library = config.useragent.library.map(function (entry) {
          return {"label": core.sanitize.ua(entry.label || ''), "ua": core.sanitize.ua(entry.ua)};
        });
        config.useragent.library = library;
        /*  */
        await core.reapply();
        /* an imported payload can flip the hardening switches under existing
           per-tab overrides: the same rebuild update-settings runs covers the
           session rules and the riding meta of every overridden tab */
        await core.action.settings.repush();
        /* the imported file carries the toolbar logo; derive it from the
           freshly written badge state so a re-import restores the icon */
        app.button.icon(null, config.badge.icon);
        /*  */
        if (watcher) watcher.refresh();
        core.action.popup.load();
      },
      "reset": async function () {
        await app.storage.clear();
        await app.contentscripts.unregister();
        await app.netrequest.rules.remove.by.scope("dynamic");
        /* the overridden tab ids read from the surviving rules before the
           purge: the memory map alone can still be stale after a restart */
        const hosts = await pertab.hosts();
        await pertab.purge();
        /*  */
        pertab.reset();
        /* every overridden tab drops its page memory first: the remembered
           per-tab payload would otherwise re-apply fake values onto the
           fresh global broadcast below */
        hosts.forEach(function (tabId) {
          app.page.send("storage", {
            "top": '',
            "perTab": true,
            "frames": config.settings && config.settings.iframes === false ? false : true,
            "meta": '',
            "useragent": ''
          }, tabId, null);
        });
        /* rebuild from the cleared defaults so open tabs stop being spoofed
           immediately: headers drop, content scripts unload, pages unsync */
        await core.reapply();
        /*  */
        app.button.icon(null, '');
        if (watcher) watcher.refresh();
        /*  */
        uarules.report.clear();
        core.action.popup.load();
      }
    },
    "popup": {
      "status": function (txt) {
        config.useragent.text = txt;
      },
      "view": function (e) {
        config.view.name = e;
      },
      "theme": {
        "toggle": function () {
          config.interface.theme = config.interface.theme === "light" ? "dark" : "light";
          core.action.popup.load();
        },
        "set": function (value) {
          if (value === "light" || value === "dark") config.interface.theme = value;
        }
      },
      "reload": function () {
        app.tab.query.active(function (tab) {
          if (tab) {
            app.tab.reload(tab.id);
          }
        });
      },
      "descriptioncolor": function (e) {
        config.description.color = typeof e === "string" ? e : '';
        /*  */
        core.action.popup.load();
      },
      "load": async function () {
        const thistab = await pertab.snapshot();
        /*  */
        app.popup.send("storage", {
          "thistab": thistab,
          "mode": config.mode.value,
          "scope": config.scope.value,
          "key": config.useragent.key,
          "url": config.useragent.url,
          "text": config.useragent.text,
          "theme": config.interface.theme,
          "problem": uarules.report.error,
          "string": config.useragent.string,
          "library": config.useragent.library,
          "view": config.view.name,
          "settings": {
            "spoof": config.settings.spoof,
            "color": config.description.color,
            "coverage": config.settings.coverage,
            "liveupdate": config.settings.liveupdate,
            "confirmreset": config.settings.confirmreset,
            "confirmdefault": config.settings.confirmdefault,
            "backbuttons": config.settings.backbuttons,
            "strictclean": config.settings.strictclean,
            "remember": config.settings.remember,
            "realvendor": config.settings.realvendor,
            "realbits": config.settings.realbits,
            "native": config.settings.native,
            "grease": config.settings.grease,
            "entropy": config.settings.entropy,
            "deleteleftovers": config.settings.deleteleftovers,
            "shortappversion": config.settings.shortappversion,
            "forged": config.settings.forged,
            "pindevice": config.settings.pindevice,
            "matchlang": config.settings.matchlang,
            "earlypayload": config.settings.earlypayload,
            "iframes": config.settings.iframes,
            "hidewebdriver": config.settings.hidewebdriver,
            "spoofsandbox": config.settings.spoofsandbox,
            "fakeecho": config.settings.fakeecho,
            "debugpayload": config.settings.debugpayload,
            "statusheight": config.settings.statusheight,
            "statusplain": config.settings.statusplain,
            "statusshow": config.settings.statusshow,
            "langlist": config.useragent.langlist
          }
        });
        /* the readout row asks the active page what it currently reports:
           without this ping a popup open shows the last-reporter value or
           the untouched stub; restricted pages just answer with silence */
        app.tab.query.active(function (tab) {
          if (tab && tab.id) {
            /* the ping re-anchors the active-tab cache after a worker
               restart, so the answer relayed below passes the filter */
            watcher.active = tab.id;
            app.page.send("report", {}, tab.id, 0);
          }
        });
      },
      "update": {
        "useragent": {
          "url": async function (e) {
            const result = config.domain.parse(e);
            if (result.hosts.length === 0) {
              app.popup.send("problem", {
                "error": "Invalid entries: " + (result.invalid.join(", ") || "empty input"),
                "url": config.useragent.url
              });
              /*  */
              return;
            }
            /*  */
            config.useragent.url = result.hosts.join(", ");
            await core.reapply();
            /*  */
            if (watcher) watcher.refresh();
            /* partial input keeps the valid hosts but still reports the
               rejected ones so silent narrowing is impossible */
            if (result.invalid.length) {
              const note = "Invalid entries: " + result.invalid.join(", ");
              app.popup.send("problem", {"error": note});
              config.useragent.text = note;
              core.action.popup.load();
              /*  */
              return;
            }
            /*  */
            core.action.popup.load();
          },
          "string": function (e) {
            const value = e ? (e.UA || '') : '';
            const state = {"string": value};
            if (e && e.key && e.key.length && e.key[0]) state.id = e.key.slice();
            /*  */
            if (config.mode.value === "thistab") pertab.pick(state);
            else core.update.useragent(state);
          },
          "id": function (e) {
            if (e && e.id) {
              if (config.mode.value === "thistab") pertab.pick({"id": e.id});
              else core.update.useragent({"id": e.id});
            }
          }
        }
      }
    },
    "mode": {
      "update": function (e) {
        pertab.setMode(e === "thistab" ? "thistab" : "global");
      }
    },
    "scope": {
      "update": async function (e) {
        config.scope.value = e === "exclude" ? "exclude" : "include";
        /* Updates the global rules and existing per-tab session rules so
           the exclusion list takes effect in both modes. */
        await core.action.settings.repush();
        core.action.popup.load();
      }
    },
    "library": {
      "update": function (e) {
        if (!e) return;
        const list = config.useragent.library;
        if (e.add && e.add.ua) {
          list.push({
            "label": core.sanitize.ua(String(e.add.label || e.add.ua)).slice(0, 64),
            "ua": core.sanitize.ua(e.add.ua)
          });
        } else if (e.remove !== undefined && e.remove !== null) {
          const index = Number(e.remove);
          if (index >= 0 && index < list.length) list.splice(index, 1);
        }
        /*  */
        config.useragent.library = list;
        core.action.popup.load();
      }
    }
  }
};

app.storage.load(core.register.ctscripts);
app.storage.load(core.register.netrequest);
/* a worker restart wipes the memory-only tab maps: the session rules are
   the surviving source of truth, so the icon and key state rebuild from them */
app.storage.load(pertab.restore);

app.hotkey.on.pressed(core.action.hotkey);

app.page.receive("load", core.action.page.load);
app.page.receive("agent", core.action.page.agent);

app.popup.receive("load", core.action.popup.load);
app.popup.receive("reload", core.action.popup.reload);
app.popup.receive("status", core.action.popup.status);
app.popup.receive("update-view", core.action.popup.view);
app.popup.receive("update-mode", core.action.mode.update);
app.popup.receive("theme", core.action.popup.theme.toggle);
app.popup.receive("update-scope", core.action.scope.update);
app.popup.receive("update-theme", core.action.popup.theme.set);
app.popup.receive("reset-settings", core.action.settings.reset);
app.popup.receive("update-library", core.action.library.update);
app.popup.receive("update-settings", core.action.settings.update);
app.popup.receive("update-langlist", core.action.settings.langlist);
app.popup.receive("update-settings-imported", core.action.settings.imported);
app.popup.receive("update-useragent-id", core.action.popup.update.useragent.id);
app.popup.receive("update-descriptioncolor", core.action.popup.descriptioncolor);
app.popup.receive("update-useragent-url", core.action.popup.update.useragent.url);
app.popup.receive("update-useragent-string", core.action.popup.update.useragent.string);

app.popup.receive("faq", function () {
  const url = app.homepage();
  if (url) app.tab.open(url);
});
app.popup.receive("check", function () {app.tab.open(config.test.page)});
app.popup.receive("bug", function () {
  const url = app.homepage();
  if (url) app.tab.open(url + "#report");
});
app.popup.receive("donation", function () {
  const url = app.homepage();
  if (url) app.tab.open(url + "?reason=support");
});

app.on.startup(core.start);
app.on.installed(core.install);
app.on.storage(core.action.storage);
