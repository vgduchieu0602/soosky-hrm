import BankTransferProfile, { BankTransferColumn } from "@modules/setting/core/domain/entities/BankTransferProfile";
import BankTransferProfileInvalidError from "@modules/setting/core/domain/errors/BankTransferProfileInvalidError";
import { describe, expect, it } from "vitest";

const VALID_COLUMNS: BankTransferColumn[] = [
    { header: "STT", source: "sequence" },
    { header: "So tai khoan", source: "bank_account_number" },
    { header: "Ten chu tai khoan", source: "bank_account_holder" },
    { header: "So tien", source: "net_salary" },
    { header: "Noi dung", source: "static", staticValue: "Thanh toan luong" },
];

function build(overrides: Partial<Parameters<typeof BankTransferProfile.create>[0]> = {}) {
    return BankTransferProfile.create({
        id:            "profile-1",
        code:          "vcb",
        bankName:      "Vietcombank",
        description:   null,
        delimiter:     ",",
        includeHeader: true,
        utf8Bom:       true,
        amountFormat:  "plain",
        dateFormat:    "dd/MM/yyyy",
        columns:       VALID_COLUMNS,
        ...overrides,
    });
}

describe("BankTransferProfile", () => {
    it("chuẩn hoá mã về chữ hoa; hồ sơ mới KHÔNG tự bật", () => {
        const profile = build();
        expect(profile.code).toBe("VCB");
        expect(profile.isActive).toBe(false);
    });

    it("mã sai định dạng bị chặn", () => {
        expect(() => build({ code: "a" })).toThrow(BankTransferProfileInvalidError);
        expect(() => build({ code: "vcb bulk" })).toThrow(BankTransferProfileInvalidError);
    });

    it("thiếu cột số tài khoản hoặc số tiền thì file không dùng được -> chặn", () => {
        expect(() => build({
            columns: [{ header: "STT", source: "sequence" }, { header: "So tien", source: "net_salary" }],
        })).toThrow(BankTransferProfileInvalidError);

        expect(() => build({
            columns: [{ header: "STK", source: "bank_account_number" }],
        })).toThrow(BankTransferProfileInvalidError);
    });

    it("cột static không có giá trị là cột rỗng vô nghĩa -> chặn ngay lúc cấu hình", () => {
        expect(() => build({
            columns: [...VALID_COLUMNS.slice(0, 4), { header: "Noi dung", source: "static", staticValue: "  " }],
        })).toThrow(BankTransferProfileInvalidError);
    });

    it("không nhận danh sách cột rỗng, cũng không nhận định dạng ngày lạ", () => {
        expect(() => build({ columns: [] })).toThrow(BankTransferProfileInvalidError);
        expect(() => build({ dateFormat: "MM-dd-yy" })).toThrow(BankTransferProfileInvalidError);
    });

    it("update giữ nguyên trường không gửi và vẫn kiểm cột", () => {
        const profile = build();
        profile.update({ bankName: "VCB Chi nhanh 1", delimiter: ";" });

        expect(profile.bankName).toBe("VCB Chi nhanh 1");
        expect(profile.delimiter).toBe(";");
        expect(profile.amountFormat).toBe("plain");
        expect(profile.columns).toHaveLength(5);

        expect(() => profile.update({ columns: [{ header: "STT", source: "sequence" }] }))
            .toThrow(BankTransferProfileInvalidError);
    });

    it("activate/deactivate đổi cờ và mốc thời gian", () => {
        const profile = build();
        profile.activate();
        expect(profile.isActive).toBe(true);

        profile.deactivate();
        expect(profile.isActive).toBe(false);
    });
});
