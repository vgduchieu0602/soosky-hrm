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
import ListEmployeesUseCase from "@modules/employee/core/app/use-cases/employee/ListEmployeesUseCase";
import TerminateEmployeeUseCase from "@modules/employee/core/app/use-cases/employee/TerminateEmployeeUseCase";
import UpdateEmployeeUseCase from "@modules/employee/core/app/use-cases/employee/UpdateEmployeeUseCase";
import ListEmployeeHistoryUseCase from "@modules/employee/core/app/use-cases/history/ListEmployeeHistoryUseCase";
import GetEmployeeProfileUseCase from "@modules/employee/core/app/use-cases/profile/GetEmployeeProfileUseCase";
import UpdateEmployeeProfileUseCase from "@modules/employee/core/app/use-cases/profile/UpdateEmployeeProfileUseCase";
import { createDepartmentDirectory } from "@modules/department";
import { createIamAccessControl } from "@modules/iam";
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
export default function createEmployeeHttpUseCases(mongoDb: MongoDb): EmployeeHttpUseCases {
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

    return {
        // Employee
        createEmployee:    new CreateEmployeeUseCase(permissionCheck, employeeRepo, historyRepo, orgDirectory),
        updateEmployee:    new UpdateEmployeeUseCase(permissionCheck, employeeRepo, historyRepo, orgDirectory),
        getEmployee:       new GetEmployeeUseCase(employeeRepo),
        listEmployees:     new ListEmployeesUseCase(employeeRepo),
        terminateEmployee: new TerminateEmployeeUseCase(permissionCheck, employeeRepo, historyRepo),

        // Profile
        getEmployeeProfile:    new GetEmployeeProfileUseCase(profileRepo),
        updateEmployeeProfile: new UpdateEmployeeProfileUseCase(permissionCheck, employeeRepo, profileRepo),

        // Contact
        createEmployeeContact: new CreateEmployeeContactUseCase(permissionCheck, employeeRepo, contactRepo),
        updateEmployeeContact: new UpdateEmployeeContactUseCase(permissionCheck, contactRepo),
        deleteEmployeeContact: new DeleteEmployeeContactUseCase(permissionCheck, contactRepo),
        listEmployeeContacts:  new ListEmployeeContactsUseCase(contactRepo),

        // Bank account
        createEmployeeBankAccount: new CreateEmployeeBankAccountUseCase(permissionCheck, employeeRepo, bankAccountRepo),
        updateEmployeeBankAccount: new UpdateEmployeeBankAccountUseCase(permissionCheck, bankAccountRepo),
        deleteEmployeeBankAccount: new DeleteEmployeeBankAccountUseCase(permissionCheck, bankAccountRepo),
        listEmployeeBankAccounts:  new ListEmployeeBankAccountsUseCase(bankAccountRepo),

        // Document
        createEmployeeDocument: new CreateEmployeeDocumentUseCase(permissionCheck, employeeRepo, documentRepo),
        updateEmployeeDocument: new UpdateEmployeeDocumentUseCase(permissionCheck, documentRepo),
        deleteEmployeeDocument: new DeleteEmployeeDocumentUseCase(permissionCheck, documentRepo),
        listEmployeeDocuments:  new ListEmployeeDocumentsUseCase(documentRepo),

        // Contract
        createEmployeeContract: new CreateEmployeeContractUseCase(permissionCheck, employeeRepo, contractRepo, historyRepo),
        updateEmployeeContract: new UpdateEmployeeContractUseCase(permissionCheck, contractRepo),
        deleteEmployeeContract: new DeleteEmployeeContractUseCase(permissionCheck, contractRepo),
        listEmployeeContracts:  new ListEmployeeContractsUseCase(contractRepo),

        // Asset
        createEmployeeAsset: new CreateEmployeeAssetUseCase(permissionCheck, employeeRepo, assetRepo),
        updateEmployeeAsset: new UpdateEmployeeAssetUseCase(permissionCheck, assetRepo),
        deleteEmployeeAsset: new DeleteEmployeeAssetUseCase(permissionCheck, assetRepo),
        listEmployeeAssets:  new ListEmployeeAssetsUseCase(assetRepo),

        // History
        listEmployeeHistory: new ListEmployeeHistoryUseCase(historyRepo),
    };
}
