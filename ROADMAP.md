# Roadmap — Game Speed Tester

> Tài liệu theo dõi mục tiêu và việc tiếp theo, không phải changelog hay bằng chứng gameplay. Xem [AGENTS.md](AGENTS.md) để biết quy tắc, [CODEGRAPH.md](CODEGRAPH.md) để tra kiến trúc, và Git history để xem chi tiết thay đổi.

Cập nhật: 2026-11-25. Nhánh: `main`. Mốc code đã review: [`eedc443`](https://github.com/Vibe-Milk/game-speed-tester/commit/eedc4431dade15f9f967dd744cd2f5ae5387fb2b).

## Việc tiếp theo

**Kiểm tra thực tế Connection Recovery trước khi triển khai Auto Resume.** Người dùng chạy `pull-game-speed-tester.bat`, Reload extension và tải lại tab game.

- [ ] Chuyển tab/thu nhỏ trình duyệt lâu; kiểm tra kết nối khi Farm và Harvest đều tắt.
- [ ] Ngắt mạng tạm thời rồi kết nối lại; quan sát kết quả và log recovery.
- [ ] Bật Auto Reload để kiểm tra trường hợp reconnect thất bại; kiểm tra đếm ngược, hủy và giới hạn tải lại.
- [ ] Quan sát khi server thực sự reset (không chủ động tác động server).
- [ ] Ghi nhận kết quả và lỗi nếu có; chốt hướng Task 4 với người dùng sau khi review.

Runtime: **UNVERIFIED**. Các bước trên là kế hoạch kiểm tra, không phải kết quả. Tests/lint/QA chưa được yêu cầu chạy.

## Mục tiêu hiện tại — Connection Recovery

Duy trì kết nối khi chạy nền; khôi phục an toàn bằng cơ chế gốc của game, tự tải lại có giới hạn khi đủ điều kiện; sau khi kiểm chứng mới xem xét tự khôi phục automation.

| Task | Trạng thái | Commit implementation |
| --- | --- | --- |
| 1 — Anti Disconnect / Worker | STATIC REVIEW PASS; runtime UNVERIFIED | [13f00e2](https://github.com/Vibe-Milk/game-speed-tester/commit/13f00e2694d29d9a57acb5012aee90993460f505) |
| 2 — Auto Reconnect | IMPLEMENTED; lỗi review được xử lý ở 2.1 và 3 | [3be052c](https://github.com/Vibe-Milk/game-speed-tester/commit/3be052c425ecfa91084998481705384bc30dcfba) |
| 2.1 — Fix reconnect regressions | IMPLEMENTED; lỗi còn lại được xử lý ở 3 | [f075a2c](https://github.com/Vibe-Milk/game-speed-tester/commit/f075a2cdaa5163db4aadec5c3892d8d3f3426a1a) |
| 3 — Auto Reload / phối hợp recovery | IMPLEMENTED; lỗi còn lại được xử lý ở 3.1 | [6bba7d6](https://github.com/Vibe-Milk/game-speed-tester/commit/6bba7d6f827aa2669f9466ac81d99d01dfb68489) |
| 3.1 — Finalize Connection Recovery | STATIC REVIEW PASS; runtime UNVERIFIED | [eedc443](https://github.com/Vibe-Milk/game-speed-tester/commit/eedc4431dade15f9f967dd744cd2f5ae5387fb2b) |
| Kiểm tra thực tế Task 1–3 | PENDING — bước tiếp theo | — |
| 4 — Auto Resume | PENDING — chờ kết quả kiểm tra và duyệt | — |

## Giới hạn và việc còn mở

- Chưa xác minh handler của nút “Kết nối lại” trong game live; chưa triển khai tự bấm nút. Chỉ xem xét sau khi có source phù hợp.
- Server reset có thể làm mất hiệu lực phiên; chưa xác minh khả năng phục hồi thực tế. Không vượt đăng nhập, xác minh hoặc hạn chế phiên.
- Worker có thể bị trình duyệt/hệ điều hành đình chỉ; review Task 1 ghi nhận rủi ro thấp nếu Worker ngừng phát tín hiệu mà không báo lỗi. Chưa có bằng chứng runtime.
- Task 4 dự kiến tùy chọn khôi phục Farm/Harvest sau kết nối được xác minh, mặc định tắt; cần chốt phạm vi riêng, không tự triển khai.
- Các nhóm tính năng khác (Farm, Harvest, tiện ích) chưa được rà soát lại trong lần setup roadmap này. Không coi trạng thái lịch sử trong tài liệu cũ là kết quả review HEAD.

## Tài liệu dự án

- Documentation 1 — README và CodeGraph: IMPLEMENTED trong commit tài liệu hiện tại (source baseline `e8efee2`); rút gọn hướng dẫn/định tuyến, giữ bản cũ bằng liên kết commit. Không thay code, không chạy test. Chưa audit đầy đủ từng tính năng.
- Documentation 2 — PENDING, đề xuất rà soát hai tài liệu Farm lịch sử và RELEASE; cần người dùng chốt phạm vi trước khi thực hiện. Không tự xóa file.

## Cách duy trì

Cập nhật mục liên quan khi thực hiện task được duyệt; ghi commit, trạng thái review/runtime, blocker và việc tiếp theo. Giữ ngắn, không sao chép chi tiết code hay lịch sử commit. Nếu chỉ review hoặc tạo prompt, không tự ghi repository khi chưa được phép sửa tài liệu.
