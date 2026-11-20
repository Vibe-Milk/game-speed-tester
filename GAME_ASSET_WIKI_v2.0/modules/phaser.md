# Module: phaser-framework-bundle

- **Tệp nguồn:** `phaser-DRI6y8R5.js`
- **SHA-256:** `5920a4fd5e79aa7f0f3f87a914b4591ba68a8a87a0f6a5c3d49005a870a5d7b1`
- **Kích thước:** 1,205,225 byte; khoảng 69 dòng vật lý, chủ yếu là các dòng minified rất dài.
- **Đối chiếu task:** tên tệp và hash khớp manifest trong `CHAT_01_Phaser_PROMPT_EN.txt`.

## Mục đích và ranh giới

Bundle Phaser/framework dùng loader module nội bộ với ID số. Module lõi `85454` tập hợp các namespace Phaser, xuất object đó qua `p.exports`, đồng thời gán `t.g.Phaser`. Cuối tệp có export ESM gồm alias `P` và `p`; `P` là object Phaser sau bước unwrap default export, `p` là namespace interop.

Không thấy mã game cụ thể ở các vùng đã kiểm tra. Đây là nhận định giới hạn trong tệp được giao, không suy ra cấu hình hoặc hành vi ứng dụng dùng framework. Các biến một chữ như `h`, `t`, `p` là tên nội bộ sau minify.

## Exports, imports và tích hợp

- Export cuối tệp: `export{Ot as P,Dt as p};`.
- Module lõi thực hiện `p.exports=h,t.g.Phaser=h`.
- Không có khai báo `import` tĩnh; phụ thuộc nội bộ dùng `t(<module ID>)` và nằm trong module map của bundle.
- Namespace lõi: `Actions`, `Animations`, `BlendModes`, `Cache`, `Cameras`, `Core`, `Class`, `Create`, `Curves`, `Data`, `Display`, `DOM`, `Events`, `FX`, `Game`, `GameObjects`, `Geom`, `Input`, `Loader`, `Math`, `Physics`, `Plugins`, `Renderer`, `Scale`, `ScaleModes`, `Scene`, `Scenes`, `Structs`, `Textures`, `Tilemaps`, `Time`, `Tweens`, `Utils`; `Sound` được nối sau object literal.

## Điều hướng tính năng → nguồn

| Khu vực | Anchor tìm kiếm chính xác | Quan sát |
|---|---|---|
| Export Phaser/global | `p.exports=h,t.g.Phaser=h` | Module lõi 85454 xuất object và gán global. **verified** |
| Namespace chính | `Actions:t(61061),Animations:t(60421),BlendModes:t(10312)` | Đầu object namespace trong module 85454. **verified** |
| Game runtime | `this.config=new e(w),this.renderer=null,this.domContainer=null,this.canvas=null` | Khởi tạo Game ở module 50127; cùng vùng có events, input, scene manager, scale, sound, loop và plugins. **verified** |
| Scene facade | `this.sys=new c(this,n),this.game,this.anims,this.cache,this.registry,this.sound` | Các trường facade Scene trong module 97482. **verified** |
| Scene manager | `SceneManager:t(60903),ScenePlugin:t(52209),Settings:t(55681),Systems:t(2368)` | Thành phần namespace Scenes ở module 62194. **verified** |
| Game objects | `GameObject:t(95643),BitmapText:t(22186),Blitter:t(6107),Bob:t(46590),Container:t(31559)` | Danh sách object trong module 77856. **verified** |
| Loader | `LoaderPlugin:t(74261),MergeXHRSettings:t(3374),MultiFile:t(26430)` | Plugin loader, XHR settings và multifile ở module 57777. **verified** |
| Input | `InputManager:t(7003),InputPlugin:t(48205),InputPluginCache:t(89639),Keyboard:t(51442)` | Input manager/plugin và thiết bị input ở module 14350. **verified** |
| Physics | `p.exports={Arcade:t(27064),Matter:t(3875)}` | Namespace Physics gồm Arcade, Matter ở module 44563. Không khẳng định game bật plugin nào. **verified** |
| Events | `Events:t(93055)` | Namespace Events trỏ tới module có EventEmitter. **verified** |

## Symbol và state quan trọng

- **Game**: module 50127 khởi tạo config, renderer/canvas fields, events, animations, textures, cache, registry, input, scene manager, scale, sound, loop và plugins. Anchor: `this.config=new e(w),this.renderer=null,this.domContainer=null,this.canvas=null`.
- **Scene**: module 97482 khai báo `sys`, `game`, `anims`, `cache`, `registry`, `sound`, `textures`, `events`, `cameras`, `add`, `make`, `scene`, `children`, `input`, `load`, `time`, `tweens`, `physics`, `matter` và trường khác. Anchor: `this.sys=new c(this,n),this.game,this.anims,this.cache,this.registry,this.sound`.
- **SceneManager**: namespace Scenes chứa `SceneManager`, `ScenePlugin`, `Settings`, `Systems`; anchor ở bảng trên.
- **GameObject**: namespace GameObjects liệt kê GameObject, Sprite, Image, Text, Container, factories và components; anchor ở bảng trên.
- **Phaser**: object namespace xuất qua CommonJS nội bộ và gán global; anchor `p.exports=h,t.g.Phaser=h`.
- **ESM aliases**: `P`, `p`; anchor `export{Ot as P,Dt as p};`.

## Events, lifecycle và giao thức

Game tạo emitter `this.events=new u`. SceneManager đăng ký `f.events.once(r.READY,this.bootQueue,this)` và phát `r.SYSTEM_READY` trong `bootQueue`. Điều này xác nhận một số điểm nối event giữa Game và SceneManager, không mô tả đầy đủ lifecycle hay toàn bộ event API. Anchor event: `f.events.once(r.READY,this.bootQueue,this)`.

## Phụ thuộc và giả định liên module

- Module lõi nối các module nội bộ, ví dụ Game `50127`, GameObjects `77856`, Input `14350`, Loader `57777`, Physics `44563`, Scene `97482`, Scenes `62194`.
- Không có import tĩnh để xác định dependency ngoài; cũng không thấy source map hoặc build manifest trong tệp.
- Không có bằng chứng cho tên game, scene game, asset game, cấu hình khởi động, hoặc plugin do game đăng ký.

## Cách điều hướng an toàn

1. Tra tên namespace semantic trong module gốc `85454` để xác nhận điểm export.
2. Tìm chuỗi như `GameObjects:` hoặc `Physics:` để lấy module ID, rồi tìm `<id>:(p,S,t)=>` trong source gốc.
3. Dùng tên API, chuỗi phương thức hoặc literal event làm anchor; không dùng số dòng minified làm locator duy nhất.
4. Không diễn giải biến nội bộ một chữ thành API game nếu chưa có bằng chứng.
5. Đánh dấu hành vi phụ thuộc runtime, build config hoặc module không được giao là chưa xác minh.

## Độ tin cậy và giới hạn

- Hash được tính trên tệp gốc và khớp manifest task.
- Namespace/export, các object/field được nêu và vài event đã đối chiếu trực tiếp: **verified**.
- Nhận diện đây là Phaser framework bundle dựa trên namespace `Phaser` và các nhóm API: **inferred**, độ tin cậy cao.
- Đây là chỉ mục điều hướng ngắn, không kiểm kê mọi module/class nội bộ trong bundle minified 1.2 MB.
- Không chạy JavaScript, game, test, lint hay QA theo chỉ dẫn task. Hành vi runtime, thứ tự lifecycle đầy đủ, phiên bản/build options và tích hợp game chưa xác minh.
