import PayrollPeriodLockedError from "@modules/payroll/core/app/errors/PayrollPeriodLockedError";
import PayrollPeriodNotFoundError from "@modules/payroll/core/app/errors/PayrollPeriodNotFoundError";
import PayrollPeriodRepo from "@modules/payroll/core/app/ports/PayrollPeriodRepo";
import PermissionChecker from "@modules/payroll/core/app/ports/PermissionChecker";

const PERMISSION_KEY = "payroll:manage";

export interface UpdatePayrollPeriodInput {
    periodId:          string;
    endDate?:          Date;
    payDate?:          Date;
    standardWorkDays?: number;
    actorUserId:       string;
}

/**
 * Cập nhật một kỳ lương đang mở (chưa `closed`/`paid`).
 *
 * @throws {AccessDeniedError}          Actor không có quyền `payroll:manage`.
 * @throws {PayrollPeriodNotFoundError} Không tìm thấy kỳ lương.
 * @throws {PayrollPeriodLockedError}   Kỳ đã `closed`/`paid`.
 */
export default class UpdatePayrollPeriodUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _periods: PayrollPeriodRepo,
    ) {}

    public async execute(input: UpdatePayrollPeriodInput): Promise<void> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const period = await this._periods.getById(input.periodId);
        if (period == undefined) throw new PayrollPeriodNotFoundError();
        if (period.status === "closed" || period.status === "paid") {
            throw new PayrollPeriodLockedError(`Period ${period.name.value} is ${period.status}, cannot edit`);
        }

        period.update({
            ...(input.endDate != undefined ? { endDate: input.endDate } : {}),
            ...(input.payDate != undefined ? { payDate: input.payDate } : {}),
            ...(input.standardWorkDays != undefined ? { standardWorkDays: input.standardWorkDays } : {}),
        });

        await this._periods.save(period);
    }
}
