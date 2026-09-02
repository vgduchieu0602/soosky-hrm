import { vi } from 'vitest';
/**
 * HTTP integration for the department changes:
 *   • hard-delete when nothing references the department
 *   • 409 warning (ORG_DEPT_HAS_DATA) when employees / positions / children remain
 *   • create no longer accepts the removed fields (costCenter/location/email)
 */
import mongoose from "mongoose";
import { api, bearer, tokenFor, startDb, stopDb, clearDb, seedRoles } from "@/test-support/http";
import { Department } from "@shared/models/department.model";
import { Employee } from "@shared/models/employee.model";
import { Position } from "@shared/models/position.model";

vi.setConfig({ testTimeout: 60_000 });

beforeAll(startDb);
afterAll(stopDb);
beforeEach(seedRoles);
afterEach(clearDb);

const admin = () => bearer(tokenFor(["admin"]).token);
const oid = () => new mongoose.Types.ObjectId();

async function createDept(name: string, code: string, parentDepartmentId?: string) {
  const res = await api
    .post("/api/v1/admin/departments")
    .set(admin())
    .send({ name, code, ...(parentDepartmentId ? { parentDepartmentId } : {}) });
  return res;
}

describe("Department delete (hard-delete with dependency guard)", () => {
  it("hard-deletes a department that has no dependents", async () => {
    const c = await createDept("Kỹ thuật", "ENG");
    const id = c.body.data._id ?? c.body.data.id;

    const del = await api.delete(`/api/v1/admin/departments/${id}`).set(admin());
    expect(del.status).toBe(200);
    expect(await Department.findById(id)).toBeNull(); // actually gone, not archived
  });

  it("refuses to delete when a sub-department remains (409 warning)", async () => {
    const parent = await createDept("Cha", "PAR");
    const parentId = parent.body.data._id ?? parent.body.data.id;
    await createDept("Con", "CHILD", parentId);

    const del = await api.delete(`/api/v1/admin/departments/${parentId}`).set(admin());
    expect(del.status).toBe(409);
    expect(del.body.error.code).toBe("ORG_DEPT_HAS_DATA");
    expect(await Department.findById(parentId)).not.toBeNull(); // still there
  });

  it("refuses to delete when an employee still references it (409)", async () => {
    const d = await createDept("Nhân sự", "HR");
    const id = d.body.data._id ?? d.body.data.id;
    await Employee.create({
      employeeCode: "E-DEP", departmentId: id, positionId: oid(),
      hireDate: new Date("2026-01-01"), employeeType: "full_time", status: "active",
    });

    const del = await api.delete(`/api/v1/admin/departments/${id}`).set(admin());
    expect(del.status).toBe(409);
    expect(del.body.error.code).toBe("ORG_DEPT_HAS_DATA");
  });

  it("refuses to delete when a position still references it (409)", async () => {
    const d = await createDept("Kinh doanh", "SALES");
    const id = d.body.data._id ?? d.body.data.id;
    await Position.create({ title: "NV", code: "SL1", departmentId: id, level: 1 });

    const del = await api.delete(`/api/v1/admin/departments/${id}`).set(admin());
    expect(del.status).toBe(409);
  });
});

describe("Department create — removed fields rejected", () => {
  it("rejects costCenter / location / email (strict DTO, 4xx)", async () => {
    const res = await api
      .post("/api/v1/admin/departments")
      .set(admin())
      .send({ name: "X", code: "XX", costCenter: "CC", location: "HN", email: "x@y.com" });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it("accepts a department without the removed fields (201)", async () => {
    const res = await createDept("Ổn", "OK");
    expect(res.status).toBe(201);
  });
});
