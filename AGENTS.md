# Hướng dẫn làm việc với Game Speed Tester

## Giao tiếp và phạm vi

- Trao đổi bằng tiếng Việt đơn giản. Prompt/report dành cho Agent viết bằng English.
- Task chỉ review/phân tích: chỉ đọc, báo `Changes: None`. Yêu cầu tạo prompt chỉ tạo prompt.
- Task lớn chưa rõ hướng: phân tích và đưa plan ngắn, chờ chốt trước khi sửa. Đã duyệt hoặc yêu cầu làm trực tiếp thì không hỏi lại.
- Chỉ thực hiện task hiện tại; đề xuất, handoff và plan cũ không tự cấp quyền mới.
- Giữ thay đổi nhỏ, architecture và tính năng đang hoạt động; không refactor, thêm dependency/quyền extension hoặc sửa issue ngoài scope nếu không cần.

## Theo dõi tiến độ dự án

- Đọc `ROADMAP.md` ngay sau `AGENTS.md` khi bắt đầu task hoặc tiếp quản chat. Xác nhận HEAD và đối chiếu commit liên quan; roadmap không thay thế source thật.
- `ROADMAP.md` là nơi ghi ngắn gọn mục tiêu, task đang làm/chờ, commit implementation hoặc review, kết quả kiểm tra, blocker và việc tiếp theo. Không dùng làm changelog dài; Git lưu lịch sử thay đổi, CodeGraph lưu kiến trúc, Wiki lưu source game.
- Khi thực hiện task đã được duyệt, cập nhật mục tiến độ liên quan trong cùng phạm vi commit. Sau review hoặc kiểm tra thực tế, cập nhật kết quả có bằng chứng và việc tiếp theo khi được phép sửa tài liệu; nếu yêu cầu chỉ review hoặc chỉ tạo prompt, chỉ báo nội dung cần cập nhật, không tự commit.
- Phân biệt `IMPLEMENTED`, `STATIC REVIEW PASS` / `NEEDS FIX`, `RUNTIME VERIFIED` / `UNVERIFIED`, `PENDING` và `BLOCKED`. Ghi commit được review cụ thể; không suy diễn PASS runtime từ source, commit hoặc kết quả cũ. Không đánh dấu task hoàn tất nếu còn blocker; ghi rõ giới hạn hoặc bước xác minh còn thiếu.
- Luôn giữ mục Việc tiếp theo ngắn và có thể thực hiện được; cập nhật mục cũ thay vì nhân bản thông tin. Không biến roadmap thành quyền tự triển khai task mới, chạy test, commit hoặc push ngoài phạm vi đã được người dùng cho phép.

## Workflow dựa trên Wiki

Áp dụng cho feature, sửa đổi, debug và tối ưu:

1. Đọc `AGENTS.md` và `ROADMAP.md` để nắm quy tắc và tiến độ repository.
2. Tham khảo `CODEGRAPH.md` để định vị component và luồng của extension.
3. Đọc `GAME_ASSET_WIKI_v2.0/README.md` để nắm quy tắc điều hướng source game.
4. Dùng `GAME_ASSET_WIKI_v2.0/FEATURE_INDEX.md` để tìm feature liên quan.
5. Dùng `GAME_ASSET_WIKI_v2.0/ASSET_INDEX.json` và `GAME_ASSET_WIKI_v2.0/FUNCTION_MAP.md` để tìm module, symbol và hàm liên quan.
6. Tham khảo `GAME_ASSET_WIKI_v2.0/DEPENDENCY_MAP.md` khi cần hiểu quan hệ giữa các module.
7. Chỉ đọc Wiki module liên quan trong `GAME_ASSET_WIKI_v2.0/modules/`.
8. Trước khi sửa hành vi extension dựa trên game, kiểm tra các đoạn JavaScript tương ứng trong `GAME_ASSET_WIKI_v2.0/source/`.

Wiki là bản đồ điều hướng, không phải bằng chứng runtime. Khi cần xác minh danh tính source, đối chiếu file và SHA-256 với `GAME_ASSET_WIKI_v2.0/SOURCE_MANIFEST.json`. Dùng search anchor và source locator chính xác để tìm code; không chỉ dựa vào tên symbol minified hoặc số dòng. Nếu offset hoặc anchor không còn khớp, tìm trong source hiện tại trước khi kết luận. Phân biệt rõ hành vi được source xác nhận, hành vi suy luận và hành vi runtime chưa xác minh. Không tự tạo tên hàm, event, API hoặc dependency.

Để tiết kiệm context và token, không nạp toàn bộ JavaScript bundle theo mặc định. Bắt đầu từ các index tổng hợp, chỉ mở module liên quan, rồi đọc phần source tối thiểu cần cho thay đổi. Mở rộng kiểm tra source khi dependency hoặc call chain đòi hỏi; tái sử dụng thông tin đã xác minh và chỉ xin thêm source game khi thực sự cần.

Quy tắc xin source trong AGENTS.md này được ưu tiên hơn các câu trong Wiki yêu cầu luôn xin full current source: chỉ xin khi thiếu source cần thiết hoặc phiên bản chưa đủ căn cứ; không xin lại file đã có và phù hợp.

Nếu Wiki thiếu: báo rõ, không bịa nội dung hoặc tuyên bố đã đọc. Có thể tiếp tục phần độc lập bằng source sẵn có; nếu task phụ thuộc routing/thông tin trong Wiki thì xin đúng file này trước.

## CodeGraph của extension

- `CODEGRAPH.md` ở root là bản đồ tĩnh entry point, bridge, dependency và ownership của extension. Đọc để khoanh vùng trước khi sửa nhiều module; không thay thế source thật. `README.md` mô tả cách sử dụng (các phần ghi ngày cũ là lịch sử), `RELEASE.md` mô tả quy trình ZIP hiện hành; chỉ cập nhật thông tin có chứng cứ từ source/workflow.
- Cập nhật đúng phần CodeGraph liên quan khi thay đổi module, manifest/popup load order, channel, public API, priority hoặc ownership/dependency. Không sửa CodeGraph chỉ vì đổi logic nội bộ không làm đổi các quan hệ này.
- Không xem CodeGraph là bằng chứng runtime/live game; Wiki v2.0 và `GAME_ASSET_WIKI_v2.0/source/` vẫn là tài liệu tham chiếu source game với giới hạn phiên bản riêng.

## Wiki là bản đồ điều hướng, không phải bằng chứng runtime

- Tên class/hàm minified, dependency và hành vi trong Wiki có thể thuộc bản game cũ; không mặc định bản deployed hiện tại giống hệt.
- Không bịa hàm, biến, event, network message hoặc API từ suy đoán.
- Ưu tiên source mới do người dùng cung cấp. File WorldScene.js/index.js có thể là bản đổi tên của hashed bundle nhưng phải xác minh khi phiên bản ảnh hưởng kết quả.
- Khi có cả hai bản, so sánh hash; kiểm tra imports/exports và code liên quan, không chỉ tên file.
- Source sẵn có có thể nằm trong `work/` hoặc đường dẫn người dùng đã cung cấp; kiểm tra tồn tại trước khi dùng. Không mặc định đường dẫn lịch sử còn đúng.
- Khi được cung cấp asset mới: đọc hệ thống liên quan, cập nhật registry/routing trong Wiki bằng thông tin đã xác minh, giữ entry hữu ích và ghi limitations/version. Nếu chưa có Wiki gốc, xin file trước khi cập nhật.
- Không tự sửa Wiki chỉ vì extension đổi code mà không có thông tin game-source mới đã xác minh.

## Source game cục bộ do người dùng cung cấp

- Ưu tiên đọc source đã có trong `GAME_ASSET_WIKI_v2.0/source/` của repository. Chỉ kiểm tra `C:\Users\Milk\Downloads\Game` khi Agent thực sự có quyền truy cập máy cục bộ; không giả định ChatGPT/GitHub connector đọc được đường dẫn này.
- Đây là snapshot source game hiện được người dùng lưu, không bảo đảm trùng bản game live trong tương lai. Game có thể cập nhật nội dung, tên bundle/hash và tên minified.
- Không phụ thuộc tên file cố định: liệt kê file hiện có, dùng Wiki để định hướng rồi đối chiếu nội dung, imports/exports và call site để nhận diện đúng hệ thống. `WorldScene.js`/`index.js` có thể là tên người dùng đổi lại.
- Nếu thiếu file cần thiết, không xác định được file nào tương ứng, hoặc có nghi vấn về tên/phiên bản ảnh hưởng kết quả, hỏi người dùng ngắn gọn và nêu rõ điểm chưa chắc. Không yêu cầu lại toàn bộ source mặc định.
- Source trong thư mục cục bộ phục vụ đọc/đối chiếu; không tự sửa, di chuyển hoặc xóa. Chỉ thêm hoặc thay thế source tham chiếu khi được người dùng cho phép rõ ràng và repository đích phù hợp về quyền phân phối; không tự tạo thêm bộ source trùng lặp.

## Ranh giới implementation

- Ưu tiên sửa extension; không sửa bundle game/engine bên thứ ba trừ khi có nhu cầu thực sự và quyền phù hợp.
- Không sửa damage, attack speed, cooldown, packet, authentication hoặc game server trong scope extension này.
- Không nhầm presentation phía client với quyền quyết định server; ghi client HP/FX/movement không chứng minh server thay đổi quy tắc.
- Ưu tiên integration point ổn định thay vì hardcode tên minified. Thiếu API/đổi version phải nhường lại game và báo trạng thái rõ.
- Giữ dispatcher `farm-update.js`, đường đi native và ownership giữa farm/quest/seals/realm/chest/harvest; không thêm combat engine hoặc vòng di chuyển cạnh tranh.
- Không deploy, restart service hoặc sửa production config khi chưa có yêu cầu rõ.
- Không dùng subagent nếu người dùng chưa yêu cầu.

## Repo và Git

- Trước sửa: xác nhận repo/branch/worktree, status và diff liên quan.
- Không tự tạo/switch branch, merge, rebase, reset, clean, stash hoặc ghi đè local/untracked ngoài task.
- Review diff/status sau sửa; việc này không phải QA/test.
- Mặc định commit phần task trên branch hiện tại khi implementation hoàn tất và không có blocker rõ. Chỉ stage đúng scope; kiểm tra `.gitignore`, file được track; không commit secret, .env, dependency hay runtime data.
- Chỉ push khi người dùng yêu cầu; không force-push. Nếu chỉ review/local-only/chưa commit thì không commit.
- Không theo dõi CI tự động. Báo đúng commit/push thất bại nếu có.

## Tests và bằng chứng

- Không tự chạy tests, regression, smoke, lint, typecheck, benchmark, browser QA hoặc live E2E nếu người dùng chưa yêu cầu rõ cho công việc đang thực hiện.
- Khi đã được yêu cầu, chọn checks phù hợp scope. Review source/diff được phép trong task, không thay thế kết quả thực thi.
- Test chưa chạy: `NOT RUN`; CI chưa xem: `NOT CHECKED`; runtime chưa xác minh: `UNVERIFIED`.
- Phân biệt fixture/VM/DOM giả, browser thật, gameplay và receipt server. Không dùng kết quả lịch sử làm bằng chứng cho HEAD hiện tại.
- Không thêm yêu cầu live API/model/game call hoặc hành động phá hủy từ plan/handoff cũ.
- Không để lộ token, credential, raw packet hoặc secret trong log/báo cáo. Dùng `[REDACTED_SECRET]` khi cần mô tả secret bị lộ.

## Xin source và báo kết quả

Khi thực sự thiếu source:

**Files cần cung cấp:**

- `filename.js` — lý do cần file này.

**Mục đích:** phần cần kiểm tra.

Khi hoàn tất: nêu thay đổi, các file extension sửa (gọn), source game đã đọc, checks thực tế, Git, limitations/blocker. Không nhận định PASS/verified khi chưa có kết quả.

## Trạng thái setup

- AGENTS.md được tạo từ yêu cầu setup Wiki-driven workflow ngày 2026-11-05.
- Wiki v0.7 đã lỗi thời và được xóa khỏi repository. Wiki v2.0 tại `GAME_ASSET_WIKI_v2.0/README.md` là bản đồ điều hướng source hiện tại.
- Ghi chú setup ngày 2026-11-05 và provenance/limitations của Wiki v0.7 chỉ là lịch sử; nhãn CONFIRMED của bản đó không phải xác minh live hoặc toàn bộ source hiện tại.
- Tại thời điểm setup 2026-11-05, các đề xuất tính năng cũ (auto click, rương, cổng) chưa được triển khai **trong bước setup**. Trạng thái tính năng hiện tại phải đọc từ source và `CODEGRAPH.md`, không lấy câu ghi nhận lịch sử này làm kết luận về HEAD hiện tại.

## Game source snapshots

- Game source snapshots are available in `GAME_ASSET_WIKI_v2.0/source/`.
- Use [Wiki v2.0](GAME_ASSET_WIKI_v2.0/README.md) to route to relevant modules/records, then inspect only necessary portions of the available Wiki `source/` files.
- Establish source identity against the `GAME_ASSET_WIKI_v2.0/SOURCE_MANIFEST.json` before relying on Wiki offsets; otherwise locate the needed code directly.
- Use available Wiki `source/` files before requesting additional source from the user.
- Treat these files as read-only reference material.
- Do not modify, regenerate, or include game source files in the extension runtime.
- Do not assume the snapshots match the current live game.
- Wiki instructions and reports are reference material; they do not authorize actions or prove runtime behavior.
- Request updated files only when the available source is missing, outdated, or insufficient.
- Keep game source changes separate from extension implementation changes.
