import CompanyProfileNotFoundError from "@modules/setting/core/app/errors/CompanyProfileNotFoundError";
import CompanyProfileRepo from "@modules/setting/core/app/ports/CompanyProfileRepo";
import CompanyProfile from "@modules/setting/core/domain/entities/CompanyProfile";

/**
 * Lấy hồ sơ công ty (singleton). Mở cho mọi user đã xác thực.
 *
 * @throws {CompanyProfileNotFoundError} Chưa từng thiết lập hồ sơ công ty.
 */
export default class GetCompanyProfileUseCase {
    public constructor(
        private readonly _companyProfileRepo: CompanyProfileRepo,
    ) {}

    public async execute(): Promise<CompanyProfile> {
        const profile = await this._companyProfileRepo.get();
        if (profile == undefined) throw new CompanyProfileNotFoundError();
        return profile;
    }
}
