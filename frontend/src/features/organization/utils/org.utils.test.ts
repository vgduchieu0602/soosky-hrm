import { describe, it, expect } from "vitest";
import type { DepartmentNode } from "@features/organization/types/organization.types";
import { chipFor, subtreeHeadcount, flatten, findById, treeDepth, initials } from "./org.utils";

/** Minimal tree builder — only the fields the utils touch. */
function node(id: string, headcount: number, children: DepartmentNode[] = []): DepartmentNode {
  return { id, headcount, children } as DepartmentNode;
}

const tree: DepartmentNode[] = [
  node("1", 2, [node("1.1", 3, [node("1.1.1", 1)]), node("1.2", 4)]),
  node("2", 5),
];

describe("chipFor", () => {
  it("returns the mapped color for a known code", () => {
    expect(chipFor("HR")).toBe("violet");
    expect(chipFor("QA")).toBe("emerald");
  });
  it("is stable (same code → same color) for unknown codes", () => {
    expect(chipFor("ZZZ")).toBe(chipFor("ZZZ"));
  });
  it("only ever returns a palette color", () => {
    const palette = ["slate", "blue", "indigo", "violet", "cyan", "rose", "emerald", "amber"];
    for (const code of ["FOO", "BAR", "XYZ", "AB", "Q"]) {
      expect(palette).toContain(chipFor(code));
    }
  });
});

describe("subtreeHeadcount", () => {
  it("sums a node and all descendants", () => {
    expect(subtreeHeadcount(tree[0])).toBe(2 + 3 + 1 + 4);
  });
  it("returns the node's own count for a leaf", () => {
    expect(subtreeHeadcount(tree[1])).toBe(5);
  });
});

describe("flatten", () => {
  it("depth-first flattens every node", () => {
    expect(flatten(tree).map((n) => n.id)).toEqual(["1", "1.1", "1.1.1", "1.2", "2"]);
  });
});

describe("findById", () => {
  it("finds a deeply nested node", () => {
    expect(findById(tree, "1.1.1")?.id).toBe("1.1.1");
  });
  it("returns null for a missing id", () => {
    expect(findById(tree, "nope")).toBeNull();
  });
});

describe("treeDepth", () => {
  it("measures the deepest branch (1 = flat roots)", () => {
    expect(treeDepth(tree)).toBe(3);
  });
  it("returns 0 for an empty tree", () => {
    expect(treeDepth([])).toBe(0);
  });
});

describe("initials", () => {
  it("takes the last two words' initials", () => {
    expect(initials("Nguyen Van A")).toBe("VA");
  });
  it("takes two letters from a single word", () => {
    expect(initials("Soosky")).toBe("SO");
  });
  it("handles empty input", () => {
    expect(initials("   ")).toBe("?");
  });
});
