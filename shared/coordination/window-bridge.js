(() => {
  "use strict";
  // Same-window transport only: not identity, authorization or an ACK.
  // Callers retain sender checks, payload validation and lifecycle guards.
  const origin = "https://nghichthienky.online";
  function matches(event, channel) {
    return event.source === window && event.origin === origin && event.data?.channel === channel;
  }
  function send(message) {
    window.postMessage(message, origin);
  }
  globalThis.GSTWindowBridge = Object.freeze({ matches, send });
})();
