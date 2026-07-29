import Department from "@modules/department/core/domain/entities/Department";
import Position from "@modules/department/core/domain/entities/Position";
import DepartmentCode from "@modules/department/core/domain/value-objects/DepartmentCode";
import DepartmentName from "@modules/department/core/domain/value-objects/DepartmentName";
import DepartmentStatus from "@modules/department/core/domain/value-objects/DepartmentStatus";
import Description from "@modules/department/core/domain/value-objects/Description";
import PositionCode from "@modules/department/core/domain/value-objects/PositionCode";
import PositionLevel from "@modules/department/core/domain/value-objects/PositionLevel";
import PositionStatus from "@modules/department/core/domain/value-objects/PositionStatus";
import PositionTitle from "@modules/department/core/domain/value-objects/PositionTitle";
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
