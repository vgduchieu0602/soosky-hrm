import SalaryPolicyPresenter from "@modules/payroll/adapters/driver/http/presenters/SalaryPolicyPresenter";
import CreateSalaryPolicyUseCase from "@modules/payroll/core/app/use-cases/compensation/CreateSalaryPolicyUseCase";
import ListSalaryPoliciesUseCase from "@modules/payroll/core/app/use-cases/compensation/ListSalaryPoliciesUseCase";
import ActorContext from "@shared/adapters/driver/http/ActorContext";
import { bodySchema, field } from "@shared/adapters/driver/http/validation";
import { Request, Response } from "express";

export interface SalaryPolicyControllerUseCases {
    createSalaryPolicy: CreateSalaryPolicyUseCase;
    listSalaryPolicies: ListSalaryPoliciesUseCase;
}

const bodySchemaCreate = bodySchema({
    effectiveFrom:         field.date,
    baseSalaryReference:   field.number,
    regionalMinWage:       field.number,
    socialInsuranceSalary: field.number,
});

function parseOptionalBoolean(raw: unknown): boolean | undefined {
    return typeof raw === "boolean" ? raw : undefined;
}

function parseOptionalNumber(raw: unknown): number | undefined {
    return typeof raw === "number" && Number.isFinite(raw) ? raw : undefined;
}

/** Controller nhóm endpoint SalaryPolicy (chính sách lương). */
export default class SalaryPolicyController {
    public constructor(
        private readonly _useCases: SalaryPolicyControllerUseCases,
    ) {}

    public createSalaryPolicy = async (req: Request, res: Response): Promise<void> => {
        const body = bodySchemaCreate.parse(req.body);
        const raw = req.body as Record<string, unknown>;
        const unionFeeRate = parseOptionalNumber(raw.unionFeeRate);
        const unionFeeEnabled = parseOptionalBoolean(raw.unionFeeEnabled);
        const taxEnabled = parseOptionalBoolean(raw.taxEnabled);
        const probationPayRate = parseOptionalNumber(raw.probationPayRate);
        const prorateByAttendance = parseOptionalBoolean(raw.prorateByAttendance);
        const policy = await this._useCases.createSalaryPolicy.execute({
            ...body,
            ...(unionFeeRate != undefined ? { unionFeeRate } : {}),
            ...(unionFeeEnabled != undefined ? { unionFeeEnabled } : {}),
            ...(taxEnabled != undefined ? { taxEnabled } : {}),
            ...(probationPayRate != undefined ? { probationPayRate } : {}),
            ...(prorateByAttendance != undefined ? { prorateByAttendance } : {}),
            actorUserId: ActorContext.get(res),
        });
        res.status(201).json(SalaryPolicyPresenter.toDTO(policy));
    };

    public listSalaryPolicies = async (_req: Request, res: Response): Promise<void> => {
        const policies = await this._useCases.listSalaryPolicies.execute();
        res.status(200).json({ policies: policies.map(SalaryPolicyPresenter.toDTO) });
    };
}
