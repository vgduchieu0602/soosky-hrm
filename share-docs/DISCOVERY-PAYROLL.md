# Discovery Plan: Module Bảng lương (Payroll Engine)

**Date:** 2026-06-19
**Product Stage:** Existing product (continuous discovery)
**Discovery Question:** Xây module bảng lương chuẩn doanh nghiệp VN, bám kiến trúc & DB hiện có — phần nào phải build, model nào còn thiếu, rủi ro nào phải gỡ trước khi cam kết?

> Nối tiếp [DISCOVERY-HRM-BOD-HRM.md](./DISCOVERY-HRM-BOD-HRM.md) — Payroll Engine (#2) đã được xác định là module đòn bẩy cao nhất, là nguồn dữ liệu cho dashboard BOD và quy trình duyệt.

---

## Hiện trạng codebase (đã khảo sát)

**Đã có sẵn (mạnh):**
- `shared/models/payroll.model.ts` — schema đầy đủ: 20/60/20 (attendance/performance/goal component), gross, BHXH/BHYT/BHTN (cả phần NV & DN), trần bảo hiểm, thuế TNCN, net, status `draft|approved|paid`.
- `shared/models/salary-policy-config.model.ts` — config versioned: `baseSalary`, `regionalMinWage`, `insuranceCeilingMultiplier` (20), `personalDeduction` (11tr), `dependentDeduction` (4.4tr), `taxBrackets`, `insuranceRates`, `salaryComponentWeights` (20/60/20, refine sum=100).
- `monthly-evaluation.model.ts` — cung cấp `performanceRatio` & `goalRatio` (1 bản/employee/payrollPeriod).
- `attendance-calc.ts`, `leave.service.ts` — tính công ngày, đếm ngày làm việc, sync leave→attendance.
- `employee-contract.model.ts` (`baseSalary` snapshot), `employee-bank-account.model.ts`, `company-config.model.ts` (`standardWorkDays=22`, `payCycleStartDay`).
- `settings.service.ts` — CRUD salary policy đã chạy.

**Còn thiếu (phải tạo):**
- `payroll-period.model.ts`, `payslip.model.ts` — referenced trong DATABASE.md, chưa tạo.
- `allowance.model.ts`, `bonus.model.ts`, `deduction.model.ts` — gross hiện không có nguồn phụ cấp/thưởng/khấu trừ.
- `employee-tax-profile.model.ts` — `dependentsCount`, `isResident`, `taxCode`: đầu vào bắt buộc cho thuế TNCN đúng.
- **Cầu nối attendance → payroll** — chưa có aggregation gom công thành `actualWorkDays/standardWorkDays/unpaidLeaveDays/overtime`.
- Toàn bộ `features/payroll/` (controller/service/repo/dto/routes) — folder rỗng.

---

## Ideas Explored (10) — xem brainstorm trong hội thoại

PM: (1) Period & Run Engine, (2) Duyệt nhiều cấp + khóa kỳ, (3) Allowance/Bonus/Deduction, (4) Tax-profile.
Designer: (5) Payslip PDF + cổng NV, (6) Grid Excel-like cho HR, (7) Trang giải thích lương.
Engineer: (8) Aggregation gom công attendance→payroll, (9) Recompute idempotent + versioning, (10) Báo cáo quỹ lương + file ngân hàng.

## Selected Ideas for Validation (MVP)

| # | Ý tưởng | Nhóm | Vì sao trong MVP |
|---|---------|------|------------------|
| 1 | Payroll Period & Run Engine | Lõi | Nền tảng — mọi thứ phụ thuộc |
| 8 | Aggregation gom công attendance→payroll | Lõi | Mắt xích còn thiếu để có input công |
| 9 | Recompute idempotent + versioning | Lõi | An toàn vận hành khi chạy lại kỳ |
| 3 | Allowance / Bonus / Deduction | Đầu vào | Gross đúng số thực tế |
| 4 | Employee Tax-profile | Đầu vào | Thuế TNCN đúng luật |
| 2 | Duyệt nhiều cấp + khóa kỳ | Quản trị | Kiểm soát, snapshot bất biến sau khóa |

**Compliance:** Chuẩn VN đầy đủ ngay (thuế TNCN lũy tiến 7 bậc, trần BHXH 20× lương cơ sở, BHTN 20× lương tối thiểu vùng, giảm trừ bản thân + người phụ thuộc).

**Để pha sau:** #5 Payslip/cổng NV, #6 grid, #7 trang giải thích, #10 export ngân hàng/báo cáo BHXH.

---

## Critical Assumptions

| # | Assumption | Idea | Category | Impact | Uncertainty | Priority |
|---|-----------|------|----------|--------|-------------|----------|
| A1 | Công thức tự tính (20/60/20 + BHXH/thuế/trần/pro-rata) **khớp** bảng lương Excel thật & đúng luật VN | 1 | Feasibility | Cao | Cao | 🔴 1 (leap) |
| A2 | Dữ liệu `attendance` đủ **sạch & đầy đủ** để gom ra actual/standard workdays + unpaidLeave + overtime tin cậy | 8 | Feasibility | Cao | Cao | 🔴 2 (leap) |
| A3 | `MonthlyEvaluation` **hoàn tất & approved đúng hạn** trước payday (nếu thiếu, 60%+20% lấy gì?) | 1 | Feasibility | Cao | Cao | 🔴 3 (leap) |
| A4 | Phụ cấp/thưởng/khấu trừ thực tế **phủ hết** bởi model `fixed/percentage/taxable/insuranceBase` | 3 | Feasibility | TB | TB | 🟠 4 |
| A5 | `dependentsCount` & tình trạng cư trú **có sẵn/nhập được** cho mọi NV trước kỳ lương | 4 | Usability | Cao | TB | 🟠 5 |
| A6 | HR tin tưởng **khóa kỳ tự tính** sau review nhẹ thay vì tính tay | 1/2 | Usability | Cao | TB | 🟠 6 |
| A7 | Cấp duyệt (HR→BOD) **chịu dùng** workflow trong app thay vì duyệt ngoài | 2 | Value | TB | TB | 🟡 7 |
| A8 | Recompute khi sửa input **không phá** số đã khóa/đã trả; versioning đủ minh bạch | 9 | Feasibility | Cao | TB | 🟠 8 |

**Leap-of-faith (impact cao + bất định cao):** A1, A2, A3 — phải gỡ trước khi build lớn.

---

## Validation Experiments

| # | Tests | Method | Success Criteria | Effort | Timeline |
|---|-------|--------|------------------|--------|----------|
| E1 | A1 | **Parallel run**: viết riêng `salary.util` (pure fn) + unit test với ~20 NV của 1 kỳ Excel đã trả, đối chiếu từng cấu phần | Sai lệch <0.5% hoặc giải thích 100% chênh lệch | M | Tuần 1 |
| E2 | A2 | **Data audit attendance**: rà 2–3 kỳ gần nhất — % NV có đủ bản ghi công, có lỗ hổng ngày nào? overtime tính được không? | ≥95% NV đủ ngày công; xác định lỗ hổng cần bù | S | Tuần 1 |
| E3 | A3 | **Data audit evaluation**: % NV có MonthlyEvaluation `approved` trước payday qua 3 kỳ | ≥90% đúng hạn; nếu không → cần fallback/ràng buộc chặn run | S | Tuần 1 |
| E4 | A5 | **Data audit tax-profile**: NV có dữ liệu người phụ thuộc/cư trú ở đâu hiện tại? backfill được không? | Có nguồn backfill hoặc form nhập trước kỳ đầu | S | Tuần 1 |
| E5 | A4, A6 | **Concierge 1 kỳ**: nhập tay allowance/bonus/deduction cho 1 phòng, HR review bảng kết quả | HR xác nhận đủ trường & tin số → đồng ý khóa thử | M | Tuần 2 |
| E6 | A7 | **Prototype luồng duyệt** (clickable) cho 1 HR + 1 BOD | Cả hai hoàn tất duyệt không cần hướng dẫn | S | Tuần 2 |

### Experiment Details
- **E1 (quan trọng nhất):** tách logic thành `salary.util.ts` thuần (không I/O) để unit-test dễ. Input = số liệu thật (base, công, ratio, allowance, dependents, policy config); so từng dòng gross/insurance/tax/net với Excel. **Kill/sửa công thức nếu chênh lệch hệ thống không giải thích được.**
- **E2/E3/E4:** truy vấn read-only, gần như free — chạy ngay để gỡ rủi ro dữ liệu trước khi viết engine.
- **E5:** validate độ phủ model phụ cấp & lòng tin HR vào việc khóa kỳ.
- **E6:** validate hành vi duyệt trước khi đầu tư UI workflow.

---

## Discovery Timeline
- **Tuần 1:** E1–E4 (parallel run + 3 data audit) — gỡ 3 leap A1/A2/A3 + A5.
- **Tuần 2:** E5 (concierge phụ cấp) + E6 (prototype duyệt).
- **Tuần 3:** Tổng hợp & quyết định build.

## Decision Framework
- **E1 đạt** → build engine thật trên `salary.util`. **Fail** → sửa công thức/config policy trước, chưa viết controller/UI.
- **E2 fail** → bổ sung quy trình chốt công (lock attendance) trước khi chạy lương.
- **E3 fail** → thêm ràng buộc "evaluation approved mới cho run" + chính sách fallback (ví dụ: dùng ratio kỳ trước / chặn).
- **E4 fail** → ưu tiên form nhập tax-profile + import hàng loạt trước kỳ đầu.
- **E5/E6 đạt** → build allowance/deduction CRUD + workflow duyệt.

---

## Kiến trúc đề xuất (bám pattern hiện có)

**Model mới cần tạo** (`shared/models/`): `payroll-period`, `employee-tax-profile`, `allowance`, `bonus`, `deduction` (payslip để pha sau).

**Feature `features/payroll/`:**
```
payroll.routes.ts
controllers/  period.controller.ts · payroll.controller.ts · allowance.controller.ts ...
services/     period.service.ts · payroll-run.service.ts · salary.util.ts (pure) · attendance-aggregate.service.ts
repositories/ payroll.repository.ts · period.repository.ts ...
dto/          *.dto.ts (Zod .strict)
index.ts      export PayrollService (cross-feature)
```

**Nguyên tắc:** Decimal128 cho tiền · transaction (`session.withTransaction`) cho payroll run · audit log mọi mutation · snapshot mọi input vào bản payroll tại thời điểm compute (bất biến sau khóa) · idempotent theo unique `{payrollPeriodId, employeeId}`.

## Thứ tự build đề xuất (theo phụ thuộc)
1. **Gỡ rủi ro dữ liệu** E2/E3/E4 (gần free) + viết `salary.util` + test E1.
2. **Tax-profile + Allowance/Bonus/Deduction model & CRUD** (input cho gross/thuế).
3. **Attendance aggregate service** (gom công → input payroll).
4. **Payroll Period + Run Engine** (idempotent, transaction, snapshot).
5. **Workflow duyệt + khóa kỳ** (draft→HR→BOD→paid).
6. *(Pha sau)* Payslip PDF + cổng NV + export ngân hàng + dashboard BOD.
