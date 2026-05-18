# Soosky HRM — Conventions & Project Standards

> Coding standards, folder structure, and architectural rules for the Soosky HRM backend.
> All contributors (human + AI assistants) MUST follow this document.

---

## Tech Stack

- **Language:** TypeScript (strict mode)
- **Runtime:** Node.js (LTS)
- **Framework:** Express.js
- **ODM:** Mongoose
- **Database:** MongoDB 6.x
- **Validation:** Zod
- **Auth:** JWT (access + refresh) with `bcrypt`/`argon2` for password hashing
- **Logging:** Pino (structured logs)
- **Testing:** Jest + Supertest

---

## 1. Feature Structure

```
src/
├── features/
│   ├── iam/              # users, roles, permissions, sessions, auth, audit logs
│   ├── organization/     # departments, positions
│   ├── employee/         # employees + profile/documents/contacts/contracts/...
│   ├── attendance/       # shifts, attendances, leave requests, balances, holidays
│   ├── payroll/          # periods, salary structures, allowances, payrolls, payslips
│   └── performance/      # appraisal cycles, goals, KPIs, reviews, feedbacks
├── shared/
│   ├── middlewares/      # auth, role-guard, error-handler, audit, validation
│   ├── errors/           # HttpError, NotFoundError, ForbiddenError, ...
│   ├── utils/            # date, money, pagination helpers
│   ├── types/            # cross-feature types (e.g., AuthPayload)
│   └── db/               # mongoose connection, plugins
└── config/               # env loader, constants
```

Each feature folder:

```
features/[feature-name]/
├── [feature].routes.ts        # express Router wiring
├── [feature].controller.ts    # HTTP layer only
├── [feature].service.ts       # business logic
├── repositories/
│   └── [entity].repository.ts # data access (Mongoose queries)
├── models/
│   └── [entity].model.ts      # Mongoose Schema + Model
├── dto/
│   ├── create-[entity].dto.ts # Zod schema + inferred type
│   └── update-[entity].dto.ts
├── types/
│   └── [feature].types.ts
├── tests/
│   ├── [feature].controller.spec.ts
│   └── [feature].service.spec.ts
└── CONTEXT.md
```

---

## 2. Naming Conventions

- **Feature folders:** `kebab-case` — `employee`, `payroll`, `performance`
- **Files:** `kebab-case` — `create-employee.dto.ts`, `user.model.ts`
- **Classes:** `PascalCase` — `EmployeeService`, `CreateEmployeeDto`
- **Functions / methods:** `camelCase` — `findById`, `grantLogin`
- **Variables:** `camelCase` — `employeeId`, `payrollPeriod`
- **Constants:** `UPPER_SNAKE_CASE` — `MAX_LEAVE_DAYS`, `ROLE_ADMIN`
- **Interfaces / types:** `PascalCase` — `IUserPayload` (interface), `EmployeeStatusType` (union type)
- **Mongoose models:** `PascalCase` singular — `User`, `Employee`, `Payroll`
- **MongoDB collections:** `camelCase` plural — `users`, `employeeProfiles`, `payrollPeriods`
- **MongoDB fields:** `camelCase` — `firstName`, `employeeId`, `lastLoginAt`
- **Timestamps:** `snake_case` — `created_at`, `updated_at` (per DATABASE.md convention)

---

## 3. Feature Rules

- A feature MUST be self-contained — owns its models, repositories, services, controllers, routes.
- **No direct imports** between features (e.g., `payroll` MUST NOT import from `employee/employee.service.ts`).
- Cross-feature communication:
  - **Shared services** in `src/shared/` for genuinely shared logic (auth, audit).
  - **Event emitter** (`node:events`) for async cross-feature events (e.g., `employee.granted-login` → triggers email send).
  - **Public service exports** — feature exposes an `index.ts` that re-exports approved service methods only.

**Feature boundaries for this project:**

- `iam` — users, roles, permissions, JWT issue/refresh, sessions, audit logs
- `organization` — departments (tree), positions
- `employee` — core employee record + profile, documents, contacts, bank accounts, contracts, history, assets
- `attendance` — shifts, check-in/out, leave requests, balances, holidays
- `payroll` — periods, salary structures, allowances/deductions/bonuses, payroll computation, payslips
- `performance` — appraisal cycles, goals, KPIs, reviews, multi-source feedback

---

## 4. Code Patterns (MUST follow)

### Error handling

```ts
// shared/errors/http-error.ts
export class HttpError extends Error {
  constructor(public statusCode: number, message: string, public code?: string) { super(message); }
}
export class NotFoundError extends HttpError { constructor(r: string) { super(404, `${r} not found`); } }
export class ForbiddenError extends HttpError { constructor() { super(403, 'Forbidden'); } }
```

- Throw typed errors from services; let global error middleware format the response.
- DO NOT call `res.status(...).json(...)` for errors in services.

### Validation (Zod)

```ts
// dto/create-employee.dto.ts
import { z } from 'zod';
export const createEmployeeDto = z.object({
  departmentId: z.string().length(24),
  positionId:   z.string().length(24),
  hireDate:     z.coerce.date(),
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

- Use Pino with a child logger per feature: `const log = logger.child({ feature: 'payroll' })`.
- Log at **service** level, not controllers. Format: `[FeatureName] action - context`.

### Response format

- **Success:** `{ data, message?, meta? }`
- **Error:** `{ statusCode, code, message }`
- **Pagination:** `{ data, meta: { page, limit, total, totalPages } }`

### Repository pattern

```ts
// employee.repository.ts
export class EmployeeRepository {
  findActiveByDepartment(deptId: string) {
    return Employee.find({ departmentId: deptId, status: 'active' }).lean();
  }
  paginate({ page, limit, filter }: PaginateOpts) {
    return Employee.aggregate([ { $match: filter }, { $skip: (page-1)*limit }, { $limit: limit } ]);
  }
}
```

- Complex queries (aggregations, joins via `$lookup`, populate chains) MUST live in the repository.
- Services orchestrate repositories; controllers orchestrate services.

---

## 5. Anti-patterns (MUST NOT do)

| ❌ DON'T | ✅ DO |
|---|---|
| `import { EmployeeModel } from '../employee/models/...'` from `payroll` | `import { EmployeeService } from '@features/employee'` (via feature `index.ts`) |
| Business logic in controller | Controller calls service; service holds rules |
| `Employee.find(...)` in service | Service calls `employeeRepo.find(...)` |
| Storing plain passwords | `bcrypt.hash(password, 10)` before save |
| Referencing current `baseSalary` in `Payroll` | Snapshot `baseSalary`, `allowances`, etc. at compute time |
| Referencing current `Department` in `EmployeeHistory` | Snapshot into `fromValue` / `toValue` |
| Hardcoded values | Read from `config` (loaded from env via Zod) |
| Circular feature dependency | Refactor into shared service or domain event |
| Hard-deleting employees | Set `status = 'terminated'`, fill `terminationDate` |
| `Number` for money | `Decimal128` (use `mongoose-decimal128` plugin) |
| `Number` for phone / account number | `String` (preserve leading zeros) |

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
  - DATABASE.md / CONVENTIONS.md updated if structure changes

---

## 7. Testing

- **Location:** same folder as source — `features/payroll/tests/payroll.service.spec.ts`
- **Naming:** `[name].spec.ts`
- **Structure:** `describe → it` with Arrange-Act-Assert
- **Coverage targets:**
  - Services: **80%+**
  - Controllers: **70%+**
  - Repositories: **60%+**
- **Mocking:** mock Mongoose models with `jest.mock`, or use `mongodb-memory-server` for integration tests.
- **Transactions:** integration tests must run against a real Mongo instance (memory server) — Mongoose sessions require a replica set.

---

## 8. Mongoose-Specific Rules

### Schema definition

```ts
const employeeSchema = new Schema(
  {
    employeeCode: { type: String, required: true, unique: true, index: true },
    userId:       { type: Schema.Types.ObjectId, ref: 'users', sparse: true, unique: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'departments', required: true, index: true },
    positionId:   { type: Schema.Types.ObjectId, ref: 'positions', required: true },
    managerId:    { type: Schema.Types.ObjectId, ref: 'employees' },
    hireDate:     { type: Date, required: true },
    employeeType: { type: String, enum: ['full_time','part_time','contract','intern'], required: true },
    status:       { type: String, enum: ['onboarding','active','on_leave','terminated'], default: 'onboarding' },
  },
  { collection: 'employees', timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);
employeeSchema.index({ departmentId: 1, status: 1 });
export const Employee = model('employees', employeeSchema);
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
// employee.service.ts — granting login is atomic
async grantLogin(employeeId: string, hrUserId: string) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const [user] = await User.create([{ /* ... */, mustChangePassword: true }], { session });
      await Employee.updateOne({ _id: employeeId }, { userId: user._id }, { session });
      await UserRole.create([{ userId: user._id, roleId: EMPLOYEE_ROLE_ID, assignedAt: new Date() }], { session });
      await AuditLog.create([{ userId: hrUserId, resource: 'user', action: 'create', resourceId: user._id }], { session });
    });
  } finally { session.endSession(); }
}
```

- Required for: **account provisioning**, **payroll computation**, **leave approval** (updates balance + request status).
- MongoDB transactions require a **replica set** — set this up in dev (`mongodb-memory-server` with `replSet: 'rs'`).

### Audit middleware

- Every mutating service method ends with an `auditLogs` write — either inline (same transaction) or via a shared `withAudit(...)` wrapper.

---

## 9. Authentication & Authorization

- **JWT access token** (15 min) + **refresh token** (7 days, rotated on each use, hashed in `sessions` collection).
- **Auth middleware:** `authenticate` verifies access token → attaches `req.user: AuthPayload`.
- **Role guard:** `requireRoles('admin', 'hr_manager')` → checks `req.user.roles`.
- **Permission guard:** `requirePermission('payroll:approve')` → for granular checks.
- **Public routes** explicitly opt out with `router.use(skipAuth)`.

```ts
router.post(
  '/employees/:id/grant-login',
  authenticate,
  requireRoles('admin', 'hr_manager'),
  validate(grantLoginDto, 'body'),
  employeeController.grantLogin,
);
```

---

## 10. Configuration

```ts
// config/env.ts
import { z } from 'zod';
const envSchema = z.object({
  NODE_ENV:    z.enum(['development','test','production']),
  PORT:        z.coerce.number().default(3000),
  MONGO_URI:   z.string().url(),
  JWT_SECRET:  z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  BCRYPT_ROUNDS: z.coerce.number().default(10),
});
export const env = envSchema.parse(process.env);
```

- **Never** read `process.env.X` directly outside `config/`.
- All secrets via environment; `.env.example` is committed, `.env` is gitignored.