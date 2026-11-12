var library = {};

/* library — saved useragent strings around the editor: the select only
   holds the choice, the three buttons act on it; Apply lands the string
   through the current mode, Edit loads it into the editor ✓ */

library.render = function (data) {
  library.list = data ? (Array.isArray(data) ? data : []) : [];
  const select = document.getElementById("library-list");
  select.textContent = '';
  /*  */
  const empty = document.createElement("option");
  empty.value = '';
  empty.setAttribute("data-i18n", "uiSavedUseragents");
  empty.textContent = i18n.t("uiSavedUseragents");
  /*  */
  if (library.list.length === 0) empty.disabled = true;
  select.appendChild(empty);
  /*  */
  library.list.forEach(function (entry, index) {
    const option = document.createElement("option");
    /*  */
    option.title = entry.ua;
    option.value = String(index);
    option.textContent = entry.label;
    /*  */
    select.appendChild(option);
  });
};

library.selected = function () {
  const select = document.getElementById("library-list");
  if (select.value === '') return null;
  /*  */
  const entry = library.list[Number(select.value)];
  return entry && entry.ua ? entry : null;
};

library.apply = function () {
  const entry = library.selected();
  if (entry) background.send("update-useragent-string", {"UA": entry.ua});
};

library.edit = function () {
  const entry = library.selected();
  if (entry) {
    const editor = document.getElementById("editor-ua");
    editor.value = entry.ua;
    editor.focus();
  }
};

library.remove = function () {
  const entry = library.selected();
  if (!entry) return;
  /*  */
  const ask = window.confirm(i18n.t("dialogRemoveSaved", [entry.label]));
  if (!ask) return;
  /*  */
  const index = library.list.findIndex(function (item) {return item === entry});
  /*  */
  document.getElementById("library-list").value = '';
  background.send("update-library", {"remove": String(index)});
};

library.editor = function () {
  return config.useragent.sanitize(document.getElementById("editor-ua").value);
};

library.applyEditor = function () {
  const value = library.editor();
  if (!value) {
    config.status.text = i18n.t("messageTypeUserAgent");
    document.getElementById("status-text").textContent = config.status.text;
    return;
  }
  /*  */
  background.send("update-useragent-string", {"UA": value});
};

library.save = function () {
  const value = library.editor();
  if (!value) {
    config.status.text = i18n.t("messageTypeUserAgent");
    document.getElementById("status-text").textContent = config.status.text;
    return;
  }
  /*  */
  const label = window.prompt(i18n.t("dialogSaveUserAgent"), value.slice(0, 40));
  if (label === null) return;
  /*  */
  background.send("update-library", {"add": {"label": label.trim() || value.slice(0, 40), "ua": value}});
};

library.clear = function () {
  background.send("update-useragent-string", {"UA": ''});
};

library.load = function () {
  document.getElementById("library-edit").addEventListener("click", library.edit, false);
  document.getElementById("library-apply").addEventListener("click", library.apply, false);
  document.getElementById("library-remove").addEventListener("click", library.remove, false);
  /*  */
  document.getElementById("editor-save").addEventListener("click", library.save, false);
  document.getElementById("pertab-clear").addEventListener("click", library.clear, false);
  document.getElementById("editor-apply").addEventListener("click", library.applyEditor, false);
  /*  */
  window.removeEventListener("load", library.load, false);
};

window.addEventListener("load", library.load, false);

chrome.runtime.onMessage.addListener(function (request) {
  if (request && request.path === "background-to-popup" && request.method === "storage") {
    library.render(request.data ? request.data.library : null);
  }
});
