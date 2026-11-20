(() => {
  "use strict";
  const previous = new WeakMap(), progress = new WeakMap(), finite = Number.isFinite;
  const movers = new Map(), customRoutes = new WeakMap(), customVectors = new WeakMap();
  const validPoint = (p) => Array.isArray(p) && p.length === 2 && p.every(finite);
  // Route points come from the game collision query; never steer across a
  // segment unless the same collision-clear contract currently permits it.
  function customStep(scene, nav, host, time, gx, gy, reach, allowed = () => true) {
    const x = scene?.px, y = scene?.py;
    if (!nav || ![x, y, time, gx, gy, reach].every(finite) || reach < 0
        || typeof host?.clear !== "function" || typeof host?.route !== "function") return null;
    const clear = (px, py) => {
      try { return host.clear(x, y, px, py) === true; } catch { return false; }
    };
    if (Math.hypot(gx - x, gy - y) <= reach) {
      customRoutes.delete(nav); nav.path = []; return { arrived: true };
    }
    if (clear(gx, gy) && allowed({ x: gx, y: gy })) {
      customRoutes.delete(nav); nav.path = [[gx, gy]];
      return { point: nav.path[0] };
    }
    let route = customRoutes.get(nav);
    if (!route || route.gx !== gx || route.gy !== gy || route.fix !== scene.self?.fix || time < route.at) {
      const retryAt = route && time >= route.at ? route.retryAt : -Infinity;
      route = { gx, gy, fix: scene.self?.fix, at: -Infinity, retryAt, path: [] };
      customRoutes.set(nav, route);
    }
    while (route.path.length && Math.hypot(route.path[0][0] - x, route.path[0][1] - y) < 0.25) route.path.shift();
    if (route.path.length && (!allowed({ x: route.path[0][0], y: route.path[0][1] })
        || !clear(route.path[0][0], route.path[0][1]))) route.path = [];
    if ((!route.path.length || time - route.at >= 2) && time >= route.retryAt) {
      route.at = time; route.retryAt = time + 0.9;
      let found = null;
      try { found = host.route(x, y, gx, gy); } catch {}
      route.path = Array.isArray(found) && found.length && found.every((p) => validPoint(p)
        && allowed({ x: p[0], y: p[1] })) ? found.map((p) => [...p]) : [];
      while (route.path.length && Math.hypot(route.path[0][0] - x, route.path[0][1] - y) < 0.25) route.path.shift();
    }
    const point = route.path[0];
    if (!point || !clear(point[0], point[1])) { route.path = []; nav.path = []; return null; }
    nav.path = route.path;
    return { point };
  }
  function stopCustom(scene, nav) {
    const vector = customVectors.get(nav);
    if (vector && scene.autoX === vector[0] && scene.autoY === vector[1] && !GSTFarmInput.movement(scene))
      scene.autoX = scene.autoY = 0;
    customVectors.delete(nav);
    const entry = movers.get(scene);
    if (entry?.intent?.nav === nav) entry.intent = null;
  }
  function detach(scene) {
    const entry = movers.get(scene); if (!entry) return;
    entry.intent = null;
    movers.delete(scene);
    scene.events.off("shutdown", entry.cleanup); scene.events.off("destroy", entry.cleanup);
    if (scene.move === entry.wrapper) {
      if (entry.descriptor) Object.defineProperty(scene, "move", entry.descriptor); else delete scene.move;
    }
  }
  function schedule(scene, nav, gx, gy, reach) {
    if (typeof scene.move !== "function" || !scene.events?.on || !scene.events.off) return;
    let entry = movers.get(scene);
    if (!entry) {
      const original = scene.move;
      entry = { descriptor: Object.getOwnPropertyDescriptor(scene, "move"), intent: null };
      entry.cleanup = () => detach(scene);
      entry.wrapper = function (delta, ...rest) {
        const intent = entry.intent; entry.intent = null;
        if (this === scene && intent && scene.self && scene.self.fix !== intent.fix
            && scene.autoX === intent.x && scene.autoY === intent.y && !GSTFarmInput.movement(scene)) {
          scene.autoX = scene.autoY = 0;
          return original.call(this, delta, ...rest);
        }
        if (this !== scene || !intent || !finite(delta) || delta <= 0 || !scene.self || scene.self.dead
            || scene.leaving || scene.dashT > 0 || GSTFarmInput.movement(scene) || scene.pendingSkill || scene.aiming
            || scene.self.fix !== intent.fix || scene.autoX !== intent.x || scene.autoY !== intent.y
            || Math.hypot(scene.px - intent.point[0], scene.py - intent.point[1]) > 3) return original.call(this, delta, ...rest);
        // Preserve native movement/collision and ms. Near a navigation
        // endpoint, split this frame's movement and stop at actual arrival,
        // rather than pretending a crossed, out-of-range point was reached.
        let remaining = delta, result;
        // Distribute the entire frame over at most 16 collision-checked steps.
        // The old fixed 1/240-second cap silently discarded surplus time
        // on frames longer than 16/240 seconds (unless already at the goal).
        const stepSize = Math.max(1 / 240, delta / 16);
        for (let i = 0; remaining > 1e-8 && i < 16; i++) {
          if (Math.hypot(scene.px - intent.point[0], scene.py - intent.point[1]) <= intent.reach) {
            scene.autoX = scene.autoY = 0;
            // WorldScene moves before auto.update(). Wake only the native
            // decision at an intermediate waypoint so its next leg is chosen
            // in this frame; final attack reach keeps native timing unchanged.
            if (intent.nav === scene.auto && intent.intermediate) intent.nav.think = 0;
            break;
          }
          const step = i === 15 ? remaining : Math.min(remaining, stepSize);
          result = original.call(this, step, ...rest); remaining -= step;
        }
        return result;
      };
      movers.set(scene, entry); scene.move = entry.wrapper;
      scene.events.on("shutdown", entry.cleanup); scene.events.on("destroy", entry.cleanup);
    }
    const point = Array.isArray(nav.path?.[0]) ? nav.path[0] : [gx, gy];
    if (!Array.isArray(point) || point.length !== 2 || !point.every(finite)) return;
    entry.intent = { nav, x: scene.autoX, y: scene.autoY, fix: scene.self?.fix, point: [...point],
      intermediate: Math.hypot(point[0] - gx, point[1] - gy) >= 0.01,
      reach: Math.hypot(point[0] - gx, point[1] - gy) < 0.01 ? reach : 0.25 };
  }
  function crossed(scene, nav, point, tolerance) {
    const old = previous.get(nav), fix = scene.self?.fix;
    if (!old || !finite(fix) || old.fix !== fix || !finite(scene.px) || !finite(scene.py)) return false;
    const dx = scene.px - old.x, dy = scene.py - old.y, square = dx * dx + dy * dy;
    if (square < 1e-10) return false;
    const t = ((point[0] - old.x) * dx + (point[1] - old.y) * dy) / square;
    return t > 0 && t < 1 && Math.hypot(old.x + t * dx - point[0], old.y + t * dy - point[1]) < tolerance;
  }
  function prune(scene, nav, host, native = false) {
    const old = previous.get(nav), point = nav.path?.[0], next = nav.path?.[1];
    if (!old || (nav === scene.auto && !native) || old.path !== nav.path || !Array.isArray(point) || !Array.isArray(next)
        || !old.point || old.point[0] !== point[0] || old.point[1] !== point[1]
        || !point.every(finite) || !next.every(finite) || point.length !== 2 || next.length !== 2) return;
    if (crossed(scene, nav, point, 0.35) && host.clear(scene.px, scene.py, next[0], next[1])) nav.path.shift();
  }
  function invalidate(scene, owner) {
    if (!owner?.navigation) return;
    owner.navigation.path = [];
    owner.navigation.pathAt = -Infinity;
    const entry = movers.get(scene);
    if (entry?.intent?.nav === owner.navigation) entry.intent = null;
  }
  // Shared bounded route-leg selection for farm, seal, chest and realm exits.
  // Use only game collision/route APIs. A leg stays selected until reached
  // instead of reselecting every frame and pulling the player backwards.
  function leg(scene, owner, host, gx, gy, allowed = () => true) {
    const px = scene?.px, py = scene?.py, time = scene?.now?.();
    if (![px, py, gx, gy, time].every(finite) || !owner
        || typeof host?.clear !== "function" || typeof host?.route !== "function") return null;
    const pos = { x: px, y: py }, goal = { x: gx, y: gy };
    owner.legArrived = false;
    const range = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    if (owner.legGoal && range(owner.legGoal, goal) > 2.5) {
      resetLeg(owner); invalidate(scene, owner);
    }
    owner.legGoal = goal;
    if (owner.checkpoint) {
      if (range(owner.checkpoint, pos) > 1.2) {
        if (allowed(owner.checkpoint)) return owner.checkpoint;
        // The intermediate point became invalid, not successfully reached.
        resetLeg(owner, true); invalidate(scene, owner);
        owner.legGoal = goal;
      } else {
        owner.visited ??= [];
        owner.visited.push(owner.checkpoint);
        if (owner.visited.length > 8) owner.visited.shift();
        owner.checkpoint = null;
        invalidate(scene, owner);
        // Callers use different time units (scene seconds vs UI milliseconds).
        owner.legArrived = true;
      }
    }
    const remaining = range(pos, goal);
    if (!allowed(goal)) return null;
    if (remaining <= 2.2 || time < (owner.directUntil ?? -Infinity)) return goal;
    if (time < (owner.checkpointRetryAt ?? -Infinity)) return null;
    // Avoid expensive far-distance route probes which the game's limited
    // native grid may not support. Clear line-of-sight is cheap enough.
    if (host.clear(px, py, gx, gy)
        || (remaining <= 30 && host.route(px, py, gx, gy)?.length)) {
      owner.directUntil = time + 1.5;
      return goal;
    }
    let best = null, score = Infinity;
    const visited = owner.visited ?? [];
    const offsets = [0, 0.4, -0.4, 0.85, -0.85, 1.35, -1.35, 1.9, -1.9, 2.5, -2.5];
    const angle = Math.atan2(gy - py, gx - px);
    // A short nearby leg is useful when the forward 12-tile ring is blocked.
    for (const radius of [...new Set([Math.min(12, Math.max(3.5, remaining - 3)), 6, 3.5])]) {
      let routeProbes = 0;
      for (const offset of offsets) {
        const point = { x: px + Math.cos(angle + offset) * radius,
          y: py + Math.sin(angle + offset) * radius };
        if (!allowed(point) || visited.some((v) => range(v, point) < 3)) continue;
        if (!host.clear(px, py, point.x, point.y)) {
          // Route checks cost more than collision raycasts. Cap expensive
          // checks per ring, while still trying short/lateral clear legs.
          if (routeProbes >= 4) continue;
          routeProbes++;
          if (!host.route(px, py, point.x, point.y)?.length) continue;
        }
        const candidate = range(point, goal) + Math.abs(offset) * 1.8
          + (radius < 6 ? 1 : 0);
        if (candidate < score) { best = point; score = candidate; }
      }
      if (best) break;
    }
    if (best) owner.checkpoint = best;
    else owner.checkpointRetryAt = time + 0.9;
    invalidate(scene, owner);
    return best;
  }
  function resetLeg(owner, failed = false) {
    if (!owner) return;
    if (failed && owner.checkpoint) {
      owner.visited ??= [];
      owner.visited.push(owner.checkpoint);
      if (owner.visited.length > 8) owner.visited.shift();
    }
    owner.checkpoint = null;
    owner.legGoal = null;
    if (owner.navigation) {
      owner.navigation.path = [];
      owner.navigation.pathAt = -Infinity;
    }
    owner.directUntil = -Infinity;
    owner.checkpointRetryAt = -Infinity;
  }
  // Read-only route proposal. Never schedules movement or mutates native Farm.
  function planRoute(host, from, goal, allowed = () => true) {
    const valid = (point) => point && [point.x, point.y].every(finite) && allowed(point) === true;
    const clear = (a, b) => host.clear(a.x, a.y, b.x, b.y) === true;
    try {
      if (!valid(from) || !valid(goal) || typeof host?.clear !== "function"
          || typeof host?.route !== "function") return null;
      if (clear(from, goal)) return [[goal.x, goal.y]];
      const raw = host.route(from.x, from.y, goal.x, goal.y);
      if (!Array.isArray(raw) || !raw.length || raw.length > 256 || !raw.every(validPoint)) return null;
      const path = [], points = [...raw, [goal.x, goal.y]];
      let previous = from;
      for (const pair of points) {
        const next = { x: pair[0], y: pair[1] };
        if (!valid(next) || !clear(previous, next)) return null;
        if (Math.hypot(next.x - previous.x, next.y - previous.y) > 1e-6) path.push([...pair]);
        previous = next;
      }
      return path.length ? path : [[goal.x, goal.y]];
    } catch { return null; }
  }
  globalThis.GSTNavigation = {
    schedule, leg, resetLeg, customStep, planRoute,
    cancel(scene, nav) {
      const entry = movers.get(scene);
      if (entry?.intent?.nav === nav) entry.intent = null;
      customVectors.delete(nav);
    },
    progressed(scene, owner, path, gx, gy, threshold = 0.5) {
      const x = scene.px, y = scene.py, fix = scene.self?.fix;
      if (![x, y, gx, gy].every(finite)) return false;
      const point = path?.[0], valid = Array.isArray(point) && point.length === 2 && point.every(finite);
      const remaining = Math.hypot(gx - x, gy - y);
      let old = progress.get(owner), advanced = false;
      if (old && old.gx === gx && old.gy === gy && old.fix === fix) {
        advanced = old.remaining - remaining >= threshold || (valid && old.point
          && point[0] === old.point[0] && point[1] === old.point[1]
          && old.pointDistance - Math.hypot(point[0] - x, point[1] - y) >= threshold);
      } else old = null;
      // Keep the baseline until enough distance accumulates. A correction or a
      // new goal only rebases; neither counts as successful navigation.
      if (!old || advanced) old = { gx, gy, fix, remaining, point: null };
      if (valid && (!old.point || point[0] !== old.point[0] || point[1] !== old.point[1])) {
        old.point = [...point]; old.pointDistance = Math.hypot(point[0] - x, point[1] - y);
      }
      progress.set(owner, old);
      return advanced;
    },
    remember(scene, nav, gx, gy) {
      previous.set(nav, { x: scene.px, y: scene.py, fix: scene.self?.fix, path: nav.path,
        point: Array.isArray(nav.path?.[0]) ? [...nav.path[0]] : null, goal: [gx, gy] });
    },
    walk(scene, nav, host, time, x, y, gx, gy, reach) {
      if (globalThis.GSTFarmPolicy?.isCustom?.()) {
        if (!scene || !nav) return false;
        if (GSTFarmInput.movement(scene)) { customVectors.delete(nav); return false; }
        const step = customStep(scene, nav, host, time, gx, gy, reach);
        if (!step || step.arrived) { stopCustom(scene, nav); return !!step?.arrived; }
        const dx = step.point[0] - scene.px, dy = step.point[1] - scene.py, d = Math.hypot(dx, dy);
        if (!finite(d) || d < 0.05) { stopCustom(scene, nav); return false; }
        scene.autoX = dx / d; scene.autoY = dy / d;
        customVectors.set(nav, [scene.autoX, scene.autoY]);
        schedule(scene, nav, gx, gy, reach);
        previous.set(nav, { x: scene.px, y: scene.py, fix: scene.self?.fix, path: nav.path, goal: [gx, gy] });
        return true;
      }
      if (nav === scene.auto) return scene.auto.walk.call(nav, host, time, x, y, gx, gy, reach);
      if (typeof host.clear === "function") prune(scene, nav, host);
      const result = scene.auto.walk.call(nav, host, time, x, y, gx, gy, reach);
      if (result) schedule(scene, nav, gx, gy, reach);
      previous.set(nav, { x: scene.px, y: scene.py, fix: scene.self?.fix, path: nav.path,
        point: Array.isArray(nav.path?.[0]) ? [...nav.path[0]] : null, goal: [gx, gy] });
      return result;
    },
    arrived(scene, nav, host, gx, gy, reach) {
      if (!scene || !nav || ![scene.px, scene.py, gx, gy, reach].every(finite) || reach < 0) return false;
      if (Math.hypot(scene.px - gx, scene.py - gy) <= reach) return true;
      const old = previous.get(nav);
      return !!old && validPoint(old.goal) && old.goal[0] === gx && old.goal[1] === gy && crossed(scene, nav, [gx, gy], reach)
        && typeof host?.clear === "function" && host.clear(scene.px, scene.py, gx, gy);
    },
    prune
  };
  window.addEventListener("pagehide", () => { for (const scene of [...movers.keys()]) detach(scene); });
})();
