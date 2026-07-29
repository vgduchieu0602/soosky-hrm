import AccountPresenter from "@modules/auth/adapters/driver/http/presenters/AccountPresenter";
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
import { AccountStatus } from "@modules/auth/core/domain/entities/Account";
import ActorContext from "@shared/adapters/driver/http/ActorContext";
import { bodySchema, field, optionalQueryEnum } from "@shared/adapters/driver/http/validation";
import { Request, Response } from "express";

export interface AccountControllerUseCases {
    changeAccountRole:     ChangeAccountRoleUseCase;
    changePassword:        ChangePasswordUseCase;
    deactivateAccount:     DeactivateAccountUseCase;
    deletePendingAccount:  DeletePendingAccountUseCase;
    getMyAccount:          GetMyAccountUseCase;
    listAccounts:          ListAccountsUseCase;
    reactivateAccount:     ReactivateAccountUseCase;
    registerMemberAccount: RegisterMemberAccountUseCase;
    updateProfile:         UpdateProfileUseCase;
    verifyAccount:         VerifyAccountUseCase;
}

const bodySchemaRegister = bodySchema({
    email:    field.string,
    fullName: field.string,
});

const bodySchemaVerification = bodySchema({
    token: field.string,
});

const bodySchemaProfile = bodySchema({
    fullName: field.string,
});

const bodySchemaChangePassword = bodySchema({
    currentPassword: field.string,
    newPassword:     field.string,
});

const bodySchemaChangeRole = bodySchema({
    role: field.string,
});

/**
 * Controller cho nhóm endpoint Account (docs/api.html § Account, § Account
 * Lifecycle): parse request, gọi use-case tương ứng rồi ghi response — không
 * chứa nghiệp vụ.
 *
 * Handler khai báo dạng arrow property để giữ `this` khi được truyền rời
 * instance vào danh sách route của `createAuthHttpRouter`.
 */
export default class AccountController {
    public constructor(
        private readonly _useCases: AccountControllerUseCases,
    ) {}

    public registerMemberAccount = async (req: Request, res: Response): Promise<void> => {
        const account = await this._useCases.registerMemberAccount.execute({
            ...bodySchemaRegister.parse(req.body),
            actorAccountId: ActorContext.get(res),
        });
        res.status(201).json({ accountId: account.id });
    };

    public verifyAccount = async (req: Request, res: Response): Promise<void> => {
        const account = await this._useCases.verifyAccount.execute(bodySchemaVerification.parse(req.body));
        res.status(200).json({ status: account.status });
    };

    public getMyAccount = async (_req: Request, res: Response): Promise<void> => {
        const account = await this._useCases.getMyAccount.execute({
            actorAccountId: ActorContext.get(res),
        });
        res.status(200).json({ account: AccountPresenter.toDTO(account) });
    };

    public listAccounts = async (req: Request, res: Response): Promise<void> => {
        const status = optionalQueryEnum(
            req.query.status,
            "status",
            Object.values(AccountStatus) as AccountStatus[],
        );
        const accounts = await this._useCases.listAccounts.execute({
            actorAccountId: ActorContext.get(res),
            ...(status !== undefined ? { status } : {}),
        });
        res.status(200).json({
            accounts: accounts.map(account => AccountPresenter.toDTO(account)),
        });
    };

    public updateProfile = async (req: Request, res: Response): Promise<void> => {
        await this._useCases.updateProfile.execute({
            ...bodySchemaProfile.parse(req.body),
            accountId: ActorContext.get(res),
        });
        res.status(200).end();
    };

    public changePassword = async (req: Request, res: Response): Promise<void> => {
        await this._useCases.changePassword.execute({
            ...bodySchemaChangePassword.parse(req.body),
            accountId: ActorContext.get(res),
        });
        res.status(200).end();
    };

    public changeAccountRole = async (req: Request<{ accountId: string }>, res: Response): Promise<void> => {
        const account = await this._useCases.changeAccountRole.execute({
            ...bodySchemaChangeRole.parse(req.body),
            accountId:      req.params.accountId,
            actorAccountId: ActorContext.get(res),
        });
        res.status(200).json({ role: account.role.value });
    };

    public deactivateAccount = async (req: Request<{ accountId: string }>, res: Response): Promise<void> => {
        const account = await this._useCases.deactivateAccount.execute({
            accountId:      req.params.accountId,
            actorAccountId: ActorContext.get(res),
        });
        res.status(200).json({ status: account.status });
    };

    public deletePendingAccount = async (req: Request<{ accountId: string }>, res: Response): Promise<void> => {
        await this._useCases.deletePendingAccount.execute({
            accountId:      req.params.accountId,
            actorAccountId: ActorContext.get(res),
        });
        res.status(204).end();
    };

    public reactivateAccount = async (req: Request<{ accountId: string }>, res: Response): Promise<void> => {
        // docs/api.html dành endpoint này cho admin/support; chưa có role
        // system nên tạm chỉ yêu cầu đã xác thực.
        const account = await this._useCases.reactivateAccount.execute({
            accountId: req.params.accountId,
        });
        res.status(200).json({ status: account.status });
    };
}
