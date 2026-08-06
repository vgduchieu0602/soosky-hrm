import PayrollPeriodNameConflictError from "@modules/payroll/core/app/errors/PayrollPeriodNameConflictError";
import PayrollPeriodRepo from "@modules/payroll/core/app/ports/PayrollPeriodRepo";
import PermissionChecker from "@modules/payroll/core/app/ports/PermissionChecker";
import PayrollPeriod from "@modules/payroll/core/domain/entities/PayrollPeriod";
import PeriodName from "@modules/payroll/core/domain/value-objects/PeriodName";
import createUuidV7 from "@shared/core/domain/UuidV7";

const PERMISSION_KEY = "payroll:prepare";

export interface CreatePayrollPeriodInput {
    name:             string;
    startDate:        Date;
    endDate:          Date;
    payDate:          Date;
    standardWorkDays: number;
    actorUserId:      string;
}

export interface CreatePayrollPeriodOutput {
    periodId: string;
}

/**
 * Tạo mới một kỳ lương — dùng chung cho chấm công, đánh giá và bảng lương.
 *
 * @throws {AccessDeniedError}              Actor không có quyền `payroll:prepare`.
 * @throws {PayrollPeriodNameConflictError}  Tên kỳ đã tồn tại.
 * @throws {PayrollPeriodNameInvalidError}   Tên không hợp lệ.
 */
export default class CreatePayrollPeriodUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _periods: PayrollPeriodRepo,
    ) {}

    public async execute(input: CreatePayrollPeriodInput): Promise<CreatePayrollPeriodOutput> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const name = PeriodName.create(input.name);
        const duplicate = await this._periods.getByName(name.value);
        if (duplicate != undefined) throw new PayrollPeriodNameConflictError(name.value);

        const period = PayrollPeriod.create({
            id:               createUuidV7(),
            name,
            startDate:        input.startDate,
            endDate:          input.endDate,
            payDate:          input.payDate,
            standardWorkDays: input.standardWorkDays,
            createdBy:        input.actorUserId,
        });

        await this._periods.save(period);

        return { periodId: period.id };
    }
}
