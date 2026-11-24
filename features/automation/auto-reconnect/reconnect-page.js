(() => {
  "use strict";
  // Observe native transport health; keep handshake, credentials and retry
  // decisions inside the game's original driver.
  const retryDelays = [15000, 30000, 60000];
  const replyTimeout = 12000;
  const verificationTimeout = 30000;
  const defaults = Object.freeze({ autoReconnect: true, autoReload: false, reloadDelaySeconds: 90,
    reloadCountdownSeconds: 10, reloadLimit: 3, reloadWindowMinutes: 15 });
  const episodeStorageKey = "gst:connection-recovery:v1";
  let suspended = false, timer = null, state = null;
  let preferences = { ...defaults }, profileContext = null, preferencesReady = false;
  let activeScopeKey = "", reloadTimer = null, reloadBanner = null;
  const memoryCanceled = new Set();
  let recoveryCheckId = 0;

  function sceneNow() {
    try {
      return window.game?.scene?.getScene?.("world")
        ?? (window.__ntkScene?.sys?.settings?.key === "world" ? window.__ntkScene : null);
    } catch { return null; }
  }
  function eligible(scene) {
    const driver = scene?.driver;
    return scene?.sys?.isActive?.() === true && sceneNow() === scene && !scene.leaving
      && driver?.online === true && driver.ready === true
      && !driver.closing
      && typeof driver.link?.open === "function";
  }
  function normalizePreferences(value = {}) {
    const bounded = (candidate, min, max, fallback) => Number.isSafeInteger(candidate)
      ? Math.max(min, Math.min(max, candidate)) : fallback;
    return {
      autoReconnect: value.autoReconnect !== false,
      autoReload: value.autoReload === true,
      reloadDelaySeconds: bounded(value.reloadDelaySeconds, 30, 600, defaults.reloadDelaySeconds),
      reloadCountdownSeconds: bounded(value.reloadCountdownSeconds, 3, 60, defaults.reloadCountdownSeconds),
      reloadLimit: bounded(value.reloadLimit, 1, 10, defaults.reloadLimit),
      reloadWindowMinutes: bounded(value.reloadWindowMinutes, 5, 120, defaults.reloadWindowMinutes)
    };
  }
  function readRecords() {
    try {
      const value = JSON.parse(sessionStorage.getItem(episodeStorageKey) ?? "{}");
      return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    } catch { return {}; }
  }
  function writeRecords(records) {
    try { sessionStorage.setItem(episodeStorageKey, JSON.stringify(records)); return true; }
    catch { return false; }
  }
  function recordFor(scopeKey, now, outageStart = now) {
    const records = readRecords();
    const old = records[scopeKey];
    const validOld = old && old.version === 1 && old.scopeKey === scopeKey
      && Number.isFinite(old.startedAt) && Array.isArray(old.reloads)
      && Number.isSafeInteger(old.extensionAttempts);
    if (validOld && old.startedAt > 0) return old;
    const next = { version: 1, scopeKey, startedAt: outageStart, extensionAttempts: 0,
      reloads: validOld ? old.reloads : [], countdownStartedAt: 0, canceled: false };
    records[scopeKey] = next;
    return writeRecords(records) ? next : null;
  }
  function saveRecord(record) {
    const records = readRecords();
    records[record.scopeKey] = record;
    return writeRecords(records);
  }
  function clearRecord(scopeKey) {
    if (!scopeKey) return;
    const records = readRecords();
    const old = records[scopeKey];
    records[scopeKey] = { version: 1, scopeKey, startedAt: 0, extensionAttempts: 0,
      reloads: Array.isArray(old?.reloads) ? old.reloads : [], countdownStartedAt: 0, canceled: false };
    writeRecords(records);
    memoryCanceled.delete(scopeKey);
  }
  function hideReloadBanner() {
    reloadBanner?.root?.remove();
    reloadBanner = null;
  }
  function stopReloadCountdown() {
    clearTimeout(reloadTimer);
    reloadTimer = null;
  }
  function showReloadBanner(message, cancelAction = null) {
    if (!reloadBanner?.root?.isConnected) {
      const root = document.createElement("div");
      root.setAttribute("role", "status");
      root.setAttribute("aria-live", "assertive");
      root.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483646;max-width:min(420px,calc(100vw - 32px));padding:12px 14px;border:1px solid #f0b44d;border-radius:9px;background:#211d16;color:#fff;font:14px/1.45 system-ui,sans-serif;box-shadow:0 4px 24px #0008";
      const text = document.createElement("span");
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Hủy tải lại";
      button.style.cssText = "display:block;margin-top:8px;padding:7px 12px;border:1px solid #f0b44d;border-radius:6px;background:#3a3020;color:#fff;font:inherit;cursor:pointer";
      root.append(text, button);
      (document.body ?? document.documentElement).append(root);
      reloadBanner = { root, text, button };
    }
    reloadBanner.text.textContent = message;
    reloadBanner.button.hidden = typeof cancelAction !== "function";
    reloadBanner.button.onclick = typeof cancelAction === "function" ? cancelAction : null;
  }
  function nativeIdentity(scene) {
    const profile = scene?.profile;
    const character = typeof profile?.name === "string" ? profile.name.normalize("NFC") : "";
    const classId = typeof profile?.classId === "string" ? profile.classId : "";
    const characterId = typeof scene?.you === "string" || Number.isSafeInteger(scene?.you) ? String(scene.you) : "";
    return { character, classId, characterId };
  }
  function reloadScope(scene) {
    const params = new URLSearchParams(location.search);
    const slot = params.get("slot") ?? "";
    const loginForm = document.querySelector("#login form");
    if (params.has("gstAttempt") || loginForm?.getClientRects?.().length) return null;
    const verification = document.querySelector('[name*="captcha" i], [name*="otp" i], [name*="verify" i], [name="code"], [id*="captcha" i], [id*="otp" i]');
    if (verification?.getClientRects?.().length) return null;
    const current = nativeIdentity(scene);
    if (!current.character) return null;
    const context = profileContext;
    if (slot) {
      if (!context?.managed || context.slot !== slot || !context.accountId || !context.expectedCharacter
          || current.character !== context.expectedCharacter
          || context.expectedClassId && current.classId !== context.expectedClassId) return null;
      return JSON.stringify({ type: "managed", slot, accountId: context.accountId,
        profileKey: context.profileKey, character: context.expectedCharacter,
        classId: context.expectedClassId || current.classId });
    }
    if (context?.managed || context?.slot) return null;
    // sessionStorage already isolates this record to the current tab. Character
    // and class keep unmanaged contexts distinct while ignoring transient entity IDs.
    return JSON.stringify({ type: "unmanaged", character: current.character, classId: current.classId });
  }
  function cancelCurrentOutage(scopeKey) {
    if (!scopeKey) return;
    memoryCanceled.add(scopeKey);
    const record = readRecords()[scopeKey];
    if (record) { record.canceled = true; record.countdownStartedAt = 0; saveRecord(record); }
    stopReloadCountdown();
    hideReloadBanner();
  }
  function applyProfileMessage(data) {
    const context = data.connectionRecoveryContext;
    if (!context || typeof context !== "object") return;
    const slot = new URLSearchParams(location.search).get("slot") ?? "";
    if ((context.slot ?? "") !== slot || context.managed !== !!slot
        || typeof context.accountId !== "string" || typeof context.profileKey !== "string") return;
    const previous = preferences;
    const previousScope = activeScopeKey;
    profileContext = {
      managed: context.managed === true, slot, accountId: context.accountId,
      profileKey: context.profileKey,
      expectedCharacter: typeof context.expectedCharacter === "string" ? context.expectedCharacter.normalize("NFC") : "",
      expectedClassId: typeof context.expectedClassId === "string" ? context.expectedClassId : "",
      verified: data.verified === true
    };
    preferences = normalizePreferences(data.connectionRecoveryPreferences);
    preferencesReady = true;
    const scene = sceneNow();
    const nextScope = scene ? reloadScope(scene) : null;
    const settingsChanged = Object.keys(defaults).some((key) => preferences[key] !== previous[key]);
    if (state?.recoveryIdentity && nextScope !== state.recoveryIdentity.scopeKey)
      revokeRecovery(state, true);
    if (previousScope && (nextScope !== previousScope || settingsChanged)) {
      const oldRecord = readRecords()[previousScope];
      if (oldRecord?.countdownStartedAt) { oldRecord.countdownStartedAt = 0; if (!saveRecord(oldRecord)) memoryCanceled.add(previousScope); }
      stopReloadCountdown();
      hideReloadBanner();
    }
    activeScopeKey = nextScope ?? "";
    if (previous.autoReload && !preferences.autoReload && previousScope && previousScope === nextScope)
      cancelCurrentOutage(previousScope);
  }
  function detach() {
    const previous = state;
    state = null;
    if (activeScopeKey) {
      const record = readRecords()[activeScopeKey];
      if (record?.countdownStartedAt) { record.countdownStartedAt = 0; if (!saveRecord(record)) memoryCanceled.add(activeScopeKey); }
    }
    stopReloadCountdown();
    hideReloadBanner();
    activeScopeKey = "";
    if (!previous) return;
    const { driver } = previous;
    try {
      if (driver.receive === previous.receiveHook) {
        if (previous.receiveDescriptor) Object.defineProperty(driver, "receive", previous.receiveDescriptor);
        else delete driver.receive;
      }
      if (driver.onStatus === previous.statusHook) driver.onStatus = previous.originalStatus;
    } catch { /* Never disturb the native driver during scene teardown. */ }
  }
  function attach(scene) {
    const driver = scene.driver;
    if (state?.scene === scene && state.driver === driver
        && driver.receive === state.receiveHook && driver.onStatus === state.statusHook) return state;
    detach();
    if (typeof driver.receive !== "function" || typeof driver.onStatus !== "function") return null;
    const now = performance.now();
    const owner = {
      scene, driver, lastInbound: now, diagnosticLastInbound: null, waitingSince: null, downSince: null, downSinceWall: null,
      healthySince: null, attempts: 0, lastAttempt: -Infinity, pending: false,
      nativeReconnectStarted: false, scopeKey: null, lastWatch: now, minimumPingAt: 0, lastPong: null, lastPongRequest: 0, freshEpisode: false,
      recoveryIdentity: null, revokedIdentity: null, recoveryRevoked: false, switchLocked: false, successCheck: 0, successVerified: false, checkRequestedAt: 0,
      verificationStartedAt: 0, verificationTimedOut: false, reauthCheck: 0, reauthRequestedAt: 0, reloadState: "",
      confirmed: false, receiveDescriptor: Object.getOwnPropertyDescriptor(driver, "receive"),
      originalReceive: driver.receive, originalStatus: driver.onStatus
    };
    owner.receiveHook = function (...args) {
      const result = owner.originalReceive.apply(this, args);
      // The original decoder handles all packets. Only observe arrival time.
      if (state === owner && this === driver && eligible(scene)
          && typeof args[0] === "string") {
        owner.lastInbound = performance.now();
        owner.diagnosticLastInbound = owner.lastInbound;
        // Only a native pong confirms a response to the outstanding heartbeat.
        let pong = null;
        if (args[0].includes('"pong"')) {
          try { const packet = JSON.parse(args[0]); if (packet?.t === "pong") pong = packet; } catch {}
        }
        if (pong && Number.isFinite(pong.at) && !driver.reconnecting && !driver.handingOver
            && !driver.displaced && !driver.noticed) {
          owner.lastPongRequest = Math.max(owner.lastPongRequest, pong.at);
          if (owner.waitingSince !== null && pong.at < owner.waitingSince) return result;
          owner.waitingSince = null;
          owner.lastPong = owner.lastInbound;
          owner.healthySince ??= owner.lastInbound;
          if (!owner.nativeReconnectStarted && owner.attempts === 0) {
            owner.downSince = null;
            owner.downSinceWall = null;
          }
        }
      }
      return result;
    };
    owner.statusHook = function (...args) {
      const result = owner.originalStatus.apply(this, args);
      if (state === owner && this === driver && eligible(scene)
          && args[0] === "Mất kết nối · đang kết nối lại…") {
        owner.nativeReconnectStarted = true;
        owner.freshEpisode = false;
        owner.confirmed = false;
        owner.successVerified = false;
        owner.successCheck = 0;
      }
      // The game emits this only after the server accepted resume.
      if (state === owner && this === driver && eligible(scene) && scene.driver === driver
          && owner.nativeReconnectStarted && recoveryAuthorized(owner)
          && !driver.displaced && !driver.noticed && args[0] === "Đã kết nối lại") {
        owner.confirmed = true;
        owner.successVerified = !profileContext?.managed;
        owner.successCheck = 0;
        owner.checkRequestedAt = 0;
        owner.verificationStartedAt = performance.now();
        owner.verificationTimedOut = false;
        recoveryEvent(owner, "verification_pending");
      }
      return result;
    };
    try {
      driver.receive = owner.receiveHook;
      driver.onStatus = owner.statusHook;
      if (driver.receive !== owner.receiveHook || driver.onStatus !== owner.statusHook)
        throw new Error("Driver callbacks unavailable");
      state = owner;
      return owner;
    } catch {
      try {
        if (driver.receive === owner.receiveHook) {
          if (owner.receiveDescriptor) Object.defineProperty(driver, "receive", owner.receiveDescriptor);
          else delete driver.receive;
        }
        if (driver.onStatus === owner.statusHook) driver.onStatus = owner.originalStatus;
      } catch { /* Preserve the game's callbacks if the bridge is unsupported. */ }
      return null;
    }
  }
  function restoreGameUI(owner) {
    const scene = owner.scene;
    // Do not hide a rejection or fabricate a connection. Only a confirmed
    // native "resumed" status with an open transport authorizes restoration.
    const lost = document.getElementById("lost");
    const button = lost?.querySelector("button");
    if (lost && button?.textContent?.trim() === "Kết nối lại"
        && /Mất kết nối/.test(lost.textContent ?? "")) lost.remove();
    const chat = scene.chat;
    if (chat?.connected !== false || !(chat.root instanceof HTMLElement)
        || chat.root.id !== "chat" || !chat.root.isConnected) return;
    const label = chat.root.querySelector(".connection");
    const send = chat.root.querySelector("button.send");
    if (!(label instanceof HTMLElement) || !(send instanceof HTMLButtonElement)
        || !(chat.feedback instanceof HTMLElement)) return;
    chat.connected = true;
    label.textContent = "Trực tuyến";
    chat.feedback.textContent = "";
    send.disabled = false;
  }
  function recoverableNetworkNotice() {
    // The native retry loop emits this exact network error after exhaustion.
    // Native reconnect failure bypasses receive() and directly invokes onMessage(),
    // leaving driver.noticed unset (false). Check the error panel, button,
    // and driver non-displaced/non-closing state directly.
    const scene = sceneNow();
    const driver = scene?.driver;
    if (!driver || driver.displaced || driver.closing) return false;
    const panel = document.getElementById("lost");
    const button = panel?.querySelector("button");
    return panel?.firstChild?.nodeType === Node.TEXT_NODE
      && panel.firstChild.textContent?.trim() === "Mất kết nối máy chủ"
      && panel.getClientRects?.().length > 0 && button?.getClientRects?.().length > 0
      && button.textContent?.trim() === "Kết nối lại";
  }
  function recoveryEvent(owner, event) {
    try { globalThis.GSTBackgroundDiagnostics?.record?.("recovery", owner?.scene, null, { recoveryEvent: event }); } catch {}
  }
  function reloadTransition(owner, event) {
    if (owner.reloadState === event) return;
    owner.reloadState = event;
    recoveryEvent(owner, event);
  }
  function recoveryAuthorized(owner) {
    if (!owner || owner.recoveryRevoked || state !== owner || !eligible(owner.scene)
        || owner.scene.driver !== owner.driver || !owner.scopeKey
        || reloadScope(owner.scene) !== owner.scopeKey
        || owner.driver.displaced || owner.driver.noticed) return false;
    if (!profileContext?.managed) return true;
    const id = nativeIdentity(owner.scene);
    return !!owner.recoveryIdentity
      && owner.recoveryIdentity.scopeKey === owner.scopeKey
      && owner.recoveryIdentity.characterId === id.characterId;
  }
  function revokeRecovery(owner, permanent = false) {
    if (!owner) return;
    if (!owner.recoveryRevoked) recoveryEvent(owner, "authorization_revoked");
    if (permanent) owner.switchLocked = true;
    if (owner.recoveryIdentity) owner.revokedIdentity = owner.recoveryIdentity;
    owner.recoveryIdentity = null;
    owner.recoveryRevoked = true;
    owner.confirmed = false;
    owner.successVerified = false;
    owner.successCheck = 0;
    owner.reauthCheck = 0;
  }
  function retry(owner, now, staleOpen) {
    const { driver } = owner;
    if (state !== owner || !eligible(owner.scene) || owner.scene.driver !== driver
        || !recoveryAuthorized(owner)
        || !preferencesReady || !preferences.autoReconnect || owner.pending || owner.confirmed || owner.attempts >= retryDelays.length
        || driver.displaced || driver.noticed
        || driver.reconnecting || driver.handingOver || navigator.onLine === false
        || typeof driver.reconnect !== "function") return;
    // Do not compete with a native reconnect that has not yet had time to start.
    const since = owner.attempts === 0
      ? (staleOpen ? owner.waitingSince : owner.downSince) : owner.lastAttempt;
    const delay = owner.attempts === 0 && staleOpen ? replyTimeout : retryDelays[owner.attempts];
    if (since === null || now - since < delay) return;
    owner.pending = true;
    owner.attempts++;
    owner.lastAttempt = now;
    const scopeKey = reloadScope(owner.scene);
    if (scopeKey) {
      const wallNow = Date.now();
      const record = recordFor(scopeKey, wallNow, owner.downSinceWall ?? wallNow);
      if (record) { record.extensionAttempts++; saveRecord(record); }
    }
    try {
      Promise.resolve(driver.reconnect("Mất phản hồi đường truyền")).catch(() => {
        // Server responses and the game's native error UI remain authoritative.
      }).finally(() => { if (state === owner) owner.pending = false; });
    } catch { owner.pending = false; }
  }
  function manageReload(owner, now) {
    const { driver } = owner;
    const scopeKey = reloadScope(owner.scene);
    if (scopeKey !== activeScopeKey) {
      const oldRecord = activeScopeKey ? readRecords()[activeScopeKey] : null;
      if (oldRecord?.countdownStartedAt) { oldRecord.countdownStartedAt = 0; saveRecord(oldRecord); }
      stopReloadCountdown();
      hideReloadBanner();
      activeScopeKey = scopeKey ?? "";
    }
    if (!scopeKey || !preferencesReady || !preferences.autoReload) return;
    if (!recoverableNetworkNotice()) {
      const current = readRecords()[scopeKey];
      if (current?.countdownStartedAt) { current.countdownStartedAt = 0; if (!saveRecord(current)) memoryCanceled.add(scopeKey); }
      stopReloadCountdown();
      hideReloadBanner();
      return;
    }
    const wallNow = Date.now();
    const record = recordFor(scopeKey, wallNow, owner.downSinceWall ?? wallNow);
    if (!record) {
      showReloadBanner("Không lưu được giới hạn an toàn trong tab; extension sẽ không tự tải lại.");
      return;
    }
    const reloadWindowMs = preferences.reloadWindowMinutes * 60 * 1000;
    const retainedReloads = record.reloads.filter((at) => Number.isFinite(at) && wallNow - at < reloadWindowMs);
    if (retainedReloads.length !== record.reloads.length) {
      record.reloads = retainedReloads;
      if (!saveRecord(record)) {
        showReloadBanner("Không lưu được giới hạn an toàn trong tab; extension sẽ không tự tải lại.");
        return;
      }
    }
    // Stop a running countdown on every safety block, including a native
    // success awaiting verification. An open but unverified session is ambiguous.
    const blocked = state !== owner || !eligible(owner.scene) || owner.scene.driver !== driver
      || !recoveryAuthorized(owner) || driver.noticed || driver.closing || driver.displaced
      || navigator.onLine === false || owner.pending || driver.reconnecting || driver.handingOver
      || owner.confirmed || (owner.lastPong !== null && owner.downSince !== null
        && owner.lastPong > owner.downSince && now - owner.lastPong < replyTimeout)
      || new URLSearchParams(location.search).has("gstAttempt");
    if (blocked) {
      if (record.countdownStartedAt) {
        record.countdownStartedAt = 0;
        if (!saveRecord(record)) memoryCanceled.add(scopeKey);
        reloadTransition(owner, "countdown_canceled");
      }
      stopReloadCountdown();
      hideReloadBanner();
      if (owner.confirmed) reloadTransition(owner, owner.verificationTimedOut ? "verification_timeout" : "verification_pending");
      else reloadTransition(owner, "reload_blocked");
      return;
    }
    if (record.canceled || memoryCanceled.has(scopeKey)) {
      hideReloadBanner();
      return;
    }
    if (!owner.nativeReconnectStarted
        || preferences.autoReconnect && (typeof driver.reconnect !== "function"
          || owner.attempts < retryDelays.length || record.extensionAttempts < retryDelays.length)) {
      reloadTransition(owner, "reload_blocked");
      return;
    }
    if (wallNow - record.startedAt < preferences.reloadDelaySeconds * 1000) return;
    if (record.reloads.length >= preferences.reloadLimit) {
      reloadTransition(owner, "reload_limit");
      showReloadBanner(`Đã đạt giới hạn ${preferences.reloadLimit} lần tải lại trong ${preferences.reloadWindowMinutes} phút. Hãy kiểm tra kết nối thủ công.`);
      return;
    }
    if (!record.countdownStartedAt) {
      record.countdownStartedAt = wallNow;
      if (!saveRecord(record)) {
        showReloadBanner("Không lưu được đếm ngược an toàn; extension sẽ không tự tải lại.");
        return;
      }
      reloadTransition(owner, "countdown_started");
    }
    const due = record.countdownStartedAt + preferences.reloadCountdownSeconds * 1000;
    const remaining = Math.max(0, Math.ceil((due - wallNow) / 1000));
    showReloadBanner(`Kết nối vẫn lỗi; trang sẽ tải lại sau ${remaining} giây.`, () => {
      const latestScope = reloadScope(owner.scene);
      if (latestScope !== scopeKey) { stopReloadCountdown(); hideReloadBanner(); return; }
      cancelCurrentOutage(scopeKey);
      reloadTransition(owner, "countdown_canceled");
    });
    if (reloadTimer !== null || remaining > 0) {
      if (reloadTimer === null) reloadTimer = setTimeout(() => { reloadTimer = null; }, remaining * 1000);
      return;
    }
    const latestScope = reloadScope(owner.scene);
    const latest = readRecords()[scopeKey];
    if (state !== owner || !eligible(owner.scene) || owner.scene.driver !== driver
        || latestScope !== scopeKey || !recoveryAuthorized(owner)
        || !preferencesReady || !preferences.autoReload || !recoverableNetworkNotice()
        || navigator.onLine === false || owner.pending || owner.confirmed || driver.reconnecting || driver.handingOver
        || (owner.lastPong !== null && owner.downSince !== null && owner.lastPong > owner.downSince
          && performance.now() - owner.lastPong < replyTimeout)
        || driver.noticed || driver.closing || driver.displaced || new URLSearchParams(location.search).has("gstAttempt")
        || !owner.nativeReconnectStarted || preferences.autoReconnect
          && (typeof driver.reconnect !== "function" || owner.attempts < retryDelays.length
            || (latest?.extensionAttempts ?? 0) < retryDelays.length)
        || !latest || latest.scopeKey !== scopeKey || latest.canceled || memoryCanceled.has(scopeKey)
        || latest.countdownStartedAt !== record.countdownStartedAt
        || !Array.isArray(latest.reloads)
        || latest.reloads.filter((at) => Number.isFinite(at) && wallNow - at < reloadWindowMs).length >= preferences.reloadLimit) return;
    latest.reloads.push(wallNow);
    latest.countdownStartedAt = 0;
    if (!saveRecord(latest)) {
      showReloadBanner("Không lưu được giới hạn an toàn trong tab; extension sẽ không tự tải lại.");
      return;
    }
    stopReloadCountdown();
    reloadTransition(owner, "reload_executed");
    location.reload();
  }
  function observedFailureStatus(owner) {
    if (!owner) return "";
    const { driver } = owner;
    if (owner.confirmed && !owner.successVerified && profileContext?.managed)
      return owner.verificationTimedOut
        ? "Mạng: chưa xác minh được kết nối đã khôi phục; cần kiểm tra thủ công."
        : "Mạng: game báo đã kết nối lại; đang xác minh tài khoản.";
    if (owner.recoveryRevoked)
      return "Mạng: quyền khôi phục đang bị khóa; cần xác minh lại tài khoản khi kết nối an toàn.";
    if (recoverableNetworkNotice()) {
      if (driver.displaced)
        return "Mạng: trạng thái phiên đang mơ hồ; extension tạm dừng hành động tự động để tránh tải lại nhầm.";
      const scopeKey = reloadScope(owner.scene);
      if (!preferencesReady) return "Mạng: lỗi kết nối đã được game xác nhận; đang đọc cài đặt.";
      const record = scopeKey ? readRecords()[scopeKey] : null;
      if (record?.canceled || memoryCanceled.has(scopeKey))
        return "Mạng: tự tải lại đã bị hủy cho lần mất kết nối này.";
      if (preferences.autoReload && !scopeKey)
        return "Mạng: tự tải lại đang chờ xác nhận nhân vật/tab; không đủ identity an toàn.";
      if (preferences.autoReload && navigator.onLine === false)
        return "Mạng: trình duyệt đang offline; chờ kết nối trước khi tự tải lại.";
      if (preferences.autoReload && !driver.reconnecting && !driver.handingOver && !owner.pending) {
        const reloadWindowMs = preferences.reloadWindowMinutes * 60 * 1000;
        if (record?.reloads?.filter((at) => Date.now() - at < reloadWindowMs).length >= preferences.reloadLimit)
          return `Mạng: đã đạt giới hạn ${preferences.reloadLimit} lần trong ${preferences.reloadWindowMinutes} phút; cần kiểm tra thủ công.`;
        if (!owner.nativeReconnectStarted)
          return "Mạng: đang chờ xác nhận kết quả lần thử reconnect gốc của game.";
        if (preferences.autoReconnect && (record?.extensionAttempts ?? 0) < retryDelays.length)
          return "Mạng: game báo mất kết nối; đang chờ các lần thử bổ sung kết thúc.";
        if (preferences.autoReload)
          return `Mạng: chờ ${preferences.reloadDelaySeconds} giây, sau đó đếm ngược ${preferences.reloadCountdownSeconds} giây.`;
      }
      if (!preferences.autoReconnect && !preferences.autoReload)
        return "Mạng: hỗ trợ reconnect của extension đang tắt; dùng nút Kết nối lại của game nếu cần.";
      return "Mạng: game báo mất kết nối; đang chờ hoặc thử kết nối lại.";
    }
    if (driver.noticed)
      return "Mạng: game đã phát lỗi phiên/kết nối khác; extension đã dừng thử tự động.";
    if (driver.displaced)
      return "Mạng: game đánh dấu phiên cần kiểm tra; nguyên nhân chưa xác định nên extension đã dừng tự động.";
    if (owner.downSince !== null) return "Mạng: mất phản hồi; đang theo dõi kết nối.";
    return "";
  }
  function retryReasonFor(owner, now) {
    if (!preferencesReady || !preferences.autoReconnect) return "disabled";
    const driver = owner.driver;
    if (driver.displaced || driver.noticed || driver.closing) return "blocked_session";
    if (navigator.onLine === false) return "blocked_offline";
    if (!recoveryAuthorized(owner)) return "blocked_identity";
    if (typeof driver.reconnect !== "function") return "blocked";
    if (owner.pending) return "attempt_started";
    if (owner.confirmed && profileContext?.managed && !owner.successVerified) return "waiting";
    if (driver.reconnecting || driver.handingOver) return "native_in_progress";
    if (owner.confirmed === true && (!profileContext?.managed || owner.successVerified) && driver.link?.open?.() === true
        && !driver.reconnecting && !driver.handingOver && !driver.displaced)
      return "completed";
    if (owner.attempts >= retryDelays.length) return "exhausted";
    if (owner.waitingSince !== null) {
      if (now - owner.waitingSince < replyTimeout) return "waiting";
      return "pending";
    }
    if (owner.attempts > 0 && now - owner.lastAttempt < retryDelays[owner.attempts])
      return "pending";
    if (owner.downSince !== null || !driver.link?.open?.()) {
      if (recoverableNetworkNotice() && owner.attempts === 0 && owner.nativeReconnectStarted)
        return "failed";
      return "pending";
    }
    if (recoverableNetworkNotice()) return "failed";
    return "idle";
  }
  function watch() {
    if (suspended) return;
    const scene = sceneNow();
    if (!eligible(scene)) {
      try { globalThis.GSTBackgroundDiagnostics?.recovery?.({ scene, driver: scene?.driver,
        eligible: false, lastInbound: state?.scene === scene ? state.diagnosticLastInbound : null,
        recoveryComplete: false, retryReason: "blocked",
        attempts: 0, waitingMs: null, downMs: null }); } catch {}
      detach(); return;
    }
    const owner = attach(scene);
    if (!owner) return;
    const { driver } = owner, now = performance.now();
    const scopeKey = reloadScope(scene);
    if (!owner.scopeKey && scopeKey) {
      owner.scopeKey = scopeKey;
      const record = readRecords()[scopeKey];
      if (record?.startedAt > 0 && Number.isSafeInteger(record.extensionAttempts)) {
        owner.freshEpisode = true;
        owner.attempts = Math.max(0, Math.min(retryDelays.length, record.extensionAttempts));
        if (owner.attempts) owner.lastAttempt = now;
      }
    }
    // Bind authorization only to a currently verified, connected managed session.
    if (owner.scopeKey && profileContext?.managed && profileContext.verified
        && !owner.recoveryIdentity && !owner.recoveryRevoked
        && !driver.reconnecting && !driver.handingOver && !driver.displaced && !driver.noticed) {
      let open = false;
      try { open = driver.link.open() === true; } catch {}
      const id = nativeIdentity(scene);
      if (open && scopeKey === owner.scopeKey && id.characterId)
        owner.recoveryIdentity = { scopeKey, characterId: id.characterId };
    }
    if ((owner.recoveryIdentity && (!scopeKey || scopeKey !== owner.recoveryIdentity.scopeKey
        || nativeIdentity(scene).characterId !== owner.recoveryIdentity.characterId))
        || driver.displaced || driver.noticed) revokeRecovery(owner, true);
    // After a relevant configuration change, require a fresh connected identity
    // check before restoring authorization. Account switching remains locked.
    if (owner.recoveryRevoked && owner.revokedIdentity && !owner.switchLocked && profileContext?.managed
        && profileContext.verified && scopeKey === owner.scopeKey
        && !driver.displaced && !driver.noticed && !driver.reconnecting && !driver.handingOver
        && now - owner.reauthRequestedAt >= 5000) {
      let open = false;
      try { open = driver.link.open() === true; } catch {}
      if (open && navigator.onLine !== false) {
        owner.reauthCheck = ++recoveryCheckId;
        owner.reauthRequestedAt = now;
        window.postMessage({ channel: "gst:account-profile:v1", type: "recovery-check",
          requestId: owner.reauthCheck }, location.origin);
      }
    }
    // A long scheduler gap can be browser suspension, not a network failure.
    if (now - owner.lastWatch > 5000 && !driver.reconnecting && !driver.handingOver) {
      owner.waitingSince = null;
      owner.minimumPingAt = now;
      if (owner.downSince !== null) owner.downSince = now;
    }
    owner.lastWatch = now;
    if (owner.confirmed && profileContext?.managed && !owner.successVerified
        && !owner.verificationTimedOut && now - owner.verificationStartedAt >= verificationTimeout) {
      owner.verificationTimedOut = true;
      recoveryEvent(owner, "verification_timeout");
    }
    if (owner.confirmed && profileContext?.managed && !owner.successVerified
        && !owner.verificationTimedOut && now - owner.checkRequestedAt >= 5000 && recoveryAuthorized(owner)) {
      owner.successCheck = ++recoveryCheckId;
      owner.checkRequestedAt = now;
      window.postMessage({ channel: "gst:account-profile:v1", type: "recovery-check",
        requestId: owner.successCheck }, location.origin);
    }
    const retryReason = retryReasonFor(owner, now);
    try { globalThis.GSTBackgroundDiagnostics?.recovery?.({ scene, driver, eligible: true,
      lastInbound: owner.diagnosticLastInbound,
      recoveryComplete: navigator.onLine !== false && owner.confirmed === true && driver.link.open() === true
        && !driver.reconnecting && !driver.handingOver && recoveryAuthorized(owner)
        && (!profileContext?.managed || (profileContext.verified && owner.successVerified)),
      retryReason,
      attempts: Number.isSafeInteger(owner.attempts) ? owner.attempts : 0,
      waitingMs: owner.waitingSince !== null ? Math.max(0, now - owner.waitingSince) : null,
      downMs: owner.downSince !== null ? Math.max(0, now - owner.downSince) : null }); } catch {}
    let open;
    try { open = driver.link.open() === true; } catch { return; }
    const stable = open && !driver.reconnecting && !driver.handingOver;

    if (owner.confirmed && (!stable || !recoveryAuthorized(owner))) owner.confirmed = false;
    if (stable && navigator.onLine !== false && owner.confirmed && recoveryAuthorized(owner)
        && (!profileContext?.managed || (profileContext.verified && owner.successVerified))) {
      owner.confirmed = false;
      recoveryEvent(owner, "recovery_confirmed");
      owner.attempts = 0;
      owner.freshEpisode = false;
      owner.lastAttempt = -Infinity;
      owner.nativeReconnectStarted = false;
      owner.waitingSince = null;
      owner.minimumPingAt = now;
      owner.downSince = null;
      owner.downSinceWall = null;
      owner.healthySince = now;
      clearRecord(reloadScope(scene));
      stopReloadCountdown();
      hideReloadBanner();
      restoreGameUI(owner);
    }
    if (!stable) {
      owner.healthySince = null;
      if (owner.downSince === null) {
        owner.downSince = now;
        owner.downSinceWall = Date.now();
      }
      if (!open) retry(owner, now, false);
      manageReload(owner, now);
      return;
    }

    // Native retries can fail while the old transport still reports open.
    // The exact native network notice plus the observed native retry permits
    // the existing bounded retry path; other notices remain manual-only.
    if (owner.nativeReconnectStarted && recoverableNetworkNotice()
        && !driver.noticed && !driver.displaced) {
      if (owner.downSince === null) {
        owner.downSince = now;
        owner.downSinceWall = Date.now();
      }
      retry(owner, now, false);
      manageReload(owner, now);
      return;
    }

    // The game may stop updating when idle, even if neither automation is ON.
    // Advance only the original network tick, never movement or gameplay.
    if (navigator.onLine !== false && !driver.displaced && !driver.closing && !owner.pending
        && typeof driver.update === "function") {
      const lastTick = Number.isFinite(driver.tickAt) ? driver.tickAt : 0;
      if (now - lastTick >= 1700) {
        try { driver.update(); } catch { /* Leave gameplay in control. */ }
      }
    }

    // Native update resets waitingSince after >2s between ticks. Track the
    // first unanswered ping ourselves, using actual inbound server messages.
    if (Number.isFinite(driver.pingAt) && driver.pingAt > Math.max(owner.lastPongRequest, owner.minimumPingAt)
        && owner.waitingSince === null) owner.waitingSince = driver.pingAt;
    if (owner.waitingSince !== null && now - owner.waitingSince >= replyTimeout) {
      if (owner.downSince === null) {
        owner.downSince = owner.waitingSince;
        owner.downSinceWall = Date.now() - Math.max(0, now - owner.waitingSince);
      }
      owner.healthySince = null;
      retry(owner, now, true);
      manageReload(owner, now);
      return;
    }
    // A newly attached, already joined driver plus sustained native pong
    // responses confirms an operational session after a prior page reload.
    if (owner.freshEpisode && !owner.nativeReconnectStarted && owner.scopeKey
        && scopeKey === owner.scopeKey && (!profileContext?.managed || profileContext.verified)
        && owner.healthySince !== null
        && now - owner.healthySince >= 10000 && owner.lastPong !== null && now - owner.lastPong < 3000
        && !driver.noticed && !driver.displaced && !recoverableNetworkNotice()) {
      owner.attempts = 0;
      owner.lastAttempt = -Infinity;
      owner.freshEpisode = false;
      clearRecord(scopeKey);
      stopReloadCountdown();
      hideReloadBanner();
    }
    manageReload(owner, now);
  }
  // Exactly one scheduler invokes watch: the interval stays active until a
  // hidden-tab worker confirms it is ready, and is restored on any failure.
  let schedulerWorker = null, workerUrl = null, workerFailed = false;
  function stopWorker() {
    const current = schedulerWorker;
    schedulerWorker = null;
    if (current) current.terminate();
    if (workerUrl) { URL.revokeObjectURL(workerUrl); workerUrl = null; }
  }
  function ensureInterval() {
    if (!suspended && timer === null) timer = setInterval(watch, 1000);
  }
  function syncScheduler() {
    if (suspended) return;
    if (!document.hidden) {
      stopWorker();
      workerFailed = false;
      ensureInterval();
      return;
    }
    if (schedulerWorker) return;
    ensureInterval();
    if (workerFailed) return;
    try {
      workerUrl = URL.createObjectURL(new Blob([
        'postMessage("ready");setInterval(()=>postMessage("tick"),1000)'
      ], { type: "text/javascript" }));
      const current = new Worker(workerUrl);
      schedulerWorker = current;
      current.onmessage = (event) => {
        if (schedulerWorker !== current || suspended || !document.hidden) return;
        if (event.data === "ready") {
          if (workerUrl) { URL.revokeObjectURL(workerUrl); workerUrl = null; }
          clearInterval(timer); timer = null;
        } else if (event.data === "tick" && timer === null) watch();
      };
      current.onerror = current.onmessageerror = () => {
        if (schedulerWorker !== current) return;
        workerFailed = true;
        stopWorker();
        ensureInterval();
      };
    } catch {
      workerFailed = true;
      stopWorker();
      ensureInterval();
    }
  }
  function start() {
    if (suspended) return;
    syncScheduler();
    watch();
  }
  globalThis.GSTConnectionRecovery = {
    status(scene) {
      if (!state || state.scene !== scene) return "";
      const { driver } = state;
      let open = false;
      try { open = driver.link.open() === true && !driver.reconnecting && !driver.handingOver; }
      catch { /* Report the last known state. */ }
      if (open && !state.confirmed && state.healthySince !== null && performance.now() - state.lastInbound < 10000
          && !recoverableNetworkNotice() && !driver.noticed && !driver.displaced) return "";
      const failure = observedFailureStatus(state);
      if (failure) return failure;
      if (state.downSince === null) return "";
      if (state.attempts >= retryDelays.length && !state.pending && !driver.reconnecting)
        return "Mạng: hết lượt thử; hãy kiểm tra kết nối thủ công.";
      return state.pending || driver.reconnecting
        ? "Mạng: đang thử kết nối lại." : "Mạng: mất phản hồi; đang theo dõi và sẽ thử lại.";
    }
  };
  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== location.origin) return;
    if (event.data?.channel === "gst:account-status:v1" && event.data.type === "invalidate-recovery") {
      revokeRecovery(state);
      return;
    }
    if (event.data?.channel === "gst:account:v1" && event.data.type === "stop-for-switch") {
      revokeRecovery(state, true);
      return;
    }
    if (event.data?.channel !== "gst:account-profile:v1") return;
    if (event.data.type === "recovery-check-result") {
      const owner = state, result = event.data;
      const id = nativeIdentity(owner?.scene);
      if (owner?.reauthCheck && owner.reauthCheck === result.requestId && owner.recoveryRevoked
          && !owner.switchLocked && eligible(owner.scene) && owner.scene.driver === owner.driver
          && !owner.driver.displaced && !owner.driver.noticed && !owner.driver.reconnecting && !owner.driver.handingOver
          && navigator.onLine !== false && profileContext?.verified
          && owner.scopeKey && reloadScope(owner.scene) === owner.scopeKey
          && owner.revokedIdentity?.scopeKey === owner.scopeKey
          && owner.revokedIdentity?.characterId === id.characterId
          && result.verified === true && result.accountId === profileContext.accountId
          && result.slot === profileContext.slot && result.character === id.character
          && result.classId === id.classId && result.characterId === id.characterId && id.characterId) {
        let open = false;
        try { open = owner.driver.link.open() === true; } catch {}
        if (open) {
          owner.recoveryIdentity = { scopeKey: owner.scopeKey, characterId: id.characterId };
          owner.recoveryRevoked = false;
          owner.revokedIdentity = null;
          owner.reauthCheck = 0;
          recoveryEvent(owner, "authorization_restored");
        }
      }
      if (owner?.confirmed && owner.successCheck === result.requestId && recoveryAuthorized(owner)
          && result.verified === true && result.accountId === profileContext?.accountId
          && result.slot === profileContext?.slot
          && result.character === nativeIdentity(owner.scene).character
          && result.classId === nativeIdentity(owner.scene).classId
          && result.characterId === nativeIdentity(owner.scene).characterId)
        owner.successVerified = true;
      return;
    }
    if (event.data.type === "profile") applyProfileMessage(event.data);
  });
  window.postMessage({ channel: "gst:account-profile:v1", type: "ready" }, location.origin);
  window.addEventListener("online", () => { if (!suspended) watch(); });
  document.addEventListener("visibilitychange", () => { syncScheduler(); });
  window.addEventListener("pagehide", () => {
    suspended = true;
    clearInterval(timer); timer = null; stopWorker(); detach();
  });
  window.addEventListener("pageshow", () => { suspended = false; workerFailed = false; start(); });
  start();
})();
