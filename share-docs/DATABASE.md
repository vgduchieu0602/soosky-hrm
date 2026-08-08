# Soosky HRM — Database Design

> **Auto-documented from the actual Mongoose models (`backend/src/shared/models`) as of 2026-06-21.**
> MongoDB 6.x. All timestamps use `{ createdAt: 'created_at', updatedAt: 'updated_at' }`. Money fields use `Decimal128`. **34 collections.**

---

## Collection Relationship Graph (FK Overview)

```
users                          roles                permissions
  ↓                            ↓                      ↓
  ├─ sessions                  └─ userRoles ────────┐ rolePermissions
  ├─ auditLogs                 └─────────────────────┘
  ├─ passwordSetupTokens
  └─ employed by
     ↓
  employees  (self-ref manager; → departments / positions)
     ├─ employeeProfiles (1:1)
     ├─ employeeContacts
     ├─ employeeBankAccounts
     ├─ employeeDocuments
     ├─ employeeAssets
     ├─ employeeContracts
     ├─ employeeHistories
     ├─ employeeTaxProfiles
     ├─ leaveRequests
     ├─ leaveBalances
     ├─ attendances
     ├─ monthlyEvaluations
     ├─ payrolls
     ├─ allowances
     ├─ bonuses
     └─ deductions

departments (tree self-reference; managerId → employees)
positions → departments
shifts → attendances
holidays (standalone)            attendanceSymbols (standalone)
payrollPeriods → payrolls, bonuses, deductions, monthlyEvaluations
salaryPolicyConfigs → payrolls
performanceCriteria → monthlyEvaluations (scores)
companyConfig (singleton)
```

---

## 1. roles  (`Role`)

| Field | Type | Req | Unique | Default | Notes |
|-------|------|-----|--------|---------|-------|
| name | String | yes | yes | — | Role name (`admin`, `hr_manager`, `employee`) |
| description | String | no | no | `''` | |
| isSystem | Boolean | no | no | `false` | System roles cannot be deleted (pre-delete hook) |

Indexes: `{name:1}` unique. Referenced by `userRoles`, `rolePermissions`.

## 2. permissions  (`Permission`)

| Field | Type | Req | Unique | Enum |
|-------|------|-----|--------|------|
| key | String | yes | yes | e.g. `payroll:approve` |
| resource | String | yes | no | indexed |
| action | String | yes | no | `create|read|update|delete|approve` |
| description | String | no | no | |

Indexes: `{key:1}` unique, `{resource:1}`. Referenced by `rolePermissions`.

## 3. userRoles  (`UserRole`, junction)

| Field | Type | Req | Notes |
|-------|------|-----|-------|
| userId | ObjectId→users | yes | |
| roleId | ObjectId→roles | yes | |
| assignedAt | Date | no | default now |
| expiresAt | Date | no | optional temporary grants |

Indexes: `{userId:1}`, `{roleId:1}`, `{userId:1,roleId:1}` unique.

## 4. rolePermissions  (`RolePermission`, junction)

| Field | Type | Req |
|-------|------|-----|
| roleId | ObjectId→roles | yes |
| permissionId | ObjectId→permissions | yes |

Indexes: `{roleId:1}`, `{permissionId:1}`, `{roleId:1,permissionId:1}` unique.

## 5. sessions  (`Session`)

| Field | Type | Req | Notes |
|-------|------|-----|-------|
| userId | ObjectId→users | yes | |
| refreshTokenHash | String | yes | SHA256 of refresh JWT; never raw |
| userAgent | String | no | |
| ip | String | no | |
| expiresAt | Date | yes | **TTL index** auto-deletes |
| revokedAt | Date | no | set on logout / rotation / reuse |

Indexes: `{userId:1}`, `{refreshTokenHash:1}`, `{expiresAt:1}` TTL (expireAfterSeconds 0).

## 6. users  (`User`)

| Field | Type | Req | Unique | Default | Enum/Notes |
|-------|------|-----|--------|---------|------------|
| username | String | yes | yes | — | trimmed |
| email | String | yes | yes | — | lowercase |
| password | String | yes | no | — | `select:false`, bcrypt |
| status | String | yes | no | `active` | `active|disabled|locked` |
| employeeId | ObjectId→employees | no | yes* | null | sparse partial unique |
| mustChangePassword | Boolean | no | no | `false` | forces `/change-password` |
| lastLoginAt | Date | no | no | — | |
| failedLoginAttempts | Number | no | no | `0` | lockout counter |

Indexes: `{username:1}` unique, `{email:1}` unique, `{status:1}`, `{employeeId:1}` unique sparse. `toJSON` strips `password`.

## 7. employees  (`Employee`)

| Field | Type | Req | Unique | Default | Enum/Notes |
|-------|------|-----|--------|---------|------------|
| employeeCode | String | yes | yes | — | |
| fingerprintId | String | no | yes* | null | partial unique |
| userId | ObjectId→users | no | yes* | null | partial unique; set on grant-login |
| departmentId | ObjectId→departments | yes | no | — | |
| positionId | ObjectId→positions | yes | no | — | |
| managerId | ObjectId→employees | no | no | null | self-ref |
| hireDate | Date | yes | no | — | |
| terminationDate | Date | no | no | null | set on terminate |
| employeeType | String | yes | no | — | `full_time|part_time|contract|intern` |
| status | String | no | no | `onboarding` | `onboarding|active|on_leave|terminated` |
| salaryZone | String | no | no | — | `zone1|zone2|zone3|zone4` |

Indexes: `{employeeCode:1}` unique; `{userId:1}` / `{fingerprintId:1}` partial unique; `{departmentId:1}`, `{managerId:1}`, `{departmentId:1,status:1}`.

## 8. employeeProfiles  (`EmployeeProfile`, 1:1)

| Field | Type | Req | Default | Enum/Notes |
|-------|------|-----|---------|------------|
| employeeId | ObjectId→employees | yes | — | unique (1:1) |
| firstName / lastName | String | yes | — | |
| middleName | String | no | — | |
| dateOfBirth | Date | no | — | |
| gender | String | no | `undisclosed` | `male|female|other|undisclosed` |
| nationality | String | no | `VN` | |
| maritalStatus | String | no | `single` | `single|married|divorced|widowed` |
| avatarUrl / avatarId | String | no | — | S3 |
| email | String | no | — | personal — used for grant-login invite |
| workEmail | String | no | — | |
| phone | String | no | — | string (preserve leading 0) |
| address | String | no | — | |

Index: `{employeeId:1}` unique.

## 9. employeeContacts  (`EmployeeContact`)

`employeeId→employees`, `name`, `relationship` (`spouse|parent|sibling|other`), `phone?`, `email?`, `address?`, `isPrimary` (default false). Index `{employeeId:1}`.

## 10. employeeBankAccounts  (`EmployeeBankAccount`)

`employeeId→employees`, `bankName`, `branch?`, `accountNumber` (string), `accountHolder`, `isPrimary` (default false). Index `{employeeId:1}`.

## 11. employeeDocuments  (`EmployeeDocumentModel`)

`employeeId→employees`, `documentType` (`id_card|passport|degree|certificate|visa|other`), `documentNumber`, `fileUrl?`, `issuedDate?`, `expiryDate?`, `issuedBy?`. Index `{employeeId:1}`.

## 12. employeeAssets  (`EmployeeAsset`)

`employeeId→employees`, `assetName`, `assetCode` (unique), `assignedDate`, `returnedDate?`, `condition` (`new|good|fair|damaged`, default good), `note?`. Indexes `{employeeId:1}`, `{assetCode:1}` unique.

## 13. employeeContracts  (`EmployeeContractModel`)

`employeeId→employees`, `contractType` (`probation|fixed_term|indefinite|internship`), `contractNumber` (unique), `startDate`, `endDate?`, `baseSalary` **Decimal128**, `currency` (default VND), `fileUrl?`, `status` (`active|expired|terminated`, default active). Indexes `{employeeId:1}`, `{contractNumber:1}` unique, `{status:1}`. `toJSON` converts Decimal128 → string.

## 14. employeeHistories  (`EmployeeHistory`)

`employeeId→employees`, `eventType`, `fromValue`/`toValue` (Mixed snapshots), `effectiveDate`, `note?` (lý do — bắt buộc với thay đổi vòng đời), `createdBy→users`. Indexes `{employeeId:1}`, `{employeeId:1,effectiveDate:-1}`.

`eventType` — 7 giá trị gốc: `hired|promotion|transfer|salary_change|contract_renew|info_update|terminated`; mở rộng vòng đời: `position_change|manager_change|probation_started|probation_extended|probation_completed|contract_ended|resigned|rehired`.

**Đây là bản ghi vòng đời duy nhất** — không có collection `employeeMovements` riêng. Trạng thái hiện tại nằm trên `employees`/`employeeContracts`; mỗi thay đổi ghi thêm một bản ghi bất biến ở đây, không bao giờ sửa/ghi đè bản cũ. Nhờ vậy dựng lại được dòng thời gian (`01/01→14/06: Engineering`, `15/06→nay: Product`) mà không cần temporal database.

Ánh xạ nghiệp vụ → `eventType`: điều chuyển phòng ban `transfer`; đổi chức vụ `position_change`; thăng chức `promotion`; đổi quản lý `manager_change`; nghỉ theo nguyện vọng `resigned`; công ty chấm dứt `terminated`. Cả hai hình thức nghỉ đều đưa `employees.status` về `terminated` — trạng thái nhân viên chỉ có MỘT giá trị "đã rời công ty" để mọi truy vấn `status != 'terminated'` của payroll/chấm công không bị lệch; hình thức nghỉ nằm ở `toValue.separationType`.

Thử việc **không** có trường riêng trên `employees`: lấy từ `employeeContracts.employmentStatus` + `endDate` của hợp đồng đang hiệu lực. Thay đổi lương cũng không sửa hợp đồng cũ mà đóng nó lại (`status:'expired'`, `endDate`) và lập hợp đồng mới, nên bảng lương đã tính vẫn giữ đúng ảnh chụp lương của kỳ đó.

**Nhập CSV không tạo bảng mới.** Một dòng CSV ghi vào đúng các collection sẵn có: `employees` + `employeeProfiles` (luôn), `employeeContracts` (chỉ hợp đồng ĐẦU TIÊN khi tạo mới), `employeeBankAccounts` (chỉ tài khoản chính khi tạo mới), kèm `employeeHistories` + `auditLogs`. Với dòng cập nhật, cột hợp đồng/ngân hàng bị bỏ qua để không ghi đè dữ liệu lịch sử. Không có collection `importSessions`: bước xem trước là thuần tính toán, ràng buộc với bước ghi bằng `checksum` tính trên dữ liệu đã chuẩn hoá.

Tập cột CSV được suy ra từ chính các model trên và khai báo một lần tại `backend/src/features/employee/domain/employee-csv-schema.ts`.

## 15. employeeTaxProfiles  (`EmployeeTaxProfile`, versioned)

`employeeId→employees`, `taxCode?` (sparse unique), `isResident` (default true), `dependentsCount` (default 0), `effectiveDate`, `endDate?` (null = active), `note?`, `createdBy→users`. Indexes `{employeeId:1}`, `{taxCode:1}` sparse unique, `{employeeId:1,effectiveDate:-1}`. Payroll snapshots values effective at compute time.

## 16. departments  (`Department`, hierarchical)

`name`, `code` (unique, uppercase), `parentDepartmentId→departments` (self-ref), `managerId→employees`, `costCenter?`, `location?`, `email?`, `description`, `status` (`active|archived`). Indexes `{code:1}` unique, `{parentDepartmentId:1}`, `{managerId:1}`.

## 17. positions  (`Position`)

`title`, `code` (unique, uppercase), `departmentId→departments`, `level` (Number, min 1), `description`. Indexes `{code:1}` unique, `{departmentId:1}`.

## 18. shifts  (`Shift`)

`name`, `type` (`morning|afternoon|full_day`, default full_day), `startTime`/`endTime` (HH:mm), `breakMinutes` (default 0), `workingDays` ([Number] ISO 1–7, default Mon–Fri), `status` (`active|archived`). Index `{status:1}`.

## 19. holidays  (`Holiday`)

`name`, `date` (indexed), `isRecurring` (default false), `country` (default `*`), `description?`. Standalone.

## 20. attendanceSymbols  (`AttendanceSymbol`)

`code` (unique), `label`, `paidStatus` (`paid|unpaid|neutral`, default neutral), `affectsPayroll` (default false), `leaveType?`, `color?`. Index `{code:1}` unique.

## 21. attendances  (`Attendance`)

| Field | Type | Notes |
|-------|------|-------|
| employeeId | →employees | indexed |
| date | Date | UTC 00:00 = VN calendar day |
| session | String | `morning|afternoon|full_day` (default full_day) |
| shiftId | →shifts | nullable |
| checkIn / checkOut | Date | actual timestamps |
| status | String | `present|late|early_leave|incomplete|absent|leave_paid|leave_unpaid|holiday` |
| workHours | Number | computed |
| lateMinutes / earlyMinutes | Number | default 0 |
| leaveRequestId | →leaveRequests | set when generated from approved leave |
| source | String | `manual` or `leave` |
| note | String | |
| createdBy / adjustedBy | →users | + `adjustedAt` |

Indexes: `{employeeId:1}`, `{status:1}`, `{leaveRequestId:1}`, `{date:1}`, `{employeeId:1,date:1,shiftId:1}` unique (partial: shiftId is objectId) → one record per employee/date/shift.

## 22. leaveRequests  (`LeaveRequest`)

`employeeId→employees`, `leaveType` (`annual|sick|personal|unpaid|maternity|paternity`), `startDate`, `endDate`, `days` (fractional ok), `halfDaySession?` (`morning|afternoon`), `reason?`, `status` (`pending|approved|rejected|cancelled`, default pending), `approverId→users`, `approvedAt?`, `rejectionReason?`, `createdBy→users`. Indexes `{employeeId:1}`, `{status:1}`, `{employeeId:1,status:1}`. On approval → auto-generate attendance + decrement balance (atomic).

## 23. leaveBalances  (`LeaveBalance`)

`employeeId→employees`, `leaveType` (same enum), `year`, `entitled` (0 = unlimited), `used`. Indexes `{employeeId:1}`, `{employeeId:1,leaveType:1,year:1}` unique.

## 24. payrollPeriods  (`PayrollPeriod`)

`name` (unique, e.g. `2026-05`), `startDate`, `endDate`, `payDate`, `standardWorkDays` (default 22, snapshot of CompanyConfig), `status` (`open|processing|closed|paid`, default open), `closedAt?`, `closedBy→users`, `createdBy→users`. Indexes `{name:1}` unique, `{status:1}`.

## 25. salaryPolicyConfigs  (`SalaryPolicyConfig`)

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| country | String | — | uppercase |
| year | Number | — | |
| effectiveFrom | Date | — | |
| baseSalary | Decimal128 | — | lương cơ sở tính BHXH |
| regionalMinWage | Mixed | — | zone → min wage |
| insuranceCeilingMultiplier | Number | 20 | ×baseSalary cap |
| personalDeduction | Decimal128 | 11,000,000 | |
| dependentDeduction | Decimal128 | 4,400,000 | |
| nonResidentTaxRate | Number | 20 | flat % |
| taxBrackets | [Mixed] | [] | `{upTo, rate}` progressive |
| insuranceRates | Mixed | — | employee/employer rates |
| salaryComponentWeights | Object | `{20,60,20}` | sum = 100 |
| createdBy / updatedBy | →users | | |

`salaryComponentWeights` = `{ attendance(0–100), performance(0–100), goal(0–100) }`. Index `{country:1,year:1,effectiveFrom:1}` unique. Snapshot into payroll at compute time.

## 26. allowances  (`Allowance`)

`employeeId→employees`, `name`, `category` (`position|responsibility|transport|meal|housing|phone|other`), `type` (`fixed|percentage`), `amount` Decimal128, `isTaxable`, `isInsuranceBase`, `effectiveDate`, `endDate?`, `note?`, `createdBy→users`. Indexes `{employeeId:1}`, `{employeeId:1,effectiveDate:-1}`.

## 27. bonuses  (`Bonus`)

`employeeId→employees`, `payrollPeriodId→payrollPeriods`, `name`, `amount` Decimal128, `isTaxable` (default true), `reason?`, `approvedBy→users`, `createdBy→users`. Indexes `{employeeId:1}`, `{payrollPeriodId:1}`, `{employeeId:1,payrollPeriodId:1}`.

## 28. deductions  (`Deduction`)

`employeeId→employees`, `payrollPeriodId→payrollPeriods?` (null = recurring), `name`, `type` (`fixed|percentage`), `amount` Decimal128, `reason?`, `effectiveDate`, `endDate?`, `createdBy→users`. Indexes `{employeeId:1}`, `{employeeId:1,payrollPeriodId:1}`. Post-tax (applied to net).

## 29. monthlyEvaluations  (`MonthlyEvaluation`)

| Field | Type | Notes |
|-------|------|-------|
| employeeId | →employees | |
| payrollPeriodId | →payrollPeriods | one per employee/period |
| managerScores / criteriaScores | [CriterionScore] | `{criterionId→performanceCriteria, score 0–100}` |
| managerId | →employees | |
| managerNote / managerSubmittedAt | | |
| performanceRatio | Number 0–100 | avg of performance criteria → 60% component |
| goalResult / goalRatio | Number 0–100 | → 20% component |
| evaluatedBy | →users | |
| status | String | `draft|approved|acknowledged` (default draft) |
| approvedAt | Date | |
| strengths / improvements / developmentPlan | String | |
| acknowledgedAt / acknowledgedBy / disputeNote | | employee side |

Indexes: `{employeeId:1}`, `{payrollPeriodId:1}`, `{status:1}`, `{employeeId:1,payrollPeriodId:1}` unique. Ratios snapshot into payroll at compute.

## 30. performanceCriteria  (`PerformanceCriterion`)

`key` (unique), `label`, `description`, `type` (`performance|goal`, default performance), `weight` (0–100), `order`, `status` (`active|archived`). Indexes `{key:1}` unique, `{type:1}`, `{status:1}`. Ratio = simple average of active criteria of each type.

## 31. payrolls  (`Payroll`) — fully snapshotted

References: `payrollPeriodId`, `employeeId`, `policyConfigId`, `monthlyEvaluationId`.

**Work days:** `standardWorkDays`, `actualWorkDays`, `unpaidLeaveDays`, `workDays`, `leaveDays`.
**20/60/20 base (Decimal128):** `attendanceRatio` (0–1), `performanceRatio`/`goalRatio` (0–100), `attendanceComponent`, `performanceComponent`, `goalComponent`, `baseSalary`, `proRatedBaseSalary`.
**Earnings:** `totalTaxableAllowances`, `totalNonTaxableAllowances`, `totalAllowances`, `overtimePay`, `totalBonuses`, `grossSalary`.
**Employee insurance:** `insuranceBase`, `unemploymentInsuranceBase`, `socialInsurance` (8%), `healthInsurance` (1.5%), `unemploymentInsurance` (1%), `insurance` (=10.5%).
**Employer insurance (info):** `employerSocialInsurance` (17%), `employerHealthInsurance` (3%), `employerUnemploymentInsurance` (1%), `employerOccupationalInsurance` (0.5%).
**Tax:** `taxableIncome`, `personalDeduction`, `dependentDeduction`, `dependentsCount`, `taxableIncomeAfterDeduction`, `tax`.
**Net:** `totalDeductions`, `netSalary`.
**Status:** `status` (`draft|approved|paid`), `approvedBy→users`, `paidAt`, `computedAt`.

Indexes: `{payrollPeriodId:1}`, `{employeeId:1}`, `{status:1}`, `{payrollPeriodId:1,employeeId:1}` unique.

Formulas:
```
proRatedBaseSalary = baseSalary × (0.20·attendanceRatio + 0.60·perfRatio% + 0.20·goalRatio%)
grossSalary = proRatedBaseSalary + totalAllowances + overtimePay + totalBonuses
netSalary   = grossSalary − insurance − tax − otherDeductions
```

## 32. auditLogs  (`AuditLog`)

`userId→users?`, `resource`, `action`, `resourceId?`, `changes` (Mixed), `timestamp` (default now). Indexes `{userId:1}`, `{resource:1}`, `{action:1}`, `{timestamp:1}`, `{userId:1,timestamp:-1}`. Append-only.

## 33. passwordSetupTokens  (`PasswordSetupToken`)

`userId→users`, `tokenHash` (SHA256), `purpose` (`setup|reset`), `expiresAt` (**TTL**), `usedAt?`. Indexes `{userId:1}`, `{tokenHash:1}`, `{expiresAt:1}` TTL. Raw token only in email link.

## 34. companyConfigs  (`CompanyConfig`, singleton)

`key` (`global`, unique), `companyName` (default Soosky), `logoUrl?`, `timezone` (default `Asia/Ho_Chi_Minh`), `standardWorkDays` (default 22), `graceLateMinutes`/`graceEarlyMinutes` (default 5, 0–120), `overtimeEnabled` (default false), `lateAffectsPay` (default false), `contactEmail?`, `address?`. Index `{key:1}` unique.

---

## Design patterns

1. **Timestamps** `created_at`/`updated_at` on every collection.
2. **Money** in `Decimal128` (precision).
3. **Soft delete** via status (`terminated`/`archived`) — no hard deletes for HR records.
4. **Snapshots** — payroll captures contract salary, allowances, tax profile, evaluation at compute time; never references live rows.
5. **Versioning** — allowances / tax profiles / deductions use `effectiveDate`/`endDate`.
6. **TTL indexes** — `sessions`, `passwordSetupTokens` auto-expire.
7. **Partial indexes** — `userId`, `fingerprintId`, `taxCode` unique only when non-null.
8. **Junctions** — `userRoles`, `rolePermissions` (N:M with metadata).
