import PermissionChecker from "@modules/payroll/core/app/ports/PermissionChecker";
import TaxProfileRepo from "@modules/payroll/core/app/ports/TaxProfileRepo";
import TaxProfile from "@modules/payroll/core/domain/entities/TaxProfile";
import { v7 as UUIDv7 } from "uuid";

const PERMISSION_KEY = "payroll:manage";

export interface UpsertTaxProfileInput {
    employeeId:       string;
    isResident?:      boolean;
    dependentsCount?: number;
    insuranceAmount?: number;
    effectiveDate:    Date;
    endDate?:         Date | null;
    actorUserId:      string;
}

/** Thêm một phiên bản hồ sơ thuế mới (versioned theo `effectiveDate`) — không sửa bản cũ. */
export default class UpsertTaxProfileUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _taxProfiles: TaxProfileRepo,
    ) {}

    public async execute(input: UpsertTaxProfileInput): Promise<TaxProfile> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const taxProfile = TaxProfile.create({
            id: UUIDv7(),
            employeeId: input.employeeId,
            isResident: input.isResident ?? true,
            dependentsCount: input.dependentsCount ?? 0,
            insuranceAmount: input.insuranceAmount ?? 0,
            effectiveDate: input.effectiveDate,
            endDate: input.endDate ?? null,
        });

        await this._taxProfiles.save(taxProfile);
        return taxProfile;
    }
}
