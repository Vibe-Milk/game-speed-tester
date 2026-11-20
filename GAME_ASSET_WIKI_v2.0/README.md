# GAME_ASSET_WIKI_v2.0

Wiki định vị source cho 9 JavaScript bundle được cung cấp trong đợt cập nhật game này. **Mục đích: tiết kiệm token và thời gian tìm code**, không phải thay thế source khi thực hiện thay đổi. Hoàn toàn xây dựng từ source mới; không sử dụng Wiki v1.0.

## Quy trình đọc tối thiểu cho AI / Agent

1. Đọc `README.md` rồi **chọn nhóm tính năng** trong `FEATURE_INDEX.md` (hoặc `FEATURE_INDEX.json`).
2. Dùng `ASSET_INDEX.json` để xác định **đúng tên module và source file**. Mở **chỉ những** `modules/<module>.md` liên quan.
3. Khi cần thông tin chi tiết, xem `FUNCTION_MAP.md` và `indices/CHAT_XX_INDEX.json` để lấy `search_anchor` chính xác và `byte_offset` nếu có.
4. **Chỉ lúc cần xác minh logic/sửa tính năng** mới tìm anchor trong `source/<filename>.js` gốc rồi đọc vùng code xung quanh. Tránh nạp cả bundle vào ngữ cảnh.
5. Trước khi chỉnh sửa, đối chiếu SHA-256 file hiện tại với `SOURCE_MANIFEST.json`. Nếu khác, **đánh dấu Wiki có khả năng lỗi thời** và cần kiểm tra lại module liên quan; không dùng locator cũ như sự thật chắc chắn.

## Các tài liệu chính

| File | Mục đích |
|---|---|
| `FEATURE_INDEX.md` / `.json` | Tìm theo tính năng/từ khóa → module → anchor đầu tiên |
| `ASSET_INDEX.json` | Danh bạ 9 module và vị trí wiki/source |
| `FUNCTION_MAP.md` | Danh sách symbol, hàm, class và state có giá trị tra cứu |
| `DEPENDENCY_MAP.md` / `.json` | Các cạnh JS import trực tiếp, file còn thiếu và quan hệ runtime cần xác minh |
| `SOURCE_MANIFEST.json` | Tên, size và SHA-256 của đúng 9 source |
| `modules/*.md` | 9 trang Wiki chuyên sâu theo module |
| `indices/CHAT_01..05_INDEX.json` | 5 bộ index gốc đã hiệu chỉnh; nhiều locator hơn chỉ mục tổng hợp |
| `source/*.js` | 9 file nguồn gốc — bằng chứng cuối cùng |
| `CHANGELOG.md` | Ghi nhận lần tạo Wiki và chỉnh sửa khi hợp nhất |

## Định tuyến nhanh

- **Auto Farm gốc / tách khỏi Auto Farm của tool**: `FEATURE_INDEX.md` → *Auto Farm của game* → `modules/WorldScene.md`; nếu có nhặt đồ, đọc thêm `modules/sim.md`.
- **Nhặt đồ / lọc loot**: *Nhặt đồ và lọc loot* → `WorldScene.md` + `sim.md` (hai đường nhặt có thể khác nhau).
- **Kết nối / reconnect / WebSocket**: `index.md`, `tm-direct.md`, `tm-guard.md`; nếu liên quan game scene thì thêm `WorldScene.md`.
- **Quái / combat / thu hoạch**: `sim.md`, `WorldScene.md`; hiệu ứng đồ họa ở `ChieuMau.md`.
- **UI/vật phẩm/phím điều khiển**: `items.md`, `WorldScene.md`, `Character.md` tùy tính năng.
- **Phaser framework**: `phaser.md`, chỉ đọc khi thật sự cần API framework.

## Quy tắc xác minh

- Chuỗi `search_anchor` là điểm tìm trong **file gốc**, không phải bằng chứng rằng luồng đã được kiểm thử thực tế.
- `byte_offset` (nếu có) là vị trí byte UTF-8, **zero-based** trong nguồn gốc; không dùng vị trí này trên file đã prettify hoặc sau khi cập nhật.
- `related_modules` có thể là ID nội bộ hoặc quan hệ định vị; **không** đồng nghĩa `import` giữa các file. Chỉ lấy cạnh import từ `DEPENDENCY_MAP.json`.
- Chỉ có 9 file trong phạm vi; thiếu `donation-BLL6eTTD.js`, `LocalDriver-DA7Qxqfm.js`, `boot-DGR3-xtV.js`. Không suy luận cách các file thiếu hoạt động.
- Hai script `tm-direct.js` và `tm-guard.js` cùng wrap `window.WebSocket` nhưng chưa rõ thứ tự nạp.
- **Không chạy game, test, lint, typecheck hoặc QA** trong quá trình tạo Wiki. Dữ liệu dựa trên đọc/đối chiếu tĩnh source.

## Cập nhật về sau

Thêm source mới → lập manifest hash mới → xác định các module thay đổi → cập nhật Wiki module và chỉ mục tính năng/dependency có liên quan → kiểm tra anchor. Không cần đọc hoặc so sánh với v1.0.
