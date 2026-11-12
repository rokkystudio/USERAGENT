var settings = {};

/* settings — the panel behind the footer gear button: view swap, the
   shared toggle walk (the settings, advanced and hardening boolean
   rows),    the language list input, the status-row look chips (tall /
   short / plain attach beside the show checkbox), export / import /
   factory reset. Render sets values only, wiring happens once on
   load ✓ */

settings.keys = [
  "spoof",
  "coverage",
  "liveupdate",
  "confirmdefault",
  "confirmreset",
  "strictclean",
  "remember",
  /* the hardening panel's rows ride the same plumbing: the ids live in
     section-7, the render and the wiring walk this list */
  "native",
  "grease",
  "entropy",
  "deleteleftovers",
  "shortappversion",
  "forged",
  "pindevice",
  "earlypayload",
  "iframes",
  "spoofsandbox",
  "fakeecho",
  /* the status-row show checkbox rides the same default-on walk */
  "statusshow"
];

/* option rows that default to OFF use their own comparison */

settings.defaultoff = [
  "backbuttons",
  "realvendor",
  "realbits",
  "matchlang",
  "hidewebdriver",
  "debugpayload",
  /* the four calmer-by-default hardening rows render checked only when
     stored as explicit true: the default profile keeps sites untouched */
  "grease",
  "entropy",
  "deleteleftovers",
  "pindevice"
];

settings.exportable = [
  "interface-theme",
  "useragent-ui-language",
  "badge-icon",
  "useragent-option-mode",
  "useragent-option-scope",
  "useragent-option-spoof",
  "useragent-option-coverage",
  "useragent-option-liveupdate",
  "useragent-option-confirmdefault",
  "useragent-option-confirmreset",
  "useragent-option-descriptioncolor",
  "useragent-option-backbuttons",
  "useragent-option-realvendor",
  "useragent-option-strictclean",
  "useragent-option-remember",
  "useragent-option-realbits",
  "useragent-option-native",
  "useragent-option-grease",
  "useragent-option-entropy",
  "useragent-option-deleteleftovers",
  "useragent-option-shortappversion",
  "useragent-option-forged",
  "useragent-option-pindevice",
  "useragent-option-earlypayload",
  "useragent-option-iframes",
  "useragent-option-hidewebdriver",
  "useragent-option-spoofsandbox",
  "useragent-option-fakeecho",
  "useragent-option-debugpayload",
  "useragent-option-matchlang",
  "useragent-option-langlist",
  "useragent-option-statusheight",
  "useragent-option-statusplain",
  "useragent-option-statusshow",
  "user-agent-url",
  "user-agent-string",
  "user-agent-key",
  "user-agent-text",
  "user-agent-overrides",
  "user-agent-last",
  "user-agent-library"
];

settings.cache = {};
settings.colortimer = null;
settings.langtimer = null;

settings.state = function () {
  const panel = document.getElementById("section-4");
  return panel.style.display === "flex";
};

settings.render = function (data) {
  if (!data) return;
  if (data.settings) settings.cache = data.settings;
  /*  */
  settings.keys.forEach(function (key) {
    const input = document.getElementById("pref-" + key);
    if (input) input.checked = settings.cache[key] !== false;
  });
  settings.defaultoff.forEach(function (key) {
    const input = document.getElementById("pref-" + key);
    if (input) input.checked = settings.cache[key] === true;
  });
  /*  */
  const color = document.getElementById("pref-descriptioncolor");
  if (color) color.value = settings.cache.color || "#6d6d6d";
  /*  */
  const langinput = document.getElementById("lang-value");
  if (langinput) langinput.value = settings.cache.langlist || "en-US, en";
  /*  */
  const mode = data.mode === "thistab" ? "thistab" : "global";
  document.getElementById("mode-global").setAttribute("type", mode === "global" ? "active" : '');
  document.getElementById("mode-thistab").setAttribute("type", mode === "thistab" ? "active" : '');
  /*  */
  const status = document.getElementById("status-td");
  if (status) {
    /* hide collapses the strip entirely and wins over the other two
       looks, so the dial-back state stays unambiguous */
    const looks = [];
    if (settings.cache.statusheight === true) looks.push("tall");
    if (settings.cache.statusplain === true) looks.push("plain");
    status.setAttribute("type", settings.cache.statusshow === false ? "hide" : looks.join(" "));
  }
  /*  */
  const chips = [
    ["status-look-tall", "statusheight", 1],
    ["status-look-short", "statusheight", 0],
    ["status-look-plain", "statusplain", 1]
  ];
  chips.forEach(function (entry) {
    const chip = document.getElementById(entry[0]);
    if (chip) chip.setAttribute("type", (settings.cache[entry[1]] === true) === (entry[2] === 1) ? "active" : '');
  });
};

settings.toggle = function () {
  const open = !settings.state();
  /*  */
  document.getElementById("section-5").style.display = '';
  document.getElementById("section-6").style.display = '';
  document.getElementById("section-7").style.display = '';
  document.getElementById("domains").setAttribute("type", '');
  document.getElementById("advanced").setAttribute("type", '');
  document.getElementById("hardening").setAttribute("type", '');
  document.getElementById("section-4").style.display = open ? "flex" : '';
  document.getElementById("section-1").style.display = open ? "none" : "block";
  document.getElementById("section-2").style.display = open ? "none" : "block";
  document.getElementById("settings").setAttribute("type", open ? "active" : '');
  background.send("update-view", open ? "settings" : '');
};

settings.change = function () {
  return function (e) {
    background.send("update-settings", {
      "value": e.target.checked,
      "key": e.target.getAttribute("data-key")
    });
  };
};

settings.export = function () {
  chrome.storage.local.get(null, function (data) {
    let tmp = chrome.runtime.lastError;
    const payload = {
      "settings": {},
      "app": "useragent-switcher",
      "format": "useragent-switcher-settings"
    };
    /*  */
    settings.exportable.forEach(function (key) {
      if (data[key] !== undefined) payload.settings[key] = data[key];
    });
    /*  */
    const blob = new Blob([JSON.stringify(payload, null, 2)], {"type": "application/json"});
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    /*  */
    a.setAttribute("href", url);
    a.setAttribute("download", "useragent-switcher-settings.json");
    document.body.appendChild(a);
    a.click();
    a.remove();
    /*  */
    setTimeout(function () {URL.revokeObjectURL(url);}, 1000);
  });
};

settings.import = function (file) {
  const reader = new FileReader();
  reader.onload = function () {
    /*  */
    try {
      const payload = JSON.parse(reader.result);
      /*  */
      if (!payload || payload.app !== "useragent-switcher" || !payload.settings) {
        config.status.text = i18n.t("messageInvalidSettings");
        document.getElementById("status-text").textContent = config.status.text;
        return;
      }
      /*  */
      const store = {};
      settings.exportable.forEach(function (key) {
        if (payload.settings[key] !== undefined) store[key] = payload.settings[key];
      });
      /*  */
      chrome.storage.local.set(store, function () {
        let tmp = chrome.runtime.lastError;
        background.send("update-settings-imported");
      });
    } catch (err) {
      config.status.text = i18n.t("messageInvalidSettings");
      document.getElementById("status-text").textContent = config.status.text;
    }
  };
  /*  */
  reader.readAsText(file);
};

settings.reset = function () {
  /* confirmreset === false means "skip the dialog", never "skip the reset":
     with the confirm off the factory reset still has to go through */
  const ask = settings.cache.confirmreset === false || window.confirm(i18n.t("dialogConfirmReset"));
  if (!ask) return;
  /*  */
  background.send("reset-settings");
};

settings.load = function () {
  /* the keys and default-off lists overlap (four rows live in both): one
     listener per input wins — a second addEventListener would double
     every toggle's message and the repush cycle behind it; the render
     walk keeps both passes since the defaults need them */
  const wired = {};
  const wire = function (key) {
    const input = document.getElementById("pref-" + key);
    if (input && wired[key] !== true) {
      wired[key] = true;
      input.addEventListener("change", settings.change(), false);
    }
  };
  settings.keys.forEach(wire);
  settings.defaultoff.forEach(wire);
  /*  */
  document.getElementById("mode-global").addEventListener("click", function () {
    background.send("update-mode", "global");
  }, false);
  /*  */
  document.getElementById("mode-thistab").addEventListener("click", function () {
    background.send("update-mode", "thistab");
  }, false);
  /*  */
  const looks = [
    ["status-look-tall", "statusheight", true],
    ["status-look-short", "statusheight", false]
  ];
  looks.forEach(function (entry) {
    document.getElementById(entry[0]).addEventListener("click", function () {
      background.send("update-settings", {"key": entry[1], "value": entry[2]});
    }, false);
  });
  /* plain composes with the height looks, so it flips its own key */
  document.getElementById("status-look-plain").addEventListener("click", function () {
    background.send("update-settings", {"key": "statusplain", "value": settings.cache.statusplain !== true});
  }, false);
  /*  */
  const picker = document.getElementById("pref-descriptioncolor");
  /* live preview paints on every input tick; the persist is debounced so a
     drag writes once, and the change event still commits the final value */
  picker.addEventListener("input", function (e) {
    config.interface.descriptioncolor(e.target.value, document.documentElement.getAttribute("theme"));
    clearTimeout(settings.colortimer);
    settings.colortimer = setTimeout(function () {
      background.send("update-descriptioncolor", e.target.value);
    }, 250);
  }, false);
  picker.addEventListener("change", function (e) {
    clearTimeout(settings.colortimer);
    background.send("update-descriptioncolor", e.target.value);
  }, false);
  document.getElementById("color-reset").addEventListener("click", function () {
    background.send("update-descriptioncolor", '');
  }, false);
  /*  */
  const langinput = document.getElementById("lang-value");
  /* typing spams the language rederive, so the live value ships debounced
     and the change commit covers the final value */
  langinput.addEventListener("input", function (e) {
    clearTimeout(settings.langtimer);
    settings.langtimer = setTimeout(function () {
      background.send("update-langlist", e.target.value);
    }, 400);
  }, false);
  langinput.addEventListener("change", function (e) {
    clearTimeout(settings.langtimer);
    background.send("update-langlist", e.target.value);
  }, false);
  /*  */
  document.getElementById("settings").addEventListener("click", settings.toggle, false);
  document.getElementById("settings-back").addEventListener("click", settings.toggle, false);
  document.getElementById("settings-reset").addEventListener("click", settings.reset, false);
  document.getElementById("settings-export").addEventListener("click", settings.export, false);
  /*  */
  document.getElementById("settings-import").addEventListener("click", function () {
    const file = document.getElementById("importfile");
    file.value = '';
    file.click();
  }, false);
  /*  */
  document.getElementById("importfile").addEventListener("change", function (e) {
    if (e.target.files && e.target.files[0]) settings.import(e.target.files[0]);
    /* clear the picker so the very same file can be imported again later */
    e.target.value = '';
  }, false);
  /*  */
  window.removeEventListener("load", settings.load, false);
};

window.addEventListener("load", settings.load, false);

chrome.runtime.onMessage.addListener(function (request) {
  if (request && request.path === "background-to-popup" && request.method === "storage") {
    settings.render(request.data ? {"settings": request.data.settings, "mode": request.data.mode} : null);
  }
});
