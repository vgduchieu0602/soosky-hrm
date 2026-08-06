import PayrollVariancePresenter from "@modules/payroll/adapters/driver/http/presenters/PayrollVariancePresenter";
import ListPayrollVariancesUseCase from "@modules/payroll/core/app/use-cases/reconciliation/ListPayrollVariancesUseCase";
import ReconcilePayrollPeriodUseCase from "@modules/payroll/core/app/use-cases/reconciliation/ReconcilePayrollPeriodUseCase";
import SignPayrollVarianceUseCase from "@modules/payroll/core/app/use-cases/reconciliation/SignPayrollVarianceUseCase";
import ActorContext from "@shared/adapters/driver/http/ActorContext";
import { bodySchema, field } from "@shared/adapters/driver/http/validation";
import { Request, Response } from "express";

export interface ReconciliationControllerUseCases {
    reconcilePayrollPeriod: ReconcilePayrollPeriodUseCase;
    listPayrollVariances:   ListPayrollVariancesUseCase;
    signPayrollVariance:    SignPayrollVarianceUseCase;
}

const bodySchemaSign = bodySchema({
    explanation: field.string,
});

/** Controller nhóm endpoint đối soát song song hai phiên bản công thức lương. */
export default class ReconciliationController {
    public constructor(
        private readonly _useCases: ReconciliationControllerUseCases,
    ) {}

    public runReconciliation = async (req: Request<{ periodId: string }>, res: Response): Promise<void> => {
        const result = await this._useCases.reconcilePayrollPeriod.execute({
            periodId: req.params.periodId, actorUserId: ActorContext.get(res),
        });
        res.status(200).json(result);
    };

    public listReconciliation = async (req: Request<{ periodId: string }>, res: Response): Promise<void> => {
        const variances = await this._useCases.listPayrollVariances.execute({ periodId: req.params.periodId });
        res.status(200).json({
            variances:     variances.map(PayrollVariancePresenter.toDTO),
            unsignedCount: variances.filter(variance => !variance.isSigned).length,
        });
    };

    public signVariance = async (req: Request<{ periodId: string; employeeId: string }>, res: Response): Promise<void> => {
        const body = bodySchemaSign.parse(req.body);
        const variance = await this._useCases.signPayrollVariance.execute({
            periodId:    req.params.periodId,
            employeeId:  req.params.employeeId,
            explanation: body.explanation,
            actorUserId: ActorContext.get(res),
        });
        res.status(200).json(PayrollVariancePresenter.toDTO(variance));
    };
}
