import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}));

vi.mock("@core/http/axios", () => ({ default: api }));

import { iamService } from "@features/iam/services/iam.service";

describe("iamService", () => {
  beforeEach(() => vi.resetAllMocks());

  it("map user cua IAM sang hinh dang UI (_id/username)", async () => {
    api.get.mockResolvedValueOnce({
      data: {
        users: [{ id: "user-1", displayName: "HR Soosky", email: "hr@soosky.test", status: "active", createdAt: "2026-08-01T00:00:00.000Z" }],
      },
    });

    await expect(iamService.listUsers()).resolves.toEqual([{
      _id: "user-1", username: "HR Soosky", email: "hr@soosky.test", status: "active", created_at: "2026-08-01T00:00:00.000Z",
    }]);
    expect(api.get).toHaveBeenCalledWith("/iam/users");
  });

  it("doi trang thai user di qua module Auth, khong co endpoint ghi o /iam/users", async () => {
    api.post.mockResolvedValue({ data: undefined });

    await iamService.updateUserStatus("user-1", "disabled");
    expect(api.post).toHaveBeenCalledWith("/auth/accounts/user-1/deactivation", {});

    await iamService.updateUserStatus("user-1", "active");
    expect(api.post).toHaveBeenLastCalledWith("/auth/accounts/user-1/reactivation", {});
  });

  it("getRole doc role va quyen han bang HAI endpoint (danh sach role khong nhung quyen)", async () => {
    api.get
      .mockResolvedValueOnce({ data: { role: { id: "role-1", key: "hr", name: "HR", description: "Nhan su", isSystem: true, createdAt: "2026-08-01T00:00:00.000Z" } } })
      .mockResolvedValueOnce({ data: { permissionIds: ["perm-1", "perm-2"] } });

    await expect(iamService.getRole("role-1")).resolves.toEqual({
      _id: "role-1", key: "hr", name: "HR", description: "Nhan su", isSystem: true, permissionIds: ["perm-1", "perm-2"],
    });
    expect(api.get).toHaveBeenNthCalledWith(1, "/iam/roles/role-1");
    expect(api.get).toHaveBeenNthCalledWith(2, "/iam/roles/role-1/permissions");
  });

  it("createRole suy `key` tu ten khi khong nhap, roi dat quyen bang PUT rieng", async () => {
    api.post.mockResolvedValueOnce({ data: { role: { id: "role-9", key: "truong_nhom", name: "Trưởng nhóm", description: "", isSystem: false, createdAt: "2026-08-01T00:00:00.000Z" } } });
    api.put.mockResolvedValueOnce({ data: undefined });

    await expect(iamService.createRole({ name: "Trưởng nhóm", permissionIds: ["perm-1"] }))
      .resolves.toMatchObject({ _id: "role-9", key: "truong_nhom" });

    expect(api.post).toHaveBeenCalledWith("/iam/roles", { key: "truong_nhom", name: "Trưởng nhóm" });
    expect(api.put).toHaveBeenCalledWith("/iam/roles/role-9/permissions", { permissionIds: ["perm-1"] });
  });

  it("updateRole chi gui truong co gia tri, quyen han van dat bang PUT", async () => {
    api.patch.mockResolvedValueOnce({ data: { role: { id: "role-1", key: "hr", name: "HR moi", description: "", isSystem: true, createdAt: "2026-08-01T00:00:00.000Z" } } });
    api.put.mockResolvedValueOnce({ data: undefined });

    await iamService.updateRole("role-1", { name: "HR moi", permissionIds: [] });

    expect(api.patch).toHaveBeenCalledWith("/iam/roles/role-1", { name: "HR moi" });
    expect(api.put).toHaveBeenCalledWith("/iam/roles/role-1/permissions", { permissionIds: [] });
  });

  it("myPermissions doc quyen cua chinh actor (khong doi iam:manage)", async () => {
    api.get.mockResolvedValueOnce({ data: { permissions: ["employee:manage", "payroll:prepare"] } });

    await expect(iamService.myPermissions()).resolves.toEqual(["employee:manage", "payroll:prepare"]);
    expect(api.get).toHaveBeenCalledWith("/iam/me/permissions");
  });

  it("audit log: backend khong co tham so limit -> UI tu cat so dong", async () => {
    api.get.mockResolvedValueOnce({
      data: {
        auditLogs: [
          { id: "a1", actorUserId: "user-1", resource: "employee", action: "create", resourceId: "emp-1", changes: null, occurredAt: "2026-08-02T00:00:00.000Z" },
          { id: "a2", actorUserId: null, resource: "payroll_variance", action: "sign", resourceId: null, changes: { diff: -1000 }, occurredAt: "2026-08-01T00:00:00.000Z" },
        ],
      },
    });

    const logs = await iamService.listAuditLogs({ resource: "employee", limit: 1 });

    expect(api.get).toHaveBeenCalledWith("/iam/audit-logs", { params: { resource: "employee" } });
    expect(logs).toEqual([{
      _id: "a1", userId: "user-1", resource: "employee", action: "create", resourceId: "emp-1", timestamp: "2026-08-02T00:00:00.000Z",
    }]);
  });

  it("audit log cua he thong: actorUserId null duoc giu nguyen de UI hien 'He thong'", async () => {
    api.get.mockResolvedValueOnce({
      data: { auditLogs: [{ id: "a2", actorUserId: null, resource: "payroll", action: "run", resourceId: null, changes: null, occurredAt: "2026-08-01T00:00:00.000Z" }] },
    });

    const [entry] = await iamService.listAuditLogs();
    expect(entry?.userId).toBeNull();
    expect(entry?.resourceId).toBeUndefined();
  });

  it("gan/thu hoi role cua user dung endpoint cua IAM", async () => {
    api.post.mockResolvedValueOnce({ data: undefined });
    api.delete.mockResolvedValueOnce({ data: undefined });

    await iamService.assignRole("user-1", "role-1");
    await iamService.revokeRole("user-1", "role-1");

    expect(api.post).toHaveBeenCalledWith("/iam/users/user-1/roles", { roleId: "role-1" });
    expect(api.delete).toHaveBeenCalledWith("/iam/users/user-1/roles/role-1");
  });

  it("loi API duoc nem ra ngoai, khong bien thanh mang rong", async () => {
    api.get.mockRejectedValueOnce(Object.assign(new Error("Request failed"), {
      response: { status: 403, data: { code: "ACCESS_DENIED", message: "Không có quyền" } },
    }));

    await expect(iamService.listUsers()).rejects.toThrow("Request failed");
  });
});
