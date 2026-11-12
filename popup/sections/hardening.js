var hardening = {};

/* hardening — the anti-detection panel behind the footer fingerprint
   button: fifteen spoof-hardening toggles and the language list input,
   wired through the shared settings plumbing (render and wiring walk
   the settings lists); render sets values only, wiring happens once
   on load ✓ */

hardening.state = function () {
  const panel = document.getElementById("section-7");
  return panel.style.display === "flex";
};

hardening.toggle = function () {
  const open = !hardening.state();
  /*  */
  document.getElementById("section-7").style.display = open ? "flex" : '';
  document.getElementById("section-1").style.display = open ? "none" : "block";
  document.getElementById("section-2").style.display = open ? "none" : "block";
  document.getElementById("section-4").style.display = '';
  document.getElementById("section-5").style.display = '';
  document.getElementById("section-6").style.display = '';
  document.getElementById("settings").setAttribute("type", '');
  document.getElementById("advanced").setAttribute("type", '');
  document.getElementById("domains").setAttribute("type", '');
  document.getElementById("hardening").setAttribute("type", open ? "active" : '');
  background.send("update-view", open ? "hardening" : '');
};

hardening.load = function () {
  document.getElementById("hardening").addEventListener("click", hardening.toggle, false);
  document.getElementById("hardening-back").addEventListener("click", hardening.toggle, false);
  window.removeEventListener("load", hardening.load, false);
};

window.addEventListener("load", hardening.load, false);
