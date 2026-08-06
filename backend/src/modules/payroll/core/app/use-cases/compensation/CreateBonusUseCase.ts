import BonusRepo from "@modules/payroll/core/app/ports/BonusRepo";
import PermissionChecker from "@modules/payroll/core/app/ports/PermissionChecker";
import Bonus from "@modules/payroll/core/domain/entities/Bonus";
import createUuidV7 from "@shared/core/domain/UuidV7";

const PERMISSION_KEY = "payroll:prepare";

export interface CreateBonusInput {
    employeeId:      string;
    payrollPeriodId: string;
    name:            string;
    amount:          number;
    isTaxable?:      boolean;
    reason?:         string | null;
    actorUserId:     string;
}

export default class CreateBonusUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _bonuses: BonusRepo,
    ) {}

    public async execute(input: CreateBonusInput): Promise<Bonus> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const bonus = Bonus.create({
            id: createUuidV7(),
            employeeId: input.employeeId,
            payrollPeriodId: input.payrollPeriodId,
            name: input.name,
            amount: input.amount,
            isTaxable: input.isTaxable ?? true,
            reason: input.reason ?? null,
        });

        await this._bonuses.save(bonus);
        return bonus;
    }
}
