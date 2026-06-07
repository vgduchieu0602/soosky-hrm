# Kế hoạch dự án — Module Attendance (FULL) → Demo Thứ Sáu 08:00

**Phương án:** C — Làm full module, demo giữ 08:00 sáng thứ Sáu (không lùi).
**Người làm:** 1 mình.
**Quỹ thời gian:** Thứ Tư + Thứ Năm (~20h). Thứ Sáu KHÔNG có giờ làm trước demo.

> ⚠️ CẢNH BÁO: Lịch này rất căng, gần như không buffer. Mọi việc nối tiếp (DB → API → Test → UI), trễ một khâu là đổ cả dây. Bám đúng mốc giờ là điều kiện sống còn.

---

## 🔗 Chuỗi phụ thuộc (Critical Path)

```
[Thiết kế DB] → [Viết API] → [Test API] → [Tạo UI] → [DEMO Thứ Sáu 08:00]
```

🎯 **Mốc bắt buộc cuối Thứ Tư:** DB xong + API cốt lõi chạy được.
🎯 **Mốc bắt buộc cuối Thứ Năm:** Toàn bộ API + Test + UI xong, đã dry-run.

---

## 📅 THỨ TƯ — DB + Toàn bộ API

| Khung giờ | Việc | Loại |
|-----------|------|------|
| 08:00 – 08:10 | Setup + chốt danh sách entity/endpoint của full module | Setup |
| 08:10 – 11:00 | 🔵 Thiết kế DB attendance (chốt schema sớm — mở khoá cả chuỗi) | Deep work |
| 11:00 – 11:15 | 🌿 Nghỉ giải lao | Buffer |
| 11:15 – 12:00 | 🔵 Viết API khối 1 — check-in / check-out | Deep work |
| 12:00 – 13:00 | 🍜 Nghỉ trưa | Nghỉ |
| 13:00 – 15:00 | 🔵 Viết API khối 2 — list / filter / sửa-xoá | Deep work |
| 15:00 – 15:15 | 🌿 Nghỉ giải lao | Buffer |
| 15:15 – 17:30 | 🔵 Viết API khối 3 — báo cáo / tổng hợp / phần còn lại | Deep work |
| 17:30 – 18:00 | 🪟 Seed dữ liệu mẫu + ghi chú việc còn dở | Dự phòng |

---

## 📅 THỨ NĂM — Test + UI + Dry-run

| Khung giờ | Việc | Loại |
|-----------|------|------|
| 08:00 – 09:00 | 🔵 Hoàn tất API còn sót (nếu có) | Deep work |
| 09:00 – 10:30 | 🟣 Test API toàn bộ + fix bug → API "ổn" | Quan trọng |
| 10:30 – 10:45 | 🌿 Nghỉ giải lao | Buffer |
| 10:45 – 12:00 | 🟠 UI khối 1 — màn chấm công + nối API thật | Deep work |
| 12:00 – 13:00 | 🍜 Nghỉ trưa | Nghỉ |
| 13:00 – 15:30 | 🟠 UI khối 2 — danh sách + báo cáo + hoàn thiện | Deep work |
| 15:30 – 15:45 | 🌿 Nghỉ giải lao | Buffer |
| 15:45 – 16:45 | 🟣 Test xuyên suốt (E2E) cả luồng UI ↔ API | Quan trọng |
| 16:45 – 17:30 | 🎬 DRY-RUN demo + chuẩn bị dữ liệu/kịch bản | Demo prep (BẮT BUỘC) |
| 17:30 – 18:00 | 🛑 Fix bug cuối — KHÔNG để code dở qua đêm trước demo | Dự phòng (sống còn) |

---

## 📅 THỨ SÁU

| 08:00 | 🎬 DEMO FULL MODULE cho khách hàng |

---

## 🛡️ Quy tắc sống còn

1. ⭐ Chốt DB schema trong sáng Thứ Tư — trễ là đổ cả chuỗi.
2. 🌱 Seed dữ liệu mẫu từ Thứ Tư để demo mượt, không nhập tay lúc 8h sáng.
3. 🎬 BẮT BUỘC dry-run chiều Thứ Năm — demo lỗi thường do chưa chạy thử.
4. 🛑 Cuối Thứ Năm phải để code ở trạng thái chạy được — không commit dở dang qua đêm.
5. ⚡ Bám đúng mốc giờ. Nếu cuối Thứ Tư API chưa cốt lõi xong → kích hoạt ngay kế hoạch B (xin lùi demo).
6. ✂️ Trong "full" vẫn ưu tiên thứ tự: luồng chính chạy được trước, tính năng phụ làm sau — để nếu hụt giờ vẫn có cái demo.

## 🆘 Tín hiệu cần báo khách sớm
- Nếu hết Thứ Năm trưa mà API chưa test xong → chủ động xin lùi demo, đừng đợi 8h sáng mới báo.
