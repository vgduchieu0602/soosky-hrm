import BankTransferProfileCodeConflictError from "@modules/setting/core/app/errors/BankTransferProfileCodeConflictError";
import BankTransferProfileRepo from "@modules/setting/core/app/ports/BankTransferProfileRepo";
import PermissionChecker from "@modules/setting/core/app/ports/PermissionChecker";
import BankTransferProfile, { BankAmountFormat, BankDelimiter, BankTransferColumn } from "@modules/setting/core/domain/entities/BankTransferProfile";
import createUuidV7 from "@shared/core/domain/UuidV7";

const PERMISSION_KEY = "setting:manage";

export interface CreateBankTransferProfileInput {
    code:           string;
    bankName:       string;
    description?:   string | null;
    delimiter?:     BankDelimiter;
    includeHeader?: boolean;
    utf8Bom?:       boolean;
    amountFormat?:  BankAmountFormat;
    dateFormat?:    string;
    columns:        BankTransferColumn[];
    actorUserId:    string;
}

/**
 * Tạo mẫu file chuyển lương cho một ngân hàng. Hồ sơ mới KHÔNG tự bật — bật là
 * một hành động riêng để không âm thầm đổi ngân hàng nhận file.
 *
 * @throws {AccessDeniedError}                       Actor không có quyền `setting:manage`.
 * @throws {BankTransferProfileCodeConflictError}    Mã hồ sơ đã tồn tại.
 * @throws {BankTransferProfileInvalidError}         Cột/định dạng không hợp lệ.
 */
export default class CreateBankTransferProfileUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _profiles: BankTransferProfileRepo,
    ) {}

    public async execute(input: CreateBankTransferProfileInput): Promise<BankTransferProfile> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const code = input.code.trim().toUpperCase();
        if (await this._profiles.findByCode(code) != undefined) {
            throw new BankTransferProfileCodeConflictError(code);
        }

        const profile = BankTransferProfile.create({
            id:            createUuidV7(),
            code,
            bankName:      input.bankName,
            description:   input.description ?? null,
            delimiter:     input.delimiter ?? ",",
            includeHeader: input.includeHeader ?? true,
            utf8Bom:       input.utf8Bom ?? true,
            amountFormat:  input.amountFormat ?? "plain",
            dateFormat:    input.dateFormat ?? "dd/MM/yyyy",
            columns:       input.columns,
        });

        await this._profiles.save(profile);
        return profile;
    }
}
