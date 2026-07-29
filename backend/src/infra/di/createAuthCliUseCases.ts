import MongoAccountRepo from "@modules/auth/adapters/driven/persistence/mongodb/repositories/MongoAccountRepo";
import ScryptPasswordHasher from "@modules/auth/adapters/driven/security/ScryptPasswordHasher";
import RegisterSuperAdminAccountUseCase from "@modules/auth/core/app/use-cases/account/RegisterSuperAdminAccountUseCase";
import { AuthCliUseCases } from "@modules/auth";
import EventBus from "@shared/core/domain/EventBus";
import { Db as MongoDb } from "mongodb";

/**
 * Lắp ráp bộ use-case mà driver adapter CLI của module Auth cần — tách khỏi
 * bộ use-case HTTP vì CLI chạy tiến trình riêng và chỉ phục vụ thao tác
 * vận hành. Index của các collection do bước `ensureMongoIndexes` lúc khởi
 * động đảm nhiệm — composition root của CLI phải gọi trước khi chạy lệnh.
 */
export default function createAuthCliUseCases(mongoDb: MongoDb, eventBus: EventBus): AuthCliUseCases {
    const accountRepo    = new MongoAccountRepo(mongoDb);
    const passwordHasher = new ScryptPasswordHasher();

    return {
        registerSuperAdminAccount: new RegisterSuperAdminAccountUseCase(accountRepo, passwordHasher, eventBus),
    };
}
