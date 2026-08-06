import BankTransferProfilePresenter from "@modules/setting/adapters/driver/http/presenters/BankTransferProfilePresenter";
import ActivateBankTransferProfileUseCase from "@modules/setting/core/app/use-cases/bank/ActivateBankTransferProfileUseCase";
import CreateBankTransferProfileUseCase from "@modules/setting/core/app/use-cases/bank/CreateBankTransferProfileUseCase";
import DeleteBankTransferProfileUseCase from "@modules/setting/core/app/use-cases/bank/DeleteBankTransferProfileUseCase";
import ListBankTransferProfilesUseCase from "@modules/setting/core/app/use-cases/bank/ListBankTransferProfilesUseCase";
import UpdateBankTransferProfileUseCase from "@modules/setting/core/app/use-cases/bank/UpdateBankTransferProfileUseCase";
import {
    BANK_AMOUNT_FORMATS, BANK_COLUMN_SOURCES, BANK_DELIMITERS,
    BankAmountFormat, BankColumnSource, BankDelimiter, BankTransferColumn,
} from "@modules/setting/core/domain/entities/BankTransferProfile";
import ActorContext from "@shared/adapters/driver/http/ActorContext";
import BadRequestError from "@shared/adapters/driver/http/errors/BadRequestError";
import { bodySchema, field } from "@shared/adapters/driver/http/validation";
import { Request, Response } from "express";

export interface BankTransferProfileControllerUseCases {
    createBankTransferProfile:   CreateBankTransferProfileUseCase;
    listBankTransferProfiles:    ListBankTransferProfilesUseCase;
    updateBankTransferProfile:   UpdateBankTransferProfileUseCase;
    activateBankTransferProfile: ActivateBankTransferProfileUseCase;
    deleteBankTransferProfile:   DeleteBankTransferProfileUseCase;
}

const bodySchemaCreate = bodySchema({
    code:     field.string,
    bankName: field.string,
});

/** Cột do client gửi lên — chỉ nhận đúng `source` có trong hợp đồng. */
function parseColumns(raw: unknown, required: boolean): BankTransferColumn[] | undefined {
    if (raw == undefined) {
        if (required) throw new BadRequestError("columns is required");
        return undefined;
    }
    if (!Array.isArray(raw)) throw new BadRequestError("columns must be an array");

    return raw.map((item, index) => {
        const row = item as Record<string, unknown>;
        if (typeof row.header !== "string") throw new BadRequestError(`columns[${index}].header must be a string`);
        if (typeof row.source !== "string" || !(BANK_COLUMN_SOURCES as readonly string[]).includes(row.source)) {
            throw new BadRequestError(`columns[${index}].source must be one of: ${BANK_COLUMN_SOURCES.join(", ")}`);
        }
        return {
            header:      row.header,
            source:      row.source as BankColumnSource,
            staticValue: typeof row.staticValue === "string" ? row.staticValue : null,
        };
    });
}

function parseDelimiter(raw: unknown): BankDelimiter | undefined {
    if (raw == undefined) return undefined;
    if (typeof raw !== "string" || !(BANK_DELIMITERS as readonly string[]).includes(raw)) {
        throw new BadRequestError("delimiter must be one of: , ; \\t |");
    }
    return raw as BankDelimiter;
}

function parseAmountFormat(raw: unknown): BankAmountFormat | undefined {
    if (raw == undefined) return undefined;
    if (typeof raw !== "string" || !(BANK_AMOUNT_FORMATS as readonly string[]).includes(raw)) {
        throw new BadRequestError(`amountFormat must be one of: ${BANK_AMOUNT_FORMATS.join(", ")}`);
    }
    return raw as BankAmountFormat;
}

function parseOptionalBoolean(raw: unknown): boolean | undefined {
    return typeof raw === "boolean" ? raw : undefined;
}

/**
 * Các trường tuỳ chọn dùng chung cho create/update.
 *
 * Bỏ hẳn key khi client không gửi (không set `undefined`): `exactOptionalPropertyTypes`
 * phân biệt "không gửi" với "gửi undefined", và use-case dựa vào đó để biết cái gì
 * cần giữ nguyên.
 */
function optionalFields(raw: Record<string, unknown>) {
    const delimiter    = parseDelimiter(raw.delimiter);
    const amountFormat = parseAmountFormat(raw.amountFormat);
    const includeHeader = parseOptionalBoolean(raw.includeHeader);
    const utf8Bom       = parseOptionalBoolean(raw.utf8Bom);

    return {
        ...(typeof raw.description === "string" ? { description: raw.description } : {}),
        ...(delimiter != undefined ? { delimiter } : {}),
        ...(amountFormat != undefined ? { amountFormat } : {}),
        ...(includeHeader != undefined ? { includeHeader } : {}),
        ...(utf8Bom != undefined ? { utf8Bom } : {}),
        ...(typeof raw.dateFormat === "string" ? { dateFormat: raw.dateFormat } : {}),
    };
}

/** Controller nhóm endpoint mẫu file chuyển lương (cấu hình ngân hàng). */
export default class BankTransferProfileController {
    public constructor(
        private readonly _useCases: BankTransferProfileControllerUseCases,
    ) {}

    public createBankTransferProfile = async (req: Request, res: Response): Promise<void> => {
        const body = bodySchemaCreate.parse(req.body);
        const raw = req.body as Record<string, unknown>;

        const profile = await this._useCases.createBankTransferProfile.execute({
            ...body,
            columns: parseColumns(raw.columns, true) ?? [],
            ...optionalFields(raw),
            actorUserId: ActorContext.get(res),
        });

        res.status(201).json(BankTransferProfilePresenter.toDTO(profile));
    };

    public listBankTransferProfiles = async (_req: Request, res: Response): Promise<void> => {
        const profiles = await this._useCases.listBankTransferProfiles.execute();
        res.status(200).json({ bankProfiles: profiles.map(BankTransferProfilePresenter.toDTO) });
    };

    public updateBankTransferProfile = async (req: Request<{ profileId: string }>, res: Response): Promise<void> => {
        const raw = req.body as Record<string, unknown>;
        const columns = parseColumns(raw.columns, false);

        const profile = await this._useCases.updateBankTransferProfile.execute({
            profileId: req.params.profileId,
            ...(typeof raw.bankName === "string" ? { bankName: raw.bankName } : {}),
            ...(columns != undefined ? { columns } : {}),
            ...optionalFields(raw),
            actorUserId: ActorContext.get(res),
        });

        res.status(200).json(BankTransferProfilePresenter.toDTO(profile));
    };

    public activateBankTransferProfile = async (req: Request<{ profileId: string }>, res: Response): Promise<void> => {
        const profile = await this._useCases.activateBankTransferProfile.execute({
            profileId: req.params.profileId, actorUserId: ActorContext.get(res),
        });
        res.status(200).json(BankTransferProfilePresenter.toDTO(profile));
    };

    public deleteBankTransferProfile = async (req: Request<{ profileId: string }>, res: Response): Promise<void> => {
        await this._useCases.deleteBankTransferProfile.execute({
            profileId: req.params.profileId, actorUserId: ActorContext.get(res),
        });
        res.status(200).end();
    };
}
