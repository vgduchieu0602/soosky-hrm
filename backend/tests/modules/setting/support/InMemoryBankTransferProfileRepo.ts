import BankTransferProfileRepo from "@modules/setting/core/app/ports/BankTransferProfileRepo";
import BankTransferProfile from "@modules/setting/core/domain/entities/BankTransferProfile";

/** Repo mẫu file chuyển lương trong bộ nhớ. */
export default class InMemoryBankTransferProfileRepo implements BankTransferProfileRepo {
    private readonly _store = new Map<string, BankTransferProfile>();

    async getById(id: string): Promise<BankTransferProfile | undefined> {
        return this._store.get(id);
    }

    async findByCode(code: string): Promise<BankTransferProfile | undefined> {
        return [...this._store.values()].find(row => row.code === code);
    }

    async list(): Promise<BankTransferProfile[]> {
        return [...this._store.values()];
    }

    async findActive(): Promise<BankTransferProfile | undefined> {
        return [...this._store.values()].find(row => row.isActive);
    }

    async save(profile: BankTransferProfile): Promise<void> {
        this._store.set(profile.id, profile);
    }

    async deleteById(id: string): Promise<void> {
        this._store.delete(id);
    }
}
