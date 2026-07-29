import ShiftPresenter from "@modules/attendance/adapters/driver/http/presenters/ShiftPresenter";
import ArchiveShiftUseCase from "@modules/attendance/core/app/use-cases/shift/ArchiveShiftUseCase";
import CreateShiftUseCase from "@modules/attendance/core/app/use-cases/shift/CreateShiftUseCase";
import DeleteShiftUseCase from "@modules/attendance/core/app/use-cases/shift/DeleteShiftUseCase";
import GetShiftUseCase from "@modules/attendance/core/app/use-cases/shift/GetShiftUseCase";
import ListShiftsUseCase from "@modules/attendance/core/app/use-cases/shift/ListShiftsUseCase";
import UpdateShiftUseCase from "@modules/attendance/core/app/use-cases/shift/UpdateShiftUseCase";
import ActorContext from "@shared/adapters/driver/http/ActorContext";
import BadRequestError from "@shared/adapters/driver/http/errors/BadRequestError";
import { bodySchema, field } from "@shared/adapters/driver/http/validation";
import { Request, Response } from "express";

export interface ShiftControllerUseCases {
    createShift:  CreateShiftUseCase;
    updateShift:  UpdateShiftUseCase;
    getShift:     GetShiftUseCase;
    listShifts:   ListShiftsUseCase;
    archiveShift: ArchiveShiftUseCase;
    deleteShift:  DeleteShiftUseCase;
}

const bodySchemaCreateShift = bodySchema({
    code:         field.string,
    name:         field.string,
    startTime:    field.string,
    endTime:      field.string,
    breakMinutes: field.number,
});

const bodySchemaUpdateShift = bodySchema({
    name:         field.optionalString,
    startTime:    field.optionalString,
    endTime:      field.optionalString,
    breakMinutes: field.optionalNumber,
});

function parseWorkingDays(raw: unknown): number[] {
    if (!Array.isArray(raw) || !raw.every(day => typeof day === "number" && day >= 1 && day <= 7)) {
        throw new BadRequestError("'workingDays' must be an array of ISO weekday numbers (1..7)");
    }
    return raw;
}

/** Controller nhóm endpoint Shift (ca làm việc): parse request, gọi use-case, ghi response. */
export default class ShiftController {
    public constructor(
        private readonly _useCases: ShiftControllerUseCases,
    ) {}

    public createShift = async (req: Request, res: Response): Promise<void> => {
        const body = bodySchemaCreateShift.parse(req.body);
        const output = await this._useCases.createShift.execute({
            ...body,
            workingDays: parseWorkingDays((req.body as Record<string, unknown>)?.workingDays ?? []),
            actorUserId: ActorContext.get(res),
        });
        res.status(201).json(output);
    };

    public listShifts = async (req: Request, res: Response): Promise<void> => {
        const shifts = await this._useCases.listShifts.execute({ activeOnly: req.query.activeOnly === "true" });
        res.status(200).json({ shifts: shifts.map(ShiftPresenter.toDTO) });
    };

    public getShift = async (req: Request<{ shiftId: string }>, res: Response): Promise<void> => {
        const shift = await this._useCases.getShift.execute({ shiftId: req.params.shiftId });
        res.status(200).json(ShiftPresenter.toDTO(shift));
    };

    public updateShift = async (req: Request<{ shiftId: string }>, res: Response): Promise<void> => {
        const body = bodySchemaUpdateShift.parse(req.body);
        const rawWorkingDays = (req.body as Record<string, unknown>)?.workingDays;
        const workingDays = rawWorkingDays == undefined ? undefined : parseWorkingDays(rawWorkingDays);
        await this._useCases.updateShift.execute({
            ...body,
            shiftId:     req.params.shiftId,
            ...(workingDays != undefined ? { workingDays } : {}),
            actorUserId: ActorContext.get(res),
        });
        res.status(200).end();
    };

    public archiveShift = async (req: Request<{ shiftId: string }>, res: Response): Promise<void> => {
        await this._useCases.archiveShift.execute({ shiftId: req.params.shiftId, actorUserId: ActorContext.get(res) });
        res.status(200).end();
    };

    public deleteShift = async (req: Request<{ shiftId: string }>, res: Response): Promise<void> => {
        await this._useCases.deleteShift.execute({ shiftId: req.params.shiftId, actorUserId: ActorContext.get(res) });
        res.status(200).end();
    };
}
