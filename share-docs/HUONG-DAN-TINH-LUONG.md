# Hướng dẫn sử dụng: Quy trình tính lương — Soosky HRM

> Tài liệu hướng dẫn **người dùng (HR/Admin)** nhập liệu và chạy bảng lương từ A→Z.
> Đi kèm ví dụ số cụ thể cho 3 loại nhân viên: **chính thức · thử việc · thực tập**.
> Công thức chi tiết xem `PAYROLL-FORMULA.md`. Tài liệu này tập trung vào **nhập data từ đâu, đến đâu**.

---

## 0. Bức tranh tổng thể — data chảy từ đâu đến đâu

```
                ┌──────────────────────────────────────────────────────┐
                │                  DỮ LIỆU NỀN (làm 1 lần)               │
                └──────────────────────────────────────────────────────┘
  Cài đặt ▸ Chính sách lương ──────────────┐   (mức BH, đoàn phí, giảm trừ, TNCN on/off)
  Nhân sự  ▸ Hồ sơ + Hợp đồng ─────────────┤   (lương HĐ, trạng thái: chính thức/thử việc/thực tập)
  Chấm công ▸ Ca làm việc (Shift) ─────────┘   (số ngày công chuẩn)

                ┌──────────────────────────────────────────────────────┐
                │              DỮ LIỆU THEO THÁNG (mỗi kỳ)               │
                └──────────────────────────────────────────────────────┘
  Lương ▸ Phụ cấp / Thưởng / Khấu trừ ─────┐
  Lương ▸ Hồ sơ thuế nhân viên ────────────┤
  Chấm công ▸ Bảng công cả tháng ──────────┤──▶  TÍNH LƯƠNG  ──▶  Phiếu lương (Net/Gross)
  Đánh giá ▸ Đánh giá tháng (duyệt) ───────┘        (run)
```

**Nguyên tắc vàng:** Hệ thống **chỉ tính được lương khi đủ dữ liệu nền + dữ liệu tháng**. Thiếu bất kỳ phần nào, nhân viên đó sẽ báo lỗi (nhưng không chặn các nhân viên khác).

---

## 1. CHUẨN BỊ DỮ LIỆU NỀN (thiết lập 1 lần, dùng cho mọi kỳ)

### 1.1 Chính sách lương — `Cài đặt ▸ Chính sách lương ▸ Tạo chính sách`

Đây là nơi khai báo tham số toàn công ty. **Bắt buộc có 1 chính sách** hiệu lực trước ngày trả lương.

| Ô nhập | Nhập gì | Ví dụ |
|---|---|---|
| Năm áp dụng | Năm tài chính | `2026` |
| Hiệu lực từ | Ngày bắt đầu áp dụng | `2026-01-01` |
| Lương cơ sở tính BHXH | Để tính trần BH (×20) | `2.340.000` |
| Giảm trừ bản thân | Theo luật | `11.000.000` |
| Giảm trừ / người phụ thuộc | Theo luật | `4.400.000` |
| **Mức BH nhân viên (cố định)** | Số tiền BH trừ vào lương mỗi người | `577.500` |
| Đoàn phí công đoàn (%) | % của mức đóng BHXH | `1` |
| Áp dụng đoàn phí | Bật/tắt | ✅ bật |
| Lương thử việc (%) | % lương chính thức cho thử việc | `85` |
| **Tính thuế TNCN** | Bật = tính lũy tiến; **Tắt = thuế luôn = 0** | ❌ **tắt** |
| Lương tối thiểu vùng | Theo vùng I–IV | Vùng I `4.960.000` |
| Trọng số 20/60/20 | Ngày công / Hiệu suất / Mục tiêu (tổng = 100) | `20 / 60 / 20` |

> 💡 Theo cấu hình hiện tại của công ty: **Mức BH = 577.500₫**, **Đoàn phí = 55.000₫** (1% × 5.500.000), **TNCN tắt (= 0)**. Hai số BH và đoàn phí lấy từ đây, không nhập tay ở chỗ khác.

---

### 1.2 Hồ sơ & Hợp đồng nhân viên — `Nhân sự ▸ Nhân viên ▸ [Chọn người] ▸ Tab Hợp đồng`

Mỗi nhân viên phải có **1 hợp đồng `active`**. Lương và cách tính phụ thuộc vào đây.

| Ô nhập | Nhập gì | Ảnh hưởng tính lương |
|---|---|---|
| Số hợp đồng | Mã HĐ duy nhất | — |
| Loại HĐ | `fixed_term` / `indefinite` | — |
| **Tình trạng làm việc** | `official` / `probation` / `internship` | ⭐ Quyết định cách tính |
| Ngày bắt đầu / kết thúc | Hiệu lực HĐ | — |
| **Lương cơ bản** | Lương thỏa thuận trên HĐ | ⭐ Gốc để tính |
| Trạng thái | `active` | Chỉ HĐ active mới được dùng |

**Tình trạng làm việc quyết định gì:**

| Tình trạng | Lương dùng | Công thức | Cần đánh giá tháng? | Đóng BH? | Đoàn phí? |
|---|---|---|---|---|---|
| `official` (chính thức) | 100% lương HĐ | 20/60/20 | ✅ Bắt buộc | ✅ | ✅ |
| `probation` (thử việc) | 85% lương HĐ | 20/60/20 rồi ×85% | ✅ Bắt buộc | ❌ | ❌ |
| `internship` (thực tập) | 100% lương HĐ | < 11 công → theo ngày; ≥ 11 công → 20/60/20 | Chỉ khi ≥11 công | ❌ | ❌ |

---

### 1.3 Ca làm việc — `Chấm công ▸ Ca làm việc`

Gán ca cho nhân viên để hệ thống biết **số ngày công chuẩn** trong tháng (mặc định T2–T6, trừ ngày lễ). Nếu không gán ca → dùng mặc định của kỳ lương.

---

## 2. NHẬP DỮ LIỆU THEO THÁNG (lặp lại mỗi kỳ lương)

### 2.1 Tạo kỳ lương — `Lương ▸ Kỳ lương ▸ Tạo kỳ`

| Ô nhập | Nhập gì | Ví dụ |
|---|---|---|
| Tên kỳ | Nhãn duy nhất | `2026-06` |
| Từ ngày / Đến ngày | Khoảng tính công | `2026-06-01` → `2026-06-30` |
| Ngày trả lương | Dùng để chọn chính sách & hồ sơ thuế hiệu lực | `2026-07-05` |
| Ngày công chuẩn | Mặc định toàn kỳ | `22` |

→ Kỳ tạo ra ở trạng thái **`open`**.

### 2.2 Phụ cấp / Thưởng / Khấu trừ — `Lương ▸ [Chọn nhân viên]`

**Phụ cấp** (`Phụ cấp`): khoản cộng đều hàng tháng.

| Ô | Nhập gì | Ví dụ |
|---|---|---|
| Loại giá trị | `fixed` (số tiền) hoặc `percentage` (% lương HĐ) | `fixed` |
| Số tiền | Giá trị | `730.000` (ăn trưa) |
| Chịu thuế? | Cộng vào thu nhập tính thuế | Ăn trưa → ❌ |
| Tính vào nền BH? | Cộng vào nền đóng BH | thường ❌ |
| Hiệu lực từ / đến | Khoảng áp dụng (đến = trống = vô thời hạn) | `2026-01-01` / — |

**Thưởng** (`Thưởng`): theo từng kỳ — gắn với kỳ lương cụ thể.

| Ô | Nhập gì | Ví dụ |
|---|---|---|
| Kỳ lương | Chọn kỳ | `2026-06` |
| Số tiền | Giá trị | `2.000.000` |
| Chịu thuế? | — | ✅ |

**Khấu trừ** (`Khấu trừ`): tạm ứng, phạt… trừ **sau thuế**.

| Ô | Nhập gì | Ví dụ |
|---|---|---|
| Loại | `fixed` / `percentage` (% gross) | `fixed` |
| Số tiền | Giá trị | `500.000` |
| Kỳ lương | Trống = áp mọi kỳ; chọn kỳ = chỉ kỳ đó | `2026-06` |

### 2.3 Hồ sơ thuế nhân viên — `Lương ▸ [Nhân viên] ▸ Hồ sơ thuế`

| Ô | Nhập gì | Ví dụ |
|---|---|---|
| Số người phụ thuộc | Để tính giảm trừ | `1` |
| Người cư trú? | Cư trú = lũy tiến; không = thuế phẳng | ✅ |
| Hiệu lực từ | — | `2026-01-01` |

> Vì TNCN đang **tắt**, hồ sơ thuế chưa ảnh hưởng số tiền (thuế = 0), nhưng nên nhập sẵn để khi bật thuế là tính đúng.

### 2.4 Đánh giá tháng — `Đánh giá ▸ Đánh giá tháng` (cho official, probation, intern ≥11 công)

Nhập **điểm hiệu suất** (0–100) và **điểm mục tiêu** (0–100), rồi **Duyệt**. Đây là phần 60% + 20% của công thức.

| Ô | Nhập gì | Ví dụ |
|---|---|---|
| Nhân viên / Kỳ | — | A / `2026-06` |
| Điểm hiệu suất | 0–100 | `90` |
| Điểm mục tiêu | 0–100 | `100` |
| Trạng thái | Phải `approved`/`acknowledged` | ✅ Duyệt |

> ⚠️ Nếu official/probation **chưa có đánh giá duyệt**, tính lương sẽ báo lỗi `PAY_EVAL_REQUIRED` cho người đó.

### 2.5 Chấm công cả tháng — `Chấm công ▸ Bảng công`

Đảm bảo mọi ngày đã có trạng thái: đi làm / nghỉ phép / nghỉ không lương / vắng / lễ. **Không để `incomplete`** (thiếu check-out) — sẽ không được tính cho đến khi HR sửa.

---

## 3. CHỐT CÔNG → TÍNH → DUYỆT → THANH TOÁN

```
[open] ──chốt công──▶ [open+đã khóa] ──tính──▶ draft ──duyệt──▶ [processing] ──thanh toán──▶ [paid]
```

### Bước A — Chốt chấm công · `Kỳ lương ▸ … ▸ Chốt chấm công`
- Bấm **Kiểm tra sẵn sàng** (attendance-readiness) để xem ai còn thiếu công.
- Bấm **Chốt chấm công** → khóa số liệu, không đổi giữa chừng. **Bắt buộc trước khi tính.**

### Bước B — Tính lương · `Kỳ lương ▸ … ▸ Tính lương`
- **Tính cả kỳ** (mọi nhân viên active) hoặc **tính 1 người**.
- Tạo các dòng lương trạng thái **`draft`**. Chạy lại chỉ ghi đè draft (an toàn).
- Lỗi từng người được gom lại trong kết quả, không chặn cả kỳ.

### Bước C — Soát số · `Kỳ lương ▸ … ▸ Tổng hợp / Xuất Excel`
- Xem `totals`, `preflight`, hoặc xuất file đối chiếu.

### Bước D — Duyệt · `Kỳ lương ▸ … ▸ Duyệt` (HR/Admin)
- `draft → approved`, kỳ chuyển `open → processing`.
- Cần sửa? **Revert** 1 dòng `approved → draft` rồi tính lại.

### Bước E — Thanh toán · `Kỳ lương ▸ … ▸ Đánh dấu đã chi` (**chỉ Admin**)
- `approved → paid`, kỳ khóa lại (`paid`). Phải duyệt hết draft trước.

---

## 4. VÍ DỤ CỤ THỂ — 3 nhân viên trong kỳ `2026-06`

**Dữ liệu nền (mục 1):** Mức BH = 577.500 · Đoàn phí 1% (55.000) · TNCN tắt · Ngày công chuẩn = 22.

### 👤 Nhân viên A — Chính thức

| Nhập ở đâu | Giá trị |
|---|---|
| Hợp đồng ▸ Tình trạng | `official` |
| Hợp đồng ▸ Lương cơ bản | `20.000.000` |
| Đánh giá tháng | hiệu suất `100`, mục tiêu `100`, đã duyệt |
| Chấm công | đủ 22 công (ratio = 1) |

**Kết quả tính:**
```
Lương theo công = 20% + 60%×100% + 20%×100% (×20tr) = 20.000.000
Gross           = 20.000.000
BH nhân viên    = 577.500        (số cố định)
Đoàn phí        = 55.000         (1% × 5.500.000)
Thuế TNCN       = 0              (đang tắt)
Net             = 20.000.000 − 577.500 − 55.000 = 19.367.500
```

### 👤 Nhân viên B — Thử việc

| Nhập ở đâu | Giá trị |
|---|---|
| Hợp đồng ▸ Tình trạng | `probation` |
| Hợp đồng ▸ Lương cơ bản | `20.000.000` |
| Đánh giá tháng | hiệu suất `100`, mục tiêu `100`, đã duyệt |
| Chấm công | đủ 22 công (ratio = 1) |

**Kết quả tính:**
```
Base hiệu lực = 20.000.000 × 85% = 17.000.000
Lương theo công = 20/60/20 trên 17tr (đủ điểm, đủ công) = 17.000.000
Gross           = 17.000.000
BH / Đoàn phí   = 0  (thử việc không đóng)
Thuế            = 0
Net             = 17.000.000
```

### 👤 Nhân viên C — Thực tập

Lương HĐ `8.000.000`, ngày công chuẩn 22.

**Trường hợp C1 — đi làm 8 ngày (< 11 công):** tính theo ngày công.
```
Lương = 8.000.000 × (8 / 22) = 2.909.091
Gross = Net = 2.909.091   (không BH, không thuế)
```

**Trường hợp C2 — đi làm 22 ngày (≥ 11 công):** áp 20/60/20 (cần đánh giá tháng).
```
Đánh giá: hiệu suất 100, mục tiêu 100 → Lương = 8.000.000
Gross = Net = 8.000.000
```

> 📌 Ngày công của thực tập = **ngày làm + ngày lễ** (công ty chưa có phép có lương cho thực tập).

---

## 5. SỰ CỐ THƯỜNG GẶP & CÁCH XỬ LÝ

| Báo lỗi / Hiện tượng | Nguyên nhân | Xử lý |
|---|---|---|
| `PAY_ATT_NOT_LOCKED` | Chưa chốt chấm công | Bước A — Chốt chấm công |
| `PAY_EVAL_REQUIRED` | official/probation/intern≥11 chưa có đánh giá duyệt | Nhập + duyệt đánh giá tháng |
| `Active contract not found` | Nhân viên không có HĐ `active` | Tạo/kích hoạt hợp đồng |
| `Salary policy config not found` | Chưa có chính sách hiệu lực trước ngày trả | Tạo chính sách lương |
| `PAY_ALREADY_FINALIZED` | Dòng lương đã duyệt/đã chi | Revert về draft rồi tính lại |
| `PAY_DRAFT_REMAINING` | Còn dòng chưa duyệt khi thanh toán | Duyệt hết trước khi mark-paid |
| Lương intern bị thấp bất thường | Bị tính 20/60/20 nhưng thiếu điểm đánh giá | Kiểm tra số ngày công & điểm đánh giá |
| Thuế ra số > 0 | Chính sách đang **bật** TNCN | Tắt "Tính thuế TNCN" trong chính sách |

---

## 6. CHECKLIST TRƯỚC KHI CHẠY MỘT KỲ

- [ ] Có chính sách lương hiệu lực trước ngày trả (mục 1.1)
- [ ] Mọi nhân viên có HĐ `active` đúng tình trạng & lương (mục 1.2)
- [ ] Đã nhập phụ cấp/thưởng/khấu trừ cần thiết cho kỳ (mục 2.2)
- [ ] Đã nhập & duyệt đánh giá tháng (official/probation/intern≥11) (mục 2.4)
- [ ] Chấm công đủ, không còn `incomplete` (mục 2.5)
- [ ] **Đã chốt chấm công** (bước A)
- [ ] Tính → soát số → duyệt → thanh toán (bước B→E)

---

*Cập nhật theo cấu hình & logic tại thời điểm tạo tài liệu. Khi đổi quy tắc tính lương, cập nhật cả `PAYROLL-FORMULA.md` và file này.*
