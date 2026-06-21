# Soosky HRM — Implemented Use Cases

> **What the system actually does today**, documented from backend services + frontend pages as of 2026-06-21.
> Endpoint paths are canonical in `API-SPEC.md`; schemas in `DATABASE.md`. The end-to-end chain is
> **Chấm công (20%) → Hiệu suất (60%) + Mục tiêu (20%) → Bảng lương**.

---

## Roles & permission matrix

Seeded in `backend/scripts/seed.ts`:

- **admin** — full access (all permissions).
- **hr_manager** — all except `iam:role:update`; grants login, runs/approves payroll, approves leave, evaluates.
- **employee** — self-service: `self:read`, `attendance:read`, `leave:read`, `leave:create`, `payslip:read`, `performance:read`.

UI gating mirrors this (UX only); the backend enforces it via `requireRoles`/`hrOrAdmin`.

---

## 1. Authentication & Identity

### 1.1 Login + session
**Actor:** any user. `POST /auth/login` with `{identifier, password}` → verifies `status='active'`, bcrypt check, resolves roles+permissions, issues access (15m) + refresh (7d, hash stored in `sessions`). Failed attempts increment `failedLoginAttempts`; success resets it. `mustChangePassword=true` forces `/change-password`. FE: `LoginPage` → `auth.store`.

### 1.2 Refresh rotation
Axios interceptor calls `POST /auth/refresh` on 401; backend validates session, rotates refresh token (old hash invalidated), retries request once; a second 401 clears auth → `/login`.

### 1.3 Forced first-password / set-password
After grant-login the employee gets an emailed setup link → `POST /auth/set-password {token,password}`. Admin reset re-issues a `passwordSetupTokens` (purpose `reset`). `MustChangePasswordRoute` blocks the app until resolved.

---

## 2. Employee management

### 2.1 Create employee
**HR/Admin.** `CreateEmployeeModal` → `POST /admin/employees` with core + `profile`. Backend checks `employeeCode` unique, creates `Employee` (`status=onboarding`, `userId=null`) + `EmployeeProfile` + a hire `EmployeeHistory`. Optionally chains grant-login.

### 2.2 Update employee / profile
`PATCH /admin/employees/:id` (core, HR) or `PATCH /employees/:id/profile` (self or HR). Changes recorded in `EmployeeHistory`.

### 2.3 Grant login (atomic)
**HR/Admin**, `EmployeeDetail → GrantLoginDialog` → `POST /admin/employees/:id/grant-login`. Requires profile email; blocks if already provisioned. In one Mongoose transaction: create `User` (unusable random password, `employeeId` set), set `Employee.userId`, add `UserRole(employee)`, write `AuditLog`; emits `employee.granted-login` (invite email). The Account tab reads `GET /employees/:id/account`; it self-heals a one-sided link via the reverse `user.employeeId` reference.

### 2.4 Terminate
`POST /admin/employees/:id/terminate` → `status='terminated'`, `terminationDate`; soft delete (history preserved). Hard delete (cascade) only via `DELETE /admin/employees/:id`.

### 2.5 Sub-resources
Documents, contacts, bank accounts, contracts, assets, history — listed via `GET /employees/:id/<resource>`; employee self-serves contacts/bank/documents; HR manages contracts/assets and document deletion under `/admin/employees/:id/...`. Payroll snapshots the latest active contract's `baseSalary`.

---

## 3. Organization

### 3.1 Departments (tree)
`/organization/departments` tree view. HR/Admin: create/update, assign head (`/head`), reparent (`/move`), bulk-transfer employees, merge-then-archive, archive. No circular hierarchy; archive is soft delete.

### 3.2 Positions
CRUD under `/admin/positions`; `level` = seniority; used in hiring.

---

## 4. Attendance & Leave

### 4.1 Self check-in/out
**Employee.** `CheckInOutWidget` → `POST /attendances/check-in` / `/attendances/check-out`. Status derived from the shift window + `CompanyConfig` grace (default 5 min) in the company timezone: `present`/`late`/`early_leave`/`incomplete`. Late is tracked but **does not reduce pay** unless `lateAffectsPay=true` (default false). One record per (employee, date, shift).

### 4.2 Attendance grid (HR)
`GET /admin/attendances?month=` → roster × shifts grid. HR upserts/adjusts via `POST`/`PATCH /admin/attendances[/:id]`, bulk via `/admin/attendances/bulk` (≤500). Manual statuses: `leave_paid|leave_unpaid|holiday|absent`.

### 4.3 Submit leave
**Employee.** `POST /leave-requests {leaveType,startDate,endDate,halfDaySession?,reason?}`. Working days exclude weekends + holidays; balance checked (`entitled-used ≥ days`, unpaid = unlimited). Status `pending`. Cancel own via `PATCH /leave-requests/:id/cancel`.

### 4.4 Approve / reject leave
**HR/Admin.** `POST /admin/leave-requests/:id/approve` (atomic): set `approved`, sync `Attendance` rows per day (`leave_paid`/`leave_unpaid`, skip weekends/holidays, idempotent by `leaveRequestId`), increment `LeaveBalance.used`, audit. `POST /admin/leave-requests/:id/reject {reason}` clears generated attendance, no balance change.

### 4.5 Balances
`GET /leave-balances/me` (employee) / `GET /admin/leave-balances/:employeeId` (HR). One row per (employee, type, year); `entitled=0` = unlimited.

### 4.6 Catalogs — shifts / holidays / symbols
Admin CRUD under `/admin/shifts`, `/admin/holidays`, `/admin/attendance-symbols`. Holidays (fixed or recurring MM-DD) feed working-day math; weekends always excluded.

---

## 5. Payroll

### 5.1 Period lifecycle
`POST /payroll/periods {name(YYYY-MM),startDate,endDate,payDate,standardWorkDays?}`. Status `open → processing → closed → paid`. `standardWorkDays` snapshots `CompanyConfig` (default 22). Close via `/close`.

### 5.2 Compute (20/60/20)
`POST /payroll/periods/:id/run` (all) or `/run/:employeeId` (one); `{requireApprovedEvaluation?}` gates on approved evaluation (`PAY_EVAL_REQUIRED`). Per employee (transactional), resolves: active contract `baseSalary`; effective `SalaryPolicyConfig` at `payDate`; `MonthlyEvaluation` ratios; attendance aggregate (`aggregatePeriodAttendance`); tax profile (`isResident`, dependents); active allowances; period bonuses. Then:

```
attendanceComponent  = 20% · baseSalary · (actualWorkDays / standardWorkDays)
performanceComponent = 60% · baseSalary · (performanceRatio / 100)
goalComponent        = 20% · baseSalary · (goalRatio / 100)
proRatedBaseSalary   = sum of the three
gross   = proRatedBaseSalary + allowances + bonuses + overtimePay(0)
insurance(employee) = social 8% + health 1.5% + unemployment 1% = 10.5%
   (social/health base capped at baseSalary×20; unemployment base at regionalMinWage×20)
employer insurance  = 17% + 3% + 1% + 0.5% = 21.5% (recorded, not deducted from net)
taxableIncome = gross − insurance − nonTaxable
tax = progressive 7 brackets (5%→35%), resident; or flat nonResidentTaxRate% if non-resident
   deductions: personal 11,000,000 + 4,400,000 × dependents
net = gross − insurance − tax
```

Result upserted to `Payroll` (`{periodId,employeeId}` unique). Draft rows recompute; **approved/paid rows refuse recompute (409)**. OT disabled by policy (`overtimePay=0`).

### 5.3 Review → approve → pay
`PayrollPage` table + `PayslipDrawer`. `POST /payroll/periods/:id/approve {employeeId?}` → `draft→approved` (locks; can `revert` while not paid). `POST /payroll/periods/:id/mark-paid` (admin) → `approved→paid`. Totals via `/periods/:periodId/totals`.

### 5.4 Compensation
HR manages per-employee `allowances` (fixed/percentage, taxable + insurance-base flags), one-off `bonuses` (per period), `deductions` (recurring or per-period), and `tax-profiles` (residency + dependents) under `/payroll/...`. All snapshot into payroll at compute.

### 5.5 Payslip (employee)
`GET /payroll/payrolls/me` → `MyPayslipsPage` shows approved/paid only; full gross→net breakdown. Cannot see others (matched by `user.employeeId`).

---

## 6. Performance / Evaluation

### 6.1 Criteria (admin CRUD)
Admin/HR manage sub-criteria in Settings → `POST/PATCH/DELETE /admin/settings/performance-criteria`. Each has `type` (`performance`→60% or `goal`→20%); key auto-generated from label. Seed ships 4 performance + 2 goal criteria. **Ratio = simple average** of active criteria of each type (equal weight).

### 6.2 Direct evaluate (HR scores; employee only views)
`PerformancePage` lists all employees for a selected period → click → `EvaluationScoreDialog` → `POST /performance/evaluations {employeeId,payrollPeriodId,criteriaScores,strengths?,improvements?,developmentPlan?,finalize?}`. Upsert by `{employeeId,payrollPeriodId}`. **Lưu nháp** = `draft`; **Duyệt** (`finalize`) computes `performanceRatio`/`goalRatio` and sets `approved`. Finalize requires ≥1 score. Blocked if already `acknowledged`. HR can `POST /:id/reopen` (`approved→draft`) before payroll consumes it.

### 6.3 Acknowledge (employee)
`MyEvaluationsPage` shows approved evaluations → `POST /performance/evaluations/:id/acknowledge {disputeNote?}` → `acknowledged`. After that it is immutable for both sides.

**Status machine:** `draft → approved → acknowledged`. `performanceRatio` feeds the 60% component, `goalRatio` the 20% component, snapshotted into payroll.

---

## 7. Settings

### 7.1 Company config (admin)
`PATCH /admin/settings/company` — singleton `CompanyConfig`: companyName, timezone, standardWorkDays, grace late/early minutes (applied to attendance), contact/address. `overtimeEnabled`/`lateAffectsPay` default false.

### 7.2 Salary policy (admin)
`POST/PATCH /admin/settings/salary-policies` — `SalaryPolicyConfig`: base salary, regional min wage (zone1–4), insurance ceiling ×20, personal/dependent deductions, **tax type** (resident progressive brackets / non-resident editable flat %), **insurance rates** (employee 10.5% / employer 21.5% incl. TNLĐ-BNN), and 20/60/20 weights (sum=100). Resolved by `effectiveFrom ≤ payDate`; snapshotted into payroll.

### 7.3 Settings shell
`SystemSettingsPage` tabs: Chung (company), Lương & Hiệu suất (policy + criteria CRUD), Chấm công (shifts/holidays/symbols), Người dùng, Vai trò & quyền, Nhật ký. Users & Roles tabs are paginated.

---

## 8. Audit
Every mutating service writes `auditLogs` (`userId, resource, action, resourceId, changes`). Admin views at `/admin/audit-logs`. Append-only; secrets never logged.

---

## 9. End-to-end chains

**Payroll month:** policy/company config → create period → employees punch + HR corrects attendance → HR evaluates (draft→approve) → run payroll (20/60/20, insurance, tax → draft) → review → approve → mark paid → employee views payslip.

**Leave:** employee submits → balance checked → manager/HR approves → attendance auto-synced + balance decremented → payroll aggregation counts `leave_paid` as worked, `leave_unpaid`/`absent` as unpaid.

---

## 10. Snapshot & immutability rules

- Payroll snapshots contract salary, allowances, tax profile, and evaluation ratios at compute — never live rows.
- Evaluation ratios are fixed at **approve**; payroll fixes everything at **run**; approved/paid payroll cannot recompute.
- Soft deletes everywhere (terminated/archived); audit + history preserved.

## 11. Not yet implemented (infra present, off)
Overtime pay (policy-disabled), payslip PDF rendering, transactional email delivery (events emitted), manager-scoped team views, multi-year leave carryover, CSV bulk import.
