import CompensationEntryNotFoundError from "@modules/payroll/core/app/errors/CompensationEntryNotFoundError";
import AllowanceRepo from "@modules/payroll/core/app/ports/AllowanceRepo";
import PermissionChecker from "@modules/payroll/core/app/ports/PermissionChecker";
import { AllowanceType } from "@modules/payroll/core/domain/entities/Allowance";

const PERMISSION_KEY = "payroll:prepare";

export interface UpdateAllowanceInput {
    allowanceId:      string;
    name?:            string;
    type?:            AllowanceType;
    amount?:          number;
    isTaxable?:       boolean;
    isInsuranceBase?: boolean;
    effectiveDate?:   Date;
    endDate?:         Date | null;
    actorUserId:      string;
}

export default class UpdateAllowanceUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _allowances: AllowanceRepo,
    ) {}

    public async execute(input: UpdateAllowanceInput): Promise<void> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const allowance = await this._allowances.getById(input.allowanceId);
        if (allowance == undefined) throw new CompensationEntryNotFoundError("Allowance");

        allowance.update({
            ...(input.name != undefined ? { name: input.name } : {}),
            ...(input.type != undefined ? { type: input.type } : {}),
            ...(input.amount != undefined ? { amount: input.amount } : {}),
            ...(input.isTaxable != undefined ? { isTaxable: input.isTaxable } : {}),
            ...(input.isInsuranceBase != undefined ? { isInsuranceBase: input.isInsuranceBase } : {}),
            ...(input.effectiveDate != undefined ? { effectiveDate: input.effectiveDate } : {}),
            ...(input.endDate !== undefined ? { endDate: input.endDate } : {}),
        });

        await this._allowances.save(allowance);
    }
}
