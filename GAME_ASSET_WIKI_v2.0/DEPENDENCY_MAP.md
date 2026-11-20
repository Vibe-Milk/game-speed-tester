# Dependency Map

Chỉ ghi các dependency JS **được chỉ ra trực tiếp** bằng import trong 9 file gốc. Tổng: 22 cạnh import; 5 cạnh tham chiếu tới file không có trong bộ.

| Source | Import target | Kiểu | Trong 9 file? |
|---|---|---|---|
| `Character-cz94XTen.js` | [index-ymL7Xfvg.js](modules/index.md) | `static_import` | Có |
| `Character-cz94XTen.js` | [phaser-DRI6y8R5.js](modules/phaser.md) | `static_import` | Có |
| `Character-cz94XTen.js` | [sim-B1iiLlB3.js](modules/sim.md) | `static_import` | Có |
| `ChieuMau-qVW4fvFM.js` | [Character-cz94XTen.js](modules/Character.md) | `static_import` | Có |
| `ChieuMau-qVW4fvFM.js` | [index-ymL7Xfvg.js](modules/index.md) | `static_import` | Có |
| `ChieuMau-qVW4fvFM.js` | [phaser-DRI6y8R5.js](modules/phaser.md) | `static_import` | Có |
| `WorldScene-bJccyikN.js` | [Character-cz94XTen.js](modules/Character.md) | `static_import` | Có |
| `WorldScene-bJccyikN.js` | [ChieuMau-qVW4fvFM.js](modules/ChieuMau.md) | `static_import` | Có |
| `WorldScene-bJccyikN.js` | `donation-BLL6eTTD.js` | `static_import` | **Thiếu** |
| `WorldScene-bJccyikN.js` | [index-ymL7Xfvg.js](modules/index.md) | `static_import` | Có |
| `WorldScene-bJccyikN.js` | [items-CCENVhBq.js](modules/items.md) | `static_import` | Có |
| `WorldScene-bJccyikN.js` | [phaser-DRI6y8R5.js](modules/phaser.md) | `static_import` | Có |
| `WorldScene-bJccyikN.js` | [sim-B1iiLlB3.js](modules/sim.md) | `static_import` | Có |
| `index-ymL7Xfvg.js` | `LocalDriver-DA7Qxqfm.js` | `dynamic_import` | **Thiếu** |
| `index-ymL7Xfvg.js` | [WorldScene-bJccyikN.js](modules/WorldScene.md) | `dynamic_import` | Có |
| `index-ymL7Xfvg.js` | `boot-DGR3-xtV.js` | `dynamic_import` | **Thiếu** |
| `index-ymL7Xfvg.js` | [items-CCENVhBq.js](modules/items.md) | `dynamic_import` | Có |
| `index-ymL7Xfvg.js` | [phaser-DRI6y8R5.js](modules/phaser.md) | `dynamic_import` | Có |
| `items-CCENVhBq.js` | `donation-BLL6eTTD.js` | `static_import` | **Thiếu** |
| `items-CCENVhBq.js` | [index-ymL7Xfvg.js](modules/index.md) | `static_import` | Có |
| `sim-B1iiLlB3.js` | `donation-BLL6eTTD.js` | `static_import` | **Thiếu** |
| `sim-B1iiLlB3.js` | [index-ymL7Xfvg.js](modules/index.md) | `static_import` | Có |

## Các file được tham chiếu nhưng chưa có source

- `LocalDriver-DA7Qxqfm.js` — chỉ xác nhận được tên file từ import, **không** xác nhận implementation.
- `boot-DGR3-xtV.js` — chỉ xác nhận được tên file từ import, **không** xác nhận implementation.
- `donation-BLL6eTTD.js` — chỉ xác nhận được tên file từ import, **không** xác nhận implementation.

## Quan hệ runtime cần phân biệt

- `WorldScene`: controller `V$` gọi `act("pickup","auto")` qua `autoHost`; `sim`: có `case "pickup"` và nhặt định kỳ theo `autoLootAt`. Đây là các điểm định vị liên quan nhưng chưa chứng minh toàn bộ luồng vận hành của tool.
- `tm-direct.js` và `tm-guard.js` đều thay `window.WebSocket`. **Chưa biết thứ tự tải** và tương tác giữa hai wrapper; không tự khẳng định chúng chạy cùng nhau theo thứ tự cụ thể.
- `phaser-DRI6y8R5.js` chứa các module ID **nội bộ**. Các ID số không phải file import và không được coi là cạnh dependency.
- `index-ymL7Xfvg.js` có preload map nhắc đến nhiều chunk. Chỉ ghi cạnh import trực tiếp nếu có biểu thức `import()` tương ứng trong source.

Để tra đủ anchor chứng minh mỗi cạnh: `DEPENDENCY_MAP.json` hoặc `indices/CHAT_XX_INDEX.json`.

