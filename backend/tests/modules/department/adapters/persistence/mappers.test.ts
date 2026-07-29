import DepartmentMapper from "@modules/department/adapters/driven/persistence/mongodb/mappers/DepartmentMapper";
import PositionMapper from "@modules/department/adapters/driven/persistence/mongodb/mappers/PositionMapper";
import Department from "@modules/department/core/domain/entities/Department";
import Position from "@modules/department/core/domain/entities/Position";
import DepartmentCode from "@modules/department/core/domain/value-objects/DepartmentCode";
import DepartmentName from "@modules/department/core/domain/value-objects/DepartmentName";
import Description from "@modules/department/core/domain/value-objects/Description";
import PositionCode from "@modules/department/core/domain/value-objects/PositionCode";
import PositionLevel from "@modules/department/core/domain/value-objects/PositionLevel";
import PositionTitle from "@modules/department/core/domain/value-objects/PositionTitle";
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
