import NothingToApproveError from "@modules/payroll/core/app/errors/NothingToApproveError";
import PayrollPeriodLockedError from "@modules/payroll/core/app/errors/PayrollPeriodLockedError";
import PayrollPeriodNotFoundError from "@modules/payroll/core/app/errors/PayrollPeriodNotFoundError";
import SelfApprovalForbiddenError from "@modules/payroll/core/app/errors/SelfApprovalForbiddenError";
import PermissionChecker from "@modules/payroll/core/app/ports/PermissionChecker";
import UnitOfWork from "@modules/payroll/core/app/ports/UnitOfWork";
import { PayrollApprovedEvent } from "@modules/payroll/core/domain/events/PayrollApprovedEvent";
import EventBus from "@shared/core/domain/EventBus";

const PERMISSION_KEY = "payroll:approve";

export interface ApprovePayrollOutput {
    periodId: string;
    affected: number;
}

/**
 * Duyệt các phiếu lương `draft` của một kỳ — toàn bộ, hoặc một nhân viên nếu
 * truyền `employeeId`. Phát `payroll.approved`.
 *
 * Duyệt TOÀN KỲ đòi kỳ đã ở bước `hr_reviewed`: bảng lương thử phải được HR soát
 * và ký nhận trước khi người có thẩm quyền duyệt. Duyệt LẺ một nhân viên không
 * đổi bước của kỳ (dùng để duyệt bù phiếu vừa tính lại), nên vẫn không thể chi
 * trả tắt bước — `markPaid` đòi bước `approved`.
 *
 * @throws {AccessDeniedError}          Actor không có quyền `payroll:approve`.
 * @throws {PayrollPeriodNotFoundError} Không tìm thấy kỳ lương.
 * @throws {PayrollPeriodLockedError}   Kỳ đã thanh toán.
 * @throws {NothingToApproveError}      Không có phiếu draft nào để duyệt.
 * @throws {SelfApprovalForbiddenError} Người duyệt chính là người đã lập lương kỳ này.
 * @throws {PayrollStageInvalidError}   Duyệt toàn kỳ khi HR chưa soát xong bảng lương thử.
 */
export default class ApprovePayrollUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _uow: UnitOfWork,
        private readonly _eventBus: EventBus,
    ) {}

    public async execute(input: { periodId: string; approverUserId: string; employeeId?: string }): Promise<ApprovePayrollOutput> {
        await this._permissions.assertPermission(input.approverUserId, PERMISSION_KEY);

        const affected = await this._uow.run(async (ctx) => {
            const period = await ctx.periodRepo.getById(input.periodId);
            if (period == undefined) throw new PayrollPeriodNotFoundError();
            if (period.status === "paid") throw new PayrollPeriodLockedError(`Period ${period.name.value} is already paid`);
            if (period.preparedBy != null && period.preparedBy === input.approverUserId) {
                throw new SelfApprovalForbiddenError("approve");
            }

            const drafts = await ctx.payslipRepo.listByPeriodAndStatus(input.periodId, "draft", input.employeeId);
            if (drafts.length === 0) throw new NothingToApproveError();

            // Kiểm bước TRƯỚC khi ghi phiếu: nếu để sau, một lần bấm duyệt sớm vẫn
            // kịp chuyển phiếu sang `approved` rồi mới báo lỗi.
            if (input.employeeId == undefined) period.markApproved();

            for (const payslip of drafts) {
                payslip.approve(input.approverUserId);
                await ctx.payslipRepo.save(payslip);
            }

            if (input.employeeId == undefined) await ctx.periodRepo.save(period);

            return drafts.length;
        });

        await this._eventBus.publish([new PayrollApprovedEvent(input.periodId, affected, input.approverUserId)]);

        return { periodId: input.periodId, affected };
    }
}
