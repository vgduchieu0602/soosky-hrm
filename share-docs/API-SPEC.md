# Soosky HRM — API Specification

> **Auto-documented from the actual route/controller/DTO source as of 2026-06-21.**
> Canonical reference for all REST endpoints. Schemas (`DATABASE.md`) and flows (`USE-CASE.md`) live alongside this file.

---

## Overview

- **Base URL:** `/api/v1`
- **Protocol:** HTTPS (HTTP in dev)
- **Auth:** JWT Bearer access token in `Authorization` header; refresh token in httpOnly cookie
- **Format:** JSON envelope (see below)

### Authentication model

| Token | TTL | Storage | Notes |
|-------|-----|---------|-------|
| Access token | 15 min | in-memory (FE Zustand) | `Authorization: Bearer <token>` |
| Refresh token | 7 days | httpOnly cookie `refreshToken` | rotated on every `/auth/refresh`; hash stored in `sessions` |

- Algorithm HS256; issuer/audience `soosky-hrm` / `soosky-hrm-client`.
- JWT claims: `{ userId, roles[], permissions[], mustChangePassword?, sessionId? }`.

### Response envelopes

**Success**
```json
{ "success": true, "data": <T>, "message"?: "...",
  "meta"?: { "page": 1, "limit": 20, "total": 0, "totalPages": 0 } }
```
**Error**
```json
{ "success": false, "error": { "code": "FEATURE_NNN", "message": "...", "details"?: {} } }
```

### Roles & guards

- Roles: `admin`, `hr_manager`, `employee`.
- Middleware chain: `authenticate` (valid JWT) → `requireRoles(...)` / `hrOrAdmin` (role gate) → `validate(dto)` (Zod). Public routes opt out of `authenticate`.

---

## IAM — Auth, Users, Roles, Permissions, Audit

| Method | Path | Auth | Body | Purpose |
|--------|------|------|------|---------|
| POST | `/auth/login` | public | `{ identifier, password }` | Login (email or username) |
| POST | `/auth/refresh` | public (cookie) | — | Rotate tokens via refresh cookie |
| POST | `/auth/logout` | auth | — | Revoke current session |
| PATCH | `/auth/change-password` | auth | `{ currentPassword, newPassword }` | Change own password |
| GET | `/auth/me` | auth | — | Current user profile |
| GET | `/auth/set-password` | public | `?token=` | Validate a setup/reset token |
| POST | `/auth/set-password` | public | `{ token, password }` | Set password via emailed link |
| POST | `/users` | auth | `{ username, email, password, employeeId? }` | Create user |
| GET | `/users` | auth | `?status=&search=` | List users |
| GET | `/users/:id` | auth | — | Get user |
| PATCH | `/users/:id` | auth | `{ status? }` | Update user (enable/disable) |
| DELETE | `/users/:id` | auth | — | Delete user |
| POST | `/roles` | admin | `{ name, description?, permissionIds[]? }` | Create role |
| GET | `/roles` | auth | — | List roles |
| GET | `/roles/:id` | auth | — | Get role (+ permissionIds) |
| PATCH | `/roles/:id` | admin | `{ description?, permissionIds[]? }` | Update role |
| DELETE | `/roles/:id` | admin | — | Delete role (system roles blocked) |
| POST | `/permissions` | auth | `{ key, resource, action, description? }` | Create permission |
| GET | `/permissions` | auth | — | List permissions |
| GET | `/permissions/:id` | auth | — | Get permission |
| PATCH | `/permissions/:id` | auth | — | Update permission |
| DELETE | `/permissions/:id` | auth | — | Delete permission |
| GET | `/admin/audit-logs` | admin | `?resource=&limit=` | List audit logs |

**DTO highlights** — `login`: `identifier` 1–120, `password` ≤200. `createUser`: `username` 3–120, `email` lowercase, `password` 8–200, `employeeId` 24-char. `changePassword`: `newPassword` 8–72. `setPassword`: `token` ≥10, `password` 8–72. `permission.action` ∈ `create|read|update|delete|approve`.

---

## Organization — Departments & Positions

| Method | Path | Auth | Body | Purpose |
|--------|------|------|------|---------|
| GET | `/departments` | auth | — | List departments (tree/flat) |
| GET | `/departments/:id` | auth | — | Get department |
| GET | `/departments/:id/history` | auth | — | Department change history |
| POST | `/admin/departments` | hr/admin | `{ name, code, parentDepartmentId?, managerId?, costCenter?, location?, email?, description? }` | Create |
| PATCH | `/admin/departments/:id` | hr/admin | create fields (optional) + `status?` | Update |
| PATCH | `/admin/departments/:id/head` | hr/admin | `{ managerId }` | Assign/clear head |
| PATCH | `/admin/departments/:id/move` | hr/admin | `{ parentDepartmentId }` | Reparent |
| POST | `/admin/departments/:id/transfer-employees` | hr/admin | `{ targetDepartmentId, employeeIds[]? }` | Bulk transfer (omit ids = all) |
| POST | `/admin/departments/:id/merge` | hr/admin | `{ targetDepartmentId }` | Merge then archive |
| DELETE | `/admin/departments/:id` | hr/admin | — | Archive (soft delete) |
| GET | `/positions` | auth | — | List positions |
| GET | `/positions/:id` | auth | — | Get position |
| POST | `/admin/positions` | hr/admin | `{ title, code, departmentId, level?, description? }` | Create |
| PATCH | `/admin/positions/:id` | hr/admin | `{ title?, departmentId?, level?, description? }` | Update |
| DELETE | `/admin/positions/:id` | hr/admin | — | Delete |

---

## Employee — Core, Profile, Sub-resources, Account

| Method | Path | Auth | Body | Purpose |
|--------|------|------|------|---------|
| GET | `/employees` | auth | `?page=&limit=&search=&departmentId=&status=` | List (paginated) |
| GET | `/employees/stats` | auth | — | Headcount stats |
| GET | `/employees/export` | auth | — | CSV export |
| GET | `/employees/me` | auth | — | Own employee record |
| GET | `/employees/:id` | auth | — | Get employee |
| GET | `/employees/:id/account` | auth | — | Linked account summary (`hasAccount`) |
| GET | `/employees/:id/profile` | auth | — | Profile |
| PATCH | `/employees/:id/profile` | auth | profile fields | Update profile (self/HR) |
| GET | `/employees/:id/documents` | auth | — | List documents |
| GET | `/employees/:id/contacts` | auth | — | List contacts |
| GET | `/employees/:id/bank-accounts` | auth | — | List bank accounts |
| GET | `/employees/:id/contracts` | auth | — | List contracts |
| GET | `/employees/:id/assets` | auth | — | List assets |
| GET | `/employees/:id/history` | auth | — | Change-history timeline |
| POST | `/employees/:id/documents` | auth | `{ documentType, documentNumber, fileUrl?, issuedDate?, expiryDate?, issuedBy? }` | Add document |
| POST | `/employees/:id/contacts` | auth | `{ name, relationship, phone?, email?, address?, isPrimary? }` | Add contact |
| PATCH | `/employees/:id/contacts/:contactId` | auth | contact fields | Update contact |
| DELETE | `/employees/:id/contacts/:contactId` | auth | — | Delete contact |
| POST | `/employees/:id/bank-accounts` | auth | `{ bankName, branch?, accountNumber, accountHolder, isPrimary? }` | Add bank account |
| PATCH | `/employees/:id/bank-accounts/:accountId` | auth | bank fields | Update bank account |
| POST | `/admin/employees` | hr/admin | `{ employeeCode, departmentId, positionId, hireDate, employeeType, salaryZone?, profile{...} }` | Create employee |
| PATCH | `/admin/employees/:id` | hr/admin | `{ departmentId?, positionId?, managerId?, employeeType?, status?, salaryZone? }` | Update employee |
| POST | `/admin/employees/:id/grant-login` | hr/admin | `{ username?, sendEmail? }` | Provision account (atomic) + invite |
| POST | `/admin/employees/:id/terminate` | hr/admin | `{ terminationDate?, reason? }` | Terminate (soft delete) |
| DELETE | `/admin/employees/:id` | hr/admin | — | Hard delete (cascade) |
| POST | `/admin/employees/:id/reset-password` | hr/admin | — | Send password-reset link |
| POST | `/admin/employees/:id/resend-invite` | hr/admin | — | Resend setup invite |
| PATCH | `/admin/employees/:id/account` | hr/admin | `{ status?, role? }` | Update linked account |
| PATCH | `/admin/employees/:id/documents/:docId` | hr/admin | document fields | Update document |
| DELETE | `/admin/employees/:id/documents/:docId` | hr/admin | — | Delete document |
| POST | `/admin/employees/:id/contracts` | hr/admin | `{ contractType, contractNumber, startDate, endDate?, baseSalary, currency?, fileUrl?, status? }` | Add contract |
| PATCH | `/admin/employees/:id/contracts/:contractId` | hr/admin | contract fields | Update contract |
| POST | `/admin/employees/:id/assets` | hr/admin | `{ assetName, assetCode, assignedDate, condition?, note? }` | Assign asset |
| PATCH | `/admin/employees/:id/assets/:assetId/return` | hr/admin | `{ returnedDate?, condition?, note? }` | Mark returned |
| PATCH | `/admin/employees/:id/assets/:assetId` | hr/admin | asset fields | Update asset |
| DELETE | `/admin/employees/:id/assets/:assetId` | hr/admin | — | Delete asset |

**`profile` (create) fields:** `firstName`, `middleName?`, `lastName`, `dateOfBirth?`, `gender?`, `nationality?`, `maritalStatus?`, `email?` (personal — required to grant login), `workEmail?`, `phone?`, `address?`. Update profile additionally accepts `avatarUrl?`, `avatarId?`.

---

## Attendance & Leave

| Method | Path | Auth | Body | Purpose |
|--------|------|------|------|---------|
| GET | `/shifts` | auth | — | List shifts |
| POST | `/admin/shifts` | hr/admin | `{ name, type?, startTime, endTime, breakMinutes?, workingDays[]? }` | Create shift |
| PATCH | `/admin/shifts/:id` | hr/admin | shift fields + `status?` | Update shift |
| DELETE | `/admin/shifts/:id` | hr/admin | — | Delete shift |
| GET | `/holidays` | auth | — | List holidays |
| POST | `/admin/holidays` | hr/admin | `{ name, date, isRecurring?, country?, description? }` | Create holiday |
| PATCH | `/admin/holidays/:id` | hr/admin | holiday fields | Update holiday |
| DELETE | `/admin/holidays/:id` | hr/admin | — | Delete holiday |
| GET | `/attendance-symbols` | auth | — | List symbols |
| POST | `/admin/attendance-symbols` | hr/admin | `{ code, label, paidStatus?, affectsPayroll?, leaveType?, color? }` | Create symbol |
| PATCH | `/admin/attendance-symbols/:id` | hr/admin | symbol fields | Update symbol |
| GET | `/attendances/me` | auth | — | Own records (current month) |
| POST | `/attendances/check-in` | auth | — | Self check-in |
| POST | `/attendances/check-out` | auth | — | Self check-out |
| GET | `/admin/attendances` | hr/admin | `?month=&departmentId=` | Full attendance grid |
| POST | `/admin/attendances` | hr/admin | `{ employeeId, date, shiftId, checkIn?, checkOut?, status?, note? }` | Upsert record |
| POST | `/admin/attendances/bulk` | hr/admin | `{ rows: [...] }` (≤500) | Bulk upsert |
| PATCH | `/admin/attendances/:id` | hr/admin | `{ shiftId?, checkIn?, checkOut?, status?, note?, reason? }` | Adjust record |
| DELETE | `/admin/attendances/:id` | hr/admin | — | Delete record |
| POST | `/leave-requests` | auth | `{ leaveType, startDate, endDate, halfDaySession?, reason? }` | Submit leave |
| GET | `/leave-requests/me` | auth | — | Own leave requests |
| PATCH | `/leave-requests/:id/cancel` | auth | — | Cancel own request |
| GET | `/leave-balances/me` | auth | — | Own balances |
| GET | `/admin/leave-requests` | hr/admin | — | All requests (review) |
| POST | `/admin/leave-requests/:id/approve` | hr/admin | — | Approve → sync attendance + balance |
| POST | `/admin/leave-requests/:id/reject` | hr/admin | `{ reason }` | Reject |
| GET | `/admin/leave-balances/:employeeId` | hr/admin | — | Employee balances |

---

## Payroll & Compensation

| Method | Path | Auth | Body | Purpose |
|--------|------|------|------|---------|
| GET | `/payroll/periods` | hr/admin | — | List periods |
| GET | `/payroll/periods/:id` | hr/admin | — | Get period |
| POST | `/payroll/periods` | hr/admin | `{ name(YYYY-MM), startDate, endDate, payDate, standardWorkDays? }` | Create period |
| PATCH | `/payroll/periods/:id` | hr/admin | period fields | Update period |
| POST | `/payroll/periods/:id/close` | hr/admin | — | Close period |
| POST | `/payroll/periods/:id/run` | hr/admin | `{ requireApprovedEvaluation? }` | Compute all employees |
| POST | `/payroll/periods/:id/run/:employeeId` | hr/admin | — | Compute one employee |
| GET | `/payroll/periods/:periodId/totals` | hr/admin | — | Period totals |
| GET | `/payroll/payrolls` | hr/admin | — | List payrolls |
| GET | `/payroll/payrolls/me` | auth | — | Own payslips (approved/paid) |
| GET | `/payroll/payrolls/:id` | hr/admin | — | Payroll detail (gross→net) |
| POST | `/payroll/periods/:id/approve` | hr/admin | `{ employeeId? }` | Approve (all or one) |
| POST | `/payroll/payrolls/:id/revert` | hr/admin | — | Revert approved → draft |
| POST | `/payroll/periods/:id/mark-paid` | admin | — | Mark period paid |
| GET | `/payroll/employees/:employeeId/allowances` | hr/admin | — | List allowances |
| POST | `/payroll/allowances` | hr/admin | `{ employeeId, name, category?, type, amount, isTaxable, isInsuranceBase?, effectiveDate, endDate?, note? }` | Create allowance |
| PATCH | `/payroll/allowances/:id` | hr/admin | allowance fields | Update |
| DELETE | `/payroll/allowances/:id` | hr/admin | — | Delete |
| GET | `/payroll/employees/:employeeId/bonuses` | hr/admin | — | List bonuses |
| POST | `/payroll/bonuses` | hr/admin | `{ employeeId, payrollPeriodId, name, amount, isTaxable?, reason? }` | Create bonus |
| PATCH | `/payroll/bonuses/:id` | hr/admin | bonus fields | Update |
| DELETE | `/payroll/bonuses/:id` | hr/admin | — | Delete |
| GET | `/payroll/employees/:employeeId/deductions` | hr/admin | — | List deductions |
| POST | `/payroll/deductions` | hr/admin | `{ employeeId, payrollPeriodId?, name, type, amount, reason?, effectiveDate, endDate? }` | Create deduction |
| PATCH | `/payroll/deductions/:id` | hr/admin | deduction fields | Update |
| DELETE | `/payroll/deductions/:id` | hr/admin | — | Delete |
| GET | `/payroll/employees/:employeeId/tax-profiles` | hr/admin | — | List tax profiles |
| POST | `/payroll/tax-profiles` | hr/admin | `{ employeeId, taxCode?, isResident?, dependentsCount, effectiveDate, endDate?, note? }` | Upsert tax profile |

---

## Performance / Evaluation

| Method | Path | Auth | Body | Purpose |
|--------|------|------|------|---------|
| GET | `/performance/evaluations/me` | auth | — | Own evaluations |
| POST | `/performance/evaluations/:id/acknowledge` | auth | `{ disputeNote? }` | Employee acknowledges |
| GET | `/performance/evaluations` | hr/admin | — | List all evaluations |
| GET | `/performance/evaluations/:id` | auth | — | Get evaluation |
| POST | `/performance/evaluations` | hr/admin | `{ employeeId, payrollPeriodId, criteriaScores[{criterionId,score}], strengths?, improvements?, developmentPlan?, finalize? }` | Direct-evaluate (draft/approve) |
| POST | `/performance/evaluations/:id/reopen` | hr/admin | — | Reopen approved → draft |
| GET | `/settings/performance-criteria` | auth | — | List criteria |
| POST | `/admin/settings/performance-criteria` | hr/admin | `{ label, description?, type?, weight?, order?, key? }` | Create criterion |
| PATCH | `/admin/settings/performance-criteria/:id` | hr/admin | criterion fields + `status?` | Update criterion |
| DELETE | `/admin/settings/performance-criteria/:id` | hr/admin | — | Archive criterion |

`criteriaScores[].score` ∈ 0–100. `type` ∈ `performance | goal`.

---

## Settings

| Method | Path | Auth | Body | Purpose |
|--------|------|------|------|---------|
| GET | `/settings/company` | auth | — | Company config |
| PATCH | `/admin/settings/company` | admin | `{ companyName?, logoUrl?, timezone?, standardWorkDays?, graceLateMinutes?, graceEarlyMinutes?, contactEmail?, address? }` | Update company config |
| GET | `/settings/salary-policies` | hr/admin | — | List salary policies |
| POST | `/admin/settings/salary-policies` | admin | salary-policy fields | Create policy |
| PATCH | `/admin/settings/salary-policies/:id` | admin | salary-policy fields | Update policy |

**Salary-policy body:** `{ country, year, effectiveFrom, baseSalary, insuranceCeilingMultiplier?, personalDeduction?, dependentDeduction?, nonResidentTaxRate?, regionalMinWage?, taxBrackets[{upTo,rate}]?, insuranceRates{ employee{social,health,unemployment}, employer{social,health,unemployment,occupational} }?, salaryComponentWeights{attendance,performance,goal} (sum=100) }`.

---

## Storage (uploads)

| Method | Path | Auth | Body | Purpose |
|--------|------|------|------|---------|
| POST | `/uploads/presign` | auth | `{ scope, fileName, contentType, ownerId? }` | Presigned upload URL (S3) |
| GET | `/uploads/sign` | auth | `?key=` | Presigned download URL |

`scope` ∈ `avatars | employee-documents | contracts | payslips | other`.

---

## Conventions

- **Error codes:** `[FEATURE]_[NUMBER]` — `AUTH_*`, `IAM_*`, `EMP_*`, `ORG_*`, `ATT_*`, `LEAVE_*`, `PAY_*`, `PERF_*`, `SET_*`, `STOR_*`.
- **Pagination:** list endpoints return `meta { page, limit, total, totalPages }` where applicable.
- **Soft delete:** employees → `status:'terminated'`; departments/shifts/criteria → `status:'archived'`.
- **Transactions:** grant-login, payroll run, leave approval are atomic (Mongoose sessions → replica set required).
- **Audit:** every mutation writes an `auditLogs` entry (`userId, resource, action, resourceId, changes`).
