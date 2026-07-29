import CompensationEntryNotFoundError from "@modules/payroll/core/app/errors/CompensationEntryNotFoundError";
import BonusRepo from "@modules/payroll/core/app/ports/BonusRepo";
import PermissionChecker from "@modules/payroll/core/app/ports/PermissionChecker";

const PERMISSION_KEY = "payroll:manage";

export interface UpdateBonusInput {
    bonusId:     string;
    name?:       string;
    amount?:     number;
    isTaxable?:  boolean;
    reason?:     string | null;
    actorUserId: string;
}

export default class UpdateBonusUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _bonuses: BonusRepo,
    ) {}

    public async execute(input: UpdateBonusInput): Promise<void> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const bonus = await this._bonuses.getById(input.bonusId);
        if (bonus == undefined) throw new CompensationEntryNotFoundError("Bonus");

        bonus.update({
            ...(input.name != undefined ? { name: input.name } : {}),
            ...(input.amount != undefined ? { amount: input.amount } : {}),
            ...(input.isTaxable != undefined ? { isTaxable: input.isTaxable } : {}),
            ...(input.reason !== undefined ? { reason: input.reason } : {}),
        });

        await this._bonuses.save(bonus);
    }
}
