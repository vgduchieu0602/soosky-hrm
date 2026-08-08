# Design — Port HRM `organization` into soosky-workspace-api (hexagonal DDD style)

**Date:** 2026-07-17
**Status:** Approved (scoping decisions confirmed)
**Pilot goal:** Rewrite one HRM feature (`organization`) in the exact coding style of
`C:\Code\Project\Soosky-backend\soosky-workspace-api` and land it as a drop-in module
inside that repo. This module becomes the reference template for porting the remaining
HRM features (iam→(collides, rename later), employee, attendance, payroll, performance).

---

## 1. Context

Two backends, both "clean-ish" but stylistically far apart.

| Aspect | Reference (workspace-api) | Current HRM |
|---|---|---|
| Layout | Hexagonal: `modules/<m>/core` (domain+app) vs `adapters` (driver/driven) | `features/<f>/{domain,application,infrastructure,interfaces}` + `container.ts` |
| DB | Raw `mongodb` driver v7, Mapper+Document+`rehydrate`, UUIDv7 string ids | Mongoose, shared global models, ObjectId |
| Use-cases | One class per use-case, `execute()`, co-located Input/Output | Grouped `*UseCases` classes with many methods |
| Validation | Hand-rolled `bodySchema`/`field` (shape only; business rules in domain/VO) | Zod |
| Errors | 3-tier (`DomainError`/`ApplicationError`/`HttpRequestError`), each `{code,httpStatus}` → `{code,message}` | `HttpError(status,msg,code)` → `{success:false,error}` |
| Logging | `console` | Pino child loggers |
| Cross-module | EventBus only; contracts re-declared locally ("published language") | direct `index.ts` imports + gateways + event bus |
| Files | PascalCase = export name | kebab-case |
| Docs | Self-contained styled HTML (`api.html`, `use-cases.html`, `events.html`) + `er-diagram.md` | Markdown (`API-SPEC.md`, `DATABASE.md`) |

**Decision (locked):** full port to reference style, written directly into
`soosky-workspace-api` as `src/modules/organization/`, pilot-first.

---

## 2. Scoping decisions (confirmed)

1. **Employee-dependent features dropped for pilot, port seams left.**
   workspace-api has no employee module. Ship dept/position CRUD + tree + reparent
   (cycle guard) + archive + delete. Skip transfer-employees, merge, headcount,
   head-name resolution. `managerId` stored as an opaque string (no validation now).
   Future: real behavior via an employee module + EventBus read-model.
2. **Authorization = authenticated-only.** Any logged-in account may write, via the
   existing `authenticate` middleware + `ActorContext`. No HR/admin role gate (workspace
   accounts have no such role). RBAC deferred.
3. **Audit dropped.** Reference has no audit log. Audit can return later as a
   cross-module EventBus consumer.

No EventBus publish/consume in the pilot (no cross-module reactions yet) → no
`adapters/driver/events` folder, no `events.html` change.

---

## 3. Module structure (mirrors `modules/task-mgmt` exactly)

```
src/modules/organization/
  index.ts                              # barrel: createOrganizationHttpRouter + OrganizationHttpUseCases
  core/
    domain/
      entities/
        Department.ts                   # AggregateRoot<string>
        Position.ts                     # AggregateRoot<string>
      value-objects/
        DepartmentCode.ts               # trim + UPPERCASE, non-empty, <=20
        DepartmentName.ts               # trim, non-empty, <=120
        DepartmentStatus.ts             # active | archived
        PositionCode.ts                 # trim + UPPERCASE, non-empty, <=20
        PositionTitle.ts                # trim, non-empty, <=120
        PositionLevel.ts                # int 1..10
        PositionStatus.ts               # active | archived
        Description.ts                  # optional text, <=500 (mirrors task-mgmt Description)
      errors/
        DepartmentCodeInvalidError.ts       (422)
        DepartmentNameInvalidError.ts       (422)
        DepartmentCannotBeOwnParentError.ts (409)
        DepartmentCycleError.ts             (409)
        PositionCodeInvalidError.ts         (422)
        PositionTitleInvalidError.ts        (422)
        PositionLevelInvalidError.ts        (422)
      department-tree.ts                # pure: assembleDepartments, collectSubtreeIds (no employee bits)
    app/
      ports/
        DepartmentRepo.ts
        PositionRepo.ts
      errors/
        DepartmentNotFoundError.ts      (404)
        DepartmentCodeConflictError.ts  (409)
        ParentDepartmentNotFoundError.ts(404)
        DepartmentHasChildrenError.ts   (409)
        PositionNotFoundError.ts        (404)
        PositionCodeConflictError.ts    (409)
      use-cases/
        department/
          CreateDepartmentUseCase.ts
          UpdateDepartmentUseCase.ts
          GetDepartmentUseCase.ts
          ListDepartmentsUseCase.ts     # ?tree=true → forest
          ReparentDepartmentUseCase.ts  # cycle guard
          AssignDepartmentHeadUseCase.ts# managerId opaque string | null
          ArchiveDepartmentUseCase.ts   # block if active children
          DeleteDepartmentUseCase.ts    # block if children or positions
        position/
          CreatePositionUseCase.ts
          UpdatePositionUseCase.ts
          GetPositionUseCase.ts
          ListPositionsUseCase.ts       # filter departmentId/status
          ArchivePositionUseCase.ts
          DeletePositionUseCase.ts
  adapters/
    driven/persistence/mongodb/
      collections.ts                    # ORG_COLLECTIONS = { departments:"org_departments", positions:"org_positions" }
      documents/DepartmentDocument.ts
      documents/PositionDocument.ts
      mappers/DepartmentMapper.ts
      mappers/PositionMapper.ts
      repositories/MongoDepartmentRepo.ts
      repositories/MongoPositionRepo.ts
      MongoRepository.ts                # copy of task-mgmt base (or re-export from shared if one exists)
      index.ts                          # barrel of repos
    driver/http/
      controllers/DepartmentController.ts
      controllers/PositionController.ts
      presenters/DepartmentPresenter.ts
      presenters/PositionPresenter.ts
      index.ts                          # createOrganizationHttpRouter + OrganizationHttpUseCases
```

`MongoRepository`/`MongoUnitOfWork` in task-mgmt are module-local. Pilot has no
multi-document write (reparent/archive/delete are single writes), so **no UnitOfWork
needed**. Copy `MongoRepository.ts` into the module (same as task-mgmt keeps its own).

---

## 4. Domain model

**Department** (`AggregateRoot<string>`): `id, workspaceId?` — NOTE: task-mgmt scopes by
`workspaceId`. Organization in HRM is company-global (no workspace). Pilot keeps
departments **global** (no `workspaceId`) to match HRM semantics; documented as an
intentional divergence from task-mgmt's workspace scoping.

Fields: `id, code:DepartmentCode, name:DepartmentName, description:Description,
parentDepartmentId:string|null, managerId:string|null, status:DepartmentStatus,
createdAt:Date`.
Mutators: `rename(name)`, `changeCode(code)`, `changeDescription(desc)`,
`reparent(parentId|null)`, `assignHead(managerId)`, `removeHead()`, `archive()`,
`activate()`.

**Position** (`AggregateRoot<string>`): `id, code:PositionCode, title:PositionTitle,
departmentId:string, level:PositionLevel, description:Description,
status:PositionStatus, createdAt:Date`.
Mutators: `rename(title)`, `changeDescription`, `changeLevel`, `moveToDepartment(deptId)`,
`archive()`, `activate()`.

VOs validate shape/range and throw the matching domain error. Code VOs normalize to
trimmed UPPERCASE inside `create`.

---

## 5. Use-case rules (ported from HRM, employee bits removed)

- **CreateDepartment**: reject duplicate code (`DepartmentCodeConflictError`); if
  `parentDepartmentId` given, it must exist (`ParentDepartmentNotFoundError`).
- **UpdateDepartment**: code change → dup check excluding self; cannot set own id as parent.
- **ReparentDepartment**: parent must exist; reject if new parent is in the subtree of the
  moved node (`DepartmentCycleError`) or equals self (`DepartmentCannotBeOwnParentError`),
  using pure `collectSubtreeIds`.
- **AssignDepartmentHead**: set/clear `managerId` (opaque string, no employee lookup).
- **ArchiveDepartment**: block if any child department is `active` (`DepartmentHasChildrenError`).
- **DeleteDepartment**: hard delete; block if it has children or positions
  (`DepartmentHasChildrenError`).
- **ListDepartments(?tree)**: flat or nested forest via `assembleDepartments` (headcount/head
  fields omitted → nodes carry only org data).
- **Position**: create → department must exist + unique code; update → optional dept move
  (dept must exist); archive (soft); delete blocked only conceptually (no employee count now
  → delete always allowed, documented; guard returns when employee module lands).

Authorization: every write use-case takes `actorUserId` (from `ActorContext`) purely to
prove authentication; no role branching.

---

## 6. HTTP surface (mounted at `/organization`)

```
POST   /departments
GET    /departments                         ?tree=true
GET    /departments/:departmentId
PATCH  /departments/:departmentId
PATCH  /departments/:departmentId/parent     # reparent
PATCH  /departments/:departmentId/head       # assign/remove head
POST   /departments/:departmentId/archive
DELETE /departments/:departmentId

POST   /positions
GET    /positions                            ?departmentId= &status=
GET    /positions/:positionId
PATCH  /positions/:positionId
POST   /positions/:positionId/archive
DELETE /positions/:positionId
```

Router: `router.use(json()); router.use(authenticate(verifier));` then a single flat,
column-aligned route table, then `router.use(errorHandler)`. Controllers parse via
`bodySchema`, read actor via `ActorContext.get(res)`, return raw DTO / `{ departments:[…] }`
/ `201 {departmentId}` / `200 end()` — no success envelope, matching reference.

`bodySchema` supports string/date only; `level` (number), `parentDepartmentId`/`managerId`
(nullable) and `status` (enum) need small additive field kinds. **Plan adds** `field.number`,
`field.optionalNumber`, `field.nullableString` to `shared/adapters/driver/http/validation.ts`
(shared kernel extension; keeps business rules — range, enum membership — in VOs).

---

## 7. Infra wiring changes (in soosky-workspace-api)

- `src/infra/di/createOrganizationHttpUseCases.ts` — new factory returning
  `OrganizationHttpUseCases` (repos on shared `Db`, injected per use-case).
- `src/infra/db/ensureMongoIndexes.ts` — add
  `MongoDepartmentRepo.ensureIndexes` + `MongoPositionRepo.ensureIndexes`.
- `src/infra/server/createExpressServer.ts` — add param `organizationUseCases` +
  `app.use("/organization", createOrganizationHttpRouter(organizationUseCases, verifier))`.
- `src/server.ts` — build org use-cases via the DI factory, pass into `createExpressServer`.
  (CLI entry `cli.ts` untouched — org has no CLI commands in pilot.)

Indexes: `org_departments` → `{ code:1 }` unique, `{ parentDepartmentId:1 }`;
`org_positions` → `{ code:1 }` unique, `{ departmentId:1 }`.

---

## 8. Documentation (HTML, reference format)

- `docs/api.html` — add an **Organization** section (same inline-styled layout, method-colored
  badges) listing the 14 endpoints with body/description.
- `docs/use-cases.html` — add Organization use-cases (one card per use-case, `@throws` list).
- `docs/er-diagram.md` — add an `Organization` namespace to the Mermaid `classDiagram`
  (Department, Position + parent/child + department→position relations).
- `docs/postman-collection.json` — add an Organization folder with the 14 requests (optional,
  include if low-cost).

---

## 9. Testing (Vitest, reference conventions)

Tests in a top-level `tests/` tree mirroring `src/` (per `docs/tests.md`):
- Domain VO unit tests (code/name/level validation).
- `department-tree` pure unit tests (assemble + cycle detection).
- Use-case tests with `vitest-mock-extended` `mock<DepartmentRepo>()` — create dup-code,
  reparent cycle, archive-with-active-children, delete-with-positions.
- One HTTP spec (supertest) hitting `createOrganizationHttpRouter` with a fake verifier:
  create → get → list?tree → reparent → 404/409 paths.

Coverage focus: `src/modules/organization/core/**` (mirrors task-mgmt coverage target).

---

## 10. Out of scope (explicit)

- transfer-employees, merge, headcount, head-name resolution (employee module needed).
- Audit logging. RBAC / HR roles. Pino logging (use `console` per reference).
- Porting other HRM features — separate spec→plan cycles, using this module as the template.

---

## 11. Template takeaways for later features

This module establishes, in-repo, the exact recipe: entity+VO+domain-error, one-class
use-cases with `@throws` JSDoc, Mapper/Document/`rehydrate` + UUIDv7, `MongoRepository`
+ `ensureIndexes`, controller(`bodySchema`+`ActorContext`)/presenter, module barrel,
DI factory, `createExpressServer` mount, EventBus seams for cross-module, and HTML docs.
Later features (employee, attendance, payroll, performance) follow it 1:1, adding
`MongoUnitOfWork` where multi-document writes appear and `adapters/driver/events` where
cross-module reactions appear.
