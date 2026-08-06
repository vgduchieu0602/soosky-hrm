import CompensationEntryNotFoundError from "@modules/payroll/core/app/errors/CompensationEntryNotFoundError";
import BonusRepo from "@modules/payroll/core/app/ports/BonusRepo";
import PermissionChecker from "@modules/payroll/core/app/ports/PermissionChecker";

const PERMISSION_KEY = "payroll:prepare";

export default class DeleteBonusUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _bonuses: BonusRepo,
    ) {}

    public async execute(input: { bonusId: string; actorUserId: string }): Promise<void> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const bonus = await this._bonuses.getById(input.bonusId);
        if (bonus == undefined) throw new CompensationEntryNotFoundError("Bonus");

        await this._bonuses.deleteById(input.bonusId);
    }
}
