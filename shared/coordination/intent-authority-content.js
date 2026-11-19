(() => {
  "use strict";
  const origin = "https://nghichthienky.online", channel = "gst:intent-authority:v1";
  const pending = new Map(), ordinals = new Map(), session = crypto.randomUUID();
  let disposed = false, generation = 0, revision = 0, sequence = 0, handshakes = 0;
  let observedIdentity = null, observedVerification = null, binding = null, current = null, ownTab = null;
  // The service worker derives this from sender.tab, never a caller-supplied tab ID.
  void chrome.runtime.sendMessage({ type: "gst:intent-tab" }).then((result) => {
    if (Number.isInteger(result?.tabId) && result.frameId === 0) ownTab = result.tabId;
  }).catch(() => {});
  function sameIdentity(expected) {
    const state = globalThis.GSTAccountProfiles?.context?.(), actual = state?.context;
    return state?.ready === true && actual?.verified === true && expected?.profileKey === actual.profileKey
      && (expected?.accountId ?? "") === (actual.accountId ?? "") && (expected?.slot ?? "") === (actual.slot ?? "")
      && expected?.character === actual.character && expected?.classId === actual.classId
      && expected?.characterId === actual.characterId;
  }
  function finish(id, result) {
    const entry = pending.get(id); if (!entry) return;
    pending.delete(id); clearTimeout(entry.timer);
    entry.resolve(!disposed && entry.generation === generation && sameIdentity(entry.identity)
      ? result : { ok: false, reason: "identity_changed" });
  }
  function retire() {
    generation++; binding = null; current = null; ordinals.clear();
    for (const id of [...pending.keys()]) finish(id, { ok: false, reason: "lifecycle_changed" });
  }
  function request(type, identity, details = {}) {
    if (disposed || !sameIdentity(identity) || pending.size >= 64)
      return Promise.resolve({ ok: false, reason: "not_ready" });
    const requestId = session + ":" + (++sequence);
    return new Promise((resolve) => {
      const timer = setTimeout(() => finish(requestId, { ok: false, reason: "timeout" }), 1500);
      pending.set(requestId, { resolve, timer, identity: { ...identity }, generation });
      window.postMessage({ channel, type, requestId, session, revision,
        profileKey: identity.profileKey, ...details }, origin);
    });
  }
  function isCurrent(token) {
    return !!token && !!current && token.lifecycle === current.lifecycle && token.sequence === current.sequence
      && token.profileKey === current.profileKey && token.feature === current.feature && token.enabled === current.enabled;
  }
  function begin(feature, enabled, identity) {
    if (!binding || !sameIdentity(identity) || !["farm", "harvest"].includes(feature) || typeof enabled !== "boolean")
      return Promise.resolve({ ok: false, reason: "authority_not_ready" });
    const captured = { ...binding }, ordinal = (ordinals.get(captured.client) ?? 0) + 1;
    ordinals.set(captured.client, ordinal);
    return request("reserve", identity, { binding: captured, ordinal, feature, enabled });
  }
  async function validate(token, feature, enabled, identity) {
    if (!isCurrent(token)) return { ok: false, reason: "superseded" };
    const result = await request("validate", identity, { token, feature, enabled });
    return result?.ok && isCurrent(token) ? result : { ok: false, reason: "superseded" };
  }
  function targetMatches(tabId, identity) {
    return Number.isInteger(ownTab) && tabId === ownTab && identity?.tabId === ownTab && sameIdentity(identity);
  }
  globalThis.GSTIntentBridge = Object.freeze({ begin, validate, isCurrent, targetMatches,
    current: () => current ? { ...current } : null });
  function onPageMessage(event) {
    if (event.source !== window || event.origin !== origin || event.data?.channel !== channel) return;
    const data = event.data;
    if (data.type === "invalidated") { retire(); return; }
    if (data.type === "ready" && data.session === session && data.revision === revision) {
      const identity = globalThis.GSTAccountProfiles?.context?.().context, expectedGeneration = generation;
      if (!sameIdentity(identity) || binding?.lifecycle === data.lifecycle) return;
      void request("handshake", identity, { lifecycle: data.lifecycle, handshakeOrdinal: ++handshakes }).then((result) => {
        if (result?.ok && generation === expectedGeneration && sameIdentity(identity)
            && result.binding?.lifecycle === data.lifecycle) {
          binding = result.binding; ordinals.set(binding.client, 0);
        }
      });
      return;
    }
    if (data.type === "reserved") {
      const token = data.token;
      if (binding && token?.lifecycle === binding.lifecycle && token.profileKey === binding.profileKey
          && Number.isSafeInteger(token.sequence) && (!current || token.sequence > current.sequence)) current = { ...token };
      return;
    }
    if (data.type === "response" && typeof data.requestId === "string") finish(data.requestId, data.result);
  }
  function onRuntime(message, sender, respond) {
    if (sender.id !== chrome.runtime.id || !["gst:intent-begin", "gst:intent-validate"].includes(message?.type)) return;
    if (!targetMatches(message.targetTabId, message.profileIdentity)
        || (message.lifecycle && binding?.lifecycle !== message.lifecycle)) {
      respond({ ok: false, reason: "tab_or_identity_mismatch" }); return;
    }
    const operation = message.type === "gst:intent-begin"
      ? begin(message.feature, message.enabled, message.profileIdentity)
      : validate(message.token, message.feature, message.enabled, message.profileIdentity);
    operation.then(respond, () => respond({ ok: false, reason: "bridge_error" }));
    return true;
  }
  function publishContext(context) {
    if (disposed) return;
    const identity = context?.verified === true ? {
      verified: true, profileKey: context.profileKey, accountId: context.accountId ?? "", slot: context.slot ?? "",
      character: context.character, classId: context.classId, characterId: context.characterId
    } : null;
    const key = JSON.stringify(identity), verification = JSON.stringify([identity, context?.intentStamp ?? null]);
    if (key !== observedIdentity) { observedIdentity = key; retire(); }
    if (verification === observedVerification) return;
    observedVerification = verification;
    window.postMessage({ channel, type: "account-context", session, revision: ++revision,
      identity, stamp: context?.intentStamp ?? null }, origin);
  }
  globalThis.GSTAccountProfiles?.onContext?.(publishContext);
  function onHide() {
    disposed = true; retire(); observedVerification = null;
    window.removeEventListener("message", onPageMessage); chrome.runtime.onMessage.removeListener(onRuntime);
  }
  function onShow() {
    disposed = false;
    window.removeEventListener("message", onPageMessage); window.addEventListener("message", onPageMessage);
    chrome.runtime.onMessage.removeListener(onRuntime); chrome.runtime.onMessage.addListener(onRuntime);
    const state = globalThis.GSTAccountProfiles?.context?.(); if (state?.ready) publishContext(state.context);
  }
  window.addEventListener("pagehide", onHide); window.addEventListener("pageshow", onShow); onShow();
})();
