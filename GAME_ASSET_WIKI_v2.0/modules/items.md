# Module: items

- Source: `items-CCENVhBq.js` · SHA-256 `15982067271a5aa26a97cb3d269ba8351cda206063a6003257857a6d45c9ca87` · 18515 bytes · 13 dòng.
- Mục đích: metadata và UI item/gear: phím điều khiển, thiết lập lưu localStorage, tra icon, tải metadata và recipe, tên vật phẩm thưởng.
- Imports trực tiếp: `index-ymL7Xfvg.js`, `donation-BLL6eTTD.js`. Export cuối file gồm các alias `C,a,b,c,d,e,f,g,h,i,j,k,l,r,s`.

## Điều hướng

| Khu vực | Locator chính xác | Ghi chú |
|---|---|---|
| Bảng phím mặc định | `const I=[["W",87,"Đi lên"]` | Mảng bindings, gồm di chuyển, đánh, kỹ năng, túi, trang bị, độ kiếp, trò chuyện. |
| Lưu cấu hình điều khiển | `Z="tm-controls-v1"` | Khóa localStorage; `Pn` đọc/kiểm tra; `An` ghi. |
| Nạp gear icons | `async function Sn(){if(!x)try{x=(await(await fetch("data/gear/gear.json"))` | Fetch icon map, lỗi thì dùng object rỗng. |
| Tra đường dẫn icon gear | `function K(n){n={...n,id:tn(n.id)??n.id}` | Xử lý nhiều prefix và resolver import; trả null khi không tìm thấy. |
| Nạp item metadata và recipe | `function En(){return A??(A=Promise.all([fetch("data/items/items-meta.json")` | Nạp metadata atlas và recipes từ hai endpoint dữ liệu. |
| API item/icon | `export{I as C,Wn as a,B as b` | Xem export list cuối file để tra alias cụ thể. |

## Giới hạn

File cũng định nghĩa hiển thị icon, mô tả item/đan dược/ngọc/trang bị, và hình fallback; nội dung data JSON được fetch lúc chạy không nằm trong source được giao. Không khẳng định các dữ liệu runtime đã tồn tại hoặc đã tải thành công. Module `donation-BLL6eTTD.js` được import trực tiếp nhưng thiếu trong bộ được giao.

## Phụ thuộc / điều hướng an toàn

Chỉ ghi exact filenames có trong import source. Các URL dữ liệu như `data/items.json` là runtime fetch, không phải module dependency file-level trong import graph; chưa liệt kê thành `target_file`. Tìm anchor trên trong file gốc, rồi đọc các dòng 1–13.
