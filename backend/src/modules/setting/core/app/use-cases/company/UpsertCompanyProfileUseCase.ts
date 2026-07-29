import CompanyProfileRepo from "@modules/setting/core/app/ports/CompanyProfileRepo";
import PermissionChecker from "@modules/setting/core/app/ports/PermissionChecker";
import CompanyProfile, {
    DEFAULT_CURRENCY,
    DEFAULT_STANDARD_WORK_DAYS_PER_MONTH,
    DEFAULT_STANDARD_WORK_HOURS_PER_DAY,
    DEFAULT_TIMEZONE,
} from "@modules/setting/core/domain/entities/CompanyProfile";

const PERMISSION_KEY = "setting:manage";

export interface UpsertCompanyProfileInput {
    name:                       string;
    address?:                   string;
    taxCode?:                   string;
    phone?:                     string;
    email?:                     string;
    logoUrl?:                   string;
    timezone?:                  string;
    currency?:                  string;
    standardWorkHoursPerDay?:   number;
    standardWorkDaysPerMonth?:  number;
    actorUserId:                string;
}

/**
 * Tạo mới (nếu chưa có) hoặc cập nhật hồ sơ công ty — upsert theo singleton
 * duy nhất (luôn đúng một `CompanyProfile`). `name` luôn bắt buộc; các field
 * còn lại vắng mặt thì giữ nguyên giá trị hiện có (hoặc nhận giá trị mặc
 * định khi tạo mới lần đầu).
 *
 * @throws {AccessDeniedError}          Actor không có quyền `setting:manage`.
 * @throws {CompanyProfileInvalidError} Giá trị field không hợp lệ.
 */
export default class UpsertCompanyProfileUseCase {
    public constructor(
        private readonly _permissions:        PermissionChecker,
        private readonly _companyProfileRepo: CompanyProfileRepo,
    ) {}

    public async execute(input: UpsertCompanyProfileInput): Promise<void> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const existing = await this._companyProfileRepo.get();

        if (existing == undefined) {
            const profile = CompanyProfile.create({
                name:                      input.name,
                address:                   input.address ?? null,
                taxCode:                   input.taxCode ?? null,
                phone:                     input.phone ?? null,
                email:                     input.email ?? null,
                logoUrl:                   input.logoUrl ?? null,
                timezone:                  input.timezone ?? DEFAULT_TIMEZONE,
                currency:                  input.currency ?? DEFAULT_CURRENCY,
                standardWorkHoursPerDay:   input.standardWorkHoursPerDay ?? DEFAULT_STANDARD_WORK_HOURS_PER_DAY,
                standardWorkDaysPerMonth: input.standardWorkDaysPerMonth ?? DEFAULT_STANDARD_WORK_DAYS_PER_MONTH,
            });
            await this._companyProfileRepo.save(profile);
            return;
        }

        existing.update({
            name: input.name,
            ...(input.address                   !== undefined ? { address:                   input.address }                   : {}),
            ...(input.taxCode                    !== undefined ? { taxCode:                    input.taxCode }                    : {}),
            ...(input.phone                      !== undefined ? { phone:                      input.phone }                      : {}),
            ...(input.email                      !== undefined ? { email:                      input.email }                      : {}),
            ...(input.logoUrl                    !== undefined ? { logoUrl:                    input.logoUrl }                    : {}),
            ...(input.timezone                   != undefined  ? { timezone:                   input.timezone }                   : {}),
            ...(input.currency                   != undefined  ? { currency:                   input.currency }                   : {}),
            ...(input.standardWorkHoursPerDay    != undefined  ? { standardWorkHoursPerDay:    input.standardWorkHoursPerDay }    : {}),
            ...(input.standardWorkDaysPerMonth   != undefined  ? { standardWorkDaysPerMonth:   input.standardWorkDaysPerMonth }   : {}),
        });
        await this._companyProfileRepo.save(existing);
    }
}
