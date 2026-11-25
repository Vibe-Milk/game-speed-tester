(() => {
  "use strict";

  // Popup-only numeric input helpers. The feature owns its limits, draft
  // revisions, save queue, account checks and error/rollback policy.
  function read(input, { min = -Infinity, max = Infinity, integer = false, nativeValidity = true } = {}) {
    if (!input.value.trim()) return null;
    const value = input.valueAsNumber;
    if (!Number.isFinite(value) || (integer && !Number.isSafeInteger(value))
        || value < min || value > max || (nativeValidity && !input.checkValidity())) return null;
    return value;
  }

  function bind(input, { commit, onInput, allowBlur = () => true }) {
    if (onInput) input.addEventListener("input", onInput);
    input.addEventListener("blur", (event) => {
      if (allowBlur(event)) void commit();
    });
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      void commit();
    });
  }

  globalThis.GSTPopupNumericInput = Object.freeze({ read, bind });
})();
