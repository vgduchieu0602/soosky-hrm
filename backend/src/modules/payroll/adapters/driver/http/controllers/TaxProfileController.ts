import TaxProfilePresenter from "@modules/payroll/adapters/driver/http/presenters/TaxProfilePresenter";
import ListTaxProfilesByEmployeeUseCase from "@modules/payroll/core/app/use-cases/compensation/ListTaxProfilesByEmployeeUseCase";
import UpsertTaxProfileUseCase from "@modules/payroll/core/app/use-cases/compensation/UpsertTaxProfileUseCase";
import ActorContext from "@shared/adapters/driver/http/ActorContext";
import { bodySchema, field } from "@shared/adapters/driver/http/validation";
import { Request, Response } from "express";

export interface TaxProfileControllerUseCases {
    upsertTaxProfile: UpsertTaxProfileUseCase;
    listTaxProfilesByEmployee: ListTaxProfilesByEmployeeUseCase;
}

const bodySchemaUpsert = bodySchema({
    employeeId:    field.string,
    effectiveDate: field.date,
    endDate:       field.optionalDate,
});

function parseOptionalBoolean(raw: unknown): boolean | undefined {
    return typeof raw === "boolean" ? raw : undefined;
}

function parseOptionalNumber(raw: unknown): number | undefined {
    return typeof raw === "number" && Number.isFinite(raw) ? raw : undefined;
}

/** Controller nhóm endpoint TaxProfile (hồ sơ thuế nhân viên). */
export default class TaxProfileController {
    public constructor(
        private readonly _useCases: TaxProfileControllerUseCases,
    ) {}

    public upsertTaxProfile = async (req: Request, res: Response): Promise<void> => {
        const body = bodySchemaUpsert.parse(req.body);
        const raw = req.body as Record<string, unknown>;
        const isResident = parseOptionalBoolean(raw.isResident);
        const dependentsCount = parseOptionalNumber(raw.dependentsCount);
        const insuranceAmount = parseOptionalNumber(raw.insuranceAmount);
        const taxProfile = await this._useCases.upsertTaxProfile.execute({
            ...body,
            ...(isResident != undefined ? { isResident } : {}),
            ...(dependentsCount != undefined ? { dependentsCount } : {}),
            ...(insuranceAmount != undefined ? { insuranceAmount } : {}),
            actorUserId: ActorContext.get(res),
        });
        res.status(201).json(TaxProfilePresenter.toDTO(taxProfile));
    };

    public listTaxProfilesByEmployee = async (req: Request<{ employeeId: string }>, res: Response): Promise<void> => {
        const taxProfiles = await this._useCases.listTaxProfilesByEmployee.execute({ employeeId: req.params.employeeId });
        res.status(200).json({ taxProfiles: taxProfiles.map(TaxProfilePresenter.toDTO) });
    };
}
