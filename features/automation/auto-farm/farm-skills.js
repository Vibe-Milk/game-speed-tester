(() => {
  "use strict";
  const finite = Number.isFinite;
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
      if (!selected.includes(slot) || !available.includes(slot) || !/^[1-6]$/.test(slot)) continue;
      const kit = host.kit(slot), full = scene.skills?.find((entry) => entry.key === slot)?.kit;
      if (!kit || !full || full.id !== kit.id || full.unlock !== undefined && !finite(full.unlock)
          || scene.profile.level < full.unlock && !scene.gmSkills) continue;
      const cooldown = (self.cd?.[slot] ?? 0) - (time - scene.selfAt);
      if (!finite(cooldown) || cooldown > 0 || scene.skillWait(slot) > 0
          || !finite(kit.range) || kit.range < 0) continue;
      const gauge = host.gauge?.();
      if (finite(kit.res) && gauge && (kit.res > 0 && gauge.v + kit.res >= gauge.max
          || kit.res < 0 && gauge.v < -kit.res)) continue;
      let x = decision ? decision.x : target.x, y = decision ? decision.y : target.y;
      if (!decision) {
        if (kit.heal && kit.dmg <= 0) {
          if (host.hp() > 0.7 || !host.inCombat()) continue;
          x = scene.px; y = scene.py;
        } else if (kit.dmg <= 0) {
          if (!host.inCombat() || distance > 4 || kit.id === "huyet-te" && host.hp() < 0.5) continue;
          x = scene.px; y = scene.py;
        } else if (["self", "ally"].includes(kit.shape)) {
          if (distance > kit.range + target.radius) continue;
          x = scene.px; y = scene.py;
        } else {
          const range = kit.castRange ?? kit.range;
          if (!finite(range) || distance > range || !host.clear(scene.px, scene.py, x, y)) continue;
          if (kit.shape === "cone" && distance > kit.range * 0.9 + target.radius) continue;
        }
      }
      if (decision && (!finite(x) || !finite(y)
          || Math.hypot(x - scene.px, y - scene.py) > 0.05 && !host.clear(scene.px, scene.py, x, y))) continue;
      if (kit.shape === "dash") {
        // Check the entire possible dash, including the longest native form.
        if (distance < 0.8 || host.hp() < 0.35 || !finite(full.range)) continue;
        const length = Math.hypot(x - scene.px, y - scene.py);
        if (length < 0.05) continue;
        const end = { x: scene.px + (x - scene.px) / length * full.range,
          y: scene.py + (y - scene.py) / length * full.range };
        if (!allowed(end) || !host.clear(scene.px, scene.py, end.x, end.y)) continue;
      }
      // Anh Bo chooses a server-side nearest target and teleports behind it.
      // Its destination cannot be established from this selected actor alone.
      if (kit.shape === "blink" && kit.id === "anh-bo") continue;
      if (!allowed({ x, y }) || !permitted()) return null;
      const current = host.kit(slot);
      if (current?.id !== kit.id) continue;
      const before = { cd: scene.cdLocal?.[slot], lock: scene.skillLockUntil, cast: scene.castAt };
      if (host.cast(slot, x, y) !== true) continue; // Native mana/gauge/range checks.
      const issued = (scene.cdLocal?.[slot] ?? -Infinity) > (before.cd ?? -Infinity)
        || (scene.skillLockUntil ?? -Infinity) > (before.lock ?? -Infinity)
        || (scene.castAt ?? -Infinity) > (before.cast ?? -Infinity);
      if (!issued) continue;
      const completion = (finite(full.contact) ? full.contact : 0)
        + Math.max(0, (full.hits || 1) - 1) * (finite(full.interval) ? full.interval : 0.25);
      return { slot, id: kit.id, snapshotAt: scene.selfAt,
        until: Math.max(...[time + 0.15, time + completion, time + full.lock,
          time + full.moveLock, scene.lockUntil, scene.skillLockUntil,
          scene.moveLockUntil, scene.castAt].filter(finite)) };
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
      skills: () => host.skills().filter((slot) => /^[1-6]$/.test(slot)), kit: (slot) => host.kit(slot),
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
    auto.castSkills.call(rotation, adapter, target, enemies, scene.px, scene.py, distance);
    return action;
  }
  globalThis.GSTFarmSkills = Object.freeze({ tryPriority, tryDefault,
    waiting(scene, action, time) { return !!action && (time < action.until || scene.selfAt <= action.snapshotAt); } });
})();
