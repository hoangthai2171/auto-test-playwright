# Action compiler guide

This guide is for the server-side transformer that turns a case's
`qaDescription` into validated `actions` before delivery to MyTV Auto Test.

## Contract

Prefer explicit actions in every server response. A non-empty `actions` array is
authoritative; the app preserves `qaDescription` for display and does not parse
it again. The app-side compiler is only a backward-compatible fallback for
cases with missing, null, or empty `actions`.

Server data may contain structured values only. Never send selectors, module or
function names, handlers, executable code, or other instructions for the app to
evaluate.

Example:

```json
{
    "id": "12092",
    "name": "Kiểm tra tìm kiếm nội dung",
    "qaDescription": "B1. Đăng nhập vào app với tài khoản ts1/111222\nB2. Vào trang chủ app\nB3. Vào trang tìm kiếm nội dung\nB4. Tìm phim \"Căn phòng tử thần\"\nB5. Play phim tìm được",
    "actions": [{"action": "login", "username": "ts1", "password": "111222"}, {"action": "open_home"}, {"action": "open_search"}, {"action": "search_content", "name": "Căn phòng tử thần", "type": "movie"}, {"action": "play_search_result", "type": "movie"}]
}
```

## Deterministic conversion

For each non-empty line, in order:

1. Remove only an optional prefix such as `B1.`, `B2.`, or `B12.`.
2. Keep the original line for errors and preserve original names, services, and
   credentials in the emitted action.
3. Create a matching form by lowercasing, removing Vietnamese accents, mapping
   `đ`/`Đ` to `d`, and normalizing whitespace.
4. Match exactly one supported grammar and emit exactly one action.
5. Validate the complete action list before sending it.

Reject the whole case when a line is unsupported, malformed, or ambiguous. The
error must include the case ID, line number, original line, and a reason
(`unsupported`, `malformed`, or `ambiguous`). Never skip a line or send a
partial action list. A line must contain one command; for example, a service
command followed by `và`, `rồi`, `sau đó`, a comma, or another command is
ambiguous.

Search names remain human-readable in actions. The runtime normalizes them to
ASCII and enters them character by character through the virtual keyboard.

### Login credentials

Recognize `username/password`, `tên TK <username>, pass <password>`, and the
same labeled form with `tài khoản` or `mật khẩu`. Package/subscription wording
between `tài khoản` and the credentials is ignored:

```text
Đăng nhập vào app với tài khoản ts1/111222
Đăng nhập tài khoản gói VIP MAX: tên TK 0913476477, pass 0913476477
Đăng nhập tài khoản OPEN MAX 0913476477 pass 0913476477
```

Emit only:

```json
{"action": "login", "username": "ts1", "password": "111222"}
```

If a line clearly requests login but lacks a complete pair, resolve it only
from `preCondition`. Login-line credentials win; `preCondition` must contain
exactly one complete supported pair. Do not infer credentials from the case
name, expected result, other metadata, or partial values. If no unambiguous
pair exists, reject the line; never emit missing credentials. Credentials must
not appear in logs or failure messages. The app runtime does not read
`preCondition` itself.

## Supported source grammar

The words `phim`, `kênh`, and `nội dung` are descriptive where noted; preserve
human-readable values from the source.

| Action                 | Supported source form                                                                                                                                                                 | Emit / notes                                                                                                                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `open_home`            | `Vào trang chủ`, `Vào trang chủ app/ứng dụng`, `Vào màn hình trang chủ ứng dụng`, `Vào home`                                                                                          | `{"action":"open_home"}`                                                                                                                                                                                            |
| `open_service`         | `Vào dịch vụ <service>`                                                                                                                                                               | Preserve `<service>`. `kênh` also searches the runtime alias `Truyền hình`.                                                                                                                                         |
| `focus_row`            | `Di chuyển đến dòng cate/subcate/row "<row>"`; `Di chuyển đến focus vào poster đầu tiên của mục/hàng cate/row "<row>"`; or `Di chuyển ... poster <type> thứ <n> của dòng ... "<row>"` | `{"action":"focus_row","rowName":"<row>"}`; add positive 1-based `itemIndex: n` for a numbered poster.                                                                                                              |
| `focus_row_first_item` | `Di chuyển focus đến ... đầu tiên bên trái` (including the current `subcate` row)                                                                                                     | Focuses the leftmost item in the active row, regardless of stated content type.                                                                                                                                     |
| `focus_text`           | `Focus vào mục/item "<text>"`; `Di chuyển [đến] [và] focus vào mục/item "<text>"`; or `Di chuyển đến focus vào nút "Xem ngay" của 1/một trailer/trailler trang chủ bất kỳ`                                                                | `{"action":"focus_text","text":"<text>"}`. After `focus_row` on Home's `Thể loại` row, scan reachable service posters; for `Xem tất cả`, `Xem thêm`, or `View more`, focus the row's trusted view-more poster; never fall back to a same-named left-menu item.                                              |
| `press_ok`             | `Bấm/Chọn/Nhấn [phím] OK` or `Bấm/Chọn/Nhấn [phím] enter`                                                                                                                             | `{"action":"press_ok"}`. After a Home service poster, activation must pass the service-result check below.                                                                                                          |
| `open_search`          | `Vào tìm kiếm`, `Vào trang tìm kiếm`, `Vào trang tìm kiếm nội dung`                                                                                                                   | `{"action":"open_search"}`                                                                                                                                                                                          |
| `search_content`       | `Tìm/Tìm kiếm/Search <phim\|movie\|kênh\|channel\|nội dung\|content> "<name>"`                                                                                                        | Emit `search_content` with `type: movie\|channel\|content`. The runtime searches visible results after virtual-keyboard entry.                                                                                      |
| `play_content`         | `Phát/Play <phim\|kênh\|nội dung> "<name>"`                                                                                                                                           | Emit `play_content` with the original name and mapped type. This targets a currently visible item; it is not global search.                                                                                         |
| `play_search_result`   | `Phát/Play <type> tìm được/vừa tìm/tìm thấy`                                                                                                                                          | Emit `play_search_result` with the mapped type. Use after `search_content` unless the case explicitly establishes the focused result.                                                                               |
| `play_row`             | `Phát/Play <n\|tất cả\|toàn bộ> [nội dung] [phim\|kênh] của hàng cate thứ <rowIndex>` or `... hàng cate "<rowName>"`                                                                  | Emit `play_row`; `n` becomes `count`, `tất cả`/`toàn bộ` omits it, and the row selector is exactly one of `rowIndex` or `rowName`. Do not emit `type`. On Home, numeric indexes exclude the single promotional row. |
| `play_home_trailers`   | `Chạy/Phát/Play (toàn bộ\|tất cả\|các) (trailer\|trailler) (ở\|trên\|tại) (trang chủ\|Home)`                                                                                          | `{"action":"play_home_trailers"}`. Browser-only; no fixed count.                                                                                                                                                    |
| `assert_screen`        | No fallback sentence grammar                                                                                                                                                          | Explicit-action-only: emit `{"action":"assert_screen","text":"..."}` when the server already has a direct assertion.                                                                                                |
| `press_back`           | `Quay lại`, `Quay về`, `Nhấn back`                                                                                                                                                    | `{"action":"press_back"}`. Use explicit `count` for repeats.                                                                                                                                                        |
| `wait_for_ready`       | `Chờ app`, `Chờ home`, `Chờ content`, `Chờ player`                                                                                                                                    | Emit `wait_for_ready` with the corresponding `name`.                                                                                                                                                                |

Rows are located on the current page by visible headings/content and fuzzy
Vietnamese matching, not generated row IDs; focusing a row does not open a new
service or page. Direct `open_service` uses the left menu or its `Tất cả dịch
vụ` fallback, while Home category entry is `focus_row` → `focus_text` →
`press_ok`. `focus_row.itemIndex` is a reachable 1-based poster index;
the runtime scrolls horizontally and fails with the furthest reachable index if
the row ends first. `play_row` returns to the row after each item, continues
after individual playback failures, reports every attempted item, and fails if
any requested item fails or none succeeds.

### View-more posters

The exact labels `Xem tất cả`, `Xem thêm`, and `View more` are special only
when their `focus_text` action immediately follows a successful `focus_row`.
The Browser runner uses remote horizontal navigation to focus the last poster
whose trusted DOM marker is `.view_more[item_view_more="1"]`; it does not
depend on `content_name`, which is commonly blank. If the row cannot reach
that marker, the focus step fails and the runner does not press Enter on an
unrelated poster or control.

The following action sequence is the supported form:

```json
[
  {"action":"focus_row","rowName":"Phim mới nhất"},
  {"action":"focus_text","text":"Xem tất cả"},
  {"action":"press_ok"}
]
```

After Enter, the runner accepts either a row-content grid or a service screen
only after it observes a non-Home route with visible content rows. A visible
bottom-right tooltip/toast, recognized no-data/error popup, or unchanged Home
screen fails the activation. Use an expected result such as
`Vào item "Xem tất cả" bình thường` when the case needs the final
`view_more` destination assertion.

### Service success

Opening or focusing a service is not sufficient by itself. Every service or
category case must retain a service assertion in `expectedResult`, such as:

```text
Vào chuyên mục "TV xem lại" bình thường
Mở dịch vụ "Thiếu nhi" thành công
Vào màn hình dịch vụ Phim truyện thành công
```

If that assertion is the final `qaDescription` line, copy the exact line to
`expectedResult`; do not compile it as another `open_service` or `press_ok`.
After activation, the runtime requires a non-Home destination with visible
content rows and rejects a visible auto-hide toast/tooltip or no-data/error
popup. A focused poster or successful OK press alone is not success.

### Home trailers

`play_home_trailers` reads trusted Home promo titles, activates each `Xem ngay`
control through remote navigation, captures a post-activation screenshot, and
returns Home until the carousel ends or cycles. Healthy video is `playable`; a
visible Album detail list is `album_opened`; all other outcomes are `failed`.
The runtime retains each trailer's name, status, activation type, and
screenshot. Internal markers such as `#promo-video-next` are app-owned and must
never be supplied by server data.

## Action validation

Allowed actions:

```text
login, open_home, focus_row, focus_row_first_item, focus_text, press_ok,
open_service, open_search, search_content, play_content, play_search_result,
play_row, play_home_trailers, assert_screen, press_back, wait_for_ready
```

| Action                                                                               | Required fields                      | Optional fields |
| ------------------------------------------------------------------------------------ | ------------------------------------ | --------------- |
| `login`                                                                              | `username`, `password`               | —               |
| `open_home`, `focus_row_first_item`, `press_ok`, `open_search`, `play_home_trailers` | —                                    | —               |
| `focus_row`                                                                          | `rowName`                            | `itemIndex`     |
| `focus_text`, `assert_screen`                                                        | `text`                               | —               |
| `open_service`                                                                       | `service`                            | —               |
| `search_content`, `play_content`                                                     | `name`, `type`                       | —               |
| `play_search_result`                                                                 | —                                    | `type`          |
| `play_row`                                                                           | exactly one of `rowIndex`, `rowName` | `count`         |
| `press_back`                                                                         | —                                    | `count`         |
| `wait_for_ready`                                                                     | `name`                               | —               |

Additional constraints:

- `type` is `channel`, `movie`, or `content`.
- `rowIndex`, `itemIndex`, and `count` are positive integers; `press_back.count`
  is a non-negative integer.
- `name`, `rowName`, `service`, `text`, `username`, and `password` are non-empty
  strings where used.
- Reject unknown fields, including `selector`, `module`, `handler`, `function`,
  and executable code.

## Ownership and failure behavior

The server owns language parsing and action validation. The app owns remote
focus navigation, virtual-keyboard input, visible-row matching, playback and
service checks, waits, cleanup, and failure artifacts.

On any compiler failure, return a machine-readable error with the case ID,
source line number, original line, and `unsupported`, `malformed`, or
`ambiguous` reason. Do not guess a nearby action. Adding a new sentence form
requires a deterministic grammar rule and regression coverage before it is
used in server responses.
