import AttendanceSymbolPresenter from "@modules/attendance/adapters/driver/http/presenters/AttendanceSymbolPresenter";
import CreateAttendanceSymbolUseCase from "@modules/attendance/core/app/use-cases/symbol/CreateAttendanceSymbolUseCase";
import DeleteAttendanceSymbolUseCase from "@modules/attendance/core/app/use-cases/symbol/DeleteAttendanceSymbolUseCase";
import GetAttendanceSymbolUseCase from "@modules/attendance/core/app/use-cases/symbol/GetAttendanceSymbolUseCase";
import ListAttendanceSymbolsUseCase from "@modules/attendance/core/app/use-cases/symbol/ListAttendanceSymbolsUseCase";
import UpdateAttendanceSymbolUseCase from "@modules/attendance/core/app/use-cases/symbol/UpdateAttendanceSymbolUseCase";
import ActorContext from "@shared/adapters/driver/http/ActorContext";
import { bodySchema, field } from "@shared/adapters/driver/http/validation";
import { Request, Response } from "express";

export interface AttendanceSymbolControllerUseCases {
    createAttendanceSymbol: CreateAttendanceSymbolUseCase;
    updateAttendanceSymbol: UpdateAttendanceSymbolUseCase;
    getAttendanceSymbol:    GetAttendanceSymbolUseCase;
    listAttendanceSymbols:  ListAttendanceSymbolsUseCase;
    deleteAttendanceSymbol: DeleteAttendanceSymbolUseCase;
}

const bodySchemaCreateSymbol = bodySchema({
    code:        field.string,
    name:        field.string,
    description: field.optionalString,
});

const bodySchemaUpdateSymbol = bodySchema({
    name:        field.optionalString,
    description: field.optionalString,
});

/** Controller nhóm endpoint AttendanceSymbol (ký hiệu chấm công): parse request, gọi use-case, ghi response. */
export default class AttendanceSymbolController {
    public constructor(
        private readonly _useCases: AttendanceSymbolControllerUseCases,
    ) {}

    public createAttendanceSymbol = async (req: Request, res: Response): Promise<void> => {
        const output = await this._useCases.createAttendanceSymbol.execute({
            ...bodySchemaCreateSymbol.parse(req.body),
            actorUserId: ActorContext.get(res),
        });
        res.status(201).json(output);
    };

    public listAttendanceSymbols = async (_req: Request, res: Response): Promise<void> => {
        const symbols = await this._useCases.listAttendanceSymbols.execute();
        res.status(200).json({ symbols: symbols.map(AttendanceSymbolPresenter.toDTO) });
    };

    public getAttendanceSymbol = async (req: Request<{ symbolId: string }>, res: Response): Promise<void> => {
        const symbol = await this._useCases.getAttendanceSymbol.execute({ symbolId: req.params.symbolId });
        res.status(200).json(AttendanceSymbolPresenter.toDTO(symbol));
    };

    public updateAttendanceSymbol = async (req: Request<{ symbolId: string }>, res: Response): Promise<void> => {
        await this._useCases.updateAttendanceSymbol.execute({
            ...bodySchemaUpdateSymbol.parse(req.body),
            symbolId:    req.params.symbolId,
            actorUserId: ActorContext.get(res),
        });
        res.status(200).end();
    };

    public deleteAttendanceSymbol = async (req: Request<{ symbolId: string }>, res: Response): Promise<void> => {
        await this._useCases.deleteAttendanceSymbol.execute({ symbolId: req.params.symbolId, actorUserId: ActorContext.get(res) });
        res.status(200).end();
    };
}
