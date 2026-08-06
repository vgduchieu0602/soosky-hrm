import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
}));

vi.mock("@core/http/axios", () => ({ default: api }));

import { authService } from "@features/auth/services/auth.service";

describe("authService.login", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("opens a backend session then returns the authenticated account for the UI", async () => {
    api.post.mockResolvedValueOnce({
      data: {
        accessToken: "access-token",
        refreshToken: "refresh-token",
        accessExpiresAt: "2026-07-30T12:00:00.000Z",
        mustChangePassword: false,
      },
    });
    api.get.mockResolvedValueOnce({
      data: {
        account: {
          id: "account-1",
          email: "hr@soosky.co",
          fullName: "HR Soosky",
          role: "admin",
          status: "active",
          verifiedAt: "2026-07-30T00:00:00.000Z",
          createdAt: "2026-07-30T00:00:00.000Z",
        },
      },
    });
    // Vai tro UI suy ra tu quyen han IAM thuc (role tang Auth khong phai role nghiep vu).
    api.get.mockResolvedValueOnce({ data: { permissions: ["employee:manage", "payroll:prepare"] } });

    await expect(authService.login({ identifier: "hr@soosky.co", password: "secret" })).resolves.toEqual({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      accessExpiresAt: "2026-07-30T12:00:00.000Z",
      mustChangePassword: false,
      user: {
        id: "account-1",
        username: "HR Soosky",
        email: "hr@soosky.co",
        roles: ["admin", "hr_manager", "employee"],
        permissions: ["employee:manage", "payroll:prepare"],
        mustChangePassword: false,
      },
    });
    expect(api.post).toHaveBeenCalledWith("/auth/sessions", {
      email: "hr@soosky.co",
      password: "secret",
    });
    expect(api.get).toHaveBeenCalledWith("/auth/me", {
      headers: { Authorization: "Bearer access-token" },
    });
  });

  it("verifies an account with the one-time token endpoint exposed by the backend", async () => {
    api.post.mockResolvedValueOnce({ data: { status: "active" } });

    await expect(authService.verifyAccount("verification-token")).resolves.toEqual({ status: "active" });
    expect(api.post).toHaveBeenCalledWith("/auth/accounts/verification", {
      token: "verification-token",
    });
  });
});
