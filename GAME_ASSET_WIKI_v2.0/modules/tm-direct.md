# Module: tm-direct

- Source: `tm-direct.js` · SHA-256 `ac013042e8be620365ae650b48d4da80c40f0efa3ac9a2d061d74372f01a3965` · 5362 bytes · 69 dòng.
- Mục đích theo chú thích và code: thay `window.WebSocket` để kết nối trực tiếp tới endpoint VPS, fallback về URL game nếu lỗi hoặc quá hạn. Đây là script độc lập, không import module game.

## Điều hướng

| Khu vực | Locator chính xác | Ghi chú |
|---|---|---|
| URL/timeout/cache | `var DIRECT = 'wss://ws.nghichthienky.online/ws', KEY = 'tm-dws-fail', OPEN_MS = 2500` | Fallback timeout 2.5s; nhớ lỗi 5 phút. |
| Giới hạn origin | `function production() { return /^(www\\.)?nghichthienky\\.online$/.test(location.hostname); }` | Chỉ bật trên host khớp regex. |
| Điều kiện socket game | `function gameUrl(u) { try { var x = new URL(String(u), location.href)` | Chỉ pathname `/ws` cùng host. |
| Socket facade | `function DirectSocket(url) {` | Bọc socket thật bằng EventTarget, relay event/properties và send/close. |
| Fallback | `function fallback() {` | Đóng socket trực tiếp, ghi lỗi session, tạo Native socket từ URL ban đầu nếu chưa đóng bởi game. |
| Thay WebSocket global | `window.WebSocket = WebSocketShim;` | Protocols hoặc URL không thuộc game giữ Native constructor. |

## Hành vi và giới hạn

`DirectSocket` thử `DIRECT`, nếu không mở trước deadline/fails, khởi động Native socket với `self.url`; một socket facade là thứ trả về cho caller. `note` cập nhật `window.__tmNet.route` trừ trường hợp route hiện tại có `WebRTC`, và luôn đặt `window.__tmWsRoute`. `sessionStorage` lỗi thì cho phép direct thử. Không có bằng chứng trong file này về thứ tự nạp so với `tm-guard.js`; hai script đều wrap global WebSocket, nên thứ tự là điểm tích hợp cần xác minh ngoài các file này.

Dependencies file-level: không có import hay exact filename reference. Các giao thức global là runtime references, không phải filename.
