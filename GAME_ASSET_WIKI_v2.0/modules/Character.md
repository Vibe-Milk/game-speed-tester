# Module: Character

- Source: `Character-cz94XTen.js` · SHA-256 `d1d738dbcc444ae30665b1d46978d96c4578b1c62277adbf2a64ef59b01c3671` · 70343 bytes · 1 minified line.
- Mục đích: các tiện ích/lớp hiển thị nhân vật và animation; cuối file export nhiều alias minified.
- Imports trực tiếp: `phaser-DRI6y8R5.js`, `index-ymL7Xfvg.js`, `sim-B1iiLlB3.js`. `ChieuMau-qVW4fvFM.js` import alias `A` và `e` từ module này.

## Điều hướng

| Khu vực | Locator chính xác | Ghi chú |
|---|---|---|
| Phân giải animation | `play(t,i){if(this.labForce&&([t,i]=this.labForce)` | Cập nhật anim/dir/clip/frame và gọi `apply`. |
| Cập nhật frame theo thời gian | `update(t,i=1){if(!this.clip)return` | Tích lũy thời gian, bước frame theo FPS, xử lý loop/non-loop. |
| Pose cưỡi/ngồi | `standOn(t,i,e){this.rideHeight===null` | Đo rideHeight ban đầu, chọn pose, đặt lại frame và căn vị trí chân. |
| Tọa độ chân | `feet(){const t=this.view,i=t.frame` | Tính/cached điểm chân theo pixel alpha của texture frame. |
| Áp dụng frame vào sprite | `apply(){if(!this.clip)return` | Đặt texture/frame, origin, scale và squash/flip lên view. |
| Public exports | `export{I as A,Qt as C,Y as D` | Alias export; tra mapping cuối file để lấy tên export cụ thể. |

## State / API

Lớp animation tại `class K` giữ `view`, `clip`, `anim`, `dir`, `time`, `frameIndex`, `scale`, `squash`, `flip`, `rideHeight`, `labForce`; cache chân là `K.soles` Anchor thực tế `c(K,"soles",new WeakMap)` (static cache WeakMap). Các phương thức `stand`, `play`, `update`, `standOn`, `feet`, `apply` nằm trong lớp. Export aliases cần xem chuỗi `export{...}` ở cuối nguồn; không gán alias thành API semantic nếu chưa có mapping phía caller.

## Phụ thuộc và giới hạn

- Dependencies bên dưới chứa chính xác tên file trong import source; alias module ID không được ghi vào `target_file`.
- `sim-B1iiLlB3.js` được tham chiếu trực tiếp, có trong bộ 9 source và được lập Wiki ở Chat 04; nội dung chi tiết của nó được điều hướng qua `sim.md`.
- Tìm anchor trong file gốc (minified một dòng), dùng tên export/import để lần sang caller.
- Độ tin cậy: luồng animation hiển thị được xác minh từ thân phương thức; vai trò từng export minified chưa xác minh hoàn toàn.

