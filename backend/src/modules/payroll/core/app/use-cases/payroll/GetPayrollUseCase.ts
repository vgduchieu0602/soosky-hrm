import PayslipNotFoundError from "@modules/payroll/core/app/errors/PayslipNotFoundError";
import EmployeeDirectory from "@modules/payroll/core/app/ports/EmployeeDirectory";
import PayslipRepo from "@modules/payroll/core/app/ports/PayslipRepo";
import Payslip from "@modules/payroll/core/domain/entities/Payslip";
import AccessDeniedError from "@shared/core/app/errors/AccessDeniedError";

export interface GetPayrollViewer {
    userId:       string;
    isHrOrAdmin:  boolean;
}

/**
 * Lấy một phiếu lương. Phòng thủ theo chiều sâu: người gọi không phải
 * HR/Admin chỉ được xem phiếu lương CỦA CHÍNH MÌNH (thêm vào cổng chặn ở
 * route) — route bị nới lỏng/leak vẫn không lộ lương người khác.
 */
export default class GetPayrollUseCase {
    public constructor(
        private readonly _payslips: PayslipRepo,
        private readonly _employees: EmployeeDirectory,
    ) {}

    public async execute(input: { payslipId: string; viewer?: GetPayrollViewer }): Promise<Payslip> {
        const payslip = await this._payslips.getById(input.payslipId);
        if (payslip == undefined) throw new PayslipNotFoundError();

        if (input.viewer != undefined && !input.viewer.isHrOrAdmin) {
            const myEmployeeId = await this._employees.findEmployeeIdByUserId(input.viewer.userId);
            if (myEmployeeId == undefined || myEmployeeId !== payslip.employeeId) throw new AccessDeniedError();
        }

        return payslip;
    }
}
