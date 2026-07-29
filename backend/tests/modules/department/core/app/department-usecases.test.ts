import CreateDepartmentUseCase from "@modules/department/core/app/use-cases/department/CreateDepartmentUseCase";
import DeleteDepartmentUseCase from "@modules/department/core/app/use-cases/department/DeleteDepartmentUseCase";
import ReparentDepartmentUseCase from "@modules/department/core/app/use-cases/department/ReparentDepartmentUseCase";
import DepartmentRepo from "@modules/department/core/app/ports/DepartmentRepo";
import PermissionChecker from "@modules/department/core/app/ports/PermissionChecker";
import PositionRepo from "@modules/department/core/app/ports/PositionRepo";
import Department from "@modules/department/core/domain/entities/Department";
import DepartmentCode from "@modules/department/core/domain/value-objects/DepartmentCode";
import DepartmentName from "@modules/department/core/domain/value-objects/DepartmentName";
import DepartmentStatus from "@modules/department/core/domain/value-objects/DepartmentStatus";
import Description from "@modules/department/core/domain/value-objects/Description";
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
        status:             DepartmentStatus.ACTIVE,
        createdAt:          new Date("2026-01-01"),
    });
}

function allowAllPermissions(): MockProxy<PermissionChecker> {
    const permissions = mock<PermissionChecker>();
    permissions.assertPermission.mockResolvedValue(undefined);
    return permissions;
}

describe("CreateDepartmentUseCase", () => {
    let permissions: MockProxy<PermissionChecker>;
    let repo: MockProxy<DepartmentRepo>;
    let useCase: CreateDepartmentUseCase;

    beforeEach(() => {
        permissions = allowAllPermissions();
        repo        = mock<DepartmentRepo>();
        useCase     = new CreateDepartmentUseCase(permissions, repo);
    });

    it("kiểm tra quyền department:manage trước khi tạo", async () => {
        repo.getByCode.mockResolvedValue(undefined);
        await useCase.execute({ code: "ENG", name: "E", actorUserId: "u1" });
        expect(permissions.assertPermission).toHaveBeenCalledWith("u1", "department:manage");
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
        const permissions = allowAllPermissions();
        const repo = mock<DepartmentRepo>();
        repo.getById.mockResolvedValue(dept("b", "a"));
        repo.listAll.mockResolvedValue([dept("a"), dept("b", "a"), dept("c", "b")]);
        const useCase = new ReparentDepartmentUseCase(permissions, repo);
        // đưa b xuống dưới c (con của b) => chu trình
        await expect(useCase.execute({ departmentId: "b", parentDepartmentId: "c", actorUserId: "u" }))
            .rejects.toThrow(/descendant|cycle/i);
    });
});

describe("DeleteDepartmentUseCase", () => {
    it("chặn khi còn con hoặc vị trí", async () => {
        const permissions = allowAllPermissions();
        const repo = mock<DepartmentRepo>();
        const positions = mock<PositionRepo>();
        repo.getById.mockResolvedValue(dept("a"));
        repo.countChildren.mockResolvedValue(2);
        positions.countByDepartment.mockResolvedValue(0);
        const useCase = new DeleteDepartmentUseCase(permissions, repo, positions);
        await expect(useCase.execute({ departmentId: "a", actorUserId: "u" }))
            .rejects.toThrow(/still has/i);
    });
});
