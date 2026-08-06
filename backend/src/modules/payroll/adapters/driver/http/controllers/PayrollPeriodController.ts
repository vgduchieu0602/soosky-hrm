import PayrollPeriodPresenter from "@modules/payroll/adapters/driver/http/presenters/PayrollPeriodPresenter";
import AttendanceReadinessUseCase from "@modules/payroll/core/app/use-cases/period/AttendanceReadinessUseCase";
import ClosePayrollPeriodUseCase from "@modules/payroll/core/app/use-cases/period/ClosePayrollPeriodUseCase";
import CreatePayrollPeriodUseCase from "@modules/payroll/core/app/use-cases/period/CreatePayrollPeriodUseCase";
import DeletePayrollPeriodUseCase from "@modules/payroll/core/app/use-cases/period/DeletePayrollPeriodUseCase";
import EvaluationReadinessUseCase from "@modules/payroll/core/app/use-cases/period/EvaluationReadinessUseCase";
import GetPayrollPeriodUseCase from "@modules/payroll/core/app/use-cases/period/GetPayrollPeriodUseCase";
import ListPayrollPeriodsUseCase from "@modules/payroll/core/app/use-cases/period/ListPayrollPeriodsUseCase";
import LockAttendanceUseCase from "@modules/payroll/core/app/use-cases/period/LockAttendanceUseCase";
import LockEvaluationsUseCase from "@modules/payroll/core/app/use-cases/period/LockEvaluationsUseCase";
import ReopenPayrollPeriodUseCase from "@modules/payroll/core/app/use-cases/period/ReopenPayrollPeriodUseCase";
import UnlockAttendanceUseCase from "@modules/payroll/core/app/use-cases/period/UnlockAttendanceUseCase";
import MarkPayrollHrReviewedUseCase from "@modules/payroll/core/app/use-cases/period/MarkPayrollHrReviewedUseCase";
import UnlockEvaluationsUseCase from "@modules/payroll/core/app/use-cases/period/UnlockEvaluationsUseCase";
import UpdatePayrollPeriodUseCase from "@modules/payroll/core/app/use-cases/period/UpdatePayrollPeriodUseCase";
import RunPayrollForEmployeeUseCase from "@modules/payroll/core/app/use-cases/payroll/RunPayrollForEmployeeUseCase";
import RunPayrollForPeriodUseCase from "@modules/payroll/core/app/use-cases/payroll/RunPayrollForPeriodUseCase";
import ActorContext from "@shared/adapters/driver/http/ActorContext";
import { bodySchema, field } from "@shared/adapters/driver/http/validation";
import { Request, Response } from "express";

export interface PayrollPeriodControllerUseCases {
    createPayrollPeriod:  CreatePayrollPeriodUseCase;
    updatePayrollPeriod:  UpdatePayrollPeriodUseCase;
    getPayrollPeriod:     GetPayrollPeriodUseCase;
    listPayrollPeriods:   ListPayrollPeriodsUseCase;
    closePayrollPeriod:   ClosePayrollPeriodUseCase;
    reopenPayrollPeriod:  ReopenPayrollPeriodUseCase;
    deletePayrollPeriod:  DeletePayrollPeriodUseCase;
    attendanceReadiness:  AttendanceReadinessUseCase;
    lockAttendance:       LockAttendanceUseCase;
    unlockAttendance:     UnlockAttendanceUseCase;
    evaluationReadiness:  EvaluationReadinessUseCase;
    lockEvaluations:      LockEvaluationsUseCase;
    unlockEvaluations:    UnlockEvaluationsUseCase;
    markPayrollHrReviewed: MarkPayrollHrReviewedUseCase;
    runPayrollForPeriod:   RunPayrollForPeriodUseCase;
    runPayrollForEmployee: RunPayrollForEmployeeUseCase;
}

const bodySchemaCreatePeriod = bodySchema({
    name:      field.string,
    startDate: field.date,
    endDate:   field.date,
    payDate:   field.date,
});

// Mở khoá chấm công BẮT BUỘC nêu lý do — giá trị này đi vào nhật ký audit.
const bodySchemaUnlockAttendance = bodySchema({
    reason: field.string,
});

const bodySchemaUpdatePeriod = bodySchema({
    endDate: field.optionalDate,
    payDate: field.optionalDate,
});

function parseStandardWorkDays(raw: unknown): number | undefined {
    return typeof raw === "number" && Number.isFinite(raw) ? raw : undefined;
}

/** Controller nhóm endpoint PayrollPeriod (kỳ lương): CRUD + vòng đời chốt/chạy lương. */
export default class PayrollPeriodController {
    public constructor(
        private readonly _useCases: PayrollPeriodControllerUseCases,
    ) {}

    public createPeriod = async (req: Request, res: Response): Promise<void> => {
        const body = bodySchemaCreatePeriod.parse(req.body);
        const standardWorkDays = parseStandardWorkDays((req.body as Record<string, unknown>)?.standardWorkDays) ?? 22;
        const output = await this._useCases.createPayrollPeriod.execute({
            ...body, standardWorkDays, actorUserId: ActorContext.get(res),
        });
        res.status(201).json(output);
    };

    public updatePeriod = async (req: Request<{ periodId: string }>, res: Response): Promise<void> => {
        const body = bodySchemaUpdatePeriod.parse(req.body);
        const standardWorkDays = parseStandardWorkDays((req.body as Record<string, unknown>)?.standardWorkDays);
        await this._useCases.updatePayrollPeriod.execute({
            ...body,
            ...(standardWorkDays != undefined ? { standardWorkDays } : {}),
            periodId: req.params.periodId,
            actorUserId: ActorContext.get(res),
        });
        res.status(200).end();
    };

    public getPeriod = async (req: Request<{ periodId: string }>, res: Response): Promise<void> => {
        const period = await this._useCases.getPayrollPeriod.execute({ periodId: req.params.periodId });
        res.status(200).json(PayrollPeriodPresenter.toDTO(period));
    };

    public listPeriods = async (_req: Request, res: Response): Promise<void> => {
        const periods = await this._useCases.listPayrollPeriods.execute();
        res.status(200).json({ periods: periods.map(PayrollPeriodPresenter.toDTO) });
    };

    public closePeriod = async (req: Request<{ periodId: string }>, res: Response): Promise<void> => {
        const period = await this._useCases.closePayrollPeriod.execute({ periodId: req.params.periodId, actorUserId: ActorContext.get(res) });
        res.status(200).json(PayrollPeriodPresenter.toDTO(period));
    };

    public reopenPeriod = async (req: Request<{ periodId: string }>, res: Response): Promise<void> => {
        const period = await this._useCases.reopenPayrollPeriod.execute({ periodId: req.params.periodId, actorUserId: ActorContext.get(res) });
        res.status(200).json(PayrollPeriodPresenter.toDTO(period));
    };

    public deletePeriod = async (req: Request<{ periodId: string }>, res: Response): Promise<void> => {
        await this._useCases.deletePayrollPeriod.execute({ periodId: req.params.periodId, actorUserId: ActorContext.get(res) });
        res.status(200).end();
    };

    public attendanceReadiness = async (req: Request<{ periodId: string }>, res: Response): Promise<void> => {
        const readiness = await this._useCases.attendanceReadiness.execute({ periodId: req.params.periodId });
        res.status(200).json(readiness);
    };

    public lockAttendance = async (req: Request<{ periodId: string }>, res: Response): Promise<void> => {
        const { period, autoRunning } = await this._useCases.lockAttendance.execute({ periodId: req.params.periodId, actorUserId: ActorContext.get(res) });
        res.status(200).json({ ...PayrollPeriodPresenter.toDTO(period), autoRunning });
    };

    public unlockAttendance = async (req: Request<{ periodId: string }>, res: Response): Promise<void> => {
        const body   = bodySchemaUnlockAttendance.parse(req.body);
        const period = await this._useCases.unlockAttendance.execute({
            periodId:    req.params.periodId,
            reason:      body.reason,
            actorUserId: ActorContext.get(res),
        });
        res.status(200).json(PayrollPeriodPresenter.toDTO(period));
    };

    public evaluationReadiness = async (req: Request<{ periodId: string }>, res: Response): Promise<void> => {
        const readiness = await this._useCases.evaluationReadiness.execute({ periodId: req.params.periodId });
        res.status(200).json(readiness);
    };

    public lockEvaluations = async (req: Request<{ periodId: string }>, res: Response): Promise<void> => {
        const { period, autoRunning } = await this._useCases.lockEvaluations.execute({ periodId: req.params.periodId, actorUserId: ActorContext.get(res) });
        res.status(200).json({ ...PayrollPeriodPresenter.toDTO(period), autoRunning });
    };

    public unlockEvaluations = async (req: Request<{ periodId: string }>, res: Response): Promise<void> => {
        const period = await this._useCases.unlockEvaluations.execute({ periodId: req.params.periodId, actorUserId: ActorContext.get(res) });
        res.status(200).json(PayrollPeriodPresenter.toDTO(period));
    };

    public markHrReviewed = async (req: Request<{ periodId: string }>, res: Response): Promise<void> => {
        const period = await this._useCases.markPayrollHrReviewed.execute({
            periodId: req.params.periodId, actorUserId: ActorContext.get(res),
        });
        res.status(200).json(PayrollPeriodPresenter.toDTO(period));
    };

    public runForPeriod = async (req: Request<{ periodId: string }>, res: Response): Promise<void> => {
        const result = await this._useCases.runPayrollForPeriod.execute({ periodId: req.params.periodId, actorUserId: ActorContext.get(res) });
        res.status(200).json(result);
    };

    public runForEmployee = async (req: Request<{ periodId: string; employeeId: string }>, res: Response): Promise<void> => {
        const payslip = await this._useCases.runPayrollForEmployee.execute({
            periodId: req.params.periodId, employeeId: req.params.employeeId, actorUserId: ActorContext.get(res),
        });
        res.status(200).json({ payslipId: payslip.id, status: payslip.status, netSalary: payslip.netSalary });
    };
}
