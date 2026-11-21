(() => {
  "use strict";
  const key = "gst:farm-stop-log:v1";
  let binding = null, cause = null, rows = [], keyEvents = [], at = -Infinity, onAt = performance.now();
  const codes = ["shortcut", "restore", "native_game", "death_limit", "click_to_move", "state_changed",
    "background_click_blocked", "blocking_dialog", "displaced", "navigation"];
  function flags(scene) {
    return { on: scene?.auto?.on === true, hidden: document.hidden, focused: document.hasFocus(),
      dead: scene?.self?.dead === true, deaths: scene?.auto?.deaths?.length ?? 0,
      clickOrder: !!scene?.clickOrder, reconnecting: !!scene?.driver?.reconnecting,
      displaced: !!scene?.driver?.displaced };
  }
  function clean(row) {
    if (!row || !codes.includes(row.cause) || !["on", "off", "context", "input"].includes(row.event)) return null;
    return { at: typeof row.at === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(row.at) ? row.at : "", event: row.event, cause: row.cause,
      on: row.on === true, hidden: row.hidden === true, focused: row.focused === true, dead: row.dead === true,
      deaths: Number.isFinite(row.deaths) ? Math.max(0, Math.min(10000, row.deaths)) : 0,
      clickOrder: row.clickOrder === true, reconnecting: row.reconnecting === true, displaced: row.displaced === true,
      uptimeMs: Number.isFinite(row.uptimeMs) ? Math.max(0, row.uptimeMs) : null,
      callers: (Array.isArray(row.callers) ? row.callers : []).filter((value) =>
        typeof value === "string" && /^[A-Za-z0-9_.-]+\.js:\d+:\d+$/.test(value)).slice(0, 4) };
  }
  try { rows = (JSON.parse(sessionStorage.getItem(key)) ?? []).map(clean).filter(Boolean).slice(-20); }
  catch { rows = []; }
  function record(scene, event, reason, callers = [], snapshot = null) {
    const row = clean({ at: new Date().toISOString(), event, cause: reason, ...(snapshot ?? flags(scene)),
      uptimeMs: performance.now() - onAt, callers });
    if (!row) return;
    const previous = rows.at(-1);
    if (previous?.event === event && previous.cause === reason && previous.hidden === row.hidden
        && performance.now() - (binding?.lastRecordAt ?? -Infinity) < 1000) return;
    rows.push(row); rows = rows.slice(-20);
    if (binding) binding.lastRecordAt = performance.now();
    try { sessionStorage.setItem(key, JSON.stringify(rows)); } catch { /* Diagnostic data is optional. */ }
  }
  function detach() {
    if (!binding) return;
    const old = binding; binding = null; keyEvents = [];
    old.removeInput();
    old.scene.events.off("preupdate", frame);
    old.scene.events.off("shutdown", detach); old.scene.events.off("destroy", detach);
  }
  function frame() {
    const owner = binding;
    if (!owner) return;
    const scene = owner.scene;
    if (scene.auto !== owner.auto || !scene.sys?.isActive?.()) { detach(); return; }
    if (performance.now() - at < 500) return;
    at = performance.now();
    if (scene.auto.on !== owner.lastOn) {
      record(scene, scene.auto.on ? "on" : "off", "state_changed");
      owner.lastOn = scene.auto.on;
      if (scene.auto.on) onAt = performance.now();
    }
    const modal = [...document.querySelectorAll('[role="alertdialog"]')].some((el) =>
      el.getClientRects().length && getComputedStyle(el).visibility !== "hidden");
    if (modal && !owner.modal) record(scene, "context", "blocking_dialog");
    owner.modal = modal;
    if (scene.driver?.displaced && !owner.displaced) record(scene, "context", "displaced");
    owner.displaced = !!scene.driver?.displaced;
  }
  function attach(scene) {
    globalThis.GSTBackgroundDiagnostics?.attach(scene);
    globalThis.GSTMovementDiagnostics?.attach(scene);
    if (binding && binding.scene === scene && binding.auto === scene?.auto) return;
    if (!scene?.sys?.isActive?.() || typeof scene.auto?.toggle !== "function"
        || typeof scene.startClickOrder !== "function" || !scene.events?.on || !scene.events.off) return;
    detach();
    const auto = scene.auto;
    const removeInput = GSTFarmInput.add(scene, (accepted) => {
      if (!accepted) record(scene, "input", "background_click_blocked");
    });
    binding = { scene, auto, removeInput, lastOn: auto.on, modal: false, displaced: false };
    scene.events.on("preupdate", frame); scene.events.on("shutdown", detach); scene.events.on("destroy", detach);
    at = -Infinity; onAt = performance.now();
  }
  // Observe the activation owner's call without wrapping/replacing auto.toggle.
  function observeToggle(scene, callback) {
    let before, auto, deathStop, deaths, reason, callers;
    try {
      auto = scene.auto; before = auto.on; deathStop = auto.stopOnRevive === true;
      deaths = auto.deaths?.length ?? 0; reason = cause ?? "native_game";
      callers = [...String(new Error().stack).matchAll(/[A-Za-z0-9_.-]+\.js:\d+:\d+/g)]
        .map((match) => match[0]).filter((value) => !value.startsWith("farm-diagnostics.js:")).slice(0, 4);
    } catch { return callback(); }
    try { return callback(); }
    finally {
      try {
        if (binding?.scene === scene && binding.auto === auto && scene.auto === auto && before !== auto.on) {
          const snapshot = { ...flags(scene), deaths };
          binding.lastOn = auto.on;
          if (auto.on) { onAt = performance.now(); record(scene, "on", reason, callers, snapshot); }
          else queueMicrotask(() => record(scene, "off", reason === "shortcut" ? reason
            : deathStop ? "death_limit" : scene.clickOrder ? "click_to_move" : reason, callers,
            { ...snapshot, clickOrder: !!scene.clickOrder }));
        }
      } catch { /* A log failure cannot affect the action or its exception. */ }
    }
  }
  function toggle(scene, reason) {
    const previous = cause; cause = reason;
    try { return scene.toggleAutoFarm(); } finally { cause = previous; }
  }
  function readSnapshot(name) {
    try { return globalThis[name]?.snapshot?.(); }
    catch { return { build: "unavailable" }; }
  }
  globalThis.GSTFarmDiagnostics = {
    observeToggle,
    key(scene, stage, reason = "") {
      try {
        if (!binding || binding.scene !== scene || !["received", "ignored", "blocked", "result"].includes(stage)) return;
        const allowed = ["menu", "background", "repeat", "modifier", "untrusted", "stale", "composing",
          "scene_unavailable", "configuration", "chat", "key_capture", "dead", "ui_blocked", "disconnected",
          "conflict", "controller", "enabled", "disabled", "unchanged"];
        const row = { at: new Date().toISOString(), stage, reason: allowed.includes(reason) ? reason : "",
          on: scene?.auto?.on === true, focused: document.hasFocus(), hidden: document.hidden };
        keyEvents.push(row); keyEvents = keyEvents.slice(-24);
      } catch { /* Diagnostics cannot block a shortcut. */ }
    },
    attach: (scene) => { try { attach(scene); } catch { detach(); } },
    toggleByUser: (scene) => toggle(scene, "shortcut"),
    restore: (scene) => toggle(scene, "restore"),
    snapshot: () => ({ build: "farm-stop-2", tracking: binding !== null,
      background: readSnapshot("GSTBackgroundDiagnostics"),
      movement: readSnapshot("GSTMovementDiagnostics"),
      bossSafety: readSnapshot("GSTFarmBossSafety"),
      skill: readSnapshot("GSTFarmSkillDiagnostics"),
      flight: readSnapshot("GSTFlight"),
      keyEvents: keyEvents.map((row) => ({ ...row })),
      current: flags(binding?.scene), lastStop: rows.findLast((row) => row.event === "off") ?? null, events: [...rows] })
  };
  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== "https://nghichthienky.online"
        || event.data?.channel !== "gst:farm-debug-request:v1" || typeof event.data.requestId !== "string") return;
    at = -Infinity;
    try { frame(); } catch { /* A broken tracker must not prevent exporting the remaining logs. */ }
    window.postMessage({ channel: "gst:farm-debug:v1", requestId: event.data.requestId,
      diagnostics: GSTFarmDiagnostics.snapshot() }, "https://nghichthienky.online");
  });
  window.addEventListener("pagehide", () => {
    if (binding) record(binding.scene, "context", "navigation");
    detach();
  });
})();
