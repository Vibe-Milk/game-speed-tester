# Module: WorldScene

- **Tệp nguồn:** `WorldScene-bJccyikN.js`
- **SHA-256:** `47d7592e4e88fcea6194732153a80eea699799784b8d10106005a495384d0e63`
- **Kích thước:** 1,100,111 byte; 1,137 dòng vật lý
- **Vai trò:** lớp Phaser scene được export dưới tên `WorldScene`; tên scene truyền cho `super` là `world` (đã xác minh).
- **Ranh giới:** tệp bundle/minify, chứa nhiều mã tiện ích và giao diện cùng lớp scene. Các tên alias nhập được rút gọn; không suy diễn ý nghĩa của chúng. Đã đối chiếu với bản gốc trong bộ 9 source; bundle minified nên ưu tiên anchor hơn số dòng.

## Export, imports và điểm tích hợp

Export duy nhất nhìn thấy ở cuối tệp là `g6 as WorldScene`. `g6` mở rộng `tt.Scene`, khởi tạo scene với khóa `world`, có `async create()` và `update(e,i)`. `create()` đăng ký xử lý lỗi tải ảnh ground và xử lý `SHUTDOWN` để tháo listener/xóa tập pending; code cũng đăng ký cleanup chat khi shutdown. Đây là tích hợp Phaser xác nhận từ mã nguồn.

Các import tĩnh (đều là tên tệp nguyên văn trong source):

- `./index-ymL7Xfvg.js`
- `./items-CCENVhBq.js`
- `./phaser-DRI6y8R5.js`
- `./Character-cz94XTen.js`
- `./sim-B1iiLlB3.js`
- `./ChieuMau-qVW4fvFM.js`
- `./donation-BLL6eTTD.js`

## Điều hướng tính năng

| Khu vực | Bằng chứng / cách tìm trong source | Mức tin cậy |
|---|---|---|
| Scene và export | `class g6 extends tt.Scene`; `super("world")`; cuối tệp `export{g6 as WorldScene}` | verified |
| Khởi tạo và tài nguyên ground | Tìm `async create(){`; xử lý `FILE_LOAD_ERROR`, `groundPending`, `groundRetryAt` | verified |
| Cleanup vòng đời | Tìm `tt.Scenes.Events.SHUTDOWN`; có cleanup loader trong `create()` và `this.chat.destroy()` | verified |
| Điều phối tick | Tìm `update(e,i){`; vòng lặp gọi movement, driver, kỹ năng, UI, world rendering, target/culling | verified |
| Di chuyển và kết nối | Trong `update`, nhánh `this.self&&!this.leaving&&(this.move(n),this.sendMove())`, sau đó `this.driver.update(n)` | verified; giao thức driver nằm ngoài tệp |
| Chọn mục tiêu / tương tác | Tìm `pickTarget(){`; trả về loại target như realm, node, gate, station, NPC, stele; overlay hiển thị prompt F ở phần update | verified |
| Kỹ năng | Tìm `flushSkill(){` và `useSkill`; xử lý pending skill, điều kiện hủy/chờ cooldown | verified |
| HUD và trạng thái nhân vật | Tìm `updateHud(){`; cập nhật cooldown, gauge, ví, vật phẩm hồi phục, trạng thái, party, boss, profile | verified |
| Minimap | Tìm `drawMinimap(){`; tổng hợp cổng, NPC, stele, người chơi/quái, realm dots, trạm, node, guide và nav | verified |
| Bản đồ / world visuals | Trong `update(e,i)` có cập nhật weather, shade, emitters, lanterns, bars, target, overlay, ground streaming, fishing/dosat UI | verified |
| Đổi khu | Tìm `class Zv`; tạo chip/dialog chọn khu và gọi callback `pick` do constructor nhận vào | verified phần UI; callback phía caller cần lần theo |


## Auto Farm gốc của game — vùng code ưu tiên

| Chức năng | Search anchor nguyên văn | Kết luận từ source |
|---|---|---|
| Controller Auto Farm | `class V${constructor(){M(this,"on",!1)` | `V$` giữ `on`, `ax/ay`, `radius`, `target`, `skipped`, `reachable`, `lootSkip`, `path`, `resting` và bộ đếm thất bại. |
| Bật/tắt từ scene | `toggleAutoFarm(){var e,i;this.cancelClickOrder()` | Scene dùng `this.auto.toggle(this.autoHost())`, cập nhật nút và trạng thái nền. |
| Phím tắt | `V:()=>this.toggleAutoFarm()` | Phím `V` được nối với logic Auto Farm của game. |
| Tìm quái | `const p=t.inCombat(),u=k=>p&&!!k.aggro` | Bộ lọc enemies dựa trên chết/sự thù địch/bán kính và trạng thái chiến đấu. |
| Ưu tiên mục tiêu | `pick(t,e,i,n,s,o){const r=t.level()` | Chấm điểm mục tiêu theo khoảng cách, aggro, HP, cấp và tính tiếp cận. |
| Di chuyển | `walk(t,e,i,n,s,o,r){if(se(i,n,this.lastX` | Theo đường đi; nhận biết kẹt và tạm bỏ qua mục tiêu. |
| Nhặt đồ khi rảnh | `idle(t,e,i,n){const s=r=>` | Tìm loot trong bán kính farm; tới gần, nhặt hoặc đánh dấu loot lỗi. |
| Callsite nhặt đồ | `t.pickup()` | Lời gọi nhặt đồ trong `V$.idle`; không đồng nghĩa với nút nhặt thủ công. |
| Host nối vào driver | `autoHost(){const e=this;return{pos:` | Trả về các callback đọc state, điều hướng, đánh, nhặt, hồi phục và bật/tắt. |
| Gửi action nhặt đồ | `pickup:()=>e.act("pickup","auto")` | Auto Farm gọi action `pickup` với arg `auto`; xem thêm `sim-B1iiLlB3.js`. |
| Tick Auto Farm | `this.auto.update(this.autoHost(),this.now(),n)` | Điểm gọi controller từ tick scene, dưới các điều kiện aim/kỹ năng/thiền. |

**Phân biệt để phát triển tool:** Đây là Auto Farm do *game client* quản lý tại `V$`/`g6`. Các API ở `autoHost` chỉ mô tả điểm giao tiếp nhìn thấy trong source; không tự suy ra cách extension/tool can thiệp. Để tách Auto Farm game/tool, cần kiểm tra thêm nơi tool hook vào input, driver, state và action trước khi sửa.

## Symbol quan trọng và state

- `g6`: lớp scene chính, khởi tạo các field scene bằng helper `M(this,...)`; chứa state world, map, driver, player, vị trí, input, UI và hệ thống phụ.
- `create()`: thiết lập scene/tài nguyên và listener; async.
- `update(e,i)`: tick cập nhật scene; thời delta được giới hạn đến `0.05` giây.
- `pickTarget()`: chọn mục tiêu tương tác dựa trên trạng thái scene và khoảng cách; biểu thức đầy đủ có nhiều nhánh.
- `flushSkill()`: tiêu thụ `pendingSkill` khi hợp lệ và không còn chờ.
- `updateHud()`, `drawMinimap()`, `syncPlayer()`, `updateBars()`, `updateShade()`: nhóm cập nhật trình bày.
- `Zv`: widget đổi khu, dùng DOM button/dialog và callback `pick`.
- `V$`: Auto Farm gốc của game; `toggle`, `update`, `pick`, `idle`, `walk` là các điểm tìm code chính.
- `toggleAutoFarm`, `autoHost`: lớp scene bật/tắt controller và cung cấp callback để điều khiển nhân vật/nhặt đồ.
- State được thấy trực tiếp: `px`, `py`, `faceX`, `faceY`, `heldAttack`, `pendingSkill`, `leaving`, `self`, `map`, `driver`, `player`, `target`, `nodes`, `views`, `npcs`, `overlay`, `hud`.

## Events / tương tác / lifecycle

- Phaser loader: `tt.Loader.Events.FILE_LOAD_ERROR`; listener lọc key `ground:${this.map.scene}:` và cập nhật retry state.
- Phaser lifecycle: `tt.Scenes.Events.SHUTDOWN`; tháo listener lỗi, xóa listener file ground còn pending, clear pending/retry maps; shutdown callback khác hủy chat.
- Tương tác bàn phím hiển thị trong HUD gồm `Space`, `1`–`3`, `Q`, `F`, `B`, `ENTER`; các handler/ý nghĩa đầy đủ nên tìm theo `keyHint`/`useSkill`/`pickTarget` trong source.
- Không suy ra giao thức mạng cụ thể từ `driver`; source chỉ cho thấy các lời gọi như `driver.update`, `sendMove` và thuộc tính `online`, `latency`.

## Dependencies và giả định liên module

Bảy tệp import tĩnh được liệt kê trên là dependency file-level hợp lệ vì chuỗi filename xuất hiện trong câu lệnh `from` của source. Trong bộ 9 source đang sử dụng, chỉ `donation-BLL6eTTD.js` bị thiếu; các module còn lại có source riêng nhưng cần tra cứu Wiki tương ứng khi phân tích liên module. Các alias import như `tt`, `yv`, `Ku` không phải tên tệp; không dùng chúng làm `target_file`.

## Quy trình tìm code an toàn

1. Mở đúng `WorldScene-bJccyikN.js`; đây là bundle minify nên tìm bằng chuỗi anchor chính xác, không dựa riêng vào dòng.
2. Dùng `class g6 extends tt.Scene` để vào lớp scene; lần lượt tìm `async create(){`, `update(e,i){`, `pickTarget(){`, `flushSkill(){`, `updateHud(){`, `drawMinimap(){`.
3. Với lifecycle, tìm `tt.Scenes.Events.SHUTDOWN`; với luồng world/network, tìm các callsite `sendMove` và `driver.update`.
4. Xác minh từng anchor trên đúng bytes nguồn trước khi gắn locator; alias import chỉ là tên cục bộ rút gọn.

## Độ tin cậy, giới hạn và unresolved

- Các quan hệ nêu là quan sát tĩnh trực tiếp; không chạy JavaScript.
- Tệp có import minified và phần lớn mã nằm trên các dòng rất dài; không suy diễn hành vi runtime ngoài biểu thức đã thấy.
- Trong bảy dependency import, sáu file có trong bộ 9 source; `donation-BLL6eTTD.js` chưa được cung cấp. Các hành vi chưa đọc trực tiếp không được coi là đã xác minh.
- Wiki tổng hợp đối chiếu SHA-256 và anchor với đúng source gốc trong `source/`.
- Chưa xác minh đầy đủ toàn bộ nhánh trong `create()` và `update()`; bảng ưu tiên các điểm điều hướng tiêu biểu.


## Trích đoạn game live do người dùng cung cấp: backgroundAuto

Nguồn: trích đoạn `backgroundAuto()` từ `WorldScene-BelhegXS.js`, do người dùng cung cấp; không phải bundle lưu trữ `WorldScene-bJccyikN.js` được lập chỉ mục ở trên. Chưa có toàn bộ bundle hoặc hash để đối chiếu. Đoạn này không cập nhật hay xác minh toàn bộ wiki cho phiên bản game live.

```javascript
backgroundAuto() {
    let e;
    try {
        e = new Worker(URL.createObjectURL(new Blob([
            "let t=0;onmessage=e=>{clearInterval(t);if(e.data)t=setInterval(()=>postMessage(0),50)}"
        ], {
            type: "text/javascript"
        })))
    } catch {
        return
    }

    let i = performance.now(),
        n = !1;

    e.onmessage = () => {
        const o = performance.now(),
            h = Math.min(250, o - i);

        i = o;
        document.hidden && this.game.headlessStep(o, h)
    };

    const s = () => {
        const o = document.hidden && this.auto.on;
        o !== n && (
            n = o,
            i = performance.now(),
            e.postMessage(o)
        )
    };

    this.bgSync = s;
    document.addEventListener("visibilitychange", s);

    this.events.once(tt.Scenes.Events.SHUTDOWN, () => {
        document.removeEventListener("visibilitychange", s);
        e.terminate();
        this.bgSync = null
    })
}
```

Đoạn mã cho thấy Worker phát nhịp 50 ms khi trang ẩn và Auto Farm gốc đang bật; callback gọi `headlessStep` khi trang ẩn, còn sự kiện shutdown dừng Worker. Chỉ từ đoạn này không thể xác định toàn bộ hành vi mạng hoặc bảo đảm tab nền luôn được chạy. Chưa kiểm chứng runtime.
