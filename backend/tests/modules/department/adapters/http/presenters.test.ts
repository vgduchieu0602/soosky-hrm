import DepartmentPresenter from "@modules/department/adapters/driver/http/presenters/DepartmentPresenter";
import Department from "@modules/department/core/domain/entities/Department";
import DepartmentCode from "@modules/department/core/domain/value-objects/DepartmentCode";
import DepartmentName from "@modules/department/core/domain/value-objects/DepartmentName";
import Description from "@modules/department/core/domain/value-objects/Description";
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
