(() => {
  "use strict";

  function convertGroups(namespace, container, sourceSelector, definitions) {
    if (!container) return [];
    container.classList.remove("wide-groups", "feature-group-grid", "feature-flat-grid");
    container.classList.add("feature-organized");
    const sources = [...container.querySelectorAll(`:scope > ${sourceSelector}`)];
    return sources.map((source, index) => {
      const definition = definitions[index];
      if (!definition) return null;
      const title = source.querySelector(":scope > h3");
      const body = source.querySelector(":scope > .feature-group-body");
      const { section } = GSTPopupSections.create({
        id: namespace + "-section-" + definition.key,
        title: title?.textContent?.trim() || definition.title,
        className: "feature-group ui-section", bodyClass: "feature-group-body", body, open: definition.open,
      });
      section.dataset.uiSectionKey = namespace + ":" + definition.key;
      if (title) title.remove();
      source.replaceWith(section);
      return { section, open: definition.open };
    }).filter(Boolean);
  }

  const questSections = convertGroups("quest", document.querySelector("#questControls > .wide-groups"),
    "section.wide-group", [
      { key: "search", title: "Tìm & sắp xếp quest", open: true },
      { key: "list", title: "Danh sách & chạy quest", open: true },
    ]);
  const connectionSections = convertGroups("connection",
    document.querySelector('#connectionRecoveryControls > .feature-group-grid'),
    "section.feature-flat-section", [
      { key: "reconnect", title: "Kết nối lại", open: true },
      { key: "reload", title: "Tự tải lại khi lỗi kéo dài", open: false },
    ]);

  const interfaceSections = [...document.querySelectorAll('#featurePanels [data-panel="interface"] > .card-body > .interface-groups > details')]
    .map((section) => {
      const key = section.dataset.panel || "feature-management";
      section.classList.add("ui-section");
      section.id ||= `interface-section-${key}`;
      section.dataset.uiSectionKey = `interface:${key}`;
      return { section, open: false };
    });
  const allSections = [...questSections, ...connectionSections, ...interfaceSections];
  GSTPopupSections.register(allSections, {
    storageKey: (section) => "popupSectionOpen:v1:" + section.dataset.uiSectionKey,
  });
})();
