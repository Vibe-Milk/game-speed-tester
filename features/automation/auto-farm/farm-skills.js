(() => {
  "use strict";
  const finite = Number.isFinite, attempts = new WeakMap(), results = new WeakMap();
  function ledger(scene) {
    if (!attempts.has(scene)) attempts.set(scene, new Map());
    return attempts.get(scene);
  }
  function deferRetry(scene, slot, id, previous) {
    const failures = Math.min(3, (previous?.id === id ? previous.failures : 0) + 1);
    ledger(scene).set(slot, { id, failures, retryAt: performance.now() + Math.min(4000, 500 * 2 ** failures) });
    results.set(scene, `Ô ${slot}: game chưa nhận yêu cầu; giãn lần thử lại.`);
  }
  // True means a client-side skill issue was observed, not a server hit/receipt.
  function tryPriority(scene, host, options, target, allowed, permitted, decision = null) {
    const time = scene.now(), self = scene.self;
    if (!["kit", "skills", "cast", "hp", "inCombat"].every((name) => typeof host[name] === "function")
        || typeof scene.skillWait !== "function" || !self || !finite(time)) return null;
    if (self.fx?.includes("s") || self.fx?.includes("x")) return null;
    const available = host.skills(), selected = options.skillEnabled ?? [];
    if (!Array.isArray(available)) return null;
    const distance = Math.hypot(target.x - scene.px, target.y - scene.py);
    for (const slot of options.skillPriority ?? []) {
      if (!selected.includes(slot) || !/^[1-6]$/.test(slot)) continue;
      const blocked = (reason) => { try { globalThis.GSTFarmSkillDiagnostics?.blocked?.(scene, slot, "farm_cast", reason); } catch {} };
      if (!available.includes(slot)) { blocked("not_available"); continue; }
      const previous = ledger(scene).get(slot);
      if (previous && performance.now() < previous.retryAt) { blocked("retry_backoff"); continue; }
      const kit = host.kit(slot), full = scene.skills?.find((entry) => entry.key === slot)?.kit;
      if (!kit || !full || full.id !== kit.id || full.unlock !== undefined && !finite(full.unlock)
          || scene.profile.level < full.unlock && !scene.gmSkills) { blocked("kit_unavailable"); continue; }
      const cooldown = (self.cd?.[slot] ?? 0) - (time - scene.selfAt);
      // Native skillWait permits an 80ms early margin. Automation waits for
      // the observed global action lock as well, without changing native rules.
      if (!finite(cooldown) || cooldown > 0 || (self.cl ?? 0) - (time - scene.selfAt) > 0
          || scene.skillWait(slot) > 0
          || !finite(kit.range) || kit.range < 0) { blocked("action_lock"); continue; }
      // Resource effects are not a universal minimum cost. Let the native
      // cast path apply class-specific requirements and observe its outcome.
      let x = decision ? decision.x : target.x, y = decision ? decision.y : target.y;
      if (!decision) {
        if (kit.heal && kit.dmg <= 0) {
          if (host.hp() > 0.7 || !host.inCombat()) { blocked("condition"); continue; }
          x = scene.px; y = scene.py;
        } else if (kit.dmg <= 0) {
          if (!host.inCombat() || distance > 4 || kit.id === "huyet-te" && host.hp() < 0.5) { blocked("condition"); continue; }
          x = scene.px; y = scene.py;
        } else if (["self", "ally"].includes(kit.shape)) {
          if (distance > kit.range + target.radius) { blocked("out_of_range"); continue; }
          x = scene.px; y = scene.py;
        } else {
          const range = kit.castRange ?? kit.range;
          if (!finite(range) || distance > range) { blocked("out_of_range"); continue; }
          if (!host.clear(scene.px, scene.py, x, y)) { blocked("unsafe_path"); continue; }
          if (kit.shape === "cone" && distance > kit.range * 0.9 + target.radius) { blocked("out_of_range"); continue; }
        }
      }
      if (decision && (!finite(x) || !finite(y)
          || Math.hypot(x - scene.px, y - scene.py) > 0.05 && !host.clear(scene.px, scene.py, x, y))) { blocked("unsafe_path"); continue; }
      if (kit.shape === "dash") {
        // Check the entire possible dash, including the longest native form.
        if (distance < 0.8 || host.hp() < 0.35 || !finite(full.range)) { blocked("condition"); continue; }
        const length = Math.hypot(x - scene.px, y - scene.py);
        if (length < 0.05) { blocked("unsafe_path"); continue; }
        const end = { x: scene.px + (x - scene.px) / length * full.range,
          y: scene.py + (y - scene.py) / length * full.range };
        if (!allowed(end) || !host.clear(scene.px, scene.py, end.x, end.y)) { blocked("unsafe_path"); continue; }
      }
      if (!allowed({ x, y }) || !permitted()) return null;
      const current = host.kit(slot);
      if (current?.id !== kit.id) continue;
      const before = { cd: scene.cdLocal?.[slot], lock: scene.skillLockUntil, cast: scene.castAt };
      const diagnostics = globalThis.GSTFarmSkillDiagnostics;
      let called = false;
      const cast = () => { called = true; return host.cast(slot, x, y); };
      let castResult;
      try { castResult = diagnostics?.isEnabled?.(scene) ? diagnostics.invoke(scene, slot, "farm_cast", "host.cast", cast) : cast(); }
      catch (error) { if (called) throw error; castResult = cast(); }
      if (castResult !== true) {
        blocked("cast_rejected"); deferRetry(scene, slot, kit.id, previous); continue;
      } // Native checks remain authoritative.
      const issued = (scene.cdLocal?.[slot] ?? -Infinity) > (before.cd ?? -Infinity)
        || (scene.skillLockUntil ?? -Infinity) > (before.lock ?? -Infinity)
        || (scene.castAt ?? -Infinity) > (before.cast ?? -Infinity);
      if (!issued) { blocked("cast_unobserved"); deferRetry(scene, slot, kit.id, previous); continue; }
      const completion = (finite(full.contact) ? full.contact : 0)
        + Math.max(0, (full.hits || 1) - 1) * (finite(full.interval) ? full.interval : 0.25);
      const action = { slot, id: kit.id, snapshotAt: scene.selfAt,
        previousExpiry: scene.selfAt + (self.cd?.[slot] ?? 0), confirmed: false,
        deadline: performance.now() + 1800,
        until: Math.max(...[time + 0.15, time + completion, time + full.lock,
          time + full.moveLock, scene.lockUntil, scene.skillLockUntil,
          scene.moveLockUntil, scene.castAt].filter(finite)) };
      ledger(scene).set(slot, { id: kit.id, failures: previous?.id === kit.id ? previous.failures : 0, retryAt: Infinity });
      results.set(scene, `Ô ${slot}: đã yêu cầu, chưa xác nhận hồi chiêu từ game.`);
      return action;
    }
    return null;
  }
  function tryDefault(scene, host, auto, rotation, target, allowed, permitted) {
    if (typeof auto.castSkills !== "function" || !rotation) throw new Error("Native skill selector unavailable");
    let action = null;
    // Supply only read adapters and one guarded cast. Native update/pick/walk/
    // idle and the native controller's own nextSlot are never invoked or changed.
    const adapter = Object.freeze({
      hp: () => host.hp(), gauge: () => host.gauge?.(), inCombat: () => host.inCombat(),
      skills: () => host.skills().filter((slot) => /^[1-6]$/.test(slot)),
      // The native selector treats resource gain as a reason to skip a skill.
      // Keep its targeting and rotation, but defer resource eligibility to cast.
      kit: (slot) => { const kit = host.kit(slot); return kit ? { ...kit, res: 0 } : kit; },
      cast(slot, x, y) {
        if (action || !permitted()) return false;
        action = tryPriority(scene, host, { skillEnabled: [slot], skillPriority: [slot] },
          target, allowed, permitted, { x, y });
        return !!action; // Advance rotation only after an observed client issue.
      }
    });
    const enemies = host.enemies().filter((enemy) => !enemy.dead && (enemy.hostile || !enemy.aggro)
      && globalThis.GSTFarmMonsterClassification?.classify(enemy)
      && allowed({ x: enemy.x, y: enemy.y }));
    const distance = Math.hypot(target.x - scene.px, target.y - scene.py);
    const previousSlot = rotation.nextSlot;
    auto.castSkills.call(rotation, adapter, target, enemies, scene.px, scene.py, distance);
    if (action) {
      action.rotation = rotation; action.nextSlot = rotation.nextSlot;
      rotation.nextSlot = previousSlot; // Commit rotation only with cooldown evidence.
    }
    return action;
  }
  globalThis.GSTFarmSkills = Object.freeze({ tryPriority, tryDefault,
    reset(scene) { attempts.delete(scene); results.delete(scene); },
    status: (scene) => results.get(scene) ?? "",
    waiting(scene, action, time) {
      if (!action) return false;
      const entry = ledger(scene).get(action.slot);
      const cd = scene.self?.cd?.[action.slot];
      if (!action.confirmed && scene.selfAt > action.snapshotAt && finite(cd) && cd > 0
          && scene.selfAt + cd > action.previousExpiry + 0.05) {
        action.confirmed = true;
        if (entry) { entry.failures = 0; entry.retryAt = 0; }
        if (action.rotation) action.rotation.nextSlot = action.nextSlot;
        results.set(scene, `Ô ${action.slot}: đã quan sát hồi chiêu từ game; không xác nhận sát thương.`);
      }
      // A fresh snapshot with a ready skill may mean an immediate reset, not
      // proof of a successful cast. Wait for native locks before retrying.
      const readyAgain = scene.selfAt > action.snapshotAt && finite(cd) && cd <= 0
        && time >= action.until && typeof scene.skillWait === "function" && scene.skillWait(action.slot) <= 0;
      if (!action.confirmed && !readyAgain && performance.now() < action.deadline) return true;
      if (!action.confirmed && readyAgain && entry && entry.retryAt === Infinity) {
        entry.failures = Math.min(4, entry.failures + 1);
        entry.retryAt = performance.now() + Math.min(4000, 300 * 2 ** (entry.failures - 1));
        results.set(scene, `Ô ${action.slot}: skill sẵn sàng lại; chưa xác nhận lần dùng trước.`);
        return false;
      }
      if (!action.confirmed) {
        if (entry && entry.retryAt === Infinity) {
          entry.failures = Math.min(3, entry.failures + 1);
          entry.retryAt = performance.now() + Math.min(4000, 500 * 2 ** entry.failures);
        }
        results.set(scene, `Ô ${action.slot}: chưa có xác nhận hồi chiêu; giãn lần thử lại.`);
      }
      return time < action.until;
    } });
})();
