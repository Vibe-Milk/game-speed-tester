# Module: index-ymL7Xfvg

- Source: `index-ymL7Xfvg.js`; SHA-256 `89e74ddadef391b89014311cf47288ca30ff27cd96121d9e88149f17d1addcb2`; 829,377 bytes.
- Mục đích: bundle entry do Vite build cho trình duyệt; điều phối chế độ trực tuyến/ngoại tuyến, nạp data, khởi tạo Phaser và `WorldScene`, đồng thời xuất nhiều alias minified. Các ranh giới này có căn cứ từ source; phần lớn tên export minified chưa có tên chức năng rõ.
- Dạng build: bundle minified, khoảng 479 dòng vật lý với nhiều dòng rất dài. Locator dùng chuỗi nguyên văn và vị trí byte UTF-8 tính trên đúng file gốc (zero-based), không đồng nhất với vị trí ký tự.

## Import và điểm tích hợp

Có 5 dynamic import xuất hiện nguyên văn trong logic khởi động: `./LocalDriver-DA7Qxqfm.js` (driver ngoại tuyến), `./items-CCENVhBq.js` (metadata vật phẩm và icon gear), `./phaser-DRI6y8R5.js` (bundle Phaser), `./WorldScene-bJccyikN.js` (scene thế giới), và `./boot-DGR3-xtV.js` (khởi động lab). Trong bộ 9 source được giao để xây dựng Wiki, thiếu `LocalDriver-DA7Qxqfm.js` và `boot-DGR3-xtV.js`; ba import còn lại có source tương ứng. Không suy ra sự tồn tại của file khác trên máy. Preload map của Vite còn nhắc tới `sim-B1iiLlB3.js`, `donation-BLL6eTTD.js`, and `Character-cz94XTen.js`, `ChieuMau-qVW4fvFM.js`; không xác định chúng là cạnh dynamic import trực tiếp chỉ từ preload map. `tm-direct.js` và `tm-guard.js` nằm trong bộ 9 source nhưng không thấy dynamic import trực tiếp từ bundle entry này.

Bundle fetch JSON qua đường dẫn `data/...` (textures, classes, scenes, regions, maps, sets, quests, items, v.v.). Đây là dữ liệu nạp lúc chạy, không phải dependency JS theo trường `target_file`.

## Điều hướng tính năng

| Khu vực | Bằng chứng / vị trí trong source |
|---|---|
| Preload map và chuỗi dependency | `const __vite__mapDeps=` tại byte 0 |
| Giải mã snapshot và state entity | `class yy{` tại byte 4,905 |
| Phiên, profile, WebSocket và reconnect | `class vy{` tại byte 7,378 |
| Khởi động và chọn online/offline | `async function rP()` tại byte 816,977 |
| Nạp data, driver, assets, Phaser và scene | `async function cP()` tại byte 817,802 |
| Import driver ngoại tuyến | `import("./LocalDriver-DA7Qxqfm.js")` tại byte 820,299 |
| Import metadata item | `import("./items-CCENVhBq.js")` tại byte 821,241 |
| Import Phaser | `import("./phaser-DRI6y8R5.js")` tại byte 821,498 |
| Import WorldScene | `import("./WorldScene-bJccyikN.js")` tại byte 821,569 |
| Import khởi động lab theo điều kiện | `import("./boot-DGR3-xtV.js")` tại byte 822,207 |
| Danh sách export alias | `export{` tại byte 822,449 |

## Hành vi và trạng thái chính

- `yy.decode(t)` giải mã snapshot, hợp nhất cập nhật self và entity, bỏ qua các đường dẫn có nguy cơ can thiệp prototype. Các field nén có `x`, `y`, `d`, `a`, `hp`, `fx` (xác minh từ thân class).
- `vy` bao WebSocket, giữ message cho tới `start()`, giải mã snapshot, hợp nhất profile patch, ping/latency, thử nâng cấp sang WebRTC qua signaling. Các state gồm `ready`, `queue`, `reconnecting`, `handingOver`, `displaced`, `held`; giao thức phía server chưa xác minh.
- `rP()` lấy token và thử tham gia phiên driver; phần retry nằm trong luồng xử lý lỗi. `cP()` nạp data và assets, chọn online/offline theo query `online`, import driver phù hợp, tạo Phaser game và khởi tạo scene `world`.
- Nếu query `lab=1`, có nhánh import module boot lab và gọi `labBoot()`; nhánh thông thường đi qua `cP()`.
- Danh sách `export{...}` chứa nhiều alias minified: cần theo dấu binding và caller trước khi gán nghĩa.

## Dependencies và nội dung chưa xác minh

- JSON chỉ ghi filename được tham chiếu bằng cú pháp `import()` thực tế; preload-map-only không tự tạo dependency cạnh.
- Trong 9 source đang dùng, thiếu `LocalDriver-DA7Qxqfm.js` và `boot-DGR3-xtV.js`; ngoài ra `donation-BLL6eTTD.js` có trong preload map nhưng không nằm trong ZIP.
- Các endpoint `data/...` và triển khai server của `/api/rtc/config`, `/api/rtc/offer` không được cung cấp, nên không khẳng định hành vi nội bộ.

## Cách điều hướng an toàn

Tìm anchor trong file entry gốc, bắt đầu ở `cP()` khi cần thay đổi khởi động/scene; xem `rP()` và `vy` khi cần nghiên cứu phiên và kết nối. Byte offset là vị trí byte UTF-8 tính từ 0 trong file gốc, không phải vị trí ký tự hoặc vị trí trong file đã format.
