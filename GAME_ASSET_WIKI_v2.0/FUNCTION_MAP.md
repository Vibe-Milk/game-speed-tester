# Function / Symbol Map

Chỉ mục tên hàm, class, state và export do từng chat ghi nhận. Đây **không phải** danh sách mọi hàm của source. Các alias minified có thể thay đổi sau mỗi bản game.

| Module / Wiki | Symbol | Loại | Vai trò | Anchor để tìm trong source |
|---|---|---|---|---|
| [phaser-framework-bundle](modules/phaser.md) | `Phaser` | export | Object namespace được module lõi xuất và gán global. | `p.exports=h,t.g.Phaser=h` |
| [phaser-framework-bundle](modules/phaser.md) | `Game` | class | Object Game; khởi tạo runtime fields và các manager chính. | `this.config=new e(w),this.renderer=null,this.domContainer=null,this.canvas=null` |
| [phaser-framework-bundle](modules/phaser.md) | `Scene` | class | Object Scene khai báo facade và manager tham chiếu. | `this.sys=new c(this,n),this.game,this.anims,this.cache,this.registry,this.sound` |
| [phaser-framework-bundle](modules/phaser.md) | `SceneManager` | object | Thành phần được liệt kê trong namespace Scenes. | `SceneManager:t(60903),ScenePlugin:t(52209),Settings:t(55681),Systems:t(2368)` |
| [phaser-framework-bundle](modules/phaser.md) | `GameObject` | class | Base game object được liệt kê trong namespace GameObjects. | `GameObject:t(95643),BitmapText:t(22186),Blitter:t(6107)` |
| [WorldScene](modules/WorldScene.md) | `g6` | class | Scene chính; export alias WorldScene. | `class g6 extends tt.Scene{constructor(){super("world")` |
| [WorldScene](modules/WorldScene.md) | `create` | function | Thiết lập scene và listener. | `async create(){var p,u,m,g;const e=f=>{const y=`ground:${this.map.scene}:`` |
| [WorldScene](modules/WorldScene.md) | `update` | function | Tick điều phối scene. | `update(e,i){var l,c,d,p,u,m,g,f,y,b,v,k,w,C,T,q,H,S,E,A,L,P,N,B,j,R,W;if((l=this.liveSkills)==null\|\|l.u` |
| [WorldScene](modules/WorldScene.md) | `pickTarget` | function | Chọn target tương tác. | `pickTarget(){var s,o,r,h;if((s=this.realmUI)!=null&&s.target)return{realm:this.realmUI.target}` |
| [WorldScene](modules/WorldScene.md) | `flushSkill` | function | Giải quyết kỹ năng pending. | `flushSkill(){var i;const e=this.pendingSkill;if(e){if(this.dead\|\|this.uiBlocked\|\|this.leaving\|\|this` |
| [WorldScene](modules/WorldScene.md) | `Zv` | class | Widget DOM chọn khu. | `class Zv{constructor(t,e){M(this,"chip",document.createElement("button"))` |
| [WorldScene](modules/WorldScene.md) | `V$` | class | Bộ điều khiển Auto Farm tích hợp game, có toggle/update/pick/idle/walk và bộ nhớ trạng thái. | `class V${constructor(){M(this,"on",!1)` |
| [WorldScene](modules/WorldScene.md) | `toggleAutoFarm` | function | Điểm bật/tắt Auto Farm do scene cung cấp, gồm cập nhật nút và trạng thái. | `toggleAutoFarm(){var e,i;this.cancelClickOrder()` |
| [WorldScene](modules/WorldScene.md) | `autoHost` | function | Đối tượng host mô tả player, enemies, collisions, skill, loot và actions. | `autoHost(){const e=this;return{pos:` |
| [WorldScene](modules/WorldScene.md) | `V$.idle` | function | Nhặt loot trong vòng lặp Auto Farm khi không có mục tiêu chiến đấu. | `idle(t,e,i,n){const s=r=>` |
| [index-ymL7Xfvg](modules/index.md) | `yy` | class | Snapshot decoder and entity ID tracker. | `class yy{constructor(){_(this,"self",{});_(this,"seen",new Set)}decode(t){` |
| [index-ymL7Xfvg](modules/index.md) | `vy` | class | Online transport and connection lifecycle manager. | `class vy{constructor(t,e){_(this,"online",!0);` |
| [index-ymL7Xfvg](modules/index.md) | `rP` | function | Join/session acquisition loop. | `async function rP(){var t;let n="";for(;;){` |
| [index-ymL7Xfvg](modules/index.md) | `cP` | function | Main data loading and game initialization function. | `async function cP(){var D,C,R,F;AM(),GM();` |
| [index-ymL7Xfvg](modules/index.md) | `__vite__mapDeps` | function | Maps preload dependency indexes to chunk filenames. | `const __vite__mapDeps=` |
| [sim](modules/sim.md) | `Mm` | function | Mentor/pupil command handler. | `function Mm(a,t,n,e){` |
| [sim](modules/sim.md) | `Tm` | function | Equipment and forge migration helper. | `function Tm(a,t=new Date().toISOString(),n=[])` |
| [sim](modules/sim.md) | `oo` | function | Donation action handler. | `function oo(a,t,n){var i,o;if(!t.startsWith("donation-"))return!1;` |
| [sim](modules/sim.md) | `snapshotPlayers` | function | Builds per-room snapshot indexes. | `snapshotPlayers(){const t=new Map` |
| [sim](modules/sim.md) | `snapshot` | function | Builds per-player snapshots and entity deltas. | `snapshot(t,n){var l,w,x;` |
| [sim](modules/sim.md) | `eventsFor` | function | Collects visible and queued events. | `eventsFor(t){const n=t.room` |
| [sim](modules/sim.md) | `di` | state | Literal state extension ID `sudo`. | `const di="sudo"` |
| [sim](modules/sim.md) | `pickup` | function | Nhặt loot và gear; áp dụng filter/điều kiện quyền sở hữu, sức chứa, thời gian và khoảng cách. | `pickup(t,n,e=!1){if(n.dead\|\|n.room!==t\|\|n.realm)` |
| [sim](modules/sim.md) | `autoLootAt` | state | Mốc thời gian cho nhặt tự động theo tick của simulation. | `this.time>=h.autoLootAt&&(h.autoLootAt=this.time+.2,o.loot.length&&this.pickup(o,h))` |
| [sim](modules/sim.md) | `updateMonsters` | function | Logic cập nhật quái; được gọi trong tick phòng. | `updateMonsters(t,n){var r,c,d,f,v;` |
| [ChieuMau](modules/ChieuMau.md) | `Ro` | class | Quản lý pool và lớp render hiệu ứng. | `class Ro{constructor(e)` |
| [ChieuMau](modules/ChieuMau.md) | `C/J/a/b/c` | export | Hai alias export; ý nghĩa semantic chưa xác định. | `export{ye as C,Ro as J,It as a,Bt as b,de as c}` |
| [Character](modules/Character.md) | `K` | class | Animation/display object; có play/update/feet/apply. | `class K{` |
| [Character](modules/Character.md) | `export aliases` | export | Public exports được đặt alias ngắn. | `export{I as A,Qt as C,Y as D` |
| [items](modules/items.md) | `Pn` | function | Đọc và xác thực cấu hình phím. | `function Pn(){const n=In()` |
| [items](modules/items.md) | `En` | function | Nạp metadata và recipe. | `function En(){return A??` |
| [items](modules/items.md) | `K` | function | Tra đường dẫn icon gear. | `function K(n){n={...n,id:tn(n.id)` |
| [tm-direct](modules/tm-direct.md) | `DirectSocket` | function | Facade relay event/properties/send/close. | `function DirectSocket(url) {` |
| [tm-direct](modules/tm-direct.md) | `DIRECT` | state | Endpoint đích và timeout/cache keys. | `var DIRECT = 'wss://ws.nghichthienky.online/ws'` |
| [tm-guard](modules/tm-guard.md) | `feed` | function | Parse snapshot và guard event. | `function feed(data) {` |
| [tm-guard](modules/tm-guard.md) | `out` | function | Gửi action qua hook hoặc socket. | `function out(m) { try { if (window.__tmSend)` |

## Tra cứu chi tiết

Mở `indices/CHAT_XX_INDEX.json` nếu cần đủ các locator, byte offset và `confidence` cho từng feature. Riêng offset chỉ có ý nghĩa khi tính trên đúng bytes source gốc; với file minified, ưu tiên tìm anchor duy nhất.

