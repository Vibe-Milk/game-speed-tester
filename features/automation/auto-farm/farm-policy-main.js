// Canonical popup/ISOLATED helper; keep farm-policy-main.js byte-identical.
(() => {
  "use strict";
  // Legacy values remain readable, but never select a retired controller.
  const modes = Object.freeze(["tool", "native", "disabled", "extended", "custom"]);
  const normalize = (value) => value === "native" || value === "disabled" ? value : "tool";
  let activeMode = "tool"; // Closed until verified configuration arrives.
  globalThis.GSTFarmPolicy = Object.freeze({
    modes, defaultMode: "tool", normalize,
    mode: () => activeMode,
    isNative: () => activeMode === "native",
    isTool: () => activeMode === "tool",
    isExtended: () => false,
    isCustom: () => false,
    isDisabled: () => activeMode === "disabled",
    blocksNativeDecisions: () => activeMode !== "native",
    hasExtensionAssistance: () => false,
    setMode(value) { activeMode = normalize(value); return activeMode; },
    read(preferences) { return normalize(preferences?.policyMode); },
    withMode(preferences, mode) { return { ...(preferences ?? {}), policyMode: normalize(mode) }; },
    async save(mode) {
      return navigator.locks.request("gst:farm-preferences", async () => {
        const saved = await chrome.storage.local.get("farmPreferences");
        const next = { ...(saved.farmPreferences ?? {}), policyMode: normalize(mode) };
        await chrome.storage.local.set({ farmPreferences: next });
        return next.policyMode;
      });
    }
  });
})();
