import GetSystemSettingsUseCase from "@modules/setting/core/app/use-cases/system/GetSystemSettingsUseCase";
import UpdateSystemSettingsUseCase from "@modules/setting/core/app/use-cases/system/UpdateSystemSettingsUseCase";
import ActorContext from "@shared/adapters/driver/http/ActorContext";
import BadRequestError from "@shared/adapters/driver/http/errors/BadRequestError";
import { Request, Response } from "express";

export interface SystemSettingControllerUseCases {
    getSystemSettings:    GetSystemSettingsUseCase;
    updateSystemSettings: UpdateSystemSettingsUseCase;
}

/**
 * Controller nhóm endpoint cấu hình hệ thống dạng key-value tự do — body có
 * hình dạng động (key bất kỳ) nên không khai báo `bodySchema` cố định; chỉ
 * kiểm tra body là JSON object ở tầng HTTP, còn lại (key/value hợp lệ) do
 * domain đảm nhiệm.
 */
export default class SystemSettingController {
    public constructor(
        private readonly _useCases: SystemSettingControllerUseCases,
    ) {}

    public getSystemSettings = async (_req: Request, res: Response): Promise<void> => {
        const settings = await this._useCases.getSystemSettings.execute();
        res.status(200).json({ settings });
    };

    public updateSystemSettings = async (req: Request, res: Response): Promise<void> => {
        await this._useCases.updateSystemSettings.execute({
            entries:     toJsonObject(req.body),
            actorUserId: ActorContext.get(res),
        });
        res.status(200).end();
    };
}

function toJsonObject(body: unknown): Record<string, unknown> {
    if (body == undefined || typeof body !== "object" || Array.isArray(body)) {
        throw new BadRequestError("Request body must be a JSON object");
    }
    return body as Record<string, unknown>;
}
