import DepartmentCode from "@modules/department/core/domain/value-objects/DepartmentCode";
import DepartmentName from "@modules/department/core/domain/value-objects/DepartmentName";
import DepartmentStatus from "@modules/department/core/domain/value-objects/DepartmentStatus";
import Description from "@modules/department/core/domain/value-objects/Description";
import { describe, expect, it } from "vitest";

describe("DepartmentCode", () => {
    it("chuẩn hoá trim + UPPERCASE", () => {
        expect(DepartmentCode.create("  eng-01 ").value).toBe("ENG-01");
    });
    it("từ chối rỗng", () => {
        expect(() => DepartmentCode.create("   ")).toThrow(/must not be empty/);
    });
    it("từ chối quá 20 ký tự", () => {
        expect(() => DepartmentCode.create("A".repeat(21))).toThrow(/at most 20/);
    });
});

describe("DepartmentName", () => {
    it("trim và giữ nguyên hoa/thường", () => {
        expect(DepartmentName.create("  Kỹ thuật ").value).toBe("Kỹ thuật");
    });
    it("từ chối rỗng", () => {
        expect(() => DepartmentName.create("")).toThrow(/must not be empty/);
    });
});

describe("DepartmentStatus", () => {
    it("phân giải giá trị hợp lệ", () => {
        expect(DepartmentStatus.create("active").isActive).toBe(true);
        expect(DepartmentStatus.create("archived").isActive).toBe(false);
    });
    it("từ chối giá trị lạ", () => {
        expect(() => DepartmentStatus.create("deleted")).toThrow(/Invalid department status/);
    });
});

describe("Description", () => {
    it("mặc định rỗng khi không truyền", () => {
        expect(Description.create().isEmpty).toBe(true);
    });
    it("từ chối quá 500 ký tự", () => {
        expect(() => Description.create("x".repeat(501))).toThrow(/at most 500/);
    });
});
