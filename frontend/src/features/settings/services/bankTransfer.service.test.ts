import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
}));

vi.mock("@core/http/axios", () => ({ default: api }));

import {
  BANK_COLUMN_LABELS,
  BANK_COLUMN_SOURCES,
  bankTransferService,
} from "@features/settings/services/bankTransfer.service";

const PROFILE = {
  id: "profile-1",
  code: "VCB",
  bankName: "Vietcombank",
  description: null,
  delimiter: ",",
  includeHeader: true,
  utf8Bom: true,
  amountFormat: "plain" as const,
  dateFormat: "dd/MM/yyyy",
  columns: [
    { header: "So tai khoan", source: "bank_account_number" as const, staticValue: null },
    { header: "So tien", source: "net_salary" as const, staticValue: null },
  ],
  isActive: false,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

describe("bankTransferService", () => {
  beforeEach(() => vi.resetAllMocks());

  it("doc danh sach mau file tu /setting/bank-profiles", async () => {
    api.get.mockResolvedValueOnce({ data: { bankProfiles: [PROFILE] } });

    await expect(bankTransferService.list()).resolves.toEqual([PROFILE]);
    expect(api.get).toHaveBeenCalledWith("/setting/bank-profiles");
  });

  it("tao mau: gui nguyen payload, khong bo boc envelope", async () => {
    api.post.mockResolvedValueOnce({ data: PROFILE });

    const input = { code: "vcb", bankName: "Vietcombank", columns: PROFILE.columns };
    await expect(bankTransferService.create(input)).resolves.toEqual(PROFILE);
    expect(api.post).toHaveBeenCalledWith("/setting/bank-profiles", input);
  });

  it("sua mau dung PATCH theo id", async () => {
    api.patch.mockResolvedValueOnce({ data: { ...PROFILE, delimiter: ";" } });

    await expect(bankTransferService.update("profile-1", { delimiter: ";" }))
      .resolves.toMatchObject({ delimiter: ";" });
    expect(api.patch).toHaveBeenCalledWith("/setting/bank-profiles/profile-1", { delimiter: ";" });
  });

  it("bat mau dung endpoint activate rieng (khong PATCH isActive)", async () => {
    api.post.mockResolvedValueOnce({ data: { ...PROFILE, isActive: true } });

    await expect(bankTransferService.activate("profile-1")).resolves.toMatchObject({ isActive: true });
    expect(api.post).toHaveBeenCalledWith("/setting/bank-profiles/profile-1/activate");
    expect(api.patch).not.toHaveBeenCalled();
  });

  it("xoa mau goi DELETE theo id", async () => {
    api.delete.mockResolvedValueOnce({ data: undefined });

    await expect(bankTransferService.remove("profile-1")).resolves.toBeUndefined();
    expect(api.delete).toHaveBeenCalledWith("/setting/bank-profiles/profile-1");
  });

  it("loi 422 khi thieu cot bat buoc duoc nem nguyen ra ngoai cho UI hien message", async () => {
    api.post.mockRejectedValueOnce(Object.assign(new Error("Request failed"), {
      response: { status: 422, data: { code: "BANK_TRANSFER_PROFILE_INVALID", message: "Profile must include a 'net_salary' column" } },
    }));

    await expect(bankTransferService.create({ code: "BAD", bankName: "X", columns: [] }))
      .rejects.toMatchObject({ response: { data: { code: "BANK_TRANSFER_PROFILE_INVALID" } } });
  });

  it("loi 422 khi xoa mau dang bat", async () => {
    api.delete.mockRejectedValueOnce(Object.assign(new Error("Request failed"), {
      response: { status: 422, data: { code: "BANK_TRANSFER_PROFILE_INVALID", message: "Cannot delete the active profile" } },
    }));

    await expect(bankTransferService.remove("profile-1")).rejects.toMatchObject({
      response: { data: { code: "BANK_TRANSFER_PROFILE_INVALID" } },
    });
  });

  it("moi nguon cot deu co nhan tieng Viet (UI khong hien ra ma ky thuat)", () => {
    for (const source of BANK_COLUMN_SOURCES) {
      expect(BANK_COLUMN_LABELS[source]).toBeTypeOf("string");
      expect(BANK_COLUMN_LABELS[source].length).toBeGreaterThan(0);
    }
  });
});
