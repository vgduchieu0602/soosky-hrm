# Shared contracts — Soosky HRM

## Context

Thư mục này là hợp đồng chung giữa `backend/` và `frontend/` cho HRM v1.

## Problem

Các file HTML hiện có là tài liệu lịch sử và có nội dung của những phiên bản khác nhau. Chúng không còn đủ tin cậy để quyết định endpoint hoặc schema khi triển khai.

## Key Learning

Source of truth về hành vi đang chạy là router, controller, presenter, DI factory và Mongo repository trong `backend/src`. Hai hợp đồng Markdown dưới đây chuẩn hoá phạm vi cần khớp với frontend.

Từ 2026-08: bản kê route `api-routes.json` được SINH RA từ chính file router
(`backend/tests/infra/route-manifest.test.ts`), và frontend có test đối chiếu mọi lời gọi
`api.*` với bản kê đó (`frontend/src/core/http/api-contract.test.ts`). Nhờ vậy lệch contract
làm đỏ test thay vì ra 404 lúc chạy.

## Decision

- Dùng [API-SPEC.md](API-SPEC.md) và [DATABASE.md](DATABASE.md) cho mọi thay đổi full-stack mới.
- `api-routes.json` là bản kê route do backend sinh; không sửa tay, chạy lại
  `backend/tests/infra/route-manifest.test.ts` để cập nhật.
- `api.html`, `events.html`, `use-cases.html`, `er-diagram.md` được giữ để tham khảo lịch sử, không được dùng để tự suy diễn endpoint.
- Phạm vi hiện tại gồm **bảy** module: Auth/IAM, Department, Employee, Attendance, Payroll,
  **Performance** và Setting.
- **Performance đã có backend + frontend + luồng snapshot sang Payroll** (không còn là UI
  không có backend như bản plan ban đầu): chu kỳ đánh giá gắn kỳ lương, bộ tiêu chí có phiên
  bản BẤT BIẾN, phiếu theo luồng chấm → HR duyệt → nhân viên xác nhận/khiếu nại → khoá điểm.
  Điểm sang Payroll CHỈ một chiều qua `PayrollEvaluationSink.snapshotEvaluation` lúc khoá
  phiếu; Payroll lưu bản chụp trong `PayrollPeriod.evaluations` và không đọc lại phiếu khi
  tính lương, nên sửa tiêu chí không làm đổi lương đã tính.

## Action Items

- Cập nhật hai tài liệu hợp đồng cùng pull request khi thay đổi route, payload hoặc collection.
- Tuân theo các lát triển khai trong [CLAUDE-EXECUTION-PLAN.md](CLAUDE-EXECUTION-PLAN.md).
- Khi tách module sang Workspace, tuân theo [MODULE-PORTABILITY.md](MODULE-PORTABILITY.md).

## Related Notes

- [[API-SPEC]]
- [[DATABASE]]
- [[CLAUDE-EXECUTION-PLAN]]
- [[MODULE-PORTABILITY]]
