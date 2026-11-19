(() => {
  "use strict";
  const origin = "https://nghichthienky.online", channel = "gst:intent-authority:v1";
  const maxClients = 128;
  let identity = null, binding = null, nonce = "", sequence = 0, current = null;
  let disposed = false, proof = "", contextSession = "", contextRevision = -1;
  const clients = new Map();
  const sceneNow = () => window.game?.scene?.getScene?.("world")
    ?? (window.__ntkScene?.sys?.settings?.key === "world" ? window.__ntkScene : null);
  function invalidate() {
    if (binding) {
      binding.scene.events?.off?.("shutdown", invalidate);
      binding.scene.events?.off?.("destroy", invalidate);
    }
    binding = null; nonce = ""; proof = ""; identity = null; sequence = 0; current = null; clients.clear();
    window.postMessage({ channel, type: "invalidated" }, origin);
  }
  // Issued only by the existing account snapshot path, before its asynchronous verification.
  // Account configuration messages are deliberately not an identity authority.
  function capture(scene, snapshot) {
    const key = JSON.stringify([snapshot.connected, snapshot.loginVisible, snapshot.slot,
      snapshot.character, snapshot.classId, snapshot.characterId]);
    if (!snapshot.connected || snapshot.loginVisible || !scene?.auto) {
      if (binding || proof) invalidate();
      return null;
    }
    if (!binding || binding.scene !== scene || binding.auto !== scene.auto || binding.key !== key) {
      invalidate();
      if (!globalThis.crypto?.randomUUID) return null;
      nonce = crypto.randomUUID(); proof = crypto.randomUUID();
      binding = { scene, auto: scene.auto, key, snapshot: { ...snapshot } };
      scene.events.on("shutdown", invalidate); scene.events.on("destroy", invalidate);
    }
    return { lifecycle: nonce, proof };
  }
  function live() {
    const scene = sceneNow(), snapshot = binding?.snapshot;
    if (disposed || !identity || !snapshot || scene !== binding.scene || scene.auto !== binding.auto
        || !scene.sys?.isActive?.() || scene.leaving
        || scene.profile?.name?.normalize?.("NFC") !== snapshot.character
        || scene.profile?.classId !== snapshot.classId || String(scene.you) !== snapshot.characterId
        || (new URLSearchParams(location.search).get("slot") ?? "") !== snapshot.slot) {
      if (binding || identity) invalidate();
      return false;
    }
    return true;
  }
  function acceptContext(data) {
    if (typeof data.session !== "string" || !Number.isSafeInteger(data.revision)
        || data.revision < 0 || (contextSession && contextSession !== data.session)
        || data.revision <= contextRevision) return;
    contextSession = data.session; contextRevision = data.revision;
    const next = data.identity, stamp = data.stamp, snapshot = binding?.snapshot;
    if (!next) { invalidate(); return; }
    if (!stamp || stamp.lifecycle !== nonce || stamp.proof !== proof || !snapshot
        || next.verified !== true || !next.profileKey || next.slot !== snapshot.slot
        || next.character !== snapshot.character || next.classId !== snapshot.classId
        || next.characterId !== snapshot.characterId) return;
    const old = identity;
    if (old && JSON.stringify(old) !== JSON.stringify(next)) { invalidate(); return; }
    identity = { ...next };
    live();
  }
  function handshake(profileKey) {
    if (!live()) return { ok: false, reason: "not_ready" };
    if (profileKey !== identity.profileKey) return { ok: false, reason: "identity_mismatch" };
    if (clients.size >= maxClients) clients.delete(clients.keys().next().value);
    const client = crypto.randomUUID();
    clients.set(client, 0);
    return { ok: true, binding: { lifecycle: nonce, client, profileKey: identity.profileKey } };
  }
  function reserve(requestBinding, ordinal, feature, enabled, profileKey) {
    if (!live()) return { ok: false, reason: "not_ready" };
    if (!requestBinding || requestBinding.lifecycle !== nonce || requestBinding.profileKey !== identity.profileKey
        || profileKey !== identity.profileKey || !clients.has(requestBinding.client)
        || !Number.isSafeInteger(ordinal) || ordinal <= clients.get(requestBinding.client)
        || !["farm", "harvest"].includes(feature) || typeof enabled !== "boolean")
      return { ok: false, reason: "stale_binding_or_request" };
    if (sequence >= Number.MAX_SAFE_INTEGER) return { ok: false, reason: "capacity" };
    clients.set(requestBinding.client, ordinal);
    // Synchronous acceptance is the single page-local linearization point.
    const token = { lifecycle: nonce, sequence: ++sequence, feature, enabled, profileKey: identity.profileKey };
    current = token;
    return { ok: true, token: { ...token } };
  }
  function validate(token, feature, enabled, profileKey) {
    if (!live() || !current || !token || typeof token !== "object") return false;
    return profileKey === identity.profileKey && feature === current.feature && enabled === current.enabled
      && token.lifecycle === nonce && token.lifecycle === current.lifecycle
      && token.sequence === current.sequence && token.feature === current.feature
      && token.enabled === current.enabled && token.profileKey === current.profileKey
      && token.profileKey === identity.profileKey;
  }
  globalThis.GSTIntentAuthority = Object.freeze({ handshake, reserve, validate, invalidate, capture });
  function onMessage(event) {
    if (event.source !== window || event.origin !== origin) return;
    const data = event.data;
    if (data?.channel === channel && data.type === "account-context") {
      acceptContext(data); return;
    }
    if (data?.channel !== channel || !["handshake", "reserve", "validate"].includes(data.type)
        || typeof data.requestId !== "string") return;
    const currentContext = data.session === contextSession && data.revision === contextRevision;
    const result = !currentContext ? { ok: false, reason: "context_changed" }
      : data.type === "handshake" ? handshake(data.profileKey)
      : data.type === "reserve" ? reserve(data.binding, data.ordinal, data.feature, data.enabled, data.profileKey)
      : { ok: validate(data.token, data.feature, data.enabled, data.profileKey), reason: "not_current" };
    // A remote validation is a snapshot only. Page action handlers must validate synchronously at application.
    window.postMessage({ channel, type: "response", requestId: data.requestId, result }, origin);
  }
  window.addEventListener("message", onMessage);
  window.addEventListener("pagehide", () => { disposed = true; invalidate(); });
  window.addEventListener("pageshow", () => { disposed = false; invalidate(); });
})();
