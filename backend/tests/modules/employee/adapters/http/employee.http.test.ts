import { createEmployeeHttpRouter, EmployeeHttpUseCases } from "@modules/employee";
import EmployeeAssetRepo from "@modules/employee/core/app/ports/EmployeeAssetRepo";
import EmployeeBankAccountRepo from "@modules/employee/core/app/ports/EmployeeBankAccountRepo";
import EmployeeContactRepo from "@modules/employee/core/app/ports/EmployeeContactRepo";
import EmployeeContractRepo from "@modules/employee/core/app/ports/EmployeeContractRepo";
import EmployeeDocumentRepo from "@modules/employee/core/app/ports/EmployeeDocumentRepo";
import EmployeeHistoryRepo from "@modules/employee/core/app/ports/EmployeeHistoryRepo";
import EmployeeProfileRepo from "@modules/employee/core/app/ports/EmployeeProfileRepo";
import EmployeeRepo, { EmployeeListFilter } from "@modules/employee/core/app/ports/EmployeeRepo";
import OrgDirectory from "@modules/employee/core/app/ports/OrgDirectory";
import AccountProvisioner from "@modules/employee/core/app/ports/AccountProvisioner";
import AuditTrail from "@modules/employee/core/app/ports/AuditTrail";
import PermissionChecker from "@modules/employee/core/app/ports/PermissionChecker";
import EmployeeAccessScope from "@modules/employee/core/app/services/EmployeeAccessScope";
import EmployeeImportValidator from "@modules/employee/core/app/services/EmployeeImportValidator";
import ManagerChain from "@modules/employee/core/app/services/ManagerChain";
import GrantEmployeeLoginUseCase from "@modules/employee/core/app/use-cases/employee/GrantEmployeeLoginUseCase";
import CommitEmployeeImportUseCase from "@modules/employee/core/app/use-cases/import/CommitEmployeeImportUseCase";
import PreviewEmployeeImportUseCase from "@modules/employee/core/app/use-cases/import/PreviewEmployeeImportUseCase";
import CreateEmployeeAssetUseCase from "@modules/employee/core/app/use-cases/asset/CreateEmployeeAssetUseCase";
import DeleteEmployeeAssetUseCase from "@modules/employee/core/app/use-cases/asset/DeleteEmployeeAssetUseCase";
import ListEmployeeAssetsUseCase from "@modules/employee/core/app/use-cases/asset/ListEmployeeAssetsUseCase";
import UpdateEmployeeAssetUseCase from "@modules/employee/core/app/use-cases/asset/UpdateEmployeeAssetUseCase";
import CreateEmployeeBankAccountUseCase from "@modules/employee/core/app/use-cases/bank-account/CreateEmployeeBankAccountUseCase";
import DeleteEmployeeBankAccountUseCase from "@modules/employee/core/app/use-cases/bank-account/DeleteEmployeeBankAccountUseCase";
import ListEmployeeBankAccountsUseCase from "@modules/employee/core/app/use-cases/bank-account/ListEmployeeBankAccountsUseCase";
import UpdateEmployeeBankAccountUseCase from "@modules/employee/core/app/use-cases/bank-account/UpdateEmployeeBankAccountUseCase";
import CreateEmployeeContactUseCase from "@modules/employee/core/app/use-cases/contact/CreateEmployeeContactUseCase";
import DeleteEmployeeContactUseCase from "@modules/employee/core/app/use-cases/contact/DeleteEmployeeContactUseCase";
import ListEmployeeContactsUseCase from "@modules/employee/core/app/use-cases/contact/ListEmployeeContactsUseCase";
import UpdateEmployeeContactUseCase from "@modules/employee/core/app/use-cases/contact/UpdateEmployeeContactUseCase";
import CreateEmployeeContractUseCase from "@modules/employee/core/app/use-cases/contract/CreateEmployeeContractUseCase";
import DeleteEmployeeContractUseCase from "@modules/employee/core/app/use-cases/contract/DeleteEmployeeContractUseCase";
import ListEmployeeContractsUseCase from "@modules/employee/core/app/use-cases/contract/ListEmployeeContractsUseCase";
import UpdateEmployeeContractUseCase from "@modules/employee/core/app/use-cases/contract/UpdateEmployeeContractUseCase";
import CreateEmployeeDocumentUseCase from "@modules/employee/core/app/use-cases/document/CreateEmployeeDocumentUseCase";
import DeleteEmployeeDocumentUseCase from "@modules/employee/core/app/use-cases/document/DeleteEmployeeDocumentUseCase";
import ListEmployeeDocumentsUseCase from "@modules/employee/core/app/use-cases/document/ListEmployeeDocumentsUseCase";
import UpdateEmployeeDocumentUseCase from "@modules/employee/core/app/use-cases/document/UpdateEmployeeDocumentUseCase";
import CreateEmployeeUseCase from "@modules/employee/core/app/use-cases/employee/CreateEmployeeUseCase";
import GetEmployeeUseCase from "@modules/employee/core/app/use-cases/employee/GetEmployeeUseCase";
import ListEmployeesUseCase from "@modules/employee/core/app/use-cases/employee/ListEmployeesUseCase";
import TerminateEmployeeUseCase from "@modules/employee/core/app/use-cases/employee/TerminateEmployeeUseCase";
import UpdateEmployeeUseCase from "@modules/employee/core/app/use-cases/employee/UpdateEmployeeUseCase";
import ListEmployeeHistoryUseCase from "@modules/employee/core/app/use-cases/history/ListEmployeeHistoryUseCase";
import GetEmployeeProfileUseCase from "@modules/employee/core/app/use-cases/profile/GetEmployeeProfileUseCase";
import UpdateEmployeeProfileUseCase from "@modules/employee/core/app/use-cases/profile/UpdateEmployeeProfileUseCase";
import Employee from "@modules/employee/core/domain/entities/Employee";
import EmployeeAsset from "@modules/employee/core/domain/entities/EmployeeAsset";
import EmployeeBankAccount from "@modules/employee/core/domain/entities/EmployeeBankAccount";
import EmployeeContact from "@modules/employee/core/domain/entities/EmployeeContact";
import EmployeeContract from "@modules/employee/core/domain/entities/EmployeeContract";
import EmployeeDocument from "@modules/employee/core/domain/entities/EmployeeDocument";
import EmployeeHistory from "@modules/employee/core/domain/entities/EmployeeHistory";
import EmployeeProfile from "@modules/employee/core/domain/entities/EmployeeProfile";
import AccessTokenVerifier, { AuthenticatedActor } from "@shared/adapters/driver/http/ports/AccessTokenVerifier";
import express, { Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

class InMemoryEmployeeRepo implements EmployeeRepo {
    private readonly _store = new Map<string, Employee>();
    async getById(id: string) { return this._store.get(id); }
    async getByCode(code: string) { return [...this._store.values()].find(e => e.code.value === code); }
    async getByAccountId(accountId: string) { return [...this._store.values()].find(e => e.accountId === accountId); }
    async listDirectReportIds(managerId: string) { return [...this._store.values()].filter(e => e.managerId === managerId).map(e => e.id); }
    async list(filter: EmployeeListFilter) {
        return [...this._store.values()].filter(e =>
            (filter.departmentId == undefined || e.departmentId === filter.departmentId) &&
            (filter.status == undefined || e.status.value === filter.status) &&
            (filter.ids == undefined || filter.ids.includes(e.id)));
    }
    async save(e: Employee) { this._store.set(e.id, e); }
    async deleteById(id: string) { this._store.delete(id); }
}

class InMemoryProfileRepo implements EmployeeProfileRepo {
    private readonly _store = new Map<string, EmployeeProfile>();
    async getByEmployeeId(employeeId: string) { return [...this._store.values()].find(p => p.employeeId === employeeId); }
    async save(p: EmployeeProfile) { this._store.set(p.id, p); }
}

class InMemoryContactRepo implements EmployeeContactRepo {
    private readonly _store = new Map<string, EmployeeContact>();
    async getById(id: string) { return this._store.get(id); }
    async listByEmployeeId(employeeId: string) { return [...this._store.values()].filter(c => c.employeeId === employeeId); }
    async save(c: EmployeeContact) { this._store.set(c.id, c); }
    async deleteById(id: string) { this._store.delete(id); }
}

class InMemoryBankAccountRepo implements EmployeeBankAccountRepo {
    private readonly _store = new Map<string, EmployeeBankAccount>();
    async getById(id: string) { return this._store.get(id); }
    async listByEmployeeId(employeeId: string) { return [...this._store.values()].filter(a => a.employeeId === employeeId); }
    async save(a: EmployeeBankAccount) { this._store.set(a.id, a); }
    async deleteById(id: string) { this._store.delete(id); }
}

class InMemoryDocumentRepo implements EmployeeDocumentRepo {
    private readonly _store = new Map<string, EmployeeDocument>();
    async getById(id: string) { return this._store.get(id); }
    async listByEmployeeId(employeeId: string) { return [...this._store.values()].filter(d => d.employeeId === employeeId); }
    async save(d: EmployeeDocument) { this._store.set(d.id, d); }
    async deleteById(id: string) { this._store.delete(id); }
}

class InMemoryContractRepo implements EmployeeContractRepo {
    private readonly _store = new Map<string, EmployeeContract>();
    async getById(id: string) { return this._store.get(id); }
    async listByEmployeeId(employeeId: string) { return [...this._store.values()].filter(c => c.employeeId === employeeId); }
    async save(c: EmployeeContract) { this._store.set(c.id, c); }
    async deleteById(id: string) { this._store.delete(id); }
}

class InMemoryAssetRepo implements EmployeeAssetRepo {
    private readonly _store = new Map<string, EmployeeAsset>();
    async getById(id: string) { return this._store.get(id); }
    async listByEmployeeId(employeeId: string) { return [...this._store.values()].filter(a => a.employeeId === employeeId); }
    async save(a: EmployeeAsset) { this._store.set(a.id, a); }
    async deleteById(id: string) { this._store.delete(id); }
}

class InMemoryHistoryRepo implements EmployeeHistoryRepo {
    private readonly _store: EmployeeHistory[] = [];
    async listByEmployeeId(employeeId: string) { return this._store.filter(h => h.employeeId === employeeId); }
    async save(h: EmployeeHistory) { this._store.push(h); }
}

const allowAllPermissions: PermissionChecker = {
    async assertPermission() { /* allow all in test */ },
    async resolveScope() { return "all"; },
};

const allowAllOrgDirectory: OrgDirectory = {
    async departmentExists() { return true; },
    async positionExists() { return true; },
    async findDepartmentIdByCode() { return "dept-1"; },
    async findPositionIdByCode() { return "pos-1"; },
};

/** Audit khong phai doi tuong kiem thu o day — chi can khong no. */
const noopAuditTrail: AuditTrail = {
    async record() { /* no-op in test */ },
};

/** Thay cho module Auth: tra ve account gia, khong gui mail thuc. */
const fakeAccountProvisioner: AccountProvisioner = {
    async provisionAccount(input) { return { accountId: `acc-${input.email}`, email: input.email }; },
};

function buildUseCases(): EmployeeHttpUseCases {
    const employeeRepo    = new InMemoryEmployeeRepo();
    const profileRepo     = new InMemoryProfileRepo();
    const contactRepo     = new InMemoryContactRepo();
    const bankAccountRepo = new InMemoryBankAccountRepo();
    const documentRepo    = new InMemoryDocumentRepo();
    const contractRepo    = new InMemoryContractRepo();
    const assetRepo       = new InMemoryAssetRepo();
    const historyRepo     = new InMemoryHistoryRepo();

    // Actor trong test la HR (phạm vi `all`) nen scope khong loc gi.
    const accessScope  = new EmployeeAccessScope(allowAllPermissions, employeeRepo);
    const managerChain = new ManagerChain(employeeRepo);
    const importValidator = new EmployeeImportValidator(employeeRepo, allowAllOrgDirectory);
    const createEmployee  = new CreateEmployeeUseCase(allowAllPermissions, employeeRepo, historyRepo, allowAllOrgDirectory);

    return {
        createEmployee,
        updateEmployee:    new UpdateEmployeeUseCase(allowAllPermissions, employeeRepo, historyRepo, allowAllOrgDirectory, managerChain),
        getEmployee:       new GetEmployeeUseCase(accessScope, employeeRepo),
        listEmployees:     new ListEmployeesUseCase(accessScope, employeeRepo),
        terminateEmployee: new TerminateEmployeeUseCase(allowAllPermissions, employeeRepo, historyRepo, noopAuditTrail),
        grantEmployeeLogin: new GrantEmployeeLoginUseCase(allowAllPermissions, employeeRepo, historyRepo, fakeAccountProvisioner, noopAuditTrail),

        getEmployeeProfile:    new GetEmployeeProfileUseCase(accessScope, profileRepo),
        updateEmployeeProfile: new UpdateEmployeeProfileUseCase(allowAllPermissions, employeeRepo, profileRepo),

        createEmployeeContact: new CreateEmployeeContactUseCase(allowAllPermissions, employeeRepo, contactRepo),
        updateEmployeeContact: new UpdateEmployeeContactUseCase(allowAllPermissions, contactRepo),
        deleteEmployeeContact: new DeleteEmployeeContactUseCase(allowAllPermissions, contactRepo),
        listEmployeeContacts:  new ListEmployeeContactsUseCase(accessScope, contactRepo),

        createEmployeeBankAccount: new CreateEmployeeBankAccountUseCase(allowAllPermissions, employeeRepo, bankAccountRepo, noopAuditTrail),
        updateEmployeeBankAccount: new UpdateEmployeeBankAccountUseCase(allowAllPermissions, bankAccountRepo, noopAuditTrail),
        deleteEmployeeBankAccount: new DeleteEmployeeBankAccountUseCase(allowAllPermissions, bankAccountRepo, noopAuditTrail),
        listEmployeeBankAccounts:  new ListEmployeeBankAccountsUseCase(accessScope, bankAccountRepo),

        createEmployeeDocument: new CreateEmployeeDocumentUseCase(allowAllPermissions, employeeRepo, documentRepo, noopAuditTrail),
        updateEmployeeDocument: new UpdateEmployeeDocumentUseCase(allowAllPermissions, documentRepo, noopAuditTrail),
        deleteEmployeeDocument: new DeleteEmployeeDocumentUseCase(allowAllPermissions, documentRepo, noopAuditTrail),
        listEmployeeDocuments:  new ListEmployeeDocumentsUseCase(accessScope, documentRepo),

        createEmployeeContract: new CreateEmployeeContractUseCase(allowAllPermissions, employeeRepo, contractRepo, historyRepo, noopAuditTrail),
        updateEmployeeContract: new UpdateEmployeeContractUseCase(allowAllPermissions, contractRepo, noopAuditTrail),
        deleteEmployeeContract: new DeleteEmployeeContractUseCase(allowAllPermissions, contractRepo, noopAuditTrail),
        listEmployeeContracts:  new ListEmployeeContractsUseCase(accessScope, contractRepo),

        createEmployeeAsset: new CreateEmployeeAssetUseCase(allowAllPermissions, employeeRepo, assetRepo),
        updateEmployeeAsset: new UpdateEmployeeAssetUseCase(allowAllPermissions, assetRepo),
        deleteEmployeeAsset: new DeleteEmployeeAssetUseCase(allowAllPermissions, assetRepo),
        listEmployeeAssets:  new ListEmployeeAssetsUseCase(accessScope, assetRepo),

        listEmployeeHistory: new ListEmployeeHistoryUseCase(accessScope, historyRepo),

        previewEmployeeImport: new PreviewEmployeeImportUseCase(allowAllPermissions, importValidator),
        commitEmployeeImport:  new CommitEmployeeImportUseCase(allowAllPermissions, importValidator, createEmployee, noopAuditTrail),
    };
}

const fakeVerifier: AccessTokenVerifier = {
    async verify(token: string) { return token ? new AuthenticatedActor(token) : undefined; },
};

function buildApp(): Express {
    const app = express();
    app.use("/employee", createEmployeeHttpRouter(buildUseCases(), fakeVerifier));
    return app;
}

describe("Employee HTTP", () => {
    let app: Express;
    beforeEach(() => { app = buildApp(); });

    const auth = { Authorization: "Bearer user-1" };

    it("401 khi thiếu token", async () => {
        await request(app).get("/employee/employees").expect(401);
    });

    it("tạo -> lấy -> thêm hợp đồng -> liệt kê lịch sử", async () => {
        const created = await request(app).post("/employee/employees").set(auth).send({
            code:         "NV001",
            name:         "Nguyen Van A",
            departmentId: "dept-1",
            positionId:   "pos-1",
            hireDate:     "2026-01-01T00:00:00.000Z",
            employeeType: "full_time",
        }).expect(201);
        const employeeId = created.body.employeeId;
        expect(employeeId).toBeTruthy();

        await request(app).get(`/employee/employees/${employeeId}`).set(auth)
            .expect(200).expect(res => expect(res.body.code).toBe("NV001"));

        await request(app).post(`/employee/employees/${employeeId}/contracts`).set(auth).send({
            contractType:     "indefinite",
            employmentStatus: "official",
            contractNumber:   "HD-001",
            startDate:        "2026-01-01T00:00:00.000Z",
            baseSalary:       10000000,
        }).expect(201);

        await request(app).get(`/employee/employees/${employeeId}/history`).set(auth)
            .expect(200).expect(res => {
                const eventTypes = res.body.history.map((h: { eventType: string }) => h.eventType);
                expect(eventTypes).toContain("hired");
                expect(eventTypes).toContain("contract_renew");
            });
    });

    it("409 khi mã nhân viên trùng", async () => {
        const payload = {
            code: "NV001", name: "A", departmentId: "dept-1", positionId: "pos-1",
            hireDate: "2026-01-01T00:00:00.000Z", employeeType: "full_time",
        };
        await request(app).post("/employee/employees").set(auth).send(payload).expect(201);
        await request(app).post("/employee/employees").set(auth).send({ ...payload, name: "B" })
            .expect(409).expect(res => expect(res.body.code).toBe("EMPLOYEE_CODE_CONFLICT"));
    });

    it("nghỉ việc là soft update: employee vẫn get được với status=terminated", async () => {
        const created = await request(app).post("/employee/employees").set(auth).send({
            code: "NV002", name: "C", departmentId: "dept-1", positionId: "pos-1",
            hireDate: "2026-01-01T00:00:00.000Z", employeeType: "full_time",
        }).expect(201);
        const employeeId = created.body.employeeId;

        await request(app).post(`/employee/employees/${employeeId}/terminate`).set(auth)
            .send({ terminationDate: "2026-06-01T00:00:00.000Z" }).expect(200);

        await request(app).get(`/employee/employees/${employeeId}`).set(auth)
            .expect(200).expect(res => expect(res.body.status).toBe("terminated"));
    });
});
