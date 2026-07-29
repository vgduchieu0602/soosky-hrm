# Backend: Soosky HRM

## Kiến trúc

Hexagonal / Ports-and-Adapters + DDD, **modular monolith** — dựng theo đúng khuôn dự án `soosky-workspace-api`. Mỗi module tách được thành service riêng.

## Tech Stack

- Language: TypeScript (strict)
- Framework: Express 5
- Database: MongoDB qua **raw `mongodb` driver v7** (KHÔNG Mongoose)
- ID: **UUID v7** (string)
- Validation: `bodySchema`/`field` thủ công (`@shared/adapters/driver/http/validation`) — KHÔNG Zod
- Logging: `console` — KHÔNG Pino
- Test: Vitest (+ vitest-mock-extended, supertest). Test ở `tests/**/*.test.ts`.
- Package manager: npm

## Cấu trúc

```
src/
├── server.ts            # entry HTTP (composition root)
├── cli.ts               # entry CLI (bootstrap super admin, ...)
├── infra/               # config, db, di (factory thủ công), events, server
├── shared/              # kernel: core/domain (Entity/AggregateRoot/DomainEvent/EventBus),
│                        #         core/app/errors, adapters/driver/http (validation, ActorContext,
│                        #         authenticate, errorHandler), ports
└── modules/
    ├── auth/            # TÁI DÙNG NGUYÊN từ soosky-workspace-api — account + session
    ├── iam/             # RBAC: roles, permissions, user-role, audit; consume auth events → user projection
    ├── department/      # phòng ban (cây) + vị trí
    ├── employee/        # hồ sơ nhân viên + hợp đồng/tài liệu/...
    ├── attendance/      # ca, chấm công, nghỉ phép
    ├── payroll/         # kỳ lương, tính lương, phiếu lương
    └── setting/         # cấu hình công ty/hệ thống
```

## Anatomy 1 module (theo auth/task-mgmt)

```
modules/<m>/
  index.ts                       # barrel công khai (chỉ export ở đây mới cross-module)
  core/
    domain/  entities/ value-objects/ errors/ events/
    app/     use-cases/ (1 class/use-case, execute()) ports/ errors/ services/
  adapters/
    driver/  http/ (controllers/ presenters/ index.ts=router) cli/ events/
    driven/  persistence/mongodb/ (repositories/ mappers/ documents/ MongoRepository MongoUnitOfWork collections.ts index.ts) security/ mail/
```

## Quy ước (BẮT BUỘC theo dự án gốc)

- 1 class / use-case, `execute(input)`, Input/Output đồng vị trí, JSDoc `@throws` tiếng Việt.
- Lỗi 3 tầng: `DomainError` (422/409) / `ApplicationError` (404/403) / `HttpRequestError` (400/401) → envelope `{ code, message }`. Success KHÔNG bọc envelope.
- Mapper + Document + `rehydrate`; id UUIDv7; collection tiền tố module (`iam_`, `org_`/`dept_`, `pay_`, `att_`, `emp_`, `set_`).
- `MongoRepository` base + `MongoUnitOfWork` cho multi-write.
- Liên-module CHỈ qua `EventBus`; hợp đồng event khai báo lại cục bộ ("published language"), KHÔNG import chéo module.
- File = tên export (PascalCase); private prefix `_`; format căn cột; mô tả tiếng Việt, identifier tiếng Anh.
- Path aliases: `@modules/*`, `@shared/*`, `@infra/*`, `@tests/*`.
- Mỗi repo có `static ensureIndexes(db)`, gom trong `infra/db/ensureMongoIndexes.ts`.
- Thêm module: tạo `modules/<m>/`, export router + `<M>HttpUseCases` từ `index.ts`, thêm DI factory `infra/di/`, mount trong `createExpressServer.ts` + `server.ts`, thêm ensureIndexes.

## Tài liệu

- `../share-docs/{api.html, use-cases.html, events.html, er-diagram.md}` — canonical, tự chứa.

## Scripts

`npm run dev` · `npm run build` (tsc && tsc-alias) · `npm start` · `npm test` · `npm run cli`
