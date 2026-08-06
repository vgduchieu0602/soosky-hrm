# Core portability contract — HRM modules

## Context

Auth, Attendance, Department, Employee, IAM, Payroll và Setting được thiết kế để có thể mang sang Soosky Workspace sau này mà không kéo theo Express, MongoDB hay package runtime của HRM.

## Problem

Nếu business core import trực tiếp database, HTTP framework, Node API hoặc module khác, việc tách/ghép sang Workspace sẽ thành một đợt rewrite thay vì tái sử dụng module.

## Key Learning

`core` có thể phụ thuộc vào shared kernel thuần TypeScript, nhưng không được phụ thuộc adapter. Dữ liệu/liên kết từ module khác được mô tả bằng port cục bộ và được nối ở composition root của host application.

## Decision

### Dependency rule

Trong `backend/src/modules/<module>/core/**` chỉ được import:

- chính module đó: `@modules/<module>/core/**`;
- shared kernel portable: `@shared/core/**` và `@shared/ports/**`;
- TypeScript/JavaScript standard language features.

Không được import `mongodb`, `express`, `uuid`, `node:*`, mail/storage client, `@infra/**`, `adapters/**`, hay `@modules/<module-khác>/**`.

### Thành phần được mang sang Workspace

```text
modules/<module>/core/
  domain/       entities, value objects, domain services/events/errors
  app/          use cases, ports, app services/errors
shared/core/    Entity, AggregateRoot, errors, EventBus contract, UuidV7
shared/ports/   abstraction thật sự dùng chung (ví dụ UnitOfWork)
```

Không mang theo `adapters/`, Mongo document/mapper/repository, HTTP router/controller/presenter, `infra/di`, hay `composition.ts` của HRM. Workspace tạo adapter và DI composition root riêng để implement các port.

### Cross-module contracts hiện có

| Consumer core | Port cục bộ | Host application nối với |
| --- | --- | --- |
| Attendance | `EmployeeDirectory`, `PermissionChecker`, `EventBus` | Employee, IAM, event bus của host |
| Auth | `AccountRepo`, `UnitOfWork`, `PasswordHasher`, `RandomSecretGenerator`, token/mailer ports | persistence, crypto, token và mail adapter của host |
| Employee | `OrgDirectory`, `PermissionChecker` | Department, IAM |
| Payroll | `EmployeeDirectory`, `AttendanceDirectory`, `PermissionChecker`, `UnitOfWork`, `EventBus` | Employee, Attendance, IAM, persistence/event adapter |
| Department / IAM / Setting | repository/permission/unit-of-work ports | persistence và IAM adapter của host |

`UuidV7` trong shared core hiện là TypeScript thuần, thay thế toàn bộ `uuid` package trong core bảy module. Riêng entropy an toàn (ví dụ mật khẩu khởi tạo) phải đi qua port; host Node.js có thêm adapter `CryptoRandomSecretGenerator` dùng `node:crypto`.

## Action Items

- Mỗi use case mới phải nhận integration qua port; không import adapter hay module khác.
- Mỗi dependency mới phải được kiểm tra bằng danh sách allow-list phía trên trước khi merge.
- Khi chuyển sang Workspace, copy core + shared kernel trước, sau đó viết adapter/DI của Workspace và chạy lại unit test core.

## Related Notes

- [[BACKEND-CODE-STANDARD]]
- [[API-SPEC]]
- [[DATABASE]]
