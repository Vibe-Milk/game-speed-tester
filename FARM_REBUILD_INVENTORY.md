# Auto Farm rebuild — retained and hidden controls

Source baseline: `3286719a9f5ada03837a77e7c16c048006d25b70` (separation phase).
This inventory describes static source behavior after the UI simplification. It is not gameplay verification.

## Visible controls

- Controller selection remains in Settings → Quản lý tính năng: Farm của game / Farm của tool. Selecting does not start Farm; tool remains unimplemented with no native/legacy fallback.
- Farm panel retains `farmRadius`, all monster/boss/level filters, runtime status, saved shortcut controls and read-only movement diagnostics export.
- Radius and filters are preparation only, not native-game configuration. Radius now reads/saves `radius` independently of legacy `enabled` and hidden `searchScope`; opening the UI does not rewrite either legacy value. A saved whole-map selection cannot hide the radius editor.
- Independent potion controls remain visible with their original handlers. `farmAutoRespawn` is relabeled as a shared Harvest permission and remains editable with verified-account gating, including when native is selected. Harvest uses its own `autoRespawn` setting AND this Farm flag. Its behavior has not been changed.

## Storage convention

`F.<key>` below means the existing merged Farm settings: global `chrome.storage.local.farmPreferences`, overridden by `chrome.storage.local['gstAccountProfiles:v1'][profileKey].farm`. UI edits continue through the original identity-bound preference writer. No bulk migration, deletion or OFF write to hidden saved settings is performed.

Phase names refer to the agreed medium tasks: Task 4 targets/routing; Task 5 approach/stuck/basic attacks; Task 6 skill priority; Task 7 pickup; Task 8 separately authorized QA. Extra features require explicit approval before restoration; a phase below is a proposed review point, not automatic authorization.

## Hidden controls and runtime disposition

| Hidden control IDs | Saved settings retained | Runtime disabled / evidence | Proposed restoration |
| --- | --- | --- | --- |
| `farmSearchScope` (old expanded/whole-map mode) | `F.enabled`, `F.searchScope` | Farm-page sends `enabled:false` to old owners; FarmMap requires `isExtended()`, currently always false. No old search loop. | Task 4: radius first; whole-map only with separate approval. |
| `farmIdleMode` | `F.idleMode` (`hold/home/seek`) | FarmBehavior detaches because `hasExtensionAssistance()` is false. No idle loot/home/scout decisions. | Tasks 4–5 for waiting/navigation; loot in Task 7. |
| `farmPreferLoot` | `F.preferLoot` | FarmBehavior detached; Custom configure/update/activation rejected. Tool performs no loot selection, approach or pickup. Native game pickup remains game behavior. | Task 7 with two pickup modes and clickable explanations. |
| `farmSelfDefense` | `F.selfDefense` | Effective runtime setting false; FarmDefense also requires extension assistance. | After Task 5, separately approved. |
| `farmNearbyClear`, `farmNearbyRadius` | `F.nearbyClear`, `F.nearbyRadius` | Effective `nearbyClear:false`; no old outside-filter combat. | After Task 5, separately approved. |
| `farmBossDodge`, `farmEliteDodge` | `F.bossDodge`, `F.eliteDodge` | Effective values false; old Farm safety requires extension assistance. Shared navigation remains available to independent owners. | After Tasks 5–6, separately approved. |
| `farmBossRetreat`, `farmRetreatHpPercent`, `farmRecoveryHpPercent` | `F.bossRetreat`, `F.retreatHpPercent`, `F.recoveryHpPercent` | Effective `bossRetreat:false`; no Farm-owned retreat/recovery controller. | After Tasks 5–6, separately approved. |
| `farmNoRetreat` | `F.noRetreat` | FarmCombat detaches without extension assistance; native game rest rules are unchanged. | After Task 5, recovery design separately approved. |
| `farmReturnDeath` | Global `areaMapOptions.returnDeath` | MapTravel configure now gates effective returnDeath on extension assistance (currently false), clears pending destination/return job through existing release path. `gst:map-return:v1` is transient intent, not a saved option; it is cleared. Independent click-to-walk remains available. | After Task 5, separately approved lifecycle/recovery task. |
| `farmKeepAcrossMaps` | Global `realmPreferences.keepFarm` | FarmSession does not restore outside `extended`; existing Farm intent is written OFF on policy application. Hidden saved keepFarm flag remains intact. | After Task 5, separately approved; no automatic restart. |
| `breakSeals` | `F.breakSeals` | FarmSeals accepts only extended/custom messages and requires extension assistance; no automatic seal navigation/attacks. | After Tasks 5–6, separately approved. |
| `farmAutoEncounter` | `F.autoEncounter` | Farm-page sends effective `autoEncounter:false`, detaching FarmEncounter. No hidden encounter clicks/travel. | Extra feature, not scheduled; separate approval. |
| `farmAcceptPartyInvites` | `F.acceptPartyInvites` | FarmParty requires extended and verified identity; tool/native do not activate it. | Extra feature, not scheduled; separate approval. |
| `farmAllowPlayerTargets` | `F.allowPlayerTargets` | No tool target-selection or native-host filter wrapper runs. Native mode follows game behavior; this saved tool setting does not constrain native/manual actions. | Outside approved monster-Farm scope; separate decision required. |
| `farmShowRange`, `farmShowTargetLine` | `F.showRange`, `F.showTargetLine` | FarmVisual detaches without extension assistance; no old targeting graphics. | Task 4 or 5 once new controller state exists. |
| `farmCustomStats` (already hidden in separation phase) | Per-tab sessionStorage `gst:custom-farm-stats-enabled:v1`, `gst:custom-farm-stats:v1` | Retired Custom engine cannot run, so comparison stats do not collect. Existing session data retained. | Task 8 or later, separately approved instrumentation. |
| `farmSkillDiagnosticsEnabled`, `clearFarmSkillDiagnostics` | No persistent preference; bounded tab-memory collector | Farm-page skill control accepts only extended; context is tool/native, so collection cannot be enabled. Read-only movement export remains accessible. | Tasks 6/8, separately approved instrumentation. |

## Presentation safeguards

- Retired nodes and IDs remain mounted in a hidden, inert `data-farm-retired` archive for compatibility with original readers/listeners. Only approved visible controls are moved out, preserving original fieldset locks; shared Harvest permission uses its own account lock.
- Search excludes retired descendants and refuses stale result clicks. Help conversion skips retired/hidden hints, preventing a hidden option from returning as a visible help control.
- The old saved-toggle count/status chips are removed. They did not represent actual active behavior and could navigate to hidden settings. Runtime status and the read-only diagnostics export remain.
- Section open state retains `farmSectionOpen:v1:*` / legacy `farmSectionOpen:v1` values. Retired section keys are not deleted. New independent-section state is presentation only.
- No new Farm controller, skill scheduler, pickup mode, native simulation change or competing loop is introduced. Harvest/Quest/potion controller code is untouched.

## Validation limits

Source/diff review only. Tests, lint, typecheck, browser QA and gameplay: NOT RUN. CI: NOT CHECKED. Runtime: UNVERIFIED.


## Task 4 planner availability

The saved radius/monster filters now feed a read-only target/route proposal on the existing status path. Farm stays OFF/unimplemented; there is no executable movement/combat controller. No hidden feature above has been restored. Planning uses radius only regardless of retained legacy whole-map/idle flags. The preview origin is not an activation origin; Task 5 must bind a fresh explicit start and current ownership before consuming plans. See the Task 4 section of CODEGRAPH.md for lifecycle, query bounds and limitations.


## Task 5 movement/basic combat

Tool now runs only after fresh explicit ON, with a new fixed start origin. Radius and monster filters feed approach/basic attacks; controller selection remains separate from ON. All hidden features in the table remain hidden and disabled. The only extra combat action is native Space/basic; skills 1–6 and tool pickup are not restored. The independent shared Harvest recovery setting remains visible, while tool Farm stops on death. No keep-after-map or returnDeath restoration is enabled. See Task 5 in CODEGRAPH.md for ownership, lifecycle, bounded stuck recovery and validation limits.


## Tasks 6–7 status

- New visible controls: `farmSkill1`–`farmSkill6` (saved `F.skillEnabled`, default none), `farmSkillPriority` and its save control (`F.skillPriority`, default 1–6), plus game/tool pickup choices (`F.pickupMode`, default game). No old hidden skill/loot/recovery behavior is reactivated. The scheduler uses current mapped slots rather than stored skill IDs.
- Skill priority is now implemented in the new Tool controller, with native readiness and completion checks. Changing the configuration stops the active session; fresh ON is required. `anh-bo` is skipped until its teleport destination can be established safely.
- Pickup-by-game delegates to independent game behavior without running native Farm decisions or tool loot navigation. `farmPickupTool` remains disabled, with clickable explanation. Task 7 cannot be completed under the exclusive-pickup requirement because no supported OFF API was found for independent auto-pickup in the provided source. No simulation/server mutation or fake exclusivity is supplied. A stored tool choice is retained and blocks Tool Farm start until changed explicitly.
- Read-only source/diff review only; runtime remains unverified and QA still requires separate authorization.

## Navigation relocation

Rebuilt Farm options and controller selection are now on **Auto của tool**. Potion HP/MP and the shared Harvest respawn permission are on **Tiện ích độc lập**. The original Farm page is retained but excluded from navigation/search; its obsolete behaviors remain disabled as recorded above. This move preserves saved preferences and does not restore hidden features or enable tool pickup.

## Skill mode restoration

The rebuilt skill section now offers default game selection and custom priority. Stored `skillMode` is `game`/`custom`; fresh records default to game, legacy records with slot/priority arrays retain custom including intentional all-off settings. Custom values persist while hidden in game mode. This restores no retired extended/Custom automation: only native `castSkills` is reused behind tool safety/action gates, with private session rotation. Tool pickup remains blocked.
