(() => {
  "use strict";
  // Pure schemas only; callers retain storage, identity and activation.
  const recoveryLimits = Object.freeze({
    reloadDelaySeconds: Object.freeze({ min: 30, max: 600, defaultValue: 90 }),
    reloadCountdownSeconds: Object.freeze({ min: 3, max: 60, defaultValue: 10 }),
    reloadLimit: Object.freeze({ min: 1, max: 10, defaultValue: 3 }),
    reloadWindowMinutes: Object.freeze({ min: 5, max: 120, defaultValue: 15 }),
  });
  const recoveryDefaults = Object.freeze({ autoReconnect: true, autoReload: false,
    ...Object.fromEntries(Object.entries(recoveryLimits).map(([key, rule]) => [key, rule.defaultValue])) });
  function normalizeRecovery(raw = {}) {
    return { autoReconnect: raw.autoReconnect !== false, autoReload: raw.autoReload === true,
      ...Object.fromEntries(Object.entries(recoveryLimits).map(([key, { min, max, defaultValue }]) => [
        key, Number.isSafeInteger(raw[key]) ? Math.max(min, Math.min(max, raw[key])) : defaultValue,
      ])) };
  }
  const potionDefaults = Object.freeze({ hpEnabled: false, mpEnabled: false, hpPercent: 40, mpPercent: 25 });
  const percent = (value, fallback) => Number.isSafeInteger(value) && value >= 1 && value <= 99 ? value : fallback;
  function normalizePotion(raw) {
    return { hpEnabled: raw?.hpEnabled === true, mpEnabled: raw?.mpEnabled === true,
      hpPercent: percent(raw?.hpPercent, potionDefaults.hpPercent),
      mpPercent: percent(raw?.mpPercent, potionDefaults.mpPercent) };
  }
  globalThis.GSTFeatureOptions = Object.freeze({ recoveryLimits, recoveryDefaults, normalizeRecovery, potionDefaults, normalizePotion });
})();
