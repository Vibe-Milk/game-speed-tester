(() => {
  "use strict";
  const origin = "https://nghichthienky.online";
  const channel = "gst:farm:v1";
  globalThis.GSTFarmConfigurationReady = false;
  let settings = { policyMode: "tool", customComparisonEnabled: false, enabled: false, radius: 22, autoRespawn: true, targetMode: "all", targetLevel: 1, targetMinLevel: 1, targetMaxLevel: 20,
    searchScope: "radius", idleMode: "hold", preferLoot: true, excludeBoss: false, bossFilter: "all",
    identityVerified: false, accountProfileKey: "", accountId: "", acceptPartyInvites: false, allowPlayerTargets: false,
    bossDodge: true, eliteDodge: false, bossRetreat: true, retreatHpPercent: 40, recoveryHpPercent: 100 };
  let identityBlocked = false;
  let filterBinding = null;
  let excludedBossChange = null;
  let death = null;
  let respawnMessage = "";
  let watcher = null;
  let respawnWatcher = null;
  let session = null;
  let blockedAuto = null;
  let revival = null;
  let suspended = false;
  let shortcut = null;
  let shortcutMessage = "";
  let message = "Chưa nhận được cấu hình Auto Farm từ extension.";
  let configurationError = "";
  let configurationReceived = false;
  let configuredPolicyMode = null;
  let activationLock = null;
  let activationWatcher = null;
  let lastTrustedInputAt = -Infinity;
  let gestureGeneration = 0, generationAt = 0, shortcutIntent = null;
  const farmGestures = new WeakMap();
  function invalidateFarmGestures() { gestureGeneration++; generationAt = performance.now(); shortcutIntent = null; }
  function farmButton(target) { return target instanceof Element ? target.closest('[data-entry="auto"], [data-key="V"]') : null; }
  function rememberFarmGesture(event) {
    if (settings.policyMode !== "tool" || suspended || !event.isTrusted || document.hidden || event.repeat
        || event.type === "keydown" && !["Enter", " "].includes(event.key)) return;
    const button = farmButton(event.target), scene = sceneNow();
    if (!button || !scene?.auto || event.timeStamp < generationAt) return;
    farmGestures.set(button, { generation: gestureGeneration, scene, auto: scene.auto,
      kind: event.type === "keydown" ? "keyboard" : "pointer", pointerId: event.pointerId, startedAt: event.timeStamp });
  }
  function validFarmGesture(event, scene, consume = false) {
    const button = farmButton(event?.target), gesture = button && farmGestures.get(button);
    if (consume && button) farmGestures.delete(button);
    return !!gesture && event.isTrusted === true && event.type === "click" && !document.hidden
      && gesture.generation === gestureGeneration && gesture.scene === scene && gesture.auto === scene?.auto
      && event.timeStamp >= gesture.startedAt && event.timeStamp >= generationAt
      && (event.detail === 0 ? gesture.kind === "keyboard" : gesture.kind === "pointer"
        && (event.pointerId == null || gesture.pointerId == null || event.pointerId === gesture.pointerId));
  }
  window.addEventListener("pointerdown", rememberFarmGesture, true);
  window.addEventListener("keydown", rememberFarmGesture, true);
  const noteTrustedInput = (event) => {
    if (event.isTrusted && !event.repeat && !document.hidden) {
      lastTrustedInputAt = performance.now();
      const farmKey = event.type === "keydown" && (event.keyCode === (sceneNow()?.controls?.bindings?.V ?? 86)
        || event.keyCode === shortcut);
      const editing = event.target instanceof Element
        && event.target.closest('input,textarea,select,[contenteditable=true],#gst-game-menu');
      const manualKey = event.type === "keydown" && /^(Key[WASDQ]|Arrow(Up|Down|Left|Right)|Space|Digit[1-6])$/.test(event.code);
      const manualPointer = event.type === "pointerdown" && event.target instanceof Element
        && event.target.closest('canvas,[data-key]');
      if (!editing && !farmKey && !farmButton(event.target) && (manualKey || manualPointer)) {
        globalThis.GSTFarmUpdate?.manualActions?.(sceneNow());
        globalThis.GSTToolFarm?.manual?.(sceneNow());
      }
    }
  };
  window.addEventListener("pointerdown", noteTrustedInput, true);
  window.addEventListener("keydown", noteTrustedInput, true);
  const finite = (value) => typeof value === "number" && Number.isFinite(value);
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const nativeEligible = (enemy) => enemy?.hostile === true || enemy?.aggro === false;
  const nativeRadius = (scene) => globalThis.GSTFarmCompatibility?.nativeRadius(scene?.auto?.radius) ?? null;
  const nativeMapKey = (host) => {
    try { return typeof host?.mapKey === "function" ? host.mapKey() : null; }
    catch { return null; }
  };
  GSTHarvest.farmOrigin = (scene) => session?.scene === scene ? { ...session.home } : null;
  GSTHarvest.farmBoundary = (scene) => settings.policyMode === "extended" && settings.enabled
    && settings.searchScope === "radius" && session?.scene === scene
    ? { home: { ...session.home }, radius: settings.radius } : null;
  // Both features share the same once-per-death request state.
  GSTHarvest.respawn = (scene) => checkRespawn(scene);
  GSTHarvest.autoRespawnEnabled = () => settings.autoRespawn;
  const targetMode = (value) => value === "level" ? "maxLevel" : value === "bossFirst" ? "bossLevel"
    : ["maxLevel", "minLevel", "range", "boss", "bossLevel", "highLevel", "lowLevel"].includes(value) ? value : "all";
  const isBoss = (enemy) => globalThis.GSTFarmMonsterClassification
    ? globalThis.GSTFarmMonsterClassification.isBoss(enemy) === true
    : enemy?.cls === "boss" || enemy?.wb === true;
  const isWorldBoss = (enemy) => globalThis.GSTFarmMonsterClassification?.isWorldBoss?.(enemy) === true;
  const targetFilterActive = () => settings.targetMode !== "all" || settings.excludeBoss || settings.bossFilter === "world";
  const playerTargetGuardActive = () => settings.policyMode === "extended"
    && (identityBlocked || settings.identityVerified !== true || settings.allowPlayerTargets !== true);
  const ranked = () => ["bossLevel", "highLevel", "lowLevel"].includes(settings.targetMode);
  function comparePriority(a, b) {
    if (settings.targetMode === "bossLevel" && isBoss(a) !== isBoss(b)) return isBoss(a) ? -1 : 1;
    const descending = settings.targetMode !== "lowLevel";
    const left = finite(a?.lv) ? a.lv : descending ? -Infinity : Infinity;
    const right = finite(b?.lv) ? b.lv : descending ? -Infinity : Infinity;
    return left === right ? 0 : descending ? (left > right ? -1 : 1) : (left < right ? -1 : 1);
  }
  function switchReason(current, challenger, pos, elapsed) {
    if (!ranked() || !current || !challenger || comparePriority(challenger, current) >= 0) return "";
    if (settings.targetMode === "bossLevel" && isBoss(challenger) && !isBoss(current)) return "boss_priority";
    const gain = settings.targetMode === "lowLevel" ? current.lv - challenger.lv : challenger.lv - current.lv;
    // Allow a substantially better camp when it is nearby, but never turn
    // around for a distant respawn after already committing to a long trip.
    const challengerDistance = distance(challenger, pos);
    return finite(gain) && gain >= 4 && elapsed >= 2
      && challengerDistance <= 20 && challengerDistance <= distance(current, pos) + 3
      ? "level_priority" : "";
  }
  function realmBossEligible(scene) {
    if (settings.policyMode !== "extended") return true;
    // Realm encounter coordinates do not carry the source-confirmed world-boss marker.
    if (settings.bossFilter === "world") return false;
    if (settings.excludeBoss || ["highLevel", "lowLevel"].includes(settings.targetMode)) return false;
    const levelRequired = ["maxLevel", "minLevel", "range"].includes(settings.targetMode);
    if (!levelRequired) return true;
    // A boss hidden by the level filter is not a reason to block chest
    // collection. Unknown levels are not treated as confirmed eligible.
    const actors = [...(scene?.views?.values?.() ?? [])]
      .filter((actor) => actor?.k === "m" && !actor.dead && isBoss(actor.st)
        && finite(actor.st?.lv));
    const level = scene?.self?.realm?.inside?.boss?.lv;
    return actors.some((actor) => matchesTarget(actor.st))
      || (finite(level) && matchesTarget({ cls: "boss", lv: level }));
  }
  globalThis.GSTFarmPriority = { compare: (a, b) => (!["extended","custom"].includes(settings.policyMode)) ? 0 : comparePriority(a, b),
    ranked: () => ["extended","custom"].includes(settings.policyMode) && ranked(),
    switchReason: (...args) => (!["extended","custom"].includes(settings.policyMode)) ? "" : switchReason(...args),
    matches: (enemy) => !["extended","custom"].includes(settings.policyMode) || matchesTarget(enemy),
    excludesBoss: () => ["extended","custom"].includes(settings.policyMode) && (settings.excludeBoss || ["highLevel", "lowLevel"].includes(settings.targetMode)),
    realmBossEligible,
    bossFocus: (scene) => settings.policyMode === "extended" && ["boss", "bossLevel"].includes(settings.targetMode)
      && realmBossEligible(scene) };
  function filterLabel() {
    const subtype = settings.bossFilter === "world" ? " · Chỉ boss thế giới" : "";
    const labeled = (text) => `${text}${subtype}`;
    if (settings.targetMode === "bossLevel") return labeled("Ưu tiên boss, rồi quái tu vi cao đến thấp");
    if (settings.targetMode === "highLevel") return labeled("Ưu tiên quái thường tu vi cao đến thấp");
    if (settings.targetMode === "lowLevel") return labeled("Ưu tiên quái thường tu vi thấp đến cao");
    if (settings.targetMode === "boss") return labeled("Chỉ farm boss");
    if (settings.targetMode === "maxLevel") return labeled(`Chỉ farm ≤ ${globalThis.GSTFarmCompatibility?.describe(settings.targetLevel, "max") ?? "Mức đã lưu (giữ nguyên)"}`);
    if (settings.targetMode === "minLevel") return labeled(`Chỉ farm ≥ ${globalThis.GSTFarmCompatibility?.describe(settings.targetLevel, "min") ?? "Mức đã lưu (giữ nguyên)"}`);
    if (settings.targetMode === "range") return settings.targetMinLevel <= settings.targetMaxLevel
      ? labeled(`Chỉ farm trong khoảng ${globalThis.GSTFarmCompatibility?.describe(settings.targetMinLevel, "min") ?? "Mức đã lưu (giữ nguyên)"} đến ${globalThis.GSTFarmCompatibility?.describe(settings.targetMaxLevel, "max") ?? "Mức đã lưu (giữ nguyên)"}`)
      : "Khoảng cảnh giới chưa hợp lệ; không chọn quái";
    return labeled("Farm tất cả quái");
  }
  function matchesTarget(enemy) {
    if (!["extended", "custom"].includes(settings.policyMode)) return true;
    if (isBoss(enemy) && settings.bossFilter === "world" && !isWorldBoss(enemy)) return false;
    if ((settings.excludeBoss || settings.targetMode === "highLevel" || settings.targetMode === "lowLevel") && isBoss(enemy)) return false;
    if (settings.targetMode === "boss") return isBoss(enemy);
    if (["all", "bossLevel", "highLevel", "lowLevel"].includes(settings.targetMode)) return true;
    if (!finite(enemy?.lv)) return false;
    if (settings.targetMode === "range") return enemy.lv >= settings.targetMinLevel && enemy.lv <= settings.targetMaxLevel;
    return settings.targetMode === "maxLevel" ? enemy.lv <= settings.targetLevel : enemy.lv >= settings.targetLevel;
  }

  function sceneNow() {
    return window.game?.scene?.getScene?.("world")
      ?? (window.__ntkScene?.sys?.settings?.key === "world" ? window.__ntkScene : null);
  }

  const toolUnavailable = "Farm của tool: dùng nút/phím Farm để bắt đầu; di chuyển, đánh thường và kỹ năng theo thứ tự đã lưu.";
  function blockedFarmStart() {
    return !configurationReceived || identityBlocked || !["native", "tool"].includes(settings.policyMode)
      || settings.policyMode === "tool" && !globalThis.GSTToolFarm;
  }
  function blockedFarmMessage() {
    return identityBlocked ? "Auto Farm đang chờ xác nhận đúng tài khoản."
      : settings.policyMode === "disabled" ? "Khóa Auto Farm cũ đang được giữ; chọn controller để mở khóa."
      : toolUnavailable;
  }
  function foreignMovement(scene) {
    return globalThis.GSTFarmInput?.movement?.(scene) ||
      [globalThis.GSTHarvest, globalThis.GSTMapTravel, globalThis.GSTQuest,
        globalThis.GSTFarmBossSafety, globalThis.GSTFarmDefense, globalThis.GSTFarmSeals,
        globalThis.GSTRealm, globalThis.GSTChest]
      .some((owner) => { try { return owner?.controls?.(scene) === true; } catch { return true; } });
  }
  // Native toggle's OFF path only resets Farm state and calls steer/note. Avoid
  // scene.toggleAutoFarm here: it cancels manual click orders before toggling.
  function stopFarmOwner(scene) {
    globalThis.GSTToolFarm?.stop?.(scene);
    globalThis.GSTCustomFarm?.stop?.(scene);
    globalThis.GSTCustomFarm?.reset?.(scene);
    if (!scene?.auto) return;
    if (scene.auto.on && typeof scene.auto.toggle === "function") {
      const host = scene.autoHost?.();
      if (!host) throw new Error("Farm stop host unavailable");
      const token = globalThis.GSTIntentAuthority?.current?.();
      const stop = () => scene.auto.toggle(new Proxy(host, { get(target, key) {
        if (key === "steer" && (foreignMovement(scene) || !globalThis.GSTFarmUpdate?.movementOwned?.(scene))) return () => {};
        return Reflect.get(target, key);
      } }));
      if (token?.feature === "harvest") globalThis.GSTIntentAuthority.withIntent(token, stop);
      else stop();
    }
    if (!foreignMovement(scene)) globalThis.GSTFarmUpdate?.releaseActions?.(scene);
    else globalThis.GSTFarmUpdate?.forgetActions?.(scene);
    scene.syncAutoFarmButtons?.(); scene.bgSync?.();
  }
  function clearActivationLock() {
    const old = activationLock; activationLock = null;
    if (!old) return;
    globalThis.GSTToolFarm?.dispose?.(old.scene);
    if (old.auto.toggle === old.wrapper) {
      if (old.descriptor) Object.defineProperty(old.auto, "toggle", old.descriptor);
      else delete old.auto.toggle;
    }
    if (old.scene.toggleAutoFarm === old.sceneWrapper) {
      if (old.sceneDescriptor) Object.defineProperty(old.scene, "toggleAutoFarm", old.sceneDescriptor);
      else delete old.scene.toggleAutoFarm;
    }
    old.scene.events?.off?.("preupdate", maintainActivationLock);
    old.scene.events?.off?.("shutdown", clearActivationLock);
    old.scene.events?.off?.("destroy", clearActivationLock);
    old.removeUpdate?.();
  }
  function needsActivationTracking() { return !suspended; }
  function maintainActivationLock() {
    if (!needsActivationTracking()) { clearActivationLock(); return; }
    const scene = sceneNow();
    if (!scene?.sys?.isActive?.() || typeof scene.auto?.on !== "boolean"
        || typeof scene.auto?.toggle !== "function" || typeof scene.toggleAutoFarm !== "function") return;
    if (activationLock?.scene !== scene || activationLock.auto !== scene.auto
        || scene.auto.toggle !== activationLock.wrapper || scene.toggleAutoFarm !== activationLock.sceneWrapper) {
      const replacing = activationLock !== null;
      clearActivationLock();
      if (replacing) { globalThis.GSTIntentAuthority?.invalidate?.(); invalidateFarmGestures(); }
      if (globalThis.GSTFarmUpdate?.installGate?.(scene) !== true) {
        message = "Không bảo vệ được controller Farm; không cho bật Farm của tool.";
      }
      const owner = { scene, auto: scene.auto, original: scene.auto.toggle,
        descriptor: Object.getOwnPropertyDescriptor(scene.auto, "toggle"),
        sceneOriginal: scene.toggleAutoFarm,
        sceneDescriptor: Object.getOwnPropertyDescriptor(scene, "toggleAutoFarm"), removeUpdate: null };
      owner.run = function (...args) {
        if (activationLock !== owner || sceneNow() !== scene || scene.auto !== owner.auto || this !== owner.auto) return;
        const wasOn = this.on === true;
        const tool = settings.policyMode === "tool";
        if (tool && !wasOn) {
          const explicit = shortcutIntent?.generation === gestureGeneration && shortcutIntent.scene === scene
            && shortcutIntent.auto === this || validFarmGesture(window.event, scene, true);
          if (!explicit || blockedFarmStart() || !globalThis.GSTToolFarm?.prepare?.(scene, settings, { takeoverClick: true })) {
            message = globalThis.GSTToolFarm?.status?.(scene) || "Chưa bật Farm của tool: cần thao tác mới, đúng nick và game sẵn sàng."; return;
          }
        }
        if (wasOn) globalThis.GSTToolFarm?.stop?.(scene);
        if (!wasOn && blockedFarmStart()) { message = blockedFarmMessage(); return; }
        const movement = foreignMovement(scene) ? [scene.autoX, scene.autoY] : null;
        const thisAuto = this;
        const toggleArgs = tool ? [new Proxy(args[0], { get(host, property) {
          if (property === "note") return () => host.note(thisAuto.on
            ? "Farm của tool: bật · theo cấu hình đã lưu" : "Farm của tool: tắt");
          return Reflect.get(host, property);
        } })] : args;
        const result = owner.original.apply(this, toggleArgs);
        if (movement && scene.autoX === 0 && scene.autoY === 0) [scene.autoX, scene.autoY] = movement;
        if (this.on === wasOn) {
          message = "Thao tác bật/tắt Farm không đổi được trạng thái controller; hãy gửi log để kiểm tra.";
          shortcutMessage = message; return result;
        }
        const token = wasOn !== (this.on === true)
          ? globalThis.GSTIntentAuthority?.farmChanged?.(scene, this.on === true) : null;
        if (wasOn && !this.on) invalidateFarmGestures();
        if (!wasOn && this.on) {
          if (tool) {
            // Harvest configuration synchronously rechecks activation while
            // Farm is ON but has not yet finished starting. Protect only this
            // same-scene transition; identity and current intent still apply.
            let started = false;
            owner.starting = true;
            try {
              if (globalThis.GSTIntentAuthority?.validate?.(token, "farm", true, settings.accountProfileKey)) {
                globalThis.GSTHarvest?.coordinateFarmEnable?.(scene, token);
                if (activationLock === owner && sceneNow() === scene && scene.auto === owner.auto
                    && this.on && !globalThis.GSTHarvest?.needsFarmCoordination?.())
                  started = globalThis.GSTToolFarm?.start?.(scene, token) === true;
              }
            } catch { /* Roll back the native ON below. */ }
            finally { owner.starting = false; }
            if (!started) {
              if (activationLock === owner && sceneNow() === scene && scene.auto === owner.auto && this.on)
                owner.original.apply(this, args);
              if (globalThis.GSTIntentAuthority?.validate?.(token, "farm", true, settings.accountProfileKey))
                globalThis.GSTIntentAuthority?.farmChanged?.(scene, false);
              invalidateFarmGestures();
              message = "Chưa bật Farm: chưa bàn giao xong Thu hoạch hoặc không xác nhận được Farm."; return;
            }
          }
          globalThis.GSTMeditation?.farmStarted?.(scene);
          if (!tool && performance.now() - lastTrustedInputAt < 700)
            globalThis.GSTHarvest?.coordinateFarmEnable?.(scene, token);
        }
        return result;
      };
      owner.wrapper = function (...args) {
        const run = () => owner.run.apply(this, args);
        return globalThis.GSTFarmDiagnostics?.observeToggle
          ? globalThis.GSTFarmDiagnostics.observeToggle(scene, run) : run();
      };
      owner.sceneWrapper = function (...args) {
        if (activationLock !== owner || this !== scene || sceneNow() !== scene || scene.auto !== owner.auto) return;
        if (!owner.auto.on && (blockedFarmStart() || window.event && window.event.timeStamp < generationAt)) {
          message = blockedFarmMessage(); return;
        }
        if (settings.policyMode === "tool") {
          const result = owner.wrapper.call(owner.auto, scene.autoHost());
          scene.syncAutoFarmButtons?.(); scene.bgSync?.(); return result;
        }
        return owner.sceneOriginal.apply(this, args);
      };
      scene.auto.toggle = owner.wrapper;
      scene.toggleAutoFarm = owner.sceneWrapper;
      activationLock = owner;
      // Keep the shared dispatcher attached, including while Farm is OFF.
      // Independent feature callbacks keep their existing priorities.
      try {
        owner.removeUpdate = globalThis.GSTFarmUpdate.add(scene, 10000, () => false);
        scene.events.on("preupdate", maintainActivationLock);
        scene.events.on("shutdown", clearActivationLock);
        scene.events.on("destroy", clearActivationLock);
      } catch (error) { clearActivationLock(); throw error; }
    }
    if (scene.auto.on && (blockedFarmStart() || settings.policyMode === "tool"
        && !activationLock?.starting && !globalThis.GSTToolFarm?.active?.(scene))) stopFarmOwner(scene);
  }
  function syncActivationTracking() {
    if (needsActivationTracking()) {
      try { maintainActivationLock(); }
      catch { message = "Không bảo vệ được controller Farm; cần tải lại tab game."; }
      if (activationWatcher === null) activationWatcher = setInterval(() => {
        try { maintainActivationLock(); }
        catch { message = "Không bảo vệ được controller Farm; cần tải lại tab game."; }
      }, 500);
    } else {
      clearActivationLock();
      clearInterval(activationWatcher); activationWatcher = null;
    }
  }
  globalThis.GSTFarmActivation = Object.freeze({ sync: syncActivationTracking,
    stop(scene) { if (scene === sceneNow()) stopFarmOwner(scene); },
    controllerDisposed(scene) { if (scene && sceneNow() === scene) {
      globalThis.GSTIntentAuthority?.retireFarm?.(); invalidateFarmGestures();
    } } });
  syncActivationTracking();

  function ensureCustomReady(scene) {
    try {
      if (!scene?.auto || globalThis.GSTFarmUpdate?.installGate?.(scene) !== true) return false;
      globalThis.GSTCustomFarm?.configure?.(scene, settings);
      syncActivationTracking();
      return globalThis.GSTCustomFarm?.compatible?.(scene) === true;
    } catch { return false; }
  }
  window.addEventListener("click", (event) => {
    if (!farmButton(event.target)) return;
    const scene = sceneNow();
    if (settings.policyMode === "tool") {
      event.stopImmediatePropagation(); event.preventDefault();
      if (!scene?.auto?.on && !validFarmGesture(event, scene)) { message = "Thao tác Farm đã cũ; hãy bấm lại."; return; }
      scene?.toggleAutoFarm?.(); return;
    }
    if (!blockedFarmStart() || scene?.auto?.on === true) return;
    message = blockedFarmMessage(); event.stopImmediatePropagation(); event.preventDefault();
  }, true);

  function guardFarmKey(event) {
    const menuOpen = document.getElementById("gst-game-menu")?.dataset.open === "true";
    // Alt shortcuts (including configurable Harvest) belong to their own handlers.
    if (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) return;
    let code = 86;
    let scene = null;
    try {
      scene = sceneNow();
      const binding = scene?.controls?.bindings?.V;
      if (Number.isInteger(binding)) code = binding;
    } catch { /* The default V binding remains guarded while the scene loads. */ }
    // Let the game's focused key-binding capture validate and assign this key.
    // Background events still pass through the guard below.
    const captureActive = !!scene?.keyCapture && !document.hidden && document.hasFocus();
    const customKey = shortcut !== null && event.keyCode === shortcut;
    if (event.keyCode !== code && !customKey) return;
    const trace = (stage, reason = "") => { try { globalThis.GSTFarmDiagnostics?.key?.(scene, stage, reason); } catch {} };
    if (menuOpen) { trace("ignored", "menu"); return; }
    if (captureActive) { trace("blocked", "key_capture"); return; }
    const editing = [document.activeElement, ...event.composedPath()].some((node) =>
      node instanceof HTMLElement && (node.isContentEditable
        || node.matches("input, textarea, select, [role='textbox']")));
    if (!editing) trace("received");
    const ignored = document.hidden || !document.hasFocus() || editing || event.isComposing
      || event.repeat || event.ctrlKey || event.altKey || event.metaKey || !event.isTrusted
      || event.timeStamp < generationAt
      || (shortcut !== null && event.shiftKey);
    if (ignored) {
      // Do not record typing in editable fields.
      if (!editing) trace("ignored", document.hidden || !document.hasFocus() ? "background"
        : event.isComposing ? "composing" : event.repeat ? "repeat" : !event.isTrusted ? "untrusted"
          : event.timeStamp < generationAt ? "stale" : "modifier");
      event.stopImmediatePropagation();
      return;
    }
    // With no exposed scene, keep the game's focused native binding usable.
    // Otherwise handle the native binding here too, so Phaser cannot queue a
    // toggle for a later update after the tab loses focus.

    event.stopImmediatePropagation();
    if (settings.policyMode === "native" && shortcut !== null && !customKey && event.keyCode !== code) return;
    event.preventDefault();
    const conflict = customKey && Object.entries(scene?.controls?.bindings ?? {})
      .some(([action, binding]) => action !== "V" && binding === shortcut);
    if (conflict) {
      trace("blocked", "conflict");
      shortcutMessage = "Phím tùy chỉnh trùng thao tác khác trong game. Hãy chọn phím khác (ví dụ F6).";
      return;
    }
    if (!scene?.sys?.isActive?.() || typeof scene.toggleAutoFarm !== "function" || !scene.self) {
      trace("blocked", "scene_unavailable");
      shortcutMessage = "Chưa truy cập được Auto Farm; cần tải game với tham số timer.";
      return;
    }
    if (blockedFarmStart() && scene.auto?.on === false) {
      trace("blocked", "configuration");
      shortcutMessage = blockedFarmMessage();
      message = shortcutMessage;
      return;
    }
    if (scene.chat?.typing || scene.keyCapture || (!scene.auto?.on
        && (scene.self.dead || scene.uiBlocked || !connected(scene)))) {
      trace("blocked", scene.chat?.typing ? "chat" : scene.keyCapture ? "key_capture"
        : scene.self.dead ? "dead" : scene.uiBlocked ? "ui_blocked" : "disconnected");
      shortcutMessage = scene.chat?.typing ? "Đang nhập chat." : scene.keyCapture ? "Game đang chờ nhập phím tắt."
        : scene.self.dead ? "Nhân vật đã chết." : scene.uiBlocked ? "Game đang khóa thao tác do bảng/ô nhập/hộp thoại hoặc hướng màn hình."
          : "Kết nối game chưa sẵn sàng.";
      message = shortcutMessage; return;
    }
    if (settings.policyMode === "custom" && !scene.auto?.on && !ensureCustomReady(scene)) {
      trace("blocked", "controller");
      shortcutMessage = "Custom Farm không khả dụng: không bảo vệ được controller.";
      return;
    }
    shortcutMessage = "";
    globalThis.GSTFarmRevivePolicy?.attach(scene);
    globalThis.GSTFarmBehavior?.attach(scene);
    const previousAuto = scene.auto;
    const wasOn = previousAuto?.on;
    if (wasOn === false && session) stop("Đã kết thúc phiên hỗ trợ cũ trước khi bật lại Auto Farm.");
    const attempt = settings.policyMode === "tool" ? { generation: gestureGeneration, scene, auto: scene.auto } : null;
    shortcutIntent = attempt;
    try {
      if (globalThis.GSTFarmDiagnostics) GSTFarmDiagnostics.toggleByUser(scene);
      else scene.toggleAutoFarm();
    } finally { if (shortcutIntent === attempt) shortcutIntent = null; }
    trace("result", scene.auto?.on === wasOn ? "unchanged" : scene.auto?.on ? "enabled" : "disabled");
    if (settings.policyMode === "extended" && wasOn === false && scene.auto === previousAuto && scene.auto.on) {
      // An explicit new session must not inherit the old extension block or
      // native navigation failure counters left behind by native toggle().
      blockedAuto = null;
      revival = null;
      const time = typeof scene.now === "function" ? scene.now() : NaN;
      if (compatible(scene) && finite(time) && finite(scene.px) && finite(scene.py)) {
        Object.assign(scene.auto, { moved: false, lastX: scene.px, lastY: scene.py,
          stillSince: time, chaseSince: time, sideUntil: time, sideX: 0, sideY: 0, stuckCount: 0 });
        scene.auto.reachable.clear();
      }
      watch();
      discover();
    }
  }
  function syncFarmKeyGuard() {
    window.removeEventListener("keydown", guardFarmKey, true);
    window.addEventListener("keydown", guardFarmKey, true);
  }
  syncFarmKeyGuard();

  function connected(scene) {
    const driver = scene.driver;
    return !!driver && !driver.closing && !driver.reconnecting && !driver.displaced
      && (driver.online === false || (typeof driver.link?.open === "function" && driver.link.open()));
  }

  function compatible(scene) {
    const auto = scene?.auto;
    return scene?.sys?.isActive?.() && typeof scene.autoHost === "function"
      && typeof scene.now === "function" && typeof scene.events?.on === "function"
      && typeof scene.events?.off === "function" && typeof auto?.on === "boolean"
      && finite(auto.ax) && finite(auto.ay) && finite(auto.think)
      && Array.isArray(auto.path) && auto.skipped instanceof Map && auto.reachable instanceof Map
      && typeof auto.pick === "function" && typeof auto.target === "number"
      && finite(auto.pauseUntil) && typeof auto.resting === "boolean";
  }

  function nativeWaitReason(scene) {
    if (!scene?.auto?.on || !scene.self) return "";
    if (!connected(scene)) return "Auto Farm đã bật nhưng đang chờ kết nối game.";
    if (scene.self.dead) return "Nhân vật đã chết; chờ hồi sinh.";
    if (scene.leaving) return "Đang chuyển map; chờ scene ổn định.";
    if (!settings.enabled && settings.searchScope === "map") return "Toàn map chưa áp dụng: cần bật Mở rộng vùng tìm quái và lưu phạm vi.";
    if (scene.keyCapture) return "Đang đặt phím trong game; kết thúc đặt phím để tiếp tục.";
    if (scene.pendingSkill || scene.aiming) return "Đang chờ/ngắm chiêu tay; kết thúc hoặc hủy ngắm để farm tiếp.";
    if (scene.self.med && globalThis.GSTFarmBehavior?.ownsMeditation?.(scene))
      return "Auto Farm đang thiền chờ quái trong vùng tìm.";
    if (scene.self.med && !scene.auto.resting) return "Game vẫn ghi nhận đang bế quan; chờ game xác nhận thoát bế quan để farm tiếp.";
    if (scene.auto.resting) return "Auto Farm đang rút lui/hồi máu; chưa tiếp tục tìm quái.";
    if (GSTHarvest.controls(scene)) return "Đang nhường di chuyển cho Tự hái.";
    if (globalThis.GSTQuest?.controls(scene)) return "Auto Quest đang về NPC/trả nhiệm vụ.";
    if (globalThis.GSTChest?.controls(scene)) return "Đang nhường di chuyển để tìm và mở rương bí cảnh.";
    if (globalThis.GSTRealm?.controls(scene)) return "Đang nhường di chuyển để tới/vào bí cảnh.";
    if (globalThis.GSTFarmSeals?.controls(scene)) return "Đang nhường di chuyển để phá phong ấn.";
    if (GSTFarmRouting.blocked(scene)) return "Auto Farm vẫn bật; chờ đóng hội thoại NPC hoặc bảng bảo vệ để tiếp tục.";
    const routing = GSTFarmRouting.status(scene);
    if (routing) return routing;
    if (typeof scene.now === "function" && scene.now() < scene.auto.pauseUntil) return "Đang tạm dừng sau lệnh di chuyển tay; chờ hết khoảng nghỉ của game.";
    return "";
  }

  function owned(s) {
    return s.auto.ax === s.center.x && s.auto.ay === s.center.y;
  }

  function clearFilter() {
    const binding = filterBinding;
    filterBinding = null;
    if (!binding) return;
    binding.scene.events.off("shutdown", clearFilter);
    binding.scene.events.off("destroy", clearFilter);
    binding.scene.events.off("preupdate", guardDisallowedPlayerTarget);
    if (binding.scene.autoHost !== binding.wrapper) return;
    if (binding.descriptor) Object.defineProperty(binding.scene, "autoHost", binding.descriptor);
    else delete binding.scene.autoHost;
  }

  function boundaryHome(scene) {
    return session?.scene === scene ? session.home : { x: scene.auto?.ax, y: scene.auto?.ay };
  }
  function playerActor(scene, id) {
    if (!Number.isSafeInteger(id)) return null;
    const actor = scene?.views?.get?.(id);
    return actor?.k === "p" && !actor.dead ? actor : null;
  }
  function anotherMovementOwner(scene) {
    try {
      if (globalThis.GSTFarmMap?.movementOwned?.(scene) === true
          || globalThis.GSTFarmMap?.controls?.(scene) === true
          || globalThis.GSTFarmMap?.nativeHandling?.(scene) === true
          || globalThis.GSTFarmBehavior?.collecting?.(scene) === true) return true;
    } catch { return true; }
    for (const name of ["GSTHarvest", "GSTFarmSeals", "GSTRealm", "GSTChest", "GSTQuest", "GSTMapTravel",
      "GSTFarmDefense", "GSTFarmBossSafety"]) {
      try { if (globalThis[name]?.controls?.(scene) === true) return true; }
      catch { return true; }
    }
    return false;
  }
  function guardDisallowedPlayerTarget(scene) {
    if (!playerTargetGuardActive() || scene?.auto?.on !== true) return;
    const actor = playerActor(scene, scene.auto.target);
    if (!actor || scene.auto.moved || scene.heldAttack || scene.pendingSkill || scene.aiming
        || globalThis.GSTFarmInput?.movement?.(scene) || anotherMovementOwner(scene)) return;
    // auto.target/path belong to the native Farm controller. Keep lockId intact:
    // it is the game's manual target and manual attacks still use native methods.
    scene.auto.target = 0;
    if (Array.isArray(scene.auto.path)) scene.auto.path = [];
    scene.auto.pathAt = -Infinity;
    scene.auto.think = 0;
    scene.autoX = scene.autoY = 0;
  }
  function farmTargetGuardReason(scene, ignoreStoredAim = false) {
    if (playerActor(scene, scene.auto?.target)) return "player_target";
    if (playerActor(scene, scene.lockId)) return "player_lock";
    if (!ignoreStoredAim && scene.aimSet === true && finite(scene.aimX) && finite(scene.aimY)
        && [...(scene.views?.values?.() ?? [])].some((actor) => actor?.k === "p" && !actor.dead
          && Math.hypot(actor.x - scene.aimX, actor.y - scene.aimY) < 0.2)) return "stored_aim_overlap";
    if (typeof scene.nearestEnemy !== "function" || typeof scene.anyEnemy !== "function")
      return "targeting_unavailable";
    return "";
  }
  function inspectNativeCastRejection(scene, host, skillKey, aimX, aimY) {
    const result = { reason: "unknown", conditions: [] };
    let uncertainEarlierGuard = false;
    const condition = (value) => { if (!result.conditions.includes(value)) result.conditions.push(value); };
    const confirm = (reason, observed) => {
      condition(observed);
      if (!uncertainEarlierGuard) result.reason = reason;
    };
    try {
      if (typeof host?.kit !== "function") { condition("skill_lookup_unknown"); return result; }
      const kit = host.kit(skillKey);
      if (!kit) return { reason: "skill_unavailable", conditions: ["skill_unavailable"] };
      if (!scene?.self) return { reason: "self_unavailable", conditions: ["self_unavailable"] };

      const classId = scene.profile?.classId;
      if (classId === "the-tu") {
        condition("class_resource_guard_unknown");
        uncertainEarlierGuard = true;
      } else if (typeof classId !== "string") {
        condition("class_guard_unknown");
        uncertainEarlierGuard = true;
      }
      if (scene.dead === true) {
        confirm("dead", "dead");
        return result;
      }
      if (scene.dead !== false) { condition("dead_state_unknown"); uncertainEarlierGuard = true; }

      const effects = scene.self.fx;
      if (typeof effects !== "string") { condition("status_state_unknown"); uncertainEarlierGuard = true; }
      else {
        if (effects.includes("s")) {
          confirm("silenced", "silenced");
          return result;
        }
        if (effects.includes("r") && ["dash", "blink"].includes(kit.shape)) {
          confirm("rooted_mobility_skill", "rooted_mobility_skill");
          return result;
        }
      }

      if (typeof scene.skillWait !== "function") {
        condition("cooldown_state_unknown"); uncertainEarlierGuard = true;
      } else {
        const wait = scene.skillWait(skillKey);
        if (Number.isFinite(wait)) {
          result.skillWaitMs = Math.round(Math.max(0, Math.min(120000, wait * 1000)));
          if (wait > 0) {
            confirm("cooldown_wait", "cooldown_wait");
            return result;
          }
        } else { condition("cooldown_state_unknown"); uncertainEarlierGuard = true; }
      }

      // The source checks a class/resource formula before range, but that
      // formula is not exposed here. Record range only as an observed condition.
      condition("mana_cost_unknown");
      const nativeRange = kit.castRange ?? kit.range;
      if ([nativeRange, aimX, aimY, scene.px, scene.py].every(finite)) {
        const maxRange = Math.max(0, Math.min(10000, nativeRange + 1));
        const targetDistance = Math.hypot(aimX - scene.px, aimY - scene.py);
        result.maxRange = Math.round(maxRange * 1000) / 1000;
        result.targetDistance = Math.round(Math.min(10000, targetDistance) * 1000) / 1000;
        if (targetDistance > nativeRange + 1) condition("out_of_range");
      } else condition("range_state_unknown");
    } catch { condition("native_guard_state_unknown"); }
    return result;
  }
  function withFarmTargetingGuard(scene, host, action, blockedValue, skillKey = "", ignoreStoredAim = false) {
    if (!playerTargetGuardActive()) return action();
    const reason = farmTargetGuardReason(scene, ignoreStoredAim);
    const blocked = (value) => {
      if (skillKey) globalThis.GSTFarmSkillDiagnostics?.blocked?.(scene, skillKey, "farm_cast", value);
      return blockedValue;
    };
    if (reason) return blocked(reason);
    const originalNearest = scene.nearestEnemy, originalAny = scene.anyEnemy;
    const nearestMonster = (range) => {
      if (!finite(range) || range < 0) return null;
      const pos = host.pos?.();
      if (!Array.isArray(pos) || !pos.every(finite)) return null;
      let selected = null, best = range;
      const enemies = host.enemies?.();
      if (!Array.isArray(enemies)) return null;
      for (const enemy of enemies) {
        const actor = scene.views?.get?.(enemy?.id);
        if (!actor || actor.k !== "m" || actor.dead || enemy.dead
            || !(enemy.hostile === true || enemy.aggro === true || enemy.hpPct < 1)
            || !finite(enemy.x) || !finite(enemy.y)) continue;
        const distance = Math.hypot(enemy.x - pos[0], enemy.y - pos[1]);
        if (distance < best) { selected = actor; best = distance; }
      }
      return selected;
    };
    const nearest = function (...args) {
      const target = originalNearest.apply(this, args);
      return target?.k === "p" ? nearestMonster(args[0]) : target;
    };
    const any = (range) => nearestMonster(range) !== null;
    const restore = (name, descriptor) => {
      try {
        if (descriptor) Object.defineProperty(scene, name, descriptor);
        else delete scene[name];
      } catch { /* Restore best effort; never replace another owner's later method. */ }
    };
    const nearestDescriptor = Object.getOwnPropertyDescriptor(scene, "nearestEnemy");
    const anyDescriptor = Object.getOwnPropertyDescriptor(scene, "anyEnemy");
    try {
      scene.nearestEnemy = nearest;
      scene.anyEnemy = any;
      if (scene.nearestEnemy !== nearest || scene.anyEnemy !== any) return blocked("targeting_unavailable");
      return action();
    } catch { return blockedValue; }
    finally {
      restore("nearestEnemy", nearestDescriptor);
      restore("anyEnemy", anyDescriptor);
    }
  }
  function insideFarmBoundary(scene, actor) {
    if (!settings.enabled || settings.searchScope !== "radius") return true;
    const home = boundaryHome(scene);
    return [home?.x, home?.y, settings.radius, actor?.x, actor?.y].every(finite)
      && settings.radius >= 1 && distance(home, actor) <= settings.radius;
  }

  function clearExcludedBossTarget(scene) {
    if (!scene?.auto?.on) return;
    const actor = scene.views?.get?.(scene.auto.target);
    if (actor?.k !== "m" || !isBoss(actor.st)) return;
    const rejected = settings.excludeBoss || ["highLevel", "lowLevel"].includes(settings.targetMode)
      || settings.policyMode === "extended" && settings.bossFilter === "world" && !isWorldBoss(actor.st);
    if (!rejected) return;
    const replacementPath = [];
    excludedBossChange = { auto: scene.auto, target: actor.id,
      path: Array.isArray(scene.auto.path) ? [...scene.auto.path] : null,
      replacementPath };
    // Retain the numeric target sentinel required by the native interface.
    scene.auto.target = 0;
    if (Array.isArray(scene.auto.path)) scene.auto.path = replacementPath;
    scene.auto.think = 0;
    if (session?.scene === scene) session.rankTarget = null;
  }
  function clearUnsafeFarmTarget(scene) {
    if (!scene?.auto?.on || scene.auto.moved || GSTFarmInput.movement(scene)) return;
    const actor = scene.views?.get?.(scene.auto.target);
    if (!actor || globalThis.GSTFarmBossSafety?.allowsTarget?.(scene, actor) !== false) return;
    scene.auto.target = 0;
    if (Array.isArray(scene.auto.path)) scene.auto.path = [];
    scene.auto.think = 0;
    if (session?.scene === scene) session.rankTarget = null;
  }
  function restoreExcludedBossTarget(scene) {
    const change = excludedBossChange;
    excludedBossChange = null;
    if (!change || scene?.auto !== change.auto) return;
    const actor = scene.views?.get?.(change.target);
    let restoredTarget = false;
    if (scene.auto.target === 0 && actor?.k === "m" && !actor.dead && isBoss(actor.st)
        && nativeEligible(actor.st) && (settings.policyMode !== "extended" || matchesTarget(actor.st))) {
      scene.auto.target = change.target;
      restoredTarget = true;
    }
    if (change.path && scene.auto.path === change.replacementPath) scene.auto.path = change.path;
    if (restoredTarget) scene.auto.think = 0;
  }
  function restoreRankedTarget(owner) {
    const change = owner?.targetOverride;
    if (!change) return;
    owner.targetOverride = null;
    if (owner.auto.target !== change.to) return;
    const previous = owner.scene.views?.get?.(change.target);
    owner.auto.target = change.target === 0 || previous?.k === "m" && !previous.dead && nativeEligible(previous.st)
      ? change.target : 0;
    if (change.path && owner.auto.path === change.replacementPath) {
      owner.auto.path = change.path;
      if (owner.auto.chaseSince === change.chaseSinceSet) owner.auto.chaseSince = change.chaseSince;
    }
    owner.auto.think = 0;
  }
  function syncFilter(scene, guardOnly = false) {
    const filteringActive = () => !guardOnly && settings.policyMode === "extended" && !identityBlocked;
    const boundaryActive = () => filteringActive() && settings.enabled && settings.searchScope === "radius";
    const filterHostActive = filteringActive(scene) || boundaryActive();
    const guardPlayers = playerTargetGuardActive();
    if (!filterHostActive && !guardPlayers) { clearFilter(); return; }
    if (guardOnly && filterBinding?.scene === scene && filterBinding.guardOnly
        && scene.autoHost === filterBinding.wrapper) {
      if (guardPlayers && !filterBinding.playerGuardAttached) {
        scene.events.on("preupdate", guardDisallowedPlayerTarget);
        filterBinding.playerGuardAttached = true;
      } else if (!guardPlayers && filterBinding.playerGuardAttached) {
        scene.events.off("preupdate", guardDisallowedPlayerTarget);
        filterBinding.playerGuardAttached = false;
      }
      return;
    }
    if (guardOnly && filterBinding?.scene === scene) clearFilter();
    if (!guardOnly) clearExcludedBossTarget(scene);
    if (!guardOnly && filterBinding?.scene === scene && scene.autoHost === filterBinding.wrapper) {
      if (guardPlayers && !filterBinding.playerGuardAttached) {
        scene.events.on("preupdate", guardDisallowedPlayerTarget);
        filterBinding.playerGuardAttached = true;
      } else if (!guardPlayers && filterBinding.playerGuardAttached) {
        scene.events.off("preupdate", guardDisallowedPlayerTarget);
        filterBinding.playerGuardAttached = false;
      }
      return;
    }
    clearFilter();
    const original = scene.autoHost;
    if (typeof original !== "function") throw new Error("Auto Farm host unavailable.");
    if (filterHostActive && typeof original.call(scene)?.enemies !== "function")
      throw new Error("Enemy list unavailable.");
    const descriptor = Object.getOwnPropertyDescriptor(scene, "autoHost");
    const wrapper = function (...args) {
      const host = original.apply(this, args);
      const guardPlayersNow = playerTargetGuardActive();
      const filterNow = filteringActive(this) || boundaryActive();
      if ((!filterNow && !guardPlayersNow) || !this.auto?.on) return host;
      if (guardPlayersNow) guardDisallowedPlayerTarget(this);
      const guardedHost = { ...host };
      if (guardPlayersNow) {
        guardedHost.face = (x, y, id) => playerActor(this, id) ? false : host.face?.(x, y, id);
        guardedHost.steer = (x, y) => playerActor(this, this.auto?.target) ? false : host.steer?.(x, y);
        guardedHost.basic = (...callArgs) => withFarmTargetingGuard(this, host,
          () => host.basic?.(...callArgs), undefined);
        guardedHost.cast = (...callArgs) => {
          const skillKey = typeof callArgs[0] === "string" ? callArgs[0] : "";
          if (typeof host.cast !== "function") {
            globalThis.GSTFarmSkillDiagnostics?.blocked?.(this, skillKey, "farm_cast", "native_method_unavailable");
            return false;
          }
          const [, aimX, aimY] = callArgs;
          const targetId = this.auto?.target;
          const targetActor = Number.isSafeInteger(targetId) && targetId > 0 ? this.views?.get?.(targetId) : null;
          // Native aimPoint() consumes a live lockId before aimX/aimY. The native
          // Auto Farm calls face() with its selected enemy ID before casting.
          const lockedMonsterTarget = !this.aiming && targetActor?.k === "m" && !targetActor.dead
            && this.lockId === targetId;
          const directPlayerAim = finite(aimX) && finite(aimY)
            && [...(this.views?.values?.() ?? [])].some((actor) => actor?.k === "p" && !actor.dead
              && Math.hypot(actor.x - aimX, actor.y - aimY) < 0.2);
          if (directPlayerAim && !lockedMonsterTarget) {
            globalThis.GSTFarmSkillDiagnostics?.blocked?.(this, skillKey, "farm_cast", "requested_aim_overlap");
            return false;
          }
          return withFarmTargetingGuard(this, host, () => {
            const diagnostics = globalThis.GSTFarmSkillDiagnostics;
            if (typeof diagnostics?.invoke !== "function") return host.cast(...callArgs);
            const rejection = diagnostics.isEnabled?.(this) === true
              ? inspectNativeCastRejection(this, host, skillKey, aimX, aimY) : null;
            return diagnostics.invoke(this, skillKey, "farm_cast", "host.cast",
              () => host.cast(...callArgs), rejection);
          }, false, skillKey, !this.aiming);
        };
      }
      if (!filterNow) return guardedHost;
      // Keep the wrapper through recovery; the enemy getter exposes raw threats while resting.
      const eligible = (enemy) => nativeEligible(enemy)
        && globalThis.GSTFarmBossSafety?.allowsTarget?.(this, enemy) !== false && (
        insideFarmBoundary(this, enemy) && matchesTarget(enemy)
        // Only a validated, opt-in nearby group may temporarily join native
        // combat. This never includes an excluded boss or a distant actor.
        || globalThis.GSTFarmDefense?.allowsNearbyTarget?.(this, enemy) === true);
      const allEligibleEnemies = () => {
        const enemies = typeof host?.enemies === "function" ? host.enemies() : [];
        return Array.isArray(enemies) ? enemies.filter(eligible) : [];
      };
      return { ...guardedHost,
        // Chest safety must see actual nearby monsters, not farm-targeting filters.
        gstRawEnemies: () => host.enemies(),
        allEligibleEnemies, enemies: () => {
          const enemies = typeof host?.enemies === "function" ? host.enemies() : [];
          if (!Array.isArray(enemies)) return [];
          // Native update can enter recovery after this host wrapper is created.
          if (this.auto?.resting) return enemies.filter((enemy) =>
            globalThis.GSTFarmBossSafety?.allowsTarget?.(this, enemy) !== false);
          const heldId = globalThis.GSTFarmMap?.heldTarget?.(this);
          const filtered = enemies.filter((enemy) => eligible(enemy) && (heldId == null || enemy.id === heldId));
          return ranked() && !this.auto?.resting ? filtered.sort(comparePriority) : filtered;
        }, loot: () => {
          const loot = typeof host?.loot === "function" ? host.loot() : [];
          return Array.isArray(loot) ? loot.filter((item) => insideFarmBoundary(this, item)) : [];
        } };
    };
    scene.autoHost = wrapper;
    filterBinding = { scene, descriptor, wrapper, playerGuardAttached: guardPlayers, guardOnly };
    scene.events.on("shutdown", clearFilter);
    scene.events.on("destroy", clearFilter);
    if (guardPlayers) scene.events.on("preupdate", guardDisallowedPlayerTarget);
  }

  function pickRanked(s, host, time, pos, candidates, moveCenter, searchRadius) {
    const heldId = globalThis.GSTFarmMap?.heldTarget?.(s.scene);
    if (heldId != null) return true;
    const heldActor = s.scene.views?.get?.(heldId ?? s.auto.target);
    if (heldActor?.k === "m" && !heldActor.dead && insideFarmBoundary(s.scene, heldActor)) return true;
    // Native combat may already be fighting a nearby attacker. Do not
    // repeatedly restore an old ranked target while that fight is active.
    const native = s.scene.views?.get?.(s.auto.target);
    if (host.inCombat?.() && native?.k === "m" && !native.dead
        && finite(native.x) && finite(native.y) && distance(native, pos) <= 5.5) {
      s.rankTarget = null;
      return true;
    }
    const ordered = candidates.filter((enemy) => finite(enemy?.id) && finite(enemy.x) && finite(enemy.y)
      && !enemy.dead && nativeEligible(enemy) && !(s.auto.skipped.get(enemy.id) > time))
      .sort((a, b) => comparePriority(a, b) || distance(a, pos) - distance(b, pos));
    const previous = s.rankTarget;
    const held = previous && ordered.find((enemy) => enemy.id === previous.id);
    const better = held && ordered[0] && ordered[0].id !== held.id
      ? switchReason(held, ordered[0], pos, time - previous.at) : "";
    const first = better ? ordered[0] : held ?? ordered[0];
    if (!first) { s.rankTarget = null; return false; }
    for (const enemy of [first, ...ordered.filter((item) => item.id !== first.id)]) {
      const selected = s.auto.pick(host, time, [enemy], [], pos.x, pos.y);
      if (!selected || selected.id !== enemy.id) continue;
      // Native pick() only returns a candidate; native update() normally
      // applies target, chaseSince and path on a target switch.
      if (s.auto.target !== selected.id) {
        const previousOverride = s.targetOverride;
        const stillOwned = previousOverride && s.auto.target === previousOverride.to;
        const replacementPath = [];
        const override = stillOwned ? previousOverride : {
          target: s.auto.target,
          path: Array.isArray(s.auto.path) ? [...s.auto.path] : null,
          chaseSince: s.auto.chaseSince
        };
        override.to = selected.id;
        override.replacementPath = replacementPath;
        override.chaseSinceSet = time;
        s.targetOverride = override;
        s.auto.target = selected.id;
        s.auto.chaseSince = time;
        s.auto.path = replacementPath;
        s.auto.think = 0;
      }
      if (previous && previous.id !== enemy.id) {
        globalThis.GSTMovementDiagnostics?.event?.(s.scene, "target_switch", {
          fromId: previous.id, toId: enemy.id, switchSource: "radius",
          switchReason: better && first.id === enemy.id ? better
            : held ? "pick_failed" : "target_unavailable" });
      }
      s.rankTarget = { id: enemy.id, at: previous?.id === enemy.id ? previous.at : time };
      if (moveCenter) shiftToward(s, enemy, searchRadius);
      return true;
    }
    s.rankTarget = null;
    return false;
  }
  function center(s, point) {
    if (s.auto.ax === point.x && s.auto.ay === point.y) return;
    s.auto.ax = point.x;
    s.auto.ay = point.y;
    s.auto.think = 0; // Reconsider the area; skill/pill cooldowns are untouched.
    s.center = { ...point };
  }

  function restore(s) {
    // A manual V toggle or movement may have already supplied a new center.
    if (owned(s)) center(s, s.home);
  }

  function stop(reason, block = false) {
    // Keep the inert filter attached through death/off so the next native
    // update after revival/re-enable cannot select an unfiltered target.
    if (block || settings.policyMode !== "extended" || identityBlocked) clearFilter();
    if (block) revival = null;
    if (session) {
      const old = session;
      session = null;
      old.scene.events.off("preupdate", onFrame);
      old.scene.events.off("shutdown", onShutdown);
      old.scene.events.off("destroy", onShutdown);
      restore(old);
      if (block) blockedAuto = old.auto;
    }
    message = reason;
    watch();
  }

  function trackAimStart(scene) {
    if (typeof scene?.startAim !== "function") return null;
    const descriptor = Object.getOwnPropertyDescriptor(scene, "startAim");
    const tracking = { scene, original: scene.startAim, descriptor, revision: 0 };
    tracking.wrapper = function (...args) {
      const result = tracking.original.apply(this, args);
      if (this === scene && scene.aiming) tracking.revision++;
      return result;
    };
    try {
      scene.startAim = tracking.wrapper;
      return scene.startAim === tracking.wrapper ? tracking : null;
    } catch { return null; }
  }

  function releaseAimStart(tracking) {
    if (!tracking || tracking.scene.startAim !== tracking.wrapper) return;
    try {
      if (tracking.descriptor) Object.defineProperty(tracking.scene, "startAim", tracking.descriptor);
      else delete tracking.scene.startAim;
    } catch { /* The game may have replaced the scene method. */ }
  }

  function clearDeath() {
    const episode = death;
    if (!episode) return;
    episode.scene.events?.off?.("shutdown", episode.onShutdown);
    episode.scene.events?.off?.("destroy", episode.onShutdown);
    releaseAimStart(episode.aimTracking);
    death = null;
  }

  function syncRespawnObserver() {
    const enabled = configurationReceived && globalThis.GSTFarmConfigurationReady === true
      && settings.autoRespawn && globalThis.GSTFarmPolicy?.hasExtensionAssistance?.() && !identityBlocked && !suspended;
    if (!enabled) {
      if (respawnWatcher !== null) clearInterval(respawnWatcher);
      respawnWatcher = null;
      clearDeath();
      return;
    }
    if (respawnWatcher !== null) return;
    respawnWatcher = setInterval(() => {
      try {
        if (!configurationReceived || globalThis.GSTFarmConfigurationReady !== true
            || !settings.autoRespawn || identityBlocked || suspended) {
          syncRespawnObserver();
          return;
        }
        const scene = sceneNow();
        if (death && death.scene !== scene) clearDeath();
        if (scene?.sys?.isActive?.() && scene.self && !scene.leaving && connected(scene)) checkRespawn(scene);
      } catch { respawnMessage = "Tự hồi sinh đang chờ scene ổn định."; }
    }, 1000);
  }

  function clearStaleDeathAim(scene) {
    const episode = death;
    const tracking = episode?.aimTracking;
    if (episode?.scene === scene && episode.character === scene.profile?.name && episode.auto === scene.auto
        && episode.aiming && tracking?.scene === scene && scene.startAim === tracking.wrapper
        && tracking.revision === episode.aimRevision && scene.aiming === episode.aiming
        && typeof scene.cancelAim === "function") {
      scene.cancelAim();
    }
    clearDeath();
  }

  function stopForLockedPolicy() {
    if (watcher !== null) clearInterval(watcher);
    watcher = null;
    const oldSession = session;
    if (session) stop("Auto Farm gốc đang được dùng; hỗ trợ farm mở rộng đã dừng.", true);
    else clearFilter();
    restoreRankedTarget(oldSession);
    restoreExcludedBossTarget(sceneNow());
    clearDeath(); revival = null; blockedAuto = null;
  }

  function onShutdown() {
    stop("Scene ended; extended range stopped.", true);
  }

  function checkRespawn(scene) {
    if (!scene?.self || !scene.sys?.isActive?.() || scene.leaving || !connected(scene)) return "Chờ kết nối và scene ổn định để hồi sinh.";
    if (!scene.self.dead) {
      clearStaleDeathAim(scene);
      respawnMessage = "";
      return;
    }
    if (!configurationReceived || globalThis.GSTFarmConfigurationReady !== true || identityBlocked || !settings.autoRespawn) {
      if (death?.scene === scene) clearDeath();
      return "Tự hồi sinh đang tắt hoặc chờ xác nhận tài khoản/cấu hình.";
    }
    if (death && (death.scene !== scene || death.character !== scene.profile?.name || death.auto !== scene.auto)) clearDeath();
    if (!death) {
      const aimTracking = trackAimStart(scene);
      const episode = { scene, character: scene.profile?.name, auto: scene.auto, aiming: scene.aiming || null,
        aimTracking, aimRevision: aimTracking?.revision ?? null, startedAt: performance.now(),
        nativeDeadAt: 0, nativeReviveTry: 0, nativeProgressAt: performance.now(),
        nativeDueSince: null, fallbackAttempts: 0, fallbackAt: -Infinity, onShutdown: null };
      episode.onShutdown = () => { if (death === episode) clearDeath(); };
      death = episode;
      scene.events?.on?.("shutdown", episode.onShutdown);
      scene.events?.on?.("destroy", episode.onShutdown);
    }
    if ([...document.querySelectorAll('[role="alertdialog"]')].some((el) =>
      el.getClientRects().length && getComputedStyle(el).visibility !== "hidden")) {
      respawnMessage = "Chờ bạn xử lý hộp kiểm tra người chơi trước khi hồi sinh.";
      return respawnMessage;
    }
    const button = scene.hud?.deathBtn;
    if (!(button instanceof HTMLButtonElement) || !button.isConnected
        || scene.hud?.death?.style.display === "none") {
      respawnMessage = "Nút hồi sinh chưa hiển thị; đang chờ giao diện game.";
      return "Chờ game hiển thị nút hồi sinh.";
    }
    if (button.disabled) {
      respawnMessage = "Chờ hết thời gian hồi sinh của game.";
      return "Chờ hết thời gian hồi sinh của game.";
    }
    const now = performance.now();
    const deadAt = finite(scene.auto?.deadAt) ? scene.auto.deadAt : 0;
    const reviveTry = finite(scene.auto?.reviveTry) ? scene.auto.reviveTry : 0;
    if (deadAt > 0 && deadAt !== death.nativeDeadAt) {
      death.nativeDeadAt = deadAt;
      death.nativeProgressAt = now;
    }
    if (reviveTry > 0 && reviveTry !== death.nativeReviveTry) {
      death.nativeReviveTry = reviveTry;
      death.nativeProgressAt = now;
    }
    const nativeControllerPresent = scene.auto?.on === true
      && typeof scene.auto.update === "function" && finite(scene.auto.deadAt) && finite(scene.auto.reviveTry);
    const deathAge = now - death.startedAt;
    const nativeProgressAge = now - death.nativeProgressAt;
    let gameNow = NaN;
    try { if (typeof scene.now === "function") gameNow = scene.now(); } catch { /* Native progress remains unknown. */ }
    const nativeDue = nativeControllerPresent && deadAt > 0 && finite(gameNow)
      && gameNow - deadAt > 5.3 && gameNow > reviveTry;
    const nativeUpdateSkipped = !!scene.pendingSkill || !!scene.aiming || !!scene.self.med && !scene.auto.resting;
    if (nativeDue && !nativeUpdateSkipped) {
      death.nativeDueSince ??= now;
      if (now - death.nativeDueSince < 1000) {
        respawnMessage = "Auto Farm gốc đã đến lượt hồi sinh; chờ lượt xử lý tiếp theo.";
        return respawnMessage;
      }
    } else death.nativeDueSince = null;
    // The game waits 5.3 game-seconds before its first attempt. Give that
    // native path time, then fall back only after its observed state stalls.
    if (nativeControllerPresent && (deathAge < 8000 || nativeProgressAge < 6000)) {
      respawnMessage = death.nativeReviveTry > 0
        ? "Auto Farm gốc đang thử hồi sinh; chờ game phản hồi."
        : "Chờ Auto Farm gốc ghi nhận ca chết và thử hồi sinh.";
      return respawnMessage;
    }
    if (death.fallbackAttempts > 0 && now - death.fallbackAt < 6000) {
      respawnMessage = "Đã gửi yêu cầu hồi sinh qua bộ điều khiển gốc; đang chờ game phản hồi.";
      return respawnMessage;
    }
    if (death.fallbackAttempts >= 2) {
      respawnMessage = "Game chưa xác nhận hồi sinh sau các lần thử; hãy dùng nút hồi sinh bằng tay.";
      return respawnMessage;
    }
    const host = typeof scene.autoHost === "function" ? scene.autoHost() : null;
    if (typeof host?.respawn !== "function") {
      respawnMessage = "Không có bộ chọn cách hồi sinh của game; nhường xử lý cho giao diện gốc.";
      return "Thiếu bộ chọn kiểu hồi sinh của game; nhường xử lý cho giao diện gốc.";
    }
    death.fallbackAttempts++;
    death.fallbackAt = now;
    globalThis.GSTBackgroundDiagnostics?.record("revive_request", scene);
    host.respawn();
    respawnMessage = death.fallbackAttempts === 1
      ? "Auto Farm gốc chưa tiến triển; đã yêu cầu bộ chọn hồi sinh của game."
      : "Chưa thấy game phản hồi; đã thử lại qua bộ chọn hồi sinh của game.";
    return respawnMessage;
  }

  function ensureFlying(s) {
    const ready = globalThis.GSTFlight?.ensure(s.scene) === true;
    if (!ready) message = globalThis.GSTFlight?.status() ?? "Chờ bộ điều khiển bay.";
    return ready;
  }

  function watch() {
    // Independent defense/meditation helpers still need a scene watcher when
    // the user disables respawn and expanded filtering.
    if (["extended","custom"].includes(settings.policyMode) && !identityBlocked && !suspended && !session && watcher === null) {
      watcher = setInterval(discover, 1000);
    }
  }

  function discover() {
    const scene = sceneNow();
    if (settings.policyMode === "custom" && scene?.auto
        && globalThis.GSTFarmUpdate?.installGate?.(scene) !== true) {
      message = "Custom Farm không khả dụng: không bảo vệ được controller.";
      return;
    }
    if (scene?.auto) globalThis.GSTCustomFarm?.configure?.(scene, settings);
    if (!["extended", "custom"].includes(settings.policyMode) || identityBlocked || suspended || session) return;
    try {
      if (settings.policyMode === "custom") {
        globalThis.GSTCustomFarm?.configure?.(scene, settings);
        globalThis.GSTFarmRevivePolicy?.attach(scene);
        checkRespawn(scene);
        globalThis.GSTFarmDefense?.attach(scene);
        globalThis.GSTFarmEncounter?.attach(scene);
        globalThis.GSTFarmBossSafety?.attach(scene);
        globalThis.GSTFarmVisual?.configure?.(scene, settings);
        globalThis.GSTFarmVisual?.attach(scene);
        globalThis.GSTFarmDiagnostics?.attach(scene);
        message = globalThis.GSTCustomFarm?.status?.(scene) ?? "Custom Farm: waiting.";
        return;
      }
      globalThis.GSTFarmSkillDiagnostics?.setContext?.(scene, settings);
      if (settings.acceptPartyInvites) globalThis.GSTFarmParty?.configure(scene, settings);
      // Revival policy is independent of extended targeting. Attach it even
      // when the player-target guard is the only active Farm feature.
      globalThis.GSTFarmRevivePolicy?.attach(scene);
      checkRespawn(scene);
      globalThis.GSTFarmCombat?.attach(scene);
      globalThis.GSTFarmBehavior?.attach(scene);
      globalThis.GSTFarmDefense?.attach(scene);
      globalThis.GSTFarmEncounter?.attach(scene);
      globalThis.GSTFarmBossSafety?.attach(scene);
      globalThis.GSTFarmMap?.attach(scene);
      globalThis.GSTFarmVisual?.attach(scene);
      globalThis.GSTFarmRouting?.attach(scene);
      globalThis.GSTFarmDiagnostics?.attach(scene);
      const exclusionFilterNeeded = globalThis.GSTFarmBossSafety?.hasExclusions?.(scene) === true;
      if (compatible(scene) && scene.self && !scene.leaving && connected(scene)
          && scene.auto !== blockedAuto
          && settings.policyMode === "extended" && !identityBlocked)
        syncFilter(scene);
      else clearFilter();
      if (!settings.enabled && !targetFilterActive() && !exclusionFilterNeeded) return;
      if (exclusionFilterNeeded) clearUnsafeFarmTarget(scene);
      if (revival && (revival.scene !== scene || revival.auto !== scene?.auto)) revival = null;
      if (!scene?.auto?.on) {
        revival = null;
        if (scene?.auto === blockedAuto) blockedAuto = null;
        message = "Waiting for built-in Auto Farm; press its configured shortcut in the game.";
        return;
      }
      if (!compatible(scene)) {
        message = "Auto Farm interface unsupported; no changes made.";
        return;
      }
      if (scene.auto === blockedAuto) return;
      if (!scene.self || scene.leaving || !connected(scene)) {
        revival = null;
        blockedAuto = scene.auto;
        message = "Player/connection unavailable. Toggle Auto Farm off/on after recovery.";
        return;
      }
      if (scene.self.dead) {
        revival = { scene, auto: scene.auto, aliveAt: null };
        message = "Player dead; waiting for the game's revival. No flight request sent.";
        return;
      }
      if (revival) {
        // Give the native death/revive handler time to stop Auto Farm if needed.
        if (scene.auto.deadAt > 0) {
          revival.aliveAt = null;
          message = "Waiting for built-in Auto Farm to finish revival handling.";
          return;
        }
        if (revival.aliveAt === null) revival.aliveAt = performance.now();
        if (performance.now() - revival.aliveAt < 2000) {
          message = "Revived; waiting 2 seconds before checking flight and resuming range.";
          return;
        }
        revival = null;
      }
      const point = { x: scene.auto.ax, y: scene.auto.ay };
      session = { scene, auto: scene.auto, home: point, center: { ...point }, mapKey: nativeMapKey(scene.autoHost()), at: -Infinity,
        targetOverride: null };
      clearInterval(watcher);
      watcher = null;
      scene.events.on("preupdate", onFrame);
      scene.events.on("shutdown", onShutdown);
      scene.events.on("destroy", onShutdown);
      message = "Extended range active.";
    } catch {
      message = "Waiting for an accessible world scene.";
    }
  }

  function onFrame() {
    const s = session;
    if (!s) return;
    try {
      if (sceneNow() !== s.scene || s.scene.auto !== s.auto || !compatible(s.scene)) {
        stop("Scene or Auto Farm changed; stopped.", true);
        return;
      }
      if (!s.auto.on) {
        stop("Built-in Auto Farm is off.");
        return;
      }
      if (!s.scene.self || s.scene.leaving || !connected(s.scene)) {
        stop("Stopped for disconnect or scene exit. Toggle Auto Farm off/on after recovery.", true);
        return;
      }
      if (s.scene.self.dead) {
        checkRespawn(s.scene);
        revival = { scene: s.scene, auto: s.auto, aliveAt: null };
        stop("Player dead; extended range paused until revival.");
        return;
      }
      globalThis.GSTFarmEncounter?.attach(s.scene);
      if (globalThis.GSTFarmDefense?.controls(s.scene)) return;
      const time = s.scene.now();
      const host = s.scene.autoHost();
      const mapKey = nativeMapKey(host);
      if (mapKey !== null && s.mapKey !== mapKey) {
        s.mapKey = mapKey;
        s.home = { x: s.auto.ax, y: s.auto.ay };
        s.center = { ...s.home };
        s.unsafeHoldCenter = null;
        s.rankTarget = null;
      }
      const searchRadius = nativeRadius(s.scene);
      if (searchRadius === null && (settings.enabled || targetFilterActive())) {
        if (playerTargetGuardActive()) syncFilter(s.scene, true);
        else clearFilter();
        message = "Bán kính Auto Farm gốc không được hỗ trợ; phần chọn mục tiêu mở rộng đang nhường cho game.";
        return;
      }
      globalThis.GSTFarmBehavior?.attach(s.scene);
      clearExcludedBossTarget(s.scene);
      // Follow native target changes even when the user farms all monsters.
      // Refresh periodically because a boss actor can appear/disappear
      // without the native target ID changing.
      if (finite(time) && (s.bossSafetyTarget !== s.auto.target
          || time - (s.bossSafetyAt ?? -Infinity) >= 0.5)) {
        s.bossSafetyTarget = s.auto.target;
        s.bossSafetyAt = time;
        globalThis.GSTFarmBossSafety?.attach?.(s.scene);
      }
      syncFilter(s.scene);
      if (globalThis.GSTFarmBossSafety?.retreating?.(s.scene)) {
        message = globalThis.GSTFarmBossSafety.status(s.scene)
          || `Đang rút lui; chờ HP đạt ${settings.recoveryHpPercent}% trước khi tiếp tục chọn mục tiêu.`;
        return;
      }
      if (s.unsafeHoldCenter) {
        const homeExcluded = globalThis.GSTFarmBossSafety?.isAreaExcluded?.(s.scene, s.home) === true;
        if (!homeExcluded && s.auto.ax === s.unsafeHoldCenter.x && s.auto.ay === s.unsafeHoldCenter.y)
          center(s, s.home);
        s.unsafeHoldCenter = null;
      }
      // A native handoff moves the game's search center to the remote camp.
      // It is not a manual relocation of the user's configured farm origin.
      const aligned = globalThis.GSTFarmMap?.consumeCenter?.(s.scene);
      if (aligned && s.auto.ax === aligned.x && s.auto.ay === aligned.y)
        s.center = { ...aligned };
      if (globalThis.GSTFarmSeals?.pending?.(s.scene)) {
        message = globalThis.GSTFarmSeals.status(s.scene)
          || "Còn phong ấn bí cảnh; chờ phá xong trước khi tìm boss.";
        return;
      }
      if (globalThis.GSTFarmBehavior?.pendingLoot(s.scene)) {
        message = "Đang ưu tiên nhặt đồ tại bãi vừa đánh trước khi chọn bãi tiếp theo.";
        return;
      }
      if (globalThis.GSTMapTravel?.active(s.scene)) {
        message = GSTMapTravel.status(s.scene); return;
      }
      if (globalThis.GSTFarmMap?.controls(s.scene) || globalThis.GSTFarmMap?.nativeHandling(s.scene)) {
        message = GSTFarmMap.status(s.scene); return;
      }
      if (globalThis.GSTQuest?.controls(s.scene)) { message = "Nhường di chuyển để Auto Quest về NPC/trả nhiệm vụ."; return; }
      if (GSTHarvest.controls(s.scene)) {
        message = "Tạm nhường di chuyển cho Tự hái; giữ nguyên tâm farm.";
        return;
      }
      if (globalThis.GSTChest?.controls(s.scene)) {
        message = "Tạm nhường di chuyển để mở rương bí cảnh; giữ nguyên tâm farm.";
        return;
      }
      if (globalThis.GSTFarmSeals?.controls(s.scene)) {
        message = "Đang hỗ trợ phá phong ấn; giữ nguyên tâm và mục tiêu boss.";
        return;
      }
      if (globalThis.GSTRealm?.controls(s.scene)) {
        message = "Tạm nhường di chuyển để tới cổng bí cảnh; giữ nguyên tâm farm.";
        return;
      }
      if (!finite(time) || time - s.at < 0.5) return;
      s.at = time;
      clearUnsafeFarmTarget(s.scene);
      if (!settings.enabled) {
        if (s.auto.moved || time < s.auto.pauseUntil || GSTFarmInput.movement(s.scene)) s.rankTarget = null;
        if (ranked() && !s.auto.moved && time >= s.auto.pauseUntil && !s.auto.resting
            && !s.scene.pendingSkill && !s.scene.aiming && !GSTFarmInput.movement(s.scene)
            && !GSTFarmRouting.blocked(s.scene) && typeof host.pos === "function") {
          const point = host.pos();
          const enemies = host.allEligibleEnemies ? host.allEligibleEnemies() : host.enemies();
          if (Array.isArray(point) && point.length === 2 && point.every(finite) && Array.isArray(enemies)) {
            const centerPoint = { x: s.auto.ax, y: s.auto.ay };
            pickRanked(s, host, time, { x: point[0], y: point[1] },
              enemies.filter((enemy) => finite(enemy?.x) && finite(enemy.y)
                && distance(enemy, centerPoint) < searchRadius), false, searchRadius);
          }
        }
        if (globalThis.GSTFarmBossSafety?.isAreaExcluded?.(s.scene, s.home) === true) {
          const enemies = host.allEligibleEnemies ? host.allEligibleEnemies() : host.enemies();
          const centerPoint = { x: s.auto.ax, y: s.auto.ay };
          const safeLocal = Array.isArray(enemies) && enemies.some((enemy) => finite(enemy?.x) && finite(enemy.y)
            && distance(enemy, centerPoint) < searchRadius);
          if (!safeLocal) {
            const point = host.pos();
            if (Array.isArray(point) && point.length === 2 && point.every(finite)) {
              center(s, { x: point[0], y: point[1] }); s.unsafeHoldCenter = { ...s.center };
            }
            message = "Bãi gốc đang bị loại tạm; không có mục tiêu an toàn gần nên giữ vị trí hiện tại.";
            return;
          }
        }
        message = `${filterLabel()}; dùng bán kính gốc của game.`;
        return;
      }
      if (!["enemies", "pos", "clear", "route", "inCombat", "level", "loot", "meditating"]
        .every((key) => typeof host?.[key] === "function")) {
        stop("Auto Farm host interface unsupported; stopped.", true);
        return;
      }
      if (s.auto.moved || time < s.auto.pauseUntil) {
        restore(s);
        s.unsafeHoldCenter = null;
        s.rankTarget = null;
        message = "Paused for manual movement.";
        return;
      }
      if (s.auto.resting || host.meditating() || s.scene.pendingSkill || s.scene.aiming || GSTFarmRouting.blocked(s.scene)) {
        message = "Waiting for built-in healing, skill or UI handling.";
        return;
      }
      if (!ensureFlying(s, time)) return;
      const position = host.pos();
      if (!Array.isArray(position) || !position.every(finite) || position.length !== 2) {
        stop("Invalid Auto Farm position data; stopped.", true);
        return;
      }
      const pos = { x: position[0], y: position[1] };
      const enemies = ranked() && host.allEligibleEnemies ? host.allEligibleEnemies() : host.enemies();
      if (!Array.isArray(enemies)) {
        stop("Invalid Auto Farm enemy data; stopped.", true);
        return;
      }
      const currentActor = s.scene.views?.get?.(s.auto.target);
      if (currentActor?.k === "m" && finite(currentActor.x) && finite(currentActor.y)
          && settings.searchScope === "radius" && distance(currentActor, s.home) > settings.radius) {
        diagnostic(s.scene, "reject:outside_circle", "target_decision",
          { fromId: currentActor.id, toId: currentActor.id, switchSource: "radius", switchReason: "outside_circle" });
        s.auto.target = 0; s.auto.path = []; s.auto.pathAt = -Infinity; s.auto.think = 0;
        s.rankTarget = null;
      }
      const eligible = enemies.filter((enemy) => finite(enemy?.id) && finite(enemy.x) && finite(enemy.y)
        && !enemy.dead && nativeEligible(enemy)
        && globalThis.GSTFarmBossSafety?.allowsTarget?.(s.scene, enemy) !== false
        && (settings.searchScope === "map" ? finite(s.scene.map?.w) && finite(s.scene.map?.h)
          && enemy.x >= 0 && enemy.y >= 0 && enemy.x < s.scene.map.w && enemy.y < s.scene.map.h
          : distance(enemy, s.home) < settings.radius)
        && !(s.auto.skipped.has(enemy.id) && s.auto.skipped.get(enemy.id) > time));
      // Match the built-in skipped expiry without deleting its records ourselves.
      const candidates = eligible.filter((enemy) => !(s.auto.skipped.get(enemy.id) > time)
        // The map navigator approaches all distant targets with native walk/hop first.
        // Probing a full long route with pick() here would repeatedly mark them skipped.
        && !(distance(enemy, pos) > 6));
      const target = candidates.find((enemy) => enemy.id === s.auto.target);
      if (ranked() && settings.searchScope !== "map"
          && pickRanked(s, host, time, pos, candidates, true, searchRadius)) {
        message = "Giữ mục tiêu theo ưu tiên boss/cảnh giới cho tới khi cần đổi.";
        return;
      }
      if (target) {
        if (distance(target, s.center) >= searchRadius - 0.5) shiftToward(s, target, searchRadius);
        message = "Keeping the built-in target.";
        return;
      }
      const local = candidates.filter((enemy) => distance(enemy, s.center) < searchRadius);
      const aggro = host.inCombat() ? local.filter((enemy) => enemy.aggro && distance(enemy, pos) < 3.2) : [];
      // Use the game's picker, including its reachability cache and skip backoff.
      if (local.length && s.auto.pick(host, time, local, aggro, pos.x, pos.y)) {
        message = "Built-in Auto Farm has local targets.";
        return;
      }
      // Let idle() collect its pending local loot before moving the search center.
      if (host.loot().some((loot) => finite(loot.x) && finite(loot.y)
          && distance(loot, s.center) < searchRadius
          && !(s.auto.lootSkip?.has(`${loot.x.toFixed(1)},${loot.y.toFixed(1)}`)))) {
        message = "Waiting for built-in loot collection.";
        return;
      }
      const remote = candidates.slice()
        .sort((a, b) => distance(a, pos) - distance(b, pos));
      let next = null;
      for (const enemy of remote.slice(0, 4)) {
        if (s.auto.pick(host, time, [enemy], [], pos.x, pos.y)) {
          next = enemy;
          break;
        }
      }
      if (next) {
        shiftToward(s, next, searchRadius);
        message = "Search center extended; built-in Auto Farm will choose/pursue a target.";
      } else {
        const homeExcluded = globalThis.GSTFarmBossSafety?.isAreaExcluded?.(s.scene, s.home) === true;
        center(s, homeExcluded ? pos : s.home);
        if (homeExcluded) s.unsafeHoldCenter = { ...s.center };
        message = homeExcluded ? "Các bãi phù hợp đang bị loại tạm vì nguy hiểm; đứng chờ tại vị trí hiện tại."
          : settings.idleMode === "hold" ? "Không có quái phù hợp; nhặt đồ rồi đứng chờ trong vùng farm."
          : settings.idleMode === "seek" ? (globalThis.GSTFarmMap?.status(s.scene) || "Đang dò vùng tìm quái mới sau khi nhặt đồ.")
          : "Không có quái phù hợp; Auto Farm quay về tâm farm gốc.";
      }
    } catch {
      stop("Auto Farm interface error; extended range stopped.", true);
    }
  }

  const diagnosticKeys = new Map();
  function diagnostic(scene, key, reason, extra = {}) {
    const time = scene?.now?.();
    if (!finite(time)) return;
    const previous = diagnosticKeys.get(key);
    if (finite(previous) && time - previous < 3) return;
    diagnosticKeys.set(key, time);
    if (diagnosticKeys.size > 64) diagnosticKeys.delete(diagnosticKeys.keys().next().value);
    globalThis.GSTMovementDiagnostics?.event?.(scene, reason, extra);
  }

  function shiftToward(s, enemy, searchRadius) {
    if (settings.searchScope === "map") { center(s, { x: enemy.x, y: enemy.y }); return; }
    const length = distance(enemy, s.home);
    // Keep the entire native search circle inside the configured farm boundary.
    const shift = Math.min(length, Math.max(0, settings.radius - searchRadius));
    const point = length > 0 ? {
      x: s.home.x + (enemy.x - s.home.x) / length * shift,
      y: s.home.y + (enemy.y - s.home.y) / length * shift
    } : s.home;
    if (distance(point, s.center) > 0.25 || distance(enemy, s.center) >= searchRadius) center(s, point);
  }

  globalThis.GSTFarmQuest = {
    ready: () => globalThis.GSTFarmConfigurationReady === true
      && ["extended", "custom"].includes(settings.policyMode) && settings.targetMode === "all",
    prepare(scene) {
      if (!this.ready() || !compatible(scene)) throw new Error("Farm configuration unavailable");
      blockedAuto = null; revival = null;
      if (settings.policyMode === "custom") {
        if (globalThis.GSTFarmUpdate?.installGate?.(scene) !== true) throw new Error("Custom Farm gate unavailable");
        globalThis.GSTCustomFarm?.configure?.(scene, settings);
        if (globalThis.GSTCustomFarm?.compatible?.(scene) !== true) throw new Error("Custom Farm dispatcher unavailable");
        globalThis.GSTFarmRevivePolicy?.attach(scene);
        globalThis.GSTFarmDefense?.attach(scene);
        globalThis.GSTFarmBossSafety?.attach(scene);
        return;
      }
      globalThis.GSTFarmCombat?.attach(scene);
      globalThis.GSTFarmRevivePolicy?.attach(scene);
      globalThis.GSTFarmBehavior?.attach(scene);
      globalThis.GSTFarmBossSafety?.attach(scene);
      globalThis.GSTFarmRouting?.attach(scene);
    }
  };

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== origin || event.data?.channel !== channel) return;
    const data = event.data;
    if (data.type === "shortcut" && (data.code === null || Number.isInteger(data.code)
        && ((data.code >= 48 && data.code <= 57) || (data.code >= 65 && data.code <= 90)
          || (data.code >= 112 && data.code <= 121 && data.code !== 116)))) {
      shortcut = data.code;
      shortcutMessage = "";
    }
    if (data.type === "control" && typeof data.requestId === "string") {
      const scene = sceneNow(), authority = globalThis.GSTIntentAuthority;
      let accepted = false, reason = "Lệnh bật/tắt đã hết hiệu lực hoặc khác controller/nhân vật.";
      const valid = () => !suspended && Number.isFinite(data.expiresAt) && Date.now() <= data.expiresAt
        && configurationReceived && globalThis.GSTFarmConfigurationReady === true
        && data.profileKey === settings.accountProfileKey && data.policyMode === settings.policyMode
        && typeof data.enabled === "boolean"
        && authority?.validate?.(data.token, "farm", data.enabled, settings.accountProfileKey);
      try {
        maintainActivationLock();
        if (valid() && scene?.auto && typeof scene.toggleAutoFarm === "function") {
          if (data.cancelOnly === true) {
            if (data.enabled) authority.retireFarm();
            reason = "Đã hủy yêu cầu chưa gửi tới Farm.";
          } else if (scene.auto.on === data.enabled) accepted = true;
          else {
            const attempt = { generation: gestureGeneration, scene, auto: scene.auto };
            shortcutIntent = attempt; shortcutMessage = "";
            try {
              authority.withIntent(data.token, () => { if (valid()) scene.toggleAutoFarm(); });
            } finally { if (shortcutIntent === attempt) shortcutIntent = null; }
            accepted = scene.auto.on === data.enabled;
          }
          if (!data.cancelOnly) reason = accepted ? (data.enabled ? "Farm đã bật." : "Farm đã tắt.")
            : shortcutMessage || (/^(Chưa bật|Không xác nhận|Thao tác)/.test(message) ? message
              : settings.policyMode === "tool" ? globalThis.GSTToolFarm?.status?.(scene) || message : message);
          // A refused ON must not remain an authorization for later activation.
          if (!accepted && data.enabled && valid()) authority.retireFarm();
        }
      } catch { reason = "Không bật/tắt được Farm; interface game có thể đã thay đổi."; }
      window.postMessage({ channel, type: "control-result", requestId: data.requestId,
        accepted, autoOn: scene?.auto?.on === true, reason }, origin);
      return;
    }
    if (data.type === "skill-diagnostics" && typeof data.requestId === "string") {
      let result = { accepted: false, enabled: false, reason: "policy_change" };
      if (settings.identityVerified && !identityBlocked && data.profileKey === settings.accountProfileKey
          && settings.policyMode === "tool") {
        try {
          globalThis.GSTFarmSkillDiagnostics?.setContext?.(sceneNow(), settings);
          result = globalThis.GSTFarmSkillDiagnostics?.control?.(sceneNow(), data.action,
            data.enabled, data.profileKey) ?? result;
        } catch { result = { accepted: false, enabled: false, reason: "manual_tracking_unavailable" }; }
      }
      window.postMessage({ channel, type: "skill-diagnostics-result", requestId: data.requestId,
        accepted: result.accepted === true, enabled: result.enabled === true,
        reason: typeof result.reason === "string" ? result.reason : "" }, origin);
      return;
    }
    if (data.type === "configure" && typeof data.enabled === "boolean"
        && finite(data.radius) && data.radius >= 1 && data.radius <= 1000) {
      configurationReceived = true;
      let stage = "settings";
      globalThis.GSTFarmConfigurationReady = false;
      syncRespawnObserver();
      configurationError = "";
      try {
      const scopeChanged = settings.searchScope !== (data.searchScope === "map" ? "map" : "radius");
      const radiusChanged = settings.radius !== data.radius;
      const filterChanged = settings.searchScope !== data.searchScope || settings.targetMode !== targetMode(data.targetMode)
        || settings.targetLevel !== data.targetLevel
        || settings.targetMinLevel !== data.targetMinLevel || settings.targetMaxLevel !== data.targetMaxLevel
        || settings.excludeBoss !== (data.excludeBoss === true)
        || settings.bossFilter !== (data.bossFilter === "world" ? "world" : "all");
      const retreatHpPercent = data.retreatHpPercent, recoveryHpPercent = data.recoveryHpPercent;
      const hpThresholds = Number.isSafeInteger(retreatHpPercent) && retreatHpPercent >= 1
        && Number.isSafeInteger(recoveryHpPercent) && retreatHpPercent < recoveryHpPercent && recoveryHpPercent <= 100
        ? { retreatHpPercent, recoveryHpPercent } : { retreatHpPercent: 40, recoveryHpPercent: 100 };
      if (settings.accountProfileKey !== (typeof data.accountProfileKey === "string" ? data.accountProfileKey : "")
          || settings.accountId !== (typeof data.accountId === "string" ? data.accountId : "")
          || settings.slot !== (typeof data.accountSlot === "string" ? data.accountSlot : "")
          || settings.character !== (typeof data.accountCharacter === "string" ? data.accountCharacter : "")
          || settings.characterId !== (typeof data.accountCharacterId === "string" ? data.accountCharacterId : "")
          || settings.classId !== (typeof data.accountClassId === "string" ? data.accountClassId : "")
          || settings.identityVerified !== (data.identityVerified === true)
          || identityBlocked !== (data.identityBlocked === true)) {
        globalThis.GSTIntentAuthority?.invalidate?.(); invalidateFarmGestures();
      }
      identityBlocked = data.identityBlocked === true;
      settings = { policyMode: globalThis.GSTFarmPolicy?.normalize(data.policyMode) ?? "tool",
        ...globalThis.GSTFarmPolicy?.actions?.(data),
        identityBlocked, identityVerified: data.identityVerified === true, customComparisonEnabled: data.customComparisonEnabled === true,
        accountProfileKey: typeof data.accountProfileKey === "string" ? data.accountProfileKey : "",
        accountId: typeof data.accountId === "string" ? data.accountId : "",
        slot: typeof data.accountSlot === "string" ? data.accountSlot : "",
        character: typeof data.accountCharacter === "string" ? data.accountCharacter : "",
        classId: typeof data.accountClassId === "string" ? data.accountClassId : "",
        characterId: typeof data.accountCharacterId === "string" ? data.accountCharacterId : "",
        acceptPartyInvites: data.acceptPartyInvites === true,
        allowPlayerTargets: data.allowPlayerTargets === true,
        enabled: data.enabled, radius: data.radius, autoRespawn: data.autoRespawn !== false,
        noRetreat: data.noRetreat !== false,
        bossDodge: data.bossDodge !== false, eliteDodge: data.eliteDodge === true, bossRetreat: data.bossRetreat !== false,
        ...hpThresholds,
        showTargetLine: data.showTargetLine === true, showRange: data.showRange === true,
        nearbyClear: data.nearbyClear === true,
        nearbyRadius: Number.isSafeInteger(data.nearbyRadius)
          ? Math.max(1, Math.min(6, data.nearbyRadius)) : 2,
        searchScope: data.searchScope === "map" ? "map" : "radius",
        targetMode: targetMode(data.targetMode),
        targetLevel: Number.isSafeInteger(data.targetLevel) && data.targetLevel > 0 ? data.targetLevel : 1,
        targetMinLevel: Number.isSafeInteger(data.targetMinLevel) && data.targetMinLevel > 0 ? data.targetMinLevel : 1,
        targetMaxLevel: Number.isSafeInteger(data.targetMaxLevel) && data.targetMaxLevel > 0 ? data.targetMaxLevel : 20,
        idleMode: ["home", "seek"].includes(data.idleMode) ? data.idleMode : "hold",
        preferLoot: data.preferLoot !== false, selfDefense: data.selfDefense === true, autoEncounter: data.autoEncounter === true, excludeBoss: data.excludeBoss === true,
        bossFilter: data.bossFilter === "world" ? "world" : "all" };
      globalThis.GSTFarmSkillDiagnostics?.setContext?.(sceneNow(), settings);
      globalThis.GSTToolFarm?.configure?.(sceneNow(), settings);
      globalThis.GSTFarmPlanner?.configure?.(sceneNow(), settings);
      stage = "policy";
      const modeScene = sceneNow();
      if (configuredPolicyMode === null || configuredPolicyMode !== settings.policyMode) {
        invalidateFarmGestures();
        globalThis.GSTIntentAuthority?.retireFarm?.();
        stopFarmOwner(modeScene);
      }
      if (settings.policyMode === "custom" && modeScene?.auto
          && globalThis.GSTFarmUpdate?.installGate?.(modeScene) !== true)
        message = "Custom Farm không khả dụng: không bảo vệ được controller.";
      configuredPolicyMode = settings.policyMode;
      globalThis.GSTFarmPolicy?.setMode(settings.policyMode);
      syncFarmKeyGuard();
      stage = "session";
      globalThis.GSTFarmSession?.setIdentityBlocked?.(identityBlocked, sceneNow());
      globalThis.GSTFarmSession?.setPolicyMode?.(settings.policyMode, sceneNow());
      if (settings.policyMode !== "extended" || identityBlocked) stopForLockedPolicy();
      globalThis.GSTCustomFarm?.configure?.(sceneNow(), settings);
      // The shared gate also protects replacement controllers in inert tool mode.
      stage = "revive";
      const farmRuntimeSettings = identityBlocked || !globalThis.GSTFarmPolicy?.hasExtensionAssistance?.() ? { ...settings, enabled: false,
        autoRespawn: false, selfDefense: false, nearbyClear: false, autoEncounter: false,
        bossDodge: false, eliteDodge: false, bossRetreat: false, noRetreat: true } : settings;
      globalThis.GSTFarmRevivePolicy?.configure(identityBlocked ? false : settings.autoRespawn);
      stage = "combat";
      globalThis.GSTFarmCombat?.configure(sceneNow(), identityBlocked ? false : settings.noRetreat);
      stage = "boss-safety";
      globalThis.GSTFarmBossSafety?.configure(sceneNow(), farmRuntimeSettings);
      stage = "behavior";
      globalThis.GSTFarmBehavior?.configure(sceneNow(), farmRuntimeSettings);
      stage = "defense";
      globalThis.GSTFarmDefense?.configure(sceneNow(), farmRuntimeSettings);
      stage = "encounter";
      globalThis.GSTFarmEncounter?.configure(sceneNow(), farmRuntimeSettings);
      stage = "party";
      globalThis.GSTFarmParty?.configure(sceneNow(), farmRuntimeSettings);
      stage = "map";
      globalThis.GSTFarmMap?.configure(sceneNow(), settings.policyMode !== "extended" || identityBlocked
        ? { ...farmRuntimeSettings, enabled: false, searchScope: "radius", targetMode: "all", excludeBoss: false }
        : farmRuntimeSettings);
      stage = "visual";
      globalThis.GSTFarmVisual?.configure(sceneNow(), settings);
      stage = "routing";
      globalThis.GSTFarmRouting?.configure(sceneNow(), farmRuntimeSettings);
      stage = "diagnostics";
      globalThis.GSTMovementDiagnostics?.configure(settings);
      globalThis.GSTFarmDiagnostics?.attach(sceneNow());
      stage = "activation";
      syncActivationTracking();
      globalThis.GSTFarmCombat?.attach(sceneNow());
      globalThis.GSTFarmRevivePolicy?.attach(sceneNow());
      stage = "filter";
      if (settings.policyMode === "extended" && !identityBlocked && compatible(sceneNow())) syncFilter(sceneNow());
      else clearFilter();
      if (settings.policyMode === "extended") clearExcludedBossTarget(sceneNow());
      if (session) {
        if (scopeChanged) { restore(session); session.at = -Infinity; }
        if (radiusChanged && settings.searchScope === "radius") {
          // Rebase only our shifted search center; the session origin stays fixed.
          const aligned = globalThis.GSTFarmMap?.consumeCenter?.(session.scene);
          if (aligned && session.auto.ax === aligned.x && session.auto.ay === aligned.y)
            session.center = { ...aligned };
          if (owned(session) && !session.auto.moved && !GSTFarmInput.movement(session.scene)
              && session.scene.now() >= session.auto.pauseUntil) center(session, session.home);
          session.at = -Infinity;
          session.auto.think = 0;
        }
        syncFilter(session.scene);
        if (filterChanged) { session.auto.think = 0; session.rankTarget = null; }
        if (!settings.enabled) restore(session);
      }
      if (!settings.autoRespawn) respawnMessage = "";
      stage = "start";
      if (identityBlocked) {
        if (watcher !== null) clearInterval(watcher);
        watcher = null;
        shortcutMessage = "";
        message = "Farm đang tạm khóa cho tới khi xác nhận đúng tài khoản; ý định đã lưu được giữ nguyên.";
      } else if (settings.policyMode === "native") {
        if (watcher !== null) clearInterval(watcher);
        watcher = null;
        shortcutMessage = "";
        message = "Chế độ Native: Auto Farm do game điều khiển; hỗ trợ farm của extension đang tắt.";
      } else if (settings.policyMode === "tool") {
        shortcutMessage = "";
        message = toolUnavailable;
      } else if (settings.policyMode === "disabled") {
        shortcutMessage = "";
        message = "Auto Farm đang bị khóa bởi chế độ Disabled; tùy chọn đã lưu vẫn được giữ.";
      } else {
        watch();
        discover();
      }
      globalThis.GSTFarmConfigurationReady = true;
      syncRespawnObserver();
      } catch (error) {
        // Export only a fixed stage and standard error class, never raw messages/stacks.
        const kind = ["TypeError", "ReferenceError", "RangeError", "SyntaxError"].includes(error?.name)
          ? error.name : "Error";
        configurationError = `Chưa áp dụng xong cấu hình Auto Farm: ${stage} (${kind}).`;
      }
    }
    if (data.type === "status") {
      let autoOn = null;
      let dead = null;
      let waitReason = "";
      try {
        const scene = sceneNow();
        if (typeof scene?.auto?.on === "boolean") autoOn = scene.auto.on;
        if (scene?.self) dead = !!scene.self.dead;
        waitReason = nativeWaitReason(scene);
      } catch { /* Read-only status must not start or restart gameplay. */ }
      const scene = sceneNow();
      const defense = globalThis.GSTFarmDefense?.status(scene) || "";
      const network = globalThis.GSTConnectionRecovery?.status(scene) || "";
      const primary = configurationError || (identityBlocked || settings.policyMode === "disabled" || settings.policyMode === "tool" ? message
        : network || defense || globalThis.GSTFarmBossSafety?.status(scene) || waitReason
        || globalThis.GSTFarmParty?.status(scene) || globalThis.GSTFarmMap?.status(scene) || globalThis.GSTFarmBehavior?.status(scene)
        || globalThis.GSTFarmSession?.status(scene) || globalThis.GSTFarmSeals?.status(scene) || message);
      const defenseInfo = autoOn === false && !defense ? globalThis.GSTFarmDefense?.status(scene, true) : "";
      const encounterInfo = globalThis.GSTFarmEncounter?.status(scene) || "";
      // Status may compute a read-only proposal, never an activation/action.
      globalThis.GSTFarmPlanner?.configure?.(scene, settings);
      const proposal = globalThis.GSTFarmPlanner?.preview?.(scene);
      const toolState = settings.policyMode === "tool" ? globalThis.GSTToolFarm?.state?.(scene) ?? "OFF" : null;
      const toolMessage = settings.policyMode === "tool" ? globalThis.GSTToolFarm?.status?.(scene) ?? toolUnavailable : "";
      const planner = proposal ? { state: proposal.state, reason: proposal.reason,
        executable: false, targetId: proposal.targetId, waypointCount: proposal.path.length } : null;
      window.postMessage({ channel: "gst:farm-status:v1", requestId: data.requestId,
        configurationReceived, configurationReady: globalThis.GSTFarmConfigurationReady === true,
        message: (settings.policyMode === "extended" && targetFilterActive() ? `${filterLabel()}. ` : "") + (shortcutMessage
          || (dead && respawnMessage ? respawnMessage : configurationError || (toolState === "OFF" && /^(Chưa bật|Không xác nhận|Thao tác)/.test(message) ? message : toolMessage) || primary)) + (defenseInfo ? ` · ${defenseInfo}` : ""),
        encounterStatus: encounterInfo,
        toolState, planner, autoOn, dead, policyMode: settings.policyMode, customState: settings.policyMode === "custom" ? globalThis.GSTCustomFarm?.state?.(scene) ?? "WAITING_FOR_DATA" : null, customComparisonEnabled: settings.customComparisonEnabled === true, customStats: settings.policyMode === "custom" ? globalThis.GSTCustomFarm?.stats?.(scene) ?? null : null, active: settings.policyMode === "tool" ? globalThis.GSTToolFarm?.active?.(scene) === true : settings.policyMode === "custom" ? globalThis.GSTCustomFarm?.active?.(scene) === true : session !== null, radius: settings.radius }, origin);
    }
  });
  window.addEventListener("pagehide", () => {
    invalidateFarmGestures();
    window.removeEventListener("keydown", guardFarmKey, true);
    window.removeEventListener("pointerdown", noteTrustedInput, true);
    window.removeEventListener("keydown", noteTrustedInput, true);
    suspended = true;
    configurationReceived = false;
    globalThis.GSTFarmConfigurationReady = false;
    syncRespawnObserver();
    clearActivationLock(); clearInterval(activationWatcher); activationWatcher = null;
    revival = null;
    respawnMessage = "";
    if (watcher !== null) clearInterval(watcher);
    watcher = null;
    clearFilter();
    // A BFCache pause is not a disconnect: retain any existing disconnect
    // block, but do not create one for the healthy session being suspended.
    stop("Page left; extended range stopped.");
  });
  window.addEventListener("pageshow", () => {
    window.addEventListener("pointerdown", noteTrustedInput, true);
    window.addEventListener("keydown", noteTrustedInput, true);
    syncFarmKeyGuard();
    suspended = false;
    syncActivationTracking();
    syncRespawnObserver();
    watch();
    discover();
  });
  window.postMessage({ channel: "gst:farm-status:v1", ready: true }, origin);
})();
