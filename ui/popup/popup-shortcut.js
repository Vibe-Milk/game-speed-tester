(() => {
  "use strict";
  // One recorder per popup. Feature-specific storage, defaults, runtime
  // dispatch and validation restrictions remain with the callers.
  let active = null;
  const modifierKeys = ["Control", "Alt", "Shift", "Meta"];
  const hasModifiers = (event) => event.ctrlKey || event.altKey || event.shiftKey || event.metaKey;
  const validFarmCode = (code) => Number.isInteger(code) && ((code >= 48 && code <= 57)
    || (code >= 65 && code <= 90) || (code >= 112 && code <= 121 && code !== 116));
  const numericName = (code) => code >= 112 ? "F" + (code - 111) : String.fromCharCode(code);
  const codeName = (code) => String(code ?? "").replace(/^Key/, "").replace(/^Digit/, "");
  function chord(event) {
    return { code: event.code, ctrl: event.ctrlKey, alt: event.altKey, shift: event.shiftKey, meta: event.metaKey };
  }
  function format(value, displayCode = codeName) {
    return [value.ctrl && "Ctrl", value.alt && "Alt", value.shift && "Shift", value.meta && "Meta",
      displayCode(value.code)].filter(Boolean).join(" + ");
  }
  function cancel() {
    if (!active) return;
    const previous = active;
    active = null;
    previous.feedback.textContent = previous.cancelMessage;
  }
  function bind(options) {
    const recorder = { cancelMessage: "Đã hủy.", ...options };
    recorder.capture.addEventListener("click", () => {
      if (active && active !== recorder) cancel();
      active = recorder;
      recorder.feedback.textContent = recorder.prompt;
    });
    recorder.reset.addEventListener("click", () => {
      cancel();
      void recorder.save(recorder.defaultValue);
    });
  }

  // Loaded after Global Help and before all feature/menu shortcut handlers.
  // Escape cancels capture before the embedded menu can close.
  window.addEventListener("keydown", (event) => {
    if (!active) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const recorder = active;
    if (event.key === "Escape" || recorder.capture.matches(":disabled")) {
      cancel();
      return;
    }
    if (recorder.ignore?.(event)) return;
    if (event.repeat || event.isComposing || !recorder.valid(event)) {
      recorder.feedback.textContent = recorder.invalidMessage;
      return;
    }
    active = null;
    void recorder.save(recorder.value(event));
  }, true);

  globalThis.GSTPopupShortcut = Object.freeze({
    bind, hasModifiers, validFarmCode, numericName, codeName, chord, format,
    isModifier: (event) => modifierKeys.includes(event.key),
  });
})();
