# Kế hoạch triển khai: Soosky HRM v1 API alignment

**Ngày lập:** 2026-07-30  
**Người lập:** Codex AI (plan-builder skill)  
**Version:** 1.1

**Cập nhật 2026-08-06:** bốn lát 0–3 đã hoàn thành; Performance ĐÃ có backend + frontend +
snapshot điểm sang Payroll, nên không còn là "UI chưa có backend" như bản 1.0 giả định.

## Trạng thái hiện tại (2026-08-06)

| Lát | Trạng thái | Bằng chứng |
| --- | --- | --- |
| 0. Runtime truth | Xong | `.env.example` dùng `HTTP_*`/`MONGODB_*`/`AUTH_*`; Mongo replica set bắt buộc cho transaction |
| 1. Identity & master data | Xong | service Auth/IAM/Department/Employee gọi đúng prefix `/api/v1/<module>`; `hr-onboarding-rbac.test.ts` |
| 2. Attendance | Xong | HR nhập công qua `AttendanceDayWriter`, chỉnh công + nghỉ phép có luồng duyệt; `attendance-correction-lock.test.ts` |
| 3. Payroll & setting | Xong | quy trình 7 bước, bốn mắt, đoạn hợp đồng, hồi tố, đối soát v1/v2, file ngân hàng cấu hình được |
| 4. Performance (ngoài plan 1.0) | Xong | module backend + UI + snapshot điểm sang Payroll; `performance-to-payroll.test.ts` |

Phạm vi đã mở rộng thành **bảy** module. Việc còn lại nằm ở các phase P0–P6 do chủ dự án giao,
không còn thuộc bốn lát trong tài liệu này.

## Tóm tắt dự án (bản 1.0, giữ để đối chiếu lịch sử)

- Mục tiêu: chạy được end-to-end sáu module hiện hữu (Auth/IAM, Department, Employee, Attendance, Payroll, Setting) với frontend gọi đúng backend; có smoke tests cho luồng lõi.
- Thời gian: đề xuất 4 lát tuần tự, mỗi lát chỉ merge khi đạt acceptance test.
- Nhân sự: Claude Code thực hiện từng lát; Codex review contract, diff và verification sau từng lát.
- Ngân sách: chưa cung cấp; áp dụng giới hạn phạm vi/token bên dưới.
- Loại dự án: phần mềm, refactor tích hợp có kiểm chứng.

## 1. Hướng tiếp cận đề xuất

**Lựa chọn:** Pilot → scale theo lát dọc (vertical slice).

Lý do: backend đã có kiến trúc và nhiều use case; rủi ro lớn nhất là contract và wiring frontend, không phải thiếu thêm layer. Làm một luồng chạy được trước giúp Claude nhận phản hồi nhanh và không sinh code dư.

**Nguyên tắc giao Claude:** một prompt = một lát; chỉ sửa file cần thiết; cấm tạo framework, abstraction, endpoint hoặc module mới nếu không có acceptance criterion. Claude phải dừng sau lát, báo file đã đổi + lệnh đã chạy + lỗi còn lại.

## 2. Các giai đoạn chính

| Giai đoạn | Mục tiêu | Đầu ra | Người chịu trách nhiệm |
| --- | --- | --- | --- |
| 0. Runtime truth | Chạy đúng config local và thống nhất contract | `.env` theo tên biến hiện tại, checklist runtime | Claude → Codex review |
| 1. Identity & master data | Login/IAM/Department/Employee đi xuyên UI → API → Mongo | Services khớp prefix và một smoke flow | Claude → Codex review |
| 2. Attendance | Shift, attendance, leave có dữ liệu cho payroll | Smoke attendance + leave approved | Claude → Codex review |
| 3. Payroll & setting | Chạy lương v1 và cấu hình | Smoke payroll lifecycle + setting upsert | Claude → Codex review |
| 4. Performance (bổ sung sau 1.0) | Chu kỳ đánh giá, tiêu chí có phiên bản, snapshot điểm sang Payroll | Module backend + UI + integration test | Claude → Codex review |

## 3. Phân chia công việc chi tiết

### Lát 0: Runtime truth

**Prompt giao Claude:** “Chỉ kiểm tra và sửa runtime configuration cho backend HRM. Đọc `share-docs/API-SPEC.md`, `backend/src/infra/config.ts`, `.env.example`. Đồng bộ `.env.example` và hướng dẫn chạy với các biến code thực sự đọc (`HTTP_*`, `MONGODB_*`, `AUTH_*`). Không chép secret, không đổi business code, không cài dependency mới. Chạy typecheck/build nếu runtime có Node; nếu không, báo đúng blocker.”

Acceptance: không có variable legacy trong tài liệu chạy; local Mongo replica set requirement được ghi rõ; không commit secret.

### Lát 1: Identity & master data

**Prompt giao Claude:** “Chỉ đồng bộ frontend service/API types cho Auth, IAM, Department, Employee với router hiện tại. Đọc router, controller, presenter của bốn module trước khi sửa. Thay endpoint/payload cũ bằng contract `share-docs/API-SPEC.md`; bỏ mock fallback trên đường gọi đã sửa. Không đổi component UI, domain, Mongo schema hay tạo endpoint. Thêm tối đa một smoke/integration test cho chuỗi login → department/position → employee + contract.”

Acceptance: không còn route tắt `/employees`, `/departments`, `/users` trong bốn service đã chạm; test xác nhận request đúng prefix và response presenter.

### Lát 2: Attendance

**Prompt giao Claude:** “Chỉ đồng bộ Attendance frontend với `/attendance/*` hiện hữu. Dùng route/controller/presenter backend làm chuẩn. Chọn đúng các capability đã tồn tại: shift, holiday, symbol, records, leave request, leave balance. Không tạo check-in/out, bulk import hoặc `/admin/*` backend mới. Thêm smoke test cho record và submit→approve leave; xác nhận workday summary thay đổi theo quy tắc hiện có.”

Acceptance: UI không gọi `/admin/attendances`, `/attendances/me` hoặc `/leave-requests/me` nếu backend không có route đó; payroll readiness đọc được dữ liệu setup.

### Lát 4: Performance (thêm sau bản 1.0)

Đã triển khai: chu kỳ đánh giá gắn `payrollPeriodId`, bộ tiêu chí có phiên bản BẤT BIẾN
(`publishVersion`), phiếu theo luồng chấm → HR duyệt → nhân viên xác nhận/khiếu nại → khoá điểm.

Bất biến phải giữ:

- Điểm sang Payroll CHỈ một chiều, CHỈ lúc khoá phiếu, qua `PayrollEvaluationSink.snapshotEvaluation`.
  Payroll lưu bản chụp trong `PayrollPeriod.evaluations` và KHÔNG đọc lại phiếu khi tính lương.
- Phiếu giữ `criteriaSetId` + `criteriaVersion` của riêng nó; sửa tiêu chí = phát hành bản mới,
  không đổi lịch sử đánh giá và không đổi lương đã tính.
- `EvaluationDirectory` (Payroll → Performance) chỉ trả TIẾN ĐỘ, không trả điểm.

### Lát 3: Payroll & setting

**Prompt giao Claude:** “Chỉ đồng bộ Payroll/Setting theo router hiện tại và `API-SPEC.md`. Giữ phạm vi Payroll v1: ratios performance/goal = 100, evaluation lock là manual gate; (bản 1.0 yêu cầu ẩn UI Performance — ĐÃ LỖI THỜI, xem “Lát 4: Performance”). Thêm smoke test cho policy + period → attendance readiness/lock → evaluation lock → run → approve → mark paid, và company/system upsert.”

Acceptance: không frontend call `/performance/*` trong production route; không gửi `requireApprovedEvaluation` như điều kiện nghiệp vụ; locked/approved/paid không bị tính lại.

## 4. Dự trù rủi ro và kế hoạch dự phòng

| Rủi ro | Khả năng | Ảnh hưởng | Giảm thiểu | Dự phòng |
| --- | --- | --- | --- | --- |
| Không có Node/pnpm trên máy chạy | Cao | Cao | Kiểm tra ở lát 0 | Cài Node LTS + package manager theo quyết định repo, rồi chạy lại toàn bộ gate |
| `.env` legacy/secret thật | Cao | Cao | Chỉ dùng `.env.example`, secret manager | Rotate credential đã lộ và thu hồi `.env` khỏi chia sẻ |
| Frontend mock/API cũ vượt backend | Cao | Cao | So từng service với router/presenter | Ẩn capability chưa có, không “giả API” |
| ~~Performance chưa có backend~~ (đã xử lý: module Performance có backend + UI + snapshot sang Payroll) | — | — | — | — |
| Transaction không chạy với Mongo standalone | Trung bình | Cao | Smoke trên replica set | Dùng replica set local/container trước khi debug code |

## 5. KPI theo từng giai đoạn

| Giai đoạn | KPI | Cách đo | Ngưỡng thành công |
| --- | --- | --- | --- |
| 0 | Config correctness | Review tên biến + startup | 0 biến legacy trong hướng dẫn |
| 1 | Contract match | Smoke request log/test | 4/4 module dùng prefix chuẩn |
| 2 | Attendance-to-payroll readiness | Smoke data + readiness API | 1 employee hợp lệ có readiness xác định |
| 3 | Payroll lifecycle | Integration smoke | 1 payslip đi draft → approved → paid |

KPI tổng thể: backend build/typecheck sạch, smoke suite pass, và không còn frontend production call tới endpoint chưa mount.

## 6. Lịch review và điểm kiểm tra

| Thời điểm | Loại review | Đầu ra |
| --- | --- | --- |
| Trước mỗi lát | Contract review | File scope + acceptance criterion được chốt |
| Sau mỗi lát | Codex review | Diff, router/presenter match, test evidence, vấn đề còn lại |
| Sau lát 3 | End-to-end review | Báo cáo đạt/chưa đạt |
| Sau lát 4 | Performance review | Snapshot điểm sang Payroll có test; bất biến criteria version được giữ |

Mỗi lần Claude hoàn tất một lát, gửi đúng bốn mục: “đã làm”, “file đổi”, “lệnh/test”, “blocker”. Codex không review một diff gộp nhiều lát.

## 7. Checklist xác nhận sẵn sàng

- [ ] Node LTS và package manager được cài trên máy chạy.
- [ ] Chọn duy nhất pnpm hoặc npm lockfile; không trộn cả hai trong một thay đổi.
- [ ] `.env` local dùng tên biến khớp `backend/src/infra/config.ts` và không được commit.
- [ ] MongoDB replica set sẵn sàng cho các flow transaction.
- [ ] Mỗi service frontend đã đối chiếu router + controller + presenter.
- [x] Performance có backend riêng và chỉ nối vào Payroll qua snapshot điểm đã khoá.
- [ ] Typecheck/build và smoke tests có bằng chứng chạy.
- [ ] Codex đã review từng lát trước khi Claude nhận lát tiếp theo.

## Related Notes

- [[API-SPEC]]
- [[DATABASE]]
