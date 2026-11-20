(() => {
  "use strict";
  const panel = document.querySelector('[data-panel="farm"]');
  const archive = panel.querySelector('.farm-grid');
  const byId = (id) => document.getElementById(id);
  // Keep old nodes/IDs for existing preference readers; never present them as
  // active controls or search/help results while Farm is being rebuilt.
  archive.hidden = true;
  archive.dataset.farmRetired = "true";
  archive.inert = true;
  const groups = document.createElement('div');
  groups.className = 'farm-organized';
  archive.before(groups);
  const mirrors = [], sections = [];
  function section(key, title, open = true) {
    const node = document.createElement('details');
    node.className = 'farm-section'; node.id = 'farm-section-' + key; node.open = open;
    const heading = document.createElement('summary'); heading.textContent = title;
    const content = document.createElement('div'); content.className = 'farm-section-body';
    node.append(heading, content); groups.append(node); sections.push(node);
    return content;
  }
  function move(nodes, destination, mirrorSource = true) {
    const sources = new Set();
    for (const node of nodes) for (let parent = node.parentElement; parent; parent = parent.parentElement)
      if (mirrorSource && parent.tagName === 'FIELDSET') sources.add(parent);
    const wrapper = document.createElement('fieldset'); wrapper.className = 'farm-section-controls';
    wrapper.append(...nodes); destination.append(wrapper); mirrors.push({ wrapper, sources });
  }
  const range = section('range', 'Bán kính Farm');
  move([byId('farmRadius').closest('.input-action')], range);
  const hint = document.createElement('p'); hint.className = 'hint'; hint.setAttribute('role', 'note');
  hint.textContent = 'Bán kính và bộ lọc chỉ được lưu để chuẩn bị xây Farm của tool. Farm của game dùng cài đặt game gốc.';
  range.prepend(hint);
  const targets = section('targets', 'Bộ lọc quái');
  const targetColumn = archive.querySelector('.farm-target');
  targetColumn.querySelector('.farm-group-title')?.remove();
  move([targetColumn], targets);
  const controls = section('display', 'Phím bật/tắt Farm', false);
  const shortcut = byId('farmShortcutSummary').closest('details');
  move([shortcut], controls);
  const shared = section('independent', 'Tính năng độc lập với Farm', false);
  move([byId('potionSummary').closest('details')], shared);
  // Harvest still consults the Farm profile's autoRespawn flag. Keep it visible
  // and configurable instead of silently disabling Harvest's recovery.
  const respawn = byId('farmAutoRespawn').closest('label');
  const respawnHint = respawn.nextElementSibling;
  respawn.querySelector('span').textContent = 'Cho phép hồi sinh dùng chung với Thu hoạch';
  respawnHint.textContent = 'Thu hoạch còn kiểm tra lựa chọn hồi sinh riêng của nó. Farm của tool chưa chạy; Farm của game giữ cơ chế hồi sinh gốc.';
  move([respawn, respawnHint], shared, false);
  // Skill tracking cannot be enabled in inert tool/native policy. Keep the
  // read-only movement export available, but hide its retired skill controls.
  const skill = byId('farmSkillDiagnosticsEnabled').closest('label');
  const skillHint = skill.nextElementSibling;
  const retiredDiagnostics = document.createElement('div');
  retiredDiagnostics.hidden = true; retiredDiagnostics.inert = true;
  retiredDiagnostics.dataset.farmRetired = 'true';
  skill.before(retiredDiagnostics);
  retiredDiagnostics.append(skill, skillHint, byId('clearFarmSkillDiagnostics'));

  const prefix = 'farmSectionOpen:v1:', legacyKey = 'farmSectionOpen:v1';
  const touched = new Set();
  let ready = false;
  const storageKey = (node) => prefix + node.id.slice('farm-section-'.length);
  function remember(node, open) {
    if (!sections.includes(node)) return;
    touched.add(node.id);
    if (ready) void chrome.storage.local.set({ [storageKey(node)]: open }).catch(() => {});
  }
  globalThis.GSTFarmSectionLayout = { setOpen(node, open) { remember(node, open); node.open = open; } };
  for (const node of sections) {
    const summary = node.querySelector(':scope > summary');
    summary.addEventListener('click', (event) => { if (event.detail !== 0) remember(node, !node.open); });
    summary.addEventListener('keydown', (event) => { if (!event.repeat && event.key === 'Enter') remember(node, !node.open); });
    summary.addEventListener('keyup', (event) => { if (event.key === ' ') remember(node, !node.open); });
  }
  void chrome.storage.local.get([...sections.map(storageKey), legacyKey]).then((saved) => {
    for (const node of sections) if (!touched.has(node.id)) {
      const value = saved[storageKey(node)] ?? saved[legacyKey]?.[node.id];
      if (typeof value === 'boolean') node.open = value;
    }
  }).catch(() => {}).finally(() => {
    ready = true;
    for (const node of sections) if (touched.has(node.id)) remember(node, node.open);
  });
  function syncLocks() {
    for (const { wrapper, sources } of mirrors) {
      const disabled = [...sources].some((source) => source.disabled);
      if (wrapper.disabled !== disabled) wrapper.disabled = disabled;
    }
  }
  const locks = new MutationObserver(syncLocks);
  for (const source of new Set(mirrors.flatMap(({ sources }) => [...sources])))
    locks.observe(source, { attributes: true, attributeFilter: ['disabled'] });
  syncLocks();
  window.addEventListener('pagehide', () => locks.disconnect(), { once: true });
})();
