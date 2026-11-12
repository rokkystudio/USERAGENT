var legacy = {};

/* migrate — the old build froze the whole UA table in storage under
   user-agent-object, which blocked any refresh. One-time cleanup: the frozen
   table doubles as the comparison source, so an active string that matches a
   frozen slot value keeps the slot WITHOUT an override (it refreshes into the
   current table: Chrome 156, Firefox 159, ...), and an active string that does
   not match any frozen value is a real custom pick that stays pinned as an
   override; then the frozen object is dropped ✓ */

legacy.slots = function (table) {
  const values = {};
  if (typeof table !== "object" || table === null) return values;
  /*  */
  for (let browser in table) {
    if (typeof table[browser] === "string") {
      values[browser] = table[browser];
    } else {
      for (let os in table[browser]) {
        values[browser + "." + os] = table[browser][os];
      }
    }
  }
  /*  */
  return values;
};

legacy.migrate = async function () {
  const object = app.storage.local["user-agent-object"];
  if (object === undefined) return;
  /*  */
  try {
    const overrides = {};
    const frozen = JSON.parse(object || '{}');
    const key = JSON.parse(app.storage.local["user-agent-key"] || '[]');
    const values = legacy.slots(frozen);
    const text = app.storage.local["user-agent-string"];
    const slot = (key && key.length) ? key.join(".") : '';
    /*  */
    if (text && slot && slot.indexOf("default") === -1) {
      const parts = slot.split(".");
      const browser = parts[0];
      const os = parts[1];
      /*  */
      if (values[slot] !== text) {
        /* the active string is not the frozen default for this slot, so it
           is a real custom pick; pin it as an override (a missing frozen
           slot counts as custom too) — a keyless legacy slot has no browser
           name to pin under, so no override data is written for it */
        if (browser) {
          if (os !== undefined) {
            overrides[browser] = {};
            overrides[browser][os] = text;
          } else {
            overrides[browser] = text;
          }
        }
      } else {
        /* the pick matches the frozen table, so the slot stays clean and
           re-derives from the refreshed table at the next read */
        let current = '';
        if (os !== undefined) current = (config.default.ua.object[browser] || {})[os] || '';
        else current = config.default.ua.object[browser] || '';
        /*  */
        if (current) config.useragent.string = current;
      }
    }
    /*  */
    if (Object.keys(overrides).length) config.useragent.overrides = overrides;
    await app.storage.remove("user-agent-object");
  } catch (err) {
    /* keep the old table on failure; a later start retries the cleanup */
  }
};

app.storage.load(function () {
  legacy.migrate();
});
