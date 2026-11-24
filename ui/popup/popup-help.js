(() => {
  "use strict";
  let preview, dialog, title, content, closeButton, previewNote = null, activeNote = null;
  let restoringFocus = false;

  // Register before other popup shortcuts; build the UI after all deferred
  // layout scripts have moved the original controls.
  window.addEventListener("keydown", (event) => {
    if (dialog?.open) {
      event.stopImmediatePropagation();
      if (event.key === "Escape") {
        event.preventDefault();
        closeDialog();
      } else if (event.key === "Tab") {
        event.preventDefault();
        const next = document.activeElement === closeButton ? content : closeButton;
        next.focus({ preventScroll: true });
      }
      return;
    }
    if (event.key === "Escape" && previewNote) {
      hidePreview();
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  function node(tag, className, value) {
    const element = document.createElement(tag);
    element.className = className;
    if (value !== undefined) element.textContent = value;
    return element;
  }

  function hidePreview(note = null) {
    if (!preview || (note && previewNote !== note)) return;
    preview.hidden = true;
    previewNote = null;
  }

  function showPreview(note) {
    if (dialog.open || restoringFocus || !note.button.getClientRects().length) return;
    const first = note.parts[0]?.text ?? "";
    const sentence = first.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? first;
    const short = sentence.length <= 140 ? sentence : sentence.slice(0, 137).replace(/\s+\S*$/, "") + "…";
    preview.replaceChildren(node("span", "global-help-preview-text", short),
      node("small", "global-help-preview-action", "Bấm ? để xem chi tiết"));
    preview.hidden = false;
    previewNote = note;
    const rect = note.button.getBoundingClientRect();
    const gap = 8, width = preview.offsetWidth, height = preview.offsetHeight;
    const left = Math.max(gap, Math.min(rect.left + rect.width / 2 - width / 2, innerWidth - width - gap));
    const below = rect.bottom + gap;
    const top = below + height <= innerHeight - gap ? below : rect.top - height - gap;
    preview.style.left = left + "px";
    preview.style.top = Math.max(gap, Math.min(top, innerHeight - height - gap)) + "px";
  }

  function openDialog(note) {
    if (dialog.open) return;
    hidePreview();
    title.textContent = note.title;
    content.replaceChildren(...note.parts.map(({ heading, text }) => {
      const section = node("section", "global-help-section");
      if (heading) section.append(node("h3", "global-help-section-title", heading));
      section.append(node("p", "global-help-paragraph", text));
      return section;
    }));
    content.scrollTop = 0;
    activeNote = note;
    note.button.setAttribute("aria-expanded", "true");
    dialog.showModal();
    closeButton.focus({ preventScroll: true });
  }

  function closeDialog() {
    if (!dialog?.open) return;
    const note = activeNote;
    activeNote = null;
    note?.button.setAttribute("aria-expanded", "false");
    restoringFocus = true;
    dialog.close();
    if (note?.button.isConnected && note.button.getClientRects().length && !note.button.matches(":disabled")) {
      note.button.focus({ preventScroll: true });
    }
    hidePreview();
    restoringFocus = false;
  }

  function bindButton(button, helpTitle, parts = []) {
    button.classList.add("compact-help-button");
    button.textContent = "?";
    button.setAttribute("aria-label", "Giải thích: " + helpTitle);
    button.setAttribute("aria-haspopup", "dialog");
    button.setAttribute("aria-controls", dialog.id);
    button.setAttribute("aria-expanded", "false");
    const note = { button, title: helpTitle, parts };
    button.addEventListener("mouseenter", () => showPreview(note));
    button.addEventListener("mouseleave", () => hidePreview(note));
    button.addEventListener("focus", () => showPreview(note));
    button.addEventListener("blur", () => hidePreview(note));
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openDialog(note);
    });
    return note;
  }

  function helpTitle(anchor, hint) {
    const explicit = hint?.dataset.helpTitle;
    const label = anchor.textContent.trim().replace(/\s+/g, " ");
    const group = anchor.closest("details")?.querySelector(":scope > summary")?.textContent.trim();
    return explicit || (label.length && label.length <= 110 ? label : group) || "Hướng dẫn sử dụng";
  }

  function init() {
    preview = node("div", "global-help-preview");
    preview.hidden = true;
    preview.setAttribute("aria-hidden", "true"); // full text is available via the dialog

    dialog = node("dialog", "global-help-dialog");
    dialog.id = "gstGlobalHelpDialog";
    dialog.setAttribute("aria-labelledby", "gstGlobalHelpTitle");
    const header = node("div", "global-help-header");
    const heading = node("div", "global-help-heading");
    heading.append(node("span", "global-help-kicker", "HƯỚNG DẪN TÍNH NĂNG"));
    title = node("h2", "global-help-title");
    title.id = "gstGlobalHelpTitle";
    heading.append(title);
    closeButton = node("button", "global-help-close", "×");
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Đóng hướng dẫn");
    header.append(heading, closeButton);
    content = node("div", "global-help-content");
    content.tabIndex = 0;
    content.setAttribute("role", "region");
    content.setAttribute("aria-label", "Nội dung hướng dẫn");
    dialog.append(header, content);
    document.body.append(preview, dialog);
    closeButton.addEventListener("click", closeDialog);
    dialog.addEventListener("cancel", (event) => { event.preventDefault(); closeDialog(); });
    let backdropDown = false;
    const outside = (event) => {
      const rect = dialog.getBoundingClientRect();
      return event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right
        || event.clientY < rect.top || event.clientY > rect.bottom);
    };
    dialog.addEventListener("pointerdown", (event) => { backdropDown = outside(event); });
    dialog.addEventListener("click", (event) => {
      if (backdropDown && outside(event)) closeDialog();
      backdropDown = false;
    });

    const anchors = new Map();
    for (const hint of document.querySelectorAll(".card p.hint, footer p.hint")) {
      // Dynamic feedback/status and retired controls are not help text.
      if (hint.closest("[data-farm-retired]") || hint.hidden || hint.id || hint.hasAttribute("role") || !hint.textContent.trim()) continue;
      let anchor = hint.dataset.helpFor ? document.querySelector(hint.dataset.helpFor) : hint.previousElementSibling;
      if (!anchor || anchor.closest("[data-farm-retired]")) continue;
      if (anchor.matches("input, select") && anchor.id) anchor = document.querySelector('label[for="' + CSS.escape(anchor.id) + '"]') ?? anchor;
      if (anchor.matches("div:not(.compact-help-row)")) anchor = [...anchor.querySelectorAll("label")].at(-1) ?? anchor;
      let note = anchors.get(anchor);
      if (!note) {
        const row = node("div", "compact-help-row");
        const wrap = node("span", "compact-help");
        const button = node("button", "compact-help-button", "?");
        button.type = "button";
        note = bindButton(button, helpTitle(anchor, hint));
        anchor.before(row);
        row.append(anchor, wrap);
        wrap.append(button);
        anchors.set(anchor, note);
        anchors.set(row, note);
      }
      note.parts.push({ heading: hint.dataset.helpHeading ?? "", text: hint.textContent.trim() });
      hint.remove();
    }

    // Route any older explicit field-help markup through the same UI. Keep
    // the source text and avoid a nested interactive element in a label.
    for (const help of document.querySelectorAll(".field-help")) {
      if (help.closest("[data-farm-retired]")) continue;
      const tip = help.querySelector(".help-tooltip");
      if (!tip?.textContent.trim()) continue;
      const text = tip.textContent.trim();
      const label = help.closest("label");
      const button = node("button", "compact-help-button", "?");
      button.type = "button";
      const wrap = node("span", "compact-help");
      wrap.append(button);
      if (label) {
        help.remove();
        const row = node("div", "compact-help-row");
        label.before(row);
        row.append(label, wrap);
      } else {
        help.replaceWith(wrap);
      }
      bindButton(button, label?.textContent.trim() || "Giải thích cài đặt", [{ heading: "", text }]);
    }

    document.addEventListener("click", (event) => {
      if (!event.target.closest(".compact-help")) hidePreview();
    });
    document.addEventListener("toggle", () => hidePreview(), true);
    document.addEventListener("scroll", () => hidePreview(), true);
    window.addEventListener("resize", () => hidePreview());
    window.addEventListener("blur", () => hidePreview());
  }

  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
