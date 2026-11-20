# Module: ChieuMau

- Source: `ChieuMau-qVW4fvFM.js` · SHA-256 `7fcf9fa7046f4b38b0dfd1df3b82b758dc16cfcd494e0cdf43d4ef227f9b900` · 207944 bytes · 1 minified line.
- Mục đích: module hiệu ứng chiến đấu dùng Phaser; xác nhận qua lớp `Ro`, kho hiệu ứng và hàm vẽ/điều phối trong bundle. Không đủ bằng chứng để gán xử lý sát thương gameplay cho module này.
- Import thấy trong nguồn: `index-ymL7Xfvg.js`, `phaser-DRI6y8R5.js`, `Character-cz94XTen.js`. Export cuối file: `ye`, `Ro`, `It`, `Bt`, `de` được export lần lượt dưới alias `C`, `J`, `a`, `b`, `c`.

## Điều hướng

| Khu vực | Locator chính xác | Ghi chú |
|---|---|---|
| Pool hạt/đồ họa chiến đấu | `class Ro{constructor(e){g(this,"px",new Float32Array(L))` | Lớp minified; state gồm particle arrays, decals, arcs, rings, lights, sheets, ghosts, damage numbers và screen overlays. |
| Các hiệu ứng đóng băng khung/camera | `T={light:{stop:.045,shake:1.6` | Cấu hình hiệu ứng light/crit/finisher/hurt/ult; không chứng minh luật combat. |
| Asset hiệu ứng | `Ft="juice:glow",Io="juice:scorch"` | Hai key texture được khởi tạo trong constructor. |
| API module | `export{ye as C,Ro as J,It as a,Bt as b,de as c}` | Chỉ alias export quan sát được; xác định semantic API cần đối chiếu bên gọi. |

## State và vòng đời

`Ro` tạo pool giới hạn và các lớp đồ họa Phaser, có `preload`, `define`, `ready`, `sheet`, `update`, `shutdown` theo anchor `update`/`shutdown` (anchors phổ biến; tìm trong cửa sổ lớp). Tên trường minified được lưu dưới dạng chuỗi qua helper `g`, nhiều trường có ý nghĩa hiển thị như `px`, `py`, `vx`, `vy`, `age`, `life`, `decals`, `arcs`, `rings`, `lights`, `sheets`, `ghosts`, `nums`, `shakeAmp`. Tác động runtime cụ thể ngoài đoạn trực tiếp đọc được cần xem thân phương thức.

## Phụ thuộc và giới hạn

- Các file được ghi trong `dependencies` chỉ là tên file được import nguyên văn. ID import như `Q`, `O`, `P`, `A`, `e` không phải target file.
- `Character-cz94XTen.js` là file được tham chiếu trực tiếp. `index-ymL7Xfvg.js` và `phaser-DRI6y8R5.js` cũng được tham chiếu và có Wiki tương ứng trong bộ v2.0.
- Tìm kiếm an toàn: tìm anchor nguyên văn trong file gốc (một dòng), sau đó đọc đoạn minified cục bộ; không dựa riêng vào line number.
- Độ tin cậy: pool hiệu ứng/render đã xác minh; quan hệ với mechanic sát thương và ý nghĩa đầy đủ của hai export chưa xác minh.


