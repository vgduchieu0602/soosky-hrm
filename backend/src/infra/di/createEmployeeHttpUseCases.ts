import { MongoEmployeeAssetRepo, MongoEmployeeBankAccountRepo, MongoEmployeeContactRepo, MongoEmployeeContractRepo, MongoEmployeeDocumentRepo, MongoEmployeeHistoryRepo, MongoEmployeeProfileRepo, MongoEmployeeRepo } from "@modules/employee/adapters/driven/persistence/mongodb";
import { EmployeeHttpUseCases } from "@modules/employee/adapters/driver/http";
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
import GrantEmployeeLoginUseCase from "@modules/employee/core/app/use-cases/employee/GrantEmployeeLoginUseCase";
import ListEmployeesUseCase from "@modules/employee/core/app/use-cases/employee/ListEmployeesUseCase";
import TerminateEmployeeUseCase from "@modules/employee/core/app/use-cases/employee/TerminateEmployeeUseCase";
import UpdateEmployeeUseCase from "@modules/employee/core/app/use-cases/employee/UpdateEmployeeUseCase";
import ListEmployeeHistoryUseCase from "@modules/employee/core/app/use-cases/history/ListEmployeeHistoryUseCase";
import AccountProvisioner from "@modules/employee/core/app/ports/AccountProvisioner";
import EmployeeAccessScope from "@modules/employee/core/app/services/EmployeeAccessScope";
import EmployeeImportValidator from "@modules/employee/core/app/services/EmployeeImportValidator";
import ManagerChain from "@modules/employee/core/app/services/ManagerChain";
import CommitEmployeeImportUseCase from "@modules/employee/core/app/use-cases/import/CommitEmployeeImportUseCase";
import PreviewEmployeeImportUseCase from "@modules/employee/core/app/use-cases/import/PreviewEmployeeImportUseCase";
import GetEmployeeProfileUseCase from "@modules/employee/core/app/use-cases/profile/GetEmployeeProfileUseCase";
import UpdateEmployeeProfileUseCase from "@modules/employee/core/app/use-cases/profile/UpdateEmployeeProfileUseCase";
import { createDepartmentDirectory } from "@modules/department";
import { createIamAccessControl, createIamAuditTrail } from "@modules/iam";
import { Db as MongoDb } from "mongodb";

/**
 * Lắp ráp use-case của module Employee trên nền MongoDB — điểm nối
 * (composition root) giữa core, driven adapter, cổng tổ chức của Department
 * và cổng quyền hạn của IAM.
 *
 * `createIamAccessControl` khớp hình dạng `PermissionChecker` của Employee
 * (`assertPermission(actorUserId, permissionKey)`) nên dùng thẳng;
 * `createDepartmentDirectory` khớp hình dạng `OrgDirectory`.
 */
export default function createEmployeeHttpUseCases(
    mongoDb: MongoDb,
    accountProvisioner: AccountProvisioner,
): EmployeeHttpUseCases {
    const employeeRepo    = new MongoEmployeeRepo(mongoDb);
    const profileRepo     = new MongoEmployeeProfileRepo(mongoDb);
    const contactRepo     = new MongoEmployeeContactRepo(mongoDb);
    const bankAccountRepo = new MongoEmployeeBankAccountRepo(mongoDb);
    const documentRepo    = new MongoEmployeeDocumentRepo(mongoDb);
    const contractRepo    = new MongoEmployeeContractRepo(mongoDb);
    const assetRepo       = new MongoEmployeeAssetRepo(mongoDb);
    const historyRepo     = new MongoEmployeeHistoryRepo(mongoDb);

    const permissionCheck = createIamAccessControl(mongoDb);
    const orgDirectory    = createDepartmentDirectory(mongoDb);

    // Phân giải phạm vi đọc (all/team/self) — dùng chung cho MỌI use-case đọc
    // của module, kể cả các sub-resource, để không nơi nào lọt kiểm tra.
    const accessScope = new EmployeeAccessScope(permissionCheck, employeeRepo);

    // Nhat ky thao tac dung chung so cua IAM -> tra cuu mot cho cho toan he thong.
    const auditTrail  = createIamAuditTrail(mongoDb);
    const managerChain = new ManagerChain(employeeRepo);

    // Nhap CSV dung LAI CreateEmployeeUseCase -> mot duong tao nhan vien duy nhat,
    // khong co nhanh rieng cho import de lech quy tac.
    const importValidator = new EmployeeImportValidator(employeeRepo, orgDirectory);
    const createEmployee  = new CreateEmployeeUseCase(permissionCheck, employeeRepo, historyRepo, orgDirectory);

    return {
        // Employee
        createEmployee,
        updateEmployee:    new UpdateEmployeeUseCase(permissionCheck, employeeRepo, historyRepo, orgDirectory, managerChain),
        getEmployee:       new GetEmployeeUseCase(accessScope, employeeRepo),
        listEmployees:     new ListEmployeesUseCase(accessScope, employeeRepo),
        terminateEmployee: new TerminateEmployeeUseCase(permissionCheck, employeeRepo, historyRepo, auditTrail),
        grantEmployeeLogin: new GrantEmployeeLoginUseCase(permissionCheck, employeeRepo, historyRepo, accountProvisioner, auditTrail),

        // Profile
        getEmployeeProfile:    new GetEmployeeProfileUseCase(accessScope, profileRepo),
        updateEmployeeProfile: new UpdateEmployeeProfileUseCase(permissionCheck, employeeRepo, profileRepo),

        // Contact
        createEmployeeContact: new CreateEmployeeContactUseCase(permissionCheck, employeeRepo, contactRepo),
        updateEmployeeContact: new UpdateEmployeeContactUseCase(permissionCheck, contactRepo),
        deleteEmployeeContact: new DeleteEmployeeContactUseCase(permissionCheck, contactRepo),
        listEmployeeContacts:  new ListEmployeeContactsUseCase(accessScope, contactRepo),

        // Bank account
        createEmployeeBankAccount: new CreateEmployeeBankAccountUseCase(permissionCheck, employeeRepo, bankAccountRepo, auditTrail),
        updateEmployeeBankAccount: new UpdateEmployeeBankAccountUseCase(permissionCheck, bankAccountRepo, auditTrail),
        deleteEmployeeBankAccount: new DeleteEmployeeBankAccountUseCase(permissionCheck, bankAccountRepo, auditTrail),
        listEmployeeBankAccounts:  new ListEmployeeBankAccountsUseCase(accessScope, bankAccountRepo),

        // Document
        createEmployeeDocument: new CreateEmployeeDocumentUseCase(permissionCheck, employeeRepo, documentRepo, auditTrail),
        updateEmployeeDocument: new UpdateEmployeeDocumentUseCase(permissionCheck, documentRepo, auditTrail),
        deleteEmployeeDocument: new DeleteEmployeeDocumentUseCase(permissionCheck, documentRepo, auditTrail),
        listEmployeeDocuments:  new ListEmployeeDocumentsUseCase(accessScope, documentRepo),

        // Contract
        createEmployeeContract: new CreateEmployeeContractUseCase(permissionCheck, employeeRepo, contractRepo, historyRepo, auditTrail),
        updateEmployeeContract: new UpdateEmployeeContractUseCase(permissionCheck, contractRepo, auditTrail),
        deleteEmployeeContract: new DeleteEmployeeContractUseCase(permissionCheck, contractRepo, auditTrail),
        listEmployeeContracts:  new ListEmployeeContractsUseCase(accessScope, contractRepo),

        // Asset
        createEmployeeAsset: new CreateEmployeeAssetUseCase(permissionCheck, employeeRepo, assetRepo),
        updateEmployeeAsset: new UpdateEmployeeAssetUseCase(permissionCheck, assetRepo),
        deleteEmployeeAsset: new DeleteEmployeeAssetUseCase(permissionCheck, assetRepo),
        listEmployeeAssets:  new ListEmployeeAssetsUseCase(accessScope, assetRepo),

        // History
        listEmployeeHistory: new ListEmployeeHistoryUseCase(accessScope, historyRepo),

        // Import CSV
        previewEmployeeImport: new PreviewEmployeeImportUseCase(permissionCheck, importValidator),
        commitEmployeeImport:  new CommitEmployeeImportUseCase(permissionCheck, importValidator, createEmployee, auditTrail),
    };
}
