# Tài liệu tham chiếu: Công thức tính lương — Soosky HRM

> Tài liệu mô tả chi tiết cách hệ thống tính lương cho từng khoản.
> Nguồn code: `backend/src/shared/utils/salary.util.ts` (engine tính toán thuần) +
> `backend/src/features/payroll/services/payroll-run.service.ts` (ráp dữ liệu từ DB).
> Mọi số tiền lưu dưới dạng `Decimal128`, làm tròn về số nguyên VNĐ ở từng bước.

---

## 0. Tổng quan luồng tính

```
Hợp đồng (lương cơ bản) ┐
Chấm công (ngày công)   ├─▶ computePayroll() ─▶ Bảng lương (Payroll)
Đánh giá tháng          │
Chính sách lương        │
Hồ sơ thuế              │
Phụ cấp / Thưởng / Khấu trừ ┘
```

Thứ tự tính: **Lương theo công → Tổng thu nhập (Gross) → Bảo hiểm → Thuế TNCN → Thực nhận (Net)**.

Điều kiện để tính được lương:
- Kỳ lương đang **mở** (chưa đóng/đã chi thì không tính lại).
- Đã **chốt chấm công** của kỳ.
- Có **hợp đồng đang hiệu lực**.
- Có **đánh giá tháng được duyệt** (có thể bỏ qua bằng cờ `requireApprovedEvaluation: false`).
- Có **chính sách lương** hiệu lực tại ngày trả lương.

---

## 1. Lương theo công (mô hình 20/60/20)

Lương cơ bản được chia thành 3 phần theo trọng số (mặc định **20% chuyên cần / 60% hiệu suất / 20% mục tiêu**, có thể cấu hình trong chính sách lương).

**Quan trọng:** cả 3 phần **đều được nhân với tỷ lệ ngày công** — nghỉ không lương làm giảm **toàn bộ** lương, không chỉ phần chuyên cần.

```
tỷ lệ ngày công (attendanceRatio) = số ngày công thực tế / số ngày công chuẩn   (tối đa = 1)

Phần chuyên cần  = 20% × lương_cơ_bản × tỷ_lệ_ngày_công
Phần hiệu suất   = 60% × lương_cơ_bản × (điểm_hiệu_suất / 100) × tỷ_lệ_ngày_công
Phần mục tiêu    = 20% × lương_cơ_bản × (điểm_mục_tiêu / 100)  × tỷ_lệ_ngày_công

Lương theo công (proRatedBaseSalary) = Phần chuyên cần + Phần hiệu suất + Phần mục tiêu
```

- `điểm_hiệu_suất`, `điểm_mục_tiêu`: thang 0–100, lấy snapshot từ **đánh giá tháng** đã duyệt.
- Đủ công (ratio = 1) + đủ điểm (100/100) → lương theo công = 100% lương cơ bản.
- Nghỉ không lương cả tháng (ratio = 0) → lương theo công = 0đ.

### Lương cơ bản áp theo trạng thái lao động

| Trạng thái | Lương cơ bản dùng để tính | Trọng số áp dụng |
|---|---|---|
| **Chính thức** | 100% lương hợp đồng | 20/60/20 (theo chính sách) |
| **Thử việc** (`probation`) | 85% lương thỏa thuận (`probationPayRate`) | 100% chuyên cần (không tính hiệu suất/mục tiêu) |
| **Thực tập** (`internship`) | **100% lương hợp đồng** | 100% chuyên cần |
thực tập < 11 công thì sẽ tính lương theo ngày công
thực tập > 11 công thì sẽ tính lương 20/60/20

> Với thử việc & thực tập, lương = lương_cơ_bản × tỷ_lệ_ngày_công (chỉ prorate theo ngày công, không phụ thuộc điểm đánh giá).
> **Thực tập sinh hưởng đúng lương ghi trên hợp đồng, chỉ chịu ảnh hưởng của chấm công** — không còn dùng mức cố định `internStipend`.

---

## 2. Cách tính ngày công (chấm công)

Mỗi bản ghi chấm công có **trọng số ca**: cả ngày = 1; sáng = 0.5; chiều = 0.5.

| Trạng thái chấm công | Phân loại | Ảnh hưởng lương |
|---|---|---|
| `present`, `late`, `early_leave` | Ngày làm việc (có lương) | Tính đủ công (đi muộn/về sớm **không** trừ lương) |
| `leave_paid` | Nghỉ phép có lương | Tính là ngày có lương, không tính "làm" |
| `holiday` | Ngày lễ | Tính là ngày có lương |
| `leave_unpaid` | Nghỉ không lương | **Giảm** lương |
| `absent` | Vắng mặt | **Giảm** lương |
| `incomplete` | Có check-in, thiếu check-out | **Không** tính cho đến khi HR sửa (không thổi phồng tỷ lệ) |

```
số ngày công thực tế (actualWorkDays) = ngày làm + nghỉ phép có lương + ngày lễ
số ngày không lương                    = nghỉ không lương + vắng mặt
```

**Số ngày công chuẩn (standardWorkDays):** số ngày làm việc trong kỳ theo lịch làm việc của ca (mặc định T2–T6), **đã loại trừ ngày lễ**. Nếu nhân viên không gán ca thì lấy mặc định của kỳ lương.

---

## 3. Tổng thu nhập (Gross)

```
Gross = Lương theo công + Tổng phụ cấp + Lương làm thêm giờ (OT) + Tổng thưởng
```

### 3.1 Phụ cấp

Mỗi phụ cấp có 2 thuộc tính ảnh hưởng cách tính:
- **Loại giá trị:** `fixed` (số tiền cố định) hoặc `percentage` (% của **lương cơ bản hợp đồng**).
- **Chịu thuế (`isTaxable`):** quyết định có cộng vào thu nhập tính thuế hay không.
- **Tính vào nền BH (`isInsuranceBase`):** quyết định có cộng vào nền đóng bảo hiểm hay không.

### 3.2 Thưởng

Thưởng theo kỳ, mỗi khoản có cờ `isTaxable`. Thưởng **luôn cộng vào Gross**, nhưng **không** đưa vào nền tính bảo hiểm. Thưởng không chịu thuế sẽ được trừ ra khỏi thu nhập tính thuế (mục 5).

### 3.3 Làm thêm giờ (OT)

> Hiện công ty **đang tắt** OT (`overtimeEnabled = false`) nên OT = 0. Phần dưới mô tả khi bật.

```
đơn giá giờ = lương_cơ_bản / (số_ngày_công_chuẩn × 8)

Hệ số theo loại ngày:  ngày thường ×1.5  ·  cuối tuần ×2.0  ·  ngày lễ ×3.0

Lương OT = Σ (đơn giá giờ × hệ số × số giờ)
```

**Miễn thuế phần vượt giờ:** theo luật TNCN, phần tiền OT **vượt mức lương giờ thường** được miễn thuế.
- Phần chịu thuế = đơn giá giờ × 1.0 × số giờ
- Phần miễn thuế = đơn giá giờ × (hệ số − 1) × số giờ

Toàn bộ OT cộng vào Gross, nhưng phần miễn thuế được trừ khỏi thu nhập tính thuế.

---

## 4. Bảo hiểm bắt buộc (BHXH / BHYT / BHTN)

> **Chỉ nhân viên chính thức đóng bảo hiểm.** Thử việc & thực tập: bảo hiểm = 0.

Bảo hiểm **không** đóng trên Gross mà trên **mức lương đóng BHXH cố định** của công ty (`socialInsuranceSalary`), cộng thêm các phụ cấp có cờ `isInsuranceBase`. Mức này độc lập với việc nhân viên nghỉ nửa tháng hay không.

```
nền BHXH/BHYT = min(mức_đóng_BHXH + phụ_cấp_tính_BH, trần BHXH)
nền BHTN      = min(mức_đóng_BHXH + phụ_cấp_tính_BH, trần BHTN)

trần BHXH/BHYT = lương cơ sở × 20
trần BHTN      = lương tối thiểu vùng × 20
```

### Tỷ lệ đóng

| Khoản | Người lao động | Người sử dụng lao động |
|---|---|---|
| BHXH (hưu trí, tử tuất) | 8% | 17% |
| BHYT | 1.5% | 3% |
| BHTN | 1% | 1% |
| TNLĐ–BNN (tai nạn LĐ, bệnh nghề nghiệp) | — | 0.5% |
| **Tổng** | **10.5%** | **21.5%** |

```
Bảo hiểm NLĐ trừ vào lương = nền BHXH×8% + nền BHXH×1.5% + nền BHTN×1%
```

---

## 5. Thu nhập tính thuế & Thuế TNCN

### 5.1 Thu nhập tính thuế

```
Thu nhập chịu thuế (assessable) = Gross − phụ cấp miễn thuế − thưởng miễn thuế − phần OT miễn thuế
```

Tiếp theo phân biệt theo **tình trạng cư trú**:

```
• Người CƯ TRÚ:
    Thu nhập tính thuế = Thu nhập chịu thuế − Bảo hiểm (NLĐ)        (bảo hiểm được giảm trừ)

• Người KHÔNG CƯ TRÚ:
    Thu nhập tính thuế = Thu nhập chịu thuế                         (KHÔNG giảm trừ bảo hiểm)
```

### 5.2 Tính thuế

**Người cư trú** — giảm trừ rồi áp biểu lũy tiến từng phần:

```
Thu nhập tính thuế sau giảm trừ = max(0, Thu nhập tính thuế − giảm trừ bản thân − giảm trừ người phụ thuộc)

giảm trừ bản thân        = 11.000.000đ (mặc định)
giảm trừ người phụ thuộc = 4.400.000đ × số người phụ thuộc
```

Biểu thuế lũy tiến từng phần (theo tháng):

| Bậc | Thu nhập tính thuế/tháng (sau giảm trừ) | Thuế suất |
|---|---|---|
| 1 | đến 5.000.000 | 5% |
| 2 | 5.000.000 – 10.000.000 | 10% |
| 3 | 10.000.000 – 18.000.000 | 15% |
| 4 | 18.000.000 – 32.000.000 | 20% |
| 5 | 32.000.000 – 52.000.000 | 25% |
| 6 | 52.000.000 – 80.000.000 | 30% |
| 7 | trên 80.000.000 | 35% |

> Tính theo **biên (marginal)**: mỗi phần thu nhập rơi vào bậc nào chịu thuế suất bậc đó.

**Người không cư trú** — thuế phẳng, không giảm trừ:

```
Thuế = Thu nhập tính thuế × 20%   (nonResidentTaxRate, mặc định 20%)
```

---

## 6. Thực nhận (Net)

```
Net = max(0, Gross − Bảo hiểm (NLĐ) − Thuế TNCN − Đoàn phí − Khấu trừ khác)
```

Net = lương cơ bản + phụ cấp (lương gross - phụ cấp)
Gross = 10tr - 557500 - 55000 = net

- **Đoàn phí công đoàn:** = mức đóng BHXH × `unionFeeRate` (chỉ nhân viên chính thức, khi bật `unionFeeEnabled`). Trừ **sau thuế**.
- **Khấu trừ khác** (tạm ứng, phạt…): loại `fixed` (số tiền) hoặc `percentage` (% của Gross). Trừ **sau thuế**.
- Net được **chặn ở 0** — không bao giờ ra số âm dù khấu trừ vượt quá Gross.

```
Tổng khấu trừ (totalDeductions) = Bảo hiểm + Thuế + Đoàn phí + Khấu trừ khác
```

---

## 7. Ví dụ minh hoạ

**Nhân viên chính thức** — lương cơ bản 30.000.000đ, đủ công (ratio = 1), hiệu suất 100, mục tiêu 100, phụ cấp chịu thuế 2.000.000đ, phụ cấp ăn trưa (miễn thuế) 730.000đ, 1 người phụ thuộc, mức đóng BHXH = lương cơ bản:

| Khoản | Cách tính | Số tiền |
|---|---|---|
| Lương theo công | 20%×30tr + 60%×30tr + 20%×30tr | 30.000.000 |
| Tổng phụ cấp | 2.000.000 + 730.000 | 2.730.000 |
| **Gross** | 30.000.000 + 2.730.000 | **32.730.000** |
| Bảo hiểm NLĐ | 30.000.000 × 10.5% | 3.150.000 |
| Thu nhập chịu thuế | 32.730.000 − 3.150.000 − 730.000 | 28.850.000 |
| Sau giảm trừ | 28.850.000 − 11.000.000 − 4.400.000 | 13.450.000 |
| Thuế TNCN | 250k + 500k + (3.450.000×15%) | 1.267.500 |
| **Net** | 32.730.000 − 3.150.000 − 1.267.500 | **28.312.500** |

**Thực tập sinh** — HĐ ghi 20.000.000đ, đủ công cả tháng (ratio = 1), người cư trú, 0 người phụ thuộc:

| Khoản | Cách tính | Số tiền |
|---|---|---|
| Lương theo công | 20.000.000 × 1 (100% chuyên cần) | 20.000.000 |
| Gross | — | 20.000.000 |
| Bảo hiểm | thực tập không đóng | 0 |
| Đoàn phí | thực tập không đóng | 0 |
| Sau giảm trừ | 20.000.000 − 11.000.000 | 9.000.000 |
| Thuế TNCN | 5%×5tr + 10%×4tr | 650.000 |
| **Net** | 20.000.000 − 650.000 | **19.350.000** |

> Nghỉ nửa tháng (ratio = 0.5) → lương theo công = 10.000.000đ. Lương thực tập **chỉ** thay đổi theo ngày công.

---

## 8. Các tham số cấu hình (Chính sách lương)

Lưu trong `salaryPolicyConfigs`, áp theo `effectiveFrom ≤ ngày trả lương`:

| Tham số | Ý nghĩa | Mặc định |
|---|---|---|
| `baseSalary` | Lương cơ sở (để tính trần BHXH) | — |
| `regionalMinWage` | Lương tối thiểu vùng (theo zone, tính trần BHTN) | — |
| `insuranceCeilingMultiplier` | Hệ số trần bảo hiểm | 20 |
| `socialInsuranceSalary` | Mức lương cố định đóng BHXH | — |
| `personalDeduction` | Giảm trừ bản thân | 11.000.000 |
| `dependentDeduction` | Giảm trừ mỗi người phụ thuộc | 4.400.000 |
| `taxBrackets` | Biểu thuế lũy tiến | 7 bậc 5%–35% |
| `insuranceRates` | Tỷ lệ đóng BH (NLĐ/DN) | 10.5% / 21.5% |
| `nonResidentTaxRate` | Thuế suất người không cư trú | 20% |
| `unionFeeRate` / `unionFeeEnabled` | Đoàn phí (% mức đóng BHXH) | 1% / bật |
| `probationPayRate` | % lương thử việc | 85% |
| `internStipend` | *(Đã bỏ — thực tập hưởng lương hợp đồng)* | — |
| `salaryComponentWeights` | Trọng số 20/60/20 | 20/60/20 |

---

## 9. Quy trình & trạng thái bảng lương

- Trạng thái: `draft` (nháp) → `approved` (đã duyệt) → `paid` (đã chi).
- Tính lương là **idempotent**: chạy lại kỳ chỉ ghi đè bản `draft`; bản đã duyệt/đã chi sẽ bị từ chối tính lại.
- Tính lương chạy trong **transaction** (yêu cầu MongoDB replica set).
- Nhân viên chỉ xem được phiếu lương **của chính mình** và **không** thấy bản nháp.

---

*Cập nhật theo code tại thời điểm tạo tài liệu. Khi đổi logic trong `salary.util.ts` hoặc `payroll-run.service.ts`, hãy cập nhật lại tài liệu này.*
