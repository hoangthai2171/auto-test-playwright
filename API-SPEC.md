# API tích hợp nền tảng bên thứ ba

> Cập nhật: 03/08/2026. Tài liệu này chỉ mô tả contract dành cho hệ thống bên thứ ba; các chức năng giao diện, tài khoản người dùng và quản trị chiến dịch nội bộ được loại khỏi phạm vi.

- Base URL triển khai hiện tại: `http://172.16.240.254:30100`
- Prefix API: `/api/v1`
- Project minh họa: `1`
- Request body: JSON UTF-8, dùng tên field dạng `camelCase`.

## 1. Phạm vi theo nền tảng

Giá trị `platform` không phân biệt chữ hoa/thường ở request và được chuẩn hóa thành chữ thường trong response.

| Nền tảng | `platform` | Dữ liệu thực thi dành cho bên thứ ba |
| --- | --- | --- |
| TV | `tv` | Ưu tiên `actions` (JSON actions của MyTV Auto Test); vẫn có thể dùng `script` nếu runner TV chạy script. |
| Phone | `phone` | Dùng chung cho Android và iOS; dùng contract testcase chung và nội dung `script`. |
| Web | `web` | Dùng contract testcase chung và nội dung `script`. |
| CMS | `cms` | Dùng contract testcase chung và nội dung `script`. |

`environment` là chiều phân loại độc lập với nền tảng và nhận `API` hoặc `UI`.

### 1.1. TV

- Lọc bằng `platform=tv`.
- Response có thể chứa `actions: Record<string, unknown>[]` để ứng dụng MyTV Auto Test thực thi từng bước.
- `actions` được giữ nguyên khi sao chép testcase và được snapshot khi ghi lịch sử chiến dịch.
- Các key nhạy cảm trong snapshot như `password`, `token`, `secret`, `authorization`, `apiKey` được che thành `********`.
- Nếu runner dùng `actions` mà không dùng script, không đặt testcase `mode: "script"`, `status: "active"` khi `script` đang rỗng. Validation của script mode yêu cầu testcase Active phải có script.

Ví dụ lấy case TV đã mô tả:

```http
GET /api/v1/projects/1/flow-cases/by-folder?folderName=%2FAutomation%20testing&environment=UI&platform=tv&status=designing
```

### 1.2. Phone

- Lọc bằng `platform=phone`.
- Bao gồm cả thiết bị Android và iOS; không còn platform `ios` riêng.
- Không có field riêng ngoài contract chung. Runner nhận `script`, thực thi trên thiết bị/emulator và gửi `testResult` về FlowTest.
- Request cũ gửi `ios`, `iphone` hoặc `ipad` được chuẩn hóa thành `phone`; dữ liệu
  `flow_cases` cũ cũng được migration sang `phone` khi backend khởi động.

```http
GET /api/v1/projects/1/flow-cases/by-folder?folderName=%2FMobile&environment=UI&platform=phone&status=active
```

### 1.3. Web

- Lọc bằng `platform=web`.
- Testcase tích hợp runner nên dùng `mode: "script"`; response trả nội dung thực thi trong `script`.

```http
GET /api/v1/projects/1/flow-cases/by-folder?folderName=%2FBoundary&environment=UI&platform=web&status=active
```

### 1.4. CMS

- Lọc bằng `platform=cms`.
- Dùng cùng contract `script` và `testResult` như Web; không có field CMS riêng ở API hiện tại.

```http
GET /api/v1/projects/1/flow-cases/by-folder?folderName=%2FCMS&environment=UI&platform=cms&status=active
```

## 2. Xác thực service-to-service

Máy chủ FlowTest và hệ thống tích hợp phải được cấu hình cùng một secret mạnh:

```env
FLOWTEST_SERVICE_TOKEN=<LONG_RANDOM_SECRET>
```

Hệ thống bên thứ ba gửi secret bằng header:

```http
X-FlowTest-Service-Token: <SERVICE_TOKEN>
```

Không đưa token vào URL, source code phía client hoặc log. Nên sinh secret ngẫu nhiên tối thiểu 32 byte và xoay vòng khi bị lộ.

| API | Service token |
| --- | --- |
| `GET /flow-case-folders` | Không bắt buộc ở contract hiện tại. |
| `GET /flow-cases`, `GET /flow-cases/by-folder`, `GET /flow-cases/{caseId}` | Không bắt buộc ở contract hiện tại. |
| `GET /flow-cases/{caseId}/debug-runs` | Không bắt buộc ở contract hiện tại. |
| `GET /test-campaigns/running` | Bắt buộc service token hoặc access token người dùng hợp lệ. |
| `POST /flow-cases/bulk` | Bắt buộc service token hoặc access token người dùng hợp lệ. |
| `PATCH /flow-cases/bulk`, `PATCH /flow-cases/by-folder` | Bắt buộc service token hoặc access token người dùng hợp lệ. |
| `PUT/PATCH /flow-cases/{caseId}` | Bắt buộc service token hoặc access token người dùng hợp lệ. |
| `POST /flow-cases/{caseId}/save-debug-run` | Bắt buộc service token hoặc access token người dùng hợp lệ. |

Nếu dùng access token người dùng, định dạng đúng là `Authorization: Bearer <ACCESS_TOKEN>`. Không dùng service token thô trong header `Authorization`; header chuẩn của service token là `X-FlowTest-Service-Token`.

Lỗi xác thực thường gặp:

- `403 Not authenticated`: thiếu cả service token và Bearer token.
- `403 Invalid service token`: có gửi header service token nhưng giá trị không khớp cấu hình backend.
- `403 Invalid access token`: Bearer token người dùng hết hạn hoặc không tồn tại.

## 3. Lấy thư mục và lấy testcase

### 3.1. Lấy cây thư mục

```http
GET /api/v1/projects/{projectId}/flow-case-folders
```

Mỗi node gồm `id`, `parentId`, `name`, `fullPath`, `children`. `fullPath` bắt đầu bằng `/` và được dùng lại làm `folderName`, `folderPath` hoặc `folderLink`.

Có thể truyền `campaignId` để chỉ lấy các thư mục chứa testcase bản sao thuộc chiến
dịch và các thư mục cha cần thiết để giữ cấu trúc cây:

```http
GET /api/v1/projects/1/flow-case-folders?campaignId=12
```

| Query | Bắt buộc | Mô tả |
| --- | --- | --- |
| `campaignId` | Không | ID chiến dịch trong project hiện tại; phải là số nguyên dương. |

Các nhánh không chứa testcase của chiến dịch bị loại khỏi response. Campaign không
tồn tại hoặc sai project trả `404 Test campaign not found`.

### 3.2. Lấy testcase theo thư mục, ID hoặc chiến dịch

```http
GET /api/v1/projects/{projectId}/flow-cases/by-folder
```

| Query | Bắt buộc | Mô tả |
| --- | --- | --- |
| `environment` | Có | `API` hoặc `UI`. |
| `folderName` | Một trong ba | Full path thư mục; kết quả gồm cả các thư mục con. |
| `testcaseId` | Một trong ba | ID testcase cần lấy. |
| `campaignId` | Một trong ba | ID chiến dịch; chỉ trả các testcase bản sao thuộc chiến dịch trong project hiện tại. |
| `platform` | Không | `tv`, `phone`, `web`, `cms`; dùng `phone` cho cả Android và iOS. |
| `status` | Không | `created`, `designing`, `scripting`, `active`, `tested`, `inactive`. |

Chỉ truyền đúng một trong `folderName`, `testcaseId` hoặc `campaignId`. Kết quả luôn được sắp xếp theo ID testcase tăng dần và trả `script`, không trả graph `nodes`/`edges`.

Ví dụ lấy các testcase đã mô tả để hệ thống thứ ba biên dịch hoặc chuẩn bị chạy:

```http
GET /api/v1/projects/1/flow-cases/by-folder?folderName=%2FBoundary&environment=API&platform=web&status=designing
```

Ví dụ lấy một testcase:

```http
GET /api/v1/projects/1/flow-cases/by-folder?testcaseId=1713&environment=UI
```

Ví dụ lấy toàn bộ testcase bản sao trong chiến dịch đã chọn, đồng thời lọc theo nền tảng và trạng thái:

```http
GET /api/v1/projects/1/flow-cases/by-folder?campaignId=12&environment=UI&platform=phone&status=active
```

`campaignId` có thể lấy từ `GET /test-campaigns/running`. Nếu chiến dịch không tồn tại trong project hiện tại, API trả `404 Test campaign not found`.

Các field response quan trọng:

```json
{
  "id": "1713",
  "sourceFlowCaseId": null,
  "name": "Kiểm tra kết nối",
  "status": "active",
  "mode": "script",
  "script": "// nội dung script",
  "actions": null,
  "platform": "web",
  "environment": "UI",
  "campaign": null,
  "lastRunStatus": "success",
  "lastRunAt": "2026-08-03T03:30:00Z",
  "lastRunId": "9021"
}
```

## 4. Tạo và cập nhật testcase hàng loạt

```http
POST  /api/v1/projects/{projectId}/flow-cases/bulk
PATCH /api/v1/projects/{projectId}/flow-cases/bulk
```

- `POST`: tạo nhiều testcase trong cùng thư mục.
- `PATCH`: cập nhật một phần nhiều testcase và có thể chuyển chúng vào cùng thư mục.
- Request cấp ngoài phải có đúng một trong `folderId`, `folderPath`, `folderLink`.
- `testcases` có từ 1 đến 500 phần tử.
- Bulk PATCH bắt buộc `id` trong từng phần tử và không chấp nhận ID trùng nhau.
- Request được xử lý trong một transaction: một phần tử lỗi thì toàn bộ batch không được lưu.

Các field tích hợp chính:

| Field | Tạo mới | Ý nghĩa |
| --- | --- | --- |
| `name` | Bắt buộc | Tên testcase. |
| `preCondition` | Bắt buộc có key | Điều kiện; gửi `""` nếu chưa có. |
| `qaDescription` | Bắt buộc có key | Mô tả QA; gửi `""` nếu chưa có. |
| `expectedResult` | Bắt buộc có key | Kết quả mong đợi; gửi `""` nếu chưa có. |
| `platform` | Bắt buộc | Một trong bốn nền tảng ở mục 1. |
| `environment` | Bắt buộc | `API` hoặc `UI`. |
| `mode` | Khuyến nghị | `script` cho runner chạy script; mặc định là `visual`. |
| `script` | Theo mode/status | Bắt buộc khi testcase ở `mode: script`, `status: active`. |
| `actions` | Không | Mảng JSON object mô tả các bước chạy, chủ yếu dùng cho TV; hỗ trợ cả tạo mới và cập nhật. |
| `status` | Không | Mặc định `created`; khi tạo nhận đến `active`, không tạo trực tiếp với `tested`. |
| `slug` | Không | Backend tự sinh slug duy nhất nếu bỏ trống. |

Ví dụ tạo case Web:

```json
{
  "folderPath": "/Boundary",
  "testcases": [
    {
      "name": "Kiểm tra kết nối",
      "preCondition": "Dịch vụ đích đang hoạt động.",
      "qaDescription": "Gửi request và kiểm tra response.",
      "expectedResult": "Kết nối thành công.",
      "platform": "web",
      "environment": "API",
      "mode": "script",
      "script": "return { ok: true }",
      "status": "active"
    }
  ]
}
```

Ví dụ cập nhật script và chuyển testcase sang Active:

```json
{
  "folderPath": "/Boundary",
  "testcases": [
    {
      "id": 1713,
      "mode": "script",
      "script": "return { ok: true, updated: true }",
      "status": "active"
    }
  ]
}
```

## 5. Trạng thái testcase và kết quả chạy

Trạng thái vòng đời:

| `status` | Hiển thị | Ý nghĩa tích hợp |
| --- | --- | --- |
| `created` | Đã tạo | Chưa hoàn thiện mô tả. |
| `designing` | Đã mô tả | Đã có thông tin để bên thứ ba tiếp tục tạo script/actions. |
| `scripting` | Tạo script | Đang tạo hoặc cập nhật script. |
| `active` | Active | Sẵn sàng chạy. |
| `tested` | Đã test | Đã nhận kết quả chạy; bắt buộc có `testResult`. |
| `inactive` | Inactive | Tạm ngừng, runner không nên lấy để chạy. |

Pass/Fail không phải trạng thái vòng đời. Giá trị này nằm trong `testResult.status`:

- `success`: `failed` phải bằng `0`.
- `failed`: `failed` phải từ `1` trở lên và `message` không được rỗng.
- Khi gửi `testResult`, bắt buộc gửi `status: "tested"`.
- Khi gửi `status: "tested"`, bắt buộc gửi `testResult`.

`testResult.screenshots` (string, tùy chọn) là **đúng một** ảnh chụp màn hình đại diện
cho lần chạy đó, đã mã hóa WebP dạng base64 thuần (không có tiền tố
`data:image/webp;base64,`).

Một lần chạy có thể tạo ra nhiều ảnh — `play_row` và `play_all_contents` chụp một ảnh
cho mỗi poster — nhưng server chỉ nhận một ảnh, nên runner chọn ảnh đại diện theo thứ
tự ưu tiên:

1. Testcase **thất bại**: lấy ảnh của item/bước bị `failed` (item failed đầu tiên của
   bước failed gần nhất). Ưu tiên này đứng trước cả ảnh hoàn thành, vì một lần chạy
   thất bại vẫn có thể có ảnh hoàn thành/player-check chụp trước khi lỗi xảy ra, gửi
   ảnh đó lên sẽ hiển thị một màn hình bình thường cho testcase đã fail.
2. Testcase **thành công**: lấy ảnh hoàn thành của testcase.
3. Không có hai loại trên: lấy ảnh gần nhất còn lại.

Chỉ ảnh chụp màn hình (`screenshotDataUrl`, `completionScreenshotDataUrl`) được xét;
ảnh poster của nội dung không bao giờ được gửi. Ảnh được thu nhỏ về tối đa 1280px cạnh
dài với chất lượng WebP 0.8. Nếu lần chạy không có ảnh nào, runner bỏ hẳn field này
thay vì gửi chuỗi rỗng.

### 5.1. Gửi kết quả hàng loạt

Endpoint khuyến nghị:

```http
PATCH /api/v1/projects/{projectId}/flow-cases/by-folder
```

Thành công:

```json
{
  "folderPath": "/Thai-test",
  "testcases": [
    {
      "id": 1713,
      "status": "tested",
      "testResult": {
        "status": "success",
        "message": "Testcase chạy thành công.",
        "passed": 1,
        "failed": 0,
        "finishedAt": "2026-08-03T10:30:00+07:00",
        "screenshots": "UklGRiQAAABXRUJQVlA4..."
      }
    }
  ]
}
```

Thất bại với message `failed connection`:

```json
{
  "folderPath": "/Thai-test",
  "testcases": [
    {
      "id": 1714,
      "status": "tested",
      "testResult": {
        "status": "failed",
        "message": "failed connection",
        "passed": 0,
        "failed": 1,
        "finishedAt": "2026-08-03T10:31:00+07:00",
        "screenshots": "UklGRiQAAABXRUJQVlA4..."
      }
    }
  ]
}
```

PowerShell:

```powershell
curl.exe -X PATCH "http://localhost:8000/api/v1/projects/1/flow-cases/by-folder" `
  -H "X-FlowTest-Service-Token: <SERVICE_TOKEN>" `
  -H "Content-Type: application/json; charset=utf-8" `
  --data-binary "@result.json"
```

### 5.2. Cập nhật một testcase

```http
PATCH /api/v1/projects/{projectId}/flow-cases/{caseId}
```

Body dùng cùng cặp `status: "tested"` và `testResult` như trên nhưng không bọc trong `folderPath`/`testcases`.

### 5.3. Gửi log chạy chi tiết

Runner cần lưu thêm `steps` hoặc `consoleLogs` có thể dùng:

```http
POST /api/v1/projects/{projectId}/flow-cases/{caseId}/save-debug-run
```

```json
{
  "passed": 0,
  "failed": 1,
  "message": "failed connection",
  "steps": [
    { "name": "Connect", "status": "failed" }
  ],
  "consoleLogs": ["Connection timeout"]
}
```

Response:

```json
{
  "data": {
    "runId": "9022"
  }
}
```

API này lưu một lần chạy mới và cập nhật kết quả gần nhất của testcase. `runId` trong
response do FlowTest sinh; client không dùng field này làm khóa chống trùng. API chính
để đồng thời chuyển vòng đời sang `tested` vẫn là `PATCH` với `testResult`.

## 6. Tích hợp với chiến dịch

Bên thứ ba lấy danh sách chiến dịch đang chạy, cho người thực hiện chọn một chiến dịch,
sau đó dùng `campaign.id` khi gửi kết quả:

```http
GET /api/v1/projects/{projectId}/test-campaigns/running
X-FlowTest-Service-Token: <SERVICE_TOKEN>
```

- Service token trả tất cả chiến dịch đang chạy của mọi tài khoản trong cùng project.
- Bearer token chỉ trả chiến dịch đang chạy của tài khoản sở hữu token.
- Mỗi phần tử gồm `campaign`, phiên `run` hiện tại và danh sách testcase bản sao trong
  `campaign.testcases`.

```json
{
  "data": [
    {
      "campaign": {
        "id": "12",
        "projectId": "1",
        "userId": "7",
        "name": "Regression tháng 8",
        "testcases": [
          {
            "id": "1842",
            "sourceFlowCaseId": "1713",
            "name": "Kiểm tra kết nối",
            "status": "active",
            "platform": "web"
          }
        ]
      },
      "run": {
        "id": "31",
        "testCampaignId": "12",
        "userId": "7",
        "status": "running",
        "startedAt": "2026-08-03T03:00:00Z"
      }
    }
  ]
}
```

- Khi một testcase được thêm vào chiến dịch, FlowTest tạo một bản sao có ID riêng.
- Response testcase cho biết bản sao thuộc chiến dịch nào qua `sourceFlowCaseId` và `campaign`.
- Sau khi chọn chiến dịch, runner phải chạy và gửi kết quả bằng chính `id` của bản sao
  trong `campaign.testcases`, không dùng `sourceFlowCaseId`.
- Nếu chiến dịch đang chạy, backend tự liên kết log với `currentRunId` hiện tại.
- Nếu testcase không thuộc chiến dịch (`campaign: null`), kết quả được lưu bình thường và không thuộc lần chạy chiến dịch nào.
- Nếu testcase thuộc chiến dịch nhưng chiến dịch chưa khởi chạy hoặc đã kết thúc, gửi kết quả trả `409 Test campaign has not been started or has already finished`.
- Nên gửi `campaignId` đã chọn để request thể hiện rõ chiến dịch đích. Nếu bỏ field này,
  backend chỉ tự suy ra chiến dịch khi `id` là testcase bản sao; testcase độc lập vẫn
  được cập nhật nhưng không tạo log chiến dịch.
- Nếu `campaignId` không khớp chiến dịch của testcase bản sao, API trả `409`.
- Service token có thể ghi kết quả cho bản sao chiến dịch thuộc các tài khoản khác nhau trong cùng project. Bearer token người dùng chỉ được ghi vào chiến dịch của tài khoản đó.

Mỗi testcase có thể gửi `campaignId` của chiến dịch đã chọn:

```json
{
  "folderPath": "/Thai-test",
  "testcases": [
    {
      "id": 1842,
      "campaignId": 12,
      "status": "tested",
      "testResult": {
        "status": "success",
        "message": "Testcase chạy thành công.",
        "passed": 1,
        "failed": 0,
        "finishedAt": "2026-08-03T10:30:00+07:00"
      }
    }
  ]
}
```

Quy tắc truyền `campaignId`:

- `PATCH /flow-cases/{caseId}`: đặt cùng cấp với `status` và `testResult`.
- `PATCH /flow-cases/by-folder` hoặc `/bulk`: có thể đặt ở cấp ngoài để áp dụng cho
  cả batch, hoặc đặt trong từng phần tử testcase.
- `POST /flow-cases/{caseId}/save-debug-run`: đặt `campaignId` trực tiếp trong body.
- Nếu có cả hai cấp, các giá trị phải giống nhau.
- Không truyền `campaignId`: bản sao chiến dịch tự suy ra chiến dịch; testcase độc lập
  được lưu kết quả ngoài chiến dịch.

Ví dụ testcase thuộc chiến dịch:

```json
{
  "id": "1842",
  "sourceFlowCaseId": "1713",
  "name": "Kiểm tra kết nối",
  "campaign": {
    "id": "12",
    "name": "Regression tháng 8",
    "status": "running",
    "currentRunId": "31"
  }
}
```

Testcase độc lập:

```json
{
  "id": "1713",
  "sourceFlowCaseId": null,
  "campaign": null
}
```

Mỗi lần gửi kết quả tạo một dòng lịch sử chạy riêng. Vì vậy client không nên tự động gửi lại request thành công nếu chưa có cơ chế chống trùng ở phía runner.

## 7. Thời gian và lịch sử chạy

- Gửi `finishedAt` theo ISO 8601 và luôn kèm múi giờ, ví dụ `2026-08-03T10:30:00+07:00` hoặc UTC `2026-08-03T03:30:00Z`.
- Backend chuẩn hóa thời gian lưu trữ/response về UTC có hậu tố `Z`; giao diện chuyển sang múi giờ local khi hiển thị.
- Không gửi datetime thiếu timezone để tránh lệch 7 giờ.
- Lấy tối đa 100 lịch sử gần nhất của một case bằng:

```http
GET /api/v1/projects/{projectId}/flow-cases/{caseId}/debug-runs
```

## 8. Mã lỗi cần xử lý

| HTTP | Trường hợp thường gặp |
| --- | --- |
| `400` | Giá trị folder/query không hợp lệ hoặc chức năng không hỗ trợ nền tảng. |
| `403` | Thiếu/sai service token hoặc Bearer token. |
| `404` | Không tìm thấy project, folder, testcase hoặc chiến dịch. |
| `409` | Testcase chiến dịch chưa được chạy/đã kết thúc, sai `campaignId`, hoặc xung đột dữ liệu. |
| `422` | Sai schema, thiếu `environment`, thiếu `testResult`, Pass/Fail không hợp lệ, script mode Active nhưng không có script, hoặc batch vượt 500 case. |

## 9. Luồng tích hợp khuyến nghị

1. Gọi API cây thư mục để lấy `fullPath`.
2. Gọi `GET /test-campaigns/running` và cho người dùng chọn chiến dịch cần test.
3. Có thể gọi `GET /flow-case-folders?campaignId={campaignId}` để lấy riêng cây thư
   mục của chiến dịch; sau đó lấy testcase bản sao bằng
   `GET /flow-cases/by-folder?campaignId={campaignId}&environment={API|UI}`. Với testcase
   độc lập, tiếp tục lấy theo thư mục, `environment`, `platform` và `status`.
4. Nếu hệ thống thứ ba tạo script, PATCH `mode`, `script`, `status: "active"`.
5. Thực thi testcase bằng `script` hoặc `actions` theo nền tảng.
6. Gửi `status: "tested"`, `testResult` và `campaignId` đã chọn; có thể bỏ
   `campaignId` khi dùng đúng ID bản sao vì backend tự suy ra.
7. Chỉ dùng `save-debug-run` khi cần gửi thêm steps/console logs, và tránh gửi trùng cùng một lần chạy.
