var background = {
  "port": null,
  "message": {},
  "receive": function (id, callback) {
    if (id) {
      background.message[id] = callback;
    }
  },
  "send": function (id, data) {
    if (id) {
      chrome.runtime.sendMessage({
        "method": id,
        "data": data,
        "path": "popup-to-background"
      }, function () {
        return chrome.runtime.lastError;
      });
    }
  },
  "connect": function (port) {
    chrome.runtime.onMessage.addListener(background.listener); 
    /*  */
    if (port) {
      background.port = port;
      background.port.onMessage.addListener(background.listener);
      background.port.onDisconnect.addListener(function () {
        background.port = null;
      });
    }
  },
  "post": function (id, data) {
    if (id) {
      if (background.port) {
        background.port.postMessage({
          "method": id,
          "data": data,
          "path": "popup-to-background",
          "port": background.port.name
        });
      }
    }
  },
  "listener": function (e) {
    if (e) {
      for (let id in background.message) {
        if (background.message[id]) {
          if ((typeof background.message[id]) === "function") {
            if (e.path === "background-to-popup") {
              if (e.method === id) {
                background.message[id](e.data);
              }
            }
          }
        }
      }
    }
  }
};

var config = {
  "status": {
    "text": ''
  },
  "clean": {
    "table": function (table) {
      const tds = [...table.getElementsByTagName("td")];
      if (tds && tds.length) {
        for (let i = 0; i < tds.length; i++) {
          tds[i].removeAttribute("type");
        }
      }
    }
  },
  "useragent": {
    "key": [],
    "string": '',
    "url": "all_urls",
    "liveupdate": true,
    "confirmdefault": true,
    "sanitize": function (e) {
      e = e ? e.replace(/[^\x20-\x7E]/g, '') : '';
      return e.trim();
    }
  },
  "information": {
    "reset": function () {
      document.getElementById("status-text").textContent = i18n.status(config.status.text);
    },
    "update": function (e) {
      const title = e.target.getAttribute("title");
      document.getElementById("status-text").textContent = title || i18n.status(config.status.text);
    },
    "listener": function () {
      const tds = [...document.querySelectorAll("td")];
      if (tds && tds.length) {
        for (let i = 0; i < tds.length; i++) {
          tds[i].addEventListener("mouseleave", config.information.reset, false);
          tds[i].addEventListener("mouseenter", config.information.update, false);
        }
      }
    }
  },
  "problem": {
    "set": function (e) {
      if (e.url !== undefined) {
        const urlview = document.getElementById("url");
        if (document.activeElement !== urlview) urlview.value = e.url;
        config.useragent.url = e.url;
      }
      /*  */
      config.status.text = e.error || config.useragent.text || config.status.text;
      document.getElementById("status-text").textContent = i18n.status(config.status.text);
    }
  },
  "load": function () {
    document.getElementById("mobile-browsers").addEventListener("click", config.handle.click, false);
    document.getElementById("desktop-browsers").addEventListener("click", config.handle.click, false);
    document.getElementById("operating-systems").addEventListener("click", config.handle.click, false);
    /*  */
    document.getElementById("faq").addEventListener("click", function () {background.send("faq")}, false);
    document.getElementById("bug").addEventListener("click", function () {background.send("bug")}, false);
    document.getElementById("check").addEventListener("click", function () {background.send("check")}, false);
    document.getElementById("theme").addEventListener("click", function () {background.send("theme")}, false);
    document.getElementById("reload").addEventListener("click", function () {background.send("reload")}, false);
    document.getElementById("donation").addEventListener("click", function () {background.send("donation")}, false);
    /*  */
    document.getElementById("home").addEventListener("click", function () {
      /* exactly one panel can be open, so one state-checked toggle closes
         it and restores the main view; on main the button stays inert */
      if (settings.state()) settings.toggle();
      else if (advanced.state()) advanced.toggle();
      else if (domains.state()) domains.toggle();
      else if (hardening.state()) hardening.toggle();
    }, false);
    /*  */
    document.getElementById("default").addEventListener("click", function (e) {
      if (config.useragent.confirmdefault === false) {
        config.handle.click(e);
        return;
      }
      /*  */
      const action = window.confirm(i18n.t("dialogConfirmDefault"));
      if (action) config.handle.click(e);
    }, false);
    /*  */
    document.getElementById("url").addEventListener("change", function (e) {
      /* the list is one domain per line, the storage format stays comma
         separated: lines are joined so the parser sees the same string */
      const value = e.target.value.split(/\n/).map(function (line) {return line.trim()}).filter(function (line) {return line}).join(", ") || "all_urls";
      config.useragent.url = value;
      background.send("update-useragent-url", config.useragent.url);
      e.target.value = config.useragent.url;
    }, false);
    /*  */
    background.send("load");
    config.information.listener();
    window.removeEventListener("load", config.load, false);
  },
  "handle": {
    "click": function (e) {
      if (e) {
        if (e.target) {
          const current = {};
          /*  */
          current.ua = [];
          current.target = e.target;
          current.id = current.target.getAttribute("id");
          current.table = current.target.closest("table");
          current.category = current.table.getAttribute("id");
          current.tds = [...document.getElementsByTagName("td")];
          /*  */
          const mobilebrowsers = document.getElementById("mobile-browsers");
          const desktopbrowsers = document.getElementById("desktop-browsers");
          const operatingsystems = document.getElementById("operating-systems");
          /*  */
          if (current.table) {
            config.clean.table(current.table);
            /*  */
            if (current.category === "mobile-browsers") {
              config.clean.table(desktopbrowsers);
              config.clean.table(operatingsystems);
            } else {
              config.clean.table(mobilebrowsers);
            }
            /*  */
            if (current.id) {
              if (current.id === "default") {
                current.ua = ['', '', "default"];
                /*  */
                config.clean.table(mobilebrowsers);
                config.clean.table(desktopbrowsers);
                config.clean.table(operatingsystems);
              } else {
                current.target.setAttribute("type", "selected");
              }
            }
            /*  */
            if (current.tds && current.tds.length) {
              for (let i = 0; i < current.tds.length; i++) {
                const type = current.tds[i].getAttribute("type");
                if (type) {
                  if (type === "selected") {
                    const id = current.tds[i].getAttribute("id");
                    if (id) current.ua.push(id);
                  }
                }
              }
            }
            /*  */
            if (current.ua.length === 1) {
              if (current.category === "desktop-browsers") {
                current.ua.push("windowsd"); /* add windows as a default OS */
                document.getElementById("windowsd").setAttribute("type", "selected");
              }
              if (current.category === "operating-systems") {
                current.ua.unshift("chrome"); /* add chrome as a default browser */
                document.getElementById("chrome").setAttribute("type", "selected");
              }
            }
          }
          /*  */
          if (current.ua.length) {
            config.interface.update(current.ua);
          }
        }
      }
    }
  },
  "interface": {
    "luminance": function (hex) {
      const value = parseInt(hex.slice(1), 16);
      const r = (value >> 16) & 255;
      const g = (value >> 8) & 255;
      const b = value & 255;
      return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    },
    "shade": function (hex, factor) {
      const value = parseInt(hex.slice(1), 16);
      const clamped = function (n) {return Math.max(0, Math.min(255, Math.round(n * factor)))};
      const r = clamped((value >> 16) & 255);
      const g = clamped((value >> 8) & 255);
      const b = clamped(value & 255);
      return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    },
    "descriptioncolor": function (color, theme) {
      const style = document.documentElement.style;
      if (color) {
        const tint = config.interface.luminance(color);
        const dark = theme === "dark";
        style.setProperty("--description-bg", color);
        style.setProperty("--description-fg", tint > 0.6 ? "#1e1e1e" : "#ffffff");
        style.setProperty("--description-bg-hover", dark ? config.interface.shade(color, 1.12) : config.interface.shade(color, 0.88));
      } else {
        style.removeProperty("--description-bg");
        style.removeProperty("--description-fg");
        style.removeProperty("--description-bg-hover");
      }
    },
    "restore": function (e) {
      if (config.interface.viewrestored) return;
      config.interface.viewrestored = true;
      /* only the first push owns the restore: later pushes ride in while
         the popup is already open and must not yank the user between views */
      if (!e.settings || e.settings.remember === false) return;
      if (e.view === "settings") settings.toggle();
      else if (e.view === "advanced") advanced.toggle();
      else if (e.view === "domains") domains.toggle();
      else if (e.view === "hardening") hardening.toggle();
    },
    "init": function (e) {
    if (e.settings) {
      config.useragent.confirmdefault = e.settings.confirmdefault !== false;
      config.useragent.liveupdate = e.settings.liveupdate !== false;
    }
    /*  */
    document.body.setAttribute("mode", e.mode === "thistab" ? "thistab" : "global");
    /* in this-tab mode the matrix follows the tab's own override, not the
       global one, so the popup always shows what the tab actually runs */
    if (e.mode === "thistab") {
      config.interface.pertab(e);
      config.interface.restore(e);
      return;
    }
    if (e.key[2] && e.key[2] === "default") {
      config.useragent.key = e.key;
      config.useragent.string = '';
      config.interface.render(e, "UserAgent: Default", false);
    } else if (e.string) {
      config.useragent.key = e.key;
      config.useragent.string = e.string;
      /*  */
      config.interface.render(e, e.text, true);
    } else {
      config.useragent.key = e.key;
      config.useragent.string = '';
      config.interface.render(e, "UserAgent: Not Available", false);
    }
    /*  */
    config.interface.restore(e);
  },
    "pertab": function (e) {
      const entry = e.thistab || {};
      const key = entry.key && entry.key.length ? entry.key.slice() : ['', '', "default"];
      let text = '';
      let flag = false;
      if (entry.string) {
        flag = true;
        const cell = key[0] && key[2] !== "custom" ? document.getElementById(key[0]) : null;
        text = i18n.t("statusThisTab", [cell ? cell.getAttribute("title") : i18n.t("statusCustomString")]);
      } else {
        /* an overridden tab with no own pick rides the GLOBAL useragent:
           only its session rule outranks it, calling it "default" misleads */
        text = i18n.t("statusThisTab", [i18n.t("statusGlobalUserAgent")]);
      }
      /*  */
      const hud = document.getElementById("pertab-string");
      hud.textContent = entry.string ? entry.string : i18n.t("statusGlobalUserAgent");
      hud.title = entry.string ? entry.string : '';
      /*  */
      config.interface.render({"key": key, "url": e.url, "theme": e.theme, "mode": e.mode, "scope": e.scope, "problem": e.problem, "settings": e.settings}, text, flag);
    },
    "update": function (e) {
      if (e.length === 2) {
        const title_1 = document.getElementById(e[0]).getAttribute("title") || "N/A";
        const title_2 = document.getElementById(e[1]).getAttribute("title") || "N/A";
        config.status.text = "UserAgent: " + title_1 + " on " + title_2;
      }
      /*  */
      if (e.length === 1) {
        config.status.text = "UserAgent: " + document.getElementById(e[0]).getAttribute("title");
      } else if (e.length === 3 && e[2] === "default") {
        config.status.text = "UserAgent: Default";
      }
      /*  */
      document.getElementById("status-text").textContent = i18n.status(config.status.text);
      /*  */
      if (document.body.getAttribute("mode") !== "thistab") background.send("status", config.status.text);
      background.send("update-useragent-id", {
        "id": e, 
        "url": config.useragent.url
      });
    },
    "render": function (e, txt, flag) {
      config.status.text = txt;
      /*  */
      const theme = e.theme || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      document.documentElement.setAttribute("theme", theme);
      if (!e.theme) background.send("update-theme", theme);
      /*  */
      config.interface.descriptioncolor(e.settings && e.settings.color, theme);
      /* the back arrows stay hidden unless the option asks for them: the
         footer home button makes them redundant for most users */
      if (e.settings && e.settings.backbuttons === true) {
        document.documentElement.setAttribute("data-backbuttons", "true");
      } else {
        document.documentElement.removeAttribute("data-backbuttons");
      }
      /*  */
      const mobilebrowsers = document.getElementById("mobile-browsers");
      const desktopbrowsers = document.getElementById("desktop-browsers");
      const operatingsystems = document.getElementById("operating-systems");
      /*  */
      config.clean.table(mobilebrowsers);
      config.clean.table(desktopbrowsers);
      config.clean.table(operatingsystems);
      /*  */
      if (e.key[0]) {
        const elm1 = document.getElementById(e.key[0]);
        if (flag && elm1) {
          elm1.setAttribute("type", "selected");
        } else if (elm1) {
          elm1.removeAttribute("type");
        }
      }
      /*  */
      if (e.key[1]) {
        const elm2 = document.getElementById(e.key[1]);
        if (flag && elm2) {
          elm2.setAttribute("type", "selected");
        } else if (elm2) {
          elm2.removeAttribute("type");
        }
      }
      /*  */
      config.useragent.url = e.url;
      /*  */
      const urlview = document.getElementById("url");
      /* incoming pushes may not clobber the field while the user edits it:
         focus means a half-typed list that a render would wipe mid-keystroke */
      if (document.activeElement !== urlview) {
        urlview.value = e.url === "*" ? "all_urls" : e.url;
      }
      /* a reported rule problem rides above the pick text, so failures
         stay visible instead of being erased by this reload push */
      document.getElementById("status-text").textContent = i18n.status(e.problem || config.status.text);
      /* the active config rides as a hover tooltip on the status row, so
          "why is it not applying" is always one hover away */
      document.getElementById("status-td").title = (e.mode === "thistab" ? i18n.t("statusModeThisTab") : i18n.t("statusModeAllTabs")) + " · " + i18n.t("statusScopeLabel") + " " + (e.scope === "exclude" ? i18n.t("statusExclusive") : i18n.t("statusInclusive")) + " · " + i18n.t("statusListLabel") + " " + (e.url || "all_urls");
    }
  }
};

window.addEventListener("load", config.load, false);

background.receive("storage", config.interface.init);
background.receive("problem", config.problem.set);

background.connect(chrome.runtime.connect({"name": "popup"}));
