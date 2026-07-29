import CompanyProfileMapper from "@modules/setting/adapters/driven/persistence/mongodb/mappers/CompanyProfileMapper";
import SystemSettingMapper from "@modules/setting/adapters/driven/persistence/mongodb/mappers/SystemSettingMapper";
import CompanyProfile, { COMPANY_PROFILE_ID } from "@modules/setting/core/domain/entities/CompanyProfile";
import SystemSetting from "@modules/setting/core/domain/entities/SystemSetting";
import { describe, expect, it } from "vitest";

describe("CompanyProfileMapper", () => {
    it("round-trip document <-> domain", () => {
        const profile = CompanyProfile.create({
            name:                      "Soosky",
            address:                   "123 Main St",
            taxCode:                   "TAX-1",
            phone:                     "0900000000",
            email:                     "hr@soosky.co",
            logoUrl:                   "https://cdn/logo.png",
            timezone:                  "Asia/Ho_Chi_Minh",
            currency:                  "VND",
            standardWorkHoursPerDay:   8,
            standardWorkDaysPerMonth: 22,
        });
        const doc = CompanyProfileMapper.toDocument(profile);
        expect(doc._id).toBe(COMPANY_PROFILE_ID);

        const back = CompanyProfileMapper.toDomain(doc);
        expect(back.name).toBe("Soosky");
        expect(back.currency).toBe("VND");
        expect(back.standardWorkDaysPerMonth).toBe(22);
    });
});

describe("SystemSettingMapper", () => {
    it("round-trip document <-> domain", () => {
        const setting = SystemSetting.create();
        setting.merge({ overtimeEnabled: true, defaultLeaveDays: 12 });

        const doc = SystemSettingMapper.toDocument(setting);
        const back = SystemSettingMapper.toDomain(doc);

        expect(back.entries).toEqual({ overtimeEnabled: true, defaultLeaveDays: 12 });
    });
});
