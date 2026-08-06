# Soosky HRM API contract — v1

## Context

Backend mount toàn bộ router dưới prefix chung **`/api/v1`**: `/api/v1/auth`, `/api/v1/iam`, `/api/v1/department`, `/api/v1/employee`, `/api/v1/attendance`, `/api/v1/payroll`, `/api/v1/performance`, `/api/v1/setting` (hằng `API_PREFIX` trong `backend/src/infra/server/createExpressServer.ts`). Mỗi module tự parse JSON, xác thực (trừ các endpoint phiên Auth công khai) và trả lỗi qua handler chung.

Đổi prefix thì phải đổi đồng bộ `frontend/nginx.conf` (block `location /api/v1/`) và build-arg `VITE_API_BASE_URL`. Bảng bên dưới ghi đường dẫn TƯƠNG ĐỐI so với prefix này.

## Problem

Frontend từng gọi nhiều endpoint của API cũ, không có prefix module hoặc dùng namespace `/admin`, nên UI hiển thị được mà không đi tới backend hiện hữu. Đã dọn xong (xem “Hợp đồng FE ↔ BE”); tài liệu HTML cũ vẫn mô tả sai nhiều thứ nên chỉ dùng để tham khảo lịch sử.

## Key Learning

- API là module-prefixed; không dùng route tắt như `/employees` hay `/shifts`.
- Mutating use case tự kiểm tra permission ở application layer. Frontend chỉ dùng quyền để ẩn/hiện UI, không thay thế server-side authorization.
- Use case ĐỌC hồ sơ nhân viên còn thu hẹp theo PHẠM VI: `all` (HR/Admin) / `team` (Manager — chính mình + cấp dưới mọi tầng) / `self` (Employee). Quy ước khoá quyền và cách suy ra phạm vi: `backend/src/shared/core/app/authorization/PermissionScope.ts`.
- Account được cấp bằng mật khẩu tạm mang cờ `mustChangePassword`. Mọi endpoint trả **403 `PASSWORD_CHANGE_REQUIRED`** cho tới khi đổi mật khẩu, TRỪ `GET /auth/me`, `PUT /auth/me/password`, `POST /auth/sessions/logout`.
- Response thành công trả DTO trực tiếp hoặc object theo controller (ví dụ `{ account }`, `{ accounts }`, `{ users }`); không có envelope chung `{ data }`. Lỗi dùng `{ code, message }`.

## Decision

Base URL là biến môi trường frontend (không hard-code). Dùng Bearer access token cho mọi endpoint trừ session/account verification công khai.

| Module | Canonical surface | Ghi chú triển khai v1 |
| --- | --- | --- |
| Auth | `/auth/sessions`, `/auth/sessions/refresh`, `/auth/sessions/logout`, `/auth/me`, `/auth/me/profile`, `/auth/me/password`, `/auth/accounts*` | Login/refresh/logout và vòng đời account. Response mở phiên có thêm `mustChangePassword`. |
| IAM | `/iam/me/permissions`, `/iam/users*`, `/iam/roles*`, `/iam/roles/:roleId/permissions`, `/iam/permissions`, `/iam/audit-logs` | Quản lý role, role-permission, user-role và audit. `GET /iam/me/permissions` = quyền của CHÍNH actor (không đòi `iam:manage`), frontend dùng để hiện đúng menu; `GET /iam/roles/:roleId/permissions` trả `permissionIds` (danh sách role cố tình không nhúng quyền). |
| Department | `/department/departments*`, `/department/positions*` | Cây phòng ban; archive trước, delete chỉ khi nghiệp vụ cho phép. |
| Employee | `/employee/employees*`, `/employee/employees/:employeeId/grant-login`, `/employee/imports/preview`, `/employee/imports/commit`, `/employee/contacts/:contactId`, `/employee/bank-accounts/:bankAccountId`, `/employee/documents/:documentId`, `/employee/contracts/:contractId`, `/employee/assets/:assetId` | Employee là nguồn dữ liệu cho attendance/payroll. Đọc theo phạm vi all/team/self. |
| Attendance | `/attendance/shifts*`, `/attendance/holidays*`, `/attendance/symbols*`, `/attendance/records*`, `/attendance/records/visible`, `/attendance/correction-requests*`, `/attendance/leave-requests*`, `/attendance/leave-balances*` | Chấm công do HR nhập (xem “Ranh giới Attendance v1”); leave có trạng thái submit/approve/reject/cancel, duyệt theo phạm vi all/team. `GET /records/visible` = bảng công MỌI nhân viên trong phạm vi actor (lưới HR/Manager); `GET /records` bỏ trống `employeeId` vẫn là “của chính tôi”. |
| Dashboard | `GET /dashboard/overview` | Read model duy nhất cho trang tổng quan; backend quyết định actor thấy gì theo `dashboard:read` (all/team/self). |
| Setting | `/setting/company`, `/setting/system`, `/setting/bank-profiles*` | Cấu hình cấp hệ thống, gồm mẫu file chuyển lương theo ngân hàng. |
| Payroll | `/payroll/periods*`, `/payroll/payrolls*`, `/payroll/allowances*`, `/payroll/bonuses*`, `/payroll/deductions*`, `/payroll/retro-adjustments*`, `/payroll/tax-profiles*`, `/payroll/policies*`, `/payroll/gross-up` | Luồng khoá dữ liệu → chạy → duyệt → chi trả. Lập lương và duyệt lương là hai quyền khác nhau. |
| Performance | `/performance/criteria-sets*`, `/performance/cycles*`, `/performance/reviews*` | Bộ tiêu chí CÓ PHIÊN BẢN, chu kỳ đánh giá gắn kỳ lương, phiếu đánh giá theo luồng chấm → duyệt → xác nhận → khoá. |

`*` nghĩa là dùng chính HTTP verb và route detail được khai báo trong `backend/src/modules/<module>/adapters/driver/http/index.ts`; không tự tạo endpoint mới nếu route có sẵn.

### Phân quyền: role hệ thống và phạm vi

`infra/db/seedIam.ts` nạp 4 role hệ thống (idempotent, chạy mỗi lần khởi động). User mới nhận role `employee`; user ĐẦU TIÊN của hệ thống nhận `admin`.

| Role | Quyền chính | Nhìn thấy hồ sơ nhân viên |
| --- | --- | --- |
| `admin` | `*` | tất cả |
| `hr` | `employee:manage/read/import/provision`, `department:manage`, `attendance:manage`, `leave:approve`, `payroll:prepare`, `setting:manage`, `audit:read`, `dashboard:read` | tất cả |
| `manager` | `employee:read:team`, `attendance:read:team`, `correction:submit:team`, `correction:approve:team`, `leave:submit:team`, `leave:read:team`, `leave:approve:team`, `performance:review:team`, `performance:read:team`, `department:read`, `dashboard:read:team` | chính mình + cấp dưới mọi tầng |
| `employee` | `employee:read:self`, `attendance:read:self`, `correction:submit:self`, `leave:submit:self`, `leave:read:self`, `performance:read:self`, `dashboard:read:self` | chính mình |

Khoá có hậu tố `:team` / `:self` là bản thu hẹp của khoá gốc; `<resource>:manage` bao trùm mọi hành động của resource đó.

### Cấp tài khoản cho nhân viên

`POST /employee/employees/:employeeId/grant-login` — body `{ email? }` (bỏ trống thì dùng email trên hồ sơ), quyền `employee:provision`.

1. Tạo account (module Auth) với mật khẩu tạm + cờ `mustChangePassword`, gửi mail kèm mật khẩu tạm và link kích hoạt.
2. Gắn `accountId` vào hồ sơ nhân viên, ghi `EmployeeHistory("account_granted")` và audit `employee_account:grant_login`.
3. Nhân viên mở link → `POST /auth/accounts/verification { token }` → account `active`.
4. Đăng nhập → response có `mustChangePassword: true`; mọi endpoint khác trả 403 `PASSWORD_CHANGE_REQUIRED`.
5. `PUT /auth/me/password` → cờ được gỡ, mọi refresh token bị thu hồi → đăng nhập lại.

Cấp lần thứ hai cho cùng nhân viên trả 409 `EMPLOYEE_ALREADY_HAS_ACCOUNT`.

### Nhập nhân viên từ CSV

Hai bước stateless, quyền `employee:import`:

- `POST /employee/imports/preview` — body `{ csv }`. Trả `{ rows[], summary{total,ok,error}, checksum }`; mỗi dòng có `line` (số dòng thật trong file), `status`, `errors[]`. KHÔNG ghi gì vào DB.
- `POST /employee/imports/commit` — body `{ csv, checksum }`. Checksum lệch → 409 `EMPLOYEE_IMPORT_CHECKSUM_MISMATCH`. Validate lại toàn bộ rồi chỉ ghi dòng hợp lệ; trả `{ created, skipped, rows[] }`.

Cột bắt buộc: `code,name,departmentCode,positionCode,hireDate,employeeType`. Cột tuỳ chọn: `email,phone,dob,gender,managerCode`. Phòng ban/vị trí/quản lý tra theo MÃ. Ngày định dạng `YYYY-MM-DD`. Chống trùng: theo mã, cả trong file và với dữ liệu đã có.

### Nhật ký audit

Mọi module ghi vào cùng một sổ (`GET /iam/audit-logs`, quyền `iam:manage`, lọc được theo `resource`/`resourceId`). Các `resource:action` được ghi:

`employee:terminate`, `employee:import`, `employee_contract:create|update|delete`, `employee_bank_account:create|update|delete`, `employee_document:create|update|delete`, `employee_account:grant_login`, `attendance_correction:submit|approve|reject`, `payroll_period:unlock_attendance`, `performance_criteria_set:create`, `performance_criteria_version:publish`, `performance_cycle:create|activate|close`, `performance_review:score|approve|request_changes|acknowledge|appeal|resolve_appeal|lock|assign_reviewer`, cùng các bản ghi của IAM (`role:*`, `user-role:*`).

### Ràng buộc dữ liệu chủ (backend enforce)

- Mã nhân viên duy nhất; phòng ban/vị trí/quản lý phải tồn tại.
- Gán quản lý tạo vòng trong chuỗi báo cáo → 409 `MANAGER_CYCLE`.
- Một nhân viên chỉ có MỘT hợp đồng `active` phủ một thời điểm → 409 `EMPLOYEE_CONTRACT_OVERLAP`.
- Tài khoản ngân hàng `isPrimary` là duy nhất: đặt cái mới làm chính thì các cái còn lại tự hạ cờ.
- Hợp đồng `active` đầu tiên chuyển nhân viên từ `onboarding` sang `active` (payroll chỉ tính nhân viên `active`).

### Luồng end-to-end tối thiểu

1. Bootstrap admin bằng CLI/Auth; đăng nhập và nhận access/refresh token.
2. Admin tạo role/permission cần thiết (IAM), phòng ban và vị trí (Department).
3. HR tạo employee (từng người hoặc nhập CSV), profile, contract; cấp account bằng `grant-login`.
4. HR cấu hình shift/holiday/symbol; nhập attendance hoặc xử lý leave để có workday summary.
5. HR tạo salary policy, tax profile và các khoản compensation; mở payroll period.
6. HR kiểm tra attendance readiness, lock attendance, lock evaluations (cổng thủ công v1), chạy payroll, duyệt và mark paid.
7. Employee tự phục vụ trong phạm vi của mình: `GET /payroll/payrolls/me`, hồ sơ của chính mình, nộp/huỷ/xem đơn nghỉ và tra số dư phép của mình.

### Tự phục vụ: `employeeId` do BACKEND suy ra

Mọi endpoint tự phục vụ nhận `employeeId` **tuỳ chọn**; bỏ trống nghĩa là "của chính tôi", suy ra từ access token qua liên kết `employee.accountId`. Client không cần biết employeeId của mình và **không thể** gửi id người khác để vượt rào — id được gửi vẫn bị kiểm phạm vi.

| Endpoint | Bỏ trống `employeeId` nghĩa là |
| --- | --- |
| `GET /attendance/records?start&end` | bảng công của chính tôi |
| `GET /attendance/leave-balances?year` | số dư phép của chính tôi |
| `GET /attendance/leave-requests` | đơn nghỉ trong phạm vi của tôi |
| `POST /attendance/leave-requests` | nộp đơn cho chính tôi |
| `POST /attendance/correction-requests` | yêu cầu chỉnh công cho chính tôi |
| `GET /attendance/correction-requests` | yêu cầu trong phạm vi của tôi |
| `GET /payroll/payrolls/me` | phiếu lương của chính tôi |

### Chấm công: HR ghi, nhân viên chỉ đọc

GHI (ca, bản ghi chấm công, ngày lễ, ký hiệu, hạn mức phép) qua `attendance:manage` — chỉ `admin` và `hr`. **Không có** `attendance:*:self` cho ghi: nhân viên không tự check-in/check-out. ĐỌC thì có phạm vi (`attendance:read` / `:team` / `:self`).

Quy tắc tính công (`AttendanceDayWriter` + `attendance-calc`):

- **Timezone** lấy từ `CompanyProfile.timezone` (mặc định `Asia/Ho_Chi_Minh`), KHÔNG lấy giờ máy chủ — container chạy UTC.
- Ghép ca theo `workingDays` của ca; công mỗi ca = `1 / số ca cấu hình trong ngày`.
- **Đi trễ** (quá 5 phút ân hạn): ghi `lateMinutes`, status `late`, VẪN đủ công.
- **Về sớm** quá 120 phút: status `early_leave`, MẤT công của ca đó.
- **Thiếu giờ ra**: status `incomplete`, công 0 — khác `absent` về ý nghĩa (có đi làm, dữ liệu dở dang) và payroll coi là trung tính, không trừ công oan. Sửa qua luồng chỉnh công.
- **Ngày lễ**: một bản ghi `holiday` trung tính, công 0, không đòi phải có ca. Nghỉ phép trùng ngày lễ thì bản ghi của nghỉ phép được tôn trọng.
- **Ngày không có ca áp dụng** (cuối tuần): 409 `NO_APPLICABLE_SHIFT` thay vì ghi bừa.
- **Tăng ca (OT)**: chưa nằm trong phạm vi. Không có trường OT; payroll `overtimePay = 0`.

### Chỉnh công: nhân viên yêu cầu, quản lý/HR duyệt

Nhân viên không sửa trực tiếp bảng công. Quyền: `correction:submit`/`:team`/`:self` (gửi + xem) và `correction:approve`/`:team` (quyết định — **không có `:self`**, không ai tự duyệt yêu cầu của mình, kể cả Manager).

- `POST /attendance/correction-requests` — `{ employeeId?, date, requestedCheckIn?, requestedCheckOut?, reason }`. `reason` bắt buộc; phải nêu ít nhất một trong hai mốc giờ. Một ngày chỉ được có MỘT yêu cầu `pending` (409 `ATTENDANCE_CORRECTION_CONFLICT`).
- `GET /attendance/correction-requests?employeeId&status` — theo phạm vi; với Manager đây chính là hàng chờ duyệt.
- `POST /attendance/correction-requests/:id/approve` — `{ note? }`. **Duyệt là áp dụng ngay**: bảng công ngày đó được tính lại qua đúng `AttendanceDayWriter` mà HR dùng, `source` thành `correction`.
- `POST /attendance/correction-requests/:id/reject` — `{ reason }` bắt buộc.

Vòng đời một chiều `pending` → `approved` | `rejected`; quyết định lần hai trả 422.

### Chốt kỳ công trước khi tính lương

`POST /payroll/periods/:id/lock-attendance` đông cứng số liệu đầu vào của lương. Sau khi chốt, **mọi** thao tác ghi bảng công chạm vào khoảng ngày của kỳ đều trả 409 `ATTENDANCE_PERIOD_LOCKED`:

- HR nhập hoặc xoá bản ghi chấm công;
- gửi yêu cầu chỉnh công cho ngày trong kỳ (chặn ngay từ khâu gửi, không để dồn hàng chờ chắc chắn bị từ chối);
- duyệt yêu cầu chỉnh công (kỳ có thể bị chốt sau lúc gửi);
- duyệt đơn nghỉ (duyệt sinh bản ghi chấm công) và huỷ đơn ĐÃ duyệt (hoàn số dư + xoá bản ghi đã sinh).

Mở lại: `POST /payroll/periods/:id/unlock-attendance` với `{ reason }` **bắt buộc** (`payroll:prepare`). Mọi phiếu lương `approved` chưa `paid` bị hoàn về `draft`, và lần mở khoá được ghi audit `payroll_period:unlock_attendance` kèm lý do.

### Hợp đồng FE ↔ BE (bản kê route + test đối chiếu)

`share-docs/api-routes.json` là BẢN KÊ mọi route backend, do chính router sinh ra
(`backend/tests/infra/route-manifest.test.ts` đọc file router, trích route, ghi lại).
Frontend có test đối chiếu (`frontend/src/core/http/api-contract.test.ts`) quét mọi
lời gọi `api.*` trong mã nguồn và bắt buộc từng URL phải có trong bản kê.

Hệ quả bắt buộc nhớ:

- Đổi/xoá route backend mà quên sửa frontend → **đỏ test frontend**, không phải 404 lúc chạy.
- URL phải viết TĨNH đủ để đối chiếu: `` `/auth/accounts/${id}/deactivation` `` được, còn
  `` `/auth/accounts/${id}/${action}` `` thì không (test không suy ra được đường dẫn).
- Không có tiền tố `/admin` hay `/settings` — phân quyền do backend kiểm theo khoá quyền,
  không theo đường dẫn. Test có case chặn riêng cho việc này.
- Thành công KHÔNG bọc envelope: đọc thẳng `data`, không có `data.data`. Lỗi mới có
  `{ code, message }` (dùng `apiErrorMessage`/`apiErrorCode` ở frontend).

### Bảng điều khiển: `GET /dashboard/overview` (read-only)

Một endpoint duy nhất cho toàn bộ trang tổng quan. Trước đó frontend tự ghép 7 endpoint
nghiệp vụ, nghĩa là mỗi ô số phụ thuộc phạm vi quyền của endpoint nguồn và không ai kiểm được
tổng thể "actor này được thấy gì". Nay backend quyết định, frontend chỉ hiển thị.

**Quyền:** khoá gốc `dashboard:read`, có bản thu hẹp `:team` / `:self`.

| Role | Khoá | Phạm vi dữ liệu |
| --- | --- | --- |
| `admin` | `*` | toàn công ty |
| `hr` | `dashboard:read` | toàn công ty |
| `manager` | `dashboard:read:team` | chính mình + cấp dưới mọi tầng |
| `employee` | `dashboard:read:self` | chỉ chính mình |

Thiếu mọi khoá `dashboard:read*` → 403 `ACCESS_DENIED`.

**DTO** (trả TRỰC TIẾP, không bọc `{ data }`):

```jsonc
{
  "generatedAt": "2026-08-06T09:00:00.000Z",   // mốc sinh dữ liệu, UTC
  "timezone": "Asia/Ho_Chi_Minh",              // timezone CÔNG TY, không phải của máy chủ
  "scope": "all" | "team" | "self",
  "headcount": {                               // null với scope `self`
    "total": 42, "active": 40, "newHiresThisMonth": 3,
    "byDepartment": [{ "departmentId": "…", "name": "Engineering", "count": 12 }]
  },
  "attendanceToday": {                         // "hôm nay" theo timezone công ty
    "date": "2026-08-06",
    "present": 30, "late": 2, "incomplete": 1,
    "onLeave": 3, "absent": 0, "notRecorded": 4
  },
  "attendanceTrend": {                         // số ngày công theo NGÀY, dùng cho biểu đồ
    "last7Days":  [{ "date": "2026-08-01", "present": 30, "late": 1, "onLeave": 2, "absent": 0 }],
    "last30Days": [ /* cùng hình dạng */ ]
  },
  "pendingApprovals": {                        // null nếu actor không duyệt gì (scope self)
    "leaveRequests": 4,
    "correctionRequests": 1,
    "leaveItems": [{                           // tối đa 8 dòng
      "id": "…", "employeeId": "…", "employeeCode": "EMP-001", "employeeName": "Nguyen Van A",
      "leaveType": "annual", "startDate": "2026-08-10", "endDate": "2026-08-11",
      "days": 2, "submittedAt": "2026-08-05T…"
    }]
  },
  "upcomingLeaves": [ /* cùng hình dạng leaveItems, đơn ĐÃ DUYỆT bắt đầu từ hôm nay */ ],
  "payroll": {                                 // null nếu thiếu quyền payroll hoặc chưa có kỳ
    "periodId": "…", "name": "2026-08", "stage": "approved", "status": "processing",
    "payDate": "2026-09-05", "headcount": 40,
    "totals": { "gross": 800000000, "net": 680000000, "finalizedCount": 30 }
  },
  "myPayslip": {                               // CHỈ phiếu của chính actor; null nếu không có
    "periodName": "2026-08", "status": "approved", "netSalary": 17000000
  },
  "performance": {                             // hình dạng ĐỔI theo scope
    "cycleId": "…", "cycleStatus": "active", "lockedCount": 18, "pendingCount": 2,   // scope all
    "reviewsToScore": 3,                                                             // scope team
    "myReviewStatus": "acknowledged"                                                 // scope self
  },
  "auditActivity": [{                          // null nếu actor KHÔNG có `audit:read`
    "id": "…", "actorUserId": "…", "resource": "payroll_variance", "action": "sign",
    "resourceId": "…", "occurredAt": "2026-08-06T…"
  }]
}
```

**Quy tắc dữ liệu (backend enforce, không phải gợi ý cho UI):**

- `null` = **không được phép xem hoặc không có nguồn dữ liệu**; `[]` / `0` = được xem nhưng rỗng.
  Frontend phải phân biệt hai thứ này và KHÔNG suy ra số nào.
- `payroll` chỉ xuất hiện khi actor có `payroll:prepare` hoặc `payroll:approve`. Manager và
  employee KHÔNG bao giờ nhận tổng lương công ty.
- `myPayslip` chỉ là phiếu của CHÍNH actor (suy từ access token), mọi scope.
- Scope `team`: tập nhân viên = chính mình + cấp dưới mọi tầng. Không có tổng lương, không có
  phiếu lương người khác, không có điểm chi tiết người khác — chỉ số lượng phiếu cần chấm.
- Scope `self`: chỉ chấm công/nghỉ phép/phiếu lương/phiếu đánh giá của chính mình;
  `headcount` = `null`.
- KHÔNG trả: lý do nghỉ phép, đường dẫn tài liệu, tài khoản ngân hàng, điểm chi tiết,
  và bất kỳ PII nào ngoài mã + tên nhân viên (cần để hiển thị hàng chờ duyệt).
- **Không có xếp hạng nhân sự / leaderboard** trong v1: xem điểm của người khác cần một chính
  sách quyền riêng, chưa được phê duyệt.
- Mọi mốc ngày (`attendanceToday.date`, `attendanceTrend[].date`, `payDate`, `startDate`,
  `endDate`) là **ngày theo timezone công ty** dạng `YYYY-MM-DD`; mọi mốc thời điểm
  (`generatedAt`, `submittedAt`, `occurredAt`) là ISO UTC. Backend đọc timezone từ
  `CompanyProfile`, KHÔNG dùng giờ máy chủ.
- Truy vấn trend giới hạn 30 ngày và luôn kèm khoảng ngày; không quét toàn collection.

### Kỳ lương: quy trình 7 bước

`GET /payroll/periods/:id` trả thêm `stage` (bước) song song với `status` (4 giá trị cũ, vẫn giữ để không phá client đang đọc):

`open` → `reconciling` → `trial` → `hr_reviewed` → `approved` → `paid` → `closed`

| Chuyển bước | Endpoint | Quyền |
| --- | --- | --- |
| open → reconciling | `POST /payroll/periods/:id/lock-attendance` | `payroll:prepare` |
| reconciling → trial | `POST /payroll/periods/:id/lock-evaluations` (tự chạy lương) hoặc `.../run` | `payroll:prepare` |
| trial → hr_reviewed | `POST /payroll/periods/:id/hr-review` | `payroll:prepare` |
| hr_reviewed → approved | `POST /payroll/periods/:id/approve` | `payroll:approve` |
| approved → paid | `POST /payroll/periods/:id/mark-paid` | `payroll:approve` |
| approved\|paid → closed | `POST /payroll/periods/:id/close` | `payroll:approve` |

Bước `trial → hr_reviewed` còn một cổng nữa: mọi chênh lệch đối soát song song phải được ký (xem mục dưới).

Làm sai thứ tự trả 409 `PAYROLL_STAGE_INVALID` (khác `PAYROLL_PERIOD_LOCKED` = kỳ đã đóng/đã chi). Cụ thể: duyệt khi chưa `hr-review`, mark-paid khi chưa `approved`, chốt kỳ khi lương chưa duyệt.

Đi ngược:

- `unlock-attendance` / `unlock-evaluations` lùi kỳ về `reconciling` (hoặc `open` nếu mở cả hai) và **xoá dấu HR đã soát** — đầu vào đổi thì mọi xác nhận cũ hết giá trị.
- Chạy lại tính lương (`run`) đưa kỳ về `trial` và cũng xoá dấu đã soát: bảng lương mới phải soát lại.
- `reopen` kỳ đã chốt quay về `trial`, phải soát và duyệt lại từ đầu.
- Duyệt LẺ một nhân viên (`approve` kèm `employeeId`) không đổi bước của kỳ, nên không thể chi trả tắt bước.
- Kỳ tạo trước khi có `stage` được suy ra từ `status` (`processing` → `approved`), không cần migration.

### Xuất phiếu lương, file đối soát và file ngân hàng

- **Phiếu lương từng người:** frontend in trực tiếp từ dữ liệu phiếu (`payslip-print.ts` → hộp thoại in / lưu PDF). Phiếu hiện thêm **dòng theo đoạn hợp đồng** khi đổi hợp đồng giữa kỳ, và **truy lĩnh/truy thu** thành dòng riêng thay vì gộp vào thưởng/khấu trừ khác.
- **File đối soát nội bộ:** `GET /payroll/periods/:id/export` → CSV toàn bộ bảng lương của kỳ (`text/csv`).
- **File chuyển khoản ngân hàng:** `GET /payroll/periods/:id/bank-file` (`payroll:approve`).

**Mẫu file ngân hàng do Admin/HR cấu hình**, không hard-code trong code:

- `GET /setting/bank-profiles` → `{ bankProfiles[] }`
- `POST /setting/bank-profiles` — `{ code, bankName, description?, delimiter?, includeHeader?, utf8Bom?, amountFormat?, dateFormat?, columns[] }` (`setting:manage`). Hồ sơ mới **không tự bật**.
- `PATCH /setting/bank-profiles/:id` — sửa mọi thứ trừ `code`.
- `POST /setting/bank-profiles/:id/activate` — bật hồ sơ này và tắt hồ sơ đang bật; luôn đúng MỘT hồ sơ active.
- `DELETE /setting/bank-profiles/:id` — hồ sơ đang bật không xoá được (422).

Mỗi cột khai `{ header, source, staticValue? }`. `source` ∈ `sequence`, `employee_code`, `employee_name`, `bank_account_number`, `bank_account_holder`, `bank_name`, `bank_branch`, `net_salary`, `period_name`, `pay_date`, `static`. Bắt buộc có `bank_account_number` và `net_salary`, nếu không 422 `BANK_TRANSFER_PROFILE_INVALID`. `delimiter` ∈ `,` `;` `\t` `|`; `amountFormat` ∈ `plain` | `grouped`; `dateFormat` ∈ `dd/MM/yyyy` | `yyyy-MM-dd` | `ddMMyyyy`; `utf8Bom` mặc định `true` (nhiều cổng ngân hàng đọc sai tiếng Việt nếu thiếu BOM).

`GET /payroll/periods/:id/bank-file` trả **JSON** (không phải file thuần) — `{ fileName, content, bankCode, bankName, rowCount, totalAmount, skipped[] }`:

- chỉ lấy phiếu `approved`/`paid`; phiếu `draft` vào `skipped` (chuyển tiền theo số chưa ai duyệt là sự cố);
- nhân viên chưa khai tài khoản ngân hàng, không tìm thấy, hoặc net = 0 cũng vào `skipped` kèm lý do — **không bao giờ bỏ im**;
- chưa bật hồ sơ ngân hàng nào → 409 `PAYROLL_BANK_PROFILE_MISSING`.

### Chạy song song hai phiên bản công thức + ký xác nhận chênh lệch

`PAYROLL_ENGINE_VERSION` hiện là **`v2`** (tách đoạn hợp đồng giữa kỳ + hồi tố). `v1` là công thức cũ, giữ lại CHỈ để đối soát.

- `POST /payroll/periods/:id/reconciliation` (`payroll:prepare`) — tính lại từng nhân viên của kỳ bằng `v1` ở chế độ **dry-run** (không ghi phiếu, không ghi người lập, không tăng `recomputeCount`) rồi ghi mọi chênh lệch. Trả `{ baselineEngine, targetEngine, comparedCount, varianceCount, unsignedCount, errors[] }`. `errors[]` = nhân viên engine cũ không tính được (thiếu hợp đồng…) — nêu rõ, không bỏ im.
- `GET /payroll/periods/:id/reconciliation` — `{ variances[], unsignedCount }`. Mỗi dòng: `{ employeeId, baselineEngine, targetEngine, baselineNet, targetNet, diff, fields[], detectedAt/By, signedBy, signedAt, explanation }`. `diff` dương = phiên bản mới trả cao hơn.
- `POST /payroll/periods/:id/reconciliation/:employeeId/sign` — `{ explanation }` bắt buộc, **tối thiểu 10 ký tự** (chặn "ok"/"đã xem"); 422 `PAYROLL_VARIANCE_SIGNOFF_INVALID` nếu quá ngắn hoặc đã ký. Nhận CẢ `payroll:prepare` và `payroll:approve` (yêu cầu là "HR/Admin ký"); bốn mắt vẫn nằm ở bước duyệt kỳ. Ghi audit `payroll_variance:sign`.

Chỉ sáu chỉ tiêu được so: `proRatedBaseSalary`, `grossSalary`, `insurance`, `tax`, `totalDeductions`, `netSalary` — so cả `breakdown` thì một chênh lệch gốc kéo theo hàng chục ô phái sinh, bảng đối soát mất khả năng đọc.

**Cổng chặn:** còn dòng chưa ký thì `POST /payroll/periods/:id/hr-review` trả 409 `PAYROLL_VARIANCE_UNSIGNED` — kỳ đứng lại ở bước `trial`. Kỳ chưa từng chạy đối soát không có bản ghi nào nên không bị chặn (tương thích ngược).

**Chạy lại nhiều lần:** hai engine đã khớp thì bản ghi bị xoá; số chênh lệch ĐỔI thì chữ ký cũ bị xoá và phải ký lại (một lời giải thích chỉ bảo lãnh cho đúng con số nó giải thích); số không đổi thì chữ ký giữ nguyên.

### Lương: bốn mắt, truy vết, đoạn hợp đồng, hồi tố

**Tách quyền.** `payroll:prepare` = lập/tính/tính lại/hoàn tác. `payroll:approve` = duyệt / mark paid / chốt / mở lại kỳ. Ngoài tách quyền còn có rào runtime: nếu `period.preparedBy` chính là người bấm duyệt thì 403 `PAYROLL_SELF_APPROVAL_FORBIDDEN` — rào này chặn cả `admin` giữ `*`.

**Truy vết.** Phiếu lương trả thêm:

- `inputs` — `{ engineVersion, salaryPolicyId, taxProfileId, allowanceIds[], bonusIds[], deductionIds[], contractIds[], retroIds[], computedBy, recomputeCount }`. `recomputeCount > 0` nghĩa là đầu vào đã bị sửa sau lần tính đầu.
- `segments[]` — dòng lương theo từng đoạn hợp đồng khi đổi hợp đồng giữa kỳ: `{ contractId, contractNumber, employmentStatus, from, to, workDays, baseSalary, effectiveBase, attendanceRatio, proRatedBaseSalary }`. Tổng `proRatedBaseSalary` của các đoạn = `breakdown.proRatedBaseSalary`. Bảo hiểm và thuế vẫn tính MỘT LẦN trên tổng tháng.

**Hồi tố (truy lĩnh/truy thu).** Sửa sai của kỳ ĐÃ CHỐT mà không mở lại kỳ đó:

- `POST /payroll/retro-adjustments` — `{ employeeId, kind: "claim"|"clawback", amount, originPeriodId, payoutPeriodId, reason, taxable? }` (`payroll:prepare`). `amount` luôn > 0 (chiều tiền do `kind` quyết định); `originPeriodId` phải KHÁC `payoutPeriodId` (cùng kỳ thì dùng bonus/deduction) — sai thì 422 `RETRO_ADJUSTMENT_INVALID`. Kỳ chi trả đã `closed`/`paid` thì 409 `PAYROLL_PERIOD_LOCKED`.
- `GET /payroll/retro-adjustments?employeeId&payoutPeriodId&originPeriodId` — gồm cả bản ghi đã huỷ.
- `POST /payroll/retro-adjustments/:id/cancel` — `{ reason }` bắt buộc; chỉ khi phiếu lương kỳ chi trả còn `draft` (nếu không: 409 `PAYSLIP_ALREADY_FINALIZED`). Không xoá bản ghi, chỉ chuyển `cancelled` kèm người huỷ + lý do.

Vào lương: `claim` cộng vào `grossSalary` và CHỊU thuế ở kỳ nhận tiền (`breakdown.totalRetroClaims`); `clawback` khấu trừ SAU thuế (`breakdown.totalRetroClawbacks`, nằm trong `totalDeductions`) vì kỳ gốc đã nộp thuế trên số tiền đó. Truy thu vượt lương tháng thì net chặn ở 0 — phần còn lại phải tạo bản ghi truy thu mới ở kỳ sau, hệ thống KHÔNG tự mang nợ sang kỳ.

### Đơn nghỉ phép: tự phục vụ + HR nộp thay

Đơn nghỉ TÁCH khỏi `attendance:manage` thành ba nhóm khoá, mỗi nhóm có bản thu hẹp phạm vi:

| Hành động | Khoá | Ai giữ |
| --- | --- | --- |
| Nộp / huỷ | `leave:submit` / `:team` / `:self` | HR (mọi người) · Manager (mình + cấp dưới) · Employee (chính mình) |
| Xem đơn + số dư | `leave:read` / `:team` / `:self` | như trên |
| Duyệt / từ chối | `leave:approve` / `:team` | HR (mọi người) · Manager (cấp dưới). **Employee không duyệt, kể cả đơn của mình** |

- `POST /attendance/leave-requests` — `employeeId` **tuỳ chọn**. Bỏ trống = nhân viên tự nộp cho mình, backend suy ra từ access token. HR/Manager nộp thay thì truyền `employeeId` của người xin nghỉ; ngoài phạm vi → 403.
- `POST /attendance/leave-requests/:id/cancel` — dùng chung quyền với nộp: nhân viên tự huỷ đơn của mình, HR huỷ thay được. Đơn đã duyệt khi huỷ sẽ hoàn lại số dư và xoá bản ghi chấm công đã sinh.
- `GET /attendance/leave-requests` — trả về đúng phạm vi của actor. Lọc `?employeeId=` là thu hẹp THÊM; truyền id ngoài phạm vi → 403 (không im lặng trả rỗng).
- `GET /attendance/leave-requests/:id` — 404 nếu không tồn tại, 403 nếu ngoài phạm vi.
- `GET /attendance/leave-balances?year=` — `employeeId` **tuỳ chọn**, bỏ trống = số dư của chính actor. Response `{ employeeId, balances[], annualRemaining, carryoverYears }`. Nạp hạn mức (`POST`) vẫn thuộc `attendance:manage`.
- **Loại phép**: `annual` (phép năm, bể cộng dồn `carryoverYears` = 3 năm) và `unpaid` (không lương, không giới hạn) là hai khoá domain hiểu; loại khác (`sick`, `maternity`, ...) là hạn mức tuỳ công ty, cấu hình bằng cách nạp `LeaveBalance` cho khoá đó.
- **Hạn mức**: `annual` xét theo BỂ cộng dồn (`annualRemaining`); loại khác xét theo đúng dòng số dư của năm. Vượt thì trả 422 `LEAVE_QUOTA_EXCEEDED`.

### Đánh giá hiệu suất (module `/performance`)

Quyền: `performance:manage` (HR — chu kỳ, bộ tiêu chí, duyệt, KHOÁ điểm), `performance:review`/`:team` (chấm điểm — **không có `:self`**, không ai tự chấm cho mình), `performance:read`/`:team`/`:self` (xem phiếu).

**Bộ tiêu chí có phiên bản.** Sửa tiêu chí = **phát hành phiên bản mới**, không sửa bản cũ:

- `POST /performance/criteria-sets` — `{ name, description? }`.
- `POST /performance/criteria-sets/:criteriaSetId/versions` — `{ criteria: [{ code, name, kind, weight }] }`. `kind` ∈ `kpi | goal | performance`; **tổng trọng số trong MỖI nhóm phải bằng 100** (lệch → 422). Số phiên bản tự tăng.
- `GET /performance/criteria-sets` — trả toàn bộ phiên bản kèm `latestVersion`.

**Chu kỳ đánh giá** gắn 1–1 với một kỳ lương và CHỐT một phiên bản tiêu chí:

- `POST /performance/cycles` — `{ name, payrollPeriodId, criteriaSetId, criteriaVersion? }`. Bỏ trống `criteriaVersion` → chốt bản mới nhất *tại thời điểm tạo*. Một kỳ lương chỉ được một chu kỳ (409 `APPRAISAL_CYCLE_CONFLICT`).
- `POST /performance/cycles/:cycleId/activate` — mở chu kỳ và **tạo phiếu cho MỌI nhân viên đang làm việc**, người chấm mặc định là quản lý trực tiếp; `{ fallbackReviewerUserId? }` cho người không có quản lý. Idempotent (gọi lại chỉ thêm phiếu cho người mới).
- `GET /performance/cycles/:cycleId/readiness` — `{ totalActiveEmployees, lockedCount, pendingEmployeeIds[], countByStatus, ready }`. Đây là câu trả lời cho "mọi nhân viên đã có điểm hợp lệ chưa".
- `POST /performance/cycles/:cycleId/close` — chỉ khi `ready` (409 `APPRAISAL_CYCLE_NOT_READY`).

**Phiếu đánh giá** — vòng đời một chiều tới `locked`:

```
draft ──score(QL/HR)──► submitted ──approve(HR)──► approved
  ▲                          │                       ├──acknowledge(NV)──► acknowledged ──lock(HR)──► locked
  └───request-changes(HR)────┘                       └──appeal(NV)───────► appealed
  ▲                                                                          │
  └────resolve-appeal(HR, rescore=true)──────────────────────────────────────┘
             resolve-appeal(HR, rescore=false) ──► acknowledged
```

- `PUT /performance/reviews/:reviewId/scores` — `{ scores: [{ criterionId, score }], managerNote?, strengths?, improvements?, developmentPlan? }`. Điểm 0–100 từng tiêu chí; **ba điểm tổng hợp do BACKEND tính** (bình quân gia quyền theo nhóm của đúng phiên bản tiêu chí trên phiếu) — client không gửi lên. Thiếu điểm một tiêu chí → 422.
- `POST .../approve` `{ hrNote? }` · `POST .../request-changes` `{ hrNote }` (bắt buộc).
- `POST .../acknowledge` — **chỉ chính nhân viên đó**; HR bấm thay → 403.
- `POST .../appeal` `{ reason }` bắt buộc; lý do giữ vĩnh viễn trên phiếu.
- `POST .../resolve-appeal` `{ hrNote, rescore }` — `rescore: true` trả phiếu về `draft`, `false` giữ điểm và chuyển `acknowledged`.
- `POST .../lock` — chỉ từ `acknowledged`. **Chụp điểm sang kỳ lương** rồi phiếu bất biến (mọi thao tác sau → 409).
- `PATCH .../reviewer` `{ reviewerUserId }` — HR đổi người chấm, chỉ khi phiếu chưa duyệt.
- `GET /performance/reviews?cycleId&employeeId&status&assignedToMe=true` — theo phạm vi; `assignedToMe` là hàng việc của người chấm.

**Điểm vào lương chỉ qua BẢN CHỤP.** Khoá phiếu → ghi `{ performanceScore, goalScore }` vào `PayrollPeriod.evaluations` của kỳ lương. Payroll **không bao giờ đọc lại phiếu đánh giá** khi tính lương, nên:

- phát hành phiên bản tiêu chí mới, chấm lại hay sửa phiếu về sau **không làm đổi lương đã tính**;
- phiếu giữ `criteriaSetId` + `criteriaVersion` của riêng nó, nên điểm cũ luôn đọc được theo đúng bộ tiêu chí lúc chấm.

Kỳ lương đã chốt đánh giá thì từ chối nhận bản chụp mới (409) — muốn đổi phải mở khoá kỳ.

**Chốt đánh giá bên Payroll** (`POST /payroll/periods/:id/lock-evaluations`) bị chặn 409 `PAY_EVALUATION_INCOMPLETE` khi chu kỳ gắn kỳ đó còn nhân viên chưa khoá điểm. `GET /payroll/periods/:id/evaluation-readiness` trả thêm `pendingEmployeeIds` và `appraisalCycleId` (`null` = kỳ không gắn chu kỳ nào → chạy với điểm mặc định 100).

### Ranh giới Payroll v1

Trong `RunPayrollForEmployeeUseCase`, `performanceRatio` và `goalRatio` lấy từ BẢN CHỤP điểm trong kỳ lương. Kỳ chưa có bản chụp cho nhân viên nào (công ty không dùng module Đánh giá cho kỳ đó) → mặc định 100; bản ghi tồn tại mà điểm dở dang → `PAY_EVALUATION_INCOMPLETE`. `lock-evaluations` chỉ là cổng workflow thủ công để giữ state period nhất quán. Do đó:

- Tăng ca (OT) chưa nằm trong phạm vi: không có trường OT trên bản ghi chấm công, `overtimePay` luôn 0.

### Acceptance contract cho từng lát

- Mọi request từ service frontend phải có đúng module prefix, HTTP verb và param name của router backend.
- Payload và response type lấy từ controller/presenter, không từ mock UI hoặc tài liệu HTML cũ.
- Một lỗi API phải hiển thị `message`; không nuốt lỗi và thay bằng dữ liệu mock.
- Không thay đổi endpoint hay schema ngoài lát được giao mà không cập nhật tài liệu này.

## Action Items

- Đồng bộ service frontend theo bảng prefix trước khi chỉnh UI.
- Smoke test tích hợp đã có ở `backend/tests-integration/`: `hr-lifecycle.test.ts` (login → phòng ban → nhân viên → hợp đồng → chấm công → payroll) và `hr-onboarding-rbac.test.ts` (master data → CSV import → grant-login → kích hoạt → buộc đổi mật khẩu → phạm vi self/team → audit).
- Performance đã có module riêng: điểm vào lương qua snapshot đã khoá (xem “Đánh giá → Lương”), KHÔNG sửa các ratio trong Payroll để mô phỏng điểm.

## Related Notes

- [[DATABASE]]
- [[CLAUDE-EXECUTION-PLAN]]
