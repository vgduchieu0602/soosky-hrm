import LeaveBalanceRepo from "@modules/attendance/core/app/ports/LeaveBalanceRepo";
import LeaveEntitlementService from "@modules/attendance/core/app/services/LeaveEntitlementService";
import LeaveType from "@modules/attendance/core/domain/value-objects/LeaveType";

export interface GetLeaveBalanceInput {
    employeeId: string;
    leaveType:  string;
    year:       number;
}

export interface GetLeaveBalanceOutput {
    employeeId: string;
    leaveType:  string;
    year:       number;
    entitled:   number;
    used:       number;
    remaining:  number;
}

/**
 * Lấy số dư phép của một nhân viên trong một năm. Với `annual`, `remaining`
 * là số phép còn lại dạng bể cộng dồn 3 năm (carry-over); các loại khác chỉ
 * tính trong đúng năm được hỏi.
 */
export default class GetLeaveBalanceUseCase {
    public constructor(
        private readonly _leaveBalanceRepo: LeaveBalanceRepo,
        private readonly _entitlement: LeaveEntitlementService,
    ) {}

    public async execute(input: GetLeaveBalanceInput): Promise<GetLeaveBalanceOutput> {
        const leaveType = LeaveType.create(input.leaveType);
        const balance = await this._leaveBalanceRepo.getOne(input.employeeId, leaveType.value, input.year);

        const entitled = balance?.entitled ?? 0;
        const used     = balance?.used ?? 0;
        const remaining = leaveType.isAnnual
            ? await this._entitlement.remainingAnnual(input.employeeId, input.year)
            : Math.max(0, entitled - used);

        return { employeeId: input.employeeId, leaveType: leaveType.value, year: input.year, entitled, used, remaining };
    }
}
