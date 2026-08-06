import EmployeeRepo, { EmployeeListFilter } from "@modules/employee/core/app/ports/EmployeeRepo";
import PermissionChecker from "@modules/employee/core/app/ports/PermissionChecker";
import EmployeeAccessScope from "@modules/employee/core/app/services/EmployeeAccessScope";
import ManagerChain from "@modules/employee/core/app/services/ManagerChain";
import Employee from "@modules/employee/core/domain/entities/Employee";
import EmployeeCode from "@modules/employee/core/domain/value-objects/EmployeeCode";
import EmployeeStatus from "@modules/employee/core/domain/value-objects/EmployeeStatus";
import EmployeeType from "@modules/employee/core/domain/value-objects/EmployeeType";
import PersonName from "@modules/employee/core/domain/value-objects/PersonName";
import AccessDeniedError from "@shared/core/app/errors/AccessDeniedError";
import { PermissionScope } from "@shared/core/app/authorization/PermissionScope";
import { beforeEach, describe, expect, it } from "vitest";

function employee(id: string, managerId: string | null, accountId: string | null): Employee {
    return Employee.rehydrate({
        id,
        code:            EmployeeCode.create(id.toUpperCase()),
        name:            PersonName.create(`Nhan vien ${id}`),
        email:           null,
        phone:           null,
        dob:             null,
        gender:          null,
        departmentId:    "dept-1",
        positionId:      "pos-1",
        managerId,
        hireDate:        new Date("2026-01-01"),
        terminationDate: null,
        employeeType:    EmployeeType.FULL_TIME,
        status:          EmployeeStatus.ACTIVE,
        accountId,
        createdAt:       new Date("2026-01-01"),
    });
}

class InMemoryEmployeeRepo implements EmployeeRepo {
    private readonly _store = new Map<string, Employee>();

    add(e: Employee): void { this._store.set(e.id, e); }

    async getById(id: string) { return this._store.get(id); }
    async getByCode(code: string) { return [...this._store.values()].find(e => e.code.value === code); }
    async getByAccountId(accountId: string) { return [...this._store.values()].find(e => e.accountId === accountId); }
    async listDirectReportIds(managerId: string) { return [...this._store.values()].filter(e => e.managerId === managerId).map(e => e.id); }
    async list(filter: EmployeeListFilter) {
        return [...this._store.values()].filter(e => filter.ids == undefined || filter.ids.includes(e.id));
    }
    async save(e: Employee) { this._store.set(e.id, e); }
    async deleteById(id: string) { this._store.delete(id); }
}

function permissionsWithScope(scope: PermissionScope | undefined): PermissionChecker {
    return {
        async assertPermission() { /* không dùng ở đây */ },
        async resolveScope() {
            if (scope == undefined) throw new AccessDeniedError();
            return scope;
        },
    };
}

// Cây tổ chức dùng chung:
//   ceo (account acc-ceo)
//     └── manager (account acc-manager)
//           ├── staff-1 (account acc-staff-1)
//           └── staff-2
//                 └── intern         <- cấp dưới GIÁN TIẾP của manager
//   outsider (không thuộc nhánh nào)
describe("EmployeeAccessScope", () => {
    let repo: InMemoryEmployeeRepo;

    beforeEach(() => {
        repo = new InMemoryEmployeeRepo();
        repo.add(employee("ceo", null, "acc-ceo"));
        repo.add(employee("manager", "ceo", "acc-manager"));
        repo.add(employee("staff-1", "manager", "acc-staff-1"));
        repo.add(employee("staff-2", "manager", null));
        repo.add(employee("intern", "staff-2", null));
        repo.add(employee("outsider", null, null));
    });

    it("phạm vi all: không giới hạn id nào (HR/Admin)", async () => {
        const scope = new EmployeeAccessScope(permissionsWithScope("all"), repo);
        expect(await scope.visibleEmployeeIds("acc-hr")).toBeUndefined();
        await expect(scope.assertCanRead("acc-hr", "outsider")).resolves.toBeUndefined();
    });

    it("phạm vi team: chính mình + cấp dưới trực tiếp VÀ gián tiếp", async () => {
        const scope   = new EmployeeAccessScope(permissionsWithScope("team"), repo);
        const visible = await scope.visibleEmployeeIds("acc-manager");

        expect(visible?.sort()).toEqual(["intern", "manager", "staff-1", "staff-2"]);
        await expect(scope.assertCanRead("acc-manager", "intern")).resolves.toBeUndefined();
        await expect(scope.assertCanRead("acc-manager", "ceo")).rejects.toBeInstanceOf(AccessDeniedError);
        await expect(scope.assertCanRead("acc-manager", "outsider")).rejects.toBeInstanceOf(AccessDeniedError);
    });

    it("phạm vi self: đúng một mình", async () => {
        const scope = new EmployeeAccessScope(permissionsWithScope("self"), repo);

        expect(await scope.visibleEmployeeIds("acc-staff-1")).toEqual(["staff-1"]);
        await expect(scope.assertCanRead("acc-staff-1", "staff-1")).resolves.toBeUndefined();
        await expect(scope.assertCanRead("acc-staff-1", "staff-2")).rejects.toBeInstanceOf(AccessDeniedError);
    });

    it("actor không gắn với nhân viên nào thì không thấy gì (không mở toàn bộ)", async () => {
        const scope = new EmployeeAccessScope(permissionsWithScope("team"), repo);
        expect(await scope.visibleEmployeeIds("acc-khong-ton-tai")).toEqual([]);
    });

    it("không có quyền đọc → AccessDeniedError", async () => {
        const scope = new EmployeeAccessScope(permissionsWithScope(undefined), repo);
        await expect(scope.visibleEmployeeIds("acc-ai-do")).rejects.toBeInstanceOf(AccessDeniedError);
    });

    it("dữ liệu quản lý bị tạo vòng thì vẫn dừng, không treo", async () => {
        // ceo <-> manager quản lý lẫn nhau
        repo.add(employee("ceo", "manager", "acc-ceo"));

        const scope   = new EmployeeAccessScope(permissionsWithScope("team"), repo);
        const visible = await scope.visibleEmployeeIds("acc-manager");

        expect(visible).toContain("manager");
        expect(visible?.length).toBeLessThanOrEqual(6);
    });
});

describe("ManagerChain", () => {
    let repo: InMemoryEmployeeRepo;
    let chain: ManagerChain;

    beforeEach(() => {
        repo = new InMemoryEmployeeRepo();
        repo.add(employee("ceo", null, null));
        repo.add(employee("manager", "ceo", null));
        repo.add(employee("staff", "manager", null));
        chain = new ManagerChain(repo);
    });

    it("gán quản lý bình thường thì không lỗi", async () => {
        await expect(chain.assertNoCycle("staff", "ceo")).resolves.toBeUndefined();
    });

    it("tự quản lý chính mình bị chặn", async () => {
        await expect(chain.assertNoCycle("staff", "staff")).rejects.toMatchObject({ code: "MANAGER_CYCLE" });
    });

    it("gán cấp dưới làm quản lý của cấp trên bị chặn (vòng gián tiếp)", async () => {
        await expect(chain.assertNoCycle("ceo", "staff")).rejects.toMatchObject({ code: "MANAGER_CYCLE" });
    });
});
