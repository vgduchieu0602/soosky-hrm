import PermissionChecker from "@modules/setting/core/app/ports/PermissionChecker";
import SystemSettingRepo from "@modules/setting/core/app/ports/SystemSettingRepo";
import GetSystemSettingsUseCase from "@modules/setting/core/app/use-cases/system/GetSystemSettingsUseCase";
import UpdateSystemSettingsUseCase from "@modules/setting/core/app/use-cases/system/UpdateSystemSettingsUseCase";
import SystemSetting from "@modules/setting/core/domain/entities/SystemSetting";
import AccessDeniedError from "@shared/core/app/errors/AccessDeniedError";
import { beforeEach, describe, expect, it } from "vitest";
import { mock, MockProxy } from "vitest-mock-extended";

function allowAllPermissions(): MockProxy<PermissionChecker> {
    const permissions = mock<PermissionChecker>();
    permissions.assertPermission.mockResolvedValue(undefined);
    return permissions;
}

describe("GetSystemSettingsUseCase", () => {
    let repo: MockProxy<SystemSettingRepo>;
    let useCase: GetSystemSettingsUseCase;

    beforeEach(() => {
        repo    = mock<SystemSettingRepo>();
        useCase = new GetSystemSettingsUseCase(repo);
    });

    it("trả về object rỗng khi chưa từng thiết lập", async () => {
        repo.get.mockResolvedValue(undefined);
        await expect(useCase.execute()).resolves.toEqual({});
    });

    it("trả về entries hiện có", async () => {
        const setting = SystemSetting.create();
        setting.merge({ overtimeEnabled: true });
        repo.get.mockResolvedValue(setting);
        await expect(useCase.execute()).resolves.toEqual({ overtimeEnabled: true });
    });
});

describe("UpdateSystemSettingsUseCase", () => {
    let repo: MockProxy<SystemSettingRepo>;

    beforeEach(() => {
        repo = mock<SystemSettingRepo>();
    });

    it("từ chối khi actor không có quyền setting:manage", async () => {
        const permissions = mock<PermissionChecker>();
        permissions.assertPermission.mockRejectedValue(new AccessDeniedError());
        const useCase = new UpdateSystemSettingsUseCase(permissions, repo);

        await expect(useCase.execute({ entries: { a: 1 }, actorUserId: "u1" })).rejects.toThrow(AccessDeniedError);
        expect(repo.save).not.toHaveBeenCalled();
    });

    it("tạo mới singleton khi chưa có, rồi lưu entry đã merge", async () => {
        const permissions = allowAllPermissions();
        repo.get.mockResolvedValue(undefined);
        const useCase = new UpdateSystemSettingsUseCase(permissions, repo);

        await useCase.execute({ entries: { overtimeEnabled: true }, actorUserId: "u1" });

        expect(repo.save).toHaveBeenCalledOnce();
        const saved = repo.save.mock.calls[0]?.[0] as SystemSetting;
        expect(saved.entries).toEqual({ overtimeEnabled: true });
    });

    it("ném lỗi domain khi value không hợp lệ, không lưu gì", async () => {
        const permissions = allowAllPermissions();
        repo.get.mockResolvedValue(undefined);
        const useCase = new UpdateSystemSettingsUseCase(permissions, repo);

        await expect(useCase.execute({ entries: { bad: { nested: true } }, actorUserId: "u1" })).rejects.toThrow(/string, number, or boolean/);
        expect(repo.save).not.toHaveBeenCalled();
    });
});
