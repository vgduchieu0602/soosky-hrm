# Backend code standard — HRM v1

## Context

Chuẩn này được rút từ `C:\Code\Project\Soosky-backend\soosky-workspace-api` và đối chiếu với cấu trúc hiện có của `backend/`. HRM đã cùng hướng kiến trúc với dự án tham chiếu: module hexagonal, composition root và native MongoDB adapter.

## Problem

Khi Claude sửa theo từng màn hình frontend, rất dễ đưa logic nghiệp vụ vào controller, import chéo internals của module khác hoặc tạo abstraction chỉ dùng một lần. Các lỗi đó làm HRM lệch style dự án tham chiếu dù code vẫn compile.

## Key Learning

Một feature đúng chuẩn đi theo đường: `domain → port → use-case → Mongo adapter → HTTP controller/presenter/router → DI factory`. Chỉ `infra/di` được ghép concrete adapter giữa các module.

## Decision

### Quy tắc bắt buộc

- `core/domain` không import Express, MongoDB hay adapter.
- Use case chỉ phụ thuộc port/interface; nhận actor id rõ ràng, tự kiểm tra authorization và invariant.
- Cross-module chỉ qua public export/facade/port (`createXxxDirectory`, `createIamAccessControl`) hoặc event bus; không import repository/entity nội bộ module khác.
- Controller parse/validate request, lấy actor context, gọi use case và trả qua presenter. Không đặt business decision trong controller.
- Router module là nơi duy nhất khai báo routes; dùng `json()`, `authenticate()` khi cần, rồi `errorHandler`.
- Mapper chuyển domain ↔ Mongo document; repository chứa query Mongo; index được đăng ký trong static `ensureIndexes()` và tập hợp tại `infra/db/ensureMongoIndexes.ts`.
- `server.ts` chỉ load config, connect DB, đăng ký event consumer, tạo DI và start/stop HTTP server.

### Convention code

- Dùng TypeScript strict, path alias `@modules`, `@shared`, `@infra`.
- Giữ import có thứ tự ổn định; private field dùng prefix `_`; khai báo return type cho public method/function theo pattern sẵn có.
- Ưu tiên entity/value object immutable-by-interface và factory `create`/`rehydrate` theo module hiện hữu.
- API response chỉ xuất presenter DTO, không `res.json(domainEntity)`.
- Mutation có ý nghĩa vận hành phải ghi audit/event theo pattern module; không thêm outbox/event nếu feature không có consumer hay requirement rõ ràng.

### Không được làm trong HRM v1

- Không đổi sang Mongoose, NestJS, CQRS, generic repository hoặc tạo base controller/service “dùng chung” chỉ để đẹp.
- Không thêm endpoint để khớp mock frontend; sửa frontend theo router backend trước.
- Performance đã là module riêng (bảy module). Không nối Payroll trực tiếp vào dữ liệu Performance: chỉ dùng snapshot điểm đã khoá và port `EvaluationDirectory` (chỉ trả tiến độ).
- Không refactor hàng loạt file không chạm acceptance criterion của lát đang làm.

### Test tối thiểu

- Use case mới/đổi rule: unit test happy path + not-found/authorization/domain rule liên quan.
- Route bị sửa: một smoke/integration test dùng HTTP contract thật.
- Chỉ mock port, không mock entity/value object khi test business rule.

## Action Items

- Claude phải đọc file này cùng [API-SPEC.md](API-SPEC.md) trước mỗi lát.
- Codex review kiểm tra dependency direction, router/presenter/DI wiring và test evidence trước khi nhận lát tiếp.

## Related Notes

- [[API-SPEC]]
- [[DATABASE]]
- [[CLAUDE-EXECUTION-PLAN]]
