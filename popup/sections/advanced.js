var advanced = {};

/* advanced — the custom-useragents panel behind the footer sliders button:
   the editor opens prefilled with what the page reports (or the active
   string), saved strings, scope and the page readout live here; opening one
   view always closes the other so two panels can never stack ✓ */

advanced.state = function () {
  const panel = document.getElementById("section-5");
  return panel.style.display === "block";
};

advanced.editor = function () {
  const editor = document.getElementById("editor-ua");
  if (editor.value) return;
  /* the page's detected useragent wins, the active global string is the
     fallback, and an empty box keeps its placeholder as the invitation */
  const page = readout && readout.sourced ? readout.useragent : '';
  editor.value = page || config.useragent.string;
};

advanced.toggle = function () {
  const open = !advanced.state();
  /*  */
  document.getElementById("section-5").style.display = open ? "block" : '';
  document.getElementById("section-1").style.display = open ? "none" : "block";
  document.getElementById("section-2").style.display = open ? "none" : "block";
  document.getElementById("section-4").style.display = '';
  document.getElementById("section-6").style.display = '';
  document.getElementById("section-7").style.display = '';
  document.getElementById("settings").setAttribute("type", '');
  document.getElementById("domains").setAttribute("type", '');
  document.getElementById("hardening").setAttribute("type", '');
  document.getElementById("advanced").setAttribute("type", open ? "active" : '');
  background.send("update-view", open ? "advanced" : '');
  if (open) advanced.editor();
};

advanced.load = function () {
  document.getElementById("advanced").addEventListener("click", advanced.toggle, false);
  document.getElementById("advanced-back").addEventListener("click", advanced.toggle, false);
  /*  */
  window.removeEventListener("load", advanced.load, false);
};

window.addEventListener("load", advanced.load, false);
