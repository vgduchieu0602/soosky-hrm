import AttendanceCorrectionPresenter from "@modules/attendance/adapters/driver/http/presenters/AttendanceCorrectionPresenter";
import ApproveAttendanceCorrectionUseCase from "@modules/attendance/core/app/use-cases/correction/ApproveAttendanceCorrectionUseCase";
import ListAttendanceCorrectionsUseCase from "@modules/attendance/core/app/use-cases/correction/ListAttendanceCorrectionsUseCase";
import RejectAttendanceCorrectionUseCase from "@modules/attendance/core/app/use-cases/correction/RejectAttendanceCorrectionUseCase";
import SubmitAttendanceCorrectionUseCase from "@modules/attendance/core/app/use-cases/correction/SubmitAttendanceCorrectionUseCase";
import { CorrectionStatus } from "@modules/attendance/core/domain/entities/AttendanceCorrectionRequest";
import ActorContext from "@shared/adapters/driver/http/ActorContext";
import { bodySchema, field } from "@shared/adapters/driver/http/validation";
import { Request, Response } from "express";

export interface AttendanceCorrectionControllerUseCases {
    submitAttendanceCorrection: SubmitAttendanceCorrectionUseCase;
    listAttendanceCorrections:  ListAttendanceCorrectionsUseCase;
    approveAttendanceCorrection: ApproveAttendanceCorrectionUseCase;
    rejectAttendanceCorrection:  RejectAttendanceCorrectionUseCase;
}

// `employeeId` tuỳ chọn: bỏ trống = yêu cầu cho chính mình.
const bodySchemaSubmitCorrection = bodySchema({
    employeeId:        field.optionalString,
    date:              field.date,
    requestedCheckIn:  field.optionalDate,
    requestedCheckOut: field.optionalDate,
    reason:            field.string,
});

const bodySchemaApproveCorrection = bodySchema({
    note: field.optionalString,
});

const bodySchemaRejectCorrection = bodySchema({
    reason: field.string,
});

const CORRECTION_STATUS_VALUES = ["pending", "approved", "rejected"];

/** Controller nhóm endpoint yêu cầu chỉnh công: parse request, gọi use-case, ghi response. */
export default class AttendanceCorrectionController {
    public constructor(
        private readonly _useCases: AttendanceCorrectionControllerUseCases,
    ) {}

    public submitCorrection = async (req: Request, res: Response): Promise<void> => {
        const body   = bodySchemaSubmitCorrection.parse(req.body);
        const output = await this._useCases.submitAttendanceCorrection.execute({
            ...body,
            actorUserId: ActorContext.get(res),
        });
        res.status(201).json(output);
    };

    public listCorrections = async (req: Request, res: Response): Promise<void> => {
        const employeeId = typeof req.query.employeeId === "string" ? req.query.employeeId : undefined;
        const rawStatus  = typeof req.query.status === "string" ? req.query.status : undefined;
        const status     = rawStatus != undefined && CORRECTION_STATUS_VALUES.includes(rawStatus)
            ? rawStatus as CorrectionStatus
            : undefined;

        const requests = await this._useCases.listAttendanceCorrections.execute({
            ...(employeeId != undefined ? { employeeId } : {}),
            ...(status != undefined ? { status } : {}),
            actorUserId: ActorContext.get(res),
        });
        res.status(200).json({ correctionRequests: requests.map(AttendanceCorrectionPresenter.toDTO) });
    };

    public approveCorrection = async (req: Request<{ correctionRequestId: string }>, res: Response): Promise<void> => {
        const body   = bodySchemaApproveCorrection.parse(req.body ?? {});
        const output = await this._useCases.approveAttendanceCorrection.execute({
            correctionRequestId: req.params.correctionRequestId,
            ...(body.note != undefined ? { note: body.note } : {}),
            actorUserId: ActorContext.get(res),
        });
        res.status(200).json(output);
    };

    public rejectCorrection = async (req: Request<{ correctionRequestId: string }>, res: Response): Promise<void> => {
        const body = bodySchemaRejectCorrection.parse(req.body);
        await this._useCases.rejectAttendanceCorrection.execute({
            correctionRequestId: req.params.correctionRequestId,
            reason:              body.reason,
            actorUserId:         ActorContext.get(res),
        });
        res.status(200).end();
    };
}
