import CompensationEntryNotFoundError from "@modules/payroll/core/app/errors/CompensationEntryNotFoundError";
import AllowanceRepo from "@modules/payroll/core/app/ports/AllowanceRepo";
import PermissionChecker from "@modules/payroll/core/app/ports/PermissionChecker";

const PERMISSION_KEY = "payroll:manage";

export default class DeleteAllowanceUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _allowances: AllowanceRepo,
    ) {}

    public async execute(input: { allowanceId: string; actorUserId: string }): Promise<void> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const allowance = await this._allowances.getById(input.allowanceId);
        if (allowance == undefined) throw new CompensationEntryNotFoundError("Allowance");

        await this._allowances.deleteById(input.allowanceId);
    }
}
