import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
}));

vi.mock("@core/http/axios", () => ({ default: api }));

import { organizationService } from "@features/organization/services/organization.service";

describe("organizationService", () => {
  beforeEach(() => vi.resetAllMocks());

  it("reads the department tree from the module-prefixed backend response", async () => {
    const departments = [{ id: "dept-1", code: "ENG", name: "Engineering", children: [] }];
    api.get.mockResolvedValueOnce({ data: { departments } });

    await expect(organizationService.departmentsTree()).resolves.toEqual([{ ...departments[0], headcount: 0 }]);
    expect(api.get).toHaveBeenCalledWith("/department/departments?tree=true");
  });

  it("creates a department through the canonical department route", async () => {
    api.post.mockResolvedValueOnce({ data: { departmentId: "dept-1" } });
    api.get.mockResolvedValueOnce({
      data: { id: "dept-1", code: "ENG", name: "Engineering", parentDepartmentId: null, managerId: null, description: "", status: "active", createdAt: "2026-01-01T00:00:00.000Z" },
    });

    await expect(organizationService.createDepartment({ code: "ENG", name: "Engineering" })).resolves.toMatchObject({
      id: "dept-1",
      _id: "dept-1",
      code: "ENG",
      name: "Engineering",
    });
    expect(api.post).toHaveBeenCalledWith("/department/departments", { code: "ENG", name: "Engineering" });
    expect(api.get).toHaveBeenCalledWith("/department/departments/dept-1");
  });

  it("lists positions from the canonical collection response", async () => {
    const positions = [{ id: "pos-1", code: "DEV", title: "Developer", departmentId: "dept-1", level: 2, description: "", status: "active", createdAt: "2026-01-01T00:00:00.000Z" }];
    api.get.mockResolvedValueOnce({ data: { positions } });

    await expect(organizationService.positions()).resolves.toEqual([{ ...positions[0], _id: "pos-1" }]);
    expect(api.get).toHaveBeenCalledWith("/department/positions");
  });
});
