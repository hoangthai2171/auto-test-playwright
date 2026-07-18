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

API lấy testcase theo `folderName` hoặc `testcaseId`, đồng thời lọc theo `environment`. Khi dùng `folderName`, kết quả gồm testcase thuộc thư mục đích và toàn bộ thư mục con.

| Query parameter | Bắt buộc | Mô tả |
| --- | --- | --- |
| `environment` | Có | `API` hoặc `UI`, không phân biệt hoa/thường. |
| `platform` | Không | Lọc theo `tv`, `phone` hoặc `web`; không phân biệt chữ hoa/thường. |
| `folderName` | Một trong hai | Đường dẫn từ thư mục gốc, bắt buộc bắt đầu bằng `/`. |
| `testcaseId` | Một trong hai | ID testcase cần lấy. |

Ví dụ:

```http
GET /api/v1/projects/1/flow-cases/by-folder?folderName=%2FTest%20API%20k%C3%AAnh%20OTT%2FPlay%20k%C3%AAnh&environment=API
GET /api/v1/projects/1/flow-cases/by-folder?folderName=%2FTest%20API%20k%C3%AAnh%20OTT&environment=API
GET /api/v1/projects/1/flow-cases/by-folder?folderName=%2FTest%20API%20k%C3%AAnh%20OTT&environment=API&platform=PHONE
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

`folderPath` nằm ở request cấp ngoài nên tất cả testcase trong request được lưu vào cùng thư mục.

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
      "environment": "API"
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
      "environment": "UI"
    }
  ]
}
```

## 4. Danh sách QA

Tại trang `/qa`, bảng danh sách testcase có thêm cột `ID` ở bên trái cột **Tên Testcase** để dễ đối chiếu với API `testcaseId`.

## 5. Script testcase

`flow_cases.environment` lưu loại testcase với hai giá trị `API` hoặc `UI`.

`script_source` là cột script của testcase:

- API danh sách không trả `scriptSource`.
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
