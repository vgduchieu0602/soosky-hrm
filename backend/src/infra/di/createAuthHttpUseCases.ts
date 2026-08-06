import { MongoAccountRepo, MongoRefreshTokenStore, MongoUnitOfWork, MongoVerificationTokenStore } from "@modules/auth/adapters/driven/persistence/mongodb";
import ScryptPasswordHasher from "@modules/auth/adapters/driven/security/ScryptPasswordHasher";
import CryptoRandomSecretGenerator from "@modules/auth/adapters/driven/security/CryptoRandomSecretGenerator";
import AccessTokenIssuer from "@modules/auth/core/app/ports/AccessTokenIssuer";
import VerificationMailer from "@modules/auth/core/app/ports/VerificationMailer";
import ChangeAccountRoleUseCase from "@modules/auth/core/app/use-cases/account/ChangeAccountRoleUseCase";
import ChangePasswordUseCase from "@modules/auth/core/app/use-cases/account/ChangePasswordUseCase";
import DeactivateAccountUseCase from "@modules/auth/core/app/use-cases/account/DeactivateAccountUseCase";
import DeletePendingAccountUseCase from "@modules/auth/core/app/use-cases/account/DeletePendingAccountUseCase";
import GetMyAccountUseCase from "@modules/auth/core/app/use-cases/account/GetMyAccountUseCase";
import ListAccountsUseCase from "@modules/auth/core/app/use-cases/account/ListAccountsUseCase";
import ReactivateAccountUseCase from "@modules/auth/core/app/use-cases/account/ReactivateAccountUseCase";
import RegisterMemberAccountUseCase from "@modules/auth/core/app/use-cases/account/RegisterMemberAccountUseCase";
import UpdateProfileUseCase from "@modules/auth/core/app/use-cases/account/UpdateProfileUseCase";
import VerifyAccountUseCase from "@modules/auth/core/app/use-cases/account/VerifyAccountUseCase";
import LoginUseCase from "@modules/auth/core/app/use-cases/session/LoginUseCase";
import LogoutUseCase from "@modules/auth/core/app/use-cases/session/LogoutUseCase";
import RefreshSessionUseCase from "@modules/auth/core/app/use-cases/session/RefreshSessionUseCase";
import { AuthHttpUseCases } from "@modules/auth";
import EventBus from "@shared/core/domain/EventBus";
import { Db as MongoDb, MongoClient } from "mongodb";

/**
 * Lắp ráp toàn bộ use-case mà driver adapter HTTP của module Auth cần
 * (`AuthHttpUseCases`), trên các adapter MongoDB + scrypt.
 *
 * Issuer access token và mailer nhận từ ngoài — composition root chọn hiện
 * thực theo cấu hình (JWT/dev, SMTP), factory này chỉ lo nối dây. Index của
 * các collection do bước `ensureMongoIndexes` lúc khởi động đảm nhiệm.
 *
 * Lưu ý: các use-case bọc MongoUnitOfWork (register, verify, change password)
 * cần MongoDB dạng replica set khi chạy thật.
 */
export default function createAuthHttpUseCases(
    mongoClient: MongoClient,
    mongoDb: MongoDb,
    eventBus: EventBus,
    accessTokenIssuer: AccessTokenIssuer,
    verificationMailer: VerificationMailer,
): AuthHttpUseCases {
    const uow                    = new MongoUnitOfWork(mongoClient, mongoDb);
    const accountRepo            = new MongoAccountRepo(mongoDb);
    const refreshTokenStore      = new MongoRefreshTokenStore(mongoDb);
    const verificationTokenStore = new MongoVerificationTokenStore(mongoDb);
    const passwordHasher         = new ScryptPasswordHasher();
    const secretGenerator        = new CryptoRandomSecretGenerator();

    return {
        // Account + Account Lifecycle
        changeAccountRole:     new ChangeAccountRoleUseCase(accountRepo, eventBus),
        changePassword:        new ChangePasswordUseCase(uow, passwordHasher),
        deactivateAccount:     new DeactivateAccountUseCase(accountRepo, eventBus, refreshTokenStore),
        deletePendingAccount:  new DeletePendingAccountUseCase(accountRepo, verificationTokenStore),
        getMyAccount:          new GetMyAccountUseCase(accountRepo),
        listAccounts:          new ListAccountsUseCase(accountRepo),
        reactivateAccount:     new ReactivateAccountUseCase(accountRepo, eventBus),
        registerMemberAccount: new RegisterMemberAccountUseCase(uow, passwordHasher, verificationMailer, secretGenerator),
        updateProfile:         new UpdateProfileUseCase(accountRepo, eventBus),
        verifyAccount:         new VerifyAccountUseCase(uow, eventBus),

        // Session
        login:          new LoginUseCase(accessTokenIssuer, accountRepo, passwordHasher, refreshTokenStore),
        logout:         new LogoutUseCase(refreshTokenStore),
        refreshSession: new RefreshSessionUseCase(accessTokenIssuer, accountRepo, refreshTokenStore),
    };
}
