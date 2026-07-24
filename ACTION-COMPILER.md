# Action compiler guide

This document guides the server-side agent that transforms a test case's
`qaDescription` into structured `actions` before the case is sent to the MyTV
Auto Test app.

The app executes structured actions. It does not execute server-provided code,
selectors, module paths, or function names. The existing app-side compiler is a
backward-compatible fallback for local or older cases, but new server responses
should contain explicit `actions`.

## Transformation contract

The input case keeps its existing metadata. Add an `actions` array generated
from `qaDescription`:

```json
{
  "id": "12092",
  "name": "Kiểm tra tìm kiếm nội dung",
  "qaDescription": "B1. Đăng nhập vào app với tài khoản ts1/111222\nB2. Vào trang chủ app\nB3. Vào trang tìm kiếm nội dung\nB4. Tìm phim \"Căn phòng tử thần\"\nB5. Play phim tìm được",
  "actions": [
    {"action": "login", "username": "ts1", "password": "111222"},
    {"action": "open_home"},
    {"action": "open_search"},
    {"action": "search_content", "name": "Căn phòng tử thần", "type": "movie"},
    {"action": "play_search_result", "type": "movie"}
  ]
}
```

If `actions` is present and non-empty, it is authoritative. The executor does
not also interpret `qaDescription`. Preserve `qaDescription` for display and
traceability, but do not require the app to compile it again.

## Compilation algorithm

For each non-empty line, in order:

1. Remove only the optional step prefix, such as `B1.`, `B2.`, or `B12.`.
2. Keep the original line for diagnostics and preserve the original
   human-readable values for names, services, and credentials.
3. Create a matching copy by:
   - lowercasing;
   - removing Vietnamese accents;
   - mapping `đ`/`Đ` to `d`;
   - normalizing repeated whitespace.
4. Match the normalized line against the supported command grammar below.
5. Emit exactly one structured action for the line.
6. Validate the complete action list before sending the case.

Do not silently skip a line. If a line is unsupported, malformed, or matches
more than one grammar, reject the whole transformation with the case ID, line
number, and original line. Do not send a partially compiled action list.

The content `name` sent in an action should remain human-readable, for example
`"Căn phòng tử thần"`. The runtime search helper normalizes it to lowercase
ASCII (`"can phong tu than"`) before entering the virtual keyboard.

## Action grammar and output

### Login

Supported forms include:

```text
Đăng nhập vào app với tài khoản ts1/111222
Đăng nhập tài khoản ts1/111222
Đăng nhập tài khoản gói VIP MAX: tên TK 0913476477, pass 0913476477
Đăng nhập tài khoản OPEN MAX 0913476477 pass 0913476477
```

Output:

```json
{"action":"login","username":"ts1","password":"111222"}
```

The account format may be `username/password`, labeled `tên TK ..., pass ...`,
or may place a package name between `tài khoản` and the username. Package or
subscription wording is ignored; only the username and password are emitted.
Credentials are sensitive and must not be written to logs or failure
messages.

### Home and service navigation

```text
Vào trang chủ
Vào trang chủ app
Vào home
```

```json
{"action":"open_home"}
```

The home action also accepts `Vào màn hình trang chủ ứng dụng` and equivalent
`app` wording.

```text
Vào dịch vụ kênh
Vào dịch vụ phim truyện
```

Output:

```json
{"action":"open_service","service":"kênh"}
{"action":"open_service","service":"phim truyện"}
```

Preserve the service value from the original line. For `service: "kênh"`, the
runtime searches both `kênh` and the alias `Truyền hình`, because the app may
label the television service as `Truyền hình`. Service lookup is fuzzy and
Vietnamese-normalized by the runtime.

There are two supported ways to enter a service:

1. Use the left menu directly, or open `Tất cả dịch vụ` from the left menu and
   choose the service. This is represented by `open_service`.
2. On Home, focus the `Thể loại` row, focus the requested service item, and
   press OK. This is represented by `focus_row`, `focus_text`, and `press_ok`.

The Home row is located from its visible heading and nearby service items. Do
not depend on a generated row ID because it can change between renders.

### Focus a named control and press OK

To focus the first poster/content item in a named Home row, use:

```text
Di chuyển đến focus vào poster đầu tiên của mục "Thịnh hành"
Di chuyển đến dòng cate: "Kênh đề xuất"
Di chuyển đến dòng cate "Thể loại"

This focuses the named row visible on the current page; it does not open a
different service or page before searching for the row.
```

Output:

```json
{"action":"focus_row","rowName":"Thịnh hành"}
```

The runtime locates the visible row/category using Vietnamese-normalized
matching, then focuses and verifies its first poster. It does not focus the
category title itself.

To focus a numbered poster in a named row, category, or subcategory, emit
`focus_row` with a 1-based `itemIndex`:

```text
Di chuyển focus vào poster kênh thứ 4 của dòng subcate "HTV"
Di chuyển focus vào poster phim thứ 2 của dòng cate "Phim song song"
Di chuyển focus vào poster nội dung thứ 3 của dòng hàng cate "Đề xuất"
```

```json
{"action":"focus_row","rowName":"HTV","itemIndex":4}
{"action":"focus_row","rowName":"Phim song song","itemIndex":2}
{"action":"focus_row","rowName":"Đề xuất","itemIndex":3}
```

`itemIndex` is a positive 1-based index. The runtime finds the named row and
focuses that visible poster directly; it fails with the row name and available
item count when the requested position is not visible. The content words
`kênh`, `phim`, and `nội dung` are descriptive only.

To move to the first item on the currently active row, use:

```text
Di chuyển focus đến 1 kênh đầu tiên bên trái
```

The content type wording (`kênh`, `phim`, or `nội dung`) is descriptive; the
runtime focuses the leftmost item regardless of its actual content type.

Output:

```json
{"action":"focus_row_first_item"}
```

The following all map to the same remote OK action:

```text
Bấm phím OK
Chọn phím OK
Nhấn phím OK
Bấm enter
Chọn enter
Nhấn enter
```

Output:

```json
{"action":"press_ok"}
```

Supported form:

```text
Di chuyển đến focus vào nút "Xem ngay" của 1 trailler trang chủ bất kỳ
```

Output:

```json
{"action":"focus_text","text":"Xem ngay"}
```

The runtime uses the existing remote-focus navigation to focus the visible
control whose text matches the requested label. The server provides text only;
it does not provide selectors or executable behavior.

Supported OK forms include:

```text
Nhấn chọn OK
Nhấn OK
Chọn OK
```

Output:

```json
{"action":"press_ok"}
```

`press_ok` sends the remote Enter key after the preceding focus action.

### Open global search

All of these forms map to the same action:

```text
Vào tìm kiếm
Vào trang tìm kiếm
Vào trang tìm kiếm nội dung
```

Output:

```json
{"action":"open_search"}
```

The runtime opens the app's global search page through the left menu.

### Search content

Supported forms:

```text
Tìm phim "Căn phòng tử thần"
Tìm kiếm phim "Căn phòng tử thần"
Tìm nội dung "Tin tức"
Tìm kênh "VTV1 HD"
Search movie "Dune"
```

Output type mapping:

| Source type | Action type |
| --- | --- |
| `phim` / `movie` | `movie` |
| `kênh` / `channel` | `channel` |
| `nội dung` / `content` | `content` |

Examples:

```json
{"action":"search_content","name":"Căn phòng tử thần","type":"movie"}
{"action":"search_content","name":"VTV1 HD","type":"channel"}
```

At runtime this action enters the normalized name character by character using
the on-screen virtual keyboard, focuses `#callSearch`, activates it, waits
three seconds, and focuses the best similar visible result in the result rows.

### Play a named visible item

Supported forms:

```text
Phát phim "Dune"
Play phim "Dune"
Phát kênh "VTV1 HD"
Phát nội dung "Tin tức"
```

Output:

```json
{"action":"play_content","name":"Dune","type":"movie"}
{"action":"play_content","name":"VTV1 HD","type":"channel"}
{"action":"play_content","name":"Tin tức","type":"content"}
```

This searches only the currently visible content rows. It must not be
implemented as a global content search.

### Play the result found by search

Supported forms:

```text
Phát phim tìm được
Play nội dung tìm được
Phát kênh vừa tìm
```

Output:

```json
{"action":"play_search_result","type":"movie"}
{"action":"play_search_result","type":"content"}
{"action":"play_search_result","type":"channel"}
```

This action plays the result currently focused by the preceding
`search_content` action. It should not be emitted without a preceding search
flow unless the case explicitly establishes the focused result.

### Play items from a category row

Supported forms include both the short content type and the longer wording
with `nội dung` before `phim` or `kênh`:

```text
Phát toàn bộ nội dung của hàng cate thứ 2
Play 4 nội dung phim của hàng cate thứ 2
Phát 3 nội dung kênh của hàng cate thứ 1
Play tất cả phim của hàng cate "Phim song song"
Phát 2 kênh của hàng cate "VTV"
```

Output rules:

- `toàn bộ` or `tất cả` means omit `count`.
- A positive number becomes `count`.
- `hàng cate thứ y` becomes `rowIndex: y`, using a 1-based index.
- `hàng cate "Cate name"` becomes `rowName: "Cate name"`.
- The words `nội dung`, `phim`, and `kênh` describe the source text only;
  `play_row` does not emit a `type` field.

Examples:

```json
{"action":"play_row","rowIndex":2}
{"action":"play_row","rowIndex":2,"count":4}
{"action":"play_row","rowIndex":1,"count":3}
{"action":"play_row","rowName":"Phim song song"}
{"action":"play_row","rowName":"VTV","count":2}
```

The runtime navigates and plays visible items in that row, returns to the row
after each item, and continues after an individual playback failure. The
action is failed if one or more requested items fail or if no item plays
successfully; the report retains each failed item's name, poster, and
screenshot when available.

### Back navigation

```text
Quay lại
Quay về
Nhấn back
```

Output:

```json
{"action":"press_back"}
```

For repeated back presses, prefer explicit actions or add a validated
`count`:

```json
{"action":"press_back","count":2}
```

### Readiness waits

Supported forms:

```text
Chờ app
Chờ home
Chờ content
Chờ player
```

Output:

```json
{"action":"wait_for_ready","name":"app"}
{"action":"wait_for_ready","name":"home"}
{"action":"wait_for_ready","name":"content"}
{"action":"wait_for_ready","name":"player"}
```

## Validation rules

Every emitted action must use only this allowlist:

```text
login
open_home
focus_row
focus_row_first_item
focus_text
press_ok
open_service
open_search
search_content
play_content
play_search_result
play_row
assert_screen
press_back
wait_for_ready
```

`assert_screen` is currently an explicit-action-only capability in the app
fallback grammar. If the server wants to emit it, construct and validate the
action directly rather than attempting to infer it from an arbitrary sentence.

Required fields:

| Action | Required fields | Optional fields |
| --- | --- | --- |
| `login` | `username`, `password` | — |
| `open_home` | — | — |
| `focus_row` | `rowName` | `itemIndex` (positive 1-based index) |
| `focus_row_first_item` | — | — |
| `focus_text` | `text` | — |
| `press_ok` | — | — |
| `open_service` | `service` | — |
| `open_search` | — | — |
| `search_content` | `name`, `type` | — |
| `play_content` | `name`, `type` | — |
| `play_search_result` | — | `type` |
| `play_row` | exactly one of `rowIndex`, `rowName` | `count` |
| `assert_screen` | `text` | — |
| `press_back` | — | `count` |
| `wait_for_ready` | `name` | — |

Additional constraints:

- `type` is one of `channel`, `movie`, or `content`.
- `rowIndex` is a positive 1-based integer.
- `count`, when present on `play_row`, is a positive integer.
- `press_back.count`, when present, is a non-negative integer.
- `rowName`, `service`, and content names must be non-empty strings.
- `focus_row.itemIndex`, when present, is a positive 1-based integer.
- Do not add fields such as `selector`, `module`, `handler`, `function`, or
  executable code.

## Failure behavior

Reject the transformation with a machine-readable error containing:

```text
case id
line number
original line
reason: unsupported, malformed, or ambiguous
```

Examples:

```text
Không thể parse được bước: B4. Thao tác không được hỗ trợ
Test case 12092 line B3 is ambiguous: ...
```

The parser failure text is attached to the failed `compile` step and shown as
the failed reason in the compact user report.

Do not convert an uncertain sentence into the nearest action. If the server
needs a new sentence form, add a deterministic grammar rule and regression
tests, then version the compiler.

## Recommended server response

Return the original case metadata plus explicit actions:

```json
{
  "id": "12090",
  "name": "Kiểm tra play phim truyện",
  "qaDescription": "B1. Đăng nhập vào app với tài khoản ts1/111222\nB2. Vào trang chủ app\nB3. Vào dịch vụ phim truyện\nB4. Play 4 nội dung phim của hàng cate thứ 2",
  "actions": [
    {"action":"login","username":"ts1","password":"111222"},
    {"action":"open_home"},
    {"action":"open_service","service":"phim truyện"},
    {"action":"play_row","rowIndex":2,"count":4}
  ],
  "expectedResult": "Nội dung play thành công"
}
```

The app then validates the action list and dispatches each action through its
registered handler. The server compiler is responsible for language parsing;
the app remains responsible for TV focus navigation, virtual-keyboard input,
visible-row matching, playback checks, waits, and failure artifacts.
