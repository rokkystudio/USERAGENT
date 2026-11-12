var domains = {};

/* domains — the custom-domains panel behind the footer globe button: the
   scope chips choose "only on these" or "everywhere except these", and the
   input holds the comma-separated domain list ✓ */

domains.state = function () {
  const panel = document.getElementById("section-6");
  return panel.style.display === "block";
};

domains.toggle = function () {
  const open = !domains.state();
  /*  */
  document.getElementById("section-6").style.display = open ? "block" : '';
  document.getElementById("section-1").style.display = open ? "none" : "block";
  document.getElementById("section-2").style.display = open ? "none" : "block";
  document.getElementById("section-4").style.display = '';
  document.getElementById("section-5").style.display = '';
  document.getElementById("section-7").style.display = '';
  document.getElementById("settings").setAttribute("type", '');
  document.getElementById("advanced").setAttribute("type", '');
  document.getElementById("hardening").setAttribute("type", '');
  document.getElementById("domains").setAttribute("type", open ? "active" : '');
  background.send("update-view", open ? "domains" : '');
};

domains.render = function (scope) {
  const value = scope === "exclude" ? "exclude" : "include";
  document.getElementById("scope-include").setAttribute("type", value === "include" ? "active" : '');
  document.getElementById("scope-exclude").setAttribute("type", value === "exclude" ? "active" : '');
};

domains.load = function () {
  document.getElementById("domains").addEventListener("click", domains.toggle, false);
  document.getElementById("domains-back").addEventListener("click", domains.toggle, false);
  /*  */
  document.getElementById("scope-include").addEventListener("click", function () {
    background.send("update-scope", "include");
  }, false);
  document.getElementById("scope-exclude").addEventListener("click", function () {
    background.send("update-scope", "exclude");
  }, false);
  window.removeEventListener("load", domains.load, false);
};

window.addEventListener("load", domains.load, false);

chrome.runtime.onMessage.addListener(function (request) {
  if (request && request.path === "background-to-popup" && request.method === "storage") {
    domains.render(request.data ? request.data.scope : null);
  }
});
