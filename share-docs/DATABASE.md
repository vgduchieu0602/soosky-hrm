# Soosky HRM database contract — v1

## Context

MongoDB được truy cập qua native MongoDB driver. `ensureMongoIndexes()` là nơi duy nhất tạo index, và được gọi trước khi server/CLI lắp DI.

## Problem

ER diagram lịch sử có nhiều ghi chú “chờ port” và mô tả không còn khớp code. Nếu frontend hay script seed dựa vào diagram cũ, dữ liệu sẽ lệch với repository thật. Code hiện có bảy module, gồm cả Performance.

## Key Learning

Mongo collection không thay thế quan hệ nghiệp vụ: mọi id liên module phải được kiểm tra qua port/use case, còn index chỉ bảo vệ uniqueness và truy vấn.

## Decision

Các collection đang được khởi tạo bởi code:

| Boundary | Collections | Quan hệ / invariant cần giữ |
| --- | --- | --- |
| Auth | accounts, refresh tokens, verification tokens | Account là danh tính đăng nhập; secret/token không được trả qua presenter. |
| IAM | users, roles, permissions, user roles, role permissions, audit logs | `seedIam()` idempotent tạo permission catalogue và system admin role. |
| Department | departments, positions | `department.code` và `position.code` unique; parent department không được tạo vòng. |
| Employee | employees, profiles, contacts, bank accounts, documents, contracts, assets, histories | Employee không hard-delete; contract hợp lệ là đầu vào bắt buộc cho payroll. |
| Attendance | shifts, holidays, attendance symbols, attendance records, leave requests, leave balances | Leave balance unique theo employee/leave type/year; attendance phải truy được workday summary theo kỳ. |
| Payroll | payroll periods, payslips, allowances, bonuses, deductions, tax profiles, salary policies, retro adjustments, variances | Payroll period điều khiển lock/state; payslip là snapshot, không tái tính sau approved/paid. `pay_retro_adjustments` luôn tham chiếu KỲ GỐC bị sai và kỳ chi trả — không dùng để thay thưởng/khấu trừ trong cùng kỳ. |
| Performance | appraisal criteria sets (có phiên bản), appraisal cycles, appraisal reviews | Bộ tiêu chí BẤT BIẾN sau khi phát hành; phiếu giữ `criteriaSetId` + `criteriaVersion` của riêng nó; điểm sang Payroll chỉ qua snapshot lúc khoá. |
| Setting | company profiles, system settings, bank transfer profiles | Company/system là singleton/upsert. `set_bank_profiles`: mã hồ sơ unique, đúng MỘT hồ sơ `isActive` — Payroll sinh file chuyển khoản theo hồ sơ đang bật. |

Tên collection vật lý, document shape và index chính xác phải lấy từ `ensureMongoIndexes.ts` cùng `documents/` và `repositories/` của module tương ứng. Không dùng schema Mongoose vì dự án không dùng Mongoose.

### Chuỗi dữ liệu chạy lương v1

`department/position` → `employee` → `employee contract` → `attendance record + approved leave` → `payroll period + policy + compensation/tax profile` → `payslip`.

Điều kiện trước khi tạo payslip:

- Employee đang active và có contract basis hợp lệ tại kỳ.
- Payroll period đang mở, attendance đã lock và salary policy có hiệu lực.
- Payslip approved/paid không được recompute.
- Evaluation lock là cổng workflow. Payroll KHÔNG join sang collection của Performance: điểm đi vào Payroll bằng bản chụp ghi trong `PayrollPeriod.evaluations` lúc khoá phiếu đánh giá.
- Payslip lưu `inputs` (bản chụp id chính sách/thuế/phụ cấp/thưởng/khấu trừ/hợp đồng/hồi tố + `engineVersion` + `recomputeCount`) và `segments` (dòng theo đoạn hợp đồng khi đổi hợp đồng giữa kỳ).
- `pay_variances`: một bản ghi duy nhất mỗi (kỳ, nhân viên) — chênh lệch giữa hai phiên bản công thức kèm chữ ký + lời giải thích. Chữ ký gắn với đúng con số: số đổi thì chữ ký bị xoá.
- Sửa sai kỳ ĐÃ CHỐT không mở lại kỳ: tạo `retro adjustment` (`claim`/`clawback`) trả ở một kỳ đang mở. Huỷ = đánh dấu `cancelled` kèm người huỷ + lý do, không hard-delete.

### Migration và vận hành

- Không đổi key/index hoặc hard-delete collection trong một feature task.
- Thay đổi document phải cập nhật mapper, repository, `ensureMongoIndexes`, API presenter và test liên quan trong cùng lát.
- Transaction của Auth/Payroll yêu cầu MongoDB replica set; local smoke environment phải dùng replica set, không dùng Mongo standalone nếu test transaction.

## Action Items

- Viết seed dữ liệu smoke tối thiểu qua API/CLI, không insert tay vượt business rule.
- Thêm test index/uniqueness cho các invariant cross-request quan trọng.
- Performance có collection + index riêng (tiền tố `perf_`); điểm KHÔNG được nhét vào payslip đã duyệt, chỉ vào bản chụp của kỳ lương lúc khoá phiếu.

## Related Notes

- [[API-SPEC]]
- [[CLAUDE-EXECUTION-PLAN]]
