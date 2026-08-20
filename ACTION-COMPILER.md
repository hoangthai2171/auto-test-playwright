# Hướng dẫn biên dịch action

Tài liệu cho transformer phía server: chuyển `qaDescription` thành `actions`
hợp lệ trước khi gửi cho MyTV Auto Test.

## Hợp đồng bắt buộc

- Ưu tiên `actions` tường minh. Mảng không rỗng là nguồn sự thật; app chỉ giữ
  `qaDescription` để hiển thị và không phân tích lại. Bộ biên dịch trong app
  chỉ fallback khi `actions` thiếu, `null` hoặc rỗng.
- Dữ liệu server chỉ chứa giá trị có cấu trúc; không gửi selector, tên
  module/function/handler, mã thực thi hoặc chỉ dẫn để app tự đánh giá.
- **AI Agent chỉ được phân tích thành action có trong mục “Danh sách action cho
  phép”. Không được parse, tạo, suy đoán, đổi tên hoặc phát sinh action ngoài
  danh sách. Câu không khớp phải bị từ chối; không đoán, bỏ dòng hoặc gửi danh
  sách một phần.**

## Chuyển đổi xác định

Với từng dòng không rỗng, theo thứ tự: (1) chỉ bỏ tiền tố tùy chọn như `B1.`;
(2) giữ dòng gốc để báo lỗi và giữ nguyên tên, dịch vụ, credential;
(3) viết thường, bỏ dấu, đổi `đ`/`Đ` thành `d`, chuẩn hóa khoảng trắng;
(4) khớp chính xác một grammar được hỗ trợ và phát sinh action theo grammar đó;
(5) validate toàn bộ danh sách trước khi gửi.

Nếu dòng `unsupported`, `malformed` hoặc `ambiguous`, từ chối cả testcase. Lỗi
phải có `case ID`, số dòng, dòng gốc và lý do. Mỗi dòng chỉ có một lệnh; lệnh
nối bằng `và`, `rồi`, `sau đó`, dấu phẩy hoặc lệnh khác là mơ hồ. Một lệnh phát
sinh đúng một action, trừ đúng một ngoại lệ đã được khai báo: dòng “bấm/chọn vào
poster/item” là một lệnh remote gồm focus và OK nên phát sinh `focus_text` +
`press_ok` (xem bảng grammar). Tên tìm kiếm giữ dạng dễ đọc; runtime chuẩn hóa
ASCII và nhập từng ký tự bằng bàn phím ảo.

### Credential đăng nhập

Hỗ trợ `username/password`, `tên TK <username>, pass <password>` và dạng gắn
nhãn với `tài khoản`/`mật khẩu`; nội dung gói thuê bao giữa `tài khoản` và
credential được bỏ qua:

```text
Đăng nhập vào app với tài khoản ts1/111222
Đăng nhập tài khoản gói VIP MAX: tên TK 0913476477, pass 0913476477
```

Phát sinh `{"action":"login","username":"ts1","password":"111222"}`.
Nếu dòng đăng nhập thiếu cặp đầy đủ, chỉ được lấy từ `preCondition`; credential
trong dòng thắng và `preCondition` phải có đúng một cặp được hỗ trợ. Không suy
ra từ tên testcase, `expectedResult`, metadata khác hoặc giá trị thiếu; không
rõ thì từ chối. Credential không được xuất hiện trong log/lỗi; runtime app
không tự đọc `preCondition`.

## Grammar nguồn được hỗ trợ

Giữ nguyên giá trị dễ đọc từ nguồn. `phim`, `kênh`, `nội dung` chỉ là từ mô tả
ở các dòng phù hợp.

| Action | Dạng câu nguồn | Kết quả / giới hạn |
| --- | --- | --- |
| `open_home` | `Vào trang chủ`, `Vào trang chủ app/ứng dụng`, `Vào màn hình trang chủ ứng dụng`, `Vào home` | `{"action":"open_home"}` |
| `open_service` | `Vào dịch vụ <service>` | Giữ service; `kênh` tìm alias `Truyền hình`. |
| `focus_row` | `Di chuyển đến dòng cate/subcate/row "<row>"`; `... focus vào poster đầu tiên ... "<row>"`; hoặc `... poster <type> thứ <n> ... "<row>"` | `rowName`; câu có số thêm `itemIndex` dương, 1-based. |
| `focus_row_first_item` | `Di chuyển focus đến ... đầu tiên bên trái` (kể cả `subcate` hiện tại) | Focus item trái nhất của row hiện tại, không phụ thuộc loại nội dung. |
| `focus_text` | `Focus vào mục/item "<text>"`; `Di chuyển [đến] [và] focus vào mục/item "<text>"`; hoặc focus nút `Xem ngay` của trailer Home | `text`; sau `focus_row` ở row `Thể loại`, quét poster dịch vụ. `Xem tất cả`, `Xem thêm`, `View more` dùng poster view-more tin cậy, không fallback menu trái. |
| `focus_text` (+ `press_ok`) | `Bấm/Chọn/Nhấn vào mục/item/poster "<text>"` | Phát sinh `focus_text`; thêm `press_ok` trừ khi dòng kế tiếp đã là lệnh OK, để không Enter hai lần. |
| `press_ok` | `Bấm/Chọn/Nhấn [phím] OK` hoặc `enter` | `{"action":"press_ok"}`; poster dịch vụ Home phải qua kiểm tra activation. |
| `open_search` | `Vào tìm kiếm`, `Vào trang tìm kiếm`, `Vào trang tìm kiếm nội dung` | `{"action":"open_search"}` |
| `search_content` | `Tìm/Tìm kiếm/Search <phim\|movie\|kênh\|channel\|nội dung\|content> "<name>"` | `type` là `movie`, `channel` hoặc `content`; tìm sau khi nhập bàn phím ảo. |
| `play_content` | `Phát/Play <phim\|kênh\|nội dung> "<name>"` | Giữ tên gốc và type; chỉ item đang hiển thị, không tìm kiếm toàn cục. |
| `play_search_result` | `Phát/Play <type> tìm được/vừa tìm/tìm thấy` | Có thể kèm `type`; dùng sau `search_content` nếu chưa xác lập result. |
| `play_row` | `Phát/Play <n\|tất cả\|toàn bộ> [nội dung] [phim\|kênh] của hàng cate thứ <rowIndex>` hoặc `... hàng cate "<rowName>"` | `<n>` thành `count`; `tất cả`/`toàn bộ` bỏ count; đúng một row selector, không `type`; index Home bỏ row quảng bá. |
| `play_all_contents` | `Phát/Play/Chạy <toàn bộ\|tất cả> [nội dung\|poster\|phim\|kênh] trong/ở/tại/của [trang] danh sách`; `... <n> dòng [đầu tiên] trong danh sách`; `... <n> <poster\|nội dung> [đầu tiên] trong danh sách` | Không tham số = phát hết trang danh sách; `<n> dòng` thành `rowCount`; `<n> poster/nội dung` thành `count`; không có row selector. |
| `play_home_trailers` | `Chạy/Phát/Play (toàn bộ\|tất cả\|các) (trailer\|trailler) (ở\|trên\|tại) (trang chủ\|Home)` | `{"action":"play_home_trailers"}`; chỉ Browser, không cố định số lượng. |
| `assert_screen` | Không có fallback grammar | Chỉ action tường minh từ server: `{"action":"assert_screen","text":"..."}`. |
| `press_back` | `Quay lại`, `Quay về`, `Nhấn back` | `{"action":"press_back"}`; lặp phải dùng `count`. |
| `wait_for_ready` | `Chờ app`, `Chờ home`, `Chờ content`, `Chờ player` | `name` tương ứng. |

## Quy tắc runtime cần giữ

- Tìm row bằng heading/content nhìn thấy và fuzzy matching tiếng Việt, không
  dùng row ID sinh động. `focus_row` không mở service/page. `open_service` dùng
  menu trái hoặc fallback `Tất cả dịch vụ`; Home dùng
  `focus_row` → `focus_text` → `press_ok`.
- `focus_row.itemIndex` là poster 1-based có thể reach; runtime remote-cuộn và
  báo vị trí xa nhất nếu row kết thúc. `play_row` quay lại row sau mỗi item,
  tiếp tục sau lỗi, báo mọi item đã thử và fail nếu item yêu cầu fail hoặc
  không item nào thành công.
- `Xem tất cả`, `Xem thêm`, `View more` chỉ đặc biệt khi đứng ngay sau
  `focus_row` thành công. Browser tới poster cuối có marker
  `.view_more[item_view_more="1"]`; không reach thì fail closed, không Enter lên
  control khác. Sau Enter phải thấy route không phải Home và row nội dung;
  tooltip/toast, popup no-data/error hoặc Home không đổi đều fail. Assertion có
  thể đặt ở `expectedResult`, ví dụ `Vào item "Xem tất cả" bình thường`.
- Mở/focus service chưa đủ thành công. Case service/category phải có assertion
  trong `expectedResult` (ví dụ `Mở dịch vụ "Thiếu nhi" thành công`). Nếu là
  dòng cuối `qaDescription`, sao chép nguyên dòng vào `expectedResult`, không
  compile thành `open_service`/`press_ok`. Activation cần destination ngoài
  Home có row nội dung và không có toast/tooltip tự ẩn hoặc popup lỗi.
- `play_all_contents` chỉ chạy trên trang danh sách nội dung mở từ poster view
  more, route phải là `specialModuleList`, `specialModuleListV2` hoặc `shortHome`;
  route khác (kể cả Home) fail closed. Riêng `channel-list` bị từ chối bằng lỗi
  riêng vì row/item của trang kênh có format khác và cần bài test khác. Runtime
  đi theo thứ tự đọc: từ trái sang phải trong một dòng, hết dòng thì xuống dòng
  dưới và về poster ngoài cùng bên trái. Trang danh sách detach dòng đã cuộn khỏi
  màn hình và gọi API load more khi focus xuống gần cuối, nên runtime bước bằng
  remote rồi đọc lại vị trí `<idName>_<row>_<col>`, thử lại phím bị bỏ trong lúc
  load more, và chỉ kết luận hết danh sách khi phím xuống không còn đổi dòng.
  Poster view more trong trang danh sách bị bỏ qua, không Enter. Mỗi poster đều
  có screenshot và trạng thái; lỗi một poster không dừng cả danh sách, action fail
  nếu có poster fail hoặc không poster nào phát được. `count`/`rowCount` là giới
  hạn duy nhất; không có giới hạn thời gian ngầm.
- `play_home_trailers` đọc title promo tin cậy, remote tới `Xem ngay`, chụp
  screenshot và quay Home đến khi hết/lặp. Video khỏe là `playable`, Album
  detail nhìn thấy là `album_opened`, còn lại `failed`; giữ tên, status, loại
  activation và screenshot. Marker như `#promo-video-next` là nội bộ app, không
  nhận từ server.

## Danh sách action cho phép và validate

Chỉ chấp nhận đúng 17 giá trị:

```text
login, open_home, focus_row, focus_row_first_item, focus_text, press_ok,
open_service, open_search, search_content, play_content, play_search_result,
play_row, play_all_contents, play_home_trailers, assert_screen, press_back,
wait_for_ready
```

| Action | Bắt buộc | Tùy chọn |
| --- | --- | --- |
| `login` | `username`, `password` | — |
| `open_home`, `focus_row_first_item`, `press_ok`, `open_search`, `play_home_trailers` | — | — |
| `focus_row` | `rowName` | `itemIndex` |
| `focus_text`, `assert_screen` | `text` | — |
| `open_service` | `service` | — |
| `search_content`, `play_content` | `name`, `type` | — |
| `play_search_result` | — | `type` |
| `play_row` | đúng một trong `rowIndex`, `rowName` | `count` |
| `play_all_contents` | — | nhiều nhất một trong `count`, `rowCount` |
| `press_back` | — | `count` |
| `wait_for_ready` | `name` | — |

`type` chỉ là `channel`, `movie`, `content`; `rowIndex`, `itemIndex`, `count`,
`rowCount` là số nguyên dương; `press_back.count` không âm.
`play_all_contents` không nhận cùng lúc `count` và `rowCount`, và không nhận
`rowIndex`/`rowName`. Các field tên, row, service,
text và credential phải là chuỗi không rỗng. Từ chối field lạ như `selector`,
`module`, `handler`, `function` và mọi mã thực thi.

## Phân công và lỗi

Server parse/validate; app xử lý remote focus, bàn phím ảo, row nhìn thấy,
playback/service, wait, cleanup và artifact lỗi. Mọi lỗi compiler phải dạng
machine-readable, gồm `case ID`, số dòng, dòng gốc và `unsupported`, `malformed`
hoặc `ambiguous`; không đoán action gần đúng. Dạng câu mới chỉ được dùng sau
grammar xác định và regression coverage, đồng thời phải cập nhật allowlist
trước khi xuất hiện trong response server.
