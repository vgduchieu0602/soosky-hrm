# HRM Soosky Main — Audit dữ liệu vào/ra để ghép vào `soosky-workspace-api`

> Tài liệu này được dựng từ **code thật** trong `backend/src` (routes, `domain/ports`,
> `shared/models`), không phải từ tài liệu mô tả. Mục đích: nhìn một chỗ thấy toàn bộ
> **đầu vào** (HTTP request, dữ liệu cần từ bên ngoài) và **đầu ra** (collection ghi ra,
> event phát ra) của 5 module sẽ mang sang workspace-api.
>
> Phạm vi giữ lại: `employee`, `attendance`, `organization`, `performance`, `settings`.
> Bỏ lại: `iam`, `payroll`, `notification`, `dashboard`, `storage`.

---

## 1. Hai kiến trúc và khoảng cách phải vượt

| Khía cạnh | HRM Soosky Main (nguồn) | soosky-workspace-api (đích) |
|---|---|---|
| Tổ chức | feature-sliced: `features/<x>/{application,domain,dto,infrastructure,interfaces/http}` | hexagonal: `modules/<x>/{core/{app,domain},adapters/{driven,driver},contracts}` |
| Persistence | **Mongoose** (`shared/models`, ~40 model dùng chung toàn app) | **MongoDB driver thuần**: `Document` + `Mapper` + `MongoRepository` + `MongoUnitOfWork` |
| Domain model | DTO (zod) + usecase; doc Mongoose rò rỉ qua nhiều lớp (`Doc = Record<string, any>`) | Entity + Value Object + domain error; `Entity.rehydrate()` khi đọc |
| Wiring | `container.ts` mỗi feature, singleton controller export sẵn | `XServerModule.ts` một chỗ, mọi dependency inject qua constructor |
| Liên module | import chéo `@features/...` | **chỉ** qua `contracts/*` (published language) + EventBus; enforce bằng `.dependency-cruiser.js` |
| Validate | `validate(dto,'body')` middleware, zod | `bodySchema({...field})` gọi trong controller |
| Actor | `req.user` qua `authenticate` | `ActorContext.get(res)` |
| Chỗ ghép | — | `src/modules/hrm/` đã tồn tại, hiện **rỗng** (chỉ `.gitkeep`) |

**Điểm thuận lợi lớn:** HRM đã tách `domain/ports/index.ts` cho từng feature, tức là
ranh giới nghiệp vụ/hạ tầng **đã được nghĩ trước**. Phần lớn công việc refactor là
*dịch cơ học* port → `core/app/ports`, usecase → `core/app/use-cases`,
repository Mongoose → `adapters/driven/persistence/mongodb`, chứ không phải thiết kế lại.

**Điểm khó thật sự:** không phải HTTP, mà là 3 thứ dưới đây (xem §7).

---

## 2. Bản đồ coupling — cái gì phải cắt khi ghép

### 2.1 Coupling ở mức code (nhẹ, 9 điểm)

| File | Phụ thuộc | Xử lý khi ghép |
|---|---|---|
| `employee/infrastructure/services.ts` | `@features/iam` | thay bằng port `AccountGateway` → `auth/contracts` |
| `employee/interfaces/http/controllers.ts` | `@features/iam` | bỏ, dùng `ActorContext` |
| `employee/infrastructure/gateways.mongoose.ts:29` | `@features/iam/repositories/session.repository` | qua contract auth (revoke session) |
| `employee/infrastructure/gateways.mongoose.ts:30` | `@features/notification` | đổi sang phát event lên EventBus |
| `employee/listeners/account-email.listener.ts` | `@features/iam` | thành driver adapter events |
| `attendance/infrastructure/services.ts` | `@features/iam` | port `AuditPort` |
| `organization/infrastructure/services.ts` | `@features/iam` | port `AuditPort` |
| `performance/infrastructure/services.ts` | `@features/iam` | port `AuditPort` |
| `settings/infrastructure/services.ts` | `@features/iam` | port `AuditPort` |

Chiều ngược lại gần như sạch: chỉ 2 file **test** của payroll
(`payroll/tests/chain-e2e.spec.ts`, `payroll-e2e.spec.ts`) chạm vào 5 module này.

### 2.2 Coupling qua model dùng chung (đây mới là chỗ đau)

5 module giữ lại đang đọc trực tiếp model của phần **bỏ lại**:

| Module giữ | Model "ngoại lai" đang đọc | Ý nghĩa |
|---|---|---|
| `employee` | `payroll`, `allowance`, `bonus`, `deduction`, `monthly-evaluation`, `attendance`, `leave-*` | chỉ dùng cho **cascade delete** + kiểm tra ràng buộc trước khi xoá |
| `employee` | `user`, `user-role`, `role`, `session`, `audit-log` | thuộc `iam` → sẽ thành contract của module `auth` |
| `attendance` | `payroll-period` | khoá kỳ lương: không cho sửa công của kỳ đã chốt |
| `performance` | `payroll`, `payroll-period` | khoá điểm khi payroll đã approved/paid |
| `settings` | *(không có)* | **sạch hoàn toàn** — nên refactor module này trước |

> **Kết luận quan trọng:** `payroll` không bị mang đi, nhưng 3 module (`employee`,
> `attendance`, `performance`) *phụ thuộc vào sự tồn tại của khái niệm kỳ lương/bảng lương*
> để khoá dữ liệu. Khi ghép vào workspace-api mà không có payroll, các port
> `PayrollLockGateway` phải có **implementation no-op trả về "không khoá"** — và đó là một
> quyết định nghiệp vụ, không phải kỹ thuật: nó nghĩa là **mất cơ chế chống sửa dữ liệu
> quá khứ**. Cần bạn xác nhận (xem §7.1).

---

## 3. Module `employee` — nhân sự (lớn nhất)

### 3.1 ĐẦU VÀO — HTTP endpoints

Quy ước phân quyền: `auth` = mọi user đã đăng nhập · `selfOrHr` = chính nhân viên đó
hoặc HR/Admin · `hrOrAdmin` = `requireRoles('admin','hr_manager')`.

**Đọc (self-service + tra cứu)**

| Method | Path | Quyền | Đầu vào |
|---|---|---|---|
| GET | `/employees` | auth | query: filter + phân trang |
| GET | `/employees/stats` | auth | — |
| GET | `/employees/me` | auth | actor userId |
| GET | `/employees/:id` | selfOrHr | path id |
| GET | `/employees/:id/account` | selfOrHr | path id |
| GET | `/employees/:id/completeness` | selfOrHr | path id |
| GET | `/employees/:id/profile` | selfOrHr | path id |
| GET | `/employees/:id/{documents,contacts,bank-accounts,contracts,assets,history,lifecycle}` | selfOrHr | path id |
| GET | `/employees/reminders` | hrOrAdmin | — |
| GET | `/employees/export` | hrOrAdmin | → CSV, **chứa PII đầy đủ** |
| GET | `/employees/import/{template,schema}` | hrOrAdmin | — |

**Ghi — self-service**

| Method | Path | Quyền | DTO |
|---|---|---|---|
| PATCH | `/employees/:id/profile` | selfOrHr | `updateProfileDto` |
| POST | `/employees/:id/documents` | selfOrHr | `createDocumentDto` |
| POST/PATCH/DELETE | `/employees/:id/contacts[/:contactId]` | selfOrHr | `create/updateContactDto` |
| POST/PATCH/DELETE | `/employees/:id/bank-accounts[/:accountId]` | selfOrHr | `create/updateBankAccountDto` |

**Ghi — HR/Admin (`/admin/...`)**

| Method | Path | DTO |
|---|---|---|
| POST | `/admin/employees` | `createEmployeeDto` |
| PATCH | `/admin/employees/:id` | `updateEmployeeDto` |
| DELETE | `/admin/employees/:id` | — (**hard delete, cascade**) |
| POST | `/admin/employees/:id/grant-login` | `grantLoginDto` |
| PATCH | `/admin/employees/:id/account` | `updateAccountDto` |
| POST | `/admin/employees/:id/{reset-password,resend-invite}` | — |
| POST | `/admin/employees/import/preview` | `importPreviewDto` · body ≤ **8mb** |
| POST | `/admin/employees/import/commit` | `importCommitDto` (+ `importId` + checksum) |
| POST | `/admin/employees/reminders/run` | — (job thủ công) |
| POST | `/admin/employees/{bulk/terminate,:id/terminate}` | `bulk/terminateEmployeeDto` |
| PATCH/DELETE | `/admin/employees/:id/documents/:docId` | `updateDocumentDto` |
| POST/PATCH | `/admin/employees/:id/contracts[/:contractId]` | `create/updateContractDto` |
| POST/PATCH/DELETE | `/admin/employees/:id/assets[/:assetId]`, `.../return` | `create/update/returnAssetDto` |

**Vòng đời (đều là POST `/admin/employees/:id/...`, đều ghi `employee-history`)**
`transfer` · `change-position` · `change-manager` · `probation/complete` ·
`probation/extend` · `change-salary` · `end-employment` · `rehire`

### 3.2 ĐẦU VÀO — cần gì từ bên ngoài (ports)

| Port | Ai cung cấp ở workspace-api |
|---|---|
| `OrganizationGateway` (`findDepartment/Position`, `listDepartmentCodes`, `namesByIds`) | **module hrm nội bộ** (organization) — không cần contract |
| `AccountGateway` (createUser, assignRole, revokeSessions, disableUser, roleNameOf…) | **`auth/contracts`** — điểm ghép quan trọng nhất |
| `LeaveSeedGateway.seedLeaveBalances` | nội bộ hrm (attendance) |
| `CascadeGateway.deleteEmployeeCascade` | nội bộ + cần xử lý model payroll đã bỏ |
| `NotificationGateway` (`userIdsByRoles`, `notifyMany`) | → **EventBus**, module `notifications` tiêu thụ |
| `CompletenessGateway.gather` | nội bộ hrm |
| `AuditPort.record` | shared/auth |
| `Clock`, `UnitOfWork`, `ExportPort`, `CsvExportPort`, `ReminderRepository` | hạ tầng: `MongoUnitOfWork` |

### 3.3 ĐẦU RA — collection ghi ra

| Collection | Khoá / ràng buộc đáng chú ý |
|---|---|
| `employees` | `employeeCode` unique · `userId` unique **partial** (`$type:'objectId'`, tránh null trùng) · `fingerprintId` unique partial · index `{departmentId,status}` |
| `employeeProfiles` | `employeeId` unique 1-1 · **chứa PII**: dateOfBirth, address, taxCode, socialInsuranceNo |
| `employeeContacts` | nhiều/1 · `isPrimary` |
| `employeeBankAccounts` | nhiều/1 · `isPrimary` |
| `employeeContracts` | `contractNumber` unique · `baseSalary` **Decimal128** · index `{employeeId,startDate}` |
| `employeeDocuments` | `documentType` enum 6 giá trị · `expiryDate` (nguồn của reminder) |
| `employeeAssets` | `assetCode` unique toàn hệ thống |
| `employeeHistory` | **audit trail bất biến**, `eventType` 16 giá trị, `fromValue`/`toValue` tự do |
| `employeeTaxProfiles` | `isResident`, `dependentsCount`, `insuranceAmount` |

### 3.4 ĐẦU RA — event phát ra (`EventsPort`)

`grantedLogin` · `passwordReset` · `inviteResent`
— payload: `{ userId, employeeId, username, sendTo? }`
Hiện được `listeners/account-email.listener.ts` bắt để **gửi email**.
→ Ở workspace-api phải trở thành integration event trong `hrm/contracts/HrmEvents.ts`.

---

## 4. Module `attendance` — chấm công & nghỉ phép

### 4.1 ĐẦU VÀO — HTTP endpoints

**Danh mục (catalog)** — đọc mở cho user, ghi chỉ hrOrAdmin

| Method | Path | DTO |
|---|---|---|
| GET | `/shifts` · `/holidays` · `/attendance-symbols` | — |
| POST/PATCH/DELETE | `/admin/shifts[/:id]` | `create/updateShiftDto` |
| POST/PATCH/DELETE | `/admin/holidays[/:id]` | `create/updateHolidayDto` |
| POST/PATCH/DELETE | `/admin/attendance-symbols[/:id]` | `create/updateSymbolDto` |

**Bản ghi công**

| Method | Path | Quyền | DTO |
|---|---|---|---|
| GET | `/attendances/me` | auth | query tháng |
| POST | `/attendances/check-in` · `/check-out` | auth | — (lấy giờ server) |
| GET | `/admin/attendances` | hrOrAdmin | query grid (tháng, phòng ban) |
| POST | `/admin/attendances` | hrOrAdmin | `upsertAttendanceDto` |
| POST | `/admin/attendances/bulk` | hrOrAdmin | `bulkUpsertAttendanceDto` |
| PATCH | `/admin/attendances/:id` | hrOrAdmin | `adjustAttendanceDto` |
| DELETE | `/admin/attendances/:id` | hrOrAdmin | — |

**Nghỉ phép**

| Method | Path | Quyền | DTO |
|---|---|---|---|
| POST | `/leave-requests` | auth | `submitLeaveDto` |
| GET | `/leave-requests/me` · `/leave-balances/me` | auth | — |
| PATCH | `/leave-requests/:id/cancel` | auth | — |
| GET | `/admin/leave-requests` | hrOrAdmin | query |
| POST | `/admin/leave-requests/:id/approve` · `/revoke` | hrOrAdmin | — |
| POST | `/admin/leave-requests/:id/reject` | hrOrAdmin | `rejectLeaveDto` |
| GET | `/admin/leave-balances/:employeeId` | hrOrAdmin | — |
| POST | `/admin/leave-balances` | hrOrAdmin | `upsertLeaveBalanceDto` |

### 4.2 ĐẦU VÀO — ports

| Port | Nguồn ở workspace-api |
|---|---|
| `EmployeeGateway` (`findByUserId`, `findById`, `isOfficial`) | nội bộ hrm (employee) |
| `ShiftWindowGateway` (`findDefaultShiftWindow`, `findShiftWindow`, `listActiveShifts`) | nội bộ (catalog shift) |
| `PolicyGateway` (`loadPolicy`, `annualQuota`) | nội bộ (settings → `companyConfigs`) |
| `PayrollLockGateway.lockedPeriodName(date)` | ⚠ **payroll không mang đi** → cần no-op, xem §7.1 |
| `AuditPort`, `Clock`, `UnitOfWork` | hạ tầng |

### 4.3 ĐẦU RA — collection

| Collection | Ghi chú |
|---|---|
| `attendances` | `date` = **00:00 UTC của ngày dương lịch VN** (quy ước timezone quan trọng) · `session` ∈ morning/afternoon/full_day · `status` 8 giá trị · `source` = `manual` \| `leave` · `leaveRequestId` khi sinh từ đơn nghỉ · lưu `lateMinutes`/`earlyMinutes`/`workHours` · `adjustedBy`/`adjustedAt` |
| `leaveRequests` | `status` pending/approved/rejected/cancelled · `days` (hỗ trợ nửa ngày qua `halfDaySession`) · index `{employeeId,status}` |
| `leaveBalances` | `{employeeId, leaveType, year}` · `entitled` (**0 = không giới hạn**, dùng cho unpaid) · `used` |
| `shifts` | `startTime`/`endTime` dạng **string `HH:mm`** · `workingDays` ISO 1..7 |
| `holidays` | `isRecurring` · `country` (ISO hoặc `*`) |
| `attendanceSymbols` | `code` unique · `paidStatus` paid/unpaid/neutral · `affectsPayroll` · `appliesTo` |

### 4.4 ĐẦU RA — event

`leaveSubmitted { leaveRequestId, employeeId }`
`leaveDecided { leaveRequestId, employeeId, approved, reason? }`

### 4.5 Nghiệp vụ thuần (giữ nguyên khi refactor — đã có test)

`domain/attendance-calc.ts` (tính late/early/workHours), `domain/leave-policy.ts`,
`application/leave-entitlement.service.ts` (carryover).
Test hiện có: `attendance-calc`, `attendance-lock-guard`, `leave-calc`, `leave-carryover`
→ **chuyển thẳng sang `core/domain`, dùng test cũ làm lưới an toàn cho refactor.**

---

## 5. Module `organization` — phòng ban & chức danh

### 5.1 ĐẦU VÀO

| Method | Path | Quyền | DTO |
|---|---|---|---|
| GET | `/departments` · `/departments/:id` · `/departments/:id/history` | auth | — |
| POST | `/admin/departments` | hrOrAdmin | `createDepartmentDto` |
| PATCH | `/admin/departments/:id` | hrOrAdmin | `updateDepartmentDto` |
| PATCH | `/admin/departments/:id/head` | hrOrAdmin | `assignHeadDto` |
| PATCH | `/admin/departments/:id/move` | hrOrAdmin | `moveDepartmentDto` |
| POST | `/admin/departments/:id/transfer-employees` | hrOrAdmin | `transferEmployeesDto` |
| POST | `/admin/departments/:id/merge` | hrOrAdmin | `mergeDepartmentDto` |
| DELETE | `/admin/departments/:id` | hrOrAdmin | — |
| GET | `/positions` · `/positions/:id` | auth | — |
| POST/PATCH | `/admin/positions[/:id]` | hrOrAdmin | `create/updatePositionDto` |
| DELETE | `/admin/positions/:id` | hrOrAdmin | → **archive**, không xoá thật |

### 5.2 ĐẦU VÀO — ports

`EmployeeGateway`: `headcountByDepartment`, `findHeads`, `findEmployeeStatus`,
`countActiveInDepartment`, `countAllInDepartment`, `countByStatuses`, `countByPosition`,
`findTransferableIds`, `moveEmployees` → **toàn bộ nội bộ hrm (employee)**.
`EmployeeHistoryGateway.recordTransfers` · `PositionGateway.{countByDepartment,moveAll}` ·
`DepartmentRefGateway.exists` · `AuditPort` (có thêm `list`) · `Clock` · `IdValidator` · `UnitOfWork`.

### 5.3 ĐẦU RA

| Collection | Ghi chú |
|---|---|
| `departments` | **cây tự tham chiếu** qua `parentDepartmentId` · `code` · `managerId` · `costCenter` · `status` |
| `positions` | `code` unique uppercase · thuộc `departmentId` · `level` ≥ 1 · `status` active/archived |
| `employeeHistory` | ghi kèm khi transfer/merge (qua gateway) |

Không phát event. Nghiệp vụ thuần: `domain/department-tree.ts` (chống chu trình khi `move`).
Test có: `department.usecases.spec.ts`, `department-delete.http.spec.ts`.

---

## 6. Module `performance` & `settings`

### 6.1 `performance` — ĐẦU VÀO

| Method | Path | Quyền | DTO |
|---|---|---|---|
| GET/POST | `/performance/criteria` | hrOrAdmin | `createCriterionDto` |
| PATCH | `/performance/criteria/:id` | hrOrAdmin | `updateCriterionDto` |
| POST | `/performance/criteria/:id/deactivate` | hrOrAdmin | — |
| GET | `/performance/evaluations/me` | auth | — |
| POST | `/performance/evaluations/:id/acknowledge` | auth | `acknowledgeDto` |
| GET | `/performance/evaluations` · `/export` (xlsx) · `/employee/:employeeId` | hrOrAdmin | query |
| GET | `/performance/evaluations/:id` | auth | — |
| POST | `/performance/evaluations` | hrOrAdmin | `directEvaluateDto` |
| POST | `/performance/evaluations/:id/reopen` | hrOrAdmin | `reopenDto` |

Ports: `EmployeeGateway.{findEmployeeIdByUserId,findManager}` (nội bộ) ·
`CriterionGateway.activeDefinitions` (nội bộ) ·
⚠ `PayrollLockGateway.{findLockedPayroll, isPerformancePeriodLocked?}` → **payroll đã bỏ**.

**ĐẦU RA:** `monthlyEvaluations` — unique `{employeeId, payrollPeriodId}` ·
`status` draft/approved/acknowledged · `criteriaDefinitionSnapshot` (**snapshot tiêu chí để
sửa tiêu chí về sau không viết lại lịch sử** — thiết kế tốt, phải giữ) ·
`performanceRatio`, `goalResult`, `goalRatio` (0–100) · phần định tính
`strengths`/`improvements`/`developmentPlan` · xác nhận `acknowledgedAt`/`disputeNote`.
`performanceCriteria` — `key`, `type` ∈ performance(60%)/goal(20%), `weight` (tổng phải = 100).

**Event:** `evaluationFinalized {employeeId,payrollPeriodId}` · `evaluationReopened` ·
`evaluationDisputed`.

> ⚠ **Ràng buộc nghiêm trọng:** `monthlyEvaluations.payrollPeriodId` là **required + unique
> composite**. Không mang payroll đi nghĩa là **không còn nguồn sinh `payrollPeriodId`**.
> Đây là chặn cứng, không thể no-op như `PayrollLockGateway`. Xem §7.2.

### 6.2 `settings` — ĐẦU VÀO

| Method | Path | Quyền |
|---|---|---|
| GET | `/settings/company` | auth |
| PATCH | `/admin/settings/company` | **adminOnly** |
| GET | `/settings/salary-policies` | hrOrAdmin |
| POST/PATCH | `/admin/settings/salary-policies[/:id]` | **adminOnly** |
| GET | `/settings/performance-criteria` | auth |
| POST/PATCH/DELETE | `/admin/settings/performance-criteria[/:id]` | hrOrAdmin |
| GET | `/settings/banks` | auth |
| POST/PATCH/DELETE | `/admin/settings/banks[/:id]` | hrOrAdmin |

**ĐẦU RA:**
- `companyConfigs` — **singleton** (`key` cố định): `timezone`, `standardWorkDays`,
  `graceLateMinutes`/`graceEarlyMinutes`, `overtimeEnabled`, `lateAffectsPay`,
  `leaveQuotas` (seed khi tạo nhân viên). → attendance đọc qua `PolicyGateway`.
- `salaryPolicyConfigs` — dữ liệu thuế/BHXH VN, nhiều `Decimal128`
  (`baseSalary`, `personalDeduction`, `dependentDeduction`, `internStipend`,
  `socialInsuranceSalary`), `taxBrackets`, `probationPayRate`,
  `salaryComponentWeights` (công thức 20/60/20).
- `performanceCriteria` (**dùng chung với module performance**) · `banks`.

Không có port ngoài trừ `AuditPort` → **module sạch nhất, nên refactor đầu tiên**.

> ⚠ `salaryPolicyConfigs` chỉ được **payroll** tiêu thụ. Mang settings đi mà bỏ payroll
> nghĩa là bạn chuyển sang một bảng cấu hình **không ai đọc**. Xem §7.3.

---

## 7. Bốn quyết định phải chốt trước khi viết code

Đây là những chỗ **không thể tự quyết bằng kỹ thuật** — bỏ payroll ra khỏi phạm vi tạo ra
lỗ hổng nghiệp vụ thật, không phải chỉ lỗi biên dịch.

### 7.1 `PayrollLockGateway` — mất cơ chế đóng băng dữ liệu quá khứ
`attendance` và `performance` dùng port này để **chặn sửa** công/điểm của kỳ đã chốt lương.
Không có payroll → phải chọn:
- **(a)** no-op "không bao giờ khoá" → HR sửa được công/điểm của mọi tháng cũ, vô thời hạn.
- **(b)** thay bằng khoá theo kỳ **độc lập với payroll** (ví dụ collection `attendancePeriods`
  do chính hrm quản, có `status: open|locked`). Tốn thêm việc nhưng giữ được nghiệp vụ.
- **(c)** giữ contract sang payroll (module payroll ghép sau).

### 7.2 `payrollPeriodId` trong `monthlyEvaluations` — chặn cứng
Đây là **required + unique composite** `{employeeId, payrollPeriodId}`. Đó là cách hệ thống
đảm bảo "mỗi nhân viên một phiếu đánh giá mỗi kỳ". Bỏ payroll thì không còn ai sinh id kỳ.
Lựa chọn:
- **(a)** đổi khoá sang `{employeeId, periodYear, periodMonth}` — **khuyến nghị**, vì bản chất
  đánh giá là *theo tháng*, việc gắn vào payroll period là ràng buộc kỹ thuật vay tạm.
  Cần **migration** dữ liệu cũ.
- **(b)** mang `payrollPeriods` (chỉ collection kỳ, không mang engine tính lương) sang hrm.

### 7.3 `salaryPolicyConfigs` — cấu hình không ai đọc
Chỉ payroll tiêu thụ. Chọn: mang sang để chờ payroll ghép sau (chấp nhận code chết tạm), hay
loại khỏi phạm vi `settings` lần này.

### 7.4 Cascade delete của `employee`
`deleteEmployeeCascade` hiện xoá cả `payroll`, `allowance`, `bonus`, `deduction`. Khi những
collection đó không thuộc hrm nữa, việc xoá cứng một nhân viên sẽ **để lại dữ liệu lương mồ côi**.
Khuyến nghị: đổi hard delete → **soft delete / archive**, hoặc phát event
`hrm.employee.deleted` để module khác tự dọn.

---

## 8. Bản đồ refactor sang `soosky-workspace-api`

### 8.1 Ánh xạ thư mục

| HRM Soosky Main | → | `src/modules/hrm/...` |
|---|---|---|
| `features/<m>/domain/ports/index.ts` (repo) | → | `core/app/ports/<X>Repo.ts` (tách 1 file/port) |
| `features/<m>/domain/ports/index.ts` (gateway) | → | `core/app/ports/<X>Gateway.ts` |
| `features/<m>/application/*.usecases.ts` | → | `core/app/use-cases/<nhóm>/<Verb><Noun>UseCase.ts` (1 class/file) |
| `features/<m>/domain/*.ts` (calc thuần) | → | `core/domain/` (entity, value-object) |
| `shared/models/<x>.model.ts` (Mongoose) | → | `adapters/driven/persistence/mongodb/documents/<X>Document.ts` + `mappers/<X>Mapper.ts` |
| `features/<m>/infrastructure/*.repository.mongoose.ts` | → | `adapters/driven/persistence/mongodb/repositories/Mongo<X>Repo.ts` |
| `features/<m>/interfaces/http/controllers.ts` | → | `adapters/driver/http/controllers/<X>Controller.ts` + `presenters/<X>Presenter.ts` |
| `features/<m>/interfaces/http/*.routes.ts` | → | **gộp hết** vào `adapters/driver/http/index.ts` (`createHrmHttpRouter`) |
| `features/<m>/dto/*.dto.ts` (zod) | → | `bodySchema({...field})` ngay trong controller |
| `features/<m>/container.ts` | → | **gộp hết** vào `HrmServerModule.ts` |
| `features/<m>/listeners/*` | → | `adapters/driver/events/*EventHandler.ts` |
| `EventsPort` (3 module) | → | `contracts/HrmEvents.ts` (enum type + payload `type`) |

### 8.2 Việc phải làm mới (không có bản tương ứng ở HRM)

1. **Entity + Value Object.** HRM truyền `Doc = Record<string, any>`; đích yêu cầu entity có
   `rehydrate()` và VO tự validate (`EmployeeCode`, `AttendanceStatus`, `LeaveType`,
   `DepartmentName`, `CriterionWeight`…). Đây là phần **tốn công nhất**.
2. **Bỏ Mongoose.** Đích dùng driver thuần: mất `enum`/`required`/`unique` khai báo sẵn →
   validate chuyển vào VO, index phải tạo tay, `Decimal128` phải map tay
   (`baseSalary`, toàn bộ `salaryPolicyConfigs`).
3. **`ObjectId` → `string`.** HRM dùng `Types.ObjectId`; task-mgmt dùng `_id: string`.
   → **cần migration dữ liệu**, không chỉ đổi code.
4. **`collections.ts`** khai báo tên collection + `MongoUnitOfWork` cho hrm.
5. **Authorization policies** (`core/app/authorization/policies/`) thay cho middleware
   `requireRoles`/`selfOrHr`.
6. Cập nhật **`.dependency-cruiser.js`** cho ranh giới `modules/hrm`.

### 8.3 Thứ tự khuyến nghị

| # | Module | Vì sao |
|---|---|---|
| 1 | `settings` | không phụ thuộc ngoài (trừ audit) → dùng để **chốt khuôn mẫu** |
| 2 | `organization` | chỉ phụ thuộc employee, có test sẵn |
| 3 | `employee` | trung tâm; mọi module khác trỏ vào |
| 4 | `attendance` | phụ thuộc employee + settings |
| 5 | `performance` | phụ thuộc employee + criteria; vướng §7.2 |

Sau mỗi module: chạy `tsc --noEmit` + `dependency-cruiser` + test đã port. Không sang module
tiếp theo khi module trước chưa xanh.

---

## 9. Phụ lục — 22 collection sẽ chuyển

**employee (9):** `employees`, `employeeProfiles`, `employeeContacts`, `employeeBankAccounts`,
`employeeContracts`, `employeeDocuments`, `employeeAssets`, `employeeHistory`, `employeeTaxProfiles`
**attendance (6):** `attendances`, `leaveRequests`, `leaveBalances`, `shifts`, `holidays`, `attendanceSymbols`
**organization (2):** `departments`, `positions`
**performance (2):** `monthlyEvaluations`, `performanceCriteria`
**settings (3):** `companyConfigs`, `salaryPolicyConfigs`, `banks`

**KHÔNG chuyển** (thuộc module khác của workspace-api hoặc bị loại):
`users`, `roles`, `permissions`, `rolePermissions`, `userRoles`, `sessions`,
`passwordSetupTokens`, `auditLogs` → **module `auth`** ·
`notifications` → **module `notifications`** ·
`payrolls`, `payrollPeriods`, `allowances`, `bonuses`, `deductions` → **payroll (bỏ lại)**.

> ⚠ Lưu ý dữ liệu: `performanceCriteria` bị **cả `settings` và `performance` cùng ghi**.
> Khi tách module, phải chỉ định **một chủ sở hữu duy nhất** (khuyến nghị: `performance` sở hữu,
> `settings` chỉ đọc) — nếu không sẽ có hai đường ghi vào cùng một collection.




