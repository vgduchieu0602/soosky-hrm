import {
    assembleDepartments,
    collectSubtreeIds,
    type DepartmentRow,
} from "@modules/department/core/domain/department-tree";
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
