import LeaveBalanceRepo from "@modules/attendance/core/app/ports/LeaveBalanceRepo";
import LeaveAccessScope from "@modules/attendance/core/app/services/LeaveAccessScope";
import LeaveEntitlementService from "@modules/attendance/core/app/services/LeaveEntitlementService";
import LeaveBalance from "@modules/attendance/core/domain/entities/LeaveBalance";
import { CARRYOVER_YEARS } from "@modules/attendance/core/domain/services/leave-calc";

export interface ListLeaveBalancesInput {
    /** Bỏ trống = số dư của chính actor (giao diện tự phục vụ). */
    employeeId?: string | undefined;
    year:        number;
    actorUserId: string;
}

export interface ListLeaveBalancesOutput {
    employeeId: string;
    balances:   LeaveBalance[];
    /**
     * Phép năm còn lại theo BỂ CỘNG DỒN, không phải theo từng dòng năm.
     *
     * Vì sao cần trả riêng: `balances` là các dòng theo năm, còn quy tắc thực tế
     * là phép năm dồn được `CARRYOVER_YEARS` năm — nhìn dòng của năm hiện tại sẽ
     * hiểu sai số ngày thực sự dùng được. Đây đúng là con số mà use-case nộp đơn
     * dùng để chặn vượt hạn mức, nên giao diện hiển thị nó là khớp với backend.
     */
    annualRemaining: number;
    /** Số năm được cộng dồn phép năm — để giao diện giải thích con số trên. */
    carryoverYears:  number;
}

/**
 * Liệt kê số dư phép của một nhân viên trong một năm, trong phạm vi actor được
 * xem — nhân viên tự tra số ngày phép còn lại của mình mà không thấy của người khác.
 *
 * @throws {AccessDeniedError} Không được xem số dư của nhân viên này, hoặc actor
 *                             không gắn với nhân viên nào.
 */
export default class ListLeaveBalancesUseCase {
    public constructor(
        private readonly _accessScope: LeaveAccessScope,
        private readonly _leaveBalanceRepo: LeaveBalanceRepo,
        private readonly _entitlement: LeaveEntitlementService,
    ) {}

    public async execute(input: ListLeaveBalancesInput): Promise<ListLeaveBalancesOutput> {
        const employeeId = await this._accessScope.resolveReadSubjectEmployeeId(input.actorUserId, input.employeeId);

        return {
            employeeId,
            balances:        await this._leaveBalanceRepo.listByEmployeeYear(employeeId, input.year),
            annualRemaining: await this._entitlement.remainingAnnual(employeeId, input.year),
            carryoverYears:  CARRYOVER_YEARS,
        };
    }
}
