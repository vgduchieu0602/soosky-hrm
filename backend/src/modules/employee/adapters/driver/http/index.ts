import EmployeeAssetController, { EmployeeAssetControllerUseCases } from "@modules/employee/adapters/driver/http/controllers/EmployeeAssetController";
import EmployeeBankAccountController, { EmployeeBankAccountControllerUseCases } from "@modules/employee/adapters/driver/http/controllers/EmployeeBankAccountController";
import EmployeeContactController, { EmployeeContactControllerUseCases } from "@modules/employee/adapters/driver/http/controllers/EmployeeContactController";
import EmployeeContractController, { EmployeeContractControllerUseCases } from "@modules/employee/adapters/driver/http/controllers/EmployeeContractController";
import EmployeeController, { EmployeeControllerUseCases } from "@modules/employee/adapters/driver/http/controllers/EmployeeController";
import EmployeeDocumentController, { EmployeeDocumentControllerUseCases } from "@modules/employee/adapters/driver/http/controllers/EmployeeDocumentController";
import EmployeeHistoryController, { EmployeeHistoryControllerUseCases } from "@modules/employee/adapters/driver/http/controllers/EmployeeHistoryController";
import EmployeeProfileController, { EmployeeProfileControllerUseCases } from "@modules/employee/adapters/driver/http/controllers/EmployeeProfileController";
import authenticate from "@shared/adapters/driver/http/middlewares/authenticate";
import errorHandler from "@shared/adapters/driver/http/middlewares/errorHandler";
import AccessTokenVerifier from "@shared/adapters/driver/http/ports/AccessTokenVerifier";
import { json, Router } from "express";

/** Toàn bộ use-case mà driver adapter HTTP của module Employee cần. */
export type EmployeeHttpUseCases =
    & EmployeeControllerUseCases
    & EmployeeProfileControllerUseCases
    & EmployeeContactControllerUseCases
    & EmployeeBankAccountControllerUseCases
    & EmployeeDocumentControllerUseCases
    & EmployeeContractControllerUseCases
    & EmployeeAssetControllerUseCases
    & EmployeeHistoryControllerUseCases;

/**
 * Driver adapter HTTP của module Employee. Giữ danh sách route duy nhất —
 * nhìn một chỗ thấy toàn bộ bề mặt API: parse JSON body, xác thực Bearer
 * token, định tuyến tới controller, dịch lỗi thành `{ code, message }`.
 */
export function createEmployeeHttpRouter(
    useCases: EmployeeHttpUseCases,
    accessTokenVerifier: AccessTokenVerifier,
): Router {
    const employeeController    = new EmployeeController(useCases);
    const profileController     = new EmployeeProfileController(useCases);
    const contactController     = new EmployeeContactController(useCases);
    const bankAccountController = new EmployeeBankAccountController(useCases);
    const documentController    = new EmployeeDocumentController(useCases);
    const contractController    = new EmployeeContractController(useCases);
    const assetController       = new EmployeeAssetController(useCases);
    const historyController     = new EmployeeHistoryController(useCases);

    const router = Router();

    router.use(json());
    router.use(authenticate(accessTokenVerifier));

    // Employee
    router.post  ("/employees",                       employeeController.createEmployee);
    router.get   ("/employees",                       employeeController.listEmployees);
    router.get   ("/employees/:employeeId",           employeeController.getEmployee);
    router.patch ("/employees/:employeeId",           employeeController.updateEmployee);
    router.post  ("/employees/:employeeId/terminate", employeeController.terminateEmployee);

    // Profile (1-1)
    router.get   ("/employees/:employeeId/profile", profileController.getEmployeeProfile);
    router.put   ("/employees/:employeeId/profile", profileController.updateEmployeeProfile);

    // Contact
    router.post  ("/employees/:employeeId/contacts", contactController.createEmployeeContact);
    router.get   ("/employees/:employeeId/contacts", contactController.listEmployeeContacts);
    router.patch ("/contacts/:contactId",            contactController.updateEmployeeContact);
    router.delete("/contacts/:contactId",            contactController.deleteEmployeeContact);

    // Bank account
    router.post  ("/employees/:employeeId/bank-accounts", bankAccountController.createEmployeeBankAccount);
    router.get   ("/employees/:employeeId/bank-accounts", bankAccountController.listEmployeeBankAccounts);
    router.patch ("/bank-accounts/:bankAccountId",        bankAccountController.updateEmployeeBankAccount);
    router.delete("/bank-accounts/:bankAccountId",        bankAccountController.deleteEmployeeBankAccount);

    // Document
    router.post  ("/employees/:employeeId/documents", documentController.createEmployeeDocument);
    router.get   ("/employees/:employeeId/documents", documentController.listEmployeeDocuments);
    router.patch ("/documents/:documentId",           documentController.updateEmployeeDocument);
    router.delete("/documents/:documentId",           documentController.deleteEmployeeDocument);

    // Contract
    router.post  ("/employees/:employeeId/contracts", contractController.createEmployeeContract);
    router.get   ("/employees/:employeeId/contracts", contractController.listEmployeeContracts);
    router.patch ("/contracts/:contractId",           contractController.updateEmployeeContract);
    router.delete("/contracts/:contractId",           contractController.deleteEmployeeContract);

    // Asset
    router.post  ("/employees/:employeeId/assets", assetController.createEmployeeAsset);
    router.get   ("/employees/:employeeId/assets", assetController.listEmployeeAssets);
    router.patch ("/assets/:assetId",              assetController.updateEmployeeAsset);
    router.delete("/assets/:assetId",              assetController.deleteEmployeeAsset);

    // History (append-only)
    router.get   ("/employees/:employeeId/history", historyController.listEmployeeHistory);

    router.use(errorHandler);

    return router;
}
