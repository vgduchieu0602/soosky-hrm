import SystemSetting, { SYSTEM_SETTING_ID } from "@modules/setting/core/domain/entities/SystemSetting";
import { describe, expect, it } from "vitest";

describe("SystemSetting.create", () => {
    it("dùng id cố định 'global' và bắt đầu rỗng", () => {
        const setting = SystemSetting.create();
        expect(setting.id).toBe(SYSTEM_SETTING_ID);
        expect(setting.entries).toEqual({});
    });
});

describe("SystemSetting.merge", () => {
    it("gộp entry mới, giữ nguyên entry cũ không bị ghi đè", () => {
        const setting = SystemSetting.create();
        setting.merge({ overtimeEnabled: true, defaultLeaveDays: 12 });
        setting.merge({ overtimeEnabled: false });

        expect(setting.entries).toEqual({ overtimeEnabled: false, defaultLeaveDays: 12 });
    });

    it("chấp nhận string/number/boolean", () => {
        const setting = SystemSetting.create();
        setting.merge({ a: "x", b: 1, c: true });
        expect(setting.entries).toEqual({ a: "x", b: 1, c: true });
    });

    it("từ chối key rỗng", () => {
        const setting = SystemSetting.create();
        expect(() => setting.merge({ "": 1 })).toThrow(/must not be empty/);
    });

    it("từ chối value không thuộc kiểu cho phép", () => {
        const setting = SystemSetting.create();
        expect(() => setting.merge({ nested: { a: 1 } })).toThrow(/string, number, or boolean/);
    });

    it("trả về bản sao phòng thủ — mutate kết quả không ảnh hưởng entity", () => {
        const setting = SystemSetting.create();
        setting.merge({ a: 1 });
        const snapshot = setting.entries;
        snapshot.a = 999;
        expect(setting.entries.a).toBe(1);
    });
});
