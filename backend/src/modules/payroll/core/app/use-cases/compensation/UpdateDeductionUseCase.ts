import CompensationEntryNotFoundError from "@modules/payroll/core/app/errors/CompensationEntryNotFoundError";
import DeductionRepo from "@modules/payroll/core/app/ports/DeductionRepo";
import PermissionChecker from "@modules/payroll/core/app/ports/PermissionChecker";
import { DeductionType } from "@modules/payroll/core/domain/entities/Deduction";

const PERMISSION_KEY = "payroll:manage";

export interface UpdateDeductionInput {
    deductionId:      string;
    payrollPeriodId?: string | null;
    name?:            string;
    type?:            DeductionType;
    amount?:          number;
    reason?:          string | null;
    effectiveDate?:   Date;
    endDate?:         Date | null;
    actorUserId:      string;
}

export default class UpdateDeductionUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _deductions: DeductionRepo,
    ) {}

    public async execute(input: UpdateDeductionInput): Promise<void> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const deduction = await this._deductions.getById(input.deductionId);
        if (deduction == undefined) throw new CompensationEntryNotFoundError("Deduction");

        deduction.update({
            ...(input.payrollPeriodId !== undefined ? { payrollPeriodId: input.payrollPeriodId } : {}),
            ...(input.name != undefined ? { name: input.name } : {}),
            ...(input.type != undefined ? { type: input.type } : {}),
            ...(input.amount != undefined ? { amount: input.amount } : {}),
            ...(input.reason !== undefined ? { reason: input.reason } : {}),
            ...(input.effectiveDate != undefined ? { effectiveDate: input.effectiveDate } : {}),
            ...(input.endDate !== undefined ? { endDate: input.endDate } : {}),
        });

        await this._deductions.save(deduction);
    }
}
