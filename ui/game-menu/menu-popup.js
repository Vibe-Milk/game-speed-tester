(() => {
  "use strict";
  const embedded = new URLSearchParams(location.search).get("embedded") === "1";
  const button = document.getElementById("openGameMenu");
  let shortcut = { code: "Tab", ctrl: false, alt: false, shift: false, meta: false }, shortcutRevision = 0;
  function matchesShortcut(event) {
    return event.code === shortcut.code && event.ctrlKey === shortcut.ctrl
      && event.altKey === shortcut.alt && event.shiftKey === shortcut.shift
      && event.metaKey === shortcut.meta;
  }
  if (embedded) {
    document.body.classList.add("embedded"); button.hidden = true;
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault(); event.stopImmediatePropagation();
        parent.postMessage({ channel: "gst:menu-close:v1" }, "https://nghichthienky.online");
        return;
      }
      if (event.repeat || !matchesShortcut(event)) return;
      event.preventDefault(); event.stopImmediatePropagation();
      parent.postMessage({ channel: "gst:menu-close:v1" }, "https://nghichthienky.online");
    }, true);
  }
  const controls = document.getElementById("menuPositionControls"), select = document.getElementById("menuPosition");
  const feedback = document.getElementById("menuPositionFeedback");
  const shortcutLabel = document.getElementById("menuShortcutLabel"), shortcutFeedback = document.getElementById("menuShortcutFeedback");
  const showShortcut = () => { shortcutLabel.textContent = GSTPopupShortcut.format(shortcut); };
  const storeShortcut = async (value) => {
    try { await chrome.storage.local.set({ menuShortcut: value }); shortcut = value; showShortcut(); GSTPopupFeedback.success(shortcutFeedback, "Đã lưu phím mở Menu tool."); }
    catch { GSTPopupFeedback.error(shortcutFeedback, "Chưa lưu được phím. Thử lại."); }
  };
  GSTPopupShortcut.bind({
    capture: document.getElementById("captureMenuShortcut"),
    reset: document.getElementById("resetMenuShortcut"),
    feedback: shortcutFeedback,
    prompt: "Bấm một phím hoặc giữ Ctrl/Alt/Shift/Meta rồi bấm phím. Esc để hủy.",
    invalidMessage: "Phím này không dùng được.",
    ignore: (event) => GSTPopupShortcut.isModifier(event) || event.repeat,
    valid: (event) => !!event.code && event.code !== "F5",
    value: GSTPopupShortcut.chord,
    defaultValue: { code: "Tab", ctrl: false, alt: false, shift: false, meta: false },
    save: storeShortcut,
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.menuShortcut) { shortcutRevision++; shortcut = changes.menuShortcut.newValue ?? shortcut; showShortcut(); }
  });
  const initialShortcutRevision = shortcutRevision;
  chrome.storage.local.get("menuShortcut").then((value) => {
    if (shortcutRevision === initialShortcutRevision) shortcut = value.menuShortcut ?? shortcut;
    showShortcut();
  }).catch(() => { GSTPopupFeedback.error(shortcutFeedback, "Chưa đọc được phím tắt."); });
  let saved = GSTMenuPosition.normalize(null), busy = false, revision = 0;
  function render() { select.value = saved.position; }
  async function savePosition(value) {
    if (busy) return;
    busy = true; controls.disabled = true;
    const before = revision;
    try { await chrome.storage.local.set({ menuPosition: value }); if (revision === before) saved = value; render(); GSTPopupFeedback.success(feedback, "Đã lưu vị trí nút Menu tool."); }
    catch { render(); GSTPopupFeedback.error(feedback, "Chưa lưu được vị trí. Thử lại."); }
    finally { busy = false; controls.disabled = false; }
  }
  select.addEventListener("change", () => savePosition(GSTMenuPosition.normalize({ ...saved, position: select.value })));
  document.getElementById("resetMenuPosition").addEventListener("click", () => savePosition(GSTMenuPosition.normalize(null)));
  document.getElementById("editMenuPosition").addEventListener("click", async () => {
    if (embedded) { parent.postMessage({ channel: "gst:menu-edit:v1" }, "https://nghichthienky.online"); return; }
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const result = await chrome.tabs.sendMessage(tab.id, { type: "gst:menu-position-edit" });
      if (result.editing) window.close(); else GSTPopupFeedback.info(feedback, "Chờ game tải xong rồi thử lại.");
    } catch { GSTPopupFeedback.info(feedback, "Mở tab game và tải lại sau cập nhật để kéo nút."); }
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.menuPosition) { revision++; saved = GSTMenuPosition.normalize(changes.menuPosition.newValue); render(); }
  });
  const initialRevision = revision;
  chrome.storage.local.get("menuPosition").then((value) => { if (revision === initialRevision) saved = GSTMenuPosition.normalize(value.menuPosition); render(); controls.disabled = false; })
    .catch(() => { GSTPopupFeedback.error(feedback, "Chưa đọc được cài đặt vị trí. Mở lại menu để thử."); });
  button.addEventListener("click", async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const result = await chrome.tabs.sendMessage(tab.id, { type: "gst:open-menu" });
      if (result.opened) window.close();
    } catch { document.getElementById("feedback").textContent = "Mở tab game, tải lại sau cập nhật rồi thử lại."; }
  });
})();
