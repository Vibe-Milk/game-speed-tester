(() => {
  "use strict";
  const sessions = new WeakMap(), messages = new WeakMap(), scenes = new Set(), finite = Number.isFinite;
  const currentScene = () => window.game?.scene?.getScene?.("world")
    ?? (window.__ntkScene?.sys?.settings?.key === "world" ? window.__ntkScene : null);
  const key = (o) => JSON.stringify([o.policyMode, o.identityVerified, o.identityBlocked, o.accountProfileKey,
    o.accountId, o.slot, o.character, o.characterId, o.classId, o.radius, o.targetMode,
    o.targetLevel, o.targetMinLevel, o.targetMaxLevel, o.excludeBoss, o.bossFilter,
    o.skillMode, o.skillEnabled, o.skillPriority, o.pickupMode]);
  function otherOwner(scene, allowHarvest = false) {
    return [globalThis.GSTHarvest, globalThis.GSTQuest, globalThis.GSTMapTravel,
      globalThis.GSTFarmSeals, globalThis.GSTFarmBossSafety, globalThis.GSTFarmDefense]
      .some((owner) => !(allowHarvest && owner === globalThis.GSTHarvest) && owner?.controls?.(scene) === true);
  }
  function movementOwned(scene) {
    const s = sessions.get(scene);
    return !!s?.vector && s.auto === scene.auto && scene.autoX === s.vector[0] && scene.autoY === s.vector[1];
  }
  function release(s) {
    const scene = s.scene;
    globalThis.GSTNavigation?.cancel?.(scene, s.nav);
    if (movementOwned(scene) && !otherOwner(scene) && !globalThis.GSTFarmInput?.movement?.(scene))
      scene.autoX = scene.autoY = 0;
    if (s.lockId !== null && scene.lockId === s.lockId && !otherOwner(scene) && !scene.heldAttack && !scene.aiming)
      scene.lockId = 0;
    s.vector = null; s.lockId = null; s.nav.path = []; s.pathAt = null; s.leg = null; s.progressAt = null;
  }
  function stop(scene, reason) {
    const s = scene && sessions.get(scene); if (!s) return;
    reason ??= s.enabled ? "Bạn đã tắt Farm của tool." : s.message;
    s.enabled = false; s.skillAction = null; s.lifecycle = null; s.state = "OFF"; s.message = reason; messages.set(scene, reason); release(s);
    globalThis.GSTFarmPlanner?.reset?.(scene);
  }
  function halt(s, reason) {
    stop(s.scene, reason);
    globalThis.GSTFarmActivation?.stop?.(s.scene);
  }
  function dispose(scene) {
    const s = sessions.get(scene); if (!s) return;
    stop(scene); s.remove?.();
    scene.events.off("preupdate", s.guard); scene.events.off("shutdown", s.dispose); scene.events.off("destroy", s.dispose);
    sessions.delete(scene); scenes.delete(scene);
  }
  function configure(scene, options) {
    const s = scene && sessions.get(scene);
    if (s && (s.auto !== scene.auto || s.key !== key(options))) {
      halt(s, "Đã đổi cấu hình hoặc nhân vật; bật Farm lại để bắt đầu phiên mới."); dispose(scene);
    }
  }
  function context(s, starting = false) {
    const scene = s.scene, o = s.options, time = scene.now?.();
    if (currentScene() !== scene || scene.auto !== s.auto || !scene.sys?.isActive?.() || scene.leaving
        || !scene.self || scene.self.dead || !globalThis.GSTFarmPolicy?.isTool?.()
        || globalThis.GSTFarmConfigurationReady !== true || !o.identityVerified || o.identityBlocked
        || !o.accountProfileKey || String(scene.you) !== o.characterId || scene.profile?.classId !== o.classId
        || scene.profile?.name?.normalize?.("NFC") !== o.character
        || (new URLSearchParams(location.search).get("slot") ?? "") !== (o.slot ?? "")) return "Ngữ cảnh Farm đã thay đổi.";
    if (starting && o.pickupMode === "tool") return "Nhặt theo tool đang khóa: chưa có API tắt nhặt gần độc lập của game.";
    if (o.skillMode === "game" && typeof s.auto.castSkills !== "function")
      return "Thiếu bộ chọn kỹ năng mặc định của game; Farm đã dừng.";
    const driver = scene.driver;
    if (!driver || driver.closing || driver.reconnecting || driver.displaced
        || !(driver.online === false || driver.link?.open?.() === true)
        || ![time, scene.selfAt, scene.px, scene.py].every(finite) || time < scene.selfAt || time - scene.selfAt > 3)
      return "Dữ liệu hoặc kết nối game chưa sẵn sàng.";
    if (!globalThis.GSTFarmUpdate?.gateReady?.(scene) || !globalThis.GSTFarmUpdate?.attached?.(scene)) return "Mất quyền điều phối Farm.";
    const host = scene.autoHost?.();
    if (!host || !["enemies", "clear", "route", "steer", "face", "basic", "mapKey"].every((name) => typeof host[name] === "function"))
      return "Thiếu thao tác gốc của game.";
    if (!starting && (host.mapKey() !== s.map || scene.collision !== s.collision || time < s.lastTime)) return "Đã đổi map hoặc đồng hồ game.";
    if (!starting) {
      const intent = globalThis.GSTIntentAuthority?.current?.();
      if (!intent || intent.lifecycle !== s.lifecycle || intent.feature === "farm" && !intent.enabled
          || intent.feature === "harvest" && intent.enabled && globalThis.GSTHarvest?.needsFarmCoordination?.())
        return "Quyền bật Farm đã hết hiệu lực.";
      if (Math.hypot(scene.px - s.origin.x, scene.py - s.origin.y) > o.radius) return "Đã ra ngoài bán kính Farm; bật lại để đặt tâm mới.";
    }
    return "";
  }
  function pauseReason(s, starting = false) {
    const scene = s.scene;
    if (performance.now() < s.manualUntil) return "Đang chờ sau thao tác tay.";
    if (document.hidden) return "Tab game đang bị ẩn.";
    if (!document.hasFocus()) return "Tab game chưa có focus; quay lại tab game rồi thử lại.";
    if (scene.chat?.typing) return "Đang nhập chat.";
    if (scene.keyCapture) return "Game đang chờ nhập phím tắt.";
    if (scene.inputFieldActive?.()) return "Ô nhập của game đang nhận bàn phím.";
    if (scene.overlay?.dialogOpen) return "Game đang mở hộp thoại.";
    if (scene.panels?.open) return "Game đang mở bảng thông tin; đóng bảng trước khi bật Farm.";
    if (scene.uiBlocked) return "Game đang khóa thao tác; kiểm tra hướng màn hình hoặc bảng đang mở.";
    if (scene.heldAttack) return "Đang giữ đánh thường bằng tay.";
    if (scene.pendingSkill) return "Đang có kỹ năng chờ xử lý.";
    if (scene.aiming) return "Đang ngắm kỹ năng bằng tay.";
    if (scene.self?.med) return "Nhân vật đang thiền; dừng thiền trước khi bật Farm.";
    if (scene.self?.fish) return "Nhân vật đang câu cá.";
    if (scene.dashT > 0) return "Nhân vật đang lướt.";
    const owners = [[globalThis.GSTHarvest, "Thu hoạch"], [globalThis.GSTQuest, "Auto Quest"],
      [globalThis.GSTMapTravel, "Đi tới bản đồ"], [globalThis.GSTFarmSeals, "Phong ấn"],
      [globalThis.GSTFarmBossSafety, "Né boss"], [globalThis.GSTFarmDefense, "Tự vệ"]];
    for (const [owner, name] of owners) {
      if (starting && owner === globalThis.GSTHarvest && owner?.needsFarmCoordination?.() === true) continue;
      if (owner?.controls?.(scene) === true) return name + " đang giữ quyền điều khiển.";
    }
    if (globalThis.GSTFarmInput?.movement?.(scene))
      return scene.clickOrder ? "Còn lệnh đi/đánh bằng chuột; dừng lệnh trước khi bật Farm."
        : "Phím di chuyển hoặc joystick vẫn đang giữ.";
    return "";
  }
  const paused = (s, starting = false) => !!pauseReason(s, starting);
  function movementBlocked(scene) {
    const fx = scene.self?.fx ?? "";
    return scene.moveLockUntil > scene.now() || (scene.self?.ml ?? 0) > 0.05
      || fx.includes("s") || fx.includes("r");
  }
  function guard(s) {
    if (!s.enabled) return;
    try {
      if (!s.auto.on) { stop(s.scene); return; }
      const error = context(s); if (error) { halt(s, error); return; }
      if (paused(s)) { release(s); s.state = "PAUSED"; s.message = pauseReason(s); return; }
      const scene = s.scene, point = s.leg;
      // Native move() cannot advance during these locks. Forget the progress
      // baseline without charging a stuck retry or rejecting the target.
      if (movementBlocked(scene)) { release(s); return; }
      if (s.vector && (s.fix !== scene.self.fix || !point
          || !scene.autoHost().clear(scene.px, scene.py, point[0], point[1]))) {
        release(s); globalThis.GSTFarmPlanner.invalidateRoute(scene);
      }
    } catch { halt(s, "Farm đã dừng vì interface game thay đổi."); }
  }
  function prepare(scene, options) {
    configure(scene, options);
    let s = sessions.get(scene);
    if (!s) {
      s = { scene, auto: scene.auto, options: { ...options }, key: key(options), enabled: false,
        state: "OFF", message: "Farm của tool đang tắt.", vector: null, lockId: null, nav: { path: [] },
        leg: null, manualUntil: 0, progressAt: null, retries: 0, targetId: null, nextAttack: -Infinity };
      s.guard = () => guard(s); s.dispose = () => dispose(scene);
      sessions.set(scene, s); scenes.add(scene);
      try {
        s.remove = GSTFarmUpdate.add(scene, 1000, (host, time) => {
          if (!globalThis.GSTFarmPolicy?.isTool?.()) return false;
          try { update(s, host, time); } catch { halt(s, "Farm đã dừng vì dữ liệu hành động không hợp lệ."); }
          return true; // Never run native or legacy Custom fallback.
        });
        scene.events.on("preupdate", s.guard); scene.events.on("shutdown", s.dispose); scene.events.on("destroy", s.dispose);
      } catch { dispose(scene); return false; }
    }
    const error = context(s, true);
    if (error) { s.message = error; messages.set(scene, error); }
    if (!error && paused(s, true)) { s.message = pauseReason(s, true); messages.set(scene, s.message); return false; }
    return !error;
  }
  function start(scene, intent) {
    const s = sessions.get(scene);
    if (!s || context(s, true) || paused(s) || !scene.auto.on
        || !globalThis.GSTIntentAuthority?.validate?.(intent, "farm", true, s.options.accountProfileKey)) return false;
    GSTFarmPlanner.configure(scene, s.options);
    const origin = { x: scene.px, y: scene.py };
    if (!GSTFarmPlanner.begin(scene, origin)) return false;
    s.origin = origin; s.map = scene.autoHost().mapKey(); s.collision = scene.collision;
    s.lifecycle = intent.lifecycle; s.lastTime = scene.now(); s.enabled = true;
    s.skillRotation = { nextSlot: 0 }; s.skillAction = null; s.targetId = null; s.retries = 0; s.nextAttack = -Infinity; s.progressAt = null;
    messages.delete(scene); s.state = "SEARCH"; s.message = "Farm của tool: tìm quái trong bán kính đã lưu.";
    return true;
  }
  function update(s, host, time) {
    if (!s.enabled) return;
    guard(s); if (!s.enabled || paused(s)) return;
    const scene = s.scene;
    // Native WorldScene may skip auto.update during an action lock; guard still
    // runs on preupdate to release movement before the next native move().
    if (scene.lockUntil > time || scene.skillLockUntil > time || scene.moveLockUntil > time) { release(s); return; }
    s.lastTime = time;
    if (globalThis.GSTFarmSkills?.waiting?.(scene, s.skillAction, time)) { release(s); return; }
    s.skillAction = null;
    const plan = GSTFarmPlanner.plan(scene);
    if (plan.state !== "PLANNED") { release(s); s.state = "SEARCH"; s.message = "Đang chờ mục tiêu hoặc đường đi hợp lệ."; return; }
    const target = host.enemies().find((e) => e.id === plan.targetId && !e.dead
      && globalThis.GSTFarmMonsterClassification?.classify(e));
    if (!target || Math.hypot(target.x - plan.target.x, target.y - plan.target.y) > 0.01) { release(s); return; }
    if (target.id !== s.targetId) { s.targetId = target.id; s.retries = 0; s.progressAt = null; }
    const distance = Math.hypot(target.x - scene.px, target.y - scene.py);
    const allowed = (point) => point && [point.x, point.y].every(finite) && point.x >= 0 && point.y >= 0
      && point.x < scene.map.w && point.y < scene.map.h
      && Math.hypot(point.x - s.origin.x, point.y - s.origin.y) <= s.options.radius;
    // Custom restarts at priority[0]; game mode retains its private rotation.
    if (s.options.skillMode === "game" || s.options.skillEnabled?.length) {
      const permitted = () => !context(s) && !paused(s);
      s.skillAction = s.options.skillMode === "game"
        ? GSTFarmSkills.tryDefault(scene, host, s.auto, s.skillRotation, target, allowed, permitted)
        : GSTFarmSkills.tryPriority(scene, host, s.options, target, allowed, permitted);
      if (s.skillAction) { release(s); s.state = "COMBAT"; s.message = `Đã yêu cầu kỹ năng ô ${s.skillAction.slot}; chờ game cập nhật.`; return; }
    }
    if (distance <= plan.reach && host.clear(scene.px, scene.py, target.x, target.y) === true) {
      release(s); s.state = "COMBAT"; s.message = "Farm của tool: đánh thường mục tiêu đã chọn.";
      if (time < s.nextAttack || scene.skillWait?.("Space") > 0) return;
      // Final synchronous ownership check before the only combat action.
      if (context(s) || paused(s)) return;
      host.face(target.x, target.y, target.id); s.lockId = scene.lockId;
      s.nextAttack = time + 0.15; host.basic(); // Native cooldown/resource/server checks remain authoritative.
      return;
    }
    // Root can still allow legal in-range actions above; only approach waits.
    if (movementBlocked(scene)) {
      release(s); s.state = "PAUSED"; s.message = "Farm đang chờ game mở khóa di chuyển."; return;
    }
    if (s.pathAt !== plan.plannedAt) { s.nav.path = plan.path.map((p) => [...p]); s.pathAt = plan.plannedAt; }
    while (s.nav.path.length > 1 && Math.hypot(s.nav.path[0][0] - scene.px, s.nav.path[0][1] - scene.py) <= 0.3) s.nav.path.shift();
    const point = s.nav.path[0];
    if (!point || !host.clear(scene.px, scene.py, point[0], point[1])) { release(s); GSTFarmPlanner.invalidateRoute(scene); return; }
    if (s.progressAt === null || Math.hypot(scene.px - s.progressX, scene.py - s.progressY) >= 0.2) {
      s.progressAt = time; s.progressX = scene.px; s.progressY = scene.py;
    } else if (time - s.progressAt >= 1.5) {
      const failedId = ++s.retries >= 3 ? target.id : null;
      GSTFarmPlanner.invalidateRoute(scene, failedId); release(s);
      if (failedId !== null) { s.targetId = null; s.retries = 0; }
      s.state = "SEARCH"; s.message = "Đang tính lại đường; tạm bỏ mục tiêu bị kẹt."; return;
    }
    const dx = point[0] - scene.px, dy = point[1] - scene.py, length = Math.hypot(dx, dy);
    if (length < 0.1) { release(s); GSTFarmPlanner.invalidateRoute(scene); return; }
    if (context(s) || paused(s)) { release(s); return; }
    host.steer(dx / length, dy / length); s.vector = [scene.autoX, scene.autoY]; s.fix = scene.self.fix; s.leg = [...point];
    GSTNavigation.schedule(scene, s.nav, plan.goal.x, plan.goal.y, 0.1);
    s.state = "APPROACH"; s.message = "Farm của tool: di chuyển theo đường đã kiểm tra.";
  }
  globalThis.GSTToolFarm = Object.freeze({ configure, prepare, start, stop, dispose, movementOwned,
    active: (scene) => sessions.get(scene)?.enabled === true,
    state: (scene) => sessions.get(scene)?.state ?? "OFF",
    status: (scene) => sessions.get(scene)?.message ?? messages.get(scene) ?? "Farm của tool: dùng nút/phím Farm để bắt đầu.",
    manual(scene) {
      const s = scene && sessions.get(scene); if (!s?.enabled) return;
      release(s); s.lockId = null; s.manualUntil = performance.now() + 700;
    } });
  window.addEventListener("pagehide", () => { for (const scene of [...scenes]) { halt(sessions.get(scene), "Trang đã đóng; cần bật Farm lại."); dispose(scene); } });
})();
