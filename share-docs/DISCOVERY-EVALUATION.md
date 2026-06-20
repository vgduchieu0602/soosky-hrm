# Discovery Plan: Hoàn thiện tính năng Đánh giá hiệu suất (Multi-rater)

**Date:** 2026-06-19
**Product Stage:** Existing product (continuous discovery)
**Discovery Question:** Nâng cấp đánh giá từ "1 người HR nhập điểm" thành quy trình **Self → Manager → HR chốt → NV xác nhận** — phần nào phải build, rủi ro nào phải gỡ trước khi cam kết?

> Liên quan: đánh giá là nguồn cấp `performanceRatio` (60%) + `goalRatio` (20%) cho [DISCOVERY-PAYROLL.md](./DISCOVERY-PAYROLL.md). Nối tiếp rủi ro A4 (evaluation đúng hạn) trong [DISCOVERY-HRM-BOD-HRM.md](./DISCOVERY-HRM-BOD-HRM.md).

---

## Hiện trạng codebase (đã khảo sát)

**Đã có:**
- `shared/models/monthly-evaluation.model.ts` — `criteriaScores[{criterionId,score}]`, `performanceRatio`, `goalResult`, `goalRatio`, `evaluatedBy` (1 người), `status: draft|submitted|approved`, unique `{employeeId, payrollPeriodId}`.
- `shared/models/performance-criterion.model.ts` — criteria có `weight`, CRUD qua `settings` (chạy được) + UI `SalaryPerformanceSettings.tsx`.
- Payroll đọc `evaluation.performanceRatio/goalRatio`; chặn run nếu chưa `approved` (`PAY_EVAL_REQUIRED`).

**Còn thiếu (đây là vấn đề lớn):**
- **`features/performance/` rỗng hoàn toàn** — không có controller/service/route/dto.
- **Chưa có code tính `performanceRatio`** từ `criteriaScores × weight` → payroll hiện nhận `performanceRatio = 0` cho mọi người (80% lương sai).
- Frontend `PerformancePage.tsx` + `performance-data.ts` là **mock** (chưa wire API).
- Model **chỉ single-rater** — không tách self-score / manager-score / final-score, không có người chấm theo vai trò, không có acknowledgement.

---

## Selected Ideas for Validation (MVP)

Quy trình mục tiêu: **Self → Manager → HR chốt (sửa được) → NV xác nhận**.

| # | Ý tưởng | Vì sao trong MVP |
|---|---------|------------------|
| 1 | Evaluation Engine + CRUD | Nền tảng — build thật feature rỗng |
| 9 | Tự động hóa weighted `performanceRatio` + validate | Sửa lỗi 80% lương = 0; tính từ `criteriaScores × weight` |
| 5 | Self-review + Manager review (multi-rater) | Lõi yêu cầu: NV tự chấm → quản lý chấm |
| (HR) | HR chốt & hiệu chỉnh điểm cuối | HR có quyền sửa final score, có audit |
| 7 | Employee acknowledgement | NV xem & xác nhận kết quả |
| 6 | Form chấm điểm trực quan (wire FE thật) | Thay mock bằng dữ liệu thật |

**Để pha sau:** #2 Goal/KPI có gốc, #3 appraisal cycle tách rời payroll, #4 calibration/phân phối, #8 continuous feedback, #10 analytics.

---

## Mô hình dữ liệu đề xuất (cần quyết khi build)

Mở rộng `MonthlyEvaluation` cho multi-rater (3 lớp điểm + ack):
- `selfScores[]`, `selfSubmittedAt` — NV tự chấm.
- `managerScores[]`, `managerId`, `managerSubmittedAt` — quản lý chấm.
- `finalScores[]` (HR chốt, mặc định = managerScores, HR sửa được) → **dùng để tính `performanceRatio`**.
- `status`: `self_pending → manager_pending → hr_review → approved → acknowledged`.
- `acknowledgedAt`, `acknowledgedBy`, `disputeNote?` — NV xác nhận hoặc phản hồi.
- Giữ `performanceRatio` = weighted avg của **finalScores** (không phải self/manager).

---

## Critical Assumptions

| # | Assumption | Idea | Category | Impact | Uncertainty | Priority |
|---|-----------|------|----------|--------|-------------|----------|
| A1 | `performanceRatio` weighted từ `criteriaScores × weight` **khớp** kỳ vọng & số liệu mock/Excel | 9 | Feasibility | Cao | TB | 🟠 2 |
| A2 | Quy trình 3 lớp (self/manager/final) **map gọn** vào 1 `MonthlyEvaluation` mở rộng, không phá payroll đang đọc `performanceRatio` | 1/5 | Feasibility | Cao | Cao | 🔴 1 (leap) |
| A3 | **Manager chịu chấm đúng hạn** trước kỳ lương (nếu trễ → payroll fail hàng loạt) | 5 | Value | Cao | Cao | 🔴 3 (leap) |
| A4 | `employee.managerId` **đủ phủ & đúng** để định tuyến manager review | 5 | Feasibility | Cao | TB | 🟠 4 |
| A5 | Self-review **tạo giá trị** (NV chấm thật, không chỉ tự thổi điểm) thay vì chỉ thêm việc | 5 | Value | TB | Cao | 🔴 5 (leap) |
| A6 | NV **thật sự đọc & xác nhận** kết quả (ack không phải bấm mù) | 7 | Value | TB | Cao | 🟠 6 |
| A7 | HR có quyền **sửa final score rõ ràng** + audit, không gây tranh cãi "ai chốt" | HR | Usability | TB | TB | 🟡 7 |
| A8 | Toàn bộ chu trình self→manager→HR→ack **kịp** trước payday | 1 | Feasibility | Cao | Cao | 🔴 8 (leap) |

**Leap-of-faith:** A2 (mô hình dữ liệu), A3 + A8 (manager/chu trình kịp hạn), A5 (self-review có giá trị).

---

## Validation Experiments

| # | Tests | Method | Success Criteria | Effort | Timeline |
|---|-------|--------|------------------|--------|----------|
| E1 | A2, A1 | **Schema spike + parallel run**: thiết kế schema multi-rater, viết `computePerformanceRatio(finalScores, weights)`, tính lại ratio 1 kỳ từ điểm mock → so PerformancePage | Ratio khớp & payroll vẫn đọc đúng `performanceRatio`; <0.5% lệch | M | Tuần 1 |
| E2 | A4 | **Data audit `managerId`**: % NV có manager hợp lệ + spot-check 20 NV | ≥95% phủ; xác định NV không có manager | S | Tuần 1 |
| E3 | A3, A8 | **Prototype manager review** (clickable) cho 3 manager chấm team + đo thời gian/tỉ lệ hoàn tất 1 vòng | ≥2/3 manager hoàn tất đúng hạn không cần HR nhắc | M | Tuần 2 |
| E4 | A5 | **Self-review pilot**: 8–10 NV tự chấm, so khoảng cách self vs manager | Khoảng cách hợp lý (không phải 100% NV tự cho điểm tối đa); HR thấy hữu ích | M | Tuần 2 |
| E5 | A6, A7 | **Concierge acknowledgement**: gửi 5 NV kết quả final, yêu cầu xác nhận/phản hồi | ≥4/5 đọc & xác nhận; ghi nhận có dispute không | S | Tuần 3 |

### Experiment Details
- **E1 (quan trọng nhất):** gỡ leap A2 — chứng minh schema mở rộng vẫn cho payroll đọc `performanceRatio` đúng. Tách `computePerformanceRatio` thành pure fn (giống `salary.util`) để unit-test. Kill nếu phá tích hợp payroll.
- **E2:** read-only, gần free — chạy ngay.
- **E3:** validate hành vi manager (rủi ro vận hành lớn nhất — nếu manager không chấm, payroll fail).
- **E4:** validate self-review có tín hiệu thật hay chỉ thêm overhead.
- **E5:** validate ack & quyền HR trước khi build UI ký nhận.

---

## Discovery Timeline
- **Tuần 1:** E1 (schema + ratio engine) + E2 (audit managerId).
- **Tuần 2:** E3 (prototype manager) + E4 (self-review pilot).
- **Tuần 3:** E5 (acknowledgement) + tổng hợp & quyết định.

## Decision Framework
- **E1 đạt** → build Evaluation Engine multi-rater thật. **Fail** → sửa schema/giữ single-rater + chỉ tự tính ratio trước.
- **E2 fail** → bổ sung `managerId` / fallback định tuyến HR trước khi mở manager review.
- **E3 fail** → giữ HR nhập tập trung, manager review là tùy chọn; tránh chặn payroll vì manager trễ.
- **E4 fail** → bỏ self-review, chỉ Manager → HR (đơn giản hơn).
- **E5 fail** → ack là tùy chọn, không chặn quy trình.

## Thứ tự build đề xuất (theo phụ thuộc)
1. **`computePerformanceRatio` (pure) + tự tính ratio** (sửa lỗi 80% lương = 0) — gần như độc lập, làm trước.
2. **Evaluation CRUD + workflow single-rater** trên feature `performance/` rỗng.
3. **Mở rộng multi-rater** (self/manager/final + định tuyến theo `managerId`).
4. **Acknowledgement + HR override + audit**.
5. **Wire PerformancePage** thật (bỏ mock) + form self/manager.
6. *(Pha sau)* Goal/KPI có gốc · appraisal cycle tách rời · calibration · analytics.
