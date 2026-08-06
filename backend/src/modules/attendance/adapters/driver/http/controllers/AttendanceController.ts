import AttendancePresenter from "@modules/attendance/adapters/driver/http/presenters/AttendancePresenter";
import DeleteAttendanceUseCase from "@modules/attendance/core/app/use-cases/attendance/DeleteAttendanceUseCase";
import GetAttendanceUseCase from "@modules/attendance/core/app/use-cases/attendance/GetAttendanceUseCase";
import ListAttendanceUseCase from "@modules/attendance/core/app/use-cases/attendance/ListAttendanceUseCase";
import ListVisibleAttendanceUseCase from "@modules/attendance/core/app/use-cases/attendance/ListVisibleAttendanceUseCase";
import UpsertAttendanceUseCase from "@modules/attendance/core/app/use-cases/attendance/UpsertAttendanceUseCase";
import ActorContext from "@shared/adapters/driver/http/ActorContext";
import { bodySchema, field, requiredQueryString } from "@shared/adapters/driver/http/validation";
import { Request, Response } from "express";

export interface AttendanceControllerUseCases {
    upsertAttendance: UpsertAttendanceUseCase;
    getAttendance:    GetAttendanceUseCase;
    listAttendance:   ListAttendanceUseCase;
    listVisibleAttendance: ListVisibleAttendanceUseCase;
    deleteAttendance: DeleteAttendanceUseCase;
}

const bodySchemaUpsertAttendance = bodySchema({
    employeeId: field.string,
    date:       field.date,
    checkIn:    field.optionalDate,
    checkOut:   field.optionalDate,
    note:       field.optionalString,
});

/** Controller nhóm endpoint Attendance (chấm công): parse request, gọi use-case, ghi response. */
export default class AttendanceController {
    public constructor(
        private readonly _useCases: AttendanceControllerUseCases,
    ) {}

    public upsertAttendance = async (req: Request, res: Response): Promise<void> => {
        const output = await this._useCases.upsertAttendance.execute({
            ...bodySchemaUpsertAttendance.parse(req.body),
            actorUserId: ActorContext.get(res),
        });
        res.status(200).json({
            date:      output.date.toISOString(),
            totalCong: output.totalCong,
            records:   output.records.map(AttendancePresenter.toDTO),
        });
    };

    public listAttendance = async (req: Request, res: Response): Promise<void> => {
        // `employeeId` tuỳ chọn: bỏ trống = bảng công của chính người đang đăng nhập.
        const employeeId = typeof req.query.employeeId === "string" ? req.query.employeeId : undefined;
        const start = new Date(requiredQueryString(req.query.start, "start"));
        const end   = new Date(requiredQueryString(req.query.end, "end"));
        const records = await this._useCases.listAttendance.execute({
            ...(employeeId != undefined ? { employeeId } : {}),
            start,
            end,
            actorUserId: ActorContext.get(res),
        });
        res.status(200).json({ records: records.map(AttendancePresenter.toDTO) });
    };

    /**
     * Bảng công của MỌI nhân viên trong phạm vi actor — nguồn dữ liệu cho lưới
     * chấm công. Tách khỏi `GET /records` vì ở đó bỏ trống `employeeId` nghĩa là
     * "của chính tôi" (tự phục vụ), không phải "của tất cả".
     */
    public listVisibleAttendance = async (req: Request, res: Response): Promise<void> => {
        const start = new Date(requiredQueryString(req.query.start, "start"));
        const end   = new Date(requiredQueryString(req.query.end, "end"));
        const records = await this._useCases.listVisibleAttendance.execute({
            start, end, actorUserId: ActorContext.get(res),
        });
        res.status(200).json({ records: records.map(AttendancePresenter.toDTO) });
    };

    public getAttendance = async (req: Request<{ attendanceId: string }>, res: Response): Promise<void> => {
        const attendance = await this._useCases.getAttendance.execute({
            attendanceId: req.params.attendanceId,
            actorUserId:  ActorContext.get(res),
        });
        res.status(200).json(AttendancePresenter.toDTO(attendance));
    };

    public deleteAttendance = async (req: Request<{ attendanceId: string }>, res: Response): Promise<void> => {
        await this._useCases.deleteAttendance.execute({ attendanceId: req.params.attendanceId, actorUserId: ActorContext.get(res) });
        res.status(200).end();
    };
}
