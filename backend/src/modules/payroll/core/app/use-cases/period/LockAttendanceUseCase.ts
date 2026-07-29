import PayrollPeriodLockedError from "@modules/payroll/core/app/errors/PayrollPeriodLockedError";
import PayrollPeriodNotFoundError from "@modules/payroll/core/app/errors/PayrollPeriodNotFoundError";
import PayrollPeriodRepo from "@modules/payroll/core/app/ports/PayrollPeriodRepo";
import PayrollRunPort from "@modules/payroll/core/app/ports/PayrollRunPort";
import PermissionChecker from "@modules/payroll/core/app/ports/PermissionChecker";
import PayrollPeriod from "@modules/payroll/core/domain/entities/PayrollPeriod";
import { PayrollAttendanceLockedEvent } from "@modules/payroll/core/domain/events/PayrollAttendanceLockedEvent";
import EventBus from "@shared/core/domain/EventBus";

const PERMISSION_KEY = "payroll:manage";

export interface LockAttendanceOutput {
    period:      PayrollPeriod;
    autoRunning: boolean;
}

/**
 * Chốt chấm công của kỳ — dữ liệu chấm công không đổi được nữa trước khi
 * tính lương. Phát `payroll.attendance-locked`. Nếu đánh giá cũng đã chốt,
 * TỰ ĐỘNG chạy lương cả kỳ ngay (đồng bộ, trong cùng request — bản cũ chạy
 * nền qua `setImmediate`; giản lược ở đây để hành vi tất định trong test, xem
 * payroll-report.md).
 *
 * @throws {AccessDeniedError}          Actor không có quyền `payroll:manage`.
 * @throws {PayrollPeriodNotFoundError} Không tìm thấy kỳ lương.
 * @throws {PayrollPeriodLockedError}   Kỳ đã thanh toán.
 */
export default class LockAttendanceUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _periods: PayrollPeriodRepo,
        private readonly _eventBus: EventBus,
        private readonly _runner: PayrollRunPort,
    ) {}

    public async execute(input: { periodId: string; actorUserId: string }): Promise<LockAttendanceOutput> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const period = await this._periods.getById(input.periodId);
        if (period == undefined) throw new PayrollPeriodNotFoundError();
        if (period.status === "paid") throw new PayrollPeriodLockedError(`Period ${period.name.value} is already paid`);

        period.lockAttendance(input.actorUserId);
        await this._periods.save(period);

        await this._eventBus.publish([new PayrollAttendanceLockedEvent(period.id, period.name.value)]);

        let autoRunning = false;
        if (period.isFullyLocked) {
            await this._runner.forPeriod(period.id, input.actorUserId);
            autoRunning = true;
        }

        return { period, autoRunning };
    }
}
