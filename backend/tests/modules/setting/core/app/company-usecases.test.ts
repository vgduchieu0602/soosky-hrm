import CompanyProfileNotFoundError from "@modules/setting/core/app/errors/CompanyProfileNotFoundError";
import CompanyProfileRepo from "@modules/setting/core/app/ports/CompanyProfileRepo";
import PermissionChecker from "@modules/setting/core/app/ports/PermissionChecker";
import GetCompanyProfileUseCase from "@modules/setting/core/app/use-cases/company/GetCompanyProfileUseCase";
import UpsertCompanyProfileUseCase from "@modules/setting/core/app/use-cases/company/UpsertCompanyProfileUseCase";
import CompanyProfile, { DEFAULT_CURRENCY, DEFAULT_TIMEZONE } from "@modules/setting/core/domain/entities/CompanyProfile";
import AccessDeniedError from "@shared/core/app/errors/AccessDeniedError";
import { beforeEach, describe, expect, it } from "vitest";
import { mock, MockProxy } from "vitest-mock-extended";

function companyProfile(): CompanyProfile {
    return CompanyProfile.create({
        name:                      "Soosky",
        address:                   null,
        taxCode:                   null,
        phone:                     null,
        email:                     null,
        logoUrl:                   null,
        timezone:                  DEFAULT_TIMEZONE,
        currency:                  DEFAULT_CURRENCY,
        standardWorkHoursPerDay:   8,
        standardWorkDaysPerMonth: 22,
    });
}

function allowAllPermissions(): MockProxy<PermissionChecker> {
    const permissions = mock<PermissionChecker>();
    permissions.assertPermission.mockResolvedValue(undefined);
    return permissions;
}

function denyAllPermissions(): MockProxy<PermissionChecker> {
    const permissions = mock<PermissionChecker>();
    permissions.assertPermission.mockRejectedValue(new AccessDeniedError());
    return permissions;
}

describe("GetCompanyProfileUseCase", () => {
    let repo: MockProxy<CompanyProfileRepo>;
    let useCase: GetCompanyProfileUseCase;

    beforeEach(() => {
        repo    = mock<CompanyProfileRepo>();
        useCase = new GetCompanyProfileUseCase(repo);
    });

    it("ném CompanyProfileNotFoundError khi chưa từng thiết lập", async () => {
        repo.get.mockResolvedValue(undefined);
        await expect(useCase.execute()).rejects.toThrow(CompanyProfileNotFoundError);
    });

    it("trả về hồ sơ khi đã tồn tại", async () => {
        const profile = companyProfile();
        repo.get.mockResolvedValue(profile);
        await expect(useCase.execute()).resolves.toBe(profile);
    });
});

describe("UpsertCompanyProfileUseCase", () => {
    let repo: MockProxy<CompanyProfileRepo>;

    beforeEach(() => {
        repo = mock<CompanyProfileRepo>();
    });

    it("từ chối khi actor không có quyền setting:manage", async () => {
        const useCase = new UpsertCompanyProfileUseCase(denyAllPermissions(), repo);
        await expect(useCase.execute({ name: "Soosky", actorUserId: "u1" })).rejects.toThrow(AccessDeniedError);
        expect(repo.save).not.toHaveBeenCalled();
    });

    it("tạo mới với giá trị mặc định khi chưa có hồ sơ", async () => {
        const permissions = allowAllPermissions();
        repo.get.mockResolvedValue(undefined);
        const useCase = new UpsertCompanyProfileUseCase(permissions, repo);

        await useCase.execute({ name: "Soosky", actorUserId: "u1" });

        expect(permissions.assertPermission).toHaveBeenCalledWith("u1", "setting:manage");
        expect(repo.save).toHaveBeenCalledOnce();
        const saved = repo.save.mock.calls[0]?.[0] as CompanyProfile;
        expect(saved.name).toBe("Soosky");
        expect(saved.currency).toBe(DEFAULT_CURRENCY);
        expect(saved.timezone).toBe(DEFAULT_TIMEZONE);
        expect(saved.standardWorkHoursPerDay).toBe(8);
        expect(saved.standardWorkDaysPerMonth).toBe(22);
    });

    it("chỉ patch field được truyền khi đã có hồ sơ", async () => {
        const permissions = allowAllPermissions();
        const existing = companyProfile();
        repo.get.mockResolvedValue(existing);
        const useCase = new UpsertCompanyProfileUseCase(permissions, repo);

        await useCase.execute({ name: "Soosky", address: "123 Main St", actorUserId: "u1" });

        expect(repo.save).toHaveBeenCalledWith(existing);
        expect(existing.address).toBe("123 Main St");
        expect(existing.currency).toBe(DEFAULT_CURRENCY);
    });
});
