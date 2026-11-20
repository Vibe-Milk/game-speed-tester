// Canonical popup/ISOLATED helper; keep farm-policy-main.js byte-identical.
(() => {
  "use strict";
  // Legacy values remain readable, but never select a retired controller.
  const modes = Object.freeze(["tool", "native", "disabled", "extended", "custom"]);
  const normalize = (value) => value === "native" || value === "disabled" ? value : "tool";
  const slots = Object.freeze(["1", "2", "3", "4", "5", "6"]);
  function actions(value) {
    const enabled = Array.isArray(value?.skillEnabled) ? value.skillEnabled : [];
    const priority = Array.isArray(value?.skillPriority) ? value.skillPriority : [];
    return {
      skillMode: value?.skillMode === "game" || value?.skillMode === "custom" ? value.skillMode
        : Array.isArray(value?.skillEnabled) || Array.isArray(value?.skillPriority) ? "custom" : "game",
      skillEnabled: slots.filter((slot) => enabled.includes(slot)),
      skillPriority: priority.length === 6 && new Set(priority).size === 6 && priority.every((slot) => slots.includes(slot))
        ? [...priority] : [...slots],
      pickupMode: value?.pickupMode === "tool" ? "tool" : "game"
    };
  }
  let activeMode = "tool"; // Closed until verified configuration arrives.
  globalThis.GSTFarmPolicy = Object.freeze({
    actions,
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
