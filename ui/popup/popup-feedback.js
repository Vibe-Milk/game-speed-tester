(() => {
  "use strict";
  // State comes from the feature's actual operation, not from its text.
  function show(element, state, message = "") {
    element.dataset.feedbackState = state;
    element.textContent = message;
  }
  globalThis.GSTPopupFeedback = Object.freeze({
    show,
    clear: (element) => show(element, "idle"),
    info: (element, message) => show(element, "info", message),
    pending: (element, message = "Đang lưu…") => show(element, "pending", message),
    success: (element, message = "Đã lưu.") => show(element, "success", message),
    error: (element, message = "Chưa lưu được. Hãy thử lại.") => show(element, "error", message),
  });
})();
