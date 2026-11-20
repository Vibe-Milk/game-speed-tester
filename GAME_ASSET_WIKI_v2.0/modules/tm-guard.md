# Module: tm-guard

- Source: `tm-guard.js` · SHA-256 `4a9ef0f8ae1a11556ba4f3ef386de7bc0c76cf0fa32b97d5309db4dff9dada47` · 5286 bytes · 66 dòng.
- Mục đích: lắng nghe socket game để hiển thị xác nhận guard; bổ sung nút Độ kiếp trên mobile landscape khi snapshot cho biết trạng thái khả dụng; gửi action qua global send hook hoặc socket.
- Độc lập với import graph game theo chú thích; không có import statement.

## Điều hướng

| Khu vực | Locator chính xác | Ghi chú |
|---|---|---|
| Gửi action | `function out(m) { try { if (window.__tmSend)` | Chọn hook `__tmSend`, nếu thiếu thì socket mở gửi JSON. |
| Dialog guard | `function show(ev) {` | Dựng alertdialog, countdown và nút xác nhận; gửi `{t:'action',action:'guard-ok',arg:id}`. |
| Nút độ kiếp | `function tribButton(on) {` | Ẩn nếu không mobile hoặc portrait; tạo nút một lần và phát action `tribulation`. |
| Snapshot/event parse | `function feed(data) {` | Nhận chuỗi; cập nhật `tg` từ snap/snap2; đọc `ev[].e === 'guard'`. |
| Hook và wrapper | `window.__tmGuard = { feed: feed };` | Công bố feed; Wrapped tạo Native socket và đăng listener message. |
| Thay global | `window.WebSocket = Wrapped;` | Lưu socket cuối được tạo và gắn feed listener. |

## Hành vi và giới hạn

`show` dùng event id/reason/seconds, đóng dialog khi xác nhận hoặc hết hạn. `tribButton` chỉ hiện khi document body có class `mobile`, viewport landscape, và server snapshot báo `tg`. `feed` kiểm tra JSON guard marker, parse rồi xử lý event list. Chú thích nói WebRTC path feed qua `__tmGuard.feed` và gửi qua `window.__tmSend`; implementation phụ thuộc bên ngoài không được xác nhận ở đây.

Không có file-level dependencies. `window.__tmSend`, `__tmGuard`, WebSocket và snapshot protocol là runtime interfaces, không phải filenames. `tm-direct.js` cũng bọc `window.WebSocket`, nhưng hai nguồn không xác nhận thứ tự nạp; cần xem HTML/script loader để kết luận.
