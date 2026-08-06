import BankTransferProfileRepo from "@modules/setting/core/app/ports/BankTransferProfileRepo";
import BankTransferProfile from "@modules/setting/core/domain/entities/BankTransferProfile";

/** Danh sách mẫu file chuyển lương. Chỉ đọc cấu hình, không chứa dữ liệu lương. */
export default class ListBankTransferProfilesUseCase {
    public constructor(
        private readonly _profiles: BankTransferProfileRepo,
    ) {}

    public async execute(): Promise<BankTransferProfile[]> {
        return this._profiles.list();
    }
}
