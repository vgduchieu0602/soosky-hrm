import AllowanceRepo from "@modules/payroll/core/app/ports/AllowanceRepo";
import PermissionChecker from "@modules/payroll/core/app/ports/PermissionChecker";
import Allowance, { AllowanceType } from "@modules/payroll/core/domain/entities/Allowance";
import createUuidV7 from "@shared/core/domain/UuidV7";

const PERMISSION_KEY = "payroll:prepare";

export interface CreateAllowanceInput {
    employeeId:      string;
    name:            string;
    type:            AllowanceType;
    amount:          number;
    isTaxable?:      boolean;
    isInsuranceBase?: boolean;
    effectiveDate:   Date;
    endDate?:        Date | null;
    actorUserId:     string;
}

/**
 * Tạo phụ cấp định kỳ cho nhân viên.
 *
 * @throws {AccessDeniedError}                 Actor không có quyền `payroll:prepare`.
 * @throws {CompensationCatalogInvalidError}    Tên/số tiền không hợp lệ.
 */
export default class CreateAllowanceUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _allowances: AllowanceRepo,
    ) {}

    public async execute(input: CreateAllowanceInput): Promise<Allowance> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const allowance = Allowance.create({
            id: createUuidV7(),
            employeeId: input.employeeId,
            name: input.name,
            type: input.type,
            amount: input.amount,
            isTaxable: input.isTaxable ?? true,
            isInsuranceBase: input.isInsuranceBase ?? false,
            effectiveDate: input.effectiveDate,
            endDate: input.endDate ?? null,
        });

        await this._allowances.save(allowance);
        return allowance;
    }
}
