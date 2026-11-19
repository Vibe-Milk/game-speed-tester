(() => {
  "use strict";
  // One native update wrapper shared by all temporary update callbacks.
  const bindings = new WeakMap(), gates = new WeakMap(), quarantines = new WeakMap();
  function canGuard(auto) {
    if (!auto || (typeof auto !== "object" && typeof auto !== "function")) return false;
    const own = Object.getOwnPropertyDescriptor(auto, "update");
    if (own) return Object.hasOwn(own, "value") && typeof own.value === "function"
      && own.writable === true && own.configurable === true;
    if (!Object.isExtensible(auto)) return false;
    let proto = Object.getPrototypeOf(auto), inherited;
    while (proto && !(inherited = Object.getOwnPropertyDescriptor(proto, "update"))) proto = Object.getPrototypeOf(proto);
    return !!inherited && Object.hasOwn(inherited, "value") && typeof inherited.value === "function"
      && inherited.writable === true;
  }
  function restoreQuarantine(auto) {
    const q = quarantines.get(auto); if (!q) return;
    if (auto.update === q.blocker) {
      if (q.descriptor) Object.defineProperty(auto, "update", q.descriptor);
      else delete auto.update;
    }
    quarantines.delete(auto);
  }
  function quarantine(scene, auto) {
    if (!auto || (typeof auto !== "object" && typeof auto !== "function")) return false;
    const entry = bindings.get(auto), current = auto.update, old = quarantines.get(auto);
    if (entry && current === entry.wrapper) return entry.scene === scene;
    if (old && current === old.blocker) return true;
    const descriptor = Object.getOwnPropertyDescriptor(auto, "update");
    if (!canGuard(auto)) return false;
    const q = { descriptor, original: current, blocker: function () {} };
    Object.defineProperty(auto, "update", { configurable: true, enumerable: descriptor?.enumerable ?? true,
      writable: true, value: q.blocker });
    quarantines.set(auto, q);
    if (entry || globalThis.GSTCustomFarm?.active?.(scene)) globalThis.GSTCustomFarm?.pauseOwnership?.(scene,
      "Custom Farm tạm dừng: controller update đã thay đổi; hãy đổi chế độ và bật lại.");
    return true;
  }
  globalThis.GSTFarmUpdate = {
    installGate(scene) {
      if (!scene || gates.has(scene)) return !!scene && this.gateReady(scene);
      if (typeof scene.events?.on !== "function" || typeof scene.events?.off !== "function") return false;
      const descriptor = Object.getOwnPropertyDescriptor(scene, "auto");
      if (!descriptor || !Object.hasOwn(descriptor, "value") || !descriptor.configurable || !descriptor.writable)
        return false;
      const initial = descriptor.value;
      if (!canGuard(initial) || bindings.has(initial) && bindings.get(initial).scene !== scene) return false;
      const gate = { value: initial, descriptor, busy: false, quarantined: new Set(), seen: new Set([initial]) };
      const secure = (auto) => {
        if (gate.busy) return true;
        gate.busy = true;
        try {
          const ok = quarantine(scene, auto);
          if (ok) gate.seen.add(auto);
          if (ok && quarantines.has(auto)) gate.quarantined.add(auto);
          return ok;
        } finally { gate.busy = false; }
      };
      gate.get = function () {
        if (globalThis.GSTFarmPolicy?.isCustom?.() && !secure(gate.value)) {
          gate.busy = true;
          try { globalThis.GSTCustomFarm?.pauseOwnership?.(scene, "Custom Farm tạm dừng: controller không tương thích."); }
          finally { gate.busy = false; }
          throw new Error("Custom Farm: unsupported update descriptor");
        }
        return gate.value;
      };
      gate.set = function (next) {
        if (globalThis.GSTFarmPolicy?.isCustom?.() && next !== gate.value) {
          if (!secure(next)) {
            globalThis.GSTCustomFarm?.pauseOwnership?.(scene, "Custom Farm từ chối controller thay thế không tương thích.");
            throw new Error("Custom Farm: unsupported replacement controller");
          }
          globalThis.GSTCustomFarm?.pauseOwnership?.(scene, "Custom Farm tạm dừng: controller đã thay đổi; hãy bật lại.");
        }
        gate.value = next;
      };
      gate.dispose = () => this.removeGate(scene);
      try { Object.defineProperty(scene, "auto", { configurable: true, enumerable: descriptor.enumerable,
        get: gate.get, set: gate.set }); gates.set(scene, gate);
        scene.events?.on?.("shutdown", gate.dispose); scene.events?.on?.("destroy", gate.dispose);
        return true; }
      catch { if (gates.has(scene)) this.removeGate(scene); return false; }
    },
    gateReady(scene) {
      const gate = scene && gates.get(scene), d = scene && Object.getOwnPropertyDescriptor(scene, "auto");
      return !!gate && d?.get === gate.get && d?.set === gate.set;
    },
    removeGate(scene) {
      const gate = scene && gates.get(scene); if (!gate) return;
      const d = Object.getOwnPropertyDescriptor(scene, "auto");
      if (d?.get === gate.get && d?.set === gate.set) {
        for (const auto of gate.quarantined) restoreQuarantine(auto);
        for (const auto of gate.seen) {
          const entry = bindings.get(auto);
          if (!entry || entry.scene !== scene || entry.callbacks.size) continue;
          if (auto.update === entry.wrapper) {
            if (entry.descriptor) Object.defineProperty(auto, "update", entry.descriptor);
            else delete auto.update;
          }
          if (bindings.get(auto) === entry) bindings.delete(auto);
        }
        Object.defineProperty(scene, "auto", { ...gate.descriptor, value: gate.value });
      }
      scene.events?.off?.("shutdown", gate.dispose); scene.events?.off?.("destroy", gate.dispose);
      gates.delete(scene);
    },
    attached(scene) {
      if (!scene?.auto) return false;
      const entry = bindings.get(scene.auto);
      return !!entry && scene.auto.update === entry.wrapper;
    },
    nativeUpdateRunning(scene) {
      const entry = scene?.auto && bindings.get(scene.auto);
      return !!entry && scene.auto.update === entry.wrapper && entry.nativeUpdateDepth > 0;
    },
    // Let a recovery owner invoke native rest and report its meditation toggle.
    runRecovery(scene, host, ...args) {
      const auto = scene?.auto;
      const entry = auto && bindings.get(auto);
      if (globalThis.GSTFarmPolicy?.isCustom?.()) return { ran: false };
      if (!entry || auto.update !== entry.wrapper || !auto.on || typeof auto.resting !== "boolean"
          || typeof entry.original !== "function" || !host || typeof host !== "object") return { ran: false };
      const wasResting = auto.resting;
      let meditation = null;
      const recoveryHost = new Proxy(host, {
        get(target, key, receiver) {
          const value = Reflect.get(target, key, receiver);
          if (key !== "meditate" || typeof value !== "function") return value;
          return function (...callArgs) {
            const before = typeof target.meditating === "function" ? target.meditating() : null;
            const result = Reflect.apply(value, target, callArgs);
            if (before === false) meditation = "start";
            else if (before === true) meditation = "stop";
            return result;
          };
        }
      });
      auto.resting = true;
      entry.nativeUpdateDepth++;
      try { entry.original.apply(auto, [recoveryHost, ...args]); return { ran: true, meditation, restingBefore: wasResting }; }
      finally { entry.nativeUpdateDepth--; auto.resting = wasResting; }
    },
    add(scene, priority, callback) {
      const auto = scene.auto;
      let entry = bindings.get(auto);
      if (entry && auto.update !== entry.wrapper) throw new Error("Auto update owner changed");
      if (!entry) {
        const q = quarantines.get(auto);
        const original = q && auto.update === q.blocker ? q.original : auto.update;
        const descriptor = q && auto.update === q.blocker ? q.descriptor : Object.getOwnPropertyDescriptor(auto, "update");
        entry = { scene, original, descriptor, callbacks: new Map(), ordered: [], nativeUpdateDepth: 0 };
        entry.wrapper = function (...args) {
          if (this === auto) {
            for (const handler of entry.ordered) if (handler.callback.apply(this, args) === true) return;
            if (globalThis.GSTFarmPolicy?.isCustom?.()) {
              if (entry.scene) return globalThis.GSTCustomFarm?.update?.(entry.scene, args[0], args[1], args[2]) ?? true;
              return;
            }
          }
          let nativeArgs = args;
          if (this === auto && globalThis.GSTFarmCombat?.active(scene)) {
            nativeArgs = [...args];
            nativeArgs[0] = GSTFarmCombat.host(scene, args[0]);
          }
          if (this !== auto) return globalThis.GSTFarmPolicy?.isCustom?.() ? undefined : original.apply(this, args);
          entry.nativeUpdateDepth++;
          try { return original.apply(this, nativeArgs); }
          finally { entry.nativeUpdateDepth--; }
        };
        auto.update = entry.wrapper;
        quarantines.delete(auto);
        bindings.set(auto, entry);
      }
      const token = Symbol();
      entry.callbacks.set(token, { priority, callback });
      entry.ordered = [...entry.callbacks.values()].sort((a, b) => a.priority - b.priority);
      return () => {
        entry.callbacks.delete(token);
        entry.ordered = [...entry.callbacks.values()].sort((a, b) => a.priority - b.priority);
        if (entry.callbacks.size) return;
        if (globalThis.GSTFarmPolicy?.isCustom?.() && this.gateReady(scene)) return;
        if (auto.update === entry.wrapper) {
          if (entry.descriptor) Object.defineProperty(auto, "update", entry.descriptor);
          else delete auto.update;
        }
        if (bindings.get(auto) === entry) bindings.delete(auto);
      };
    }
  };
})();
