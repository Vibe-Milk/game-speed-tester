# Feature Index — tra cứu tính năng → source

Đọc file này trước khi mở source. Chọn nhóm gần nhất, mở Wiki module, tìm `anchor` nguyên văn trong **source gốc** rồi mới đọc đoạn code liên quan. Các nhóm liên module là hướng dẫn điều tra, **không xác nhận đã kiểm thử luồng chạy**.

## Auto Farm của game (`game_autofarm`)
**Từ khóa:** `auto farm`, `auto luyện`, `tự luyện`, `farm`, `V$`, `toggleAutoFarm`

Controller Auto Farm trong WorldScene, không phải hệ thống Auto Farm của extension/tool.

| Module / Wiki | Source | Feature ID | Anchor đầu tiên |
|---|---|---|---|
| [WorldScene](modules/WorldScene.md) | `WorldScene-bJccyikN.js` | `game_autofarm_controller` | `class V${constructor(){M(this,"on",!1)` |
| [WorldScene](modules/WorldScene.md) | `WorldScene-bJccyikN.js` | `game_autofarm_toggle` | `toggleAutoFarm(){var e,i;this.cancelClickOrder()` |
| [WorldScene](modules/WorldScene.md) | `WorldScene-bJccyikN.js` | `game_autofarm_targets` | `const p=t.inCombat(),u=k=>p&&!!k.aggro` |
| [WorldScene](modules/WorldScene.md) | `WorldScene-bJccyikN.js` | `game_autofarm_navigation` | `walk(t,e,i,n,s,o,r){if(se(i,n,this.lastX` |
| [WorldScene](modules/WorldScene.md) | `WorldScene-bJccyikN.js` | `game_autofarm_loot` | `idle(t,e,i,n){const s=r=>` |
| [WorldScene](modules/WorldScene.md) | `WorldScene-bJccyikN.js` | `game_autofarm_scene_bridge` | `M(this,"auto",new V$)` |

**Giới hạn:** Cần tra thêm implementation của extension/tool trước khi tách hoặc chặn Auto Farm game.

## Nhặt đồ và lọc loot (`loot_and_auto_pickup`)
**Từ khóa:** `nhặt đồ`, `loot`, `pickup`, `autoLootAt`, `lootMin`, `lootRecover`, `lọc đồ`

Định vị nhặt từ Auto Farm client, action pickup, lọc loot và nhặt theo tick simulation.

| Module / Wiki | Source | Feature ID | Anchor đầu tiên |
|---|---|---|---|
| [WorldScene](modules/WorldScene.md) | `WorldScene-bJccyikN.js` | `game_autofarm_loot` | `idle(t,e,i,n){const s=r=>` |
| [sim](modules/sim.md) | `sim-B1iiLlB3.js` | `loot_pickup_handler` | `pickup(t,n,e=!1){if(n.dead\|\|n.room!==t\|\|n.realm)` |
| [sim](modules/sim.md) | `sim-B1iiLlB3.js` | `loot_filter_actions` | `case"pickup":this.pickup(i,t,e!=="auto");return;` |
| [sim](modules/sim.md) | `sim-B1iiLlB3.js` | `simulation_auto_pickup` | `this.time>=h.autoLootAt&&(h.autoLootAt=this.time+.2,o.loot.length&&this.pickup(o,h))` |

**Giới hạn:** Không đồng nhất nhặt do V$ gọi với nhặt định kỳ ở sim; khi can thiệp phải xem cả hai.

## Quái vật và chiến đấu (`monster_and_combat`)
**Từ khóa:** `quái`, `monster`, `combat`, `đánh quái`, `target`, `skill`

Tìm mục tiêu farm, tick quái/combat và phản hồi hiệu ứng; phân biệt logic simulation với render.

| Module / Wiki | Source | Feature ID | Anchor đầu tiên |
|---|---|---|---|
| [WorldScene](modules/WorldScene.md) | `WorldScene-bJccyikN.js` | `game_autofarm_targets` | `const p=t.inCombat(),u=k=>p&&!!k.aggro` |
| [WorldScene](modules/WorldScene.md) | `WorldScene-bJccyikN.js` | `skill_queue` | `flushSkill(){var i;const e=this.pendingSkill;if(e){if(this.dead\|\|this.uiBlocked\|\|this.leaving\|\|this` |
| [sim](modules/sim.md) | `sim-B1iiLlB3.js` | `monster_combat_tick` | `this.updateMonsters(o,t),this.updateShots(o,t)` |
| [ChieuMau](modules/ChieuMau.md) | `ChieuMau-qVW4fvFM.js` | `combat_effect_pool` | `class Ro{constructor(e){g(this,"px",new Float32Array(L))` |

**Giới hạn:** Hiệu ứng ChieuMau không chứng minh quy tắc gây sát thương.

## Di chuyển và tương tác (`movement_and_interaction`)
**Từ khóa:** `move`, `walk`, `path`, `di chuyển`, `tọa độ`, `pickTarget`, `interact`

Tra cứu đường di chuyển Auto Farm, di chuyển scene và chọn mục tiêu tương tác.

| Module / Wiki | Source | Feature ID | Anchor đầu tiên |
|---|---|---|---|
| [WorldScene](modules/WorldScene.md) | `WorldScene-bJccyikN.js` | `world_tick_orchestration` | `update(e,i){var l,c,d,p,u,m,g,f,y,b,v,k,w,C,T,q,H,S,E,A,L,P,N,B,j,R,W;if((l=this.liveSkills)==null\|\|l.u` |
| [WorldScene](modules/WorldScene.md) | `WorldScene-bJccyikN.js` | `target_interaction` | `pickTarget(){var s,o,r,h;if((s=this.realmUI)!=null&&s.target)return{realm:this.realmUI.target}` |
| [WorldScene](modules/WorldScene.md) | `WorldScene-bJccyikN.js` | `game_autofarm_navigation` | `walk(t,e,i,n,s,o,r){if(se(i,n,this.lastX` |

**Giới hạn:** Cách điều khiển driver/đồng bộ server cần đối chiếu các điểm gọi và driver thực tế.

## Thu hoạch tài nguyên (`harvest_and_resources`)
**Từ khóa:** `harvest`, `thu hoạch`, `node`, `resources`

Định vị action harvest của simulation và tương tác với node tại scene.

| Module / Wiki | Source | Feature ID | Anchor đầu tiên |
|---|---|---|---|
| [sim](modules/sim.md) | `sim-B1iiLlB3.js` | `resource_harvest_action` | `case"harvest":{const g=Number(e),k=i.nodes[g];` |
| [WorldScene](modules/WorldScene.md) | `WorldScene-bJccyikN.js` | `target_interaction` | `pickTarget(){var s,o,r,h;if((s=this.realmUI)!=null&&s.target)return{realm:this.realmUI.target}` |

**Giới hạn:** Không kết luận toàn bộ hành vi thu hoạch chỉ từ callsite; đọc điều kiện ở source trước khi sửa.

## Kết nối, WebSocket và reconnect (`network_and_reconnect`)
**Từ khóa:** `connection`, `disconnect`, `WebSocket`, `WebRTC`, `reconnect`, `driver`, `kết nối`

Điểm vào transport, WebSocket shim và vòng cập nhật scene.

| Module / Wiki | Source | Feature ID | Anchor đầu tiên |
|---|---|---|---|
| [index-ymL7Xfvg](modules/index.md) | `index-ymL7Xfvg.js` | `online_transport` | `class vy{constructor(t,e){_(this,"online",!0);` |
| [tm-direct](modules/tm-direct.md) | `tm-direct.js` | `direct_ws_routing` | `function WebSocketShim(url, protocols) {` |
| [tm-direct](modules/tm-direct.md) | `tm-direct.js` | `direct_ws_fallback` | `function fallback() {` |
| [WorldScene](modules/WorldScene.md) | `WorldScene-bJccyikN.js` | `world_tick_orchestration` | `update(e,i){var l,c,d,p,u,m,g,f,y,b,v,k,w,C,T,q,H,S,E,A,L,P,N,B,j,R,W;if((l=this.liveSkills)==null\|\|l.u` |

**Giới hạn:** Chưa có source server hoặc thứ tự tải tm-direct/tm-guard; LocalDriver cũng thiếu.

## Snapshot và đồng bộ trạng thái (`snapshot_and_state`)
**Từ khóa:** `snapshot`, `snap2`, `state`, `delta`, `entity`, `đồng bộ`

Nơi tạo snapshot trong simulation, giải mã ở entry và đọc snapshot qua guard script.

| Module / Wiki | Source | Feature ID | Anchor đầu tiên |
|---|---|---|---|
| [sim](modules/sim.md) | `sim-B1iiLlB3.js` | `world_snapshots` | `snapshotPlayers(){const t=new Map` |
| [index-ymL7Xfvg](modules/index.md) | `index-ymL7Xfvg.js` | `snapshot_decode` | `class yy{constructor(){_(this,"self",{});_(this,"seen",new Set)}decode(t){` |
| [tm-guard](modules/tm-guard.md) | `tm-guard.js` | `tribulation_button` | `function tribButton(on) {` |

**Giới hạn:** Chỉ là các điểm định vị; không chứng minh toàn bộ end-to-end protocol.

## Khởi động và vòng đời scene (`startup_and_scene`)
**Từ khóa:** `startup`, `boot`, `Phaser`, `WorldScene`, `scene`, `init`, `lab`

Định vị khởi động dữ liệu, Phaser runtime, WorldScene và nhánh lab.

| Module / Wiki | Source | Feature ID | Anchor đầu tiên |
|---|---|---|---|
| [index-ymL7Xfvg](modules/index.md) | `index-ymL7Xfvg.js` | `application_boot` | `async function cP(){var D,C,R,F;AM(),GM();` |
| [index-ymL7Xfvg](modules/index.md) | `index-ymL7Xfvg.js` | `join_session` | `async function rP(){var t;let n="";for(;;){` |
| [index-ymL7Xfvg](modules/index.md) | `index-ymL7Xfvg.js` | `lab_startup` | `import("./boot-DGR3-xtV.js")` |
| [WorldScene](modules/WorldScene.md) | `WorldScene-bJccyikN.js` | `scene_lifecycle` | `class g6 extends tt.Scene{constructor(){super("world")` |
| [phaser-framework-bundle](modules/phaser.md) | `phaser-DRI6y8R5.js` | `scene_system` | `this.sys=new c(this,n),this.game,this.anims,this.cache,this.registry,this.sound` |

**Giới hạn:** Thiếu source boot lab và LocalDriver; mô tả framework không đồng nghĩa hành vi app.

## Vật phẩm, trang bị, túi đồ (`items_and_inventory`)
**Từ khóa:** `items`, `gear`, `inventory`, `bag`, `túi đồ`, `icon`, `loot`

Tra cứu metadata vật phẩm, icon, HUD và xử lý gear nhặt được.

| Module / Wiki | Source | Feature ID | Anchor đầu tiên |
|---|---|---|---|
| [items](modules/items.md) | `items-CCENVhBq.js` | `item_metadata` | `function En(){return A??(A=Promise.all([fetch("data/items/items-meta.json")` |
| [items](modules/items.md) | `items-CCENVhBq.js` | `gear_icons` | `function K(n){n={...n,id:tn(n.id)??n.id}` |
| [WorldScene](modules/WorldScene.md) | `WorldScene-bJccyikN.js` | `hud_and_minimap` | `updateHud(){var l,c,d,p;const e=this.self;if(!e)return` |
| [sim](modules/sim.md) | `sim-B1iiLlB3.js` | `loot_pickup_handler` | `pickup(t,n,e=!1){if(n.dead\|\|n.room!==t\|\|n.realm)` |

**Giới hạn:** Dữ liệu JSON tải lúc chạy không có trong 9 file JS.

## Phím điều khiển và input (`controls_and_inputs`)
**Từ khóa:** `keybind`, `controls`, `bàn phím`, `phím V`, `input`

Định vị phím mặc định, cấu hình lưu và phím gọi Auto Farm game.

| Module / Wiki | Source | Feature ID | Anchor đầu tiên |
|---|---|---|---|
| [items](modules/items.md) | `items-CCENVhBq.js` | `default_controls` | `const I=[["W",87,"Đi lên"]` |
| [items](modules/items.md) | `items-CCENVhBq.js` | `controls_storage` | `Z="tm-controls-v1"` |
| [WorldScene](modules/WorldScene.md) | `WorldScene-bJccyikN.js` | `game_autofarm_toggle` | `toggleAutoFarm(){var e,i;this.cancelClickOrder()` |
| [phaser-framework-bundle](modules/phaser.md) | `phaser-DRI6y8R5.js` | `loader_input_physics` | `LoaderPlugin:t(74261),MergeXHRSettings:t(3374),MultiFile:t(26430)` |

**Giới hạn:** Phím V Auto Farm được ghi trong WorldScene; không suy ra tính năng tool.

## Render nhân vật và hiệu ứng (`visuals_and_effects`)
**Từ khóa:** `animation`, `effects`, `particles`, `render`, `vfx`, `hiệu ứng`

Tra cứu animation nhân vật, renderer scene, pool và texture hiệu ứng.

| Module / Wiki | Source | Feature ID | Anchor đầu tiên |
|---|---|---|---|
| [Character](modules/Character.md) | `Character-cz94XTen.js` | `animation_playback` | `play(t,i){if(this.labForce&&([t,i]=this.labForce)` |
| [Character](modules/Character.md) | `Character-cz94XTen.js` | `animation_tick` | `update(t,i=1){if(!this.clip)return` |
| [Character](modules/Character.md) | `Character-cz94XTen.js` | `character_feet` | `feet(){const t=this.view,i=t.frame` |
| [ChieuMau](modules/ChieuMau.md) | `ChieuMau-qVW4fvFM.js` | `combat_effect_pool` | `class Ro{constructor(e){g(this,"px",new Float32Array(L))` |
| [ChieuMau](modules/ChieuMau.md) | `ChieuMau-qVW4fvFM.js` | `effect_textures` | `Ft="juice:glow",Io="juice:scorch"` |
| [WorldScene](modules/WorldScene.md) | `WorldScene-bJccyikN.js` | `world_tick_orchestration` | `update(e,i){var l,c,d,p,u,m,g,f,y,b,v,k,w,C,T,q,H,S,E,A,L,P,N,B,j,R,W;if((l=this.liveSkills)==null\|\|l.u` |

**Giới hạn:** Không suy ra cơ chế combat chỉ từ animation hoặc VFX.

## Guard và nút độ kiếp mobile (`guard_and_mobile`)
**Từ khóa:** `guard`, `guard-ok`, `tribulation`, `độ kiếp`, `mobile`

Tra cứu thông điệp guard, hook WebRTC và nút độ kiếp.

| Module / Wiki | Source | Feature ID | Anchor đầu tiên |
|---|---|---|---|
| [tm-guard](modules/tm-guard.md) | `tm-guard.js` | `guard_challenge` | `function feed(data) {` |
| [tm-guard](modules/tm-guard.md) | `tm-guard.js` | `tribulation_button` | `function tribButton(on) {` |
| [tm-guard](modules/tm-guard.md) | `tm-guard.js` | `webrtc_feed_hook` | `window.__tmGuard = { feed: feed };` |

**Giới hạn:** Thứ tự nạp script và quyền truy cập hook bên ngoài chưa rõ.

## Trang bị, forge và chuyển đổi state (`equipment_and_forge`)
**Từ khóa:** `forge`, `equipment`, `rèn`, `trang bị`

Điểm di trú dữ liệu trang bị và metadata/icon.

| Module / Wiki | Source | Feature ID | Anchor đầu tiên |
|---|---|---|---|
| [sim](modules/sim.md) | `sim-B1iiLlB3.js` | `equipment_forge_migration` | `function ta(a,t)` |
| [items](modules/items.md) | `items-CCENVhBq.js` | `item_metadata` | `function En(){return A??(A=Promise.all([fetch("data/items/items-meta.json")` |
| [items](modules/items.md) | `items-CCENVhBq.js` | `gear_icons` | `function K(n){n={...n,id:tn(n.id)??n.id}` |

**Giới hạn:** Đường di trú dữ liệu không chứng minh mọi UI hay quá trình rèn.

## Sư đồ, đệ tử và tổ đội (`mentor_and_party`)
**Từ khóa:** `sư đồ`, `đệ tử`, `party`, `mentor`, `pupil`

Điểm xử lý action sư đồ và XP tổ đội.

| Module / Wiki | Source | Feature ID | Anchor đầu tiên |
|---|---|---|---|
| [sim](modules/sim.md) | `sim-B1iiLlB3.js` | `mentor_pupil` | `function Mm(a,t,n,e){` |

**Giới hạn:** Các state ngoài module cần xác minh khi có thay đổi gameplay.

## Donation và quà nạp (`donation`)
**Từ khóa:** `donation`, `nạp`, `incense`, `claim`

Điểm xử lý action donation trong simulation.

| Module / Wiki | Source | Feature ID | Anchor đầu tiên |
|---|---|---|---|
| [sim](modules/sim.md) | `sim-B1iiLlB3.js` | `donation_actions` | `function oo(a,t,n){var i,o;if(!t.startsWith("donation-"))return!1;` |

**Giới hạn:** Module donation-BLL6eTTD.js không nằm trong bộ 9 source, nên không có đủ code để xác minh chức năng phụ thuộc.

## Event và tick simulation (`simulation_events`)
**Từ khóa:** `event`, `tick`, `queue`, `endTick`

Gom/dọn các event simulation và cập nhật world.

| Module / Wiki | Source | Feature ID | Anchor đầu tiên |
|---|---|---|---|
| [sim](modules/sim.md) | `sim-B1iiLlB3.js` | `event_lifecycle` | `eventsFor(t){const n=t.room` |
| [WorldScene](modules/WorldScene.md) | `WorldScene-bJccyikN.js` | `world_tick_orchestration` | `update(e,i){var l,c,d,p,u,m,g,f,y,b,v,k,w,C,T,q,H,S,E,A,L,P,N,B,j,R,W;if((l=this.liveSkills)==null\|\|l.u` |

**Giới hạn:** Event hiển thị không đồng nhất với protocol server.

## Phaser API (framework) (`phaser_framework`)
**Từ khóa:** `Phaser`, `GameObjects`, `SceneManager`, `Arcade`, `Matter`, `Loader`

Tìm các export và nhóm API framework, không phải logic game.

| Module / Wiki | Source | Feature ID | Anchor đầu tiên |
|---|---|---|---|
| [phaser-framework-bundle](modules/phaser.md) | `phaser-DRI6y8R5.js` | `phaser_exports` | `p.exports=h,t.g.Phaser=h` |
| [phaser-framework-bundle](modules/phaser.md) | `phaser-DRI6y8R5.js` | `framework_namespaces` | `Game:t(50127),GameObjects:t(77856),Geom:t(55738),Input:t(14350),Loader:t(57777)` |
| [phaser-framework-bundle](modules/phaser.md) | `phaser-DRI6y8R5.js` | `game_runtime` | `this.config=new e(w),this.renderer=null,this.domContainer=null,this.canvas=null` |
| [phaser-framework-bundle](modules/phaser.md) | `phaser-DRI6y8R5.js` | `game_objects` | `GameObject:t(95643),BitmapText:t(22186),Blitter:t(6107),Bob:t(46590),Container:t(31559)` |
| [phaser-framework-bundle](modules/phaser.md) | `phaser-DRI6y8R5.js` | `scene_events` | `f.events.once(r.READY,this.bootQueue,this)` |

**Giới hạn:** Không đọc toàn bộ Phaser nếu nhiệm vụ chỉ liên quan gameplay; chuyển sang WorldScene/sim.

