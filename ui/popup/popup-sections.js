(() => {
  "use strict";
  // Presentation only. Keep each feature's existing storage namespace and
  // defaults; never write gameplay preferences or change fieldset locks.
  const registered = new WeakMap();
  let saveQueue = Promise.resolve();

  function create({ id, title, className, bodyClass, body, open = false }) {
    const section = document.createElement("details");
    section.id = id;
    section.className = className;
    section.open = open;
    const summary = document.createElement("summary");
    summary.textContent = title;
    const content = body ?? document.createElement("div");
    if (!body && bodyClass) content.className = bodyClass;
    section.append(summary, content);
    return { section, content };
  }

  function save(key, open) {
    saveQueue = saveQueue.catch(() => {}).then(() => chrome.storage.local.set({ [key]: open })).catch(() => {});
  }

  function setOpen(section, open) {
    const entry = registered.get(section);
    if (!entry) return false;
    const next = open === true;
    entry.touched = true;
    section.open = next;
    save(entry.key, next);
    return true;
  }

  function register(entries, { storageKey, legacyKey } = {}) {
    const group = [];
    for (const { section, open } of entries) {
      if (!section || registered.has(section)) continue;
      const summary = section.querySelector(":scope > summary");
      const key = storageKey(section);
      if (!summary || !key) continue;
      const entry = { section, key, defaultOpen: open === true, touched: false };
      registered.set(section, entry);
      group.push(entry);
      section.open = entry.defaultOpen;

      // Native summary activation generates a click for mouse, touch,
      // Enter and Space. Own that one activation instead of predicting
      // a future toggle from separate keydown/keyup handlers.
      summary.addEventListener("click", (event) => {
        if (event.defaultPrevented) return;
        const target = event.target;
        if (target !== summary && target.closest?.("button, input, select, textarea, a[href], [role=button], [contenteditable=true]")) return;
        event.preventDefault();
        setOpen(section, !section.open);
      });
    }
    if (!group.length) return;

    void (async () => {
      let stored = {};
      try {
        const keys = group.map(({ key }) => key);
        if (legacyKey) keys.push(legacyKey);
        stored = await chrome.storage.local.get(keys);
      } catch { /* Leave defaults and any user interaction intact. */ }
      for (const entry of group) {
        if (entry.touched) continue;
        const { section, key, defaultOpen } = entry;
        const value = legacyKey ? stored?.[key] ?? stored?.[legacyKey]?.[section.id] : stored?.[key];
        section.open = typeof value === "boolean" ? value : defaultOpen;
      }
    })();
  }

  globalThis.GSTPopupSections = Object.freeze({ create, register, setOpen });
})();
