(() => {
  "use strict";
  // Planning only: no update subscription, timer, movement, target lock or action API.
  const sessions = new WeakMap(), liveScenes = new Set(), finite = Number.isFinite;
  const sceneNow = () => window.game?.scene?.getScene?.("world")
    ?? (window.__ntkScene?.sys?.settings?.key === "world" ? window.__ntkScene : null);
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const waiting = (reason) => ({ state: "WAITING", reason, executable: false, targetId: null, path: [] });
  function reset(scene) {
    const state = scene && sessions.get(scene);
    if (!state) return;
    scene.events?.off?.("shutdown", state.dispose); scene.events?.off?.("destroy", state.dispose);
    sessions.delete(scene); liveScenes.delete(scene);
  }
  function configure(scene, options) {
    if (!scene || options?.policyMode !== "tool" || options.identityBlocked || !options.identityVerified) {
      reset(scene); return;
    }
    if (!scene.events?.on || !scene.events.off) { reset(scene); return; }
    const key = JSON.stringify([options.accountProfileKey, options.accountId, options.slot,
      options.character, options.characterId, options.classId, options.radius, options.targetMode,
      options.targetLevel, options.targetMinLevel, options.targetMaxLevel, options.excludeBoss, options.bossFilter]);
    if (sessions.get(scene)?.key === key) return;
    reset(scene);
    const state = { key, options: { ...options }, auto: scene.auto, map: null, collision: null,
      origin: null, targetId: null, rejected: new Map(), at: -Infinity, result: null };
    state.dispose = () => reset(scene);
    sessions.set(scene, state); liveScenes.add(scene);
    scene.events.on("shutdown", state.dispose); scene.events.on("destroy", state.dispose);
  }
  function yieldPlan(state, reason) {
    state.targetId = null; state.result = null; state.at = -Infinity;
    return waiting(reason);
  }
  function matches(enemy, options) {
    const classification = globalThis.GSTFarmMonsterClassification;
    if (!classification?.classify(enemy) || enemy.dead || !Number.isSafeInteger(enemy.id) || enemy.id <= 0
        || ![enemy.x, enemy.y].every(finite) || !(enemy.hostile === true || enemy.aggro === false)) return false;
    const boss = classification.isBoss(enemy), mode = options.targetMode;
    if (options.bossFilter === "world" && boss && !classification.isWorldBoss(enemy)) return false;
    if (boss && (options.excludeBoss || ["highLevel", "lowLevel"].includes(mode))) return false;
    if (mode === "boss") return boss;
    if (["maxLevel", "minLevel", "range"].includes(mode) && !finite(enemy.lv)) return false;
    if (mode === "maxLevel") return enemy.lv <= options.targetLevel;
    if (mode === "minLevel") return enemy.lv >= options.targetLevel;
    if (mode === "range") return options.targetMinLevel <= options.targetMaxLevel
      && enemy.lv >= options.targetMinLevel && enemy.lv <= options.targetMaxLevel;
    return ["all", "bossLevel", "highLevel", "lowLevel"].includes(mode);
  }
  function rank(a, b, pos, mode) {
    if (mode === "bossLevel") {
      const delta = Number(globalThis.GSTFarmMonsterClassification.isBoss(b))
        - Number(globalThis.GSTFarmMonsterClassification.isBoss(a));
      if (delta) return delta;
    }
    if (["bossLevel", "highLevel", "lowLevel"].includes(mode)) {
      // Unknown levels sort last in either direction.
      if (finite(a.lv) !== finite(b.lv)) return finite(a.lv) ? -1 : 1;
      if (finite(a.lv) && a.lv !== b.lv) return mode === "lowLevel" ? a.lv - b.lv : b.lv - a.lv;
    }
    return distance(a, pos) - distance(b, pos) || a.id - b.id;
  }
  function preview(scene) {
    const state = scene && sessions.get(scene);
    if (!state || sceneNow() !== scene || !globalThis.GSTFarmPolicy?.isTool?.()
        || globalThis.GSTFarmConfigurationReady !== true) return waiting("not_configured");
    const options = state.options;
    try {
      if (scene.auto !== state.auto) { reset(scene); return waiting("controller_changed"); }
      if (!scene.sys?.isActive?.() || scene.leaving || scene.self?.dead || !scene.self) return yieldPlan(state, "scene_unavailable");
      if (String(scene.you) !== options.characterId || scene.profile?.classId !== options.classId
          || scene.profile?.name?.normalize?.("NFC") !== options.character
          || (new URLSearchParams(location.search).get("slot") ?? "") !== (options.slot ?? "")) {
        reset(scene); return waiting("identity_changed");
      }
      const driver = scene.driver, time = scene.now?.();
      if (!driver || driver.closing || driver.reconnecting || driver.displaced
          || !(driver.online === false || driver.link?.open?.() === true)
          || ![time, scene.selfAt, scene.px, scene.py].every(finite)
          || time < scene.selfAt || time - scene.selfAt > 3) return yieldPlan(state, "stale_data");
      const host = scene.autoHost?.(), map = host?.mapKey?.();
      if (typeof map !== "string" || !map || !scene.collision) return yieldPlan(state, "map_unavailable");
      if (state.map !== map || state.collision !== scene.collision) {
        state.map = map; state.collision = scene.collision; state.origin = null;
        state.rejected.clear(); yieldPlan(state, "map_changed");
      }
      if (scene.auto.on === true || document.hidden || !document.hasFocus() || scene.uiBlocked || scene.keyCapture
          || scene.chat?.typing || scene.heldAttack || scene.pendingSkill || scene.aiming || scene.dashT > 0
          || scene.self.med || scene.lockUntil > time || scene.skillLockUntil > time || scene.moveLockUntil > time
          || globalThis.GSTFarmInput?.movement?.(scene)
          || [globalThis.GSTHarvest, globalThis.GSTQuest, globalThis.GSTMapTravel,
            globalThis.GSTFarmSeals, globalThis.GSTFarmBossSafety, globalThis.GSTFarmDefense]
            .some((owner) => owner?.controls?.(scene) === true)) return yieldPlan(state, "yielding");
      const pos = { x: scene.px, y: scene.py }, width = scene.map?.w, height = scene.map?.h;
      if (![width, height, options.radius].every(finite) || width <= 0 || height <= 0
          || options.radius < 1 || options.radius > 1000) return yieldPlan(state, "invalid_boundary");
      state.origin ??= { ...pos };
      const allowed = (point) => point && [point.x, point.y].every(finite) && point.x >= 0 && point.y >= 0
        && point.x < width && point.y < height && distance(point, state.origin) <= options.radius;
      if (!allowed(pos)) return yieldPlan(state, "outside_radius");
      const enemies = host.enemies?.();
      if (!Array.isArray(enemies)) return yieldPlan(state, "targets_unavailable");
      for (const [id, skip] of state.rejected) if (time >= skip.until || time < skip.at) state.rejected.delete(id);
      const candidates = enemies.filter((enemy) => matches(enemy, options) && allowed(enemy));
      const retained = candidates.find((enemy) => enemy.id === state.targetId);
      // Reuse only a still-current path after rechecking every segment from the
      // current position. Cache copies never expose our internal retained plan.
      if (retained && state.result && time >= state.at && time - state.at < 0.5
          && distance(retained, state.result.target) < 0.01) {
        let previous = pos;
        const valid = state.result.path.every((pair) => {
          const point = { x: pair[0], y: pair[1] };
          const clear = allowed(point) && host.clear(previous.x, previous.y, point.x, point.y) === true;
          previous = point; return clear;
        });
        if (valid) return copy(state.result);
      }
      if (time >= state.at && time - state.at < 0.5) return waiting("planning_throttled");
      state.at = time;
      const ordered = candidates.sort((a, b) => rank(a, b, pos, options.targetMode));
      if (retained) { ordered.splice(ordered.indexOf(retained), 1); ordered.unshift(retained); }
      state.targetId = null; state.result = null;
      let probes = 0;
      for (const enemy of ordered) {
        const skip = state.rejected.get(enemy.id);
        if (skip && distance(skip, enemy) < 1) continue;
        if (++probes > 6) break;
        const path = globalThis.GSTNavigation?.planRoute?.(host, pos, enemy, allowed);
        if (!path) {
          state.rejected.set(enemy.id, { x: enemy.x, y: enemy.y, at: time, until: time + 5 });
          if (state.rejected.size > 128) state.rejected.delete(state.rejected.keys().next().value);
          continue;
        }
        state.targetId = enemy.id;
        state.result = { state: "PLANNED", reason: "proposal_only", executable: false,
          targetId: enemy.id, target: { x: enemy.x, y: enemy.y }, origin: { ...state.origin },
          radius: options.radius, path, plannedAt: time };
        return copy(state.result);
      }
      return { ...waiting(candidates.length ? "no_route_in_probe_budget" : "no_target"), state: "SEARCHING" };
    } catch { return yieldPlan(state, "data_unavailable"); }
  }
  function copy(result) {
    return { ...result, target: { ...result.target }, origin: { ...result.origin }, path: result.path.map((p) => [...p]) };
  }
  globalThis.GSTFarmPlanner = Object.freeze({ configure, preview, reset });
  window.addEventListener("pagehide", () => { for (const scene of [...liveScenes]) reset(scene); });
})();
