(() => {
  "use strict";
  const button = document.getElementById("copyFarmDiagnostics");
  const skillButton = document.getElementById("copyFarmSkillDiagnostics");
  const output = document.getElementById("farmDiagnosticsOutput"), feedback = document.getElementById("farmDiagnosticsFeedback");
  const skillEnabled = document.getElementById("farmSkillDiagnosticsEnabled");
  const clearSkill = document.getElementById("clearFarmSkillDiagnostics");
  let confirmedSkillEnabled = false, skillBusy = false;

  async function boundTarget() {
    await globalThis.GSTPopupAccountContextPromise;
    const session = globalThis.GSTPopupAccountSession;
    const expected = session?.current?.(), version = session?.version?.(), tabId = session?.tabId?.();
    if (!Number.isInteger(tabId) || !expected?.verified || !globalThis.GSTAccountProfiles?.identity) return null;
    const binding = await session.validate(expected, version);
    if (!binding?.valid || binding.tabId !== tabId || !binding.context?.verified) return null;
    return { tabId, profileIdentity: globalThis.GSTAccountProfiles.identity(binding.context) };
  }
  async function skillRequest(action, enabled) {
    const target = await boundTarget();
    if (!target) throw new Error("account_identity_mismatch");
    return chrome.tabs.sendMessage(target.tabId, { type: "gst:farm-skill-diagnostics",
      targetTabId: target.tabId, profileIdentity: target.profileIdentity,
      action, enabled: enabled === true });
  }
  async function refreshSkillStatus() {
    if (skillBusy) return;
    try {
      const result = await skillRequest("status");
      if (!result?.accepted) throw new Error("policy_change");
      confirmedSkillEnabled = result.enabled === true;
      skillEnabled.checked = confirmedSkillEnabled;
      skillEnabled.disabled = false;
      clearSkill.disabled = false;
    } catch {
      confirmedSkillEnabled = false;
      skillEnabled.checked = false;
      skillEnabled.disabled = true;
      clearSkill.disabled = true;
    }
  }

  // Compact only at export: collection, retention and the sanitized bridge remain unchanged.
  // In each record, flags lists true states; states absent from flags are false.
  function pick(row, fields, flagNames = []) {
    if (!row || typeof row !== "object") return null;
    const result = {};
    for (const [source, name] of fields) {
      const value = row[source];
      if (value === null || value === undefined || value === ""
          || (Array.isArray(value) && value.length === 0)) continue;
      result[name] = value;
    }
    const flags = flagNames.filter((name) => row[name] === true);
    if (flags.length) result.flags = flags;
    return result;
  }
  function merged(groups, convert, combineMovement = false) {
    const seen = new Set(), rows = [];
    for (const group of groups) for (const row of Array.isArray(group) ? group : []) {
      if (!row || typeof row !== "object") continue;
      // A record may exist in both recent events and persisted incidents.
      const key = JSON.stringify(row);
      if (seen.has(key)) continue;
      seen.add(key); rows.push(row);
    }
    const ordered = rows.sort((a, b) => (a.at || "").localeCompare(b.at || "")).map(convert).filter(Boolean);
    if (!combineMovement) return ordered;
    const compact = [], byState = new Map();
    for (const row of ordered) {
      if (row.event !== "state" && row.event !== "owner_change") { compact.push(row); continue; }
      // Same instant, same snapshot; only the event name and ownership transition differ.
      const common = { ...row };
      delete common.event; delete common.fromOwners; delete common.toOwners; delete common.ownerScope;
      const key = JSON.stringify(common), previous = byState.get(key);
      if (!previous) { compact.push(row); byState.set(key, row); continue; }
      if (previous.event === row.event || previous.also?.includes(row.event)) continue;
      if (row.event === "owner_change") {
        previous.also = [...(previous.also || []), previous.event];
        previous.event = "owner_change";
        for (const field of ["fromOwners", "toOwners", "ownerScope"]) if (row[field] !== undefined)
          previous[field] = row[field];
      } else previous.also = [...(previous.also || []), row.event];
    }
    return compact;
  }
  const farmFlags = ["hidden", "focused", "dead", "clickOrder", "reconnecting", "displaced"];
  const stopFields = [["at", "t"], ["event", "event"], ["cause", "cause"], ["on", "on"],
    ["deaths", "deaths"], ["uptimeMs", "uptimeMs"], ["callers", "callers"]];
  const moveFlags = ["auto", "manual", "clickOrder", "paused", "moved", "dead", "stunned",
    "rooted", "slowed", "moveLocked", "harvesting", "pendingSkill", "aiming", "resting",
    "target", "targetChanged", "hidden", "focused", "littleProgress", "panelOpen", "uiBlocked"];
  const moveFields = [["at", "t"], ["reason", "event"], ["fix", "fix"],
    ["elapsedMs", "elapsedMs"], ["distance", "distance"], ["stillMs", "stillMs"],
    ["pathLength", "pathLength"], ["radius", "radius"], ["moveMultiplier", "speed"],
    ["frameGapMs", "frameGapMs"], ["pauseMs", "pauseMs"], ["retryMs", "retryMs"],
    ["position", "pos"], ["serverPosition", "serverPos"], ["targetPosition", "targetPos"],
    ["center", "center"], ["home", "home"], ["steerBefore", "steerBefore"],
    ["steerAfter", "steerAfter"], ["waypoint", "waypoint"], ["scope", "scope"],
    ["panel", "panel"], ["owners", "owners"], ["fromId", "fromId"], ["toId", "toId"],
    ["switchSource", "source"], ["switchReason", "switchReason"],
    ["lootCount", "lootCount"], ["targetId", "targetId"], ["remaining", "remaining"], ["stuckMs", "stuckMs"], ["attempt", "attempt"],
    ["fromOwner", "fromOwner"], ["toOwner", "toOwner"], ["handoffReason", "handoffReason"],
    ["replanReason", "replanReason"], ["action", "action"], ["realmPhase", "realmPhase"], ["fromOwners", "fromOwners"],
    ["toOwners", "toOwners"], ["ownerScope", "ownerScope"]];
  const bgFlags = ["hidden", "focused", "auto", "dead", "connected", "reconnecting",
    "displaced", "active", "paused", "loopRunning", "wasDiscarded"];
  const recoveryFlags = ["online", "ready", "closing", "handingOver", "noticed", "eligible", "overlayPresent", "recoveryComplete"];
  const vitalFlags = ["auto", "dead", "hidden", "connected"];
  const vitalFields = [["at", "t"], ["hp", "hp"], ["maxHp", "maxHp"], ["hpPct", "hpPct"],
    ["position", "pos"], ["serverPosition", "serverPos"], ["fix", "fix"]];
  const bgFields = [["at", "t"], ["reason", "event"], ["generation", "generation"],
    ["gapMs", "gapMs"], ["sinceFrameMs", "sinceFrameMs"], ["positionDelta", "positionDelta"],
    ["checkGapMs", "checkGapMs"], ["tickAgeMs", "tickAgeMs"], ["inboundAgeMs", "inboundAgeMs"],
    ["retryReason", "retryReason"], ["attempts", "attempts"], ["waitingMs", "waitingMs"], ["downMs", "downMs"],
    ["hp", "hp"], ["maxHp", "maxHp"], ["hpPct", "hpPct"], ["position", "pos"],
    ["serverPosition", "serverPos"], ["previousPosition", "previousPos"],
    ["fix", "fix"], ["previousFix", "previousFix"], ["navigationType", "navigationType"],
    ["redirectReason", "redirectReason"], ["persisted", "persisted"]];
  const bossFields = [["at", "t"], ["type", "event"], ["hp", "hp"], ["position", "pos"],
    ["cooldown", "cooldown"], ["direction", "direction"], ["distance", "distance"]];
  const flightFlags = ["always", "farm", "wanted", "flying", "auto", "requested",
    "hasScene", "fresh", "blocked"];
  const flightFields = [["pendingMs", "pendingMs"], ["retryMs", "retryMs"]];
  function move(row) { return pick(row, moveFields, moveFlags); }
  function background(row) {
    const result = pick(row, bgFields, bgFlags);
    if (result) for (const key of recoveryFlags) result[key] = typeof row[key] === "boolean" ? row[key] : null;
    if (result && row.before) result.before = pick(row.before, vitalFields, vitalFlags);
    return result;
  }
  // Keep only actionable incidents in exported histories. Collection remains
  // unchanged so existing diagnostics can still correlate observations.
  function problems(rows, accepted, max = 30) {
    const output = [];
    for (const row of rows || []) {
      if (!row || !accepted(row)) continue;
      const prev = output[output.length - 1];
      const signature = (r) => JSON.stringify([r.event, r.reason, r.skill, r.skillId, r.source, r.stage, r.fromId, r.toId, r.switchReason]);
      const elapsed = prev && Date.parse(row.t) - Date.parse(prev.t);
      if (prev && Number.isFinite(elapsed) && elapsed >= 0 && elapsed <= 5000 && signature(prev) === signature(row)) {
        prev.repeatCount = Math.min(10000, (prev.repeatCount || 1) + (row.repeatCount || 1));
        prev.lastAt = row.t;
      } else output.push({ ...row });
    }
    return output.slice(-max);
  }
  function compact(data) {
    const movement = data.movement || {}, bg = data.background || {};
    const boss = data.bossSafety || {}, flight = data.flight || {};
    return {
      format: "gst-farm-agent-3",
      legend: "t=UTC; event=reason; also=other simultaneous events; flags lists true states (others false); missing fields=null; ownerScope=eligibility (not actual move)",
      farm: { tracking: data.tracking === true,
        keyEvents: (Array.isArray(data.keyEvents) ? data.keyEvents : []).slice(-24).map((row) =>
          pick(row, [["at", "t"], ["stage", "stage"], ["reason", "reason"], ["on", "on"],
            ["focused", "focused"], ["hidden", "hidden"]])),
        current: pick(data.current, [["on", "on"], ["deaths", "deaths"]], farmFlags),
        events: problems((data.events || []).map((row) => pick(row, stopFields, farmFlags)), (row) => row.event === "off") },
      movement: { build: movement.build, tracking: movement.tracking === true,
        current: move(movement.current),
        events: problems(merged([movement.events, movement.incidents, movement.uiIncidents], move, true),
          (row) => ["movement_stall", "routing_stuck", "routing_replan", "routing_correction", "map_stuck", "map_replan", "map_correction", "frame_gap", "short_frame_gap", "panel_gap", "correction", "target_decision", "farm_boundary_denied"].includes(row.event)) },
      background: { build: bg.build, generation: bg.generation,
        current: background(bg.current),
        recovery: background(bg.recovery),
        lastAlive: pick(bg.lastAlive, vitalFields, vitalFlags),
        lastObserved: pick(bg.lastObserved, vitalFields, vitalFlags),
        events: problems(merged([bg.events, bg.incidents], background),
          (row) => ["frame_gap", "freeze", "position_jump", "death", "native_revive_attempt"].includes(row.event)) },
      boss: { build: boss.build, active: boss.active === true, retreating: boss.retreating === true,
        events: problems((boss.events || []).map((row) => pick(row, bossFields, ["flying"])),
          (row) => ["unsupported", "no_destination", "no_route", "return_deferred", "flight_drop"].includes(row.event)) },
      flight: { build: flight.build,
        state: pick(flight, flightFields, flightFlags),
        events: problems((flight.events || []).map((row) =>
          pick(row, [["at", "t"], ["type", "event"]], ["auto", "flying", "always", "farm"])),
          (row) => ["no_snapshot", "unconfirmed", "disconnected", "blocked"].includes(row.event)) },
      skill: { build: data.skill?.build || "unavailable", enabled: data.skill?.enabled === true,
        tracking: data.skill?.tracking === true, config: data.skill?.config || null,
        legend: "guard_blocked/q_blocked=extension block; native_rejected=host.cast returned false without scene.useSkill; skillWaitBeforeMs is the bounded client gate value at invocation; snapshot_cooldown is a newer client snapshot observation and attribution=not_specific means it is not linked to one attempt (priorEvidence is context only); repeats are coalesced; no stage proves server acceptance or damage",
        events: problems((Array.isArray(data.skill?.events) ? data.skill.events : []).slice(-80).map((row) => {
          const result = pick(row, [["at", "t"], ["attemptId", "attempt"], ["skill", "skill"], ["skillId", "skillId"],
            ["source", "source"], ["stage", "stage"], ["reason", "reason"], ["method", "method"],
            ["returnKind", "return"], ["conditions", "conditions"], ["skillWaitMs", "skillWaitMs"],
            ["skillWaitBeforeMs", "skillWaitBeforeMs"], ["skillWaitMinMs", "skillWaitMinMs"],
            ["skillWaitMaxMs", "skillWaitMaxMs"], ["attribution", "attribution"],
            ["priorEvidence", "priorEvidence"],
            ["targetDistance", "targetDistance"], ["maxRange", "maxRange"], ["repeatCount", "repeatCount"],
            ["localCooldownDeltaMs", "localCooldownDeltaMs"],
            ["snapshotAdvanceMs", "snapshotAdvanceMs"], ["cooldownBeforeMs", "cooldownBeforeMs"],
            ["cooldownAfterMs", "cooldownAfterMs"], ["dashStarted", "dashStarted"],
            ["pendingSkillChanged", "pendingSkillChanged"]]);
          return result;
        }), (row) => ["native_rejected", "unconfirmed", "ambiguous", "q_blocked"].includes(row.stage)
          || row.stage === "guard_blocked" && !["action_lock", "cooldown_wait", "retry_backoff"].includes(row.reason), 40) }
    };
  }
  skillEnabled.addEventListener("change", async () => {
    skillBusy = true; skillEnabled.disabled = true; clearSkill.disabled = true;
    try {
      const result = await skillRequest("set", skillEnabled.checked);
      if (!result?.accepted) throw new Error(result?.reason || "policy_change");
      confirmedSkillEnabled = result.enabled === true;
      skillEnabled.checked = confirmedSkillEnabled;
      feedback.textContent = confirmedSkillEnabled ? "Đã bật thu thập log kỹ năng cho tab/tài khoản này." : "Đã tắt thu thập log kỹ năng.";
    } catch {
      skillEnabled.checked = confirmedSkillEnabled;
      feedback.textContent = "Không đổi được chẩn đoán: tab chưa xác minh, Farm không ở chế độ tool hoặc bridge chưa sẵn sàng.";
    } finally { skillBusy = false; await refreshSkillStatus(); }
  });
  clearSkill.addEventListener("click", async () => {
    clearSkill.disabled = true;
    try {
      const result = await skillRequest("clear");
      if (!result?.accepted) throw new Error("policy_change");
      output.value = ""; output.hidden = true;
      feedback.textContent = "Đã xóa log kỹ năng của tab/tài khoản hiện tại.";
    } catch { feedback.textContent = "Không xóa được log: tab chưa xác minh hoặc bridge chưa sẵn sàng."; }
    finally { await refreshSkillStatus(); }
  });
  window.addEventListener("gst:popup-account-context-change", () => { void refreshSkillStatus(); });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes.farmPreferences || changes[GSTAccountProfiles.profilesKey]))
      void refreshSkillStatus();
  });
  void refreshSkillStatus();

  let boundDocumentToken = null, boundTokenQuery = null;
  async function getOrInitDocumentToken(tabId) {
    if (boundDocumentToken) return boundDocumentToken;
    if (!boundTokenQuery) {
      boundTokenQuery = (async () => {
        try {
          const doc = await chrome.tabs.sendMessage(tabId, { type: "gst:farm-diagnostics-document" });
          if (doc?.documentToken) {
            if (boundDocumentToken === null) boundDocumentToken = doc.documentToken;
            return boundDocumentToken;
          }
        } catch {}
        return null;
      })().finally(() => { boundTokenQuery = null; });
    }
    return boundTokenQuery;
  }
  void globalThis.GSTPopupAccountContextPromise?.then(async () => {
    const tabId = globalThis.GSTPopupAccountSession?.tabId?.();
    if (Number.isInteger(tabId)) await getOrInitDocumentToken(tabId);
  });

  async function boundDiagnosticTarget() {
    await globalThis.GSTPopupAccountContextPromise;
    const session = globalThis.GSTPopupAccountSession;
    const tabId = session?.tabId?.();
    if (!Number.isInteger(tabId)) return { target: null, error: "no_bound_tab" };
    try {
      await chrome.tabs.get(tabId);
    } catch {
      return { target: null, error: "tab_closed_navigation" };
    }
    const establishedToken = await getOrInitDocumentToken(tabId);
    let doc = null;
    try {
      doc = await chrome.tabs.sendMessage(tabId, { type: "gst:farm-diagnostics-document" });
    } catch {
      return { target: null, error: "tab_closed_navigation" };
    }
    if (!doc?.documentToken) return { target: null, error: "bridge_unavailable_timeout" };
    if (!establishedToken) {
      boundDocumentToken = doc.documentToken;
    } else if (establishedToken !== doc.documentToken) {
      return { target: null, error: "tab_closed_navigation" };
    }
    const expected = session?.current?.();
    let freshContext = null;
    try {
      freshContext = await globalThis.GSTAccountProfiles?.contextForTab(tabId, { fresh: true });
    } catch {
      return { target: null, error: "bridge_unavailable_timeout" };
    }
    if (!freshContext) return { target: null, error: "bridge_unavailable_timeout" };
    if (expected) {
      if (expected.slot !== undefined && freshContext.slot !== expected.slot) {
        return { target: null, error: "context_changed" };
      }
      if (expected.character && freshContext.character && expected.character !== freshContext.character) {
        return { target: null, error: "context_changed" };
      }
      if (expected.accountId && freshContext.accountId && expected.accountId !== freshContext.accountId) {
        return { target: null, error: "context_changed" };
      }
      if (expected.loginVisible !== true && freshContext.loginVisible === true) {
        return { target: null, error: "context_changed" };
      }
      if (["unexpected_character", "native_login_required"].includes(freshContext.reason)) {
        return { target: null, error: "context_changed" };
      }
    }
    return { target: { tabId, documentToken: doc.documentToken, expected, freshContext }, error: null };
  }

  async function exportDiagnostics(skillOnly) {
    const clickedButton = skillOnly ? skillButton : button;
    clickedButton.disabled = true;
    try {
      const { target, error } = await boundDiagnosticTarget();
      if (error === "no_bound_tab") {
        feedback.textContent = "Không tìm thấy tab game được gắn kết để xuất chẩn đoán.";
        return;
      }
      if (error === "tab_closed_navigation") {
        feedback.textContent = "Tab game đã đóng hoặc đã chuyển sang trang khác; không thể xuất chẩn đoán.";
        return;
      }
      if (error === "context_changed") {
        feedback.textContent = "Tài khoản hoặc ngữ cảnh trong tab game đã thay đổi; đã dừng xuất.";
        return;
      }
      if (error === "bridge_unavailable_timeout" || !target) {
        feedback.textContent = "Cầu nối chẩn đoán trong tab không phản hồi hoặc đã quá thời gian chờ.";
        return;
      }

      let data = null, status = null;
      try {
        data = await chrome.tabs.sendMessage(target.tabId, { type: "gst:farm-diagnostics" });
      } catch {
        feedback.textContent = "Cầu nối chẩn đoán trong tab không phản hồi hoặc đã quá thời gian chờ.";
        return;
      }
      try { status = await chrome.tabs.sendMessage(target.tabId, { type: "gst:farm-status" }); } catch {}

      if (!data || typeof data !== "object") {
        feedback.textContent = "Cầu nối chẩn đoán trong tab không phản hồi hoặc đã quá thời gian chờ.";
        return;
      }
      if (!data.documentToken || data.documentToken !== target.documentToken || data.build === "navigating") {
        feedback.textContent = "Tab game đã đóng hoặc đã chuyển sang trang khác; không thể xuất chẩn đoán.";
        return;
      }
      if (data.capture?.status === "stale") {
        const cachedId = data.capture?.identity;
        if (!cachedId || typeof cachedId !== "object") {
          feedback.textContent = "Không thể xác minh danh tính bản ghi bộ nhớ đệm; đã dừng xuất.";
          return;
        }
        if (target.expected) {
          if (target.expected.slot !== undefined && cachedId.slot !== target.expected.slot) {
            feedback.textContent = "Tài khoản hoặc ngữ cảnh trong tab game đã thay đổi; đã dừng xuất.";
            return;
          }
          if (target.expected.character && cachedId.character !== target.expected.character) {
            feedback.textContent = "Tài khoản hoặc ngữ cảnh trong tab game đã thay đổi; đã dừng xuất.";
            return;
          }
          if (target.expected.accountId && cachedId.accountId !== target.expected.accountId) {
            feedback.textContent = "Tài khoản hoặc ngữ cảnh trong tab game đã thay đổi; đã dừng xuất.";
            return;
          }
          if (target.expected.profileKey && cachedId.profileKey !== target.expected.profileKey) {
            feedback.textContent = "Tài khoản hoặc ngữ cảnh trong tab game đã thay đổi; đã dừng xuất.";
            return;
          }
        }
      }

      const available = ["farm-stop-1", "farm-stop-2"].includes(data.build);
      const report = compact(available ? data : {});
      report.diagnosticsAvailable = available;
      if (data.capture) {
        report.capture = {
          status: ["live", "stale", "unavailable"].includes(data.capture.status) ? data.capture.status : "unavailable",
          capturedAt: typeof data.capture.capturedAt === "string" ? data.capture.capturedAt : null
        };
      }
      report.farmStatus = {
        autoOn: typeof status?.autoOn === "boolean" ? status.autoOn : null,
        configuration: status?.configuration ? {
          policyHelper: status.configuration.policyHelper === true,
          loaded: status.configuration.loaded === true, sent: status.configuration.sent === true,
          received: status.configuration.received === true, ready: status.configuration.ready === true,
          error: typeof status.configuration.error === "string" ? status.configuration.error.slice(0, 160) : ""
        } : null,
        message: typeof status?.message === "string" ? status.message.slice(0, 240) : "Không nhận được trạng thái farm."
      };
      const exported = skillOnly ? { format: "gst-skill-1", capture: report.capture,
        diagnosticsAvailable: available, farmStatus: { autoOn: report.farmStatus.autoOn, message: report.farmStatus.message },
        skill: report.skill } : report;
      output.value = JSON.stringify(exported); output.hidden = false;
      const notice = !available
        ? "Chưa nhận được log MAIN và không có bản lưu an toàn; bản xuất chỉ có trạng thái cầu nối. "
        : data.capture?.status === "stale"
          ? `Đã xuất chẩn đoán từ bộ nhớ đệm (chụp lúc ${data.capture.capturedAt || "trước đó"}). `
          : !data.tracking
            ? "Bộ theo dõi farm chưa hoạt động; đã xuất dữ liệu hiện có. "
            : "";
      let copied = false;
      try { copied = await globalThis.GSTClipboard?.write(output.value) === true; } catch {}
      if (copied) {
        feedback.textContent = notice + (skillOnly ? "Đã sao chép log kỹ năng. Dán vào chat để kiểm tra." : "Đã sao chép log một dòng. Dán vào chat để kiểm tra Auto Farm, di chuyển và chạy nền.");
      } else {
        output.focus(); output.select(); feedback.textContent = notice + "Đã chọn log một dòng; bấm Ctrl+C rồi dán vào chat.";
      }
    } catch { feedback.textContent = "Chưa đọc được chẩn đoán. Mở tab game, tải lại extension và game nếu vừa cập nhật."; }
    finally { clickedButton.disabled = false; }
  }
  button.addEventListener("click", () => { void exportDiagnostics(false); });
  skillButton.addEventListener("click", () => { void exportDiagnostics(true); });
})();
