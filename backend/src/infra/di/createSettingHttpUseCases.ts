import { MongoBankTransferProfileRepo, MongoCompanyProfileRepo, MongoSystemSettingRepo } from "@modules/setting/adapters/driven/persistence/mongodb";
import { SettingHttpUseCases } from "@modules/setting/adapters/driver/http";
import ActivateBankTransferProfileUseCase from "@modules/setting/core/app/use-cases/bank/ActivateBankTransferProfileUseCase";
import CreateBankTransferProfileUseCase from "@modules/setting/core/app/use-cases/bank/CreateBankTransferProfileUseCase";
import DeleteBankTransferProfileUseCase from "@modules/setting/core/app/use-cases/bank/DeleteBankTransferProfileUseCase";
import ListBankTransferProfilesUseCase from "@modules/setting/core/app/use-cases/bank/ListBankTransferProfilesUseCase";
import UpdateBankTransferProfileUseCase from "@modules/setting/core/app/use-cases/bank/UpdateBankTransferProfileUseCase";
import GetCompanyProfileUseCase from "@modules/setting/core/app/use-cases/company/GetCompanyProfileUseCase";
import UpsertCompanyProfileUseCase from "@modules/setting/core/app/use-cases/company/UpsertCompanyProfileUseCase";
import GetSystemSettingsUseCase from "@modules/setting/core/app/use-cases/system/GetSystemSettingsUseCase";
import UpdateSystemSettingsUseCase from "@modules/setting/core/app/use-cases/system/UpdateSystemSettingsUseCase";
import { createIamAccessControl } from "@modules/iam";
import { Db as MongoDb } from "mongodb";

/**
 * Lắp ráp use-case của module Setting trên nền MongoDB — điểm nối
 * (composition root) giữa core, driven adapter và cổng quyền hạn của IAM.
 *
 * `createIamAccessControl` khớp hình dạng `PermissionChecker` của Setting
 * (`assertPermission(actorUserId, permissionKey)`) nên dùng thẳng, không cần
 * lớp adapter trung gian.
 */
export default function createSettingHttpUseCases(mongoDb: MongoDb): SettingHttpUseCases {
    const companyProfileRepo = new MongoCompanyProfileRepo(mongoDb);
    const systemSettingRepo  = new MongoSystemSettingRepo(mongoDb);
    const bankProfileRepo    = new MongoBankTransferProfileRepo(mongoDb);
    const permissionCheck    = createIamAccessControl(mongoDb);

    return {
        // CompanyProfile
        getCompanyProfile:    new GetCompanyProfileUseCase(companyProfileRepo),
        upsertCompanyProfile: new UpsertCompanyProfileUseCase(permissionCheck, companyProfileRepo),

        // SystemSetting
        getSystemSettings:    new GetSystemSettingsUseCase(systemSettingRepo),
        updateSystemSettings: new UpdateSystemSettingsUseCase(permissionCheck, systemSettingRepo),

        // BankTransferProfile
        createBankTransferProfile:   new CreateBankTransferProfileUseCase(permissionCheck, bankProfileRepo),
        listBankTransferProfiles:    new ListBankTransferProfilesUseCase(bankProfileRepo),
        updateBankTransferProfile:   new UpdateBankTransferProfileUseCase(permissionCheck, bankProfileRepo),
        activateBankTransferProfile: new ActivateBankTransferProfileUseCase(permissionCheck, bankProfileRepo),
        deleteBankTransferProfile:   new DeleteBankTransferProfileUseCase(permissionCheck, bankProfileRepo),
    };
}
