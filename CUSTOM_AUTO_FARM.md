# Custom Auto Farm thử nghiệm

## Bật trong một tab

Custom Farm là chế độ so sánh tùy chọn, mặc định không được chọn và không tự bật. Trong popup, chọn **Thử nghiệm · Custom Farm**, rồi bật Auto Farm bằng nút hoặc phím tắt Farm trong đúng tab game. Khi đổi giữa các chế độ Farm, Farm đang chạy sẽ dừng; hãy bật lại bằng tay trong tab mong muốn. Mở popup của tab đó để xem trạng thái như SEARCH, APPROACH, COMBAT, LOOT, RECOVERY, DEAD hoặc WAITING_FOR_DATA.

Lựa chọn chế độ mặc định và các bộ lọc đã lưu tiếp tục dùng hồ sơ Farm hiện có. Mỗi tab đang mở giữ chế độ Farm riêng; đổi chế độ trong popup áp dụng cho tab hiện tại, còn các tab đã mở khác giữ nguyên engine. Tab mới dùng chế độ mặc định đã lưu. Trạng thái đang chạy, quyền bật theo tay, hành động đang chờ và thống kê so sánh được giữ riêng trong từng tab. Một tab cùng tài khoản không tự bật Farm khi tab khác đổi chế độ hoặc bật Farm. Custom Farm không tự khôi phục sau reload/reconnect; cài đặt giữ Farm sau khi chết chỉ áp dụng trong phiên game hiện tại.

Các lựa chọn Tool hỗ trợ, Theo game gốc và Khóa Auto Farm vẫn có để so sánh và quay lại. Custom Farm dùng nút/shortcut gốc của Farm để thay đổi trạng thái nhưng chặn fallback quyết định của Auto Farm gốc trong chế độ thử nghiệm. Nó không thay đổi game bundle, sát thương, cooldown, tốc độ, gói tin hay xử lý phía server.

## Cách controller hoạt động

Một callback trong dispatcher dùng state machine OFF, PAUSED, SEARCH, APPROACH, COMBAT, LOOT, RECOVERY, DEAD và WAITING_FOR_DATA. Nó chỉ chọn actor đang có trong snapshot hiển thị, áp dụng bộ lọc mục tiêu đã cấu hình, phạm vi quanh điểm Farm ban đầu hoặc ranh giới map, rồi giữ mục tiêu còn hợp lệ cho tới khi bị loại hoặc có mục tiêu ưu tiên rõ ràng hơn. Tùy chọn cho phép mục tiêu người chơi vẫn cần được bật riêng.

Điều hướng dùng primitive route/clear của game cùng movement steering hiện có; callback không gọi native Auto Farm walk/pick/idle/update hoặc nhánh recovery gốc. Kỹ năng phải nằm trong danh sách đã mở khóa và được native cast kiểm tra lại tầm, tài nguyên, cooldown và trạng thái. Chỉ giữ một thao tác đang chờ; snapshot mới có thể cho thấy HP mục tiêu đổi, nhưng đó không chứng minh yêu cầu của client đã thành công. Vật phẩm chỉ được nhặt theo dữ liệu đang nhìn thấy, với số lần thử giới hạn; biến mất khỏi màn hình không được xem là xác nhận nhặt thành công.

Thao tác di chuyển/đánh tay, thiền tay, scene hoặc danh tính chưa xác nhận sẽ tạm dừng controller. Hồi phục không tự thiền: khi HP thấp, controller có thể lùi về điểm bắt đầu trong tối đa 10 giây, sau đó chờ ngưỡng HP hồi phục hoặc Auto Potion hiện có. Hồi sinh vẫn dùng kiểm tra giới hạn sẵn có. Cài đặt giữ Farm sau khi chết được tôn trọng trong phiên; Custom Farm không tự bật lại sau khi trang/scene khởi động lại.

Các owner hiện có cho an toàn boss, tự vệ, phong ấn, Auto Quest, map travel, Auto Potion, Auto Flight và Harvest được giữ trong vai trò riêng. Navigation của Quest/Map/Seal/Harvest dùng adapter route của extension khi Custom Farm được chọn. Nếu controller hoặc dispatcher không tương thích, bật Farm bị từ chối và trạng thái báo lý do; nó không chuyển ngầm sang native Farm.

## Thống kê so sánh theo tab

Trong popup của tab đang thử, bật **Ghi thống kê so sánh Custom Farm trên tab này**. Bản ghi giới hạn lưu trong sessionStorage riêng của tab và thay thế bản ghi trước đó của tab. Thống kê gồm thời gian chạy, tạm dừng, kẹt, số lần chết quan sát và mục tiêu có cờ chết rõ trong snapshot. XP/phút ghi không khả dụng vì không có nguồn XP đã xác minh trong luồng này; tiêu thụ potion ghi không thể quy kết vì Auto Potion là owner riêng. Không xem hành động client hoặc actor biến mất là kết quả máy chủ xác nhận.

## Quy trình so sánh thủ công

1. Chọn cùng nhân vật, map/khu vực, trang bị, thời lượng và bộ lọc Farm cho mỗi lượt.
2. Chạy một lượt bằng chế độ hiện tại bạn muốn so sánh (Tool hỗ trợ hoặc Theo game gốc); ghi thời lượng và các số liệu có nguồn rõ.
3. Dừng Farm, chọn Custom Farm, rồi bật Farm trực tiếp trong cùng tab. Chạy cùng thời lượng và không đổi nhân vật, khu vực, trang bị hay bộ lọc.
4. So sánh thời gian chạy/tạm dừng/kẹt, số lần chết và mục tiêu chết quan sát được. Ghi XP hoặc potion là không khả dụng/không thể quy kết nếu không có nguồn xác minh.
5. Lặp lại nếu cần; chỉ kết luận về hiệu quả sau khi có số đo gameplay đủ so sánh.

Implementation này mới được rà source và diff; runtime/gameplay chưa được xác minh. Không có kết luận rằng Custom Farm nhanh hoặc hiệu quả hơn.
