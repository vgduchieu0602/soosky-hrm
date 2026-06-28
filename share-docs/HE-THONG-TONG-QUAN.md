# Soosky HRM — Tài liệu Đặc tả Hệ thống (theo chuẩn Product Owner)

> Tài liệu mô tả **hệ thống hiện tại đã triển khai** dưới góc nhìn sản phẩm: yêu cầu (requirement), tình huống sử dụng (use case), và luồng nghiệp vụ (workflow).
> Bám sát mã nguồn thực tế trong repo — không phải bản đặc tả gốc. Phần đặc tả khảo sát gốc xem mục [Tham chiếu](#11-tham-chiếu).

- **Ngày cập nhật:** 2026-06-26
- **Đối tượng đọc:** Product Owner, Business Analyst, QA, đội phát triển, khách hàng nghiệm thu.
- **Tài liệu liên quan:** [API-SPEC.md](API-SPEC.md) · [DATABASE.md](DATABASE.md) · [PAYROLL-FORMULA.md](PAYROLL-FORMULA.md) · [HUONG-DAN-TINH-LUONG.md](HUONG-DAN-TINH-LUONG.md)

---

## 1. Tổng quan sản phẩm (Product Overview)

Soosky HRM là nền tảng quản lý nhân sự (Human Resource Management — HRM) cho doanh nghiệp, số hóa toàn bộ vòng đời nhân viên: từ tiếp nhận (onboarding) → vận hành hằng ngày (chấm công, nghỉ phép, đánh giá) → trả lương → nghỉ việc (offboarding).

**Vấn đề giải quyết (problem):**
- Quy trình nhân sự thủ công, rời rạc, dễ sai sót khi tính lương và quản lý công.
- Thiếu minh bạch: nhân viên không tự xem được công, lương, đánh giá của mình.
- Dữ liệu phân tán, khó tổng hợp báo cáo cho quản lý.

**Giá trị mang lại (value proposition):**
1. **Chuẩn hóa** (standardization) — một quy trình thống nhất cho mọi nghiệp vụ nhân sự.
2. **Tự động hóa** (automation) — tính lương, tổng hợp công, nhắc nhở hợp đồng tự động.
3. **Tự phục vụ & minh bạch** (self-service & transparency) — nhân viên tự xem dữ liệu cá nhân; quản lý xem báo cáo tập trung.

**Kiến trúc kỹ thuật (technical architecture):** Hệ thống nguyên khối tách 2 ứng dụng triển khai độc lập — **Backend** (REST API) và **Frontend** (web client).

| Tầng (layer) | Công nghệ (technology) |
|------|-----------|
| Giao diện (frontend) | React 19 + Vite + TypeScript + Zustand |
| Máy chủ (backend) | Node.js + TypeScript + Express + Mongoose + Zod + Pino |
| Cơ sở dữ liệu (database) | MongoDB (replica set hỗ trợ giao dịch — transaction) |
| Xác thực (authentication) | JWT (access 15 phút + refresh 7 ngày, có xoay vòng — rotation) + bcrypt |
| Lưu trữ tệp (file storage) | S3 (URL ký trước — presigned URL) |

---

## 2. Phạm vi & Mục tiêu (Scope & Goals)

### 2.1 Trong phạm vi (In scope) — đã triển khai

| # | Phân hệ (module)                                 | Năng lực chính (capability)                                                                   |
|---|--------------------------------------------------|-----------------------------------------------------------------------------------------------|
| 1 | Định danh & Phân quyền (Identity & Access — IAM) | Đăng nhập, phiên (session), vai trò (role), quyền (permission), nhật ký kiểm toán (audit log) |
| 2 | Tổ chức (Organization)                           | Phòng ban (department) dạng cây, chức vụ (position)                                           |
| 3 | Nhân viên (Employee)                             | Hồ sơ, hợp đồng, tài liệu, liên hệ, tài khoản ngân hàng, tài sản, lịch sử                     |
| 4 | Chấm công & Nghỉ phép (Attendance & Leave)       | Ca làm, ngày lễ, ký hiệu công, check-in/out, đơn nghỉ, số dư phép                             |
| 5 | Tiền lương (Payroll)                             | Kỳ lương, tính lương, phụ cấp/thưởng/khấu trừ, hồ sơ thuế, phiếu lương                        |
| 6 | Đánh giá hiệu suất (Performance)                 | Đánh giá theo tháng, tiêu chí, xác nhận của nhân viên                                         |
| 7 | Cài đặt hệ thống (Settings)                      | Cấu hình công ty, chính sách lương, tiêu chí đánh giá                                         |
| 8 | Thông báo (Notification)                         | Chuông thông báo, đánh dấu đã đọc                                                             |
| 9 | Lưu trữ (Storage)                                | Tải lên/tải xuống tệp qua URL ký trước                                                        |

### 2.2 Ngoài phạm vi (Out of scope) — chưa làm ở giai đoạn này

- Ứng dụng di động gốc (native mobile app) — hiện chỉ web đáp ứng (responsive).
- Đánh giá hiệu suất theo chu kỳ đầy đủ (KPI/Goals/Appraisal cycle) — hiện ở mức đánh giá theo tháng.
- Tuyển dụng (recruitment / ATS), đào tạo (LMS), e-learning.

---

## 3. Tác nhân & Phân quyền (Actors & RBAC)

Hệ thống áp dụng kiểm soát truy cập theo vai trò (Role-Based Access Control — RBAC), kết hợp **bảo vệ quyền sở hữu** (ownership guard — nhân viên chỉ thao tác trên dữ liệu của chính mình).

| Tác nhân (actor) | Vai trò hệ thống (system role) | Mô tả |
|------------------|--------------------------------|-------|
| Quản trị viên (System Admin) | `admin` | Toàn quyền: quản lý người dùng, vai trò, cấu hình, chi lương |
| Quản lý nhân sự (HR Manager) | `hr_manager` | Quản lý nhân viên, chấm công, lương, đánh giá |
| Quản lý nhóm (Manager) | `manager` | Duyệt đơn nghỉ, đánh giá nhân viên trong phạm vi phụ trách |
| Nhân viên (Employee) | `employee` | Tự xem & cập nhật dữ liệu cá nhân, check-in/out, xin nghỉ |
| Hệ thống (System) | — | Tác vụ nền tự động (gửi email, nhắc hợp đồng, sinh thông báo) |

### Ma trận quyền (permission matrix — theo triển khai thực tế)

| Hành động | Admin | HR | Manager | Employee |
|-----------|:-----:|:--:|:-------:|:--------:|
| Tạo / xóa người dùng (user) | ✅ | ❌ | ❌ | ❌ |
| Quản lý vai trò & quyền (role/permission) | ✅ | ❌ | ❌ | ❌ |
| Quản lý nhân viên (CRUD) | ✅ | ✅ | ❌ | ❌ |
| Cấp tài khoản đăng nhập (grant login) | ✅ | ✅ | ❌ | ❌ |
| Xem hồ sơ bản thân | ✅ | ✅ | ✅ | ✅ |
| Check-in / Check-out | ✅ | ✅ | ✅ | ✅ |
| Quản lý lưới chấm công toàn công ty | ✅ | ✅ | ❌ | ❌ |
| Duyệt / từ chối đơn nghỉ phép | ✅ | ✅ | ✅ | ❌ |
| Tính lương (compute payroll) | ✅ | ✅ | ❌ | ❌ |
| Phê duyệt bảng lương (approve) | ✅ | ✅ | ❌ | ❌ |
| Đánh dấu đã chi lương (mark-paid) | ✅ | ❌ | ❌ | ❌ |
| Đánh giá nhân viên | ✅ | ✅ | ✅ | ❌ |
| Cấu hình hệ thống (settings) | ✅ | 🟡 (đọc) | ❌ | ❌ |

> **Lưu ý triển khai:** Backend dùng middleware `requireRoles('admin', 'hr_manager', ...)` ở từng tuyến (route), kết hợp ownership guard cho các endpoint `/me`. Một số tác vụ nhạy cảm (xóa user, reopen kỳ lương, mark-paid) giới hạn riêng cho `admin`.

---

## 4. Yêu cầu chức năng (Functional Requirements)

Mỗi phân hệ liệt kê yêu cầu dạng "Hệ thống PHẢI…" (the system shall) — đối chiếu trực tiếp với API đã triển khai.

### 4.1 Định danh & Phân quyền (IAM)

- FR-IAM-01: Hệ thống PHẢI cho phép đăng nhập bằng email/tên đăng nhập + mật khẩu, trả về cặp token (access + refresh).
- FR-IAM-02: Hệ thống PHẢI làm mới (refresh) access token và xoay vòng (rotate) refresh token; cho phép đăng xuất thu hồi phiên.
- FR-IAM-03: Hệ thống PHẢI hỗ trợ đổi mật khẩu, đặt mật khẩu lần đầu qua liên kết email (set-password token dùng một lần).
- FR-IAM-04: Hệ thống PHẢI quản lý người dùng, vai trò, quyền (CRUD) và bật/tắt tài khoản.
- FR-IAM-05: Hệ thống PHẢI ghi nhật ký kiểm toán (audit log) các thao tác quản trị quan trọng.

### 4.2 Tổ chức (Organization)

- FR-ORG-01: Hệ thống PHẢI quản lý phòng ban dạng cây (tree) — tạo, sửa, di chuyển (move), gộp (merge), lưu trữ (archive).
- FR-ORG-02: Hệ thống PHẢI cho phép gán trưởng phòng (assign head) và chuyển nhân viên giữa các phòng (transfer).
- FR-ORG-03: Hệ thống PHẢI lưu lịch sử thay đổi phòng ban và quản lý danh mục chức vụ (position).

### 4.3 Nhân viên (Employee)

- FR-EMP-01: Hệ thống PHẢI quản lý hồ sơ nhân viên (CRUD) với mã nhân viên tự sinh, kèm các tài nguyên con: hồ sơ cá nhân (profile), tài liệu (document), liên hệ (contact), tài khoản ngân hàng, hợp đồng (contract), tài sản (asset), hồ sơ thuế (tax profile), lịch sử (history).
- FR-EMP-02: Hệ thống PHẢI cấp tài khoản đăng nhập (grant login) — tạo user, gửi email đặt mật khẩu; hỗ trợ gửi lại lời mời (resend invite) và đặt lại mật khẩu.
- FR-EMP-03: Hệ thống PHẢI hỗ trợ nhập hàng loạt (import) và kết thúc hợp đồng hàng loạt (bulk terminate).
- FR-EMP-04: Hệ thống PHẢI tính % hoàn thiện hồ sơ (completeness) và sinh danh sách nhắc nhở (onboarding chưa xong, hợp đồng sắp hết hạn).
- FR-EMP-05: Nhân viên PHẢI tự xem & cập nhật hồ sơ của mình qua endpoint `/me`.

### 4.4 Chấm công & Nghỉ phép (Attendance & Leave)

- FR-ATT-01: Hệ thống PHẢI quản lý ca làm việc (shift), ngày lễ (holiday), ký hiệu chấm công (attendance symbol).
- FR-ATT-02: Nhân viên PHẢI check-in/check-out hằng ngày và xem bảng công của mình theo tháng.
- FR-ATT-03: HR PHẢI thao tác lưới chấm công toàn công ty: thêm/sửa/xóa từng dòng, cập nhật hàng loạt (bulk upsert), điều chỉnh (adjust).
- FR-ATT-04: Nhân viên PHẢI đăng ký nghỉ phép, xem số dư phép (leave balance), hủy đơn của mình.
- FR-ATT-05: Quản lý/HR PHẢI duyệt, từ chối, thu hồi (revoke) đơn nghỉ; hệ thống tự điều chỉnh số dư phép và bảng công.

### 4.5 Tiền lương (Payroll)

- FR-PAY-01: Hệ thống PHẢI quản lý kỳ lương (payroll period) với vòng đời: `open → processing → closed → paid`.
- FR-PAY-02: Hệ thống PHẢI kiểm tra mức độ sẵn sàng chấm công (attendance readiness) và khóa/mở khóa chấm công trước khi tính.
- FR-PAY-03: Hệ thống PHẢI tính lương (compute) cho toàn kỳ hoặc từng nhân viên; lỗi của một nhân viên KHÔNG được chặn các nhân viên khác.
- FR-PAY-04: Hệ thống PHẢI quản lý phụ cấp (allowance), thưởng (bonus), khấu trừ (deduction), hồ sơ thuế (tax profile) theo nhân viên.
- FR-PAY-05: Hệ thống PHẢI hỗ trợ phê duyệt (approve), hoàn tác (revert), đánh dấu đã chi (mark-paid), tổng hợp (totals), kiểm tra trước (preflight), xuất Excel/PDF, gửi phiếu lương qua email.
- FR-PAY-06: Hệ thống PHẢI cung cấp công cụ tính ngược lương GROSS từ NET (gross-up).
- FR-PAY-07: Nhân viên PHẢI xem được phiếu lương (payslip) của mình.

> Công thức tính lương chi tiết (20/60/20, bảo hiểm, thuế TNCN lũy tiến): xem [PAYROLL-FORMULA.md](PAYROLL-FORMULA.md) và hướng dẫn vận hành [HUONG-DAN-TINH-LUONG.md](HUONG-DAN-TINH-LUONG.md).

### 4.6 Đánh giá hiệu suất (Performance)

- FR-PERF-01: HR/Quản lý PHẢI tạo & chấm đánh giá tháng (điểm hiệu suất + điểm mục tiêu) dựa trên tiêu chí (performance criteria).
- FR-PERF-02: Đánh giá có vòng đời `draft → approved → acknowledged`; chỉ đánh giá `approved` mới được tính vào lương.
- FR-PERF-03: Nhân viên PHẢI xem & xác nhận (acknowledge) đánh giá của mình; HR có thể mở lại (reopen) để sửa.

### 4.7 Cài đặt, Thông báo & Lưu trữ

- FR-SET-01: Admin PHẢI cấu hình thông tin công ty, chính sách lương (salary policy), tiêu chí đánh giá.
- FR-NOTI-01: Hệ thống PHẢI hiển thị thông báo (notification), đếm chưa đọc, đánh dấu đã đọc.
- FR-STO-01: Hệ thống PHẢI cấp URL ký trước (presigned URL) để tải lên/tải xuống tệp an toàn.

---

## 5. Use Cases chính (theo tác nhân)

Ký hiệu: **A** = Admin, **HR** = HR Manager, **M** = Manager, **E** = Employee.

| Mã UC | Tên use case                        | Tác nhân | Tóm tắt luồng                                                                 |
|-------|-------------------------------------|:--------:|-------------------------------------------------------------------------------|
| UC-01 | Đăng nhập hệ thống                  | A/HR/M/E | Nhập email + mật khẩu → nhận token → vào dashboard theo quyền                 |
| UC-02 | Đặt mật khẩu lần đầu                | E        | Mở liên kết email → đặt mật khẩu → kích hoạt tài khoản                        |
| UC-03 | Tạo hồ sơ & cấp tài khoản nhân viên | HR       | Tạo nhân viên → nhập hồ sơ/hợp đồng → grant login → gửi email                 |
| UC-04 | Nhân viên tự cập nhật hồ sơ         | E        | Vào `/me` → sửa thông tin, tải ảnh/tài liệu                                   |
| UC-05 | Chấm công hằng ngày                 | E        | Check-in đầu ngày → check-out cuối ngày → hệ thống tính công                  |
| UC-06 | Điều chỉnh chấm công                | HR       | Mở lưới công → sửa/bổ sung dòng thiếu → lưu                                   |
| UC-07 | Xin nghỉ phép                       | E        | Tạo đơn → hệ thống kiểm tra số dư → gửi duyệt                                 |
| UC-08 | Duyệt đơn nghỉ phép                 | M/HR     | Xem hàng chờ → duyệt/từ chối → trừ số dư + ghi công                           |
| UC-09 | Chạy bảng lương kỳ                  | HR       | Khóa công → tính lương → soát → phê duyệt                                     |
| UC-10 | Chi lương                           | A        | Đánh dấu đã chi → khóa kỳ lương                                               |
| UC-11 | Xem phiếu lương                     | E        | Mở phiếu lương cá nhân → tải PDF                                              |
| UC-12 | Đánh giá nhân viên theo tháng       | M/HR     | Chấm điểm hiệu suất + mục tiêu → duyệt                                        |
| UC-13 | Xác nhận đánh giá                   | E        | Xem kết quả → acknowledge                                                     |
| UC-14 | Quản lý phòng ban                   | HR       | Tạo/di chuyển/gộp phòng → gán trưởng phòng                                    |
| UC-15 | Cấu hình chính sách lương           | A        | Tạo/sửa chính sách (bảo hiểm, giảm trừ, TNCN, trọng số 20/60/20)              |
| UC-16 | Nghỉ việc (offboarding)             | HR/A     | Kết thúc hợp đồng → thu hồi tài sản → vô hiệu hóa tài khoản                   |

---

## 6. Luồng nghiệp vụ trọng yếu (Key Workflows)

### 6.1 Tiếp nhận nhân viên (Onboarding)

```
HR tạo nhân viên (employee)
   └─▶ nhập hồ sơ (profile) + hợp đồng (contract active) + tài liệu
        └─▶ Grant login → tạo user + sinh set-password token → gửi email
             └─▶ Nhân viên đặt mật khẩu → trạng thái: onboarding → active
                  └─▶ Cấp tài sản (asset), gán phòng ban/chức vụ
```

### 6.2 Chấm công → Nghỉ phép

```
Nhân viên check-in / check-out  ──▶  attendance (đối chiếu shift + holiday)
Nhân viên tạo đơn nghỉ (leave request, status=pending)
   └─▶ kiểm tra số dư phép (leave balance)
        └─▶ Quản lý/HR duyệt (approved) / từ chối (rejected)
             └─▶ trừ số dư + ghi nhận vào bảng công (nghỉ có phép)
```

### 6.3 Chốt & Tính lương (vòng đời kỳ lương)

```
[open] ──khóa chấm công──▶ [open + locked] ──tính lương──▶ payroll(draft)
   └─▶ soát số (totals / preflight / export)
        └─▶ phê duyệt (approve) ──▶ payroll(approved), kỳ → [processing]
             └─▶ Admin đánh dấu đã chi (mark-paid) ──▶ payroll(paid), kỳ → [paid]

• Cần sửa: revert (approved → draft) → tính lại
• Điều kiện bắt buộc: phải khóa chấm công + có chính sách lương hiệu lực
  + đánh giá tháng đã duyệt (với nhân viên official/probation)
```

### 6.4 Đánh giá hiệu suất theo tháng

```
HR/Quản lý tạo đánh giá (draft) theo tiêu chí (criteria)
   └─▶ chấm điểm hiệu suất + mục tiêu → duyệt (approved) → tính vào lương 20/60/20
        └─▶ Nhân viên xác nhận (acknowledged)
             └─▶ (nếu cần) HR mở lại (reopen) → sửa → duyệt lại
```

### 6.5 Nghỉ việc (Offboarding)

```
HR/Admin kết thúc hợp đồng (terminate, đơn lẻ hoặc hàng loạt)
   └─▶ ghi lịch sử (employee history) + đặt trạng thái: terminated
        └─▶ thu hồi tài sản (asset return)
             └─▶ vô hiệu hóa tài khoản (disable user) + thu hồi phiên (revoke sessions)
                  └─▶ tính lương kỳ cuối nếu còn
```

---

## 7. Mô hình trạng thái (State Models)

| Thực thể (entity) | Các trạng thái (states) | Trạng thái cuối (terminal) |
|-------------------|--------------------------|----------------------------|
| Kỳ lương (payroll period) | `open → processing → closed → paid` | `paid` |
| Bảng lương (payroll) | `draft → approved → paid` | `paid` |
| Nhân viên (employee) | `onboarding → active → on_leave → terminated` | `terminated` |
| Đơn nghỉ (leave request) | `pending → approved / rejected / cancelled` | `rejected`, `cancelled` |
| Đánh giá (evaluation) | `draft → approved → acknowledged` | `acknowledged` |

---

## 8. Yêu cầu phi chức năng (Non-Functional Requirements)

| Loại | Yêu cầu |
|------|---------|
| Bảo mật (security) | Xác thực JWT có hạn ngắn + refresh xoay vòng; mật khẩu băm bcrypt; phân quyền RBAC + ownership guard; nhật ký kiểm toán. |
| Toàn vẹn dữ liệu (data integrity) | Giao dịch MongoDB (transaction) cho các thao tác đa bảng; xóa nhân viên có dọn dẹp dữ liệu liên quan (cascade). |
| Khả dụng (usability) | Web đáp ứng (responsive); self-service cho nhân viên; thông báo trong ứng dụng. |
| Hiệu năng (performance) | Phân trang (pagination) + tìm kiếm/lọc cho các danh sách lớn. |
| Kiểm chứng (validation) | Kiểm tra đầu vào bằng Zod ở backend; envelope chuẩn `{success, data, error}`. |
| Quan sát (observability) | Ghi log có cấu trúc bằng Pino. |
| Mở rộng (extensibility) | Kiến trúc theo phân hệ (feature-based) để thêm module độc lập. |

---

## 9. Giả định & Ràng buộc (Assumptions & Constraints)

- Một nhân viên thuộc **một** phòng ban tại một thời điểm.
- Chấm công nhập **thủ công** (check-in/out trong ứng dụng), chưa tích hợp máy chấm công.
- Lương trả theo **tháng**, dựa trên ngày công chuẩn của kỳ.
- Mỗi nhân viên cần **một hợp đồng `active`** để tính lương.
- Cần **một chính sách lương hiệu lực** trước ngày trả của kỳ.
- Thuế TNCN (PIT) có thể **bật/tắt** theo cấu hình; khi tắt, thuế = 0.

---

## 10. Khoảng trống & Hướng phát triển (Gaps & Roadmap)

| Hạng mục | Hiện trạng | Đề xuất |
|----------|-----------|---------|
| Vai trò `manager` | Quyền giới hạn (duyệt nghỉ, đánh giá) | Mở rộng phạm vi xem công/lương theo nhóm phụ trách |
| Đánh giá hiệu suất | Mức đánh giá theo tháng | Bổ sung KPI/Goals/chu kỳ đánh giá (appraisal cycle) |
| Cấu hình thuế/bảo hiểm | Gộp trong chính sách lương | Tách cấu hình theo vùng & thời điểm |
| Báo cáo tổng hợp | Có xuất Excel/PDF | Bổ sung báo cáo phân tích (analytics dashboard) |
| Ứng dụng di động | Web responsive | Cân nhắc native app theo nhu cầu |

---

## 11. Tham chiếu (References)

- **Đặc tả khảo sát gốc:** `Soosky HRM.pdf` (bộ câu hỏi Q1–Q43, ma trận quyền, công thức lương, biểu thuế).
- **API:** [API-SPEC.md](API-SPEC.md) — danh mục endpoint, envelope `{success, data, error}`.
- **Cơ sở dữ liệu:** [DATABASE.md](DATABASE.md) — collections, quan hệ, index, transaction.
- **Tính lương:** [PAYROLL-FORMULA.md](PAYROLL-FORMULA.md) (công thức) · [HUONG-DAN-TINH-LUONG.md](HUONG-DAN-TINH-LUONG.md) (hướng dẫn vận hành).

---

## Phụ lục — Thuật ngữ (Glossary)

| Thuật ngữ tiếng Việt | Thuật ngữ gốc (English) | Ý nghĩa |
|----------------------|--------------------------|---------|
| Yêu cầu chức năng | Functional Requirement (FR) | Điều hệ thống phải làm được |
| Tình huống sử dụng | Use Case (UC) | Một kịch bản tác nhân dùng hệ thống |
| Luồng nghiệp vụ | Workflow | Chuỗi bước xử lý một quy trình |
| Phân quyền theo vai trò | RBAC | Kiểm soát truy cập dựa trên vai trò |
| Bảo vệ quyền sở hữu | Ownership Guard | Chỉ thao tác dữ liệu của chính mình |
| Kỳ lương | Payroll Period | Khoảng thời gian tính một đợt lương |
| Bảng lương | Payroll | Kết quả tính lương cho 1 nhân viên/kỳ |
| Phụ cấp / Thưởng / Khấu trừ | Allowance / Bonus / Deduction | Các khoản cộng/trừ vào lương |
| Hồ sơ thuế | Tax Profile | Thông tin tính thuế TNCN của nhân viên |
| Số dư phép | Leave Balance | Số ngày nghỉ còn lại |
| Nhật ký kiểm toán | Audit Log | Lịch sử thao tác quản trị |
| URL ký trước | Presigned URL | Liên kết tạm để upload/download tệp |
