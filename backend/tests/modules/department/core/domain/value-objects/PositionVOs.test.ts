import PositionCode from "@modules/department/core/domain/value-objects/PositionCode";
import PositionLevel from "@modules/department/core/domain/value-objects/PositionLevel";
import PositionStatus from "@modules/department/core/domain/value-objects/PositionStatus";
import PositionTitle from "@modules/department/core/domain/value-objects/PositionTitle";
import { describe, expect, it } from "vitest";

describe("PositionCode", () => {
    it("trim + UPPERCASE", () => {
        expect(PositionCode.create(" dev ").value).toBe("DEV");
    });
    it("từ chối rỗng", () => {
        expect(() => PositionCode.create("")).toThrow(/must not be empty/);
    });
});

describe("PositionTitle", () => {
    it("trim", () => {
        expect(PositionTitle.create(" Senior Dev ").value).toBe("Senior Dev");
    });
    it("từ chối rỗng", () => {
        expect(() => PositionTitle.create("  ")).toThrow(/must not be empty/);
    });
});

describe("PositionLevel", () => {
    it("nhận số nguyên trong 1..10", () => {
        expect(PositionLevel.create(5).value).toBe(5);
    });
    it("từ chối ngoài khoảng", () => {
        expect(() => PositionLevel.create(0)).toThrow(/between 1 and 10/);
        expect(() => PositionLevel.create(11)).toThrow(/between 1 and 10/);
    });
    it("từ chối số thập phân", () => {
        expect(() => PositionLevel.create(2.5)).toThrow(/integer/);
    });
});

describe("PositionStatus", () => {
    it("phân giải hợp lệ", () => {
        expect(PositionStatus.create("archived").isActive).toBe(false);
    });
    it("từ chối lạ", () => {
        expect(() => PositionStatus.create("x")).toThrow(/Invalid position status/);
    });
});
