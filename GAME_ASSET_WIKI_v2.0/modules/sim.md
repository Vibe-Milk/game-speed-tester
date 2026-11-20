# Module: sim

- **Source:** `sim-B1iiLlB3.js`
- **SHA-256:** `1b1cd59d6d9391298f8a840736722b9ec4f736bc24eb40de43670126e3af1d71`
- **Dung lượng:** 378.921 byte; mã đã minify, chủ yếu trên một dòng rất dài.
- **Vai trò:** simulation/runtime của game, có xử lý action, tick thế giới, quái và combat, nhặt đồ, di chuyển/du hành, cơ chế sư đồ, donation, chuyển đổi dữ liệu trang bị và snapshot gửi client.
- **Ranh giới:** Những mô tả bên dưới dựa trên source hiện có; tên biến/alias minified không tự động là API có tên ngữ nghĩa. Không khẳng định hành vi của server hoặc module không được cung cấp.

## Import, export và điểm tích hợp

- Import tĩnh từ `./index-ymL7Xfvg.js` và `./donation-BLL6eTTD.js`; các ký hiệu nhập được rút gọn thành alias. Trong bộ 9 source, `index-ymL7Xfvg.js` có mặt, còn `donation-BLL6eTTD.js` bị thiếu.
- Export cuối file chứa nhiều alias rút gọn (`A`, `B`, `C`, …, `z`); không suy đoán tên API có nghĩa nếu chưa xem nơi sử dụng.
- Có đăng ký phần mở rộng state với ID chuỗi `sudo` qua `z({id:di,...})`. Module tạo dữ liệu chat, note, toast, travel, gacha, damage, snapshot và event.

## Điều hướng tính năng → source

| Khu vực | Anchor / dấu hiệu | Mô tả được xác minh |
|---|---|---|
| Sư đồ / đệ tử | `function Mm(`, `function xm(`, `z({id:di,load:` | Các action `baisu`, `nhantro`, `duoitro`, `roisu`, `sudo`; cấu hình quyền lợi sư đồ, kiểm tra điều kiện và party XP. |
| Chuyển đổi trang bị / rèn | `function ta(`, `function Tm(` | Chuyển đổi dữ liệu trang bị và forge; có receipt `equipment-v2-20261028`. |
| Donation | `function oo(` | Xử lý `donation-claim` / `donation-incense`; phần dữ liệu/helper nhập từ module donation còn thiếu. |
| Điều phối action | `case"fasttravel"` | Điểm vào nhánh action lớn; vùng lân cận có `use`, `harvest`, di chuyển vùng, gear... |
| Snapshot player/phòng | `snapshotPlayers(){`, `snapshot(t,n){` | Gói player, monster, pet, loot, projectiles, fields và các entity đã rời khỏi view (`gone`). |
| Snapshot entity | `playerSnapshot(t){`, `monsterSnapshot(t){`, `monsterSnapshotBuild(t,n,e=""){` | Tạo bản ghi full và dấu hiệu thay đổi của player/monster. |
| Vòng đời event | `eventsFor(t){`, `endTick(){` | Gom event phòng/global/player và dọn hàng đợi event cuối tick. |
| Bề mặt export | `export{Sc as A` | Danh sách alias export; cần đối chiếu caller để gán đúng ý nghĩa. |

## Nhặt đồ, lọc loot và combat — vùng code ưu tiên

| Chức năng | Search anchor nguyên văn | Quan sát từ source |
|---|---|---|
| Hàm nhặt đồ | `pickup(t,n,e=!1){if(n.dead||n.room!==t||n.realm)` | Kiểm tra trạng thái người chơi, phòng, khoảng cách 1.6, quyền sở hữu và thời hạn loot. Xử lý gear, items, túi đầy, thông báo, thu hồi bột. |
| Action pickup | `case"pickup":this.pickup(i,t,e!=="auto");return;` | Với arg `auto`, tham số thứ ba thành `false`; arg khác thì `true`. Khác biệt quan trọng giữa lệnh nhặt tự động và thủ công. |
| Bộ lọc loot | `case"loot-filter":{const g=Number(e);Number.isInteger(g)` | Chấp nhận ngưỡng `lootMin` nguyên từ 0 đến 4 và lưu state người chơi. |
| Thu hồi loot | `case"loot-recover":{(e==="on"||e==="off")` | Bật/tắt `lootRecover`; kết hợp điều kiện trong `pickup` để quyết định chuyển gear thành bột hay bỏ qua. |
| Auto-pickup theo tick | `this.time>=h.autoLootAt&&(h.autoLootAt=this.time+.2,o.loot.length&&this.pickup(o,h))` | Tick của simulation có nhánh gọi nhặt đồ theo mốc `autoLootAt`, với khoảng cập nhật `.2` đơn vị thời gian simulation. Không phụ thuộc trực tiếp vào flag Auto Farm client ở callsite này. |
| Khởi tạo state auto-loot | `b(this,"autoLootAt",0)` | Mốc thời gian nhặt tự động thuộc player state. |
| Cập nhật quái và đạn | `this.updateMonsters(o,t),this.updateShots(o,t)` | Callsite cập nhật quái và projectile từ tick phòng. |
| Định nghĩa xử lý quái | `updateMonsters(t,n){var r,c,d,f,v;` | Vị trí tìm logic monster trong simulation. |
| Combat tick | `this.combat.tick(o,t)` | Callsite cập nhật combat; cần đọc object combat mới xác định chi tiết sát thương. |
| Thu hoạch | `case"harvest":{const g=Number(e),k=i.nodes[g];` | Kiểm tra node, khả năng tương tác, khoảng cách và trạng thái sống; tạo tiến trình harvest và animation. |

**Phân biệt hai đường nhặt đồ:** `WorldScene-bJccyikN.js` có `V$` (Auto Farm client) gọi `act("pickup","auto")`. Trong `sim` còn có callsite nhặt định kỳ theo `autoLootAt`. Đây là các đường gọi có thể tra cứu riêng; không suy ra cách extension hiện tại chặn hoặc thay thế chúng.

## Symbol và state quan trọng

| Symbol | Vai trò |
|---|---|
| `Mm`, `xm` | Xử lý lệnh sư đồ, điều kiện đệ tử và bonus XP khi đi party. |
| `Tm`, `ta` | Chuyển đổi dữ liệu trang bị và forge. |
| `oo` | Xử lý các action donation cục bộ. |
| `pickup` | Nhặt đồ vào túi, xử lý điều kiện loot, bộ lọc, thu hồi và thông báo. |
| `autoLootAt`, `lootMin`, `lootRecover` | State của người chơi liên quan nhặt tự động và lọc đồ. |
| `updateMonsters` | Xử lý cập nhật quái được gọi từ tick thế giới. |
| `snapshotPlayers`, `snapshot` | Tạo snapshot phòng, player và các thay đổi entity/event. |
| `playerSnapshot`, `monsterSnapshotBuild` | Chuẩn bị dữ liệu player/monster để gửi. |
| `eventsFor`, `endTick` | Gom và dọn event. |
| `j`, `di` | Cấu hình sư đồ và literal state extension `sudo`. |

## Dependencies và cách tìm an toàn

- Chỉ dùng tên file xuất hiện trong `from` hoặc `import()` làm **file-level dependency**; alias minified và endpoint JSON không phải file JS dependency.
- Tìm anchor trên đúng file gốc rồi đọc một đoạn ngắn quanh đó. Không dùng số dòng trong file đã format làm vị trí của source gốc.
- Tra `WorldScene.md` để nối controller `V$` và action client `pickup`, hoặc tra `index.md` để xác minh các helper được import từ entry bundle.
- `donation-BLL6eTTD.js` thiếu trong bộ 9 source; các chi tiết dựa trên module này chưa xác minh.

## Mức tin cậy và giới hạn

- Các anchor, import specifier, tên state và các nhánh action được nêu là **verified từ source tĩnh**.
- Chưa chạy game hoặc kiểm thử runtime; không suy diễn contract của server, ý nghĩa tất cả alias export hoặc tương tác thực tế của extension.
