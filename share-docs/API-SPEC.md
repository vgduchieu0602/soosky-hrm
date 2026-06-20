# Soosky HRM — API Specification

> **Stack:** Node.js · Express · TypeScript · Mongoose · MongoDB
> **Related:** [DATABASE.md](./DATABASE.md) · [ARCHITECTURE.md](./ARCHITECTURE.md) · [CONVENTIONS.md](./CONVENTIONS.md)

---

## 1. Overview

- **Base URL:** `/api/v1`
- **Versioning:** URL path (`/api/v1/...`, `/api/v2/...`)
- **Content-Type:** `application/json` (JSON body); `multipart/form-data` for file uploads
- **Charset:** UTF-8
- **Dates:** ISO 8601 UTC (`2026-05-19T08:30:00Z`)
- **IDs:** MongoDB ObjectId as 24-char hex string
- **Money:** stringified Decimal128 (e.g., `"15000000.00"`) to preserve precision

---

## 2. Authentication

- **Method:** JWT Bearer token
- **Header:** `Authorization: Bearer <accessToken>`
- **Token flow:**
  - **Access token** — short-lived (15 min), sent in `Authorization` header
  - **Refresh token** — long-lived (7 days), stored in **httpOnly cookie** `rt`, rotated on every use
  - Refresh token is hashed and stored in `sessions` collection — supports multi-device & revocation
- **No public registration.** Accounts are provisioned by HR via `POST /admin/employees/:id/grant-login` — employee receives a temp password via email and must change it on first login (`mustChangePassword`).
- **Public routes:** `POST /auth/login`, `POST /auth/refresh`, `POST /auth/forgot-password`, `POST /auth/reset-password`, health checks.
- **Auth errors:**
  - `401 Unauthorized` — missing / invalid / expired access token
  - `403 Forbidden` — valid token but lacking role or permission

---

## 3. Request Conventions

### Pagination (query)

- `page` — number, default `1`
- `limit` — number, default `20`, max `100`
- Example: `GET /employees?page=2&limit=50`

### Sorting

- `sort` — field name, `-` prefix for descending
- Example: `GET /employees?sort=-createdAt`

### Filtering

- Single value: `?status=active`
- Multiple values: `?status=active,on_leave`
- Range: `?hiredFrom=2024-01-01&hiredTo=2024-12-31`
- Text search: `?q=Nguyen`
- Reference filter: `?departmentId=64f...`
- Example: `GET /employees?departmentId=64f...&status=active&q=Nguyen`

### Body

- JSON, **camelCase** field names (matches Mongoose schema fields)
- Strict types — fail with `422` if unknown fields or wrong type

### File upload

- `Content-Type: multipart/form-data`
- Field name: `file` (single) / `files` (multiple)
- Max size: **10 MB** per file for documents/contracts; **2 MB** for avatars
- Allowed types:
  - Avatars: `image/jpeg`, `image/png`, `image/webp`
  - Documents: `application/pdf`, `image/jpeg`, `image/png`
  - Payslips: generated server-side (`application/pdf`)

---

## 4. Response Format

**Success — single item**

```json
{
  "success": true,
  "data": { "...": "..." },
  "message": "Optional success message"
}
```

**Success — list with pagination**

```json
{
  "success": true,
  "data": [{ "...": "..." }],
  "meta": { "page": 1, "limit": 20, "total": 124, "totalPages": 7 }
}
```

**Error**

```json
{
  "success": false,
  "error": {
    "code": "EMP_003",
    "message": "Employee already has a linked user account",
    "details": { "employeeId": "64f...", "userId": "64a..." }
  }
}
```

---

## 5. Error Codes

**Format:** `[FEATURE]_[NUMBER]`

| Prefix                | Feature            |
| --------------------- | ------------------ |
| `IAM_001`–`IAM_099`   | Identity & Access  |
| `ORG_001`–`ORG_099`   | Organization       |
| `EMP_001`–`EMP_099`   | Employee           |
| `ATT_001`–`ATT_099`   | Attendance & Leave |
| `PAY_001`–`PAY_099`   | Payroll            |
| `PERF_001`–`PERF_099` | Performance        |
| `SYS_001`–`SYS_099`   | System             |

**Common error codes**

| Code       | HTTP | Description                                          |
| ---------- | ---- | ---------------------------------------------------- |
| `IAM_001`  | 401  | Invalid credentials                                  |
| `IAM_002`  | 401  | Access token expired                                 |
| `IAM_003`  | 401  | Refresh token invalid or revoked                     |
| `IAM_004`  | 403  | Insufficient role / permission                       |
| `IAM_005`  | 423  | Account locked (too many failed attempts)            |
| `IAM_006`  | 409  | Email or username already in use                     |
| `IAM_007`  | 400  | Must change temporary password before continuing     |
| `ORG_001`  | 404  | Department not found                                 |
| `ORG_002`  | 409  | Cannot delete department with active employees       |
| `ORG_003`  | 400  | Circular parent department reference                 |
| `EMP_001`  | 404  | Employee not found                                   |
| `EMP_002`  | 409  | Employee code already exists                         |
| `EMP_003`  | 409  | Employee already has a linked user account           |
| `EMP_004`  | 400  | Cannot terminate already-terminated employee         |
| `ATT_001`  | 404  | Attendance record not found                          |
| `ATT_002`  | 409  | Already checked in today                             |
| `ATT_003`  | 400  | Check-out before check-in                            |
| `ATT_004`  | 400  | Insufficient leave balance                           |
| `ATT_005`  | 409  | Overlapping leave request already pending/approved   |
| `PAY_001`  | 404  | Payroll period not found                             |
| `PAY_002`  | 409  | Period is closed; no further modifications allowed   |
| `PAY_003`  | 400  | Salary structure missing for employee in this period |
| `PAY_004`  | 409  | Payroll already computed for this period             |
| `PERF_001` | 404  | Appraisal cycle not found                            |
| `PERF_002` | 400  | Review submitted after deadline                      |
| `PERF_003` | 409  | Review already submitted                             |
| `SYS_001`  | 500  | Internal server error                                |
| `SYS_002`  | 422  | Validation error (see `details`)                     |
| `SYS_003`  | 429  | Too many requests                                    |

**HTTP status usage:** `200` GET/PATCH · `201` POST · `204` DELETE · `400` bad request · `401` unauthorized · `403` forbidden · `404` not found · `409` conflict · `422` validation · `429` rate-limited · `500` server error.

---

## 6. Endpoints by Feature

### 6.1 IAM — Authentication & Identity

| Method | Path                    | Description                              | Auth        |
| ------ | ----------------------- | ---------------------------------------- | ----------- |
| POST   | `/auth/login`           | Login with email + password              | No          |
| POST   | `/auth/refresh`         | Rotate access token using refresh cookie | No (cookie) |
| POST   | `/auth/logout`          | Revoke current session                   | Yes         |
| POST   | `/auth/logout-all`      | Revoke all sessions for current user     | Yes         |
| GET    | `/auth/me`              | Current user + employee profile          | Yes         |
| PATCH  | `/auth/change-password` | Change own password                      | Yes         |
| POST   | `/auth/forgot-password` | Send reset link to personal email        | No          |
| POST   | `/auth/reset-password`  | Reset password with token                | No          |
| GET    | `/auth/sessions`        | List own active sessions                 | Yes         |
| DELETE | `/auth/sessions/:id`    | Revoke a specific session                | Yes         |

**Admin sub-routes:**

| Method | Path                             | Description                                     | Auth  |
| ------ | -------------------------------- | ----------------------------------------------- | ----- |
| GET    | `/admin/users`                   | List users (filter by status, role)             | Admin |
| GET    | `/admin/users/:id`               | User detail                                     | Admin |
| PATCH  | `/admin/users/:id`               | Update status (`disable`/`enable`/`unlock`)     | Admin |
| GET    | `/admin/roles`                   | List roles                                      | Admin |
| POST   | `/admin/roles`                   | Create custom role                              | Admin |
| PATCH  | `/admin/roles/:id`               | Update role                                     | Admin |
| DELETE | `/admin/roles/:id`               | Delete role (non-system only)                   | Admin |
| GET    | `/admin/permissions`             | List permissions                                | Admin |
| PUT    | `/admin/roles/:id/permissions`   | Replace role's permission set                   | Admin |
| POST   | `/admin/users/:id/roles`         | Assign role to user                             | Admin |
| DELETE | `/admin/users/:id/roles/:roleId` | Revoke role from user                           | Admin |
| GET    | `/admin/audit-logs`              | Query audit logs (filter by user/resource/date) | Admin |

### 6.2 Organization

| Method | Path                     | Description                              | Auth       |
| ------ | ------------------------ | ---------------------------------------- | ---------- |
| GET    | `/departments`           | List departments (flat or `?tree=true`)  | Yes        |
| GET    | `/departments/:id`       | Department detail + member count         | Yes        |
| POST   | `/admin/departments`     | Create department                        | HR / Admin |
| PATCH  | `/admin/departments/:id` | Update (name, manager, parent)           | HR / Admin |
| DELETE | `/admin/departments/:id` | Archive department (no active employees) | HR / Admin |
| GET    | `/positions`             | List positions (filter by department)    | Yes        |
| GET    | `/positions/:id`         | Position detail                          | Yes        |
| POST   | `/admin/positions`       | Create position                          | HR / Admin |
| PATCH  | `/admin/positions/:id`   | Update position                          | HR / Admin |
| DELETE | `/admin/positions/:id`   | Archive position                         | HR / Admin |

### 6.3 Employee

| Method | Path                                          | Description                               | Auth          |
| ------ | --------------------------------------------- | ----------------------------------------- | ------------- |
| GET    | `/employees`                                  | List employees (filter, search, paginate) | Yes           |
| GET    | `/employees/stats`                            | Aggregate counts by status                | Yes           |
| GET    | `/employees/export`                           | Export filtered list as CSV (`text/csv`)  | Yes           |
| GET    | `/employees/:id`                              | Employee detail (core + profile summary)  | Yes           |
| GET    | `/employees/me`                               | Own employee record                       | Yes           |
| POST   | `/admin/employees`                            | Create employee + profile (no login yet)  | HR / Admin    |
| PATCH  | `/admin/employees/:id`                        | Update org info (dept, position, manager, status) | HR / Admin    |
| POST   | `/admin/employees/:id/grant-login`            | **Provision user account** (atomic)       | HR / Admin    |
| POST   | `/admin/employees/:id/terminate`              | Mark as terminated; revoke sessions       | HR / Admin    |
| GET    | `/employees/:id/account`                      | Linked login account summary              | Yes (self/HR) |
| POST   | `/admin/employees/:id/reset-password`         | Issue new temp password + email it        | HR / Admin    |
| POST   | `/admin/employees/:id/resend-invite`          | Re-send activation invite                 | HR / Admin    |
| PATCH  | `/admin/employees/:id/account`                | Enable/disable login; change role         | HR / Admin    |
| GET    | `/employees/:id/profile`                      | Profile (PII)                             | Yes (self/HR) |
| PATCH  | `/employees/:id/profile`                      | Update profile                            | Yes (self/HR) |
| GET    | `/employees/:id/documents`                    | List documents                            | Yes (self/HR) |
| POST   | `/employees/:id/documents`                    | Upload document                           | Yes (self/HR) |
| DELETE | `/employees/:id/documents/:docId`             | Delete document                           | HR / Admin    |
| GET    | `/employees/:id/contacts`                     | List emergency contacts                   | Yes (self/HR) |
| POST   | `/employees/:id/contacts`                     | Add contact                               | Yes (self/HR) |
| PATCH  | `/employees/:id/contacts/:contactId`          | Update contact                            | Yes (self/HR) |
| DELETE | `/employees/:id/contacts/:contactId`          | Remove contact                            | Yes (self/HR) |
| GET    | `/employees/:id/bank-accounts`                | List bank accounts                        | Yes (self/HR) |
| POST   | `/employees/:id/bank-accounts`                | Add bank account                          | Yes (self/HR) |
| PATCH  | `/employees/:id/bank-accounts/:accountId`     | Update / set primary                      | Yes (self/HR) |
| GET    | `/employees/:id/contracts`                    | List contracts (versioned)                | Yes (self/HR) |
| POST   | `/admin/employees/:id/contracts`              | Add new contract                          | HR / Admin    |
| PATCH  | `/admin/employees/:id/contracts/:contractId`  | Update contract                           | HR / Admin    |
| GET    | `/employees/:id/history`                      | HR event timeline                         | Yes (self/HR) |
| GET    | `/employees/:id/assets`                       | List assigned assets                      | Yes (self/HR) |
| POST   | `/admin/employees/:id/assets`                 | Assign asset                              | HR / Admin    |
| PATCH  | `/admin/employees/:id/assets/:assetId/return` | Mark asset returned                       | HR / Admin    |

### 6.4 Attendance & Leave

| Method | Path                                | Description                               | Auth         |
| ------ | ----------------------------------- | ----------------------------------------- | ------------ |
| POST   | `/attendances/check-in`             | Punch in                                  | Yes          |
| POST   | `/attendances/check-out`            | Punch out                                 | Yes          |
| GET    | `/attendances/me`                   | Own attendance records (filter by month)  | Yes          |
| GET    | `/admin/attendances`                | All attendances (filter by employee/date) | HR / Manager |
| PATCH  | `/admin/attendances/:id`            | Manual correction                         | HR           |
| GET    | `/shifts`                           | List shifts                               | Yes          |
| POST   | `/admin/shifts`                     | Create shift                              | HR / Admin   |
| PATCH  | `/admin/shifts/:id`                 | Update shift                              | HR / Admin   |
| GET    | `/leave-requests/me`                | Own leave requests                        | Yes          |
| POST   | `/leave-requests`                   | Submit leave request                      | Yes          |
| PATCH  | `/leave-requests/:id`               | Cancel own pending request                | Yes          |
| GET    | `/leave-requests/pending-approval`  | Requests awaiting current user's approval | Manager      |
| POST   | `/leave-requests/:id/approve`       | Approve                                   | Manager / HR |
| POST   | `/leave-requests/:id/reject`        | Reject (with reason)                      | Manager / HR |
| GET    | `/leave-balances/me`                | Own balances for the year                 | Yes          |
| GET    | `/admin/leave-balances/:employeeId` | Any employee's balances                   | HR           |
| GET    | `/holidays`                         | List holidays for a year/country          | Yes          |
| POST   | `/admin/holidays`                   | Create holiday                            | HR / Admin   |
| PATCH  | `/admin/holidays/:id`               | Update holiday                            | HR / Admin   |
| DELETE | `/admin/holidays/:id`               | Delete holiday                            | HR / Admin   |

### 6.5 Payroll

> **Đã triển khai** (prefix `/api/v1`). Tất cả endpoint dưới yêu cầu role `admin`/`hr_manager`, trừ `mark-paid` chỉ `admin`. Tiền trả về dạng chuỗi Decimal128.

**Kỳ lương & chạy tính (Period & Run)**

| Method | Path                                        | Description                                       | Auth       |
| ------ | ------------------------------------------- | ------------------------------------------------- | ---------- |
| GET    | `/payroll/periods`                          | List periods                                      | HR / Admin |
| GET    | `/payroll/periods/:id`                      | Period detail                                     | HR / Admin |
| POST   | `/payroll/periods`                          | Create period (auto `standardWorkDays`)           | HR / Admin |
| PATCH  | `/payroll/periods/:id`                      | Update period (chặn nếu đã khóa)                  | HR / Admin |
| POST   | `/payroll/periods/:id/close`                | Khóa kỳ (lock run/edit)                           | HR / Admin |
| POST   | `/payroll/periods/:id/run`                  | **Chạy lương toàn kỳ** (body `requireApprovedEvaluation?`) | HR / Admin |
| POST   | `/payroll/periods/:id/run/:employeeId`      | Chạy lương 1 nhân viên                            | HR / Admin |

**Bảng lương đã tính (Payrolls)**

| Method | Path                                   | Description                                   | Auth       |
| ------ | -------------------------------------- | --------------------------------------------- | ---------- |
| GET    | `/payroll/payrolls`                    | List (filter `payrollPeriodId`/`employeeId`/`status`, phân trang) | HR / Admin |
| GET    | `/payroll/payrolls/:id`                | Payroll detail                                | HR / Admin |
| GET    | `/payroll/periods/:periodId/totals`    | Tổng quỹ gross/net theo status (cho BOD)      | HR / Admin |

**Workflow duyệt → thanh toán**

| Method | Path                                   | Description                                   | Auth       |
| ------ | -------------------------------------- | --------------------------------------------- | ---------- |
| POST   | `/payroll/periods/:id/approve`         | Duyệt (body `employeeId?` để duyệt 1 NV)      | HR / Admin |
| POST   | `/payroll/payrolls/:id/revert`         | Mở lại bản đã duyệt về `draft`                | HR / Admin |
| POST   | `/payroll/periods/:id/mark-paid`       | Đánh dấu thanh toán & khóa kỳ                 | **Admin**  |

**Nhập liệu cấu phần lương (per employee)**

| Method | Path                                            | Description                  | Auth       |
| ------ | ----------------------------------------------- | ---------------------------- | ---------- |
| GET    | `/payroll/employees/:employeeId/allowances`     | Phụ cấp của NV               | HR / Admin |
| POST   | `/payroll/allowances`                           | Thêm phụ cấp                 | HR / Admin |
| PATCH  | `/payroll/allowances/:id`                       | Sửa phụ cấp                  | HR / Admin |
| DELETE | `/payroll/allowances/:id`                       | Xóa phụ cấp                  | HR / Admin |
| GET    | `/payroll/employees/:employeeId/bonuses`        | Thưởng của NV                | HR / Admin |
| POST   | `/payroll/bonuses`                              | Thêm thưởng (theo kỳ)        | HR / Admin |
| PATCH  | `/payroll/bonuses/:id`                          | Sửa thưởng                   | HR / Admin |
| DELETE | `/payroll/bonuses/:id`                          | Xóa thưởng                   | HR / Admin |
| GET    | `/payroll/employees/:employeeId/deductions`     | Khấu trừ của NV              | HR / Admin |
| POST   | `/payroll/deductions`                           | Thêm khấu trừ                | HR / Admin |
| PATCH  | `/payroll/deductions/:id`                       | Sửa khấu trừ                 | HR / Admin |
| DELETE | `/payroll/deductions/:id`                       | Xóa khấu trừ                 | HR / Admin |
| GET    | `/payroll/employees/:employeeId/tax-profiles`   | Lịch sử hồ sơ thuế NV        | HR / Admin |
| POST   | `/payroll/tax-profiles`                         | Thêm hồ sơ thuế (versioned)  | HR / Admin |

> **Chưa triển khai (pha sau):** salary-structures, payslips (`/payslips/me`, `/payslips/:id`), export ngân hàng. Salary policy config quản lý ở `settings` (`GET /settings/salary-policies`, `POST/PATCH /admin/settings/salary-policies`).

### 6.6 Performance

> **Đã triển khai — Monthly Evaluation (HR/QL chấm trực tiếp, NV xem).** Prefix `/api/v1`. Không cần "khởi tạo": HR mở list NV → chấm → `finalize=false` (nháp) hoặc `true` (duyệt). `performanceRatio` = TB chỉ số `type=performance`; `goalRatio` = TB chỉ số `type=goal` (đều `Σ(score×weight)/Σweight`). Payroll chỉ chạy khi evaluation `approved`/`acknowledged`.

| Method | Path                                          | Description                                  | Auth        |
| ------ | --------------------------------------------- | -------------------------------------------- | ----------- |
| GET    | `/performance/evaluations?payrollPeriodId=`   | List đánh giá theo kỳ                        | HR / Admin  |
| GET    | `/performance/evaluations/me`                 | Đánh giá của chính tôi (xem)                 | Yes         |
| GET    | `/performance/evaluations/:id`                | Chi tiết                                     | Yes         |
| POST   | `/performance/evaluations`                    | **Chấm trực tiếp** (upsert): `{employeeId, payrollPeriodId, criteriaScores[], strengths?, finalize?}` → `draft`/`approved` | HR / Admin |
| POST   | `/performance/evaluations/:id/acknowledge`    | NV xác nhận (kèm `disputeNote?`) → `acknowledged` | Yes (NV) |
| POST   | `/performance/evaluations/:id/reopen`         | Mở lại `approved` → `draft`                  | HR / Admin  |

Chỉ số (performance 60% + goal 20%) quản lý ở `settings`: `GET /settings/performance-criteria`, `POST/PATCH/DELETE /admin/settings/performance-criteria` (kèm `type`).

> **Chưa triển khai (pha sau)** — appraisal cycle tách rời, goals, KPIs, multi-source feedback:

| Method | Path                                   | Description                        | Auth                  |
| ------ | -------------------------------------- | ---------------------------------- | --------------------- |
| GET    | `/appraisal-cycles`                    | List cycles                        | Yes                   |
| GET    | `/appraisal-cycles/:id`                | Cycle detail                       | Yes                   |
| POST   | `/admin/appraisal-cycles`              | Create cycle                       | HR / Admin            |
| PATCH  | `/admin/appraisal-cycles/:id`          | Update / change status             | HR / Admin            |
| GET    | `/goals/me?cycleId=...`                | Own goals for cycle                | Yes                   |
| POST   | `/goals`                               | Create goal                        | Yes                   |
| PATCH  | `/goals/:id`                           | Update progress / details          | Yes (owner/manager)   |
| DELETE | `/goals/:id`                           | Delete own goal                    | Yes                   |
| GET    | `/kpis/me?cycleId=...`                 | Own KPIs                           | Yes                   |
| POST   | `/admin/employees/:id/kpis`            | Manager assigns KPI                | Manager / HR          |
| PATCH  | `/kpis/:id`                            | Update achieved value              | Yes (owner/manager)   |
| GET    | `/performance-reviews/me`              | Reviews **of** me                  | Yes                   |
| GET    | `/performance-reviews/assigned`        | Reviews I must complete            | Manager               |
| POST   | `/performance-reviews`                 | Create review draft                | Manager / HR          |
| PATCH  | `/performance-reviews/:id`             | Update draft                       | Manager               |
| POST   | `/performance-reviews/:id/submit`      | Submit final review                | Manager               |
| POST   | `/performance-reviews/:id/acknowledge` | Employee acknowledges              | Yes (subject)         |
| GET    | `/performance-reviews/:id/feedbacks`   | List feedbacks                     | Yes (subject/manager) |
| POST   | `/performance-reviews/:id/feedbacks`   | Add self / peer / manager feedback | Yes                   |

---

## 7. Endpoint Details (Workflow-Critical)

### 7.1 `POST /auth/login`

```json
// Request
{ "email": "hieu.vd@soosky.co", "password": "P@ssw0rd!" }
```

```json
// 200 OK
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOi...",
    "user": {
      "id": "64f0a1...",
      "email": "hieu.vd@soosky.co",
      "roles": ["hr_manager"],
      "mustChangePassword": false,
      "employee": {
        "id": "64f0b2...",
        "employeeCode": "EMP-0001",
        "fullName": "Vương Đức Hiếu",
        "department": "Engineering"
      }
    }
  }
}
```

- `rt` cookie set: `httpOnly`, `Secure`, `SameSite=Strict`, 7-day TTL
- **Errors:** `IAM_001` (401) invalid credentials · `IAM_005` (423) account locked after N failures · `IAM_007` (400) `mustChangePassword=true` — client must call `/auth/change-password` before other endpoints.

### 7.2 `POST /admin/employees` — Create employee (no login yet)

```json
// Request
{
  "employeeCode": "EMP-0042",
  "departmentId": "64f0c0...",
  "positionId": "64f0c1...",
  "managerId": "64f0a1...",
  "hireDate": "2026-06-01",
  "employeeType": "full_time",
  "profile": {
    "firstName": "Lan",
    "lastName": "Nguyen Thi",
    "dateOfBirth": "1998-04-15",
    "gender": "female",
    "nationality": "VN",
    "personalEmail": "lan.nt@gmail.com",
    "phone": "+84901234567"
  }
}
```

```json
// 201 Created
{
  "success": true,
  "data": {
    "id": "64f0d0...",
    "employeeCode": "EMP-0042",
    "userId": null,
    "status": "onboarding"
  },
  "message": "Employee created. Run grant-login to provision account."
}
```

- **Atomic:** creates `employees` + `employeeProfiles` in one transaction.
- **Errors:** `EMP_002` (409) duplicate `employeeCode` · `ORG_001` (404) department / position not found.

### 7.3 `POST /admin/employees/:id/grant-login` — Provision account

```json
// Request (optional override)
{ "username": "lan.nt", "sendEmail": true }
```

```json
// 200 OK
{
  "success": true,
  "data": {
    "userId": "64f0e0...",
    "username": "lan.nt",
    "tempPasswordSentTo": "lan.nt@gmail.com"
  },
  "message": "Login credentials sent to personal email"
}
```

**Business logic** (single Mongoose `session.withTransaction`):

1. Generate random temp password → bcrypt hash.
2. Insert `users` (`employeeId`, `mustChangePassword=true`).
3. Update `employees.userId`.
4. Insert `userRoles` with role `employee`.
5. Insert `auditLogs` (`action=create`, `resource=user`).
6. Emit `employee.granted-login` event → email worker sends temp password.

- **Errors:** `EMP_001` (404) · `EMP_003` (409) already has user · `IAM_006` (409) username/email taken.

### 7.4 `POST /leave-requests` — Submit leave

```json
// Request
{
  "leaveType": "annual",
  "startDate": "2026-06-10",
  "endDate": "2026-06-12",
  "reason": "Personal trip"
}
```

```json
// 201 Created
{
  "success": true,
  "data": {
    "id": "64f1a0...",
    "leaveType": "annual",
    "startDate": "2026-06-10",
    "endDate": "2026-06-12",
    "days": 3,
    "status": "pending",
    "approverId": "64f0a1...",
    "balanceAfter": { "entitled": 12, "used": 9, "remaining": 3 }
  }
}
```

- `days` computed server-side (excludes weekends + holidays).
- **Errors:** `ATT_004` (400) insufficient balance · `ATT_005` (409) overlapping request.

### 7.5 `POST /leave-requests/:id/approve` — Approve

```json
// 200 OK — atomic: updates request + decrements leaveBalance + logs employeeHistory
{
  "success": true,
  "data": {
    "id": "64f1a0...",
    "status": "approved",
    "approvedAt": "2026-05-19T10:00:00Z"
  }
}
```

- Only `approverId` (manager) or HR may call.
- **Errors:** `IAM_004` (403) not assigned approver.

### 7.6 `POST /admin/payroll-periods/:id/compute` — Compute payrolls

```json
// Request — optional scope
{ "employeeIds": null, "dryRun": false }
```

```json
// 200 OK
{
  "success": true,
  "data": {
    "periodId": "64f2a0...",
    "computed": 124,
    "skipped": 2,
    "errors": [
      {
        "employeeId": "64f0d0...",
        "code": "PAY_003",
        "message": "Missing salary structure"
      }
    ]
  }
}
```

**Business logic** (per employee, transactional):

1. Resolve active `salaryStructure`, `allowances`, applicable `bonuses`, `deductions`.
2. Pull `attendances` + `leaveRequests` for the period → compute `workDays`, `leaveDays`.
3. Compute `gross = base + allowances + bonuses`.
4. Resolve `taxConfigs` / `insuranceConfigs` by `country + year` → compute `tax`, `insurance`.
5. `net = gross − tax − insurance − deductions`.
6. Upsert `payrolls` (`status=draft`).
7. Log `auditLogs`.

- **Errors:** `PAY_002` (409) period already closed · `PAY_003` (400) missing salary structure · `PAY_004` (409) already computed (use `recompute=true` query param).

### 7.7 `POST /performance-reviews/:id/submit` — Submit review

```json
// Request
{
  "overallScore": 87,
  "rating": "exceeds",
  "summary": "Consistently delivers above expectations on backend ownership.",
  "feedbacks": [
    {
      "feedbackType": "manager",
      "comments": "...",
      "scores": { "ownership": 5, "teamwork": 4 }
    }
  ]
}
```

```json
// 200 OK
{
  "success": true,
  "data": {
    "id": "64f3a0...",
    "status": "submitted",
    "submittedAt": "2026-05-19T12:00:00Z"
  }
}
```

- **Errors:** `PERF_002` (400) past `reviewDeadline` · `PERF_003` (409) already submitted.

---

## 8. Implementation Notes

### Documentation

- Generate OpenAPI 3 spec from Zod DTOs via `zod-to-openapi`.
- Serve at `GET /api/v1/docs` (Swagger UI), gated to non-production by default.
- Each route file declares `tags`, `summary`, `description`, and example payloads alongside the Zod schema.

### Validation

- Zod schemas live in `features/<feature>/dto/*.dto.ts`.
- `validate(zodSchema, 'body' | 'query' | 'params')` middleware parses & coerces; on failure returns `422` with `SYS_002` and a `details` array of `{ path, message }`.

### Authentication & Authorization

- `authenticate` middleware verifies access token → attaches `req.user: AuthPayload`.
- `requireRoles('admin', 'hr_manager')` and `requirePermission('payroll:approve')` middlewares.
- Per-route ownership check: `requireSelfOrHr` allows the subject employee or any HR user.

### Rate limiting

- `express-rate-limit` on `/auth/login`, `/auth/forgot-password`, `/auth/reset-password` — **5 attempts per 15 min per IP**.
- Returns `429` with `SYS_003`.

### File uploads

- `multer` with S3-compatible storage backend.
- Validate MIME + size before persist.
- Return signed URL (`fileUrl`) with limited TTL for private documents (contracts, payslips).

### Idempotency

- Mutating admin endpoints (`compute`, `mark-paid`, `grant-login`) accept an optional `Idempotency-Key` header — duplicate calls within 24h return the original response.

### Audit

- Every mutating endpoint writes to `auditLogs` via the `audit` middleware — captures `userId`, `resource`, `action`, `resourceId`, and a `{ before, after }` diff.
