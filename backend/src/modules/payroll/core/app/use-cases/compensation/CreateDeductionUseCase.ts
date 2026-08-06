import DeductionRepo from "@modules/payroll/core/app/ports/DeductionRepo";
import PermissionChecker from "@modules/payroll/core/app/ports/PermissionChecker";
import Deduction, { DeductionType } from "@modules/payroll/core/domain/entities/Deduction";
import createUuidV7 from "@shared/core/domain/UuidV7";

const PERMISSION_KEY = "payroll:prepare";

export interface CreateDeductionInput {
    employeeId:       string;
    /** Bỏ trống = khấu trừ lặp lại mỗi kỳ trong thời gian hiệu lực. */
    payrollPeriodId?: string | null;
    name:             string;
    type:             DeductionType;
    amount:           number;
    reason?:          string | null;
    effectiveDate:    Date;
    endDate?:         Date | null;
    actorUserId:      string;
}

export default class CreateDeductionUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _deductions: DeductionRepo,
    ) {}

    public async execute(input: CreateDeductionInput): Promise<Deduction> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const deduction = Deduction.create({
            id: createUuidV7(),
            employeeId: input.employeeId,
            payrollPeriodId: input.payrollPeriodId ?? null,
            name: input.name,
            type: input.type,
            amount: input.amount,
            reason: input.reason ?? null,
            effectiveDate: input.effectiveDate,
            endDate: input.endDate ?? null,
        });

        await this._deductions.save(deduction);
        return deduction;
    }
}
