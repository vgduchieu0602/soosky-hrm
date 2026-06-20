# Discovery Plan: Luồng nghiệp vụ HRM cho Ban giám đốc & Trưởng phòng Nhân sự

**Date:** 2026-06-18
**Product Stage:** Existing product (continuous discovery)
**Discovery Question:** Để phục vụ BOD và Trưởng phòng Nhân sự, đâu là lỗ hổng lớn nhất trong luồng nghiệp vụ HRM đáng xây tiếp?

---

## Ideas Explored
10 ý tưởng từ góc PM/Designer/Engineer (xem chi tiết trong hội thoại). Phân theo persona:
- **BOD:** Executive Dashboard (#1), duyệt quỹ lương (#5), compliance guardrails (#6), cảnh báo sức khỏe NS (#7), mô phỏng what-if (#10).
- **HRM:** Manager self-service (#3), tự khởi tạo quỹ phép/lễ (#4), minh bạch 20/60/20 (#8), cổng tự phục vụ mobile (#9).
- **Nền tảng:** Payroll Engine (#2).

## Selected Ideas for Validation
| # | Ý tưởng | Vì sao chọn |
|---|---------|-------------|
| #2 | **Payroll Engine** | Module rỗng; là nguồn mọi con số BOD duyệt & dashboard tiêu thụ. Đòn bẩy cao nhất, phụ thuộc gốc. |
| #1 | **Executive Dashboard** | Nhu cầu rõ của BOD; nhưng giá trị phụ thuộc dữ liệu từ #2. |
| #3 | **Manager self-service** | Gỡ tải vận hành cho HR, độc lập với #2 → có thể chạy song song. |

---

## Critical Assumptions
| # | Assumption | Idea | Category | Impact | Uncertainty | Priority |
|---|-----------|------|----------|--------|-------------|----------|
| A1 | Lương tự tính (20/60/20 + BHXH/thuế/trần BH + pro-rata công) **khớp** kết quả thủ công & đúng luật | #2 | Feasibility | Cao | Cao | 🔴 1 (leap) |
| A2 | BOD **thật sự dùng** dashboard để ra quyết định (không chỉ "nice to have") | #1 | Value | Cao | Cao | 🔴 2 (leap) |
| A3 | `employee.managerId` (đường báo cáo) **đủ chính xác & phủ** để định tuyến duyệt | #3 | Feasibility | Cao | TB | 🟠 3 |
| A4 | `MonthlyEvaluation` (hiệu suất+mục tiêu) **hoàn tất đúng hạn** trước kỳ lương | #2 | Feasibility | Cao | Cao | 🔴 4 (leap) |
| A5 | Manager **chịu tự duyệt** thay vì đẩy về HR | #3 | Value | TB | Cao | 🟠 5 |
| A6 | HR tin tưởng để **khóa kỳ lương tự tính** sau khi review nhẹ | #2 | Usability | Cao | TB | 🟠 6 |
| A7 | BOD (không kỹ thuật) **đọc hiểu** dashboard không cần đào tạo | #1 | Usability | TB | TB | 🟡 7 |
| A8 | Tự động hóa **tiết kiệm giờ công** đo được so với Excel hiện tại | #2/#3 | Viability | TB | Thấp | 🟡 8 |

**Leap-of-faith (impact cao + bất định cao):** A1, A2, A4. Phải validate trước khi cam kết build lớn.

---

## Validation Experiments
| # | Tests | Method | Success Criteria | Effort | Timeline |
|---|-------|--------|------------------|--------|----------|
| E1 | A1 | **Parallel run**: tính lại lương 1 kỳ quá khứ cho ~20 NV, đối chiếu bảng lương Excel đã trả | Sai lệch <0.5% hoặc giải thích được 100% chênh lệch | M | Tuần 1 |
| E2 | A4 | **Data audit**: rà 3 kỳ gần nhất xem evaluation có xong trước payday không | ≥90% NV có evaluation đúng hạn; nếu không → cần ràng buộc quy trình | S | Tuần 1 |
| E3 | A3 | **Data audit** `managerId`: % NV có manager hợp lệ + spot-check 20 NV | ≥95% phủ & đúng; xác định ai không có manager | S | Tuần 1 |
| E4 | A2, A7 | **Concierge dashboard**: dựng tay 1 trang báo cáo từ dữ liệu thật, gửi BOD mỗi tuần × 3 | BOD mở ≥2/3 lần & trích dẫn số liệu trong ≥1 quyết định | M | Tuần 1–3 |
| E5 | A5 | **Prototype duyệt (fake door/clickable)**: 3 manager dùng thử luồng duyệt nghỉ + lịch team | ≥2/3 hoàn tất duyệt không cần HR hỗ trợ | M | Tuần 2 |

### Experiment Details
- **E1 (quan trọng nhất):** lấy `PayrollPeriod` 1 tháng đã `paid`, dùng `salary.util` + dữ liệu attendance/leave/evaluation thật để tính lại, in bảng so sánh từng cấu phần (gross/insurance/tax/net). Kill nếu chênh lệch hệ thống không giải thích được.
- **E2/E3:** truy vấn read-only, gần như miễn phí — chạy ngay để gỡ rủi ro phụ thuộc quy trình trước khi viết code.
- **E4:** chưa cần code dashboard; validate desirability bằng báo cáo thủ công. Nếu BOD không dùng bản tay → dashboard tự động cũng sẽ không được dùng.
- **E5:** validate hành vi manager trước khi đầu tư UI + định tuyến duyệt.

---

## Discovery Timeline
- **Tuần 1:** E1, E2, E3 (rà dữ liệu + parallel run) — gỡ 3 leap kỹ thuật/dữ liệu.
- **Tuần 2:** E5 (prototype manager) + bắt đầu E4 (báo cáo concierge tuần 1).
- **Tuần 3:** E4 hoàn tất 3 vòng + tổng hợp & quyết định.

## Decision Framework
- **E1 đạt** → xây Payroll Engine thật (#2). **E1 fail** → sửa công thức/dữ liệu trước, chưa build UI.
- **E2 fail** → thêm ràng buộc "evaluation phải xong trước khi chạy lương" vào quy trình (chặn payroll run).
- **E3 fail** → bổ sung dữ liệu managerId / fallback duyệt HR trước khi làm #3.
- **E4 đạt** → build dashboard (#1) sau khi #2 cho dữ liệu thật. **Fail** → tìm lại đúng câu hỏi BOD cần.
- **E5 đạt** → build manager self-service (#3). **Fail** → giữ duyệt tập trung HR, ưu tiên giảm tải bằng cách khác.

## Thứ tự build đề xuất (theo phụ thuộc)
1. Gỡ rủi ro dữ liệu (E2, E3) — gần như free.
2. **Payroll Engine (#2)** sau khi E1 đạt — nền tảng.
3. **Manager self-service (#3)** song song (độc lập dữ liệu lương).
4. **Executive Dashboard (#1)** cuối — tiêu thụ dữ liệu từ #2.
