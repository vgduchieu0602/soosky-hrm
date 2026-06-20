# Discovery Plan: Hoàn thiện luồng Chấm công → Đánh giá → Bảng lương (E2E)

**Date:** 2026-06-19
**Product Stage:** Existing product (completion audit)
**Discovery Question:** Luồng chấm công → đánh giá → bảng lương đã chạy được end-to-end thật chưa? Đâu là điểm gãy phải gỡ để HR dùng được không cần dev?

---

## Kết quả audit (trace code thực tế)

| Mắt xích | Trạng thái | Chi tiết |
|---|---|---|
| Tạo dữ liệu chấm công | ⚠️ Một phần | ✅ HR nhập tay (`/admin/attendances`) + sinh từ nghỉ phép · ❌ NV chưa có check-in/out |
| Chấm công → payroll | ✅ Đủ | `aggregatePeriodAttendance` được gọi trong `payroll-run`, khớp khoảng ngày |
| Đánh giá → payroll | ⚠️ Một phần | ✅ Backend tính & lưu `performanceRatio`; payroll yêu cầu `approved`/`acknowledged` · ❌ **UI đánh giá mock** |
| Chạy bảng lương | ⚠️ Một phần | ✅ Đủ input (contract, allowance, bonus, tax-profile) · ❌ **Salary policy chưa có cách tạo từ UI** → run fail nếu DB trống |
| FE wiring | ⚠️ Một phần | ✅ Attendance, Payroll thật · ❌ Performance mock |

## ✅ CẬP NHẬT 2026-06-19 — ĐÃ HOÀN THIỆN & KIỂM CHỨNG

Cả 2 blocker đã gỡ + bổ sung self-service NV. **Chuỗi chạy end-to-end thật, có integration test chứng minh:**
- `payroll-e2e.spec.ts` — seed đầy đủ → run → **net = 25.222.500đ** khớp tính tay; chặn khi eval chưa duyệt (`PAY_EVAL_REQUIRED`).
- `chain-e2e.spec.ts` — **check-in/out** tạo bản ghi công (self); **workflow self→manager→HR approve** ra `performanceRatio=90`; **payroll tiêu thụ** → proRated 27.900.000đ. Chặn check-out trước check-in (`ATT_006`).
- Tổng: **8 test suites / 64 + chain pass.**

| Mắt xích | Trạng thái mới |
|---|---|
| Chấm công | ✅ NV check-in/out tự ghi + HR nhập + nghỉ phép |
| Đánh giá | ✅ self→manager→HR chốt→NV xác nhận (UI thật) |
| Policy | ✅ seed VN 2026 + UI tạo/sửa |
| Bảng lương | ✅ run/duyệt/chi + payslip NV |

**Còn lại (không chặn chuỗi):** check-in/out dùng ca mặc định (chưa gán ca theo NV); dispute note khi ack dùng confirm đơn giản; chưa chạy app live.

---

## (Lịch sử) Verdict ban đầu: chuỗi thông ở tầng code nhưng GÃY TRONG THỰC TẾ vì 2 blocker:
1. 🔴 **Salary policy config** — `payroll-run` ném `NotFoundError('Salary policy config')` nếu DB chưa có → cả kỳ fail. Có endpoint `POST /admin/settings/salary-policies` nhưng **chưa có UI tạo**.
2. 🔴 **Trang Đánh giá mock** — HR không nhập/duyệt điểm được → `performanceRatio = 0` hoặc payroll fail (`PAY_EVAL_REQUIRED`).

Gap phụ: 🟡 NV chưa tự check-in/out · 🟡 UI hợp đồng (baseSalary) chưa rõ.

---

## Selected Ideas for Validation (đã chốt)

| # | Ý tưởng | Vì sao |
|---|---------|--------|
| 1 | **Wire Performance UI** thật (self → manager → HR chốt → NV xác nhận) | Gỡ blocker đánh giá |
| 2 | **Salary policy UI** (Settings) | HR tự sửa policy |
| 3 | **Seed policy VN mặc định 2026** | Gỡ blocker payroll ngay, không chờ UI |
| 8 | **Integration test cả chuỗi** (mongodb-memory-server) | Bằng chứng "đã hoàn thiện" |
| 10 | **Seed demo data** | Chạy thử live, eyeball số |

Để pha sau: check-in/out NV (#5), pre-flight checklist (#4), UI hiển thị lỗi run (#9), UI hợp đồng (#6).

---

## Critical Assumptions

| # | Assumption | Category | Impact | Uncertainty | Priority |
|---|-----------|----------|--------|-------------|----------|
| A1 | Cả chuỗi (attendance + eval approved + policy + contract) **ra đúng net** khớp tính tay | Feasibility | Cao | Cao | 🔴 1 (leap) |
| A2 | Giá trị policy VN seed (lương cơ sở, lương tối thiểu vùng, 7 bậc thuế, giảm trừ) **đúng & cập nhật** | Feasibility | Cao | TB | 🟠 2 |
| A3 | Performance UI wire đúng → self→manager→HR→ack chạy mượt & feed `performanceRatio` vào payroll | Usability | Cao | TB | 🟠 3 |
| A4 | `employee.managerId` đủ phủ để định tuyến manager review | Feasibility | TB | TB | 🟡 4 |
| A5 | HR **tự chạy được 1 kỳ** từ UI (tạo kỳ → eval → policy → run → duyệt → chi) không cần dev | Value | Cao | TB | 🟠 5 |

**Leap:** A1 — chỉ integration test mới chứng minh chuỗi đúng số.

---

## Validation Experiments

| # | Tests | Method | Success Criteria | Effort | Timeline |
|---|-------|--------|------------------|--------|----------|
| E1 | A1, A2 | **Integration test** (memory-server replica set): seed employee+contract+attendance+criteria+evaluation(approved)+policy+period → `runPayrollForEmployee` → assert từng dòng gross/insurance/tax/net khớp tính tay | Khớp 100% case đã tính tay | M | Tuần 1 |
| E2 | A1, A5 | **Seed demo + chạy live**: seed ~5 NV đầy đủ dữ liệu → mở PayrollPage → Tính lương → eyeball số + duyệt + đánh dấu chi | Số hiện đúng, luồng UI không lỗi | M | Tuần 1 |
| E3 | A3, A4 | **Wire Performance UI** + thao tác 1 vòng self→manager→HR→ack trên trình duyệt → payroll đọc đúng ratio | Hoàn tất 1 vòng, payroll lấy đúng `performanceRatio` | M | Tuần 2 |
| E4 | A2, A5 | **Salary policy UI**: HR tạo/sửa policy từ Settings → run dùng policy đó | Tạo được policy, run không fail | S | Tuần 2 |

### Experiment Details
- **E1 (quan trọng nhất):** đây chính là câu trả lời "đã hoàn thiện chưa" — một test chạy thật toàn chuỗi với Mongo memory-server (cần replica set cho transaction của payroll-run). Kill/sửa nếu net lệch.
- **E2:** seed script cho dữ liệu mẫu; vừa gỡ blocker policy (seed), vừa cho phép demo.
- **E3/E4:** gỡ 2 blocker UI; sau đó HR tự vận hành.

---

## Thứ tự build đề xuất
1. **Seed default VN salary policy 2026** (gỡ blocker payroll ngay) + **seed demo data**.
2. **Integration test chuỗi** (E1) — chốt tính đúng đắn.
3. **Salary policy management UI** (Settings) — HR tự sửa.
4. **Wire Performance UI** (form self/manager/HR/ack) — gỡ blocker đánh giá.
5. *(Pha sau)* check-in/out NV · pre-flight checklist · UI lỗi run · UI hợp đồng.

## Decision Framework
- **E1 đạt** → chuỗi đã đúng số → tập trung gỡ blocker UI (E3, E4). **Fail** → sửa công thức/seed trước.
- **E2 fail** → sửa seed/aggregation trước khi mở cho HR.
- **E3 fail** → giữ nhập điểm tối thiểu (HR-only) trước, multi-rater sau.
- **E4 fail** → giữ seed policy là đủ tạm thời.
