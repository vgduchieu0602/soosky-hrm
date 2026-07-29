import EmployeeCode from "@modules/employee/core/domain/value-objects/EmployeeCode";
import EmployeeStatus from "@modules/employee/core/domain/value-objects/EmployeeStatus";
import EmployeeType from "@modules/employee/core/domain/value-objects/EmployeeType";
import PersonName from "@modules/employee/core/domain/value-objects/PersonName";
import { describe, expect, it } from "vitest";

describe("EmployeeCode", () => {
    it("chuẩn hoá về UPPERCASE và trim", () => {
        expect(EmployeeCode.create(" nv001 ").value).toBe("NV001");
    });

    it("từ chối chuỗi rỗng", () => {
        expect(() => EmployeeCode.create("   ")).toThrow(/empty/i);
    });

    it("từ chối vượt quá độ dài tối đa", () => {
        expect(() => EmployeeCode.create("X".repeat(21))).toThrow(/at most/i);
    });

    it("equals so sánh theo giá trị", () => {
        expect(EmployeeCode.create("NV001").equals(EmployeeCode.create("nv001"))).toBe(true);
    });
});

describe("PersonName", () => {
    it("trim khoảng trắng", () => {
        expect(PersonName.create("  Nguyen Van A  ").value).toBe("Nguyen Van A");
    });

    it("từ chối chuỗi rỗng", () => {
        expect(() => PersonName.create("   ")).toThrow(/empty/i);
    });
});

describe("EmployeeStatus", () => {
    it("tạo được các trạng thái hợp lệ", () => {
        expect(EmployeeStatus.create("onboarding")).toBe(EmployeeStatus.ONBOARDING);
        expect(EmployeeStatus.create("active")).toBe(EmployeeStatus.ACTIVE);
        expect(EmployeeStatus.create("on_leave")).toBe(EmployeeStatus.ON_LEAVE);
        expect(EmployeeStatus.create("terminated")).toBe(EmployeeStatus.TERMINATED);
    });

    it("từ chối trạng thái không hợp lệ", () => {
        expect(() => EmployeeStatus.create("bogus")).toThrow(/invalid employee status/i);
    });

    it("isActive/isTerminated phản ánh đúng trạng thái", () => {
        expect(EmployeeStatus.ACTIVE.isActive).toBe(true);
        expect(EmployeeStatus.TERMINATED.isTerminated).toBe(true);
        expect(EmployeeStatus.ONBOARDING.isActive).toBe(false);
    });
});

describe("EmployeeType", () => {
    it("tạo được các loại hợp lệ", () => {
        expect(EmployeeType.create("full_time")).toBe(EmployeeType.FULL_TIME);
        expect(EmployeeType.create("intern")).toBe(EmployeeType.INTERN);
    });

    it("từ chối loại không hợp lệ", () => {
        expect(() => EmployeeType.create("bogus")).toThrow(/invalid employee type/i);
    });
});
