# Changelog

## v2.0 — 2026-11-20

- Tạo Wiki mới hoàn toàn từ 9 source hiện tại; **không đối chiếu hoặc tái sử dụng v1.0**.
- Tổng hợp kết quả 5 chat thành 9 Wiki module, 5 JSON index và bộ chỉ mục theo feature, symbol, dependency.
- Giữ phân biệt Auto Farm gốc client (`WorldScene`), action nhặt đồ và nhặt theo tick simulation (`sim`), để tiện nghiên cứu Auto Farm riêng của tool.
- Kèm source gốc và manifest SHA-256 để phát hiện Wiki lỗi thời sau khi game cập nhật.
- Hiệu chỉnh tài liệu hợp nhất: gỡ phần mô tả `WorldScene` bị dính ở cuối `index.md`; sửa ghi chú dependency cũ trong `WorldScene.md`; cập nhật tham chiếu chéo trong `ChieuMau.md`.
- Đối chiếu tĩnh các `search_anchor`, byte offset có mặt, và filename import với đúng file source. Không chạy code/game/test.

## Phạm vi chưa giải quyết

- Ba JavaScript chunk được import nhưng không thuộc bộ 9 source: `donation-BLL6eTTD.js`, `LocalDriver-DA7Qxqfm.js`, `boot-DGR3-xtV.js`.
- Chưa biết thứ tự nạp `tm-direct.js` và `tm-guard.js`, cũng chưa xác minh hành vi runtime của tool.
