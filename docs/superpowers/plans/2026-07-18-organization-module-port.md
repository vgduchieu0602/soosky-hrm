# Kế hoạch triển khai — Port module `organization` sang soosky-workspace-api

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (khuyến nghị) hoặc superpowers:executing-plans để thực thi plan theo từng task. Các bước dùng cú pháp checkbox (`- [ ]`).

**Goal:** Viết lại feature `organization` của HRM theo đúng style hexagonal DDD của dự án `soosky-workspace-api`, đặt thẳng vào repo đó dưới dạng module drop-in `src/modules/organization/`, làm khuôn mẫu để port các feature còn lại.

**Architecture:** Hexagonal / Ports-and-Adapters + DDD như `modules/task-mgmt`: `core/` (domain + app/use-cases + ports) thuần nghiệp vụ, không import framework; `adapters/` chia `driven` (persistence Mongo) và `driver` (HTTP). Dùng raw `mongodb` driver, id UUIDv7 string, Mapper/Document/`rehydrate`, validation `bodySchema` thủ công, lỗi 3 tầng → envelope `{code,message}`, log bằng `console`. Liên-module chỉ qua EventBus (pilot chưa có sự kiện nên để seam).

**Tech Stack:** TypeScript 6, Express 5, mongodb driver v7, uuid v7, Vitest + vitest-mock-extended + supertest. Package manager npm (như repo đích).

## Global Constraints

- **Repo đích:** mọi path dưới đây là tương đối tính từ `C:\Code\Project\Soosky-backend\soosky-workspace-api`.
- **Path aliases:** `@modules/*`, `@shared/*`, `@infra/*`, `@tests/*` (đã cấu hình trong tsconfig + vitest.config).
- **Quy ước tên:** file = tên export, PascalCase; barrel/util lowercase (`index.ts`, `collections.ts`). Interface không prefix `I`. Private member prefix `_`. Hằng SCREAMING_SNAKE. Mã lỗi SCREAMING_SNAKE string.
- **Format:** 4 space indent, double quote, semicolon; object literal / khai báo field căn cột (align colon) như task-mgmt. Import sắp xếp alphabet.
- **JSDoc viết tiếng Việt** (giống toàn repo); identifier tiếng Anh.
- **Không ODM, không Zod, không Pino, không audit, không RBAC** trong pilot (theo spec §2, §10).
- **Style lỗi:** DomainError (422/409) cho vi phạm bất biến/VO; ApplicationError (404/409) cho lỗi nghiệp vụ tầng app; tái dùng `AccessDeniedError` của shared. Mỗi lớp lỗi khai `readonly code` + `readonly httpStatus`.
- **Test:** đặt trong cây `tests/` ở gốc, mirror `src/`. Chạy `npm test`.
- **Commit thường xuyên**, mỗi task một commit; message theo Conventional Commits.
- **Id:** dùng `import { v7 as UUIDv7 } from "uuid"` khi tạo entity mới.
- **Divergence có chủ đích:** Department là toàn-công-ty (KHÔNG có `workspaceId` như task-mgmt). `managerId` là string mờ (chưa validate, chờ module employee).

---

## Cấu trúc file (khóa quyết định phân rã)

```
src/modules/organization/
  index.ts
  core/
    domain/
      entities/Department.ts
      entities/Position.ts
      value-objects/DepartmentCode.ts
      value-objects/DepartmentName.ts
      value-objects/DepartmentStatus.ts
      value-objects/PositionCode.ts
      value-objects/PositionTitle.ts
      value-objects/PositionLevel.ts
      value-objects/PositionStatus.ts
      value-objects/Description.ts
      errors/DepartmentCodeInvalidError.ts
      errors/DepartmentNameInvalidError.ts
      errors/DepartmentStatusInvalidError.ts
      errors/DepartmentCannotBeOwnParentError.ts
      errors/DepartmentCycleError.ts
      errors/PositionCodeInvalidError.ts
      errors/PositionTitleInvalidError.ts
      errors/PositionLevelInvalidError.ts
      errors/PositionStatusInvalidError.ts
      department-tree.ts
    app/
      ports/DepartmentRepo.ts
      ports/PositionRepo.ts
      errors/DepartmentNotFoundError.ts
      errors/DepartmentCodeConflictError.ts
      errors/ParentDepartmentNotFoundError.ts
      errors/DepartmentHasChildrenError.ts
      errors/PositionNotFoundError.ts
      errors/PositionCodeConflictError.ts
      use-cases/department/CreateDepartmentUseCase.ts
      use-cases/department/UpdateDepartmentUseCase.ts
      use-cases/department/GetDepartmentUseCase.ts
      use-cases/department/ListDepartmentsUseCase.ts
      use-cases/department/ReparentDepartmentUseCase.ts
      use-cases/department/AssignDepartmentHeadUseCase.ts
      use-cases/department/ArchiveDepartmentUseCase.ts
      use-cases/department/DeleteDepartmentUseCase.ts
      use-cases/position/CreatePositionUseCase.ts
      use-cases/position/UpdatePositionUseCase.ts
      use-cases/position/GetPositionUseCase.ts
      use-cases/position/ListPositionsUseCase.ts
      use-cases/position/ArchivePositionUseCase.ts
      use-cases/position/DeletePositionUseCase.ts
  adapters/
    driven/persistence/mongodb/
      collections.ts
      MongoRepository.ts
      documents/DepartmentDocument.ts
      documents/PositionDocument.ts
      mappers/DepartmentMapper.ts
      mappers/PositionMapper.ts
      repositories/MongoDepartmentRepo.ts
      repositories/MongoPositionRepo.ts
      index.ts
    driver/http/
      controllers/DepartmentController.ts
      controllers/PositionController.ts
      presenters/DepartmentPresenter.ts
      presenters/PositionPresenter.ts
      index.ts
```

Sửa file dùng chung:
- `src/shared/adapters/driver/http/validation.ts` (thêm `field.number`, `field.optionalNumber`).
- `src/infra/di/createOrganizationHttpUseCases.ts` (tạo mới).
- `src/infra/db/ensureMongoIndexes.ts` (thêm ensureIndexes org).
- `src/infra/server/createExpressServer.ts` (mount router).
- `src/server.ts` (dựng use-case + truyền vào).

Docs:
- `docs/api.html`, `docs/use-cases.html`, `docs/er-diagram.md`.

---

## Task 1: Mở rộng kernel validation (thêm kiểu number)

**Files:**
- Modify: `src/shared/adapters/driver/http/validation.ts`
- Test: `tests/shared/adapters/driver/http/validation.test.ts`

**Interfaces:**
- Produces: `field.number: FieldSpec<number, true>`, `field.optionalNumber: FieldSpec<number, false>` — dùng ở controller Position (`level`).

- [ ] **Step 1: Viết test fail**

```ts
// tests/shared/adapters/driver/http/validation.test.ts
import { bodySchema, field } from "@shared/adapters/driver/http/validation";
import { describe, expect, it } from "vitest";

describe("validation field.number", () => {
    it("nhận số hợp lệ", () => {
        const schema = bodySchema({ level: field.number });
        expect(schema.parse({ level: 3 })).toEqual({ level: 3 });
    });

    it("từ chối chuỗi cho field số", () => {
        const schema = bodySchema({ level: field.number });
        expect(() => schema.parse({ level: "3" })).toThrow(/must be a number/);
    });

    it("optionalNumber vắng mặt thì bị loại khỏi kết quả", () => {
        const schema = bodySchema({ level: field.optionalNumber });
        expect(schema.parse({})).toEqual({});
    });
});
```

- [ ] **Step 2: Chạy test — kỳ vọng FAIL**

Run: `npx vitest run tests/shared/adapters/driver/http/validation.test.ts`
Expected: FAIL (`field.number` is undefined).

- [ ] **Step 3: Cài đặt tối thiểu**

Trong `src/shared/adapters/driver/http/validation.ts`, thêm vào object `field` (giữ căn cột):

```ts
export const field = {
    string:         requiredField("a string", castString),
    optionalString: optionalField("a string", castString),
    number:         requiredField("a number", castNumber),
    optionalNumber: optionalField("a number", castNumber),
    date:           requiredField("an ISO-8601 date string", castDate),
    optionalDate:   optionalField("an ISO-8601 date string", castDate),
};
```

Và thêm hàm cast ở cuối file (cạnh `castString`):

```ts
function castNumber(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
```

- [ ] **Step 4: Chạy test — kỳ vọng PASS**

Run: `npx vitest run tests/shared/adapters/driver/http/validation.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/adapters/driver/http/validation.ts tests/shared/adapters/driver/http/validation.test.ts
git commit -m "feat(shared): add number field kind to http body validation"
```

---

## Task 2: Value Objects của Department + domain errors liên quan

**Files:**
- Create: `src/modules/organization/core/domain/errors/DepartmentCodeInvalidError.ts`
- Create: `src/modules/organization/core/domain/errors/DepartmentNameInvalidError.ts`
- Create: `src/modules/organization/core/domain/errors/DepartmentStatusInvalidError.ts`
- Create: `src/modules/organization/core/domain/value-objects/DepartmentCode.ts`
- Create: `src/modules/organization/core/domain/value-objects/DepartmentName.ts`
- Create: `src/modules/organization/core/domain/value-objects/DepartmentStatus.ts`
- Create: `src/modules/organization/core/domain/value-objects/Description.ts`
- Test: `tests/modules/organization/core/domain/value-objects/DepartmentVOs.test.ts`

**Interfaces:**
- Produces:
  - `DepartmentCode.create(raw: string): DepartmentCode` (trim+UPPER, non-empty, ≤20), `.value: string`, `.equals()`.
  - `DepartmentName.create(raw: string): DepartmentName` (trim, non-empty, ≤120), `.value`.
  - `DepartmentStatus.ACTIVE`, `.ARCHIVED`, `.create(raw): DepartmentStatus`, `.value`, `.isActive: boolean`, `.equals()`.
  - `Description.create(raw?: string): Description` (trim, ≤500), `.value`, `.isEmpty`.

- [ ] **Step 1: Viết test fail**

```ts
// tests/modules/organization/core/domain/value-objects/DepartmentVOs.test.ts
import DepartmentCode from "@modules/organization/core/domain/value-objects/DepartmentCode";
import DepartmentName from "@modules/organization/core/domain/value-objects/DepartmentName";
import DepartmentStatus from "@modules/organization/core/domain/value-objects/DepartmentStatus";
import Description from "@modules/organization/core/domain/value-objects/Description";
import { describe, expect, it } from "vitest";

describe("DepartmentCode", () => {
    it("chuẩn hoá trim + UPPERCASE", () => {
        expect(DepartmentCode.create("  eng-01 ").value).toBe("ENG-01");
    });
    it("từ chối rỗng", () => {
        expect(() => DepartmentCode.create("   ")).toThrow(/must not be empty/);
    });
    it("từ chối quá 20 ký tự", () => {
        expect(() => DepartmentCode.create("A".repeat(21))).toThrow(/at most 20/);
    });
});

describe("DepartmentName", () => {
    it("trim và giữ nguyên hoa/thường", () => {
        expect(DepartmentName.create("  Kỹ thuật ").value).toBe("Kỹ thuật");
    });
    it("từ chối rỗng", () => {
        expect(() => DepartmentName.create("")).toThrow(/must not be empty/);
    });
});

describe("DepartmentStatus", () => {
    it("phân giải giá trị hợp lệ", () => {
        expect(DepartmentStatus.create("active").isActive).toBe(true);
        expect(DepartmentStatus.create("archived").isActive).toBe(false);
    });
    it("từ chối giá trị lạ", () => {
        expect(() => DepartmentStatus.create("deleted")).toThrow(/Invalid department status/);
    });
});

describe("Description", () => {
    it("mặc định rỗng khi không truyền", () => {
        expect(Description.create().isEmpty).toBe(true);
    });
    it("từ chối quá 500 ký tự", () => {
        expect(() => Description.create("x".repeat(501))).toThrow(/at most 500/);
    });
});
```

- [ ] **Step 2: Chạy test — kỳ vọng FAIL**

Run: `npx vitest run tests/modules/organization/core/domain/value-objects/DepartmentVOs.test.ts`
Expected: FAIL (module chưa tồn tại).

- [ ] **Step 3: Cài đặt**

`errors/DepartmentCodeInvalidError.ts`:
```ts
import DomainError from "@shared/core/domain/DomainError";

export default class DepartmentCodeInvalidError extends DomainError {
    readonly code = "DEPARTMENT_CODE_INVALID";
    readonly httpStatus = 422;

    constructor(reason: string) {
        super(reason);
    }
}
```

`errors/DepartmentNameInvalidError.ts`:
```ts
import DomainError from "@shared/core/domain/DomainError";

export default class DepartmentNameInvalidError extends DomainError {
    readonly code = "DEPARTMENT_NAME_INVALID";
    readonly httpStatus = 422;

    constructor(reason: string) {
        super(reason);
    }
}
```

`errors/DepartmentStatusInvalidError.ts`:
```ts
import DomainError from "@shared/core/domain/DomainError";

export default class DepartmentStatusInvalidError extends DomainError {
    readonly code = "DEPARTMENT_STATUS_INVALID";
    readonly httpStatus = 422;

    constructor(reason: string) {
        super(reason);
    }
}
```

`value-objects/DepartmentCode.ts`:
```ts
import DepartmentCodeInvalidError from "@modules/organization/core/domain/errors/DepartmentCodeInvalidError";

const MAX_LENGTH = 20;

export default class DepartmentCode {
    private constructor(
        public readonly value: string,
    ) {}

    static create(raw: string): DepartmentCode {
        const code = raw.trim().toUpperCase();

        if (code.length === 0) {
            throw new DepartmentCodeInvalidError("Department code must not be empty");
        }
        if (code.length > MAX_LENGTH) {
            throw new DepartmentCodeInvalidError(`Department code must be at most ${MAX_LENGTH} characters`);
        }
        return new DepartmentCode(code);
    }

    equals(other: DepartmentCode): boolean {
        return this.value === other.value;
    }

    toString(): string {
        return this.value;
    }
}
```

`value-objects/DepartmentName.ts`:
```ts
import DepartmentNameInvalidError from "@modules/organization/core/domain/errors/DepartmentNameInvalidError";

const MAX_LENGTH = 120;

export default class DepartmentName {
    private constructor(
        public readonly value: string,
    ) {}

    static create(raw: string): DepartmentName {
        const name = raw.trim();

        if (name.length === 0) {
            throw new DepartmentNameInvalidError("Department name must not be empty");
        }
        if (name.length > MAX_LENGTH) {
            throw new DepartmentNameInvalidError(`Department name must be at most ${MAX_LENGTH} characters`);
        }
        return new DepartmentName(name);
    }

    equals(other: DepartmentName): boolean {
        return this.value === other.value;
    }

    toString(): string {
        return this.value;
    }
}
```

`value-objects/DepartmentStatus.ts`:
```ts
import DepartmentStatusInvalidError from "@modules/organization/core/domain/errors/DepartmentStatusInvalidError";

/**
 * Trạng thái phòng ban: `active` (đang hoạt động) hoặc `archived` (đã lưu trữ).
 * Là VO bất biến với tập instance cố định để so sánh bằng tham chiếu.
 */
export default class DepartmentStatus {
    static readonly ACTIVE   = new DepartmentStatus("active");
    static readonly ARCHIVED = new DepartmentStatus("archived");

    private constructor(
        public readonly value: string,
    ) {}

    static create(raw: string): DepartmentStatus {
        const found = [DepartmentStatus.ACTIVE, DepartmentStatus.ARCHIVED].find(s => s.value === raw);
        if (found == undefined) {
            throw new DepartmentStatusInvalidError(`Invalid department status: ${raw}`);
        }
        return found;
    }

    get isActive(): boolean {
        return this === DepartmentStatus.ACTIVE;
    }

    equals(other: DepartmentStatus): boolean {
        return this.value === other.value;
    }

    toString(): string {
        return this.value;
    }
}
```

`value-objects/Description.ts` (bản riêng của module — thêm giới hạn 500 so với bản task-mgmt):
```ts
import DepartmentNameInvalidError from "@modules/organization/core/domain/errors/DepartmentNameInvalidError";

const MAX_LENGTH = 500;

/**
 * Mô tả tuỳ chọn dùng chung cho Department và Position. Rỗng khi không truyền;
 * quá `MAX_LENGTH` ký tự là không hợp lệ.
 */
export default class Description {
    private constructor(
        public readonly value: string,
    ) {}

    static create(raw?: string): Description {
        const text = (raw ?? "").trim();
        if (text.length > MAX_LENGTH) {
            throw new DepartmentNameInvalidError(`Description must be at most ${MAX_LENGTH} characters`);
        }
        return new Description(text);
    }

    get isEmpty(): boolean {
        return this.value.length === 0;
    }

    equals(other: Description): boolean {
        return this.value === other.value;
    }

    toString(): string {
        return this.value;
    }
}
```

> Ghi chú: `Description` quá dài ném `DepartmentNameInvalidError` để không thêm lớp lỗi thứ hai chỉ cho mô tả; test chỉ kiểm tra thông điệp `at most 500`.

- [ ] **Step 4: Chạy test — kỳ vọng PASS**

Run: `npx vitest run tests/modules/organization/core/domain/value-objects/DepartmentVOs.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/organization/core/domain tests/modules/organization/core/domain/value-objects/DepartmentVOs.test.ts
git commit -m "feat(organization): add department value objects and domain errors"
```

---

## Task 3: Value Objects của Position + domain errors

**Files:**
- Create: `src/modules/organization/core/domain/errors/PositionCodeInvalidError.ts`
- Create: `src/modules/organization/core/domain/errors/PositionTitleInvalidError.ts`
- Create: `src/modules/organization/core/domain/errors/PositionLevelInvalidError.ts`
- Create: `src/modules/organization/core/domain/errors/PositionStatusInvalidError.ts`
- Create: `src/modules/organization/core/domain/value-objects/PositionCode.ts`
- Create: `src/modules/organization/core/domain/value-objects/PositionTitle.ts`
- Create: `src/modules/organization/core/domain/value-objects/PositionLevel.ts`
- Create: `src/modules/organization/core/domain/value-objects/PositionStatus.ts`
- Test: `tests/modules/organization/core/domain/value-objects/PositionVOs.test.ts`

**Interfaces:**
- Produces:
  - `PositionCode.create(raw)` (trim+UPPER, ≤20), `PositionTitle.create(raw)` (trim, ≤120),
  - `PositionLevel.create(raw: number)` (int 1..10), `.value: number`,
  - `PositionStatus.ACTIVE/.ARCHIVED/.create(raw)`, `.isActive`.

- [ ] **Step 1: Viết test fail**

```ts
// tests/modules/organization/core/domain/value-objects/PositionVOs.test.ts
import PositionCode from "@modules/organization/core/domain/value-objects/PositionCode";
import PositionLevel from "@modules/organization/core/domain/value-objects/PositionLevel";
import PositionStatus from "@modules/organization/core/domain/value-objects/PositionStatus";
import PositionTitle from "@modules/organization/core/domain/value-objects/PositionTitle";
import { describe, expect, it } from "vitest";

describe("PositionCode", () => {
    it("trim + UPPERCASE", () => {
        expect(PositionCode.create(" dev ").value).toBe("DEV");
    });
    it("từ chối rỗng", () => {
        expect(() => PositionCode.create("")).toThrow(/must not be empty/);
    });
});

describe("PositionTitle", () => {
    it("trim", () => {
        expect(PositionTitle.create(" Senior Dev ").value).toBe("Senior Dev");
    });
    it("từ chối rỗng", () => {
        expect(() => PositionTitle.create("  ")).toThrow(/must not be empty/);
    });
});

describe("PositionLevel", () => {
    it("nhận số nguyên trong 1..10", () => {
        expect(PositionLevel.create(5).value).toBe(5);
    });
    it("từ chối ngoài khoảng", () => {
        expect(() => PositionLevel.create(0)).toThrow(/between 1 and 10/);
        expect(() => PositionLevel.create(11)).toThrow(/between 1 and 10/);
    });
    it("từ chối số thập phân", () => {
        expect(() => PositionLevel.create(2.5)).toThrow(/integer/);
    });
});

describe("PositionStatus", () => {
    it("phân giải hợp lệ", () => {
        expect(PositionStatus.create("archived").isActive).toBe(false);
    });
    it("từ chối lạ", () => {
        expect(() => PositionStatus.create("x")).toThrow(/Invalid position status/);
    });
});
```

- [ ] **Step 2: Chạy test — kỳ vọng FAIL**

Run: `npx vitest run tests/modules/organization/core/domain/value-objects/PositionVOs.test.ts`
Expected: FAIL.

- [ ] **Step 3: Cài đặt**

`errors/PositionCodeInvalidError.ts`:
```ts
import DomainError from "@shared/core/domain/DomainError";

export default class PositionCodeInvalidError extends DomainError {
    readonly code = "POSITION_CODE_INVALID";
    readonly httpStatus = 422;

    constructor(reason: string) {
        super(reason);
    }
}
```

`errors/PositionTitleInvalidError.ts`:
```ts
import DomainError from "@shared/core/domain/DomainError";

export default class PositionTitleInvalidError extends DomainError {
    readonly code = "POSITION_TITLE_INVALID";
    readonly httpStatus = 422;

    constructor(reason: string) {
        super(reason);
    }
}
```

`errors/PositionLevelInvalidError.ts`:
```ts
import DomainError from "@shared/core/domain/DomainError";

export default class PositionLevelInvalidError extends DomainError {
    readonly code = "POSITION_LEVEL_INVALID";
    readonly httpStatus = 422;

    constructor(reason: string) {
        super(reason);
    }
}
```

`errors/PositionStatusInvalidError.ts`:
```ts
import DomainError from "@shared/core/domain/DomainError";

export default class PositionStatusInvalidError extends DomainError {
    readonly code = "POSITION_STATUS_INVALID";
    readonly httpStatus = 422;

    constructor(reason: string) {
        super(reason);
    }
}
```

`value-objects/PositionCode.ts`:
```ts
import PositionCodeInvalidError from "@modules/organization/core/domain/errors/PositionCodeInvalidError";

const MAX_LENGTH = 20;

export default class PositionCode {
    private constructor(
        public readonly value: string,
    ) {}

    static create(raw: string): PositionCode {
        const code = raw.trim().toUpperCase();

        if (code.length === 0) {
            throw new PositionCodeInvalidError("Position code must not be empty");
        }
        if (code.length > MAX_LENGTH) {
            throw new PositionCodeInvalidError(`Position code must be at most ${MAX_LENGTH} characters`);
        }
        return new PositionCode(code);
    }

    equals(other: PositionCode): boolean {
        return this.value === other.value;
    }

    toString(): string {
        return this.value;
    }
}
```

`value-objects/PositionTitle.ts`:
```ts
import PositionTitleInvalidError from "@modules/organization/core/domain/errors/PositionTitleInvalidError";

const MAX_LENGTH = 120;

export default class PositionTitle {
    private constructor(
        public readonly value: string,
    ) {}

    static create(raw: string): PositionTitle {
        const title = raw.trim();

        if (title.length === 0) {
            throw new PositionTitleInvalidError("Position title must not be empty");
        }
        if (title.length > MAX_LENGTH) {
            throw new PositionTitleInvalidError(`Position title must be at most ${MAX_LENGTH} characters`);
        }
        return new PositionTitle(title);
    }

    equals(other: PositionTitle): boolean {
        return this.value === other.value;
    }

    toString(): string {
        return this.value;
    }
}
```

`value-objects/PositionLevel.ts`:
```ts
import PositionLevelInvalidError from "@modules/organization/core/domain/errors/PositionLevelInvalidError";

const MIN = 1;
const MAX = 10;

export default class PositionLevel {
    private constructor(
        public readonly value: number,
    ) {}

    static create(raw: number): PositionLevel {
        if (Number.isInteger(raw) === false) {
            throw new PositionLevelInvalidError("Position level must be an integer");
        }
        if (raw < MIN || raw > MAX) {
            throw new PositionLevelInvalidError(`Position level must be between ${MIN} and ${MAX}`);
        }
        return new PositionLevel(raw);
    }

    equals(other: PositionLevel): boolean {
        return this.value === other.value;
    }
}
```

`value-objects/PositionStatus.ts`:
```ts
import PositionStatusInvalidError from "@modules/organization/core/domain/errors/PositionStatusInvalidError";

export default class PositionStatus {
    static readonly ACTIVE   = new PositionStatus("active");
    static readonly ARCHIVED = new PositionStatus("archived");

    private constructor(
        public readonly value: string,
    ) {}

    static create(raw: string): PositionStatus {
        const found = [PositionStatus.ACTIVE, PositionStatus.ARCHIVED].find(s => s.value === raw);
        if (found == undefined) {
            throw new PositionStatusInvalidError(`Invalid position status: ${raw}`);
        }
        return found;
    }

    get isActive(): boolean {
        return this === PositionStatus.ACTIVE;
    }

    equals(other: PositionStatus): boolean {
        return this.value === other.value;
    }

    toString(): string {
        return this.value;
    }
}
```

- [ ] **Step 4: Chạy test — kỳ vọng PASS**

Run: `npx vitest run tests/modules/organization/core/domain/value-objects/PositionVOs.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/organization/core/domain tests/modules/organization/core/domain/value-objects/PositionVOs.test.ts
git commit -m "feat(organization): add position value objects and domain errors"
```

---

## Task 4: Aggregate Department + Position

**Files:**
- Create: `src/modules/organization/core/domain/entities/Department.ts`
- Create: `src/modules/organization/core/domain/entities/Position.ts`
- Test: `tests/modules/organization/core/domain/entities/Entities.test.ts`

**Interfaces:**
- Produces:
  - `Department.create({id, code, name, description, parentDepartmentId, managerId}): Department` (status mặc định ACTIVE, `createdAt = new Date()`), `Department.rehydrate(props)`.
    Getter: `id, createdAt, code, name, description, parentDepartmentId, managerId, status`.
    Mutator: `rename(name)`, `changeCode(code)`, `changeDescription(desc)`, `reparent(parentId|null)`, `assignHead(managerId)`, `removeHead()`, `archive()`, `activate()`.
  - `Position.create({id, code, title, departmentId, level, description}): Position`, `Position.rehydrate(props)`.
    Getter: `id, createdAt, code, title, departmentId, level, description, status`.
    Mutator: `rename(title)`, `changeDescription(desc)`, `changeLevel(level)`, `moveToDepartment(deptId)`, `archive()`, `activate()`.

- [ ] **Step 1: Viết test fail**

```ts
// tests/modules/organization/core/domain/entities/Entities.test.ts
import Department from "@modules/organization/core/domain/entities/Department";
import Position from "@modules/organization/core/domain/entities/Position";
import DepartmentCode from "@modules/organization/core/domain/value-objects/DepartmentCode";
import DepartmentName from "@modules/organization/core/domain/value-objects/DepartmentName";
import DepartmentStatus from "@modules/organization/core/domain/value-objects/DepartmentStatus";
import Description from "@modules/organization/core/domain/value-objects/Description";
import PositionCode from "@modules/organization/core/domain/value-objects/PositionCode";
import PositionLevel from "@modules/organization/core/domain/value-objects/PositionLevel";
import PositionStatus from "@modules/organization/core/domain/value-objects/PositionStatus";
import PositionTitle from "@modules/organization/core/domain/value-objects/PositionTitle";
import { describe, expect, it } from "vitest";

describe("Department", () => {
    function make(): Department {
        return Department.create({
            id:                 "d1",
            code:               DepartmentCode.create("ENG"),
            name:               DepartmentName.create("Engineering"),
            description:        Description.create("desc"),
            parentDepartmentId: null,
            managerId:          null,
        });
    }

    it("create khởi tạo trạng thái ACTIVE", () => {
        expect(make().status.isActive).toBe(true);
    });

    it("reparent và archive thay đổi state", () => {
        const dept = make();
        dept.reparent("root");
        dept.archive();
        expect(dept.parentDepartmentId).toBe("root");
        expect(dept.status.equals(DepartmentStatus.ARCHIVED)).toBe(true);
    });

    it("removeHead xoá managerId", () => {
        const dept = make();
        dept.assignHead("m1");
        dept.removeHead();
        expect(dept.managerId).toBeNull();
    });
});

describe("Position", () => {
    it("create khởi tạo ACTIVE và giữ level", () => {
        const pos = Position.create({
            id:           "p1",
            code:         PositionCode.create("DEV"),
            title:        PositionTitle.create("Developer"),
            departmentId: "d1",
            level:        PositionLevel.create(3),
            description:  Description.create(),
        });
        expect(pos.status.equals(PositionStatus.ACTIVE)).toBe(true);
        expect(pos.level.value).toBe(3);
    });
});
```

- [ ] **Step 2: Chạy test — kỳ vọng FAIL**

Run: `npx vitest run tests/modules/organization/core/domain/entities/Entities.test.ts`
Expected: FAIL.

- [ ] **Step 3: Cài đặt**

`entities/Department.ts`:
```ts
import DepartmentCode from "@modules/organization/core/domain/value-objects/DepartmentCode";
import DepartmentName from "@modules/organization/core/domain/value-objects/DepartmentName";
import DepartmentStatus from "@modules/organization/core/domain/value-objects/DepartmentStatus";
import Description from "@modules/organization/core/domain/value-objects/Description";
import AggregateRoot from "@shared/core/domain/AggregateRoot";

export interface DepartmentCreationInput {
    id:                 string;
    code:               DepartmentCode;
    name:               DepartmentName;
    description:        Description;
    parentDepartmentId: string | null;
    managerId:          string | null;
}

export interface DepartmentProps {
    id:                 string;
    code:               DepartmentCode;
    name:               DepartmentName;
    description:        Description;
    parentDepartmentId: string | null;
    managerId:          string | null;
    status:             DepartmentStatus;
    createdAt:          Date;
}

/**
 * Aggregate phòng ban — phạm vi toàn công ty (không gắn workspace). Giữ quan hệ
 * cha/con qua `parentDepartmentId` và người phụ trách qua `managerId` (id mờ, chưa
 * ràng buộc tới module nhân sự trong pilot).
 */
export default class Department extends AggregateRoot<string> {
    private constructor(
        public readonly id: string,
        public readonly createdAt: Date,
        private _code: DepartmentCode,
        private _name: DepartmentName,
        private _description: Description,
        private _parentDepartmentId: string | null,
        private _managerId: string | null,
        private _status: DepartmentStatus,
    ) {
        super();
    }

    get code(): DepartmentCode {
        return this._code;
    }
    get name(): DepartmentName {
        return this._name;
    }
    get description(): Description {
        return this._description;
    }
    get parentDepartmentId(): string | null {
        return this._parentDepartmentId;
    }
    get managerId(): string | null {
        return this._managerId;
    }
    get status(): DepartmentStatus {
        return this._status;
    }

    static create(input: DepartmentCreationInput): Department {
        return new Department(
            input.id,
            new Date(),
            input.code,
            input.name,
            input.description,
            input.parentDepartmentId,
            input.managerId,
            DepartmentStatus.ACTIVE,
        );
    }

    static rehydrate(props: DepartmentProps): Department {
        return new Department(
            props.id,
            props.createdAt,
            props.code,
            props.name,
            props.description,
            props.parentDepartmentId,
            props.managerId,
            props.status,
        );
    }

    rename(name: DepartmentName): void {
        this._name = name;
    }

    changeCode(code: DepartmentCode): void {
        this._code = code;
    }

    changeDescription(description: Description): void {
        this._description = description;
    }

    reparent(parentDepartmentId: string | null): void {
        this._parentDepartmentId = parentDepartmentId;
    }

    assignHead(managerId: string): void {
        this._managerId = managerId;
    }

    removeHead(): void {
        this._managerId = null;
    }

    archive(): void {
        this._status = DepartmentStatus.ARCHIVED;
    }

    activate(): void {
        this._status = DepartmentStatus.ACTIVE;
    }
}
```

`entities/Position.ts`:
```ts
import Description from "@modules/organization/core/domain/value-objects/Description";
import PositionCode from "@modules/organization/core/domain/value-objects/PositionCode";
import PositionLevel from "@modules/organization/core/domain/value-objects/PositionLevel";
import PositionStatus from "@modules/organization/core/domain/value-objects/PositionStatus";
import PositionTitle from "@modules/organization/core/domain/value-objects/PositionTitle";
import AggregateRoot from "@shared/core/domain/AggregateRoot";

export interface PositionCreationInput {
    id:           string;
    code:         PositionCode;
    title:        PositionTitle;
    departmentId: string;
    level:        PositionLevel;
    description:  Description;
}

export interface PositionProps {
    id:           string;
    code:         PositionCode;
    title:        PositionTitle;
    departmentId: string;
    level:        PositionLevel;
    description:  Description;
    status:       PositionStatus;
    createdAt:    Date;
}

/**
 * Aggregate vị trí công việc, thuộc về một phòng ban. `archived` để ẩn khỏi
 * bộ chọn nhưng vẫn giữ tham chiếu lịch sử.
 */
export default class Position extends AggregateRoot<string> {
    private constructor(
        public readonly id: string,
        public readonly createdAt: Date,
        private _code: PositionCode,
        private _title: PositionTitle,
        private _departmentId: string,
        private _level: PositionLevel,
        private _description: Description,
        private _status: PositionStatus,
    ) {
        super();
    }

    get code(): PositionCode {
        return this._code;
    }
    get title(): PositionTitle {
        return this._title;
    }
    get departmentId(): string {
        return this._departmentId;
    }
    get level(): PositionLevel {
        return this._level;
    }
    get description(): Description {
        return this._description;
    }
    get status(): PositionStatus {
        return this._status;
    }

    static create(input: PositionCreationInput): Position {
        return new Position(
            input.id,
            new Date(),
            input.code,
            input.title,
            input.departmentId,
            input.level,
            input.description,
            PositionStatus.ACTIVE,
        );
    }

    static rehydrate(props: PositionProps): Position {
        return new Position(
            props.id,
            props.createdAt,
            props.code,
            props.title,
            props.departmentId,
            props.level,
            props.description,
            props.status,
        );
    }

    rename(title: PositionTitle): void {
        this._title = title;
    }

    changeDescription(description: Description): void {
        this._description = description;
    }

    changeLevel(level: PositionLevel): void {
        this._level = level;
    }

    moveToDepartment(departmentId: string): void {
        this._departmentId = departmentId;
    }

    archive(): void {
        this._status = PositionStatus.ARCHIVED;
    }

    activate(): void {
        this._status = PositionStatus.ACTIVE;
    }
}
```

- [ ] **Step 4: Chạy test — kỳ vọng PASS**

Run: `npx vitest run tests/modules/organization/core/domain/entities/Entities.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/organization/core/domain/entities tests/modules/organization/core/domain/entities/Entities.test.ts
git commit -m "feat(organization): add Department and Position aggregates"
```

---

## Task 5: Domain thuần `department-tree` (assemble + cycle)

**Files:**
- Create: `src/modules/organization/core/domain/department-tree.ts`
- Test: `tests/modules/organization/core/domain/department-tree.test.ts`

**Interfaces:**
- Produces:
  - `interface DepartmentRow { id, name, code, parentDepartmentId: string|null, managerId: string|null, description?: string, status: string }`
  - `interface DeptNode extends DepartmentRow { children: DeptNode[] }`
  - `assembleDepartments(rows: DepartmentRow[], asTree: boolean): DeptNode[]`
  - `collectSubtreeIds(rows: { id: string; parentDepartmentId: string|null }[], rootId: string): Set<string>`

- [ ] **Step 1: Viết test fail**

```ts
// tests/modules/organization/core/domain/department-tree.test.ts
import {
    assembleDepartments,
    collectSubtreeIds,
    type DepartmentRow,
} from "@modules/organization/core/domain/department-tree";
import { describe, expect, it } from "vitest";

const rows: DepartmentRow[] = [
    { id: "a", name: "A", code: "A", parentDepartmentId: null, managerId: null, status: "active" },
    { id: "b", name: "B", code: "B", parentDepartmentId: "a",  managerId: null, status: "active" },
    { id: "c", name: "C", code: "C", parentDepartmentId: "b",  managerId: null, status: "active" },
];

describe("assembleDepartments", () => {
    it("phẳng khi asTree=false", () => {
        expect(assembleDepartments(rows, false)).toHaveLength(3);
    });
    it("lồng cây khi asTree=true", () => {
        const forest = assembleDepartments(rows, true);
        expect(forest).toHaveLength(1);
        expect(forest[0]?.children[0]?.id).toBe("b");
    });
});

describe("collectSubtreeIds", () => {
    it("gồm chính nó và mọi con cháu", () => {
        expect([...collectSubtreeIds(rows, "a")].sort()).toEqual(["a", "b", "c"]);
        expect([...collectSubtreeIds(rows, "b")].sort()).toEqual(["b", "c"]);
    });
});
```

- [ ] **Step 2: Chạy test — kỳ vọng FAIL**

Run: `npx vitest run tests/modules/organization/core/domain/department-tree.test.ts`
Expected: FAIL.

- [ ] **Step 3: Cài đặt**

`core/domain/department-tree.ts`:
```ts
/**
 * Quy tắc domain thuần cho cây phòng ban — không Express, không driver DB.
 * Lắp danh sách phẳng thành rừng và phát hiện chu trình khi reparent.
 */

/** Bản ghi phòng ban phẳng đọc từ repository (id đã ở dạng string). */
export interface DepartmentRow {
    id:                 string;
    name:               string;
    code:               string;
    parentDepartmentId: string | null;
    managerId:          string | null;
    description?:       string;
    status:             string;
}

export interface DeptNode extends DepartmentRow {
    children: DeptNode[];
}

/**
 * Trả về danh sách phẳng các node phòng ban, hoặc rừng lồng nhau khi `asTree`.
 * Node có cha không tồn tại trong tập dữ liệu được coi là gốc.
 */
export function assembleDepartments(rows: DepartmentRow[], asTree: boolean): DeptNode[] {
    const flat: DeptNode[] = rows.map(row => ({ ...row, children: [] }));

    if (asTree === false) return flat;

    const byId = new Map(flat.map(node => [node.id, node]));
    const roots: DeptNode[] = [];
    for (const node of flat) {
        const parentId = node.parentDepartmentId;
        if (parentId != undefined && byId.has(parentId)) {
            byId.get(parentId)!.children.push(node);
        } else {
            roots.push(node);
        }
    }
    return roots;
}

/** Thu thập id của một phòng ban cùng toàn bộ con cháu (dùng cho kiểm tra chu trình). */
export function collectSubtreeIds(
    rows: { id: string; parentDepartmentId: string | null }[],
    rootId: string,
): Set<string> {
    const childrenByParent = new Map<string, string[]>();
    for (const row of rows) {
        if (row.parentDepartmentId == undefined) continue;
        const list = childrenByParent.get(row.parentDepartmentId) ?? [];
        list.push(row.id);
        childrenByParent.set(row.parentDepartmentId, list);
    }

    const result = new Set<string>();
    const stack = [rootId];
    while (stack.length > 0) {
        const current = stack.pop()!;
        if (result.has(current)) continue;
        result.add(current);
        for (const child of childrenByParent.get(current) ?? []) stack.push(child);
    }
    return result;
}
```

- [ ] **Step 4: Chạy test — kỳ vọng PASS**

Run: `npx vitest run tests/modules/organization/core/domain/department-tree.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/organization/core/domain/department-tree.ts tests/modules/organization/core/domain/department-tree.test.ts
git commit -m "feat(organization): add pure department-tree domain helpers"
```

---

## Task 6: Ports + application errors

**Files:**
- Create: `src/modules/organization/core/app/ports/DepartmentRepo.ts`
- Create: `src/modules/organization/core/app/ports/PositionRepo.ts`
- Create: `src/modules/organization/core/app/errors/DepartmentNotFoundError.ts`
- Create: `src/modules/organization/core/app/errors/DepartmentCodeConflictError.ts`
- Create: `src/modules/organization/core/app/errors/ParentDepartmentNotFoundError.ts`
- Create: `src/modules/organization/core/app/errors/DepartmentHasChildrenError.ts`
- Create: `src/modules/organization/core/app/errors/PositionNotFoundError.ts`
- Create: `src/modules/organization/core/app/errors/PositionCodeConflictError.ts`

**Interfaces:**
- Produces:
  - `DepartmentRepo`: `getById(id): Promise<Department|undefined>`, `getByCode(code): Promise<Department|undefined>`, `listAll(): Promise<Department[]>`, `listChildren(parentId): Promise<Department[]>`, `countChildren(parentId): Promise<number>`, `countPositions?` — KHÔNG, đếm position thuộc `PositionRepo`. `save(dept): Promise<void>`, `deleteById(id): Promise<void>`.
  - `PositionRepo`: `getById(id): Promise<Position|undefined>`, `getByCode(code): Promise<Position|undefined>`, `list(filter: { departmentId?: string; status?: string }): Promise<Position[]>`, `countByDepartment(deptId): Promise<number>`, `save(pos): Promise<void>`, `deleteById(id): Promise<void>`.
  - App errors (không có test riêng — được test gián tiếp qua use-case ở Task 7/8).

> Không có bước test riêng cho task này (chỉ khai báo interface + lớp lỗi thuần). Kiểm chứng bằng `npm run build` (biên dịch sạch).

- [ ] **Step 1: Tạo ports**

`core/app/ports/DepartmentRepo.ts`:
```ts
import Department from "@modules/organization/core/domain/entities/Department";

export default interface DepartmentRepo {
    getById(id: string): Promise<Department | undefined>;
    getByCode(code: string): Promise<Department | undefined>;
    listAll(): Promise<Department[]>;
    listChildren(parentDepartmentId: string): Promise<Department[]>;
    countChildren(parentDepartmentId: string): Promise<number>;
    save(department: Department): Promise<void>;
    deleteById(id: string): Promise<void>;
}
```

`core/app/ports/PositionRepo.ts`:
```ts
import Position from "@modules/organization/core/domain/entities/Position";

export interface PositionListFilter {
    departmentId?: string;
    status?:       string;
}

export default interface PositionRepo {
    getById(id: string): Promise<Position | undefined>;
    getByCode(code: string): Promise<Position | undefined>;
    list(filter: PositionListFilter): Promise<Position[]>;
    countByDepartment(departmentId: string): Promise<number>;
    save(position: Position): Promise<void>;
    deleteById(id: string): Promise<void>;
}
```

- [ ] **Step 2: Tạo application errors**

`core/app/errors/DepartmentNotFoundError.ts`:
```ts
import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class DepartmentNotFoundError extends ApplicationError {
    readonly code = "DEPARTMENT_NOT_FOUND";
    readonly httpStatus = 404;

    constructor() {
        super("Department not found");
    }
}
```

`core/app/errors/DepartmentCodeConflictError.ts`:
```ts
import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class DepartmentCodeConflictError extends ApplicationError {
    readonly code = "DEPARTMENT_CODE_CONFLICT";
    readonly httpStatus = 409;

    constructor() {
        super("Department code already exists");
    }
}
```

`core/app/errors/ParentDepartmentNotFoundError.ts`:
```ts
import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class ParentDepartmentNotFoundError extends ApplicationError {
    readonly code = "PARENT_DEPARTMENT_NOT_FOUND";
    readonly httpStatus = 404;

    constructor() {
        super("Parent department not found");
    }
}
```

`core/app/errors/DepartmentHasChildrenError.ts`:
```ts
import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class DepartmentHasChildrenError extends ApplicationError {
    readonly code = "DEPARTMENT_HAS_CHILDREN";
    readonly httpStatus = 409;

    constructor(message: string = "Department still has dependent records") {
        super(message);
    }
}
```

`core/app/errors/PositionNotFoundError.ts`:
```ts
import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class PositionNotFoundError extends ApplicationError {
    readonly code = "POSITION_NOT_FOUND";
    readonly httpStatus = 404;

    constructor() {
        super("Position not found");
    }
}
```

`core/app/errors/PositionCodeConflictError.ts`:
```ts
import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class PositionCodeConflictError extends ApplicationError {
    readonly code = "POSITION_CODE_CONFLICT";
    readonly httpStatus = 409;

    constructor() {
        super("Position code already exists");
    }
}
```

- [ ] **Step 3: Kiểm chứng biên dịch**

Run: `npx tsc --noEmit`
Expected: không lỗi liên quan tới các file vừa tạo.

- [ ] **Step 4: Commit**

```bash
git add src/modules/organization/core/app/ports src/modules/organization/core/app/errors
git commit -m "feat(organization): add repo ports and application errors"
```

---

## Task 7: Use-cases Department

**Files:**
- Create: 8 file trong `src/modules/organization/core/app/use-cases/department/`
- Test: `tests/modules/organization/core/app/department-usecases.test.ts`

**Interfaces:**
- Consumes: `DepartmentRepo`, `PositionRepo`, các VO/entity/lỗi ở Task 2–6, `collectSubtreeIds`, `AccessDeniedError` (shared) — thực tế pilot chỉ cần actor đã xác thực nên không kiểm tra role; các use-case vẫn nhận `actorUserId` để đồng nhất chữ ký.
- Produces (chữ ký `execute`):
  - `CreateDepartmentUseCase.execute({ code, name, description?, parentDepartmentId?, managerId?, actorUserId }): Promise<{ departmentId: string }>`
  - `UpdateDepartmentUseCase.execute({ departmentId, name?, code?, description?, actorUserId }): Promise<void>`
  - `GetDepartmentUseCase.execute({ departmentId }): Promise<Department>`
  - `ListDepartmentsUseCase.execute({ tree }): Promise<DeptNode[]>`
  - `ReparentDepartmentUseCase.execute({ departmentId, parentDepartmentId, actorUserId }): Promise<void>`
  - `AssignDepartmentHeadUseCase.execute({ departmentId, managerId, actorUserId }): Promise<void>` (`managerId: string|null`)
  - `ArchiveDepartmentUseCase.execute({ departmentId, actorUserId }): Promise<void>`
  - `DeleteDepartmentUseCase.execute({ departmentId, actorUserId }): Promise<void>`

- [ ] **Step 1: Viết test fail**

```ts
// tests/modules/organization/core/app/department-usecases.test.ts
import CreateDepartmentUseCase from "@modules/organization/core/app/use-cases/department/CreateDepartmentUseCase";
import DeleteDepartmentUseCase from "@modules/organization/core/app/use-cases/department/DeleteDepartmentUseCase";
import ReparentDepartmentUseCase from "@modules/organization/core/app/use-cases/department/ReparentDepartmentUseCase";
import DepartmentRepo from "@modules/organization/core/app/ports/DepartmentRepo";
import PositionRepo from "@modules/organization/core/app/ports/PositionRepo";
import Department from "@modules/organization/core/domain/entities/Department";
import DepartmentCode from "@modules/organization/core/domain/value-objects/DepartmentCode";
import DepartmentName from "@modules/organization/core/domain/value-objects/DepartmentName";
import Description from "@modules/organization/core/domain/value-objects/Description";
import { beforeEach, describe, expect, it } from "vitest";
import { mock, MockProxy } from "vitest-mock-extended";

function dept(id: string, parentId: string | null = null): Department {
    return Department.rehydrate({
        id,
        code:               DepartmentCode.create(id),
        name:               DepartmentName.create(id),
        description:        Description.create(),
        parentDepartmentId: parentId,
        managerId:          null,
        status:             (await import("@modules/organization/core/domain/value-objects/DepartmentStatus")).default.ACTIVE,
        createdAt:          new Date("2026-01-01"),
    });
}

describe("CreateDepartmentUseCase", () => {
    let repo: MockProxy<DepartmentRepo>;
    let useCase: CreateDepartmentUseCase;

    beforeEach(() => {
        repo = mock<DepartmentRepo>();
        useCase = new CreateDepartmentUseCase(repo);
    });

    it("từ chối mã trùng", async () => {
        repo.getByCode.mockResolvedValue(dept("ENG"));
        await expect(useCase.execute({ code: "ENG", name: "E", actorUserId: "u" }))
            .rejects.toThrow(/code already exists/i);
    });

    it("tạo thành công trả departmentId", async () => {
        repo.getByCode.mockResolvedValue(undefined);
        const out = await useCase.execute({ code: "ENG", name: "E", actorUserId: "u" });
        expect(out.departmentId).toBeTruthy();
        expect(repo.save).toHaveBeenCalledOnce();
    });
});

describe("ReparentDepartmentUseCase", () => {
    it("từ chối tạo chu trình", async () => {
        const repo = mock<DepartmentRepo>();
        repo.getById.mockResolvedValue(dept("b", "a"));
        repo.listAll.mockResolvedValue([dept("a"), dept("b", "a"), dept("c", "b")]);
        const useCase = new ReparentDepartmentUseCase(repo);
        // đưa b xuống dưới c (con của b) => chu trình
        await expect(useCase.execute({ departmentId: "b", parentDepartmentId: "c", actorUserId: "u" }))
            .rejects.toThrow(/descendant|cycle/i);
    });
});

describe("DeleteDepartmentUseCase", () => {
    it("chặn khi còn con hoặc vị trí", async () => {
        const repo = mock<DepartmentRepo>();
        const positions = mock<PositionRepo>();
        repo.getById.mockResolvedValue(dept("a"));
        repo.countChildren.mockResolvedValue(2);
        positions.countByDepartment.mockResolvedValue(0);
        const useCase = new DeleteDepartmentUseCase(repo, positions);
        await expect(useCase.execute({ departmentId: "a", actorUserId: "u" }))
            .rejects.toThrow(/still has/i);
    });
});
```

> Lưu ý: helper `dept()` ở trên dùng `await import` sai ngữ cảnh (không async). Thay bằng import tĩnh `DepartmentStatus` ở đầu file và gán `status: DepartmentStatus.ACTIVE`. (Sửa khi viết — giữ helper đồng bộ.)

Bản helper đúng (dùng ngay từ đầu):
```ts
import DepartmentStatus from "@modules/organization/core/domain/value-objects/DepartmentStatus";
// ...
function dept(id: string, parentId: string | null = null): Department {
    return Department.rehydrate({
        id,
        code:               DepartmentCode.create(id),
        name:               DepartmentName.create(id),
        description:        Description.create(),
        parentDepartmentId: parentId,
        managerId:          null,
        status:             DepartmentStatus.ACTIVE,
        createdAt:          new Date("2026-01-01"),
    });
}
```

- [ ] **Step 2: Chạy test — kỳ vọng FAIL**

Run: `npx vitest run tests/modules/organization/core/app/department-usecases.test.ts`
Expected: FAIL.

- [ ] **Step 3: Cài đặt use-cases**

`use-cases/department/CreateDepartmentUseCase.ts`:
```ts
import DepartmentCodeConflictError from "@modules/organization/core/app/errors/DepartmentCodeConflictError";
import ParentDepartmentNotFoundError from "@modules/organization/core/app/errors/ParentDepartmentNotFoundError";
import DepartmentRepo from "@modules/organization/core/app/ports/DepartmentRepo";
import Department from "@modules/organization/core/domain/entities/Department";
import DepartmentCode from "@modules/organization/core/domain/value-objects/DepartmentCode";
import DepartmentName from "@modules/organization/core/domain/value-objects/DepartmentName";
import Description from "@modules/organization/core/domain/value-objects/Description";
import { v7 as UUIDv7 } from "uuid";

export interface CreateDepartmentInput {
    code:                string;
    name:                string;
    description?:        string;
    parentDepartmentId?: string;
    managerId?:          string;
    actorUserId:         string;
}

export interface CreateDepartmentOutput {
    departmentId: string;
}

/**
 * Tạo mới một phòng ban.
 *
 * @throws {DepartmentCodeInvalidError}     Mã không hợp lệ.
 * @throws {DepartmentNameInvalidError}     Tên không hợp lệ.
 * @throws {DepartmentCodeConflictError}    Mã đã tồn tại.
 * @throws {ParentDepartmentNotFoundError}  Phòng ban cha không tồn tại.
 */
export default class CreateDepartmentUseCase {
    public constructor(
        private readonly _departmentRepo: DepartmentRepo,
    ) {}

    public async execute(input: CreateDepartmentInput): Promise<CreateDepartmentOutput> {
        const code = DepartmentCode.create(input.code);

        const existing = await this._departmentRepo.getByCode(code.value);
        if (existing != undefined) throw new DepartmentCodeConflictError();

        if (input.parentDepartmentId != undefined) {
            const parent = await this._departmentRepo.getById(input.parentDepartmentId);
            if (parent == undefined) throw new ParentDepartmentNotFoundError();
        }

        const department = Department.create({
            id:                 UUIDv7(),
            code,
            name:               DepartmentName.create(input.name),
            description:        Description.create(input.description),
            parentDepartmentId: input.parentDepartmentId ?? null,
            managerId:          input.managerId ?? null,
        });

        await this._departmentRepo.save(department);

        return { departmentId: department.id };
    }
}
```

`use-cases/department/UpdateDepartmentUseCase.ts`:
```ts
import DepartmentCodeConflictError from "@modules/organization/core/app/errors/DepartmentCodeConflictError";
import DepartmentNotFoundError from "@modules/organization/core/app/errors/DepartmentNotFoundError";
import DepartmentRepo from "@modules/organization/core/app/ports/DepartmentRepo";
import DepartmentCode from "@modules/organization/core/domain/value-objects/DepartmentCode";
import DepartmentName from "@modules/organization/core/domain/value-objects/DepartmentName";
import Description from "@modules/organization/core/domain/value-objects/Description";

export interface UpdateDepartmentInput {
    departmentId: string;
    name?:        string;
    code?:        string;
    description?: string;
    actorUserId:  string;
}

/**
 * Cập nhật tên/mã/mô tả phòng ban.
 *
 * @throws {DepartmentNotFoundError}     Phòng ban không tồn tại.
 * @throws {DepartmentCodeConflictError} Mã mới trùng với phòng ban khác.
 * @throws {DepartmentCodeInvalidError | DepartmentNameInvalidError} Giá trị không hợp lệ.
 */
export default class UpdateDepartmentUseCase {
    public constructor(
        private readonly _departmentRepo: DepartmentRepo,
    ) {}

    public async execute(input: UpdateDepartmentInput): Promise<void> {
        const department = await this._departmentRepo.getById(input.departmentId);
        if (department == undefined) throw new DepartmentNotFoundError();

        if (input.code != undefined) {
            const code = DepartmentCode.create(input.code);
            const holder = await this._departmentRepo.getByCode(code.value);
            if (holder != undefined && holder.id !== department.id) {
                throw new DepartmentCodeConflictError();
            }
            department.changeCode(code);
        }
        if (input.name != undefined) {
            department.rename(DepartmentName.create(input.name));
        }
        if (input.description != undefined) {
            department.changeDescription(Description.create(input.description));
        }

        await this._departmentRepo.save(department);
    }
}
```

`use-cases/department/GetDepartmentUseCase.ts`:
```ts
import DepartmentNotFoundError from "@modules/organization/core/app/errors/DepartmentNotFoundError";
import DepartmentRepo from "@modules/organization/core/app/ports/DepartmentRepo";
import Department from "@modules/organization/core/domain/entities/Department";

export interface GetDepartmentInput {
    departmentId: string;
}

/**
 * Lấy chi tiết một phòng ban.
 *
 * @throws {DepartmentNotFoundError} Phòng ban không tồn tại.
 */
export default class GetDepartmentUseCase {
    public constructor(
        private readonly _departmentRepo: DepartmentRepo,
    ) {}

    public async execute(input: GetDepartmentInput): Promise<Department> {
        const department = await this._departmentRepo.getById(input.departmentId);
        if (department == undefined) throw new DepartmentNotFoundError();
        return department;
    }
}
```

`use-cases/department/ListDepartmentsUseCase.ts`:
```ts
import DepartmentRepo from "@modules/organization/core/app/ports/DepartmentRepo";
import { assembleDepartments, DepartmentRow, DeptNode } from "@modules/organization/core/domain/department-tree";
import Department from "@modules/organization/core/domain/entities/Department";

export interface ListDepartmentsInput {
    tree: boolean;
}

/**
 * Liệt kê phòng ban ở dạng phẳng hoặc cây (rừng) tuỳ `tree`.
 */
export default class ListDepartmentsUseCase {
    public constructor(
        private readonly _departmentRepo: DepartmentRepo,
    ) {}

    public async execute(input: ListDepartmentsInput): Promise<DeptNode[]> {
        const departments = await this._departmentRepo.listAll();
        const rows: DepartmentRow[] = departments.map(toRow);
        return assembleDepartments(rows, input.tree);
    }
}

function toRow(department: Department): DepartmentRow {
    return {
        id:                 department.id,
        name:               department.name.value,
        code:               department.code.value,
        parentDepartmentId: department.parentDepartmentId,
        managerId:          department.managerId,
        description:        department.description.value,
        status:             department.status.value,
    };
}
```

`use-cases/department/ReparentDepartmentUseCase.ts`:
```ts
import DepartmentNotFoundError from "@modules/organization/core/app/errors/DepartmentNotFoundError";
import ParentDepartmentNotFoundError from "@modules/organization/core/app/errors/ParentDepartmentNotFoundError";
import DepartmentRepo from "@modules/organization/core/app/ports/DepartmentRepo";
import { collectSubtreeIds } from "@modules/organization/core/domain/department-tree";
import DepartmentCannotBeOwnParentError from "@modules/organization/core/domain/errors/DepartmentCannotBeOwnParentError";
import DepartmentCycleError from "@modules/organization/core/domain/errors/DepartmentCycleError";

export interface ReparentDepartmentInput {
    departmentId:       string;
    parentDepartmentId: string | null;
    actorUserId:        string;
}

/**
 * Di chuyển phòng ban sang cha mới, chặn tự làm cha và chặn chu trình.
 *
 * @throws {DepartmentNotFoundError}            Phòng ban không tồn tại.
 * @throws {ParentDepartmentNotFoundError}      Cha mới không tồn tại.
 * @throws {DepartmentCannotBeOwnParentError}   Cha mới trùng chính nó.
 * @throws {DepartmentCycleError}               Cha mới nằm trong cây con của nó.
 */
export default class ReparentDepartmentUseCase {
    public constructor(
        private readonly _departmentRepo: DepartmentRepo,
    ) {}

    public async execute(input: ReparentDepartmentInput): Promise<void> {
        const department = await this._departmentRepo.getById(input.departmentId);
        if (department == undefined) throw new DepartmentNotFoundError();

        const parentId = input.parentDepartmentId;
        if (parentId != undefined) {
            if (parentId === department.id) throw new DepartmentCannotBeOwnParentError();

            const parent = await this._departmentRepo.getById(parentId);
            if (parent == undefined) throw new ParentDepartmentNotFoundError();

            const all = await this._departmentRepo.listAll();
            const subtree = collectSubtreeIds(
                all.map(d => ({ id: d.id, parentDepartmentId: d.parentDepartmentId })),
                department.id,
            );
            if (subtree.has(parentId)) throw new DepartmentCycleError();
        }

        department.reparent(parentId);
        await this._departmentRepo.save(department);
    }
}
```

`use-cases/department/AssignDepartmentHeadUseCase.ts`:
```ts
import DepartmentNotFoundError from "@modules/organization/core/app/errors/DepartmentNotFoundError";
import DepartmentRepo from "@modules/organization/core/app/ports/DepartmentRepo";

export interface AssignDepartmentHeadInput {
    departmentId: string;
    managerId:    string | null;
    actorUserId:  string;
}

/**
 * Gán hoặc gỡ trưởng phòng. `managerId` là id mờ (chưa ràng buộc module nhân sự).
 *
 * @throws {DepartmentNotFoundError} Phòng ban không tồn tại.
 */
export default class AssignDepartmentHeadUseCase {
    public constructor(
        private readonly _departmentRepo: DepartmentRepo,
    ) {}

    public async execute(input: AssignDepartmentHeadInput): Promise<void> {
        const department = await this._departmentRepo.getById(input.departmentId);
        if (department == undefined) throw new DepartmentNotFoundError();

        if (input.managerId == undefined) {
            department.removeHead();
        } else {
            department.assignHead(input.managerId);
        }

        await this._departmentRepo.save(department);
    }
}
```

`use-cases/department/ArchiveDepartmentUseCase.ts`:
```ts
import DepartmentHasChildrenError from "@modules/organization/core/app/errors/DepartmentHasChildrenError";
import DepartmentNotFoundError from "@modules/organization/core/app/errors/DepartmentNotFoundError";
import DepartmentRepo from "@modules/organization/core/app/ports/DepartmentRepo";

/**
 * Lưu trữ (archive) phòng ban. Chặn nếu còn phòng ban con đang active.
 *
 * @throws {DepartmentNotFoundError}    Phòng ban không tồn tại.
 * @throws {DepartmentHasChildrenError} Còn phòng ban con đang hoạt động.
 */
export interface ArchiveDepartmentInput {
    departmentId: string;
    actorUserId:  string;
}

export default class ArchiveDepartmentUseCase {
    public constructor(
        private readonly _departmentRepo: DepartmentRepo,
    ) {}

    public async execute(input: ArchiveDepartmentInput): Promise<void> {
        const department = await this._departmentRepo.getById(input.departmentId);
        if (department == undefined) throw new DepartmentNotFoundError();

        const children = await this._departmentRepo.listChildren(department.id);
        if (children.some(child => child.status.isActive)) {
            throw new DepartmentHasChildrenError("Cannot archive department with active sub-departments");
        }

        department.archive();
        await this._departmentRepo.save(department);
    }
}
```

`use-cases/department/DeleteDepartmentUseCase.ts`:
```ts
import DepartmentHasChildrenError from "@modules/organization/core/app/errors/DepartmentHasChildrenError";
import DepartmentNotFoundError from "@modules/organization/core/app/errors/DepartmentNotFoundError";
import DepartmentRepo from "@modules/organization/core/app/ports/DepartmentRepo";
import PositionRepo from "@modules/organization/core/app/ports/PositionRepo";

export interface DeleteDepartmentInput {
    departmentId: string;
    actorUserId:  string;
}

/**
 * Xoá cứng phòng ban — chỉ khi không còn phòng ban con và không còn vị trí nào
 * trỏ tới. (Ràng buộc nhân viên sẽ bổ sung khi có module employee.)
 *
 * @throws {DepartmentNotFoundError}    Phòng ban không tồn tại.
 * @throws {DepartmentHasChildrenError} Còn phòng ban con hoặc vị trí phụ thuộc.
 */
export default class DeleteDepartmentUseCase {
    public constructor(
        private readonly _departmentRepo: DepartmentRepo,
        private readonly _positionRepo: PositionRepo,
    ) {}

    public async execute(input: DeleteDepartmentInput): Promise<void> {
        const department = await this._departmentRepo.getById(input.departmentId);
        if (department == undefined) throw new DepartmentNotFoundError();

        const [children, positions] = await Promise.all([
            this._departmentRepo.countChildren(department.id),
            this._positionRepo.countByDepartment(department.id),
        ]);

        if (children > 0 || positions > 0) {
            const parts: string[] = [];
            if (children > 0)  parts.push(`${children} sub-department(s)`);
            if (positions > 0) parts.push(`${positions} position(s)`);
            throw new DepartmentHasChildrenError(`Department still has ${parts.join(", ")}`);
        }

        await this._departmentRepo.deleteById(department.id);
    }
}
```

Và 2 domain error còn thiếu (dùng trong ReparentDepartmentUseCase):

`core/domain/errors/DepartmentCannotBeOwnParentError.ts`:
```ts
import DomainError from "@shared/core/domain/DomainError";

export default class DepartmentCannotBeOwnParentError extends DomainError {
    readonly code = "DEPARTMENT_CANNOT_BE_OWN_PARENT";
    readonly httpStatus = 409;

    constructor() {
        super("Department cannot be its own parent");
    }
}
```

`core/domain/errors/DepartmentCycleError.ts`:
```ts
import DomainError from "@shared/core/domain/DomainError";

export default class DepartmentCycleError extends DomainError {
    readonly code = "DEPARTMENT_CYCLE";
    readonly httpStatus = 409;

    constructor() {
        super("Cannot move a department under its own descendant");
    }
}
```

- [ ] **Step 4: Chạy test — kỳ vọng PASS**

Run: `npx vitest run tests/modules/organization/core/app/department-usecases.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/organization/core/app/use-cases/department src/modules/organization/core/domain/errors/DepartmentCannotBeOwnParentError.ts src/modules/organization/core/domain/errors/DepartmentCycleError.ts tests/modules/organization/core/app/department-usecases.test.ts
git commit -m "feat(organization): add department use-cases"
```

---

## Task 8: Use-cases Position

**Files:**
- Create: 6 file trong `src/modules/organization/core/app/use-cases/position/`
- Test: `tests/modules/organization/core/app/position-usecases.test.ts`

**Interfaces:**
- Consumes: `PositionRepo`, `DepartmentRepo` (để kiểm tra phòng ban tồn tại), VO/entity/lỗi.
- Produces:
  - `CreatePositionUseCase.execute({ code, title, departmentId, level?, description?, actorUserId }): Promise<{ positionId: string }>`
  - `UpdatePositionUseCase.execute({ positionId, title?, departmentId?, level?, description?, status?, actorUserId }): Promise<void>`
  - `GetPositionUseCase.execute({ positionId }): Promise<Position>`
  - `ListPositionsUseCase.execute({ departmentId?, status? }): Promise<Position[]>`
  - `ArchivePositionUseCase.execute({ positionId, actorUserId }): Promise<void>`
  - `DeletePositionUseCase.execute({ positionId, actorUserId }): Promise<void>`

- [ ] **Step 1: Viết test fail**

```ts
// tests/modules/organization/core/app/position-usecases.test.ts
import CreatePositionUseCase from "@modules/organization/core/app/use-cases/position/CreatePositionUseCase";
import DepartmentRepo from "@modules/organization/core/app/ports/DepartmentRepo";
import PositionRepo from "@modules/organization/core/app/ports/PositionRepo";
import Department from "@modules/organization/core/domain/entities/Department";
import DepartmentCode from "@modules/organization/core/domain/value-objects/DepartmentCode";
import DepartmentName from "@modules/organization/core/domain/value-objects/DepartmentName";
import DepartmentStatus from "@modules/organization/core/domain/value-objects/DepartmentStatus";
import Description from "@modules/organization/core/domain/value-objects/Description";
import { beforeEach, describe, expect, it } from "vitest";
import { mock, MockProxy } from "vitest-mock-extended";

function dept(id: string): Department {
    return Department.rehydrate({
        id,
        code:               DepartmentCode.create(id),
        name:               DepartmentName.create(id),
        description:        Description.create(),
        parentDepartmentId: null,
        managerId:          null,
        status:             DepartmentStatus.ACTIVE,
        createdAt:          new Date("2026-01-01"),
    });
}

describe("CreatePositionUseCase", () => {
    let positions: MockProxy<PositionRepo>;
    let departments: MockProxy<DepartmentRepo>;
    let useCase: CreatePositionUseCase;

    beforeEach(() => {
        positions = mock<PositionRepo>();
        departments = mock<DepartmentRepo>();
        useCase = new CreatePositionUseCase(positions, departments);
    });

    it("chặn khi phòng ban không tồn tại", async () => {
        departments.getById.mockResolvedValue(undefined);
        await expect(useCase.execute({ code: "DEV", title: "Dev", departmentId: "x", actorUserId: "u" }))
            .rejects.toThrow(/Department not found/i);
    });

    it("chặn khi mã trùng", async () => {
        departments.getById.mockResolvedValue(dept("d1"));
        positions.getByCode.mockResolvedValue({} as never);
        await expect(useCase.execute({ code: "DEV", title: "Dev", departmentId: "d1", actorUserId: "u" }))
            .rejects.toThrow(/code already exists/i);
    });

    it("tạo thành công, level mặc định 1", async () => {
        departments.getById.mockResolvedValue(dept("d1"));
        positions.getByCode.mockResolvedValue(undefined);
        const out = await useCase.execute({ code: "DEV", title: "Dev", departmentId: "d1", actorUserId: "u" });
        expect(out.positionId).toBeTruthy();
        expect(positions.save).toHaveBeenCalledOnce();
    });
});
```

- [ ] **Step 2: Chạy test — kỳ vọng FAIL**

Run: `npx vitest run tests/modules/organization/core/app/position-usecases.test.ts`
Expected: FAIL.

- [ ] **Step 3: Cài đặt use-cases**

`use-cases/position/CreatePositionUseCase.ts`:
```ts
import DepartmentNotFoundError from "@modules/organization/core/app/errors/DepartmentNotFoundError";
import PositionCodeConflictError from "@modules/organization/core/app/errors/PositionCodeConflictError";
import DepartmentRepo from "@modules/organization/core/app/ports/DepartmentRepo";
import PositionRepo from "@modules/organization/core/app/ports/PositionRepo";
import Position from "@modules/organization/core/domain/entities/Position";
import Description from "@modules/organization/core/domain/value-objects/Description";
import PositionCode from "@modules/organization/core/domain/value-objects/PositionCode";
import PositionLevel from "@modules/organization/core/domain/value-objects/PositionLevel";
import PositionTitle from "@modules/organization/core/domain/value-objects/PositionTitle";
import { v7 as UUIDv7 } from "uuid";

const DEFAULT_LEVEL = 1;

export interface CreatePositionInput {
    code:         string;
    title:        string;
    departmentId: string;
    level?:       number;
    description?: string;
    actorUserId:  string;
}

export interface CreatePositionOutput {
    positionId: string;
}

/**
 * Tạo mới một vị trí trong một phòng ban.
 *
 * @throws {DepartmentNotFoundError}   Phòng ban không tồn tại.
 * @throws {PositionCodeConflictError} Mã vị trí đã tồn tại.
 * @throws {PositionCodeInvalidError | PositionTitleInvalidError | PositionLevelInvalidError} Giá trị không hợp lệ.
 */
export default class CreatePositionUseCase {
    public constructor(
        private readonly _positionRepo: PositionRepo,
        private readonly _departmentRepo: DepartmentRepo,
    ) {}

    public async execute(input: CreatePositionInput): Promise<CreatePositionOutput> {
        const department = await this._departmentRepo.getById(input.departmentId);
        if (department == undefined) throw new DepartmentNotFoundError();

        const code = PositionCode.create(input.code);
        const existing = await this._positionRepo.getByCode(code.value);
        if (existing != undefined) throw new PositionCodeConflictError();

        const position = Position.create({
            id:           UUIDv7(),
            code,
            title:        PositionTitle.create(input.title),
            departmentId: input.departmentId,
            level:        PositionLevel.create(input.level ?? DEFAULT_LEVEL),
            description:  Description.create(input.description),
        });

        await this._positionRepo.save(position);

        return { positionId: position.id };
    }
}
```

`use-cases/position/UpdatePositionUseCase.ts`:
```ts
import DepartmentNotFoundError from "@modules/organization/core/app/errors/DepartmentNotFoundError";
import PositionNotFoundError from "@modules/organization/core/app/errors/PositionNotFoundError";
import DepartmentRepo from "@modules/organization/core/app/ports/DepartmentRepo";
import PositionRepo from "@modules/organization/core/app/ports/PositionRepo";
import Description from "@modules/organization/core/domain/value-objects/Description";
import PositionLevel from "@modules/organization/core/domain/value-objects/PositionLevel";
import PositionStatus from "@modules/organization/core/domain/value-objects/PositionStatus";
import PositionTitle from "@modules/organization/core/domain/value-objects/PositionTitle";

export interface UpdatePositionInput {
    positionId:   string;
    title?:       string;
    departmentId?: string;
    level?:       number;
    description?: string;
    status?:      string;
    actorUserId:  string;
}

/**
 * Cập nhật vị trí: đổi tên/level/mô tả, chuyển phòng ban, đổi trạng thái.
 *
 * @throws {PositionNotFoundError}   Vị trí không tồn tại.
 * @throws {DepartmentNotFoundError} Phòng ban đích (khi chuyển) không tồn tại.
 * @throws {PositionTitleInvalidError | PositionLevelInvalidError | PositionStatusInvalidError} Giá trị không hợp lệ.
 */
export default class UpdatePositionUseCase {
    public constructor(
        private readonly _positionRepo: PositionRepo,
        private readonly _departmentRepo: DepartmentRepo,
    ) {}

    public async execute(input: UpdatePositionInput): Promise<void> {
        const position = await this._positionRepo.getById(input.positionId);
        if (position == undefined) throw new PositionNotFoundError();

        if (input.departmentId != undefined) {
            const department = await this._departmentRepo.getById(input.departmentId);
            if (department == undefined) throw new DepartmentNotFoundError();
            position.moveToDepartment(input.departmentId);
        }
        if (input.title != undefined) {
            position.rename(PositionTitle.create(input.title));
        }
        if (input.level != undefined) {
            position.changeLevel(PositionLevel.create(input.level));
        }
        if (input.description != undefined) {
            position.changeDescription(Description.create(input.description));
        }
        if (input.status != undefined) {
            const status = PositionStatus.create(input.status);
            if (status.isActive) position.activate();
            else position.archive();
        }

        await this._positionRepo.save(position);
    }
}
```

`use-cases/position/GetPositionUseCase.ts`:
```ts
import PositionNotFoundError from "@modules/organization/core/app/errors/PositionNotFoundError";
import PositionRepo from "@modules/organization/core/app/ports/PositionRepo";
import Position from "@modules/organization/core/domain/entities/Position";

export interface GetPositionInput {
    positionId: string;
}

/**
 * Lấy chi tiết một vị trí.
 *
 * @throws {PositionNotFoundError} Vị trí không tồn tại.
 */
export default class GetPositionUseCase {
    public constructor(
        private readonly _positionRepo: PositionRepo,
    ) {}

    public async execute(input: GetPositionInput): Promise<Position> {
        const position = await this._positionRepo.getById(input.positionId);
        if (position == undefined) throw new PositionNotFoundError();
        return position;
    }
}
```

`use-cases/position/ListPositionsUseCase.ts`:
```ts
import PositionRepo, { PositionListFilter } from "@modules/organization/core/app/ports/PositionRepo";
import Position from "@modules/organization/core/domain/entities/Position";

/**
 * Liệt kê vị trí, lọc tuỳ chọn theo phòng ban và trạng thái.
 */
export default class ListPositionsUseCase {
    public constructor(
        private readonly _positionRepo: PositionRepo,
    ) {}

    public async execute(input: PositionListFilter): Promise<Position[]> {
        return this._positionRepo.list(input);
    }
}
```

`use-cases/position/ArchivePositionUseCase.ts`:
```ts
import PositionNotFoundError from "@modules/organization/core/app/errors/PositionNotFoundError";
import PositionRepo from "@modules/organization/core/app/ports/PositionRepo";

export interface ArchivePositionInput {
    positionId:  string;
    actorUserId: string;
}

/**
 * Lưu trữ (soft) một vị trí — ẩn khỏi bộ chọn nhưng giữ tham chiếu lịch sử.
 *
 * @throws {PositionNotFoundError} Vị trí không tồn tại.
 */
export default class ArchivePositionUseCase {
    public constructor(
        private readonly _positionRepo: PositionRepo,
    ) {}

    public async execute(input: ArchivePositionInput): Promise<void> {
        const position = await this._positionRepo.getById(input.positionId);
        if (position == undefined) throw new PositionNotFoundError();

        position.archive();
        await this._positionRepo.save(position);
    }
}
```

`use-cases/position/DeletePositionUseCase.ts`:
```ts
import PositionNotFoundError from "@modules/organization/core/app/errors/PositionNotFoundError";
import PositionRepo from "@modules/organization/core/app/ports/PositionRepo";

export interface DeletePositionInput {
    positionId:  string;
    actorUserId: string;
}

/**
 * Xoá cứng một vị trí. Trong pilot chưa có module nhân sự nên không đếm nhân
 * viên tham chiếu — ràng buộc đó sẽ bổ sung sau qua gateway/EventBus.
 *
 * @throws {PositionNotFoundError} Vị trí không tồn tại.
 */
export default class DeletePositionUseCase {
    public constructor(
        private readonly _positionRepo: PositionRepo,
    ) {}

    public async execute(input: DeletePositionInput): Promise<void> {
        const position = await this._positionRepo.getById(input.positionId);
        if (position == undefined) throw new PositionNotFoundError();

        await this._positionRepo.deleteById(position.id);
    }
}
```

- [ ] **Step 4: Chạy test — kỳ vọng PASS**

Run: `npx vitest run tests/modules/organization/core/app/position-usecases.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/organization/core/app/use-cases/position tests/modules/organization/core/app/position-usecases.test.ts
git commit -m "feat(organization): add position use-cases"
```

---

## Task 9: Persistence adapters (Mongo)

**Files:**
- Create: `src/modules/organization/adapters/driven/persistence/mongodb/collections.ts`
- Create: `src/modules/organization/adapters/driven/persistence/mongodb/MongoRepository.ts`
- Create: `.../documents/DepartmentDocument.ts`, `.../documents/PositionDocument.ts`
- Create: `.../mappers/DepartmentMapper.ts`, `.../mappers/PositionMapper.ts`
- Create: `.../repositories/MongoDepartmentRepo.ts`, `.../repositories/MongoPositionRepo.ts`
- Create: `.../index.ts` (barrel)
- Test: `tests/modules/organization/adapters/persistence/mappers.test.ts`

**Interfaces:**
- Consumes: entity + VO ở Task 2–4; `DepartmentRepo`/`PositionRepo` ports; base `MongoRepository`.
- Produces:
  - `ORG_COLLECTIONS = { departments: "org_departments", positions: "org_positions" }`
  - `MongoDepartmentRepo implements DepartmentRepo` + static `ensureIndexes(db)`.
  - `MongoPositionRepo implements PositionRepo` + static `ensureIndexes(db)`.
  - barrel export: `ORG_COLLECTIONS`, `MongoDepartmentRepo`, `MongoPositionRepo`.

- [ ] **Step 1: Viết test fail (mapper round-trip)**

```ts
// tests/modules/organization/adapters/persistence/mappers.test.ts
import DepartmentMapper from "@modules/organization/adapters/driven/persistence/mongodb/mappers/DepartmentMapper";
import PositionMapper from "@modules/organization/adapters/driven/persistence/mongodb/mappers/PositionMapper";
import Department from "@modules/organization/core/domain/entities/Department";
import Position from "@modules/organization/core/domain/entities/Position";
import DepartmentCode from "@modules/organization/core/domain/value-objects/DepartmentCode";
import DepartmentName from "@modules/organization/core/domain/value-objects/DepartmentName";
import Description from "@modules/organization/core/domain/value-objects/Description";
import PositionCode from "@modules/organization/core/domain/value-objects/PositionCode";
import PositionLevel from "@modules/organization/core/domain/value-objects/PositionLevel";
import PositionTitle from "@modules/organization/core/domain/value-objects/PositionTitle";
import { describe, expect, it } from "vitest";

describe("DepartmentMapper", () => {
    it("round-trip document <-> domain", () => {
        const dept = Department.create({
            id:                 "d1",
            code:               DepartmentCode.create("ENG"),
            name:               DepartmentName.create("Engineering"),
            description:        Description.create("desc"),
            parentDepartmentId: null,
            managerId:          "m1",
        });
        const doc = DepartmentMapper.toDocument(dept);
        expect(doc._id).toBe("d1");
        const back = DepartmentMapper.toDomain(doc);
        expect(back.code.value).toBe("ENG");
        expect(back.managerId).toBe("m1");
    });
});

describe("PositionMapper", () => {
    it("round-trip", () => {
        const pos = Position.create({
            id:           "p1",
            code:         PositionCode.create("DEV"),
            title:        PositionTitle.create("Developer"),
            departmentId: "d1",
            level:        PositionLevel.create(4),
            description:  Description.create(),
        });
        const back = PositionMapper.toDomain(PositionMapper.toDocument(pos));
        expect(back.level.value).toBe(4);
        expect(back.departmentId).toBe("d1");
    });
});
```

- [ ] **Step 2: Chạy test — kỳ vọng FAIL**

Run: `npx vitest run tests/modules/organization/adapters/persistence/mappers.test.ts`
Expected: FAIL.

- [ ] **Step 3: Cài đặt**

`collections.ts`:
```ts
/** Tên collection MongoDB của module Organization (đặt tiền tố `org_`). */
export const ORG_COLLECTIONS = {
    departments: "org_departments",
    positions:   "org_positions",
} as const;
```

`MongoRepository.ts` (bản sao của task-mgmt — mỗi module giữ base riêng):
```ts
import { ClientSession, Collection, Db, Document } from "mongodb";

/**
 * Lớp cơ sở cho repository MongoDB của module. Giữ tham chiếu collection và
 * (tuỳ chọn) session để chạy trong transaction.
 */
export default abstract class MongoRepository<TDocument extends Document> {
    protected readonly _collection: Collection<TDocument>;

    protected constructor(
        db: Db,
        collectionName: string,
        protected readonly _session?: ClientSession,
    ) {
        this._collection = db.collection<TDocument>(collectionName);
    }

    protected get _sessionOptions(): { session?: ClientSession } {
        return this._session ? { session: this._session } : {};
    }
}
```

`documents/DepartmentDocument.ts`:
```ts
/** Dạng document lưu trữ của aggregate `Department`. */
export default interface DepartmentDocument {
    _id:                string;
    code:               string;
    name:               string;
    description:        string;
    parentDepartmentId: string | null;
    managerId:          string | null;
    status:             string;
    createdAt:          Date;
}
```

`documents/PositionDocument.ts`:
```ts
/** Dạng document lưu trữ của aggregate `Position`. */
export default interface PositionDocument {
    _id:          string;
    code:         string;
    title:        string;
    departmentId: string;
    level:        number;
    description:  string;
    status:       string;
    createdAt:    Date;
}
```

`mappers/DepartmentMapper.ts`:
```ts
import DepartmentDocument from "@modules/organization/adapters/driven/persistence/mongodb/documents/DepartmentDocument";
import Department from "@modules/organization/core/domain/entities/Department";
import DepartmentCode from "@modules/organization/core/domain/value-objects/DepartmentCode";
import DepartmentName from "@modules/organization/core/domain/value-objects/DepartmentName";
import DepartmentStatus from "@modules/organization/core/domain/value-objects/DepartmentStatus";
import Description from "@modules/organization/core/domain/value-objects/Description";

const DepartmentMapper = {
    toDocument(department: Department): DepartmentDocument {
        return {
            _id:                department.id,
            code:               department.code.value,
            name:               department.name.value,
            description:        department.description.value,
            parentDepartmentId: department.parentDepartmentId,
            managerId:          department.managerId,
            status:             department.status.value,
            createdAt:          department.createdAt,
        };
    },

    toDomain(document: DepartmentDocument): Department {
        return Department.rehydrate({
            id:                 document._id,
            code:               DepartmentCode.create(document.code),
            name:               DepartmentName.create(document.name),
            description:        Description.create(document.description),
            parentDepartmentId: document.parentDepartmentId,
            managerId:          document.managerId,
            status:             DepartmentStatus.create(document.status),
            createdAt:          document.createdAt,
        });
    },
};

export default DepartmentMapper;
```

`mappers/PositionMapper.ts`:
```ts
import PositionDocument from "@modules/organization/adapters/driven/persistence/mongodb/documents/PositionDocument";
import Position from "@modules/organization/core/domain/entities/Position";
import Description from "@modules/organization/core/domain/value-objects/Description";
import PositionCode from "@modules/organization/core/domain/value-objects/PositionCode";
import PositionLevel from "@modules/organization/core/domain/value-objects/PositionLevel";
import PositionStatus from "@modules/organization/core/domain/value-objects/PositionStatus";
import PositionTitle from "@modules/organization/core/domain/value-objects/PositionTitle";

const PositionMapper = {
    toDocument(position: Position): PositionDocument {
        return {
            _id:          position.id,
            code:         position.code.value,
            title:        position.title.value,
            departmentId: position.departmentId,
            level:        position.level.value,
            description:  position.description.value,
            status:       position.status.value,
            createdAt:    position.createdAt,
        };
    },

    toDomain(document: PositionDocument): Position {
        return Position.rehydrate({
            id:           document._id,
            code:         PositionCode.create(document.code),
            title:        PositionTitle.create(document.title),
            departmentId: document.departmentId,
            level:        PositionLevel.create(document.level),
            description:  Description.create(document.description),
            status:       PositionStatus.create(document.status),
            createdAt:    document.createdAt,
        });
    },
};

export default PositionMapper;
```

`repositories/MongoDepartmentRepo.ts`:
```ts
import DepartmentDocument from "@modules/organization/adapters/driven/persistence/mongodb/documents/DepartmentDocument";
import DepartmentMapper from "@modules/organization/adapters/driven/persistence/mongodb/mappers/DepartmentMapper";
import MongoRepository from "@modules/organization/adapters/driven/persistence/mongodb/MongoRepository";
import { ORG_COLLECTIONS } from "@modules/organization/adapters/driven/persistence/mongodb/collections";
import DepartmentRepo from "@modules/organization/core/app/ports/DepartmentRepo";
import Department from "@modules/organization/core/domain/entities/Department";
import { ClientSession, Db } from "mongodb";

export default class MongoDepartmentRepo extends MongoRepository<DepartmentDocument> implements DepartmentRepo {
    public constructor(db: Db, session?: ClientSession) {
        super(db, ORG_COLLECTIONS.departments, session);
    }

    /** Index: mã phòng ban là duy nhất; index theo cha để liệt kê con. */
    public static async ensureIndexes(db: Db): Promise<void> {
        const collection = db.collection<DepartmentDocument>(ORG_COLLECTIONS.departments);
        await collection.createIndex({ code: 1 }, { unique: true });
        await collection.createIndex({ parentDepartmentId: 1 });
    }

    public async getById(id: string): Promise<Department | undefined> {
        const document = await this._collection.findOne({ _id: id }, this._sessionOptions);
        return document ? DepartmentMapper.toDomain(document) : undefined;
    }

    public async getByCode(code: string): Promise<Department | undefined> {
        const document = await this._collection.findOne({ code }, this._sessionOptions);
        return document ? DepartmentMapper.toDomain(document) : undefined;
    }

    public async listAll(): Promise<Department[]> {
        const documents = await this._collection
            .find({}, { sort: { createdAt: 1 }, ...this._sessionOptions })
            .toArray();
        return documents.map(DepartmentMapper.toDomain);
    }

    public async listChildren(parentDepartmentId: string): Promise<Department[]> {
        const documents = await this._collection
            .find({ parentDepartmentId }, this._sessionOptions)
            .toArray();
        return documents.map(DepartmentMapper.toDomain);
    }

    public async countChildren(parentDepartmentId: string): Promise<number> {
        return this._collection.countDocuments({ parentDepartmentId }, this._sessionOptions);
    }

    public async save(department: Department): Promise<void> {
        const { _id, ...body } = DepartmentMapper.toDocument(department);
        await this._collection.replaceOne({ _id }, body, { upsert: true, ...this._sessionOptions });
    }

    public async deleteById(id: string): Promise<void> {
        await this._collection.deleteOne({ _id: id }, this._sessionOptions);
    }
}
```

`repositories/MongoPositionRepo.ts`:
```ts
import PositionDocument from "@modules/organization/adapters/driven/persistence/mongodb/documents/PositionDocument";
import PositionMapper from "@modules/organization/adapters/driven/persistence/mongodb/mappers/PositionMapper";
import MongoRepository from "@modules/organization/adapters/driven/persistence/mongodb/MongoRepository";
import { ORG_COLLECTIONS } from "@modules/organization/adapters/driven/persistence/mongodb/collections";
import PositionRepo, { PositionListFilter } from "@modules/organization/core/app/ports/PositionRepo";
import Position from "@modules/organization/core/domain/entities/Position";
import { ClientSession, Db, Filter } from "mongodb";

export default class MongoPositionRepo extends MongoRepository<PositionDocument> implements PositionRepo {
    public constructor(db: Db, session?: ClientSession) {
        super(db, ORG_COLLECTIONS.positions, session);
    }

    /** Index: mã vị trí duy nhất; index theo phòng ban để lọc. */
    public static async ensureIndexes(db: Db): Promise<void> {
        const collection = db.collection<PositionDocument>(ORG_COLLECTIONS.positions);
        await collection.createIndex({ code: 1 }, { unique: true });
        await collection.createIndex({ departmentId: 1 });
    }

    public async getById(id: string): Promise<Position | undefined> {
        const document = await this._collection.findOne({ _id: id }, this._sessionOptions);
        return document ? PositionMapper.toDomain(document) : undefined;
    }

    public async getByCode(code: string): Promise<Position | undefined> {
        const document = await this._collection.findOne({ code }, this._sessionOptions);
        return document ? PositionMapper.toDomain(document) : undefined;
    }

    public async list(filter: PositionListFilter): Promise<Position[]> {
        const query: Filter<PositionDocument> = {};
        if (filter.departmentId != undefined) query.departmentId = filter.departmentId;
        if (filter.status != undefined)       query.status = filter.status;

        const documents = await this._collection
            .find(query, { sort: { level: 1, createdAt: 1 }, ...this._sessionOptions })
            .toArray();
        return documents.map(PositionMapper.toDomain);
    }

    public async countByDepartment(departmentId: string): Promise<number> {
        return this._collection.countDocuments({ departmentId }, this._sessionOptions);
    }

    public async save(position: Position): Promise<void> {
        const { _id, ...body } = PositionMapper.toDocument(position);
        await this._collection.replaceOne({ _id }, body, { upsert: true, ...this._sessionOptions });
    }

    public async deleteById(id: string): Promise<void> {
        await this._collection.deleteOne({ _id: id }, this._sessionOptions);
    }
}
```

`index.ts` (barrel):
```ts
export { ORG_COLLECTIONS } from "@modules/organization/adapters/driven/persistence/mongodb/collections";
export { default as MongoDepartmentRepo } from "@modules/organization/adapters/driven/persistence/mongodb/repositories/MongoDepartmentRepo";
export { default as MongoPositionRepo } from "@modules/organization/adapters/driven/persistence/mongodb/repositories/MongoPositionRepo";
```

- [ ] **Step 4: Chạy test — kỳ vọng PASS**

Run: `npx vitest run tests/modules/organization/adapters/persistence/mappers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/organization/adapters/driven tests/modules/organization/adapters/persistence/mappers.test.ts
git commit -m "feat(organization): add mongodb persistence adapters"
```

---

## Task 10: HTTP driver adapter (controllers, presenters, router, barrel module)

**Files:**
- Create: `.../driver/http/presenters/DepartmentPresenter.ts`, `.../presenters/PositionPresenter.ts`
- Create: `.../driver/http/controllers/DepartmentController.ts`, `.../controllers/PositionController.ts`
- Create: `.../driver/http/index.ts`
- Create: `src/modules/organization/index.ts`
- Test: `tests/modules/organization/adapters/http/presenters.test.ts`

**Interfaces:**
- Consumes: use-cases (Task 7–8), `bodySchema`/`field`, `ActorContext`, `authenticate`, `errorHandler`, `AccessTokenVerifier`.
- Produces:
  - `DepartmentPresenter.toDTO(dept): DepartmentDTO`, `PositionPresenter.toDTO(pos): PositionDTO`.
  - `OrganizationHttpUseCases` (giao cắt của `DepartmentControllerUseCases & PositionControllerUseCases`).
  - `createOrganizationHttpRouter(useCases, accessTokenVerifier): Router`.
  - barrel `modules/organization/index.ts` re-export `createOrganizationHttpRouter` + type `OrganizationHttpUseCases`.

- [ ] **Step 1: Viết test fail (presenter)**

```ts
// tests/modules/organization/adapters/http/presenters.test.ts
import DepartmentPresenter from "@modules/organization/adapters/driver/http/presenters/DepartmentPresenter";
import Department from "@modules/organization/core/domain/entities/Department";
import DepartmentCode from "@modules/organization/core/domain/value-objects/DepartmentCode";
import DepartmentName from "@modules/organization/core/domain/value-objects/DepartmentName";
import Description from "@modules/organization/core/domain/value-objects/Description";
import { describe, expect, it } from "vitest";

describe("DepartmentPresenter", () => {
    it("chuyển entity thành DTO với createdAt dạng ISO", () => {
        const dept = Department.create({
            id:                 "d1",
            code:               DepartmentCode.create("ENG"),
            name:               DepartmentName.create("Engineering"),
            description:        Description.create(),
            parentDepartmentId: null,
            managerId:          null,
        });
        const dto = DepartmentPresenter.toDTO(dept);
        expect(dto.id).toBe("d1");
        expect(dto.code).toBe("ENG");
        expect(dto.status).toBe("active");
        expect(typeof dto.createdAt).toBe("string");
    });
});
```

- [ ] **Step 2: Chạy test — kỳ vọng FAIL**

Run: `npx vitest run tests/modules/organization/adapters/http/presenters.test.ts`
Expected: FAIL.

- [ ] **Step 3: Cài đặt**

`presenters/DepartmentPresenter.ts`:
```ts
import Department from "@modules/organization/core/domain/entities/Department";

export interface DepartmentDTO {
    id:                 string;
    code:               string;
    name:               string;
    description:        string;
    parentDepartmentId: string | null;
    managerId:          string | null;
    status:             string;
    createdAt:          string;
}

const DepartmentPresenter = {
    toDTO(department: Department): DepartmentDTO {
        return {
            id:                 department.id,
            code:               department.code.value,
            name:               department.name.value,
            description:        department.description.value,
            parentDepartmentId: department.parentDepartmentId,
            managerId:          department.managerId,
            status:             department.status.value,
            createdAt:          department.createdAt.toISOString(),
        };
    },
};

export default DepartmentPresenter;
```

`presenters/PositionPresenter.ts`:
```ts
import Position from "@modules/organization/core/domain/entities/Position";

export interface PositionDTO {
    id:           string;
    code:         string;
    title:        string;
    departmentId: string;
    level:        number;
    description:  string;
    status:       string;
    createdAt:    string;
}

const PositionPresenter = {
    toDTO(position: Position): PositionDTO {
        return {
            id:           position.id,
            code:         position.code.value,
            title:        position.title.value,
            departmentId: position.departmentId,
            level:        position.level.value,
            description:  position.description.value,
            status:       position.status.value,
            createdAt:    position.createdAt.toISOString(),
        };
    },
};

export default PositionPresenter;
```

`controllers/DepartmentController.ts`:
```ts
import DepartmentPresenter from "@modules/organization/adapters/driver/http/presenters/DepartmentPresenter";
import ArchiveDepartmentUseCase from "@modules/organization/core/app/use-cases/department/ArchiveDepartmentUseCase";
import AssignDepartmentHeadUseCase from "@modules/organization/core/app/use-cases/department/AssignDepartmentHeadUseCase";
import CreateDepartmentUseCase from "@modules/organization/core/app/use-cases/department/CreateDepartmentUseCase";
import DeleteDepartmentUseCase from "@modules/organization/core/app/use-cases/department/DeleteDepartmentUseCase";
import GetDepartmentUseCase from "@modules/organization/core/app/use-cases/department/GetDepartmentUseCase";
import ListDepartmentsUseCase from "@modules/organization/core/app/use-cases/department/ListDepartmentsUseCase";
import ReparentDepartmentUseCase from "@modules/organization/core/app/use-cases/department/ReparentDepartmentUseCase";
import UpdateDepartmentUseCase from "@modules/organization/core/app/use-cases/department/UpdateDepartmentUseCase";
import ActorContext from "@shared/adapters/driver/http/ActorContext";
import { bodySchema, field } from "@shared/adapters/driver/http/validation";
import { Request, Response } from "express";

export interface DepartmentControllerUseCases {
    createDepartment:     CreateDepartmentUseCase;
    updateDepartment:     UpdateDepartmentUseCase;
    getDepartment:        GetDepartmentUseCase;
    listDepartments:      ListDepartmentsUseCase;
    reparentDepartment:   ReparentDepartmentUseCase;
    assignDepartmentHead: AssignDepartmentHeadUseCase;
    archiveDepartment:    ArchiveDepartmentUseCase;
    deleteDepartment:     DeleteDepartmentUseCase;
}

const bodySchemaCreateDepartment = bodySchema({
    code:               field.string,
    name:               field.string,
    description:        field.optionalString,
    parentDepartmentId: field.optionalString,
    managerId:          field.optionalString,
});

const bodySchemaUpdateDepartment = bodySchema({
    code:        field.optionalString,
    name:        field.optionalString,
    description: field.optionalString,
});

const bodySchemaReparent = bodySchema({
    parentDepartmentId: field.optionalString,
});

const bodySchemaAssignHead = bodySchema({
    managerId: field.optionalString,
});

/**
 * Controller nhóm endpoint Department (docs/api.html § Organization): parse
 * request, gọi use-case, ghi response — không chứa nghiệp vụ. Handler là arrow
 * property để giữ `this` khi truyền rời vào danh sách route.
 */
export default class DepartmentController {
    public constructor(
        private readonly _useCases: DepartmentControllerUseCases,
    ) {}

    public createDepartment = async (req: Request, res: Response): Promise<void> => {
        const output = await this._useCases.createDepartment.execute({
            ...bodySchemaCreateDepartment.parse(req.body),
            actorUserId: ActorContext.get(res),
        });
        res.status(201).json(output);
    };

    public listDepartments = async (req: Request, res: Response): Promise<void> => {
        const departments = await this._useCases.listDepartments.execute({
            tree: req.query.tree === "true",
        });
        res.status(200).json({ departments });
    };

    public getDepartment = async (req: Request<{ departmentId: string }>, res: Response): Promise<void> => {
        const department = await this._useCases.getDepartment.execute({
            departmentId: req.params.departmentId,
        });
        res.status(200).json(DepartmentPresenter.toDTO(department));
    };

    public updateDepartment = async (req: Request<{ departmentId: string }>, res: Response): Promise<void> => {
        await this._useCases.updateDepartment.execute({
            ...bodySchemaUpdateDepartment.parse(req.body),
            departmentId: req.params.departmentId,
            actorUserId:  ActorContext.get(res),
        });
        res.status(200).end();
    };

    public reparentDepartment = async (req: Request<{ departmentId: string }>, res: Response): Promise<void> => {
        const body = bodySchemaReparent.parse(req.body);
        await this._useCases.reparentDepartment.execute({
            departmentId:       req.params.departmentId,
            parentDepartmentId: body.parentDepartmentId ?? null,
            actorUserId:        ActorContext.get(res),
        });
        res.status(200).end();
    };

    public assignDepartmentHead = async (req: Request<{ departmentId: string }>, res: Response): Promise<void> => {
        const body = bodySchemaAssignHead.parse(req.body);
        await this._useCases.assignDepartmentHead.execute({
            departmentId: req.params.departmentId,
            managerId:    body.managerId ?? null,
            actorUserId:  ActorContext.get(res),
        });
        res.status(200).end();
    };

    public archiveDepartment = async (req: Request<{ departmentId: string }>, res: Response): Promise<void> => {
        await this._useCases.archiveDepartment.execute({
            departmentId: req.params.departmentId,
            actorUserId:  ActorContext.get(res),
        });
        res.status(200).end();
    };

    public deleteDepartment = async (req: Request<{ departmentId: string }>, res: Response): Promise<void> => {
        await this._useCases.deleteDepartment.execute({
            departmentId: req.params.departmentId,
            actorUserId:  ActorContext.get(res),
        });
        res.status(200).end();
    };
}
```

`controllers/PositionController.ts`:
```ts
import PositionPresenter from "@modules/organization/adapters/driver/http/presenters/PositionPresenter";
import ArchivePositionUseCase from "@modules/organization/core/app/use-cases/position/ArchivePositionUseCase";
import CreatePositionUseCase from "@modules/organization/core/app/use-cases/position/CreatePositionUseCase";
import DeletePositionUseCase from "@modules/organization/core/app/use-cases/position/DeletePositionUseCase";
import GetPositionUseCase from "@modules/organization/core/app/use-cases/position/GetPositionUseCase";
import ListPositionsUseCase from "@modules/organization/core/app/use-cases/position/ListPositionsUseCase";
import UpdatePositionUseCase from "@modules/organization/core/app/use-cases/position/UpdatePositionUseCase";
import ActorContext from "@shared/adapters/driver/http/ActorContext";
import { bodySchema, field } from "@shared/adapters/driver/http/validation";
import { Request, Response } from "express";

export interface PositionControllerUseCases {
    createPosition:  CreatePositionUseCase;
    updatePosition:  UpdatePositionUseCase;
    getPosition:     GetPositionUseCase;
    listPositions:   ListPositionsUseCase;
    archivePosition: ArchivePositionUseCase;
    deletePosition:  DeletePositionUseCase;
}

const bodySchemaCreatePosition = bodySchema({
    code:         field.string,
    title:        field.string,
    departmentId: field.string,
    level:        field.optionalNumber,
    description:  field.optionalString,
});

const bodySchemaUpdatePosition = bodySchema({
    title:        field.optionalString,
    departmentId: field.optionalString,
    level:        field.optionalNumber,
    description:  field.optionalString,
    status:       field.optionalString,
});

/**
 * Controller nhóm endpoint Position (docs/api.html § Organization).
 */
export default class PositionController {
    public constructor(
        private readonly _useCases: PositionControllerUseCases,
    ) {}

    public createPosition = async (req: Request, res: Response): Promise<void> => {
        const output = await this._useCases.createPosition.execute({
            ...bodySchemaCreatePosition.parse(req.body),
            actorUserId: ActorContext.get(res),
        });
        res.status(201).json(output);
    };

    public listPositions = async (req: Request, res: Response): Promise<void> => {
        const positions = await this._useCases.listPositions.execute({
            departmentId: typeof req.query.departmentId === "string" ? req.query.departmentId : undefined,
            status:       typeof req.query.status === "string" ? req.query.status : undefined,
        });
        res.status(200).json({ positions: positions.map(position => PositionPresenter.toDTO(position)) });
    };

    public getPosition = async (req: Request<{ positionId: string }>, res: Response): Promise<void> => {
        const position = await this._useCases.getPosition.execute({ positionId: req.params.positionId });
        res.status(200).json(PositionPresenter.toDTO(position));
    };

    public updatePosition = async (req: Request<{ positionId: string }>, res: Response): Promise<void> => {
        await this._useCases.updatePosition.execute({
            ...bodySchemaUpdatePosition.parse(req.body),
            positionId:  req.params.positionId,
            actorUserId: ActorContext.get(res),
        });
        res.status(200).end();
    };

    public archivePosition = async (req: Request<{ positionId: string }>, res: Response): Promise<void> => {
        await this._useCases.archivePosition.execute({
            positionId:  req.params.positionId,
            actorUserId: ActorContext.get(res),
        });
        res.status(200).end();
    };

    public deletePosition = async (req: Request<{ positionId: string }>, res: Response): Promise<void> => {
        await this._useCases.deletePosition.execute({
            positionId:  req.params.positionId,
            actorUserId: ActorContext.get(res),
        });
        res.status(200).end();
    };
}
```

`driver/http/index.ts`:
```ts
import DepartmentController, { DepartmentControllerUseCases } from "@modules/organization/adapters/driver/http/controllers/DepartmentController";
import PositionController, { PositionControllerUseCases } from "@modules/organization/adapters/driver/http/controllers/PositionController";
import authenticate from "@shared/adapters/driver/http/middlewares/authenticate";
import errorHandler from "@shared/adapters/driver/http/middlewares/errorHandler";
import AccessTokenVerifier from "@shared/adapters/driver/http/ports/AccessTokenVerifier";
import { json, Router } from "express";

/**
 * Toàn bộ use-case mà driver adapter HTTP của module Organization cần
 * (ánh xạ 1:1 với docs/api.html § Organization).
 */
export type OrganizationHttpUseCases =
    & DepartmentControllerUseCases
    & PositionControllerUseCases;

/**
 * Driver adapter HTTP của module Organization. Giữ danh sách route duy nhất —
 * nhìn một chỗ thấy toàn bộ bề mặt API: parse JSON body, xác thực Bearer token,
 * định tuyến tới controller, dịch lỗi thành `{ code, message }`.
 */
export function createOrganizationHttpRouter(
    useCases: OrganizationHttpUseCases,
    accessTokenVerifier: AccessTokenVerifier,
): Router {
    const departmentController = new DepartmentController(useCases);
    const positionController   = new PositionController(useCases);

    const router = Router();

    router.use(json());
    router.use(authenticate(accessTokenVerifier));

    // Department (docs/api.html § Organization)
    router.post  ("/departments",                       departmentController.createDepartment);
    router.get   ("/departments",                       departmentController.listDepartments);
    router.get   ("/departments/:departmentId",         departmentController.getDepartment);
    router.patch ("/departments/:departmentId",         departmentController.updateDepartment);
    router.patch ("/departments/:departmentId/parent",  departmentController.reparentDepartment);
    router.patch ("/departments/:departmentId/head",    departmentController.assignDepartmentHead);
    router.post  ("/departments/:departmentId/archive", departmentController.archiveDepartment);
    router.delete("/departments/:departmentId",         departmentController.deleteDepartment);

    // Position (docs/api.html § Organization)
    router.post  ("/positions",                         positionController.createPosition);
    router.get   ("/positions",                         positionController.listPositions);
    router.get   ("/positions/:positionId",             positionController.getPosition);
    router.patch ("/positions/:positionId",             positionController.updatePosition);
    router.post  ("/positions/:positionId/archive",     positionController.archivePosition);
    router.delete("/positions/:positionId",             positionController.deletePosition);

    router.use(errorHandler);

    return router;
}
```

`src/modules/organization/index.ts`:
```ts
// API công khai của module Organization.
// Chỉ những symbol export ở đây mới truy cập được từ các module khác.

export { createOrganizationHttpRouter } from "@modules/organization/adapters/driver/http";
export type { OrganizationHttpUseCases } from "@modules/organization/adapters/driver/http";
```

- [ ] **Step 4: Chạy test — kỳ vọng PASS**

Run: `npx vitest run tests/modules/organization/adapters/http/presenters.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/organization/adapters/driver src/modules/organization/index.ts tests/modules/organization/adapters/http/presenters.test.ts
git commit -m "feat(organization): add http controllers, presenters, router and module barrel"
```

---

## Task 11: Wiring infra (DI factory, ensureIndexes, express server, server.ts)

**Files:**
- Create: `src/infra/di/createOrganizationHttpUseCases.ts`
- Modify: `src/infra/db/ensureMongoIndexes.ts`
- Modify: `src/infra/server/createExpressServer.ts`
- Modify: `src/server.ts`

**Interfaces:**
- Consumes: `MongoDepartmentRepo`, `MongoPositionRepo`, tất cả use-case, `OrganizationHttpUseCases`.
- Produces: `createOrganizationHttpUseCases(mongoDb): OrganizationHttpUseCases`; router mounted `/organization`.

> Không TDD đơn vị cho wiring; kiểm chứng bằng biên dịch + test tích hợp ở Task 12.

- [ ] **Step 1: Tạo DI factory**

`src/infra/di/createOrganizationHttpUseCases.ts`:
```ts
import { MongoDepartmentRepo, MongoPositionRepo } from "@modules/organization/adapters/driven/persistence/mongodb";
import { OrganizationHttpUseCases } from "@modules/organization/adapters/driver/http";
import ArchiveDepartmentUseCase from "@modules/organization/core/app/use-cases/department/ArchiveDepartmentUseCase";
import AssignDepartmentHeadUseCase from "@modules/organization/core/app/use-cases/department/AssignDepartmentHeadUseCase";
import CreateDepartmentUseCase from "@modules/organization/core/app/use-cases/department/CreateDepartmentUseCase";
import DeleteDepartmentUseCase from "@modules/organization/core/app/use-cases/department/DeleteDepartmentUseCase";
import GetDepartmentUseCase from "@modules/organization/core/app/use-cases/department/GetDepartmentUseCase";
import ListDepartmentsUseCase from "@modules/organization/core/app/use-cases/department/ListDepartmentsUseCase";
import ReparentDepartmentUseCase from "@modules/organization/core/app/use-cases/department/ReparentDepartmentUseCase";
import UpdateDepartmentUseCase from "@modules/organization/core/app/use-cases/department/UpdateDepartmentUseCase";
import ArchivePositionUseCase from "@modules/organization/core/app/use-cases/position/ArchivePositionUseCase";
import CreatePositionUseCase from "@modules/organization/core/app/use-cases/position/CreatePositionUseCase";
import DeletePositionUseCase from "@modules/organization/core/app/use-cases/position/DeletePositionUseCase";
import GetPositionUseCase from "@modules/organization/core/app/use-cases/position/GetPositionUseCase";
import ListPositionsUseCase from "@modules/organization/core/app/use-cases/position/ListPositionsUseCase";
import UpdatePositionUseCase from "@modules/organization/core/app/use-cases/position/UpdatePositionUseCase";
import { Db as MongoDb } from "mongodb";

/**
 * Lắp ráp use-case của module Organization trên nền MongoDB — điểm nối
 * (composition root) giữa core và driven adapter.
 */
export default function createOrganizationHttpUseCases(mongoDb: MongoDb): OrganizationHttpUseCases {
    const departmentRepo = new MongoDepartmentRepo(mongoDb);
    const positionRepo   = new MongoPositionRepo(mongoDb);

    return {
        // Department
        createDepartment:     new CreateDepartmentUseCase(departmentRepo),
        updateDepartment:     new UpdateDepartmentUseCase(departmentRepo),
        getDepartment:        new GetDepartmentUseCase(departmentRepo),
        listDepartments:      new ListDepartmentsUseCase(departmentRepo),
        reparentDepartment:   new ReparentDepartmentUseCase(departmentRepo),
        assignDepartmentHead: new AssignDepartmentHeadUseCase(departmentRepo),
        archiveDepartment:    new ArchiveDepartmentUseCase(departmentRepo),
        deleteDepartment:     new DeleteDepartmentUseCase(departmentRepo, positionRepo),

        // Position
        createPosition:  new CreatePositionUseCase(positionRepo, departmentRepo),
        updatePosition:  new UpdatePositionUseCase(positionRepo, departmentRepo),
        getPosition:     new GetPositionUseCase(positionRepo),
        listPositions:   new ListPositionsUseCase(positionRepo),
        archivePosition: new ArchivePositionUseCase(positionRepo),
        deletePosition:  new DeletePositionUseCase(positionRepo),
    };
}
```

- [ ] **Step 2: Thêm ensureIndexes**

Trong `src/infra/db/ensureMongoIndexes.ts`, thêm import và các lời gọi (giữ nhóm theo module):

Thêm vào khối import:
```ts
import { MongoDepartmentRepo, MongoPositionRepo } from "@modules/organization/adapters/driven/persistence/mongodb";
```

Thêm trước dòng đóng hàm (sau khối Task Management):
```ts
    // Organization
    await MongoDepartmentRepo.ensureIndexes(mongoDb);
    await MongoPositionRepo.ensureIndexes(mongoDb);
```

- [ ] **Step 3: Mount router vào express server**

Sửa `src/infra/server/createExpressServer.ts`:

Thêm import:
```ts
import { createOrganizationHttpRouter, OrganizationHttpUseCases } from "@modules/organization";
```

Thêm tham số mới vào chữ ký (sau `taskMgmtUseCases`):
```ts
export default function createExpressServer(
    authUseCases:         AuthHttpUseCases,
    taskMgmtUseCases:     TaskMgmtHttpUseCases,
    organizationUseCases: OrganizationHttpUseCases,
    accessTokenVerifier:  AccessTokenVerifier,
    corsOrigins:          string[] = [],
): Express {
```

Thêm dòng mount (sau dòng mount task-mgmt):
```ts
    app.use("/organization", createOrganizationHttpRouter(organizationUseCases, accessTokenVerifier));
```

- [ ] **Step 4: Dựng use-case trong server.ts**

Sửa `src/server.ts`:

Thêm import:
```ts
import createOrganizationHttpUseCases from "@infra/di/createOrganizationHttpUseCases";
```

Trong `main()`, sau dòng `const taskMgmtUseCases = createTaskMgmtHttpUseCases(...)`:
```ts
    const organizationUseCases = createOrganizationHttpUseCases(mongoDb);
```

Cập nhật lời gọi `createExpressServer` (thêm `organizationUseCases` đúng vị trí):
```ts
    const expressServer = createExpressServer(authUseCases, taskMgmtUseCases, organizationUseCases, tokenVerifier, config.http.corsOrigins);
```

- [ ] **Step 5: Kiểm chứng biên dịch + toàn bộ unit test**

Run: `npx tsc --noEmit`
Expected: không lỗi.
Run: `npm test`
Expected: tất cả test hiện có PASS.

- [ ] **Step 6: Commit**

```bash
git add src/infra
git commit -m "feat(organization): wire module into DI, indexes and express server"
```

---

## Task 12: Test tích hợp HTTP (supertest)

**Files:**
- Test: `tests/modules/organization/adapters/http/organization.http.test.ts`

**Interfaces:**
- Consumes: `createOrganizationHttpRouter`, use-cases thật với repo giả (in-memory) HOẶC mock verifier + mock use-case. Chọn: mount router thật với `OrganizationHttpUseCases` được lắp từ repo in-memory đơn giản (không cần Mongo) + fake `AccessTokenVerifier`.

> Cách tiếp cận: viết 2 repo in-memory nhỏ (chỉ trong file test) hiện thực `DepartmentRepo`/`PositionRepo`, lắp use-case thật, dựng app Express bọc router. Kiểm chứng luồng thật xuyên tầng.

- [ ] **Step 1: Viết test**

```ts
// tests/modules/organization/adapters/http/organization.http.test.ts
import { createOrganizationHttpRouter, OrganizationHttpUseCases } from "@modules/organization";
import ArchiveDepartmentUseCase from "@modules/organization/core/app/use-cases/department/ArchiveDepartmentUseCase";
import AssignDepartmentHeadUseCase from "@modules/organization/core/app/use-cases/department/AssignDepartmentHeadUseCase";
import CreateDepartmentUseCase from "@modules/organization/core/app/use-cases/department/CreateDepartmentUseCase";
import DeleteDepartmentUseCase from "@modules/organization/core/app/use-cases/department/DeleteDepartmentUseCase";
import GetDepartmentUseCase from "@modules/organization/core/app/use-cases/department/GetDepartmentUseCase";
import ListDepartmentsUseCase from "@modules/organization/core/app/use-cases/department/ListDepartmentsUseCase";
import ReparentDepartmentUseCase from "@modules/organization/core/app/use-cases/department/ReparentDepartmentUseCase";
import UpdateDepartmentUseCase from "@modules/organization/core/app/use-cases/department/UpdateDepartmentUseCase";
import ArchivePositionUseCase from "@modules/organization/core/app/use-cases/position/ArchivePositionUseCase";
import CreatePositionUseCase from "@modules/organization/core/app/use-cases/position/CreatePositionUseCase";
import DeletePositionUseCase from "@modules/organization/core/app/use-cases/position/DeletePositionUseCase";
import GetPositionUseCase from "@modules/organization/core/app/use-cases/position/GetPositionUseCase";
import ListPositionsUseCase from "@modules/organization/core/app/use-cases/position/ListPositionsUseCase";
import UpdatePositionUseCase from "@modules/organization/core/app/use-cases/position/UpdatePositionUseCase";
import DepartmentRepo from "@modules/organization/core/app/ports/DepartmentRepo";
import PositionRepo, { PositionListFilter } from "@modules/organization/core/app/ports/PositionRepo";
import Department from "@modules/organization/core/domain/entities/Department";
import Position from "@modules/organization/core/domain/entities/Position";
import AccessTokenVerifier, { AuthenticatedActor } from "@shared/adapters/driver/http/ports/AccessTokenVerifier";
import express, { Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

class InMemoryDepartmentRepo implements DepartmentRepo {
    private readonly _store = new Map<string, Department>();
    async getById(id: string) { return this._store.get(id); }
    async getByCode(code: string) { return [...this._store.values()].find(d => d.code.value === code); }
    async listAll() { return [...this._store.values()]; }
    async listChildren(parentId: string) { return [...this._store.values()].filter(d => d.parentDepartmentId === parentId); }
    async countChildren(parentId: string) { return (await this.listChildren(parentId)).length; }
    async save(d: Department) { this._store.set(d.id, d); }
    async deleteById(id: string) { this._store.delete(id); }
}

class InMemoryPositionRepo implements PositionRepo {
    private readonly _store = new Map<string, Position>();
    async getById(id: string) { return this._store.get(id); }
    async getByCode(code: string) { return [...this._store.values()].find(p => p.code.value === code); }
    async list(filter: PositionListFilter) {
        return [...this._store.values()].filter(p =>
            (filter.departmentId == undefined || p.departmentId === filter.departmentId) &&
            (filter.status == undefined || p.status.value === filter.status));
    }
    async countByDepartment(deptId: string) { return (await this.list({ departmentId: deptId })).length; }
    async save(p: Position) { this._store.set(p.id, p); }
    async deleteById(id: string) { this._store.delete(id); }
}

function buildUseCases(): OrganizationHttpUseCases {
    const departmentRepo = new InMemoryDepartmentRepo();
    const positionRepo = new InMemoryPositionRepo();
    return {
        createDepartment:     new CreateDepartmentUseCase(departmentRepo),
        updateDepartment:     new UpdateDepartmentUseCase(departmentRepo),
        getDepartment:        new GetDepartmentUseCase(departmentRepo),
        listDepartments:      new ListDepartmentsUseCase(departmentRepo),
        reparentDepartment:   new ReparentDepartmentUseCase(departmentRepo),
        assignDepartmentHead: new AssignDepartmentHeadUseCase(departmentRepo),
        archiveDepartment:    new ArchiveDepartmentUseCase(departmentRepo),
        deleteDepartment:     new DeleteDepartmentUseCase(departmentRepo, positionRepo),
        createPosition:       new CreatePositionUseCase(positionRepo, departmentRepo),
        updatePosition:       new UpdatePositionUseCase(positionRepo, departmentRepo),
        getPosition:          new GetPositionUseCase(positionRepo),
        listPositions:        new ListPositionsUseCase(positionRepo),
        archivePosition:      new ArchivePositionUseCase(positionRepo),
        deletePosition:       new DeletePositionUseCase(positionRepo),
    };
}

const fakeVerifier: AccessTokenVerifier = {
    async verify(token: string) { return token ? new AuthenticatedActor(token) : undefined; },
};

function buildApp(): Express {
    const app = express();
    app.use("/organization", createOrganizationHttpRouter(buildUseCases(), fakeVerifier));
    return app;
}

describe("Organization HTTP", () => {
    let app: Express;
    beforeEach(() => { app = buildApp(); });

    const auth = { Authorization: "Bearer user-1" };

    it("401 khi thiếu token", async () => {
        await request(app).get("/organization/departments").expect(401);
    });

    it("tạo -> lấy -> liệt kê cây", async () => {
        const created = await request(app).post("/organization/departments")
            .set(auth).send({ code: "ENG", name: "Engineering" }).expect(201);
        const id = created.body.departmentId;

        await request(app).get(`/organization/departments/${id}`).set(auth)
            .expect(200).expect(res => expect(res.body.code).toBe("ENG"));

        const child = await request(app).post("/organization/departments")
            .set(auth).send({ code: "BE", name: "Backend", parentDepartmentId: id }).expect(201);

        await request(app).get("/organization/departments?tree=true").set(auth)
            .expect(200).expect(res => {
                expect(res.body.departments).toHaveLength(1);
                expect(res.body.departments[0].children[0].id).toBe(child.body.departmentId);
            });
    });

    it("409 khi mã trùng", async () => {
        await request(app).post("/organization/departments").set(auth).send({ code: "ENG", name: "E" }).expect(201);
        await request(app).post("/organization/departments").set(auth).send({ code: "ENG", name: "E2" })
            .expect(409).expect(res => expect(res.body.code).toBe("DEPARTMENT_CODE_CONFLICT"));
    });

    it("422 khi tên rỗng", async () => {
        await request(app).post("/organization/departments").set(auth).send({ code: "X", name: "  " })
            .expect(422).expect(res => expect(res.body.code).toBe("DEPARTMENT_NAME_INVALID"));
    });

    it("400 khi thiếu field bắt buộc", async () => {
        await request(app).post("/organization/departments").set(auth).send({ name: "NoCode" })
            .expect(400).expect(res => expect(res.body.code).toBe("INVALID_REQUEST"));
    });

    it("chặn reparent gây chu trình (409)", async () => {
        const a = (await request(app).post("/organization/departments").set(auth).send({ code: "A", name: "A" })).body.departmentId;
        const b = (await request(app).post("/organization/departments").set(auth).send({ code: "B", name: "B", parentDepartmentId: a })).body.departmentId;
        await request(app).patch(`/organization/departments/${a}/parent`).set(auth).send({ parentDepartmentId: b })
            .expect(409).expect(res => expect(res.body.code).toBe("DEPARTMENT_CYCLE"));
    });

    it("position: tạo cần phòng ban tồn tại; xoá department còn vị trí bị chặn", async () => {
        const dept = (await request(app).post("/organization/departments").set(auth).send({ code: "D", name: "D" })).body.departmentId;
        await request(app).post("/organization/positions").set(auth)
            .send({ code: "DEV", title: "Dev", departmentId: dept, level: 3 }).expect(201);
        await request(app).delete(`/organization/departments/${dept}`).set(auth)
            .expect(409).expect(res => expect(res.body.code).toBe("DEPARTMENT_HAS_CHILDREN"));
    });
});
```

- [ ] **Step 2: Chạy test — kỳ vọng FAIL rồi PASS**

Run: `npx vitest run tests/modules/organization/adapters/http/organization.http.test.ts`
Expected: PASS (toàn bộ code đã có từ Task 1–11). Nếu FAIL do lỗi chữ ký, sửa theo thông báo — KHÔNG đổi hành vi use-case.

> Ghi chú: `AccessTokenVerifier` port có hình dạng `{ verify(token: string): Promise<{ userId: string } | undefined> }`. Nếu file port thực tế khác, chỉnh `fakeVerifier` cho khớp (đọc `src/shared/adapters/driver/http/ports/AccessTokenVerifier.ts`).

- [ ] **Step 3: Commit**

```bash
git add tests/modules/organization/adapters/http/organization.http.test.ts
git commit -m "test(organization): add http integration spec for module"
```

---

## Task 13: Tài liệu HTML (api.html, use-cases.html, er-diagram.md)

**Files:**
- Modify: `docs/api.html`
- Modify: `docs/use-cases.html`
- Modify: `docs/er-diagram.md`

**Interfaces:** không có code chạy; đầu ra là tài liệu. Kiểm chứng bằng mở file HTML trong trình duyệt (mắt thường).

- [ ] **Step 1: Đọc cấu trúc hiện có**

Run (đọc để bắt chước đúng khối markup/section id + badge màu HTTP):
```bash
sed -n '1,80p' docs/api.html
```
Xác định: cách khai báo một `section`, class badge cho `POST/GET/PATCH/DELETE`, và menu điều hướng sidebar. Ghi lại mẫu một endpoint.

- [ ] **Step 2: Thêm section Organization vào `docs/api.html`**

Chèn một `section` mới (id `organization`) theo đúng khuôn của section Task Management, liệt kê 14 endpoint dưới. Dùng chính class badge sẵn có của file. Mỗi hàng gồm: method badge, path (prefix `/organization`), mô tả ngắn, body (nếu có). Thêm mục tương ứng vào sidebar nav.

Nội dung 14 endpoint (path + method + body tóm tắt):
```
POST   /organization/departments                        body: { code, name, description?, parentDepartmentId?, managerId? }
GET    /organization/departments?tree=true              -> { departments: DeptNode[] | Department[] }
GET    /organization/departments/:departmentId          -> DepartmentDTO
PATCH  /organization/departments/:departmentId          body: { code?, name?, description? }
PATCH  /organization/departments/:departmentId/parent   body: { parentDepartmentId?: string|null }
PATCH  /organization/departments/:departmentId/head     body: { managerId?: string|null }
POST   /organization/departments/:departmentId/archive  -> 200
DELETE /organization/departments/:departmentId          -> 200
POST   /organization/positions                          body: { code, title, departmentId, level?, description? }
GET    /organization/positions?departmentId=&status=    -> { positions: PositionDTO[] }
GET    /organization/positions/:positionId              -> PositionDTO
PATCH  /organization/positions/:positionId              body: { title?, departmentId?, level?, description?, status? }
POST   /organization/positions/:positionId/archive      -> 200
DELETE /organization/positions/:positionId              -> 200
```
Kèm ghi chú đầu section: "Tất cả endpoint yêu cầu Bearer token (authenticated-only). Lỗi trả `{ code, message }`. Mã lỗi: DEPARTMENT_CODE_CONFLICT (409), DEPARTMENT_NOT_FOUND (404), DEPARTMENT_CYCLE (409), DEPARTMENT_HAS_CHILDREN (409), DEPARTMENT_NAME_INVALID/DEPARTMENT_CODE_INVALID (422), POSITION_* tương ứng."

- [ ] **Step 3: Thêm use-cases Organization vào `docs/use-cases.html`**

Theo khuôn card use-case sẵn có, thêm 14 card (một card/ use-case) nhóm dưới tiêu đề "Organization", mỗi card ghi: tên use-case, input chính, và danh sách `@throws` (lấy nguyên từ JSDoc đã viết trong Task 7–8).

- [ ] **Step 4: Thêm namespace Organization vào `docs/er-diagram.md`**

Trong khối `classDiagram`, thêm:
```mermaid
namespace Organization {
    class Department {
        +string id
        +string code
        +string name
        +string description
        +string parentDepartmentId
        +string managerId
        +string status
        +Date createdAt
    }
    class Position {
        +string id
        +string code
        +string title
        +string departmentId
        +number level
        +string description
        +string status
        +Date createdAt
    }
}
Department --> "0..1" Department : parent
Department "1" --> "*" Position : has
```

- [ ] **Step 5: Kiểm chứng + commit**

Mở `docs/api.html` và `docs/use-cases.html` trong trình duyệt, xác nhận section Organization hiển thị, nav hoạt động, không vỡ layout. Kiểm tra `docs/er-diagram.md` render Mermaid không lỗi cú pháp.

```bash
git add docs/api.html docs/use-cases.html docs/er-diagram.md
git commit -m "docs: document organization module (api, use-cases, er-diagram)"
```

---

## Task 14: Rà soát cuối + chạy toàn bộ

**Files:** none (verification)

- [ ] **Step 1: Biên dịch sạch**

Run: `npx tsc --noEmit`
Expected: 0 lỗi.

- [ ] **Step 2: Toàn bộ test**

Run: `npm test`
Expected: tất cả PASS, gồm test task-mgmt/auth cũ không bị ảnh hưởng.

- [ ] **Step 3: Chạy thử server (khói)**

Run: `npm run dev` (cần Mongo local). Kiểm tra log "Server listening…" và không lỗi ensureIndexes.
Thử: `curl -H "Authorization: Bearer dev-user" http://localhost:<port>/organization/departments` → `{ "departments": [] }` (khi dùng DevAccessTokenVerifier).
Dừng server.

- [ ] **Step 4: Commit (nếu có chỉnh sửa nhỏ)**

```bash
git add -A
git commit -m "chore(organization): final verification pass"
```

---

## Tự rà soát (đối chiếu spec)

- **§3 cấu trúc module** → Task 2–10 tạo đủ file theo đúng cây. ✔
- **§4 domain model (VO/entity, không workspaceId)** → Task 2–4. ✔
- **§5 quy tắc use-case (bỏ phần employee)** → Task 7–8. ✔
- **§6 HTTP surface 14 endpoint + `field.number`** → Task 1, 10. ✔
- **§7 wiring infra** → Task 11. ✔
- **§8 docs HTML** → Task 13. ✔
- **§9 testing (VO/tree/use-case/http)** → Task 2–12. ✔
- **§2 quyết định (drop employee/audit/RBAC, authenticated-only)** → phản ánh trong Task 7–8, 10. ✔
- **Placeholder scan:** helper `dept()` ở Task 7 có bản sai (dùng `await import`) — đã kèm bản đúng ngay dưới; người thực thi dùng bản đúng. Không còn TODO/TBD khác. ✔
- **Type consistency:** `OrganizationHttpUseCases` khóa tại Task 10 và tái dùng nguyên ở Task 11–12; chữ ký use-case `execute()` khai ở Task 7–8 khớp với DI factory và test tích hợp. ✔

---

## Bàn giao thực thi

Plan lưu tại `docs/superpowers/plans/2026-07-18-organization-module-port.md`. Hai lựa chọn thực thi:

1. **Subagent-Driven (khuyến nghị)** — mỗi task một subagent mới, review giữa các task, lặp nhanh.
2. **Inline Execution** — thực thi tuần tự trong phiên này, checkpoint review theo cụm.

Chọn cách nào?
