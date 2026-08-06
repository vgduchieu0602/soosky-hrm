import LeaveBalancePresenter from "@modules/attendance/adapters/driver/http/presenters/LeaveBalancePresenter";
import AdjustLeaveBalanceUseCase from "@modules/attendance/core/app/use-cases/leave-balance/AdjustLeaveBalanceUseCase";
import GetLeaveBalanceUseCase from "@modules/attendance/core/app/use-cases/leave-balance/GetLeaveBalanceUseCase";
import ListLeaveBalancesUseCase from "@modules/attendance/core/app/use-cases/leave-balance/ListLeaveBalancesUseCase";
import ActorContext from "@shared/adapters/driver/http/ActorContext";
import { bodySchema, field, requiredQueryString } from "@shared/adapters/driver/http/validation";
import { Request, Response } from "express";

export interface LeaveBalanceControllerUseCases {
    adjustLeaveBalance: AdjustLeaveBalanceUseCase;
    getLeaveBalance:    GetLeaveBalanceUseCase;
    listLeaveBalances:  ListLeaveBalancesUseCase;
}

const bodySchemaAdjustLeaveBalance = bodySchema({
    employeeId: field.string,
    leaveType:  field.string,
    year:       field.number,
    entitled:   field.number,
});

/** Controller nhóm endpoint LeaveBalance (số dư phép): parse request, gọi use-case, ghi response. */
export default class LeaveBalanceController {
    public constructor(
        private readonly _useCases: LeaveBalanceControllerUseCases,
    ) {}

    public adjustLeaveBalance = async (req: Request, res: Response): Promise<void> => {
        await this._useCases.adjustLeaveBalance.execute({
            ...bodySchemaAdjustLeaveBalance.parse(req.body),
            actorUserId: ActorContext.get(res),
        });
        res.status(200).end();
    };

    public getLeaveBalance = async (req: Request, res: Response): Promise<void> => {
        const employeeId = requiredQueryString(req.query.employeeId, "employeeId");
        const leaveType  = requiredQueryString(req.query.leaveType, "leaveType");
        const year       = Number(requiredQueryString(req.query.year, "year"));
        const balance = await this._useCases.getLeaveBalance.execute({ employeeId, leaveType, year });
        res.status(200).json(balance);
    };

    public listLeaveBalances = async (req: Request, res: Response): Promise<void> => {
        // `employeeId` tuỳ chọn: bỏ trống = số dư của chính người đang đăng nhập.
        const employeeId = typeof req.query.employeeId === "string" ? req.query.employeeId : undefined;
        const year       = Number(requiredQueryString(req.query.year, "year"));
        const output = await this._useCases.listLeaveBalances.execute({
            ...(employeeId != undefined ? { employeeId } : {}),
            year,
            actorUserId: ActorContext.get(res),
        });
        res.status(200).json({
            employeeId:      output.employeeId,
            balances:        output.balances.map(LeaveBalancePresenter.toDTO),
            annualRemaining: output.annualRemaining,
            carryoverYears:  output.carryoverYears,
        });
    };
}
