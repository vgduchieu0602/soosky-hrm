# Discovery Plan: Nâng Đánh giá lên chuẩn doanh nghiệp (Trang NV xem + Nhận xét)

**Date:** 2026-06-19
**Product Stage:** Existing product (continuous discovery)
**Discovery Question:** Với mô hình "HR/Trưởng phòng chấm — nhân viên xem", cần bổ sung gì để đánh giá đạt chuẩn DN mà không đụng chu kỳ tháng & lương 20/60/20?

> Nối tiếp [DISCOVERY-EVALUATION.md](./DISCOVERY-EVALUATION.md). Quyết định: **giữ chu kỳ tháng**; bỏ self-review (đánh giá khởi tạo thẳng ở `manager_review`).

---

## Hiện trạng

- Workflow: `manager_review → hr_review → approved → acknowledged` (NV xem/xác nhận, không tự chấm).
- Điểm theo tiêu chí có trọng số → `performanceRatio` (60%) + `goalRatio` (20%) nuôi lương.
- UI: PerformancePage (HR/QL) chấm & chốt; MyEvaluationsPage (NV) hiện chỉ list + nút xác nhận.

**Thiếu so với chuẩn DN:** không có **nhận xét định tính** (điểm mạnh/cần cải thiện), **kế hoạch phát triển** (IDP/PIP), và **trang NV xem chi tiết** (bóc tách điểm + lịch sử nhiều kỳ).

---

## Selected Ideas (đã chốt)

| # | Ý tưởng | Mô tả |
|---|---------|-------|
| 6 | **Trang NV xem kết quả (read-only)** | NV xem điểm từng tiêu chí, ratio, xếp hạng, nhận xét, lịch sử nhiều kỳ |
| 7 | **Nhận xét định tính + kế hoạch phát triển** | QL/HR nhập `strengths` / `improvements` / `developmentPlan`; cân nhắc bắt buộc khi chốt |

Để pha sau: rubric 1–5 (#1), KPI/OKR (#2), chu kỳ quý/năm (#3), xếp loại tổng (#4), competency groups (#5), calibration (#8), trend (#9), 360° (#10).

---

## Mô hình dữ liệu bổ sung (MonthlyEvaluation)
- `strengths`: String — điểm mạnh.
- `improvements`: String — điểm cần cải thiện.
- `developmentPlan`: String — kế hoạch phát triển (IDP/PIP).
- (đã có `note`, `criteriaScores`, `performanceRatio`, `goalRatio`, `managerNote`.)

Không đụng trường payroll đọc (`performanceRatio`/`goalRatio`).

---

## Critical Assumptions

| # | Assumption | Category | Impact | Uncertainty | Priority |
|---|-----------|----------|--------|-------------|----------|
| A1 | QL/HR **chịu viết nhận xét có chất lượng** (không bỏ trống/copy) → giá trị cốt lõi của #7 | Value | Cao | Cao | 🔴 1 (leap) |
| A2 | NV **thật sự đọc** trang xem chi tiết & thấy minh bạch hơn | Value | TB | Cao | 🟠 2 |
| A3 | Thêm 3 trường nhận xét **không phá** payroll/workflow hiện tại | Feasibility | Cao | Thấp | 🟡 3 |
| A4 | Bắt buộc nhận xét **không làm QL trễ** chốt đánh giá (ảnh hưởng lương đúng hạn) | Usability | TB | TB | 🟠 4 |
| A5 | Trang xem read-only **dễ hiểu** không cần đào tạo | Usability | TB | Thấp | 🟡 5 |

**Leap:** A1 — nếu nhận xét bị bỏ trống/hời hợt thì tính năng vô giá trị.

---

## Validation Experiments

| # | Tests | Method | Success Criteria | Effort | Timeline |
|---|-------|--------|------------------|--------|----------|
| E1 | A3 | **Spike**: thêm 3 trường + form nhập + payroll test vẫn xanh | Build xong, E2E payroll pass | S | Tuần 1 |
| E2 | A1, A4 | **Pilot QL**: 5 đánh giá thật có nhận xét; đo độ dài/chất lượng + thời gian chốt | ≥4/5 có nhận xét thực chất; thời gian chốt chấp nhận được | M | Tuần 2 |
| E3 | A2, A5 | **Concierge NV**: 5 NV xem trang kết quả, phỏng vấn ngắn | ≥4/5 đọc & hiểu, thấy minh bạch hơn | S | Tuần 2 |

### Decision Framework
- **E1 đạt** → build trang NV xem đầy đủ + form nhận xét. **Fail** → sửa schema/form.
- **E2 fail** (nhận xét bỏ trống) → đặt **bắt buộc khi chốt** + gợi ý mẫu (prompt) thay vì để trống.
- **E3 fail** → đơn giản hóa trang xem, thêm chú thích.

---

## Thứ tự build đề xuất
1. **Backend**: thêm `strengths`/`improvements`/`developmentPlan` vào MonthlyEvaluation + nhận ở `approve` (HR chốt). (Tùy chọn) validate bắt buộc.
2. **Score dialog (HR/QL)**: thêm 3 ô nhận xét khi chốt.
3. **MyEvaluationsPage (NV)**: nâng từ list → **xem chi tiết read-only** (điểm từng tiêu chí, ratio, nhận xét, kế hoạch phát triển, lịch sử các kỳ).
4. *(Pha sau)* rubric 1–5 · xếp loại tổng · KPI/OKR · calibration · trend.
