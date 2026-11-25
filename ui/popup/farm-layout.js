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
  const toolBody = byId('toolAutoBody');
  const independentBody = byId('independentAutoBody');
  toolBody.append(groups);
  // Move originals, preserving IDs, listeners, preference writers and locks.
  const management = byId('farmPolicyMode').closest('details');
  toolBody.prepend(management);
  const status = byId('farmStatus');
  toolBody.parentElement.querySelector(':scope > summary').append(status);
  toolBody.prepend(byId('farmAssistanceAvailability'));
  toolBody.append(byId('farmFeedback'));
  const mirrors = [], sections = [];
  function section(key, title, open = true) {
    const { section: node, content } = GSTPopupSections.create({
      id: 'farm-section-' + key, title, className: 'farm-section', bodyClass: 'farm-section-body', open,
    });
    groups.append(node); sections.push({ section: node, open });
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
  const scope = byId('farmSearchScope');
  move([scope.previousElementSibling, scope, scope.nextElementSibling, byId('farmRadius').closest('.input-action')], range);
  const hint = document.createElement('p'); hint.className = 'hint'; hint.setAttribute('role', 'note');
  hint.textContent = 'Phạm vi và bộ lọc áp dụng cho Farm của tool. Toàn map chỉ tìm trong dữ liệu game cung cấp.';
  range.prepend(hint);
  const targets = section('targets', 'Bộ lọc quái');
  const targetColumn = archive.querySelector('.farm-target');
  targetColumn.querySelector('.farm-group-title')?.remove();
  move([targetColumn], targets);
  move([byId('farmSkillOptions')], section('skills', 'Cách dùng kỹ năng'));
  move([byId('farmPickupOptions')], section('pickup', 'Nhặt đồ'));
  // Keep the fieldset as the original lock source after moving its controls.
  byId('farmActionControls').hidden = true;
  const controls = section('display', 'Phím bật/tắt Farm', false);
  const shortcut = byId('farmShortcutSummary').closest('details');
  move([shortcut], controls);
  const shared = section('independent', 'Đan và hồi sinh dùng chung', true);
  independentBody.append(shared.parentElement);
  move([byId('potionSummary').closest('details')], shared);
  const defense = byId('farmSelfDefense').closest('label');
  const defenseHint = defense.nextElementSibling;
  defense.querySelector('span').textContent = 'Tự vệ độc lập khi đứng yên';
  defenseHint.textContent = 'Khi bị đánh, chỉ phản công nếu game xác định được quái; nếu không, tìm hướng lùi an toàn. Nhường thao tác tay và hồi HP.';
  move([defense, defenseHint], shared, false);
  // Harvest still consults the Farm profile's autoRespawn flag. Keep it visible
  // and configurable instead of silently disabling Harvest's recovery.
  const respawn = byId('farmAutoRespawn').closest('label');
  const respawnHint = respawn.nextElementSibling;
  respawn.querySelector('span').textContent = 'Cho phép hồi sinh dùng chung với Thu hoạch';
  respawnHint.textContent = 'Thu hoạch còn kiểm tra lựa chọn hồi sinh riêng của nó. Farm của tool dừng khi chết; Farm của game giữ cơ chế hồi sinh gốc.';
  move([respawn, respawnHint], shared, false);
  const visual = section('visual', 'Hiển thị mục tiêu và phạm vi', true);
  independentBody.append(visual.parentElement);
  const rangeDisplay = byId('farmShowRange').closest('label');
  const rangeHint = rangeDisplay.nextElementSibling;
  rangeHint.textContent = 'Vòng thể hiện bán kính Farm của tool tính từ điểm bắt đầu.';
  const targetDisplay = byId('farmShowTargetLine').closest('label');
  targetDisplay.querySelector('span').textContent = 'Hiện đường tới quái Farm đang chọn';
  move([rangeDisplay, rangeHint, targetDisplay], visual, false);
  GSTPopupSections.register(sections, {
    storageKey: (node) => 'farmSectionOpen:v1:' + node.id.slice('farm-section-'.length),
    legacyKey: 'farmSectionOpen:v1',
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
