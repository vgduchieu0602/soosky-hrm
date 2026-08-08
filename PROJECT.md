# Soosky HRM

## Tên dự án

**Soosky HRM** — Nền tảng quản trị nhân sự (Human Resource Management) cấp doanh nghiệp.

## Mục tiêu

Số hóa và tự động hóa toàn bộ nghiệp vụ nhân sự trong một hệ thống thống nhất: từ hồ sơ nhân viên, chấm công, nghỉ phép, đánh giá hiệu suất đến tính lương. Mục tiêu là để dữ liệu chảy liền mạch giữa các khâu — chấm công và hiệu suất tự động tính ra lương — giảm thao tác thủ công và sai sót cho bộ phận HR.

## Đối tượng sử dụng

- **Admin** — quản trị hệ thống, phân quyền, cấu hình, kiểm toán.
- **HR / Quản lý nhân sự** — quản lý nhân viên, phòng ban, chấm công, duyệt nghỉ phép, chạy lương, đánh giá.
- **Nhân viên** — tự phục vụ: xem hồ sơ, chấm công của mình, gửi đơn nghỉ, xem phiếu lương, xem đánh giá.

## Business chính

- Quản lý vòng đời nhân viên (tuyển vào → làm việc → nghỉ việc) cùng hợp đồng, hồ sơ, tài liệu.
- Chấm công tự tính công theo giờ vào/ra và ca làm; quản lý nghỉ phép có hạn mức, phép năm cộng dồn.
- Đánh giá hiệu suất định kỳ theo bộ tiêu chí.
- Tính lương dựa trên chấm công + hiệu suất; bảo hiểm/phụ cấp/khấu trừ là số cấu hình để ra Gross ↔ Net.
- Dashboard tổng quan cho HR: KPI, phân bố nhân sự, tình hình chấm công, đơn nghỉ, lương, top performers.

## Các module

| Module                     | Vai trò                                                                                                        |
|----------------------------|----------------------------------------------------------------------------------------------------------------|
| **IAM**                    | Người dùng, vai trò, quyền, phiên đăng nhập, JWT, kiểm toán (audit log)                                        |
| **Organization**           | Phòng ban (dạng cây), vị trí công việc                                                                         |
| **Employee**               | Nhân viên + hồ sơ, tài liệu, hợp đồng, liên hệ, tài khoản ngân hàng, lịch sử, tài sản; vòng đời nhân sự; nhập/xuất CSV; cấp tài khoản đăng nhập |
| **Attendance**             | Ca làm, chấm công, đơn nghỉ phép, duyệt nghỉ, hạn mức phép, ngày lễ                                            |
| **Payroll**                | Kỳ lương, cấu trúc lương, tính lương, phiếu lương, phụ cấp/khấu trừ                                            |
| **Performance**            | Chu kỳ đánh giá, tiêu chí, chấm điểm, phản hồi                                                                 |
| **Settings**               | Cấu hình hệ thống (công ty, người dùng, vai trò, kiểm toán)                                                    |
| **Dashboard**              | Báo cáo tổng hợp read-only + hành động nhanh (duyệt nghỉ)                                                      |
| **Notification / Storage** | Thông báo trong app, email; lưu trữ tệp (S3-compatible)                                                        |

## Vòng đời nhân viên

```
Onboarding → Thử việc → Đang làm việc
                 ↓
   Điều chuyển / Đổi chức vụ / Thăng chức / Đổi quản lý / Thay đổi lương
                 ↓
        Nghỉ việc (nguyện vọng | chấm dứt) → Tái tuyển
```

- Trạng thái hiện tại nằm trên `employees` + `employeeContracts`; **mọi thay đổi** ghi thêm một bản ghi bất biến vào `employeeHistories` kèm `effectiveDate`, lý do và người thực hiện. Không ghi đè dữ liệu cũ, không xoá cứng nhân viên.
- **Thử việc** đọc từ hợp đồng đang hiệu lực (`employmentStatus` + `endDate`), không có trường riêng trên `employees`.
- **Thay đổi lương** đóng hợp đồng cũ và lập hợp đồng mới ⇒ kỳ lương đã tính giữ nguyên ảnh chụp lương của kỳ đó.
- **Nghỉ việc** phân biệt `resignation` / `termination` ở tầng sự kiện; `employees.status` chỉ có một giá trị "đã rời công ty" (`terminated`) để không phá vỡ mọi truy vấn của Payroll/Attendance.
- Chặn vòng lặp quản lý ở mọi đường vào (giao diện lẫn nhập CSV).

## Nhập / xuất nhân viên bằng CSV

```
Tải mẫu → điền → tải lên → parse → validate + resolve tham chiếu
   → xem trước (sửa được từng ô/từng dòng) → commit → History + Audit
```

- **Một nguồn cột duy nhất**: `EMPLOYEE_CSV_SCHEMA` (backend). Tệp mẫu, bản xuất, trình nhập, luật kiểm tra và bảng hướng dẫn trên giao diện đều sinh từ đó.
- Tham chiếu bằng **mã** (`department_code`, `position_code`, `manager_employee_code`), không bắt HR biết ObjectId.
- Xem trước **không ghi gì**; commit chỉ chạy khi hết lỗi, đúng checksum, và nằm trong **một giao dịch**.
- Quản lý có thể trỏ tới nhân viên cũng đang được tạo trong cùng tệp (hai lượt ⇒ thứ tự dòng không quan trọng).
- Nhập đi qua đúng use-case nhân viên ⇒ vẫn sinh lịch sử + audit như thao tác tay.
- Chi tiết cột và quy ước: `share-docs/API-SPEC.md` §Employee CSV import / export.

## Tech Stack

- **Kiến trúc:** Monolith tổ chức theo feature, tách 2 ứng dụng deploy độc lập (Backend API + Frontend web).
- **Frontend:** React 19 + Vite, TypeScript, TanStack Query (server state), Zustand (auth/UI), Tailwind CSS, React Router v7, Axios, React Hook Form + Zod.
- **Backend:** Node.js + Express, TypeScript, Mongoose (MongoDB, replica set cho transaction), Zod (validation), Pino (log), JWT (access + refresh).
- **Database:** MongoDB.
- **Package manager:** pnpm.
- **Test:** Jest + Supertest + mongodb-memory-server (BE); Vitest + React Testing Library (FE).

## Nguyên tắc phát triển

- **Feature-based + Clean Architecture:** mỗi module tự chứa theo 4 lớp `domain/ (+ports) → application/ → infrastructure/ → interfaces/`, ráp bằng `container.ts` (composition root) và lộ ra qua public `index.ts`. Không import chéo nội bộ giữa các feature — chỉ qua public `index.ts`, shared kernel, hoặc event bus. Khuôn mẫu tham chiếu: `backend/src/features/attendance/CONTEXT.md`.
- **Dependency rule hướng vào trong:** `interfaces`/`infrastructure` phụ thuộc `application` phụ thuộc `domain`. Domain thuần (không Express/Mongoose); use-case chỉ phụ thuộc ports (interface); adapter Mongoose/S3/mail hiện thực ports. Đổi tech chỉ sửa `container.ts`.
- **Model dùng chung** ở `shared/models`; tiền dùng `Decimal128`, số điện thoại/tài khoản dùng `String`.
- **Validation bằng Zod** ở biên (middleware), không validate trong service.
- **Bảo mật:** JWT access ngắn hạn + refresh xoay vòng; RBAC theo role/permission — server luôn là nguồn enforce, UI chỉ gating cho trải nghiệm. Bắt buộc đổi mật khẩu lần đầu.
- **Không hard-delete nhân sự** — dùng trạng thái (`terminated`). Ghi audit log cho thao tác thay đổi.
- **Frontend:** server state qua TanStack Query (không nhét data API vào Zustand); state lọc/phân trang qua URL; form dùng React Hook Form + Zod; feedback dùng Toast.
- **Chất lượng:** typecheck + test phải sạch trước khi merge; theo pattern sẵn có trong codebase; đọc tài liệu module (`CLAUDE.md`, `docs/`) trước khi sinh code.

## Cấu trúc thư mục

```
├── backend/       # Express API (@backend/CLAUDE.md)
├── frontend/      # React web client (@frontend/CLAUDE.md)
└── share-docs/    # Tài liệu dùng chung (API spec, database schema)
```
