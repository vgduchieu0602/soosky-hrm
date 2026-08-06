import BankTransferProfile from "@modules/setting/core/domain/entities/BankTransferProfile";

export default interface BankTransferProfileRepo {
    getById(id: string): Promise<BankTransferProfile | undefined>;
    findByCode(code: string): Promise<BankTransferProfile | undefined>;
    list(): Promise<BankTransferProfile[]>;
    /** Hồ sơ đang bật, hoặc `undefined` khi chưa cấu hình ngân hàng nào. */
    findActive(): Promise<BankTransferProfile | undefined>;
    save(profile: BankTransferProfile): Promise<void>;
    deleteById(id: string): Promise<void>;
}
