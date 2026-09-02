# Soosky HRM — Conventions & Project Standards

> Coding standards, folder structure, and architectural rules for the Soosky HRM backend.
> All contributors (human + AI assistants) MUST follow this document.

---

## Tech Stack

- **Language:** TypeScript (strict mode)
- **Runtime:** Node.js (LTS)
- **Framework:** Express.js
- **ODM:** Mongoose
- **Database:** MongoDB (replica set required — transactions are used)
- **Validation:** Zod
- **Auth:** JWT (access + refresh) with `bcryptjs` for password hashing
- **Logging:** Pino (structured logs)
- **Testing:** Vitest + Supertest (+ `mongodb-memory-server` for integration)

---

## 1. Module Structure

The backend is a **modular monolith**. Three business modules sit on a shared
`infra` / `shared` base:

```
src/
├── server.ts                        # bootstrap: connect DB, register listeners/jobs, listen
├── infra/                           # application-wide infrastructure
│   ├── config.ts                    # Zod-validated process.env
│   ├── jwt.config.ts                # JWT secrets, issuer/audience, TTLs
│   ├── db/mongoose.ts               # connect/disconnect lifecycle
│   ├── logger/logger.ts             # Pino root logger
│   ├── events/event-bus.ts          # typed EventEmitter wrapper
│   ├── mail/                        # SMTP transport + templates
│   └── server/createExpressServer.ts # Express app factory (testable)
├── shared/                          # ONLY what 2+ modules use
│   ├── http/                        # authenticate, requireRoles, requirePermission, validate, errorHandler
│   ├── errors/                      # HttpError, NotFoundError, ForbiddenError
│   ├── crypto/hash.util.ts          # bcrypt + token hashing
│   ├── types/                       # AuthPayload, JWT payloads, Response<T>, Paginated<T>
│   ├── utils/pagination.util.ts
│   └── testing/http.ts              # supertest + mongodb-memory-server harness
└── modules/
    ├── auth/                        # authentication
    ├── iam/                         # authorization
    └── hrm/                         # human-resource business
```

Every module has the same three parts:

```
modules/[module]/
├── core/                            # framework-free: no Express, no Mongoose
│   ├── domain/                      # entities, value types, pure rules
│   └── app/
│       ├── ports/                   # the abstractions use-cases depend on
│       ├── use-cases/               # one class per area, constructor-injected ports
│       └── dto/                     # Zod schema + inferred type
├── adapters/                        # everything that touches the outside world
│   ├── http/                        # routes + controllers
│   ├── persistence/                 # Mongoose schemas + repositories/gateways
│   └── container.ts                 # composition root — the ONLY place adapters are constructed
├── tests/
└── index.ts                         # the module's public API — nothing else is importable
```

**HRM is one business module, not six.** Employee, Attendance, Payroll,
Performance, Organization, Settings and Period are **sub-domains inside HRM** —
folders under `core/`, sharing one `adapters/` tree, one composition root and
one `index.ts`:

```
modules/hrm/
├── core/[sub-domain]/{domain,app,dto}/    # employee, attendance, payroll, performance,
│                                          # organization, settings, period, dashboard,
│                                          # notification, storage
├── adapters/
│   ├── http/[sub-domain]/                 # controllers + routes
│   ├── persistence/mongoose/
│   │   ├── models/                        # one file per HR collection
│   │   └── [sub-domain]/                  # repositories + gateways
│   ├── services/[sub-domain].services.ts  # clock, audit, event-bus, unit-of-work adapters
│   ├── files/ · object-storage/ · jobs/ · listeners/
│   └── container/[sub-domain].ts
├── tests/[sub-domain]/
└── index.ts
```

A sub-domain MUST NOT be promoted to a top-level module without a real reason —
they are organisational folders, not deployment or ownership boundaries.

**Path aliases:** `@/*` → `src/*`, `@infra/*`, `@modules/*`, `@shared/*`.

---

## 2. Naming Conventions

- **Module folders:** `kebab-case` — `auth`, `iam`, `hrm`
- **HRM sub-domain folders:** `kebab-case` — `employee`, `payroll`, `performance`
- **Files:** `kebab-case` — `create-employee.dto.ts`, `user.model.ts`
- **Classes:** `PascalCase` — `EmployeeUseCases`, `MongooseEmployeeRepository`
- **Functions / methods:** `camelCase` — `findById`, `grantLogin`
- **Variables:** `camelCase` — `employeeId`, `payrollPeriod`
- **Constants:** `UPPER_SNAKE_CASE` — `MAX_LEAVE_DAYS`, `ROLE_ADMIN`
- **Interfaces / types:** `PascalCase` — `IUserPayload` (interface), `EmployeeStatusType` (union type)
- **Use-case files:** `[area].usecases.ts` — `payroll-run.usecases.ts`, `department.usecases.ts`
- **Mongoose models:** `PascalCase` singular — `User`, `Employee`, `Payroll`
- **MongoDB collections:** `camelCase` plural — `users`, `employeeProfiles`, `payrollPeriods`
- **MongoDB fields:** `camelCase` — `firstName`, `employeeId`, `lastLoginAt`
- **Timestamps:** `snake_case` — `created_at`, `updated_at` (per DATABASE.md convention)

---

## 3. Module Rules

### What each module answers

| Module | Question it answers | Owns |
| ------ | ------------------- | ---- |
| `auth` | *Who is this user?* | login, logout, refresh, JWT issue/verify, sessions, single-use password-setup links |
| `iam`  | *What may this user do?* | users, roles, permissions, user↔role and role↔permission links, audit log |
| `hrm`  | *The human-resource business* | employee, attendance, payroll, performance, organization, settings, period, dashboard, notification, storage |

`auth` holds **no** authorization logic and **no** HR business logic.
`iam` holds **no** HR business logic — permission keys are plain RBAC strings
(`hrm.employee.read`, `hrm.payroll.approve`), so IAM can serve a second product
unchanged. There is no policy engine, no ABAC, no policy DSL.

### Dependency direction (one-way)

```
hrm  → iam, auth        auth → iam        iam → nothing
shared, infra → no business module
```

- A module is reached **only** through its `index.ts`: `import { auditService } from '@modules/iam'`. Never a deep path.
- `iam` MUST NOT import `auth` or `hrm` — that is what keeps it reusable.
- `shared/` and `infra/` MUST NOT import module internals.
- HRM touches accounts through `iamDirectory` from `@modules/iam`, never IAM's Mongoose models.

These are enforced by `no-restricted-imports` in `eslint.config.mjs`, so a
violation fails `pnpm lint`. Integration tests are exempt — they assert on
persisted state across module boundaries.

### Inside a module

- `core/` MUST NOT import Express, Mongoose, or anything from `adapters/`.
- A use-case depends on **ports** it declares; `adapters/container.ts` is the only place that constructs concrete adapters and injects them.
- Cross-module async reactions go through the event bus (`infra/events/event-bus.ts`): `employee.granted-login`, `payroll.computed`, `leave.approved`, `employee.changed`.
- Code **inside** a module imports concrete files, not its own barrel — the barrel would form an import cycle.

---

## 4. Code Patterns (MUST follow)

### Error handling

```ts
// shared/errors/http-error.ts
export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}
export class NotFoundError extends HttpError {
  constructor(r: string) {
    super(404, `${r} not found`);
  }
}
export class ForbiddenError extends HttpError {
  constructor() {
    super(403, 'Forbidden');
  }
}
```

- Throw typed errors from services; let global error middleware format the response.
- DO NOT call `res.status(...).json(...)` for errors in services.

### Validation (Zod)

```ts
// dto/create-employee.dto.ts
import { z } from 'zod';
export const createEmployeeDto = z.object({
  departmentId: z.string().length(24),
  positionId: z.string().length(24),
  hireDate: z.coerce.date(),
  employeeType: z.enum(['full_time', 'part_time', 'contract', 'intern']),
});
export type CreateEmployeeDto = z.infer<typeof createEmployeeDto>;
```

- One `validate(schema)` middleware parses & coerces `req.body` / `req.query` / `req.params`.
- DO NOT validate inside services.

### Logging

```ts
logger.info({ feature: 'payroll', action: 'compute', periodId, employeeCount });
```

- Use Pino with a child logger per area: `const log = logger.child({ feature: 'payroll', module: 'run' })`.
- Log in **use-cases**, not controllers.

### Response format

- **Success:** `{ data, message?, meta? }`
- **Error:** `{ success: false, error: { code, message } }` — shaped by `shared/http/error-handler.ts`; the HTTP status carries the status
- **Pagination:** `{ data, meta: { page, limit, total, totalPages } }`

### Ports & adapters

A use-case declares what it needs as a **port**; the Mongoose implementation
lives in `adapters/persistence` and is injected by the composition root.

```ts
// core/organization/domain/ports/index.ts
export interface DepartmentRepository {
  findById(id: Id): Promise<Doc | null>;
  countChildren(id: Id): Promise<number>;
  deleteById(id: Id, tx?: Tx): Promise<Doc | null>;
}

// core/organization/app/department.usecases.ts
export class DepartmentUseCases {
  constructor(
    private readonly departments: DepartmentRepository,
    private readonly audit: AuditPort,
    private readonly uow: UnitOfWork,
  ) {}
}

// adapters/persistence/mongoose/organization/department.repository.ts
export class MongooseDepartmentRepository implements DepartmentRepository { /* ... */ }

// adapters/container/organization.ts — the only place that wires them
export const departmentUseCases = new DepartmentUseCases(
  new MongooseDepartmentRepository(), audit, uow,
);
```

- Complex queries (aggregations, `$lookup`, populate chains) MUST live in the adapter, never in a use-case.
- Controllers orchestrate use-cases; use-cases orchestrate ports.
- IDs cross the port boundary as **strings**; the adapter converts to/from `ObjectId`.
- `Tx` is an opaque transaction handle (a Mongoose `ClientSession` underneath) — core never names the Mongoose type.
- Create a port for a real external dependency, not for every collaborator.

---

## 5. Anti-patterns (MUST NOT do)

| ❌ DON'T                                                                | ✅ DO                                                                           |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Deep import across modules — `@modules/iam/adapters/persistence/models/user.model` | `import { auditService, iamDirectory } from '@modules/iam'` (via the module `index.ts`) |
| Business logic in a controller                                          | Controller calls a use-case; the use-case holds the rules                       |
| `Employee.find(...)` in a use-case                                      | The use-case calls a port; the adapter runs the query                           |
| Storing plain passwords                                                 | `bcrypt.hash(password, 10)` before save                                         |
| Referencing current `baseSalary` in `Payroll`                           | Snapshot `baseSalary`, `allowances`, etc. at compute time                       |
| Referencing current `Department` in `EmployeeHistory`                   | Snapshot into `fromValue` / `toValue`                                           |
| Hardcoded values                                                        | Read from `@infra/config` (env via Zod)                                         |
| Express or Mongoose imported inside `core/`                             | Keep it in `adapters/`; core depends on ports only                              |
| Promoting an HRM sub-domain to a top-level module                       | Keep it a folder under `modules/hrm/core/`                                      |
| `modules/iam` importing `auth` or `hrm`                                 | Keep IAM dependency-free — invert via a port or a domain event                  |
| Hard-deleting employees                                                 | Set `status = 'terminated'`, fill `terminationDate`                             |
| `Number` for money                                                      | `Decimal128` (use `mongoose-decimal128` plugin)                                 |
| `Number` for phone / account number                                     | `String` (preserve leading zeros)                                               |

---

## 6. Git Workflow

- **Branch naming:** `[type]/[feature]-[short-description]`
  - `feature/iam-jwt-refresh`
  - `fix/payroll-tax-bracket-calc`
  - `refactor/employee-grant-login`
- **Commit message:** `[type]: [description]`
  - `feat(iam): add refresh token rotation`
  - `fix(payroll): correct insurance cap calculation`
  - `refactor(employee): extract account provisioning to service`
- **PR requirements:**
  - Linked to issue/task
  - All tests pass, no TypeScript errors, `lint` clean
  - At least 1 reviewer approves
  - `share-docs/DATABASE.md` and `docs/BE-ARCHITECTURE.md` updated if structure changes

---

## 7. Testing

- **Runner:** Vitest (`pnpm test`). Globals are on; ambient types come from `vitest/globals`.
- **Location:** inside the owning module — `modules/hrm/tests/payroll/payroll-run.service.spec.ts`, `modules/auth/tests/auth-flow.http.spec.ts`.
- **Naming:** `[name].spec.ts`; HTTP integration specs use `[name].http.spec.ts`.
- **Structure:** `describe → it` with Arrange-Act-Assert.
- **Coverage targets:**
  - Use-cases: **80%+**
  - Controllers: **70%+**
  - Adapters: **60%+**
- **Unit tests:** stub the ports a use-case declares — `vi.fn()` plus `Mocked<Port>` from `vitest`. For a partially-stubbed constructor, type the argument list as `ConstructorParameters<typeof UseCases>` rather than casting to `any`.
- **Integration tests:** use the shared harness `shared/testing/http.ts` — it boots the real Express app over `mongodb-memory-server` and exposes `api`, `startDb`, `stopDb`, `clearDb`, `seedRoles`, `tokenFor`, `bearer`. It is test-support, not production code: nothing outside a `tests/` folder may import it.
- **Transactions:** integration tests must run against a real Mongo (memory server) — Mongoose sessions require a replica set.

---

## 8. Mongoose-Specific Rules

### Schema definition

```ts
const DB_NAME = 'employee';
const DB_COLLECTION = 'employees';

const employeeSchema = new Schema(
  {
    employeeCode: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'users', sparse: true, unique: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'departments', required: true, index: true },
    positionId: { type: Schema.Types.ObjectId, ref: 'positions', required: true },
    managerId: { type: Schema.Types.ObjectId, ref: 'employees' },
    hireDate: { type: Date, required: true },
    employeeType: {
      type: String,
      enum: ['full_time', 'part_time', 'contract', 'intern'],
      required: true,
    },
    status: {
      type: String,
      enum: ['onboarding', 'active', 'on_leave', 'terminated'],
      default: 'onboarding',
    },
  },
  { collection: 'employees', timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

employeeSchema.index({ departmentId: 1, status: 1 });

const Employee = mongoose.model(DB_NAME, employeeSchema);
export default Employee;
```

- **Always set `collection:`** explicitly to avoid Mongoose auto-pluralization surprises.
- **Always declare indexes** on FK fields (`employeeId`, `userId`, …).
- **Use `.lean()`** for read-only queries that don't need Mongoose documents — significantly faster.
- **Use `populate('field')`** for simple references; **use `$lookup`** in aggregation for complex joins.

### Refs & relationships

```ts
userId: { type: Schema.Types.ObjectId, ref: 'users' }   // ref = collection name (lowercase plural)
```

- N:M relationships use a **junction collection** (`userRoles`, `rolePermissions`) when metadata (`assignedAt`, `expiresAt`) is required — see DATABASE.md §3.

### Transactions (multi-document writes)

```ts
// modules/hrm/core/employee/app/account-provisioning.usecases.ts
// Granting login is atomic — and the account itself belongs to IAM, so the
// transaction handle is passed across the boundary rather than the models.
async grantLogin(employeeId: string, hrUserId: string) {
  return this.uow.withTransaction(async (tx) => {
    const { id: userId } = await this.accounts.createUser({ /* ... */, mustChangePassword: true }, tx);
    await this.employees.linkUser(employeeId, userId, tx);
    await this.accounts.assignRole(userId, employeeRoleId, tx);
    await this.accounts.writeUserAudit({ userId: hrUserId, resource: 'user', action: 'create', resourceId: userId }, tx);
  });
}
```

The `accounts` port above is backed by `iamDirectory` from `@modules/iam`. HRM
never imports `User`, `Role`, `UserRole` or `AuditLog` itself.

- Required for: **account provisioning**, **payroll computation**, **leave approval** (updates balance + request status).
- MongoDB transactions require a **replica set** — dev/docker run one, and `mongodb-memory-server` is started as a replica set in tests.

### Audit middleware

- Every mutating use-case records an audit entry through its `AuditPort` — inline in the same transaction where one is open. The port is backed by `auditService` from `@modules/iam`, which owns the `auditLogs` collection.

---

## 9. Authentication & Authorization

Two modules, two questions. Keep them apart:

- **`modules/auth` — authentication.** JWT **access token** (15 min) + **refresh token** (rotated on each use, hashed in the `sessions` collection), login/logout, forced password change, single-use set-password links. It reads users and roles through the repositories IAM exposes; it stores no permission rules of its own.
- **`modules/iam` — authorization.** Users, roles, permissions and their links, plus the audit log. Permission keys are plain strings namespaced by module (`hrm.employee.read`, `hrm.payroll.approve`), so another product can reuse IAM as-is.

Request-edge middleware lives in `shared/http/` because all three modules use it:

- `authenticate` verifies the access token → attaches `req.user: AuthPayload`. It reads only `@infra/jwt.config`, so `shared/` never depends on a module.
- `requireRoles('admin', 'hr_manager')` → checks `req.user.roles`.
- `requirePermission('payroll:approve')` → granular check against `req.user.permissions`.
- A route is public simply by not listing `authenticate`.

```ts
router.post(
  '/employees/:id/grant-login',
  authenticate,
  requireRoles('admin', 'hr_manager'),
  validate(grantLoginDto, 'body'),
  employeeController.grantLogin,
);
```

Both routers mount on the same `/api/v1` prefix, so splitting Auth from IAM did
not change a single URL.

---

## 10. Configuration

```ts
// infra/config.ts
import { z } from 'zod';
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  MONGO_URI: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(64),
  JWT_REFRESH_SECRET: z.string().min(64),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  BCRYPT_ROUND: z.coerce.number().default(10),
  HTTP_CORS_ORIGINS: z.string().optional(),
});
export const env = schema.parse(process.env);
```

- **Never** read `process.env.X` directly outside `infra/config.ts`.
- JWT issuer/audience/TTL options live in `infra/jwt.config.ts`, derived from `env`.
- All secrets via environment; `.env.example` is committed, `.env` is gitignored.
