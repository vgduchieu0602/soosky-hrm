import HolidayPresenter from "@modules/attendance/adapters/driver/http/presenters/HolidayPresenter";
import CreateHolidayUseCase from "@modules/attendance/core/app/use-cases/holiday/CreateHolidayUseCase";
import DeleteHolidayUseCase from "@modules/attendance/core/app/use-cases/holiday/DeleteHolidayUseCase";
import GetHolidayUseCase from "@modules/attendance/core/app/use-cases/holiday/GetHolidayUseCase";
import ListHolidaysUseCase from "@modules/attendance/core/app/use-cases/holiday/ListHolidaysUseCase";
import UpdateHolidayUseCase from "@modules/attendance/core/app/use-cases/holiday/UpdateHolidayUseCase";
import ActorContext from "@shared/adapters/driver/http/ActorContext";
import { bodySchema, field } from "@shared/adapters/driver/http/validation";
import { Request, Response } from "express";

export interface HolidayControllerUseCases {
    createHoliday: CreateHolidayUseCase;
    updateHoliday: UpdateHolidayUseCase;
    getHoliday:    GetHolidayUseCase;
    listHolidays:  ListHolidaysUseCase;
    deleteHoliday: DeleteHolidayUseCase;
}

const bodySchemaCreateHoliday = bodySchema({
    name: field.string,
    date: field.date,
});

const bodySchemaUpdateHoliday = bodySchema({
    name: field.optionalString,
    date: field.optionalDate,
});

function parseIsRecurring(raw: unknown): boolean | undefined {
    return typeof raw === "boolean" ? raw : undefined;
}

/** Controller nhóm endpoint Holiday (ngày lễ): parse request, gọi use-case, ghi response. */
export default class HolidayController {
    public constructor(
        private readonly _useCases: HolidayControllerUseCases,
    ) {}

    public createHoliday = async (req: Request, res: Response): Promise<void> => {
        const body = bodySchemaCreateHoliday.parse(req.body);
        const isRecurring = parseIsRecurring((req.body as Record<string, unknown>)?.isRecurring);
        const output = await this._useCases.createHoliday.execute({
            ...body,
            ...(isRecurring != undefined ? { isRecurring } : {}),
            actorUserId: ActorContext.get(res),
        });
        res.status(201).json(output);
    };

    public listHolidays = async (_req: Request, res: Response): Promise<void> => {
        const holidays = await this._useCases.listHolidays.execute();
        res.status(200).json({ holidays: holidays.map(HolidayPresenter.toDTO) });
    };

    public getHoliday = async (req: Request<{ holidayId: string }>, res: Response): Promise<void> => {
        const holiday = await this._useCases.getHoliday.execute({ holidayId: req.params.holidayId });
        res.status(200).json(HolidayPresenter.toDTO(holiday));
    };

    public updateHoliday = async (req: Request<{ holidayId: string }>, res: Response): Promise<void> => {
        const body = bodySchemaUpdateHoliday.parse(req.body);
        const isRecurring = parseIsRecurring((req.body as Record<string, unknown>)?.isRecurring);
        await this._useCases.updateHoliday.execute({
            ...body,
            holidayId:   req.params.holidayId,
            ...(isRecurring != undefined ? { isRecurring } : {}),
            actorUserId: ActorContext.get(res),
        });
        res.status(200).end();
    };

    public deleteHoliday = async (req: Request<{ holidayId: string }>, res: Response): Promise<void> => {
        await this._useCases.deleteHoliday.execute({ holidayId: req.params.holidayId, actorUserId: ActorContext.get(res) });
        res.status(200).end();
    };
}
