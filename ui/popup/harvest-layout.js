(() => {
  "use strict";
  const panel = document.querySelector('[data-panel="harvest"]');
  const controls = panel?.querySelector("#harvestControls");
  const oldGrid = controls?.querySelector(":scope > .harvest-grid");
  if (!panel || !controls || !oldGrid) return;

  const groups = document.createElement("div");
  groups.className = "harvest-organized";
  oldGrid.before(groups);
  const destinations = {}, sections = [];
  for (const [key, title] of [
    ["range", "Phạm vi & di chuyển"],
    ["resources", "Tài nguyên"],
    ["coordination", "Phối hợp & hiển thị"],
    ["advanced", "Nâng cao & phím tắt"],
  ]) {
    const open = key === "range" || key === "resources";
    const { section, content } = GSTPopupSections.create({
      id: "harvest-section-" + key, title, className: "harvest-section", bodyClass: "harvest-section-body", open,
    });
    groups.append(section);
    sections.push({ section, open });
    destinations[key] = content;
  }

  GSTPopupSections.register(sections, {
    storageKey: (section) => "harvestSectionOpen:v1:" + section.id.slice("harvest-section-".length),
  });

  const settings = oldGrid.querySelector(".harvest-settings");
  const settingsBody = settings?.querySelector(":scope > .feature-group-body");
  const resourceBody = oldGrid.querySelector(".harvest-selection > .feature-group-body");
  if (settingsBody) {
    settings.querySelector(":scope > h3")?.remove();
    const ordinaryControls = [];
    for (const node of [...settingsBody.childNodes]) {
      if (node.nodeType === Node.ELEMENT_NODE && node.matches("details")) break;
      ordinaryControls.push(node);
    }
    destinations.range.append(...ordinaryControls);

    const coordination = settingsBody.querySelector("#harvestCoordSummary")?.closest("details");
    const advanced = settingsBody.querySelector("#harvestAdvancedSummary")?.closest("details");
    const activity = settingsBody.querySelector(":scope > details.diagnostic");
    if (coordination) destinations.coordination.append(coordination);
    if (advanced) destinations.advanced.append(advanced);
    if (activity) destinations.advanced.append(activity);
  }
  if (resourceBody) {
    oldGrid.querySelector(".harvest-selection > h3")?.remove();
    destinations.resources.append(...resourceBody.childNodes);
  }
  const shortcut = controls.querySelector(":scope > details.advanced");
  if (shortcut) destinations.advanced.prepend(shortcut);
  oldGrid.remove();
})();
