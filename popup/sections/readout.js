var readout = {};

/* readout — shows the UA the active page currently reports (spoofed or real),
   with a one-click copy; the value arrives from the page itself through the
   background relay, so the row always agrees with what sites actually see ✓ */

readout.fill = function (value, sourced) {
  readout.useragent = value;
  readout.sourced = sourced;
  /*  */
  const text = document.getElementById("readout-text");
  const copy = document.getElementById("readout-copy");
  /*  */
  text.title = value;
  text.textContent = value;
  copy.style.display = value ? "inline" : "none";
};

readout.render = function (e) {
  const value = e && e.useragent ? e.useragent : '';
  if (value) readout.fill(value, true);
};

readout.copied = function () {
  const copy = document.getElementById("readout-copy");
  /*  */
  copy.setAttribute("type", "copied");
  config.status.text = i18n.t("messageCopied");
  document.getElementById("status-text").textContent = config.status.text;
  /*  */
  if (readout.timer) clearTimeout(readout.timer);
  readout.timer = setTimeout(function () {
    copy.removeAttribute("type");
  }, 900);
};

readout.copy = function () {
  if (!readout.sourced) return;
  /*  */
  navigator.clipboard.writeText(readout.useragent).then(readout.copied).catch(function () {
    window.prompt(i18n.t("dialogCopyUserAgent"), readout.useragent);
  });
};

readout.init = function () {
  /* the stub stays empty: prefilling the popup's own navigator.userAgent
     showed unrelated data, and an unsourced value has a dead copy button;
     the active page reports through the report ping or its own load */
  readout.fill('', false);
  /*  */
  window.removeEventListener("load", readout.init, false);
  document.getElementById("readout-copy").addEventListener("click", readout.copy, false);
};

window.addEventListener("load", readout.init, false);

background.receive("useragent", readout.render);
