(() => {
  "use strict";
  const origin = "https://nghichthienky.online", channel = "gst:intent-authority:v1";
  const pending = new Map(), timeoutMs = 1500, maxPending = 64;
  let disposed = false, contextGeneration = 0;
  const ordinals = new Map();
  const contextSession = crypto.randomUUID();
  let contextRevision = 0;
  function sameIdentity(expected) {
    const state = globalThis.GSTAccountProfiles?.context?.();
    const actual = state?.context;
    return state?.ready === true && actual?.verified === true && expected?.profileKey === actual.profileKey
      && expected?.accountId === (actual.accountId ?? "") && expected?.slot === (actual.slot ?? "")
      && expected?.character === (actual.character ?? "") && expected?.classId === (actual.classId ?? "")
      && expected?.characterId === (actual.characterId ?? "");
  }
  function finish(id, result) {
    const p = pending.get(id); if (!p) return;
    pending.delete(id); clearTimeout(p.timer);
    p.resolve(!disposed && p.generation === contextGeneration && sameIdentity(p.identity) ? result : { ok: false, reason: "identity_changed" });
  }
  function request(type, feature, enabled, identity, token = null, binding = null) {
    if (disposed || !sameIdentity(identity)) return Promise.resolve({ ok: false, reason: "identity_mismatch" });
    if (!globalThis.crypto?.randomUUID || pending.size >= maxPending) return Promise.resolve({ ok: false, reason: "unavailable" });
    if (type === "reserve" && (!binding || typeof binding.client !== "string" || !ordinals.has(binding.client)))
      return Promise.resolve({ ok: false, reason: "binding_missing" });
    const ordinal = type === "reserve" ? ordinals.get(binding.client) + 1 : null;
    if (ordinal !== null) ordinals.set(binding.client, ordinal);
    const requestId = crypto.randomUUID();
    return new Promise((resolve) => {
      const timer = setTimeout(() => finish(requestId, { ok: false, reason: "timeout" }), timeoutMs);
      pending.set(requestId, { resolve, timer, identity: { ...identity }, generation: contextGeneration, type });
      window.postMessage({ channel, type, requestId, feature, enabled, token, binding, ordinal, session: contextSession, revision: contextRevision, profileKey: identity.profileKey }, origin);
    });
  }
  // These methods are for future feature-origin wiring; they do not apply any intent.
  globalThis.GSTIntentBridge = Object.freeze({
    handshake: (identity) => request("handshake", null, null, identity),
    reserve: (binding, feature, enabled, identity) => request("reserve", feature, enabled, identity, null, binding),
    validate: (token, feature, enabled, identity) => request("validate", feature, enabled, identity, token)
  });
  function onPageMessage(event) {
    if (event.source === window && event.origin === origin && event.data?.channel === channel
        && event.data.type === "invalidated") {
      contextGeneration++; ordinals.clear();
      for (const id of [...pending.keys()]) finish(id, { ok: false, reason: "lifecycle_changed" });
      return;
    }
    if (event.source !== window || event.origin !== origin || event.data?.channel !== channel
        || event.data.type !== "response" || typeof event.data.requestId !== "string") return;
    const entry = pending.get(event.data.requestId);
    if (entry?.type === "handshake" && entry.generation === contextGeneration && !disposed
        && sameIdentity(entry.identity) && event.data.result?.ok === true
        && typeof event.data.result.binding?.client === "string") ordinals.set(event.data.result.binding.client, 0);
    finish(event.data.requestId, event.data.result);
  }
  function onRuntime(message, sender, respond) {
    if (message?.type !== "gst:intent-handshake" && message?.type !== "gst:intent-reserve" && message?.type !== "gst:intent-validate") return;
    const state = globalThis.GSTAccountProfiles?.context?.(), identity = state?.context;
    if (!state?.ready || !identity?.verified || !Number.isInteger(message.targetTabId)
        || !globalThis.GSTAccountProfiles.matchesIdentity(identity, message.profileIdentity, message.targetTabId)
        || !sameIdentity(message.profileIdentity)) {
      respond({ ok: false, reason: "identity_mismatch" }); return;
    }
    request(message.type === "gst:intent-handshake" ? "handshake" : message.type === "gst:intent-reserve" ? "reserve" : "validate", message.feature,
      message.enabled, message.profileIdentity, message.token, message.binding).then(respond);
    return true;
  }
  let observedIdentity = null, observedVerification = null;
  function publishContext(context) {
    if (disposed) return;
    const next = context?.verified ? JSON.stringify([context.profileKey, context.accountId, context.slot, context.character, context.classId, context.characterId]) : null;
    if (next !== observedIdentity) {
      observedIdentity = next; contextGeneration++; ordinals.clear();
      for (const id of [...pending.keys()]) finish(id, { ok: false, reason: "identity_changed" });
    }
    const identity = context?.verified === true ? {
      verified: true, profileKey: context.profileKey, accountId: context.accountId ?? "",
      slot: context.slot ?? "", character: context.character, classId: context.classId,
      characterId: context.characterId
    } : null;
    const verification = JSON.stringify([identity, context?.intentStamp ?? null]);
    if (verification === observedVerification) return;
    observedVerification = verification;
    window.postMessage({ channel, type: "account-context", session: contextSession,
      revision: ++contextRevision, identity, stamp: context?.intentStamp ?? null }, origin);
  }
  globalThis.GSTAccountProfiles?.onContext?.(publishContext);
  function onHide() {
    disposed = true; contextGeneration++; ordinals.clear(); observedVerification = null;
    for (const id of [...pending.keys()]) finish(id, { ok: false, reason: "disposed" });
    window.removeEventListener("message", onPageMessage);
    chrome.runtime.onMessage.removeListener(onRuntime);
  }
  function onShow() {
    disposed = false;
    window.removeEventListener("message", onPageMessage); window.addEventListener("message", onPageMessage);
    chrome.runtime.onMessage.removeListener(onRuntime); chrome.runtime.onMessage.addListener(onRuntime);
    const state = globalThis.GSTAccountProfiles?.context?.();
    if (state?.ready) publishContext(state.context);
  }
  window.addEventListener("pagehide", onHide); window.addEventListener("pageshow", onShow);
  onShow();
})();
