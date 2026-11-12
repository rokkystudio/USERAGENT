var i18n = {
  "language": "en",
  "messages": null,
  "choice": "auto",

  /**
   * Returns a message from the selected locale and expands numbered
   * substitutions. Before locale loading, Chrome's UI locale supplies text.
   *
   * @param {string} key Message key in _locales/en and _locales/ru.
   * @param {Array<string|number>} substitutions Numbered substitutions.
   * @returns {string} Localized interface text.
   */
  "t": function (key, substitutions) {
    if (!i18n.messages) {
      const value = chrome.i18n.getMessage(key, substitutions);
      if (!value) throw new Error("Missing browser locale message: " + key);
      return value;
    }
    const entry = i18n.messages[key];
    if (!entry || typeof entry.message !== "string") throw new Error("Missing locale message: " + key);
    const values = substitutions || [];
    return entry.message.replace(/\$([1-9])/g, function (matched, index) {
      const position = Number(index) - 1;
      if (position >= values.length) throw new RangeError("Missing locale substitution for " + key + ": " + index);
      return String(values[position]);
    });
  },

  /**
   * Loads an extension locale catalog and keeps its messages in memory.
   *
   * @param {"en"|"ru"} language Supported locale name.
   * @returns {Promise<void>} Completion of the catalog load.
   */
  "load": async function (language) {
    const url = chrome.runtime.getURL("_locales/" + language + "/messages.json");
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to load locale " + language + ": " + response.status);
    /*  */
    const messages = await response.json();
    if (!messages.extensionName) throw new Error("Incomplete locale catalog: " + language);
    i18n.language = language;
    i18n.messages = messages;
    document.documentElement.lang = language;
  },

  /**
   * Applies declared localization keys to element text, title attributes,
   * placeholders, and accessible labels without replacing nested elements.
   *
   * @returns {void}
   */
  "apply": function () {
    document.querySelectorAll("[data-i18n]").forEach(function (element) {
      element.textContent = i18n.t(element.getAttribute("data-i18n"));
    });
    document.querySelectorAll("[data-i18n-title]").forEach(function (element) {
      element.title = i18n.t(element.getAttribute("data-i18n-title"));
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(function (element) {
      element.placeholder = i18n.t(element.getAttribute("data-i18n-placeholder"));
    });
    document.querySelectorAll("[data-i18n-aria-label]").forEach(function (element) {
      element.setAttribute("aria-label", i18n.t(element.getAttribute("data-i18n-aria-label")));
    });
  },

  /**
   * Converts status messages emitted by the extension to the selected
   * interface language. Arbitrary page-supplied values remain untouched.
   *
   * @param {string} value Status message or application error.
   * @returns {string} Localized status string.
   */
  "status": function (value) {
    if (!value) return '';
    if (value === "UserAgent: Default") return i18n.t("statusDefault");
    if (value === "UserAgent: Custom") return i18n.t("statusCustom");
    if (value === "UserAgent: Not Available") return i18n.t("statusUnavailable");
    if (value === "No homepage_url configured in manifest") return i18n.t("messageNoHomepage");
    if (value.indexOf("Invalid entries: ") === 0) {
      const details = value.slice(17);
      return i18n.t("messageInvalidEntries", [details === "empty input" ? i18n.t("messageEmptyInput") : details]);
    }
    if (value.indexOf("Injection failed: ") === 0) return i18n.t("messageInjectionFailed", [value.slice(18)]);
    if (value.indexOf("Rebuild failed: ") === 0) return i18n.t("messageRebuildFailed", [value.slice(16)]);
    if (value.indexOf("Rule update failed: ") === 0) return i18n.t("messageRuleUpdateFailed", [value.slice(20)]);
    /* User-Agent status messages have a stable prefix; profile names and
       operating-system labels remain the values selected by the user. */
    if (value.indexOf("UserAgent: ") === 0) {
      const selected = value.slice(11);
      const separator = selected.indexOf(" on ");
      if (separator !== -1) return i18n.t("statusUserAgentOn", [selected.slice(0, separator), selected.slice(separator + 4)]);
      return i18n.t("statusUserAgent", [selected]);
    }
    return value;
  },

  /**
   * Activates one explicit language or the browser interface language,
   * persists a manual selection, and refreshes the popup's current view.
   *
   * @param {"auto"|"en"|"ru"} choice Language selection.
   * @param {boolean} save Whether to save the selection.
   * @returns {Promise<void>} Completion of the visible translation.
   */
  "select": async function (choice, save) {
    if (choice !== "auto" && choice !== "en" && choice !== "ru") throw new RangeError("Unsupported UI language: " + choice);
    const locale = choice === "auto" ? (/^ru(?:-|$)/i.test(chrome.i18n.getUILanguage()) ? "ru" : "en") : choice;
    await i18n.load(locale);
    i18n.choice = choice;
    const select = document.getElementById("ui-language");
    if (select) select.value = choice;
    if (save) await chrome.storage.local.set({"useragent-ui-language": choice});
    i18n.apply();
    if (typeof background !== "undefined") background.send("load");
  },

  /**
   * Reads the saved language preference and registers the settings selector.
   *
   * @returns {Promise<void>} Completion of UI initialization.
   */
  "init": async function () {
    const saved = await chrome.storage.local.get("useragent-ui-language");
    const choice = saved["useragent-ui-language"] || "auto";
    const select = document.getElementById("ui-language");
    select.value = choice;
    select.addEventListener("change", function () {
      i18n.select(select.value, true).catch(function (error) {
        console.error("UI localization:", error);
      });
    });
    await i18n.select(choice, false);
    /* Storage changes from imports, resets, or another popup synchronize
       the active language without modifying the selected UA profile. */
    chrome.storage.onChanged.addListener(function (changes, namespace) {
      if (namespace !== "local" || !Object.prototype.hasOwnProperty.call(changes, "useragent-ui-language")) return;
      const next = changes["useragent-ui-language"].newValue === undefined ? "auto" : changes["useragent-ui-language"].newValue;
      if (next === i18n.choice) return;
      i18n.select(next, false).catch(function (error) {
        console.error("UI localization:", error);
      });
    });
  }
};

document.addEventListener("DOMContentLoaded", function () {
  i18n.init().catch(function (error) {
    console.error("UI localization:", error);
  });
});
