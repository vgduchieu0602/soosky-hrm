import AuthSessionPresenter from "@modules/auth/adapters/driver/http/presenters/AuthSessionPresenter";
import LoginUseCase from "@modules/auth/core/app/use-cases/session/LoginUseCase";
import LogoutUseCase from "@modules/auth/core/app/use-cases/session/LogoutUseCase";
import RefreshSessionUseCase from "@modules/auth/core/app/use-cases/session/RefreshSessionUseCase";
import { bodySchema, field } from "@shared/adapters/driver/http/validation";
import { Request, Response } from "express";

export interface SessionControllerUseCases {
    login:          LoginUseCase;
    logout:         LogoutUseCase;
    refreshSession: RefreshSessionUseCase;
}

const bodySchemaLogin = bodySchema({
    email:    field.string,
    password: field.string,
});

const bodySchemaRefreshToken = bodySchema({
    refreshToken: field.string,
});

/**
 * Controller cho nhóm endpoint Session (docs/api.html § Session): parse
 * request, gọi use-case tương ứng rồi ghi response — không chứa nghiệp vụ.
 *
 * Handler khai báo dạng arrow property để giữ `this` khi được truyền rời
 * instance vào danh sách route của `createAuthHttpRouter`.
 */
export default class SessionController {
    public constructor(
        private readonly _useCases: SessionControllerUseCases,
    ) {}

    public login = async (req: Request, res: Response): Promise<void> => {
        const tokens = await this._useCases.login.execute(bodySchemaLogin.parse(req.body));
        res.status(200).json(AuthSessionPresenter.toDTO(tokens));
    };

    public refreshSession = async (req: Request, res: Response): Promise<void> => {
        const tokens = await this._useCases.refreshSession.execute(bodySchemaRefreshToken.parse(req.body));
        res.status(200).json(AuthSessionPresenter.toDTO(tokens));
    };

    public logout = async (req: Request, res: Response): Promise<void> => {
        await this._useCases.logout.execute(bodySchemaRefreshToken.parse(req.body));
        res.status(204).end();
    };
}
