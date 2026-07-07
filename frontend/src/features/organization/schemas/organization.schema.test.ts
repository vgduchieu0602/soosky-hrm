import { describe, it, expect } from "vitest";
import { departmentFormSchema, positionFormSchema, fieldErrors } from "./organization.schema";

const validDept = {
  name: "Engineering",
  code: "ENG",
  parentDepartmentId: "",
  description: "",
  status: "active" as const,
};

describe("departmentFormSchema", () => {
  it("accepts a valid department", () => {
    expect(fieldErrors(departmentFormSchema, validDept)).toBeNull();
  });

  it("requires a name", () => {
    const errs = fieldErrors(departmentFormSchema, { ...validDept, name: "" });
    expect(errs?.name).toBeTruthy();
  });

  it("rejects a lowercase / punctuated code (uppercase-digits-_- only)", () => {
    expect(fieldErrors(departmentFormSchema, { ...validDept, code: "eng!" })?.code).toBeTruthy();
    expect(fieldErrors(departmentFormSchema, { ...validDept, code: "ENG_1" })).toBeNull();
  });

  it("rejects a code longer than 20 chars", () => {
    expect(fieldErrors(departmentFormSchema, { ...validDept, code: "A".repeat(21) })?.code).toBeTruthy();
  });

  it("rejects extra removed fields is NOT enforced here (non-strict) — sanity", () => {
    // schema is not .strict(), so unknown keys pass; documents current behavior.
    expect(fieldErrors(departmentFormSchema, { ...validDept, costCenter: "X" })).toBeNull();
  });
});

describe("positionFormSchema", () => {
  const validPos = { title: "Engineer", code: "ENG", level: 1, description: "" };

  it("accepts a valid position", () => {
    expect(fieldErrors(positionFormSchema, validPos)).toBeNull();
  });

  it("enforces level bounds 1..10", () => {
    expect(fieldErrors(positionFormSchema, { ...validPos, level: 0 })?.level).toBeTruthy();
    expect(fieldErrors(positionFormSchema, { ...validPos, level: 11 })?.level).toBeTruthy();
  });
});
