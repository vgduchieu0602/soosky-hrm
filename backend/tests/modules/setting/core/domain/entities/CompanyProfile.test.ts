import CompanyProfile, {
    COMPANY_PROFILE_ID,
    DEFAULT_CURRENCY,
    DEFAULT_STANDARD_WORK_DAYS_PER_MONTH,
    DEFAULT_STANDARD_WORK_HOURS_PER_DAY,
    DEFAULT_TIMEZONE,
} from "@modules/setting/core/domain/entities/CompanyProfile";
import { describe, expect, it } from "vitest";

function validProps() {
    return {
        name:                      "Soosky",
        address:                   null,
        taxCode:                   null,
        phone:                     null,
        email:                     null,
        logoUrl:                   null,
        timezone:                  DEFAULT_TIMEZONE,
        currency:                  DEFAULT_CURRENCY,
        standardWorkHoursPerDay:   DEFAULT_STANDARD_WORK_HOURS_PER_DAY,
        standardWorkDaysPerMonth: DEFAULT_STANDARD_WORK_DAYS_PER_MONTH,
    };
}

describe("CompanyProfile.create", () => {
    it("dùng id cố định 'global'", () => {
        const profile = CompanyProfile.create(validProps());
        expect(profile.id).toBe(COMPANY_PROFILE_ID);
    });

    it("chuẩn hoá currency về UPPERCASE", () => {
        const profile = CompanyProfile.create({ ...validProps(), currency: "usd" });
        expect(profile.currency).toBe("USD");
    });

    it("từ chối tên rỗng", () => {
        expect(() => CompanyProfile.create({ ...validProps(), name: "   " })).toThrow(/must not be empty/);
    });

    it("từ chối currency không đúng 3 ký tự", () => {
        expect(() => CompanyProfile.create({ ...validProps(), currency: "VNDD" })).toThrow(/3-letter/);
    });

    it("từ chối standardWorkHoursPerDay ngoài khoảng [1,24]", () => {
        expect(() => CompanyProfile.create({ ...validProps(), standardWorkHoursPerDay: 25 })).toThrow(/between 1 and 24/);
    });

    it("từ chối standardWorkDaysPerMonth ngoài khoảng [1,31]", () => {
        expect(() => CompanyProfile.create({ ...validProps(), standardWorkDaysPerMonth: 0 })).toThrow(/between 1 and 31/);
    });
});

describe("CompanyProfile.update", () => {
    it("chỉ thay đổi field được truyền, giữ nguyên field còn lại", () => {
        const profile = CompanyProfile.create(validProps());
        profile.update({ address: "123 Main St" });
        expect(profile.address).toBe("123 Main St");
        expect(profile.currency).toBe(DEFAULT_CURRENCY);
        expect(profile.name).toBe("Soosky");
    });

    it("cập nhật updatedAt mỗi lần patch", async () => {
        const profile = CompanyProfile.create(validProps());
        const before = profile.updatedAt;
        await new Promise(resolve => setTimeout(resolve, 2));
        profile.update({ name: "Soosky HRM" });
        expect(profile.updatedAt.getTime()).toBeGreaterThan(before.getTime());
    });

    it("ném lỗi khi patch giá trị không hợp lệ", () => {
        const profile = CompanyProfile.create(validProps());
        expect(() => profile.update({ timezone: "" })).toThrow(/must not be empty/);
    });
});
