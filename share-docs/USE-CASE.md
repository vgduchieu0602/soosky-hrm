# Soosky HRM — Toàn bộ Use-Case

## Vai trò & phân quyền
Seed `backend/scripts/seed.ts`:
- **admin** — toàn quyền.
- **hr_manager** — như admin trừ `iam:role:update`; cấp login, chạy/duyệt lương, duyệt phép, đánh giá.
- **employee** — tự phục vụ: xem hồ sơ mình, chấm công, xin phép, xem phiếu lương/đánh giá.

UI ẩn/hiện theo quyền (chỉ UX); **backend luôn là nguồn thực thi** qua `requireRoles`/`selfOrHr`.

---

## 1. Xác thực & Định danh (IAM)

| UC | Endpoint | Guard | Mô tả |
|----|----------|-------|-------|
| 1.1 Đăng nhập | `POST /auth/login` | public | `{identifier,password}` → kiểm `status='active'`, bcrypt, đếm/khóa `failedLoginAttempts`, phát access (15m) + refresh (14d, hash lưu `sessions`). Trả `user.mustChangePassword`. |
| 1.2 Refresh xoay vòng | `POST /auth/refresh` | cookie httpOnly | Validate session theo hash, xoay token (reuse-detection revoke toàn bộ), re-check `status='active'`. FE axios tự refresh 1 lần khi 401 rồi retry (single-flight), thất bại mới logout. |
| 1.3 Đăng xuất / hồ sơ phiên | `POST /auth/logout` · `GET /auth/me` | auth | logout revoke phiên hiện tại. |
| 1.4 Set/Reset mật khẩu qua email | `GET/POST /auth/set-password` | token single-use | TTL setup 7 ngày / reset 2 giờ; đặt xong **revoke toàn bộ session**, clear `mustChangePassword`, mở khóa `locked`. |
| 1.5 Đổi mật khẩu | `PATCH /auth/change-password` | auth | Kiểm mật khẩu cũ, chặn trùng; **revoke mọi phiên khác, giữ phiên hiện tại**. |
| 1.6 Bắt buộc đổi mật khẩu lần đầu | *(enforce)* | auth | User `mustChangePassword=true` bị **chặn 403 `IAM_013`** ở mọi API trừ change-password/logout/me. FE tự điều hướng trang `/auth/change-password` (guard `MustChangePasswordRoute` + interceptor bắt IAM_013). |

## 2. Quản trị IAM

| UC | Endpoint | Guard |
|----|----------|-------|
| 2.1 Users CRUD | `GET /users` (hrOrAdmin) · `GET /users/:id` (hrOrAdmin) · `POST/PATCH/DELETE /users[/:id]` (**adminOnly**) |
| 2.2 Roles | `GET /roles[/:id]` (auth) · `POST/PATCH/DELETE /roles[/:id]` (**adminOnly**) |
| 2.3 Permissions | `GET /permissions[/:id]` (auth) · `POST/PATCH/DELETE /permissions[/:id]` (**adminOnly**) |
| 2.4 Nhật ký kiểm toán | `GET /admin/audit-logs` (**adminOnly**) — append-only, mọi mutation service đều ghi. |

## 3. Quản lý nhân viên

| UC | Endpoint | Guard | Ghi chú |
|----|----------|-------|--------|
| 3.1 Danh sách / thống kê / export | `GET /employees` · `/employees/stats` · `/employees/export` (XLSX) | auth | |
| 3.2 Xem của tôi | `GET /employees/me` | auth | |
| 3.3 Tạo nhân viên | `POST /admin/employees` | hrOrAdmin | transactional: Employee(`onboarding`,`userId=null`) + Profile + hire history + seed leave balance. Form modal 3 bước; Họ/Tên đệm/Tên trên **cùng 1 hàng**. |
| 3.4 Sửa core / hồ sơ | `PATCH /admin/employees/:id` (hrOrAdmin) · `PATCH /employees/:id/profile` (**selfOrHr**) | | Ghi EmployeeHistory. |
| 3.5 Đọc hồ sơ + tài khoản + hoàn thiện | `GET /employees/:id[/account|/completeness|/profile]` | **selfOrHr** | IDOR đã đóng (chỉ chính chủ hoặc HR). |
| 3.6 Cấp tài khoản đăng nhập | `POST /admin/employees/:id/grant-login` | hrOrAdmin | atomic: tạo User + userId + UserRole(employee) + audit; phát email mời. Tài khoản mới `mustChangePassword=true`. |
| 3.7 Terminate (nghỉ việc) | `POST /admin/employees/:id/terminate` · `/bulk/terminate` | hrOrAdmin | **transactional**: `status=terminated` + disable User + **revoke session** + unset `userId` + gỡ managerId subordinate. |
| 3.8 Hard delete (cascade) | `DELETE /admin/employees/:id` | hrOrAdmin | transactional, xóa toàn bộ record liên quan. |
| 3.9 Tài khoản: reset pw / gửi lại lời mời / bật-tắt | `POST /admin/employees/:id/reset-password` · `/resend-invite` · `PATCH /admin/employees/:id/account` | hrOrAdmin | disable account revoke session. |
| 3.10 Import / nhắc hạn | `POST /admin/employees/import` · `GET /employees/reminders` · `POST /admin/employees/reminders/run` | hrOrAdmin | |
| **Sub-resources** (đều `selfOrHr` hoặc hrOrAdmin) | | | |
| 3.11 Liên hệ khẩn cấp | `GET/POST/PATCH/DELETE /employees/:id/contacts[/:contactId]` | selfOrHr | update/remove scope theo `employeeId` (chặn IDOR id con). |
| 3.12 Tài khoản ngân hàng | `GET/POST/PATCH/DELETE /employees/:id/bank-accounts[/:accountId]` | selfOrHr | **Ngân hàng = dropdown** lấy từ danh mục Ngân hàng (Cài đặt); scope theo employeeId. |
| 3.13 Tài liệu | `GET/POST /employees/:id/documents` (selfOrHr) · `PATCH/DELETE /admin/employees/:id/documents/:docId` (hrOrAdmin) | | Có **xem trước** (ảnh/PDF) qua presigned URL + tải xuống. |
| 3.14 Hợp đồng | `GET /employees/:id/contracts` (selfOrHr) · `POST/PATCH /admin/employees/:id/contracts[/:contractId]` (hrOrAdmin) | | Không hard-delete (là snapshot lương; vô hiệu bằng `status='expired'`). Payroll snapshot `baseSalary` hợp đồng active. |
| 3.15 Tài sản | `GET /employees/:id/assets` (selfOrHr) · `POST/PATCH/DELETE /admin/employees/:id/assets...` (hrOrAdmin) | | gồm đánh dấu trả (`/return`). |
| 3.16 Lịch sử thao tác | `GET /employees/:id/history` | selfOrHr | **Bộ lọc tối giản**: Khoảng thời gian / Loại hành động / Phân loại dữ liệu; **Accordion**: click item mới trượt xuống so sánh Cũ → Mới. |

## 4. Tổ chức

| UC | Endpoint | Guard | Ghi chú |
|----|----------|-------|--------|
| 4.1 Phòng ban (cây) đọc | `GET /departments[/:id|/:id/history]` | auth | |
| 4.2 Phòng ban tạo/sửa | `POST /admin/departments` · `PATCH /admin/departments/:id` | hrOrAdmin | Form chỉ còn Tên/Mã/Phòng ban cha/Mô tả (đã **bỏ Trung tâm chi phí, Địa điểm, Email**). |
| 4.3 Vận hành phòng ban | `PATCH .../:id/head` · `/move` · `POST .../:id/transfer-employees` · `/merge` | hrOrAdmin | gán trưởng phòng, reparent, chuyển nhân viên, gộp. |
| 4.4 Xóa phòng ban | `DELETE /admin/departments/:id` | hrOrAdmin | **Xóa trực tiếp khi không còn phụ thuộc**; nếu còn nhân viên/vị trí/phòng ban con → **409 cảnh báo** liệt kê số lượng. |
| 4.5 Vị trí | `GET /positions[/:id]` (auth) · `POST/PATCH/DELETE /admin/positions[/:id]` (hrOrAdmin, DELETE = archive) | | |

## 5. Chấm công & Nghỉ phép

| UC | Endpoint | Guard | Ghi chú |
|----|----------|-------|--------|
| 5.1 Tự check-in/out | `POST /attendances/check-in` · `/check-out` · `GET /attendances/me` | auth | Suy trạng thái theo ca + grace (tz công ty). **Chặn punch nếu ngày đã có phép cả ngày duyệt** (`ATT_007`); chặn kỳ đã khóa. |
| 5.2 Lưới chấm công HR | `GET /admin/attendances` · `POST /admin/attendances` · `/bulk` · `PATCH/DELETE /admin/attendances[/:id]` | hrOrAdmin | Hiển thị **theo kí hiệu cấu hình** (mỗi kí hiệu gắn 1 trạng thái); toggle **Chấm / Chữ** do người dùng chọn. |
| 5.3 Xin nghỉ phép | `POST /leave-requests` · `GET /leave-requests/me` · `PATCH /leave-requests/:id/cancel` | auth (cancel chỉ `pending`) | Loại cuối tuần + lễ; **nửa ngày rơi vào cuối tuần/lễ → 0 → chặn submit**. |
| 5.4 Duyệt / từ chối / thu hồi | `POST /admin/leave-requests/:id/approve` · `/reject` · `/revoke` | hrOrAdmin | Approve transactional: re-check quota → `used+=` → sync attendance; **phép cả ngày xóa mọi record khác trong ngày** (chống đếm trùng). Reject clear attendance. Revoke (đơn đã duyệt): hoàn `used` **sàn ≥ 0** + clear attendance. |
| 5.5 Hạn mức phép | `GET /leave-balances/me` (self) · `GET /admin/leave-balances/:employeeId` · `POST /admin/leave-balances` (hrOrAdmin) | | **`entitled<=0` = chưa cấu hình → chặn** đơn có quota (`LV_005`); chỉ `unpaid` không giới hạn. |
| 5.6 Danh mục — Ca làm | `GET /shifts` (auth) · `POST/PATCH/DELETE /admin/shifts[/:id]` (hrOrAdmin) | | Giờ vào/ra nhập bằng ô **`HH:mm` segmented** (`--:--` + picker + validate). |
| 5.7 Danh mục — Ngày lễ | `GET /holidays` · `POST/PATCH/DELETE /admin/holidays[/:id]` | | **Lặp hằng năm** (8/3, 20/10…) chỉ nhập Ngày/Tháng (không cần năm, lưu sentinel year); hoặc one-off nhập ngày cụ thể. |
| 5.8 Danh mục — Kí hiệu chấm công | `GET /attendance-symbols` · `POST/PATCH/DELETE /admin/attendance-symbols[/:id]` | | Mỗi kí hiệu: mã + nhãn + **màu** + **trạng thái áp dụng** (1 trong 8 trạng thái) → điều khiển hiển thị lưới. |

**Vào payroll:** `aggregatePeriodAttendance → dedupeByDay → summarizeAttendance`. `actualWorkDays = worked + paidLeave + holiday`; `incomplete` bị loại; 2 tầng chống đếm trùng.

## 6. Bảng lương

**State machine kỳ lương** `open → processing → closed → paid`:
```
open ──approve(toàn kỳ)──► processing ──mark-paid──► paid
 │                              │
 │◄──── reopen (revert approved→draft) ────┤
 └──close──► closed ──reopen──► open
   close: chặn nếu còn dòng draft (PAY_DRAFT_REMAINING)
   reopen: kỳ 'paid' → 409 PAY_PERIOD_PAID
Payroll row: (none) ──run──► draft ──approve──► approved ──mark-paid──► paid ; revert: approved→draft
   run lại: draft=recompute ; approved/paid → 409 PAY_ALREADY_FINALIZED
```

| UC | Endpoint | Guard |
|----|----------|-------|
| 6.1 Kỳ lương | `GET/POST /payroll/periods` · `GET/PATCH /payroll/periods/:id` · `POST /:id/close` (hrOrAdmin) · `POST /:id/reopen` (**adminOnly**) · `DELETE /payroll/periods/:id` (hrOrAdmin, chặn nếu đã có bảng lương) |
| 6.2 Chốt/mở chấm công | `GET /:id/attendance-readiness` · `POST /:id/lock-attendance` · `/unlock-attendance` (hrOrAdmin) |
| 6.3 Tính lương | `POST /:id/run` · `POST /:id/run/:employeeId` (hrOrAdmin) — cần chốt chấm công; `{requireApprovedEvaluation?}` |
| 6.4 Review | `GET /payroll/payrolls[/:id]` · `/periods/:periodId/totals` · `/preflight` · `/export` (hrOrAdmin) |
| 6.5 Duyệt / revert / trả | `POST /:id/approve` (hrOrAdmin) · `POST /payrolls/:id/revert` (hrOrAdmin) · `POST /:id/mark-paid` (**adminOnly**) |
| 6.6 Đãi ngộ | allowances/bonuses/deductions/tax-profiles: `GET /payroll/employees/:employeeId/...` + `POST/PATCH/DELETE /payroll/{allowances,bonuses,deductions}[/:id]` + `POST /payroll/tax-profiles` (hrOrAdmin) |
| 6.7 Gross-up | `POST /payroll/gross-up` (hrOrAdmin) |
| 6.8 Phiếu lương (NV) | `GET /payroll/payrolls/me` (auth) — chỉ approved/paid, khớp `user.employeeId` |

**Công thức lương (đã chốt):** chỉ cấu phần **chấm công 20%** prorate theo ngày công; **hiệu suất 60% & mục tiêu 20% trả đủ theo ratio** bất kể chấm công (opt-in `prorateByAttendance` nếu muốn prorate cả 3).
```
attendance  = 20% · base · (actualWorkDays/standardWorkDays)
performance = 60% · base · (performanceRatio/100)
goal        = 20% · base · (goalRatio/100)
gross = proRatedBase + allowances + bonuses + OT(0)
BHXH (NV 10.5%) trên policy.socialInsuranceSalary (mức cố định) + allowance cờ isInsuranceBase, có cap
thuế: lũy tiến 7 bậc (resident) hoặc flat nonResidentTaxRate% ; giảm trừ từ policy
net = gross − BHXH − thuế − đoàn phí − khấu trừ khác
```
**Pay-base theo `employmentStatus`:** internship = full base, prorate chấm công, miễn BHXH · probation = `probationPayRate` (85%), miễn BHXH, bỏ 60/20 · official = đủ 20/60/20 + BHXH + đoàn phí. `standardWorkDays` tính theo ca thực (trừ lễ).

## 7. Hiệu suất

**State machine** `draft → approved → acknowledged`.

| UC | Endpoint | Guard | Ghi chú |
|----|----------|-------|--------|
| 7.1 Tiêu chí | `GET /settings/performance-criteria` (auth) · `POST/PATCH/DELETE /admin/settings/performance-criteria[/:id]` (hrOrAdmin, DELETE=archive) | | type `performance`(60%)/`goal`(20%); ratio = trung bình đơn giản; **không đổi được `type` qua API** (DTO strict). |
| 7.2 Đánh giá | `POST /performance/evaluations` (hrOrAdmin) · list/byEmployee/export (hrOrAdmin) · `GET /:id` (auth, self-guard) | | upsert `{employeeId,payrollPeriodId}`; **Lưu nháp**=draft, **Duyệt**(finalize) tính ratio + `approved`; cần đủ điểm mỗi nhóm; chặn nếu đã acknowledged. |
| 7.3 Mở lại | `POST /performance/evaluations/:id/reopen` (hrOrAdmin) | | **Chặn 409 `EVAL_PAYROLL_LOCKED` nếu payroll kỳ+NV đã approved/paid** (giữ đồng bộ với payslip). |
| 7.4 Nhân viên xác nhận | `POST /performance/evaluations/:id/acknowledge` · `GET /performance/evaluations/me` | auth (chỉ đúng NV) | approved→acknowledged, sau đó bất biến; kèm `disputeNote` tùy chọn. |

## 8. Cài đặt

| UC | Endpoint | Guard | Ghi chú |
|----|----------|-------|--------|
| 8.1 Công ty | `GET /settings/company` (auth) · `PATCH /admin/settings/company` (**adminOnly**) | | tên, timezone, ngày công chuẩn, grace muộn/sớm, OT/lateAffectsPay. |
| 8.2 Chính sách lương | `GET /settings/salary-policies` (hrOrAdmin) · `POST/PATCH /admin/settings/salary-policies[/:id]` (**adminOnly**) | | base, min vùng, cap BH ×mult, giảm trừ, thuế, tỉ lệ BH, **weights 20/60/20 (DTO ép tổng=100)**. |
| 8.3 Ngân hàng | `GET /settings/banks` (auth) · `POST/PATCH/DELETE /admin/settings/banks[/:id]` (hrOrAdmin) | | **Danh mục ngân hàng** dùng cho dropdown ở tab Ngân hàng của hồ sơ NV. |
| 8.4 Tiêu chí hiệu suất | (xem 7.1) | | |
| 8.5 Shell Cài đặt | Tabs: Chung · Lương & Hiệu suất · Chấm công (ca/lễ/kí hiệu) · **Ngân hàng** · Người dùng · Vai trò & quyền · Nhật ký. | | |

## 9. Lưu trữ tệp (Storage)
| `POST /uploads/presign` (auth) — presigned PUT upload · `GET /uploads/sign?key=` (auth) — presigned GET để xem/tải/preview (avatar, tài liệu, hợp đồng). |

## 10. Thông báo
| `GET /notifications` · `/unread-count` · `POST /notifications/:id/read` · `/read-all` (auth). Event-driven (grant-login, payroll, leave…). |

## 11. Trải nghiệm nhập liệu & thông báo (xuyên suốt)
- **Ngày**: ô segmented `dd / mm / yyyy` (vạch `/` sẵn, tự nhảy ô, backspace lùi ô, picker lịch, validate ngày thật).
- **Giờ**: ô segmented `HH : mm` (`--:--` sẵn, picker đồng hồ, validate 0–23/0–59).
- **Modal tạo/sửa**: dùng chung shell **FormModal** (header gradient) — đồng bộ toàn hệ thống.
- **Toast (sonner)**: thông báo thành công/lỗi cho các thao tác.

## 12. Snapshot & bất biến
- Payroll snapshot: contract salary, allowances, tax profile, eval ratios — tại lúc `run`.
- Eval ratio cố định tại `approve`; payroll cố định tại `run`; approved/paid không recompute.
- Soft delete (terminated/archived) trừ những chỗ có hard-delete có kiểm tra phụ thuộc (phòng ban, hard delete employee); audit + history giữ lại.

## 13. Chuỗi end-to-end
**Lương tháng:** cấu hình chính sách/công ty/ngân hàng → tạo kỳ → NV chấm công + HR sửa lưới → HR đánh giá (draft→duyệt) → chốt chấm công → chạy lương (20/60/20 + BH + thuế → draft) → review → duyệt → mark-paid → NV xem phiếu.
**Nghỉ phép:** NV nộp → kiểm quota → HR duyệt → attendance tự sync + trừ balance → payroll tính `leave_paid` là công, `leave_unpaid`/`absent` là không công.
**Onboarding:** tạo NV → hợp đồng → cấp login → NV đăng nhập lần đầu **bắt buộc đổi mật khẩu** → dùng hệ thống.

## 14. Chưa làm / rủi ro chấp nhận
- Chưa làm: **Dashboard** (đang chờ), OT (policy-disabled), payslip PDF, gửi email thật (event đã phát), team view theo manager, carryover phép đa năm.
- Accepted-risk: **SEC-7** access-token 15m mang role cũ tới khi hết hạn · **SEC-9** re-hire nhân viên terminated qua grant-login chưa reactivate user disabled.

> Tài liệu liên quan: `USE-CASE-ASBUILT-2026-06-30.md` (đối chiếu chi tiết ngày 30/6), `AUDIT-E2E-2026-06-28.md` (lịch sử lỗ hổng + đã sửa), `API-SPEC.md`, `DATABASE.md`.
