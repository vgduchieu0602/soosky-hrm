import { createSettingHttpRouter, SettingHttpUseCases } from "@modules/setting";
import CompanyProfileRepo from "@modules/setting/core/app/ports/CompanyProfileRepo";
import PermissionChecker from "@modules/setting/core/app/ports/PermissionChecker";
import SystemSettingRepo from "@modules/setting/core/app/ports/SystemSettingRepo";
import GetCompanyProfileUseCase from "@modules/setting/core/app/use-cases/company/GetCompanyProfileUseCase";
import UpsertCompanyProfileUseCase from "@modules/setting/core/app/use-cases/company/UpsertCompanyProfileUseCase";
import GetSystemSettingsUseCase from "@modules/setting/core/app/use-cases/system/GetSystemSettingsUseCase";
import UpdateSystemSettingsUseCase from "@modules/setting/core/app/use-cases/system/UpdateSystemSettingsUseCase";
import CompanyProfile from "@modules/setting/core/domain/entities/CompanyProfile";
import SystemSetting from "@modules/setting/core/domain/entities/SystemSetting";
import AccessTokenVerifier, { AuthenticatedActor } from "@shared/adapters/driver/http/ports/AccessTokenVerifier";
import express, { Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

class InMemoryCompanyProfileRepo implements CompanyProfileRepo {
    private _profile: CompanyProfile | undefined;
    async get() { return this._profile; }
    async save(profile: CompanyProfile) { this._profile = profile; }
}

class InMemorySystemSettingRepo implements SystemSettingRepo {
    private _setting: SystemSetting | undefined;
    async get() { return this._setting; }
    async save(setting: SystemSetting) { this._setting = setting; }
}

const allowAllPermissions: PermissionChecker = {
    async assertPermission() { /* allow all in test */ },
};

function buildUseCases(): SettingHttpUseCases {
    const companyProfileRepo = new InMemoryCompanyProfileRepo();
    const systemSettingRepo  = new InMemorySystemSettingRepo();
    return {
        getCompanyProfile:    new GetCompanyProfileUseCase(companyProfileRepo),
        upsertCompanyProfile: new UpsertCompanyProfileUseCase(allowAllPermissions, companyProfileRepo),
        getSystemSettings:    new GetSystemSettingsUseCase(systemSettingRepo),
        updateSystemSettings: new UpdateSystemSettingsUseCase(allowAllPermissions, systemSettingRepo),
    };
}

const fakeVerifier: AccessTokenVerifier = {
    async verify(token: string) { return token ? new AuthenticatedActor(token) : undefined; },
};

function buildApp(): Express {
    const app = express();
    app.use("/setting", createSettingHttpRouter(buildUseCases(), fakeVerifier));
    return app;
}

describe("Setting HTTP", () => {
    let app: Express;
    beforeEach(() => { app = buildApp(); });

    const auth = { Authorization: "Bearer user-1" };

    it("401 khi thiếu token", async () => {
        await request(app).get("/setting/company").expect(401);
    });

    it("404 khi chưa từng thiết lập hồ sơ công ty", async () => {
        await request(app).get("/setting/company").set(auth)
            .expect(404).expect(res => expect(res.body.code).toBe("COMPANY_PROFILE_NOT_FOUND"));
    });

    it("upsert company -> get company", async () => {
        await request(app).put("/setting/company").set(auth)
            .send({ name: "Soosky HRM", address: "123 Main St", currency: "vnd" })
            .expect(200);

        await request(app).get("/setting/company").set(auth)
            .expect(200).expect(res => {
                expect(res.body.name).toBe("Soosky HRM");
                expect(res.body.address).toBe("123 Main St");
                expect(res.body.currency).toBe("VND");
                expect(res.body.timezone).toBe("Asia/Ho_Chi_Minh");
                expect(res.body.standardWorkHoursPerDay).toBe(8);
                expect(res.body.standardWorkDaysPerMonth).toBe(22);
            });

        // second upsert only patches address, name still required by schema
        await request(app).put("/setting/company").set(auth)
            .send({ name: "Soosky HRM", address: "456 Other St" })
            .expect(200);

        await request(app).get("/setting/company").set(auth)
            .expect(200).expect(res => {
                expect(res.body.address).toBe("456 Other St");
                expect(res.body.currency).toBe("VND");
            });
    });

    it("422 khi tên công ty rỗng", async () => {
        await request(app).put("/setting/company").set(auth).send({ name: "   " })
            .expect(422).expect(res => expect(res.body.code).toBe("COMPANY_PROFILE_INVALID"));
    });

    it("system settings: get rỗng -> update -> get phản ánh thay đổi", async () => {
        await request(app).get("/setting/system").set(auth)
            .expect(200).expect(res => expect(res.body.settings).toEqual({}));

        await request(app).patch("/setting/system").set(auth)
            .send({ overtimeEnabled: true, defaultLeaveDays: 12 })
            .expect(200);

        await request(app).get("/setting/system").set(auth)
            .expect(200).expect(res => expect(res.body.settings).toEqual({ overtimeEnabled: true, defaultLeaveDays: 12 }));
    });

    it("422 khi system setting value không hợp lệ", async () => {
        await request(app).patch("/setting/system").set(auth).send({ bad: { nested: true } })
            .expect(422).expect(res => expect(res.body.code).toBe("SYSTEM_SETTING_INVALID"));
    });
});
