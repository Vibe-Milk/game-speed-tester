(() => {
  "use strict";
  const origin = "https://nghichthienky.online";
  let root = null;
  const dismissTimers = new Set();
  function mount() {
    if (root || !document.body) return;
    root = document.createElement("div"); root.id = "gst-feature-toasts";
    root.style.cssText = "all:initial;position:fixed;left:50%;top:50%;transform:translate(-50%,-100%);z-index:2147483646;display:flex;flex-direction:column;gap:4px;pointer-events:none";
    document.body.append(root);
  }
  function setPosition(value) {
    if (!root || !Number.isFinite(value?.x) || !Number.isFinite(value?.y)) return;
    root.style.left = `${Math.max(8, Math.min(innerWidth - 8, value.x))}px`;
    root.style.top = `${Math.max(8, Math.min(innerHeight - 8, value.y))}px`;
  }
  function show(changes, position) {
    mount(); if (!root) return;
    setPosition(position);
    const toast = document.createElement("div");
    toast.textContent = changes.map(({ feature, enabled }) => `${feature === "farm" ? "Auto Farm" : "Thu hoạch"}: ${enabled ? "BẬT" : "TẮT"}`).join("\n");
    toast.style.cssText = "all:initial;display:block;box-sizing:border-box;padding:7px 10px;border-radius:8px;background:#14231f;color:#e8fff6;border:1px solid #69dfb7;box-shadow:0 4px 18px #0008;font:600 14px/1.25 sans-serif;white-space:pre-line;pointer-events:none";
    root.append(toast);
    const dismiss = setTimeout(() => { toast.remove(); dismissTimers.delete(dismiss); }, 2000);
    dismissTimers.add(dismiss);
  }
  function onMessage(event) {
    const data = event.data;
    if (event.source !== window || event.origin !== origin || typeof data?.identity !== "string" || !data.identity) return;
    if (data.channel === "gst:feature-toast-position:v1") { setPosition(data.position); return; }
    const changes = data.changes;
    if (data.channel !== "gst:feature-toast:v1" || !Array.isArray(changes) || !changes.length
        || changes.length > 2 || changes.some((row) => !["farm", "harvest"].includes(row?.feature)
          || typeof row.enabled !== "boolean")) return;
    show(changes, data.position);
  }
  function cleanup() {
    for (const dismiss of dismissTimers) clearTimeout(dismiss);
    dismissTimers.clear(); root?.remove(); root = null;
  }
  window.addEventListener("message", onMessage);
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount, { once: true });
  window.addEventListener("pagehide", cleanup, { once: true });
  window.addEventListener("pageshow", mount);
})();
