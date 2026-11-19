(() => {
  "use strict";
  const origin = "https://nghichthienky.online";
  let identity = null, scene = null, baseline = new Map(), pendingChanges = new Map(), pendingTimer = null, appliedHarvest =
    typeof window.__gstHarvestAppliedEnabled === "boolean" ? window.__gstHarvestAppliedEnabled : null, observer = null;
  const sceneNow = () => window.game?.scene?.getScene?.("world")
    ?? (window.__ntkScene?.sys?.settings?.key === "world" ? window.__ntkScene : null);
  function valid(current) {
    const driver = current?.driver;
    return !!current?.sys?.isActive?.() && !!current?.self && !current.leaving && !!driver
      && !driver.closing && !driver.reconnecting && !driver.displaced
      && (driver.online === false || driver.link?.open?.() === true);
  }
  function position(current) {
    const canvas = document.querySelector("canvas"), rect = canvas?.getBoundingClientRect?.();
    if (!rect?.width || !rect?.height) return null;
    const camera = current.cameras?.main, view = camera?.worldView;
    const logicalWidth = canvas.width || rect.width, logicalHeight = canvas.height || rect.height;
    const fallback = () => ({
      x: rect.left + ((camera?.x ?? 0) + (camera?.width ?? logicalWidth) / 2) / logicalWidth * rect.width,
      y: rect.top + ((camera?.y ?? 0) + (camera?.height ?? logicalHeight) / 2) / logicalHeight * rect.height
    });
    if (!view || typeof current.toPx !== "function" || !Number.isFinite(current.px) || !Number.isFinite(current.py))
      return fallback();
    const zoom = Number.isFinite(camera.zoom) && camera.zoom > 0 ? camera.zoom : 1;
    const [worldX, worldY] = current.toPx(current.px, current.py);
    if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) return fallback();
    const x = (camera.x ?? 0) + (worldX - view.x) * zoom;
    const y = (camera.y ?? 0) + (worldY - view.y) * zoom;
    return { x: rect.left + x / logicalWidth * rect.width,
      y: rect.top + y / logicalHeight * rect.height };
  }
  function emit(changes, current) {
    window.postMessage({ channel: "gst:feature-toast:v1", changes, position: position(current),
      identity: JSON.stringify(identity) }, origin);
  }
  function updatePosition(current) {
    window.postMessage({ channel: "gst:feature-toast-position:v1", position: position(current),
      identity: JSON.stringify(identity) }, origin);
  }
  function sample(current) {
    if (!identity || !valid(current) || current !== scene) return;
    if (current.profile?.name?.normalize?.("NFC") !== identity.character
        || current.profile?.classId !== identity.classId || String(current.you) !== identity.characterId) {
      baseline.clear(); return;
    }
    const states = { farm: typeof current.auto?.on === "boolean" ? current.auto.on : null,
      harvest: typeof appliedHarvest === "boolean" ? appliedHarvest : null };
    const changes = [];
    for (const [feature, state] of Object.entries(states)) {
      if (state === null) { baseline.delete(feature); continue; }
      if (!baseline.has(feature)) baseline.set(feature, state);
      else if (baseline.get(feature) !== state) { baseline.set(feature, state); changes.push({ feature, enabled: state }); }
    }
    updatePosition(current);
    if (changes.length) {
      for (const change of changes) pendingChanges.set(change.feature, change.enabled);
      clearTimeout(pendingTimer);
      pendingTimer = setTimeout(() => {
        const grouped = [...pendingChanges].map(([feature, enabled]) => ({ feature, enabled }));
        pendingChanges.clear(); pendingTimer = null;
        emit(grouped, current);
      }, 70);
    }
  }
  function detach() {
    if (scene && observer) {
      scene.events?.off?.("preupdate", observer);
      scene.events?.off?.("shutdown", resetScene);
      scene.events?.off?.("destroy", resetScene);
    }
    scene = null; observer = null; baseline.clear(); pendingChanges.clear();
    clearTimeout(pendingTimer); pendingTimer = null;
  }
  function resetScene() { detach(); }
  function discover() {
    if (!identity) { detach(); return; }
    const current = sceneNow();
    if (!valid(current)) { if (scene) detach(); return; }
    if (current !== scene) {
      detach(); scene = current; observer = () => sample(current);
      current.events?.on?.("preupdate", observer);
      current.events?.on?.("shutdown", resetScene);
      current.events?.on?.("destroy", resetScene);
    }
    sample(current);
  }
  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== origin || event.data?.channel !== "gst:feature-toast-context:v1") return;
    const data = event.data;
    const next = data.verified === true && typeof data.character === "string" && data.character
      && typeof data.classId === "string" && typeof data.characterId === "string"
      ? { slot: data.slot ?? "", character: data.character, classId: data.classId, characterId: data.characterId } : null;
    if (JSON.stringify(next) !== JSON.stringify(identity)) { identity = next; detach(); appliedHarvest = null; }
    discover();
  });
  globalThis.GSTFeatureToast = { setHarvestApplied(enabled) {
    appliedHarvest = typeof enabled === "boolean" ? enabled : null;
    sample(scene);
  } };
  const timer = setInterval(discover, 500);
  window.addEventListener("pagehide", () => { clearInterval(timer); detach(); appliedHarvest = null; }, { once: true });
  window.addEventListener("pageshow", discover);
})();
