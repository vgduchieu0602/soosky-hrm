import LeaveRequestPresenter from "@modules/attendance/adapters/driver/http/presenters/LeaveRequestPresenter";
import ApproveLeaveRequestUseCase from "@modules/attendance/core/app/use-cases/leave/ApproveLeaveRequestUseCase";
import CancelLeaveRequestUseCase from "@modules/attendance/core/app/use-cases/leave/CancelLeaveRequestUseCase";
import GetLeaveRequestUseCase from "@modules/attendance/core/app/use-cases/leave/GetLeaveRequestUseCase";
import ListLeaveRequestsUseCase from "@modules/attendance/core/app/use-cases/leave/ListLeaveRequestsUseCase";
import RejectLeaveRequestUseCase from "@modules/attendance/core/app/use-cases/leave/RejectLeaveRequestUseCase";
import SubmitLeaveRequestUseCase from "@modules/attendance/core/app/use-cases/leave/SubmitLeaveRequestUseCase";
import ActorContext from "@shared/adapters/driver/http/ActorContext";
import { bodySchema, field } from "@shared/adapters/driver/http/validation";
import { Request, Response } from "express";

export interface LeaveRequestControllerUseCases {
    submitLeaveRequest: SubmitLeaveRequestUseCase;
    approveLeaveRequest: ApproveLeaveRequestUseCase;
    rejectLeaveRequest: RejectLeaveRequestUseCase;
    cancelLeaveRequest: CancelLeaveRequestUseCase;
    getLeaveRequest:    GetLeaveRequestUseCase;
    listLeaveRequests:  ListLeaveRequestsUseCase;
}

const bodySchemaSubmitLeaveRequest = bodySchema({
    employeeId:     field.string,
    leaveType:      field.string,
    startDate:      field.date,
    endDate:        field.date,
    halfDaySession: field.optionalString,
    reason:         field.optionalString,
});

const bodySchemaRejectLeaveRequest = bodySchema({
    reason: field.string,
});

const bodySchemaCancelLeaveRequest = bodySchema({
    reason: field.optionalString,
});

/** Controller nhóm endpoint LeaveRequest (đơn xin nghỉ): parse request, gọi use-case, ghi response. */
export default class LeaveRequestController {
    public constructor(
        private readonly _useCases: LeaveRequestControllerUseCases,
    ) {}

    public submitLeaveRequest = async (req: Request, res: Response): Promise<void> => {
        const output = await this._useCases.submitLeaveRequest.execute({
            ...bodySchemaSubmitLeaveRequest.parse(req.body),
            actorUserId: ActorContext.get(res),
        });
        res.status(201).json(output);
    };

    public listLeaveRequests = async (req: Request, res: Response): Promise<void> => {
        const employeeId = typeof req.query.employeeId === "string" ? req.query.employeeId : undefined;
        const leaveRequests = await this._useCases.listLeaveRequests.execute(
            employeeId != undefined ? { employeeId } : {},
        );
        res.status(200).json({ leaveRequests: leaveRequests.map(LeaveRequestPresenter.toDTO) });
    };

    public getLeaveRequest = async (req: Request<{ leaveRequestId: string }>, res: Response): Promise<void> => {
        const leaveRequest = await this._useCases.getLeaveRequest.execute({ leaveRequestId: req.params.leaveRequestId });
        res.status(200).json(LeaveRequestPresenter.toDTO(leaveRequest));
    };

    public approveLeaveRequest = async (req: Request<{ leaveRequestId: string }>, res: Response): Promise<void> => {
        await this._useCases.approveLeaveRequest.execute({
            leaveRequestId: req.params.leaveRequestId,
            actorUserId:    ActorContext.get(res),
        });
        res.status(200).end();
    };

    public rejectLeaveRequest = async (req: Request<{ leaveRequestId: string }>, res: Response): Promise<void> => {
        const body = bodySchemaRejectLeaveRequest.parse(req.body);
        await this._useCases.rejectLeaveRequest.execute({
            leaveRequestId: req.params.leaveRequestId,
            reason:         body.reason,
            actorUserId:    ActorContext.get(res),
        });
        res.status(200).end();
    };

    public cancelLeaveRequest = async (req: Request<{ leaveRequestId: string }>, res: Response): Promise<void> => {
        const body = bodySchemaCancelLeaveRequest.parse(req.body);
        await this._useCases.cancelLeaveRequest.execute({
            leaveRequestId: req.params.leaveRequestId,
            ...(body.reason != undefined ? { reason: body.reason } : {}),
            actorUserId:    ActorContext.get(res),
        });
        res.status(200).end();
    };
}
