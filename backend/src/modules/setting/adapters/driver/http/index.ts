import BankTransferProfileController, { BankTransferProfileControllerUseCases } from "@modules/setting/adapters/driver/http/controllers/BankTransferProfileController";
import CompanyProfileController, { CompanyProfileControllerUseCases } from "@modules/setting/adapters/driver/http/controllers/CompanyProfileController";
import SystemSettingController, { SystemSettingControllerUseCases } from "@modules/setting/adapters/driver/http/controllers/SystemSettingController";
import authenticate from "@shared/adapters/driver/http/middlewares/authenticate";
import errorHandler from "@shared/adapters/driver/http/middlewares/errorHandler";
import AccessTokenVerifier from "@shared/adapters/driver/http/ports/AccessTokenVerifier";
import { json, Router } from "express";

/**
 * Toàn bộ use-case mà driver adapter HTTP của module Setting cần.
 */
export type SettingHttpUseCases =
    & CompanyProfileControllerUseCases
    & SystemSettingControllerUseCases
    & BankTransferProfileControllerUseCases;

/**
 * Driver adapter HTTP của module Setting. Giữ danh sách route duy nhất —
 * nhìn một chỗ thấy toàn bộ bề mặt API: parse JSON body, xác thực Bearer
 * token, định tuyến tới controller, dịch lỗi thành `{ code, message }`.
 */
export function createSettingHttpRouter(
    useCases: SettingHttpUseCases,
    accessTokenVerifier: AccessTokenVerifier,
): Router {
    const companyProfileController = new CompanyProfileController(useCases);
    const systemSettingController  = new SystemSettingController(useCases);
    const bankProfileController    = new BankTransferProfileController(useCases);

    const router = Router();

    router.use(json());
    router.use(authenticate(accessTokenVerifier));

    // CompanyProfile
    router.get("/company", companyProfileController.getCompanyProfile);
    router.put("/company", companyProfileController.upsertCompanyProfile);

    // SystemSetting
    router.get  ("/system", systemSettingController.getSystemSettings);
    router.patch("/system", systemSettingController.updateSystemSettings);

    // BankTransferProfile (mẫu file chuyển lương theo ngân hàng)
    router.get   ("/bank-profiles",                       bankProfileController.listBankTransferProfiles);
    router.post  ("/bank-profiles",                       bankProfileController.createBankTransferProfile);
    router.patch ("/bank-profiles/:profileId",            bankProfileController.updateBankTransferProfile);
    router.post  ("/bank-profiles/:profileId/activate",   bankProfileController.activateBankTransferProfile);
    router.delete("/bank-profiles/:profileId",            bankProfileController.deleteBankTransferProfile);

    router.use(errorHandler);

    return router;
}
