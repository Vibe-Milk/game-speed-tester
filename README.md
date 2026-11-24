# Game Speed Tester

Chrome Extension Manifest V3 dành cho kiểm thử có sự cho phép trên `https://nghichthienky.online/*`. Repository: [Vibe-Milk/game-speed-tester](https://github.com/Vibe-Milk/game-speed-tester), nhánh `main`.

Tài liệu được đối chiếu với giao diện và source liên quan tại commit [`e8efee2`](https://github.com/Vibe-Milk/game-speed-tester/commit/e8efee261066fc55d9839d9e5746f79dca814e48). Đây là hướng dẫn theo code, không phải kết quả kiểm thử gameplay.

## Cài đặt và cập nhật

1. Dùng Chrome 111 trở lên. Mở `chrome://extensions`.
2. Bật **Developer mode** rồi chọn **Load unpacked**.
3. Chọn thư mục repository chứa `manifest.json`.
4. Mở hoặc tải lại trang game; có thể ghim extension để tiện sử dụng.

Không cần build, npm hoặc backend. Khi cập nhật local, chạy `pull-game-speed-tester.bat` nếu đã có script này trên máy, sau đó Reload extension và tải lại tab game. Giữ nguyên đường dẫn cài đặt để tránh đổi ID extension và mất quyền truy cập cài đặt cũ.

Muốn gửi tool cho người khác, dùng ZIP phát hành theo [RELEASE.md](RELEASE.md). Không có cập nhật tự động từ Chrome Web Store.

## Các trang chức năng

| Trang | Dùng để làm gì |
| --- | --- |
| Tổng quan | Xem trạng thái và truy cập nhanh |
| Auto của tool | Chọn controller Farm, bật/tắt Farm, phạm vi, mục tiêu, kỹ năng và cấu hình hồi phục |
| Tiện ích độc lập | Các tiện ích riêng, gồm đan HP/MP và hiển thị hỗ trợ Farm |
| Thu hoạch | Chọn tài nguyên và phạm vi, xem trạng thái thu hoạch |
| Auto Quest | Tìm, chọn và chạy quest theo các điều kiện được hỗ trợ |
| Hình ảnh & FPS | Tùy chọn hiển thị, minimap và giảm tải hình ảnh |
| Tài khoản | Quản lý nick, mở tab và cấu hình đăng nhập |
| Giao diện | Cài đặt giao diện và phím tắt |
| Chẩn đoán | Xuất log để tìm lỗi |
| Kết nối & tự tải lại | Hỗ trợ kết nối lại và tự tải lại có giới hạn |

Tên trang lấy từ `popup.html`; các nhóm điều khiển có thể được bố trí lại bởi script giao diện. Tùy chọn bị khóa, ẩn hoặc chưa khả dụng không đồng nghĩa tính năng đang chạy.

## Auto Farm

- Chọn **Farm của game** để dùng controller gốc, hoặc **Farm của tool** để dùng controller hiện hành của extension. Chọn controller không tự bật Farm.
- Cấu hình bán kính (1–1.000 ô) hoặc toàn map hiện tại, bộ lọc quái và kỹ năng theo các điều khiển khả dụng. Bấm Bật Farm trong menu hoặc dùng phím tắt Farm đã cài.
- Kỹ năng có hai cách chọn: mặc định theo game hoặc tùy chỉnh thứ tự ưu tiên các ô 1–6. Tool sử dụng các kiểm tra an toàn hiện có; đổi lựa chọn trong phiên Tool Farm được áp dụng sau hành động đang thực hiện.
- Nhặt theo game được hỗ trợ theo cơ chế gốc. Lựa chọn nhặt theo tool vẫn khóa vì chưa xác minh được cách tắt riêng việc nhặt đồ gốc.
- Tool Farm có thể nhường thao tác tay; thay đổi danh tính, controller hoặc kết nối có thể dừng phiên. Kiểm tra trạng thái hiển thị thay vì suy đoán từ công tắc.
- Các mode Extended/Custom Farm cũ không còn là controller hoạt động. Không dùng hướng dẫn lịch sử trong `CUSTOM_AUTO_FARM.md` để bật mode cũ.

## Kết nối & tự tải lại

| Tùy chọn | Mặc định |
| --- | --- |
| Hỗ trợ kết nối lại | Bật |
| Tự tải lại khi lỗi kéo dài | Tắt |
| Chờ trước khi đếm ngược | 90 giây |
| Thời gian đếm ngược | 10 giây |
| Giới hạn tải lại | 3 lần trong 15 phút |

Extension theo dõi phản hồi mạng và sử dụng cơ chế kết nối lại gốc của game khi đủ điều kiện. Tải lại chỉ thực hiện khi lỗi mạng được nhận diện, danh tính và phiên an toàn, không có recovery đang chờ, và chưa vượt giới hạn. Có thể hủy đếm ngược.

Worker hỗ trợ theo dõi khi chạy nền nhưng không bảo đảm trình duyệt/hệ điều hành không đình chỉ tab. Server reset có thể làm mất phiên; khi cần đăng nhập lại hoặc xác minh, người dùng phải kiểm tra thủ công. Chưa tự bấm nút “Kết nối lại” của game; chưa triển khai Auto Resume sau recovery.

## Tìm lỗi và bảo mật

- Khi gặp lỗi, ghi lại tính năng, tab/nhân vật, thao tác trước lỗi và thời điểm; dùng trang **Chẩn đoán** để xuất log liên quan.
- Không gửi mật khẩu, token hoặc dữ liệu xác thực trong log. Tính năng tài khoản lưu thông tin đăng nhập trong bộ nhớ local của Chrome; chỉ dùng trên thiết bị tin cậy.
- Dữ liệu trạng thái client không chứng minh server đã chấp nhận hành động.
- Không tự suy luận kết quả gameplay từ review source. Lần chuẩn hóa tài liệu này không chạy tests, lint, QA hoặc CI; runtime chưa được xác minh.

## Tài liệu dự án

| Tài liệu | Mục đích |
| --- | --- |
| [ROADMAP.md](ROADMAP.md) | Mục tiêu, tiến độ và việc tiếp theo |
| [AGENTS.md](AGENTS.md) | Quy tắc làm việc của Agent |
| [CODEGRAPH.md](CODEGRAPH.md) | Bản đồ kỹ thuật, entry point và cách tra source extension |
| [RELEASE.md](RELEASE.md) | Phát hành ZIP |
| [GAME_ASSET_WIKI_v2.0](GAME_ASSET_WIKI_v2.0/README.md) | Tra source game lưu trữ, không phải bằng chứng phiên bản live |

Lịch sử chi tiết được giữ trong [README trước khi chuẩn hóa](https://github.com/Vibe-Milk/game-speed-tester/blob/e8efee261066fc55d9839d9e5746f79dca814e48/README.md) và [Git commit history](https://github.com/Vibe-Milk/game-speed-tester/commits/main/). Các tài liệu Farm theo giai đoạn cũ được giữ để tham khảo lịch sử, không phải hướng dẫn hiện hành.
