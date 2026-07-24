# API Testcase

- Domain tạm thời: `http://172.16.240.254:30100`
- Project ID ví dụ: `1`

## 1. Lấy cây thư mục testcase

```http
GET /api/v1/projects/{projectId}/flow-case-folders
```

API trả về cây thư mục nhiều cấp. Mỗi node gồm `id`, `parentId`, `name`, `fullPath` và `children`.

`fullPath` luôn là đường dẫn tuyệt đối: bắt đầu bằng `/` và không có khoảng trắng quanh dấu phân cách.

```json
{
  "id": "12",
  "parentId": "8",
  "name": "Play kênh",
  "fullPath": "/Test API kênh OTT/Play kênh",
  "children": []
}
```

Khi triển khai bản cập nhật này, chạy `php artisan migrate` để chuyển dữ liệu cũ từ dạng `A / B` sang `/A/B`.

## 2. Lấy testcase theo đường dẫn thư mục hoặc ID

```http
GET /api/v1/projects/{projectId}/flow-cases/by-folder
```

API lấy testcase theo `folderName` hoặc `testcaseId`, đồng thời lọc theo `environment` và có thể lọc thêm `status`. Khi dùng `folderName`, kết quả gồm testcase thuộc thư mục đích và toàn bộ thư mục con. Mỗi phần tử trong `data` có thêm `script` (nội dung `script_source` đã lưu), nhưng không trả `nodes` và `edges`.

| Query parameter | Bắt buộc | Mô tả |
| --- | --- | --- |
| `environment` | Có | `API` hoặc `UI`, không phân biệt hoa/thường. |
| `platform` | Không | Lọc theo `tv`, `phone` hoặc `web`; không phân biệt chữ hoa/thường. |
| `status` | Không | Lọc theo trạng thái testcase: `created`, `designing`, `scripting` hoặc `active`; không phân biệt chữ hoa/thường. |
| `folderName` | Một trong hai | Đường dẫn từ thư mục gốc, bắt buộc bắt đầu bằng `/`. |
| `testcaseId` | Một trong hai | ID testcase cần lấy. |

Ví dụ:

```http
GET /api/v1/projects/1/flow-cases/by-folder?folderName=%2FTest%20API%20k%C3%AAnh%20OTT%2FPlay%20k%C3%AAnh&environment=API
GET /api/v1/projects/1/flow-cases/by-folder?folderName=%2FTest%20API%20k%C3%AAnh%20OTT&environment=API
GET /api/v1/projects/1/flow-cases/by-folder?folderName=%2FTest%20API%20k%C3%AAnh%20OTT&environment=API&platform=PHONE
GET /api/v1/projects/1/flow-cases/by-folder?folderName=%2FBoundary&environment=API&status=designing
GET /api/v1/projects/1/flow-cases/by-folder?testcaseId=123&environment=UI
```

Quy tắc `folderName`:

- `/Test API kênh OTT/Play kênh`: lấy testcase trong `Play kênh` và các thư mục con.
- `/Test API kênh OTT`: lấy testcase trong folder gốc này và toàn bộ folder con.
- Thiếu dấu `/` đầu tiên hoặc có segment rỗng sẽ trả về `422`.

## 3. Lưu hàng loạt testcase theo thư mục

```http
POST  /api/v1/projects/{projectId}/flow-cases/bulk
PATCH /api/v1/projects/{projectId}/flow-cases/bulk
```

- `POST`: tạo nhiều testcase trong một thư mục.
- `PATCH`: cập nhật nhiều testcase và chuyển chúng vào một thư mục.
- Request phải gửi một trong `folderId`, `folderPath` hoặc `folderLink`. `folderPath` và `folderLink` dùng đúng giá trị `fullPath`.
- Toàn bộ request được kiểm tra folder, project và slug trước khi lưu trong một transaction.

### Payload tạo testcase

Mỗi phần tử trong `testcases` phải có đầy đủ các field của popup **Tạo Testcase mới**:

| Field | Bắt buộc | Mô tả |
| --- | --- | --- |
| `name` | Có | Tên testcase. |
| `preCondition` | Có key | Điều kiện; dùng chuỗi rỗng nếu chưa có nội dung. |
| `qaDescription` | Có key | Mô tả testcase; dùng chuỗi rỗng nếu chưa có nội dung. |
| `expectedResult` | Có key | Kết quả mong đợi; dùng chuỗi rỗng nếu chưa có nội dung. |
| `platform` | Có | Một trong `tv`, `phone`, `web`; nhận chữ hoa/chữ thường và luôn được lưu dạng chữ thường. |
| `environment` | Có | Một trong `API`, `UI`. |
| `slug` | Không | Nếu không gửi, backend tự sinh slug duy nhất từ `name`. |
| `mode` | Có cho testcase tích hợp | Gửi `script` khi tạo testcase để bên thứ ba có thể chạy script; nếu không gửi, backend mặc định `visual`. |
| `script` | Có khi `mode` là `script` và testcase cần chạy | Nội dung script testcase; hỗ trợ cho cả `POST` và `PATCH`. |
| `status` | Không | Vòng đời testcase: `created` (Đã tạo), `designing` (Đã mô tả), `scripting` (Tạo script), `active` (Active). Nếu không gửi, mặc định `created`. |

`folderPath` nằm ở request cấp ngoài nên tất cả testcase trong request được lưu vào cùng thư mục.
Response của cả `POST` và `PATCH` trả `data[].script` theo nội dung script đã lưu, nhưng không trả graph `nodes` và `edges`.

```json
{
  "folderPath": "/Test API kênh OTT/Play kênh",
  "testcases": [
    {
      "name": "Kiểm tra phát kênh",
      "preCondition": "Tài khoản đã đăng nhập và có quyền xem kênh.",
      "qaDescription": "Mở kênh OTT và chọn Play kênh.",
      "expectedResult": "Kênh phát thành công.",
      "platform": "web",
      "environment": "API",
      "mode": "script",
      "script": "return { ok: true }",
      "status": "designing"
    }
  ]
}
```

### Payload cập nhật testcase

`PATCH` yêu cầu `id` trong từng phần tử `testcases`; các field còn lại là cập nhật một phần.

```json
{
  "folderLink": "/Test API kênh OTT/Regression",
  "testcases": [
    {
      "id": 123,
      "name": "Kiểm tra phát kênh - cập nhật",
      "environment": "UI",
      "script": "return { ok: true, updated: true }"
    }
  ]
}
```

## 4. Yêu cầu tích hợp kết quả chạy testcase từ bên thứ ba

> Phần này là contract cần triển khai. API hiện tại chưa hỗ trợ `status: tested`,
> `PATCH` trên endpoint lấy theo thư mục, hay `testResult.message`.

Mục tiêu là dùng chung resource lấy testcase theo thư mục và gửi kết quả chạy:

```http
GET   /api/v1/projects/{projectId}/flow-cases/by-folder
PATCH /api/v1/projects/{projectId}/flow-cases/by-folder
```

### Lấy testcase cần chạy

Dùng query `status=designing` để bên thứ ba chỉ lấy các testcase **Đã mô tả**.
Response phải trả `mode: "script"` và `script` để bên thứ ba thực thi.

```http
GET /api/v1/projects/1/flow-cases/by-folder?folderName=%2FBoundary&environment=API&platform=web&status=designing
```

### Gửi kết quả chạy

`tested` là trạng thái vòng đời, nghĩa là testcase đã được chạy. Kết quả Pass/Fail
không dùng chung giá trị `status`, mà nằm trong `testResult`.

```json
{
  "folderPath": "/Boundary",
  "testcases": [
    {
      "id": 12074,
      "status": "tested",
      "testResult": {
        "status": "failed",
        "message": "Cannot use import statement outside a module",
        "passed": 0,
        "failed": 1,
        "finishedAt": "2026-07-20T10:30:00+07:00"
      }
    }
  ]
}
```

Ví dụ chạy thành công:

```json
{
  "id": 12074,
  "status": "tested",
  "testResult": {
    "status": "success",
    "message": "Testcase chạy thành công.",
    "passed": 1,
    "failed": 0
  }
}
```

Quy tắc contract:

- `status` của testcase bổ sung `tested` (Đã test).
- Khi `status` là `tested`, `testResult.status` là bắt buộc và chỉ nhận `success` hoặc `failed`.
- `message` là bắt buộc khi `testResult.status` là `failed`; khuyến nghị gửi cả khi thành công.
- Với `success`, `failed` phải bằng `0`; với `failed`, giá trị `failed` phải lớn hơn hoặc bằng `1`.
- Kết quả từng lần chạy được ghi vào `debug_runs` (bao gồm `passed`, `failed`, `message`), còn `flow_cases` giữ trạng thái vòng đời và thông tin lần chạy gần nhất (`last_run_status`, `last_run_at`, `last_run_id`).

## 5. Bộ trạng thái hiện tại

### Trạng thái vòng đời testcase

Lưu tại `flow_cases.status` và được API tạo/cập nhật testcase kiểm tra:

| Giá trị | Hiển thị | Ý nghĩa |
| --- | --- | --- |
| `created` | Đã tạo | Testcase mới tạo; là giá trị mặc định nếu không truyền `status`. |
| `designing` | Đã mô tả | Testcase đã có thông tin mô tả để chuẩn bị chạy. |
| `scripting` | Tạo script | Đang viết hoặc hoàn thiện script testcase. |
| `active` | Active | Testcase sẵn sàng sử dụng. Với `mode: script`, script không được rỗng. |

`tested` (Đã test) **chưa có** trong DB/API hiện tại; đây là trạng thái cần bổ sung theo contract tại mục 4.

### Kết quả chạy testcase gần nhất

Lưu tại `flow_cases.last_run_status`:

| Giá trị | Hiển thị | Điều kiện |
| --- | --- | --- |
| `success` | Pass | Lần chạy gần nhất có `failed = 0`. |
| `failed` | Fail | Lần chạy gần nhất có ít nhất một lỗi. |

### Trạng thái tiến trình của một lần chạy

Lưu tại `debug_runs.status`:

| Giá trị | Ý nghĩa |
| --- | --- |
| `pending` | Đang chờ chạy. |
| `running` | Đang chạy. |
| `completed` | Đã chạy xong. Kết quả Pass/Fail xem qua `passed` và `failed`. |
| `failed` | Tiến trình chạy bị lỗi. |

## 6. Danh sách QA

Tại trang `/qa`, bảng danh sách testcase có thêm cột `ID` ở bên trái cột **Tên Testcase** để dễ đối chiếu với API `testcaseId`.

## 7. Script testcase

`flow_cases.environment` lưu loại testcase với hai giá trị `API` hoặc `UI`.

`script_source` là cột script của testcase:

- API danh sách và API lấy theo thư mục/ID trả `script`; API chi tiết trả `scriptSource`.
- API chi tiết testcase trả `scriptSource`.
- Cập nhật script qua endpoint sau:

```http
PATCH /api/v1/projects/{projectId}/flow-cases/{testcaseId}
```

```json
{
  "script": "return { ok: true }"
}
```
