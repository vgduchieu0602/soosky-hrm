import CompanyProfilePresenter from "@modules/setting/adapters/driver/http/presenters/CompanyProfilePresenter";
import GetCompanyProfileUseCase from "@modules/setting/core/app/use-cases/company/GetCompanyProfileUseCase";
import UpsertCompanyProfileUseCase from "@modules/setting/core/app/use-cases/company/UpsertCompanyProfileUseCase";
import ActorContext from "@shared/adapters/driver/http/ActorContext";
import { bodySchema, field } from "@shared/adapters/driver/http/validation";
import { Request, Response } from "express";

export interface CompanyProfileControllerUseCases {
    getCompanyProfile:    GetCompanyProfileUseCase;
    upsertCompanyProfile: UpsertCompanyProfileUseCase;
}

const bodySchemaUpsertCompanyProfile = bodySchema({
    name:                      field.string,
    address:                   field.optionalString,
    taxCode:                   field.optionalString,
    phone:                     field.optionalString,
    email:                     field.optionalString,
    logoUrl:                   field.optionalString,
    timezone:                  field.optionalString,
    currency:                  field.optionalString,
    standardWorkHoursPerDay:   field.optionalNumber,
    standardWorkDaysPerMonth:  field.optionalNumber,
});

/**
 * Controller nhóm endpoint hồ sơ công ty (singleton): parse request, gọi
 * use-case, ghi response — không chứa nghiệp vụ.
 */
export default class CompanyProfileController {
    public constructor(
        private readonly _useCases: CompanyProfileControllerUseCases,
    ) {}

    public getCompanyProfile = async (_req: Request, res: Response): Promise<void> => {
        const profile = await this._useCases.getCompanyProfile.execute();
        res.status(200).json(CompanyProfilePresenter.toDTO(profile));
    };

    public upsertCompanyProfile = async (req: Request, res: Response): Promise<void> => {
        await this._useCases.upsertCompanyProfile.execute({
            ...bodySchemaUpsertCompanyProfile.parse(req.body),
            actorUserId: ActorContext.get(res),
        });
        res.status(200).end();
    };
}
