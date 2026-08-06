import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}));

vi.mock("@core/http/axios", () => ({ default: api }));

import { employeeService } from "@features/employee/services/employee.service";

describe("employeeService", () => {
  beforeEach(() => vi.resetAllMocks());

  it("maps the module-prefixed employee collection into the existing UI record", async () => {
    api.get.mockResolvedValueOnce({
      data: {
        employees: [{
          id: "emp-1", code: "NV001", name: "Nguyen Van A", email: "a@soosky.co", phone: null, dob: null, gender: null,
          departmentId: "dept-1", positionId: "pos-1", managerId: null, hireDate: "2026-01-01T00:00:00.000Z",
          terminationDate: null, employeeType: "full_time", status: "active", accountId: null, createdAt: "2026-01-01T00:00:00.000Z",
        }],
      },
    });

    await expect(employeeService.list({ departmentId: "dept-1", status: "active" })).resolves.toMatchObject({
      items: [{ _id: "emp-1", employeeCode: "NV001", departmentId: "dept-1", positionId: "pos-1" }],
      meta: { total: 1 },
    });
    expect(api.get).toHaveBeenCalledWith("/employee/employees", { params: { departmentId: "dept-1", status: "active" } });
  });

  it("creates an employee using the backend's code and name payload", async () => {
    api.post.mockResolvedValueOnce({ data: { employeeId: "emp-1" } });
    api.get.mockResolvedValueOnce({
      data: {
        id: "emp-1", code: "NV001", name: "Nguyen Van A", email: "a@soosky.co", phone: null, dob: null, gender: null,
        departmentId: "dept-1", positionId: "pos-1", managerId: null, hireDate: "2026-01-01T00:00:00.000Z",
        terminationDate: null, employeeType: "full_time", status: "active", accountId: null, createdAt: "2026-01-01T00:00:00.000Z",
      },
    });

    await expect(employeeService.create({
      employeeCode: "NV001", departmentId: "dept-1", positionId: "pos-1", hireDate: "2026-01-01T00:00:00.000Z", employeeType: "full_time",
      profile: { firstName: "Nguyen", middleName: "Van", lastName: "A", email: "a@soosky.co" },
    })).resolves.toMatchObject({ _id: "emp-1", employeeCode: "NV001" });
    expect(api.post).toHaveBeenCalledWith("/employee/employees", {
      code: "NV001", name: "Nguyen Van A", email: "a@soosky.co", departmentId: "dept-1", positionId: "pos-1",
      hireDate: "2026-01-01T00:00:00.000Z", employeeType: "full_time",
    });
    expect(api.get).toHaveBeenCalledWith("/employee/employees/emp-1");
  });

  it("updates only fields supported by the backend then reloads the employee", async () => {
    api.patch.mockResolvedValueOnce({ data: undefined });
    api.get.mockResolvedValueOnce({
      data: {
        id: "emp-1", code: "NV002", name: "Nguyen Van A", email: null, phone: null, dob: null, gender: null,
        departmentId: "dept-2", positionId: "pos-2", managerId: null, hireDate: "2026-01-01T00:00:00.000Z",
        terminationDate: null, employeeType: "full_time", status: "active", accountId: null, createdAt: "2026-01-01T00:00:00.000Z",
      },
    });

    await expect(employeeService.update("emp-1", { employeeCode: "NV002", departmentId: "dept-2", positionId: "pos-2" }))
      .resolves.toMatchObject({ employeeCode: "NV002", departmentId: "dept-2" });
    expect(api.patch).toHaveBeenCalledWith("/employee/employees/emp-1", {
      code: "NV002", departmentId: "dept-2", positionId: "pos-2",
    });
    expect(api.get).toHaveBeenCalledWith("/employee/employees/emp-1");
  });

  it("reads contacts from the employee module collection and preserves the UI id field", async () => {
    api.get.mockResolvedValueOnce({
      data: { contacts: [{ id: "contact-1", employeeId: "emp-1", name: "Nguyen B", relationship: "parent", phone: null, email: null, address: null, isPrimary: true, createdAt: "2026-01-01T00:00:00.000Z" }] },
    });

    await expect(employeeService.contacts("emp-1")).resolves.toEqual([{
      _id: "contact-1", id: "contact-1", employeeId: "emp-1", name: "Nguyen B", relationship: "parent", phone: null, email: null, address: null, isPrimary: true, createdAt: "2026-01-01T00:00:00.000Z",
    }]);
    expect(api.get).toHaveBeenCalledWith("/employee/employees/emp-1/contacts");
  });

  it("creates a contact through the employee module then reloads that contact", async () => {
    api.post.mockResolvedValueOnce({ data: { contactId: "contact-1" } });
    api.get.mockResolvedValueOnce({
      data: { contacts: [{ id: "contact-1", employeeId: "emp-1", name: "Nguyen B", relationship: "parent", phone: "0900000000", email: null, address: null, isPrimary: false, createdAt: "2026-01-01T00:00:00.000Z" }] },
    });

    await expect(employeeService.addContact("emp-1", {
      name: "Nguyen B", relationship: "parent", phone: "0900000000",
    })).resolves.toMatchObject({ _id: "contact-1", name: "Nguyen B" });
    expect(api.post).toHaveBeenCalledWith("/employee/employees/emp-1/contacts", {
      name: "Nguyen B", relationship: "parent", phone: "0900000000",
    });
    expect(api.get).toHaveBeenCalledWith("/employee/employees/emp-1/contacts");
  });

  it("uses resource-level bank-account endpoints and excludes UI-only fields", async () => {
    api.post.mockResolvedValueOnce({ data: { bankAccountId: "bank-1" } });
    api.patch.mockResolvedValueOnce({ data: undefined });
    api.delete.mockResolvedValueOnce({ data: undefined });
    api.get.mockResolvedValueOnce({
      data: { bankAccounts: [{ id: "bank-1", employeeId: "emp-1", bankName: "VCB", branch: null, accountNumber: "001", accountHolder: "Nguyen A", createdAt: "2026-01-01T00:00:00.000Z" }] },
    }).mockResolvedValueOnce({
      data: { bankAccounts: [{ id: "bank-1", employeeId: "emp-1", bankName: "Vietcombank", branch: null, accountNumber: "001", accountHolder: "Nguyen A", createdAt: "2026-01-01T00:00:00.000Z" }] },
    });

    await expect(employeeService.addBankAccount("emp-1", {
      bankName: "VCB", accountNumber: "001", accountHolder: "Nguyen A", isPrimary: true,
    })).resolves.toMatchObject({ _id: "bank-1", bankName: "VCB" });
    await expect(employeeService.updateBankAccount("emp-1", "bank-1", { bankName: "Vietcombank" }))
      .resolves.toMatchObject({ bankName: "Vietcombank" });
    await employeeService.deleteBankAccount("emp-1", "bank-1");

    expect(api.post).toHaveBeenCalledWith("/employee/employees/emp-1/bank-accounts", {
      bankName: "VCB", accountNumber: "001", accountHolder: "Nguyen A",
    });
    expect(api.patch).toHaveBeenCalledWith("/employee/bank-accounts/bank-1", { bankName: "Vietcombank" });
    expect(api.delete).toHaveBeenCalledWith("/employee/bank-accounts/bank-1");
  });

  it("uses document and contract resource endpoints for all writes", async () => {
    api.post.mockResolvedValueOnce({ data: { documentId: "doc-1" } }).mockResolvedValueOnce({ data: { contractId: "contract-1" } });
    api.patch.mockResolvedValueOnce({ data: undefined }).mockResolvedValueOnce({ data: undefined });
    api.delete.mockResolvedValueOnce({ data: undefined }).mockResolvedValueOnce({ data: undefined });
    api.get.mockResolvedValueOnce({
      data: { documents: [{ id: "doc-1", employeeId: "emp-1", documentType: "id_card", documentNumber: "123", fileUrl: null, issuedDate: null, expiryDate: null, issuedBy: null, createdAt: "2026-01-01T00:00:00.000Z" }] },
    }).mockResolvedValueOnce({
      data: { documents: [{ id: "doc-1", employeeId: "emp-1", documentType: "id_card", documentNumber: "456", fileUrl: null, issuedDate: null, expiryDate: null, issuedBy: null, createdAt: "2026-01-01T00:00:00.000Z" }] },
    }).mockResolvedValueOnce({
      data: { contracts: [{ id: "contract-1", employeeId: "emp-1", contractType: "fixed_term", employmentStatus: "official", contractNumber: "HD01", startDate: "2026-01-01T00:00:00.000Z", endDate: null, baseSalary: 10000000, currency: "VND", status: "active", fileUrl: null, createdAt: "2026-01-01T00:00:00.000Z" }] },
    }).mockResolvedValueOnce({
      data: { contracts: [{ id: "contract-1", employeeId: "emp-1", contractType: "fixed_term", employmentStatus: "official", contractNumber: "HD01", startDate: "2026-01-01T00:00:00.000Z", endDate: null, baseSalary: 12000000, currency: "VND", status: "active", fileUrl: null, createdAt: "2026-01-01T00:00:00.000Z" }] },
    });

    await employeeService.addDocument("emp-1", { documentType: "id_card", documentNumber: "123" });
    await employeeService.updateDocument("emp-1", "doc-1", { documentNumber: "456" });
    await employeeService.deleteDocument("emp-1", "doc-1");
    await employeeService.addContract("emp-1", {
      contractType: "fixed_term", employmentStatus: "official", contractNumber: "HD01", startDate: "2026-01-01T00:00:00.000Z", baseSalary: 10000000,
    });
    await employeeService.updateContract("emp-1", "contract-1", { baseSalary: 12000000 });
    await employeeService.deleteContract("emp-1", "contract-1");

    expect(api.post).toHaveBeenNthCalledWith(1, "/employee/employees/emp-1/documents", { documentType: "id_card", documentNumber: "123" });
    expect(api.patch).toHaveBeenNthCalledWith(1, "/employee/documents/doc-1", { documentNumber: "456" });
    expect(api.delete).toHaveBeenNthCalledWith(1, "/employee/documents/doc-1");
    expect(api.post).toHaveBeenNthCalledWith(2, "/employee/employees/emp-1/contracts", expect.objectContaining({ contractNumber: "HD01" }));
    expect(api.patch).toHaveBeenNthCalledWith(2, "/employee/contracts/contract-1", { baseSalary: 12000000 });
    expect(api.delete).toHaveBeenNthCalledWith(2, "/employee/contracts/contract-1");
  });

  it("updates and returns assets through the backend's single resource endpoint", async () => {
    api.patch.mockResolvedValue({ data: undefined });
    api.delete.mockResolvedValueOnce({ data: undefined });
    api.get.mockResolvedValue({
      data: { assets: [{ id: "asset-1", employeeId: "emp-1", assetName: "Laptop", assetCode: "LT01", assignedDate: "2026-01-01T00:00:00.000Z", returnedDate: null, condition: "good", note: null, createdAt: "2026-01-01T00:00:00.000Z" }] },
    });

    await employeeService.updateAsset("emp-1", "asset-1", { assetName: "Laptop Pro", condition: "good" });
    await employeeService.returnAsset("emp-1", "asset-1", { returnedDate: "2026-02-01T00:00:00.000Z", condition: "fair" });
    await employeeService.deleteAsset("emp-1", "asset-1");

    expect(api.patch).toHaveBeenNthCalledWith(1, "/employee/assets/asset-1", { condition: "good" });
    expect(api.patch).toHaveBeenNthCalledWith(2, "/employee/assets/asset-1", { returnedDate: "2026-02-01T00:00:00.000Z", condition: "fair" });
    expect(api.delete).toHaveBeenCalledWith("/employee/assets/asset-1");
  });

  it("updates the profile with personalEmail and reloads the UI profile", async () => {
    api.put.mockResolvedValueOnce({ data: undefined });
    api.get.mockResolvedValueOnce({
      data: {
        id: "profile-1", employeeId: "emp-1", firstName: "Nguyen", lastName: "A", middleName: null,
        dateOfBirth: null, gender: null, nationality: null, maritalStatus: null, avatarUrl: null,
        personalEmail: "a@example.com", workEmail: "a@soosky.co", phone: "0900000000", address: null,
        socialInsuranceNo: null, taxCode: null, vehiclePlate: null, createdAt: "2026-01-01T00:00:00.000Z",
      },
    });

    await expect(employeeService.updateProfile("emp-1", { email: "a@example.com", phone: "0900000000" }))
      .resolves.toMatchObject({ email: "a@example.com", workEmail: "a@soosky.co" });
    expect(api.put).toHaveBeenCalledWith("/employee/employees/emp-1/profile", {
      personalEmail: "a@example.com", phone: "0900000000",
    });
    expect(api.get).toHaveBeenCalledWith("/employee/employees/emp-1/profile");
  });

  it("terminates an employee using the required date and backend note field", async () => {
    api.post.mockResolvedValueOnce({ data: undefined });
    api.get.mockResolvedValueOnce({
      data: {
        id: "emp-1", code: "NV001", name: "Nguyen Van A", email: null, phone: null, dob: null, gender: null,
        departmentId: "dept-1", positionId: "pos-1", managerId: null, hireDate: "2026-01-01T00:00:00.000Z",
        terminationDate: "2026-02-01T00:00:00.000Z", employeeType: "full_time", status: "terminated", accountId: null, createdAt: "2026-01-01T00:00:00.000Z",
      },
    });

    await expect(employeeService.terminate("emp-1", {
      terminationDate: "2026-02-01T00:00:00.000Z", reason: "Resigned",
    })).resolves.toMatchObject({ status: "terminated" });
    expect(api.post).toHaveBeenCalledWith("/employee/employees/emp-1/terminate", {
      terminationDate: "2026-02-01T00:00:00.000Z", note: "Resigned",
    });
    expect(api.get).toHaveBeenCalledWith("/employee/employees/emp-1");
  });

  it("fails clearly instead of calling legacy endpoints for unsupported backend-v1 capabilities", async () => {
    await expect(employeeService.stats()).rejects.toThrow("Employee statistics is not available in backend v1 contract");
    await expect(employeeService.importEmployees([])).rejects.toThrow("Employee import is not available in backend v1 contract");
    await expect(employeeService.grantLogin("emp-1", { sendEmail: true })).rejects.toThrow("Employee account provisioning is not available in backend v1 contract");

    expect(api.get).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
  });
});
