import CompensationEntryNotFoundError from "@modules/payroll/core/app/errors/CompensationEntryNotFoundError";
import DeductionRepo from "@modules/payroll/core/app/ports/DeductionRepo";
import PermissionChecker from "@modules/payroll/core/app/ports/PermissionChecker";

const PERMISSION_KEY = "payroll:manage";

export default class DeleteDeductionUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _deductions: DeductionRepo,
    ) {}

    public async execute(input: { deductionId: string; actorUserId: string }): Promise<void> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const deduction = await this._deductions.getById(input.deductionId);
        if (deduction == undefined) throw new CompensationEntryNotFoundError("Deduction");

        await this._deductions.deleteById(input.deductionId);
    }
}
