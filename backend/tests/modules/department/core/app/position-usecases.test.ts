import CreatePositionUseCase from "@modules/department/core/app/use-cases/position/CreatePositionUseCase";
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
    let permissions: MockProxy<PermissionChecker>;
    let positions: MockProxy<PositionRepo>;
    let departments: MockProxy<DepartmentRepo>;
    let useCase: CreatePositionUseCase;

    beforeEach(() => {
        permissions = mock<PermissionChecker>();
        permissions.assertPermission.mockResolvedValue(undefined);
        positions   = mock<PositionRepo>();
        departments = mock<DepartmentRepo>();
        useCase     = new CreatePositionUseCase(permissions, positions, departments);
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

    it("kiểm tra quyền department:manage trước khi tạo", async () => {
        departments.getById.mockResolvedValue(dept("d1"));
        positions.getByCode.mockResolvedValue(undefined);
        await useCase.execute({ code: "DEV", title: "Dev", departmentId: "d1", actorUserId: "u9" });
        expect(permissions.assertPermission).toHaveBeenCalledWith("u9", "department:manage");
    });
});
