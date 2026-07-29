import PayslipPresenter from "@modules/payroll/adapters/driver/http/presenters/PayslipPresenter";
import PermissionChecker from "@modules/payroll/core/app/ports/PermissionChecker";
import { PayslipStatus } from "@modules/payroll/core/domain/entities/Payslip";
import ApprovePayrollUseCase from "@modules/payroll/core/app/use-cases/payroll/ApprovePayrollUseCase";
import ExportPayrollPeriodUseCase from "@modules/payroll/core/app/use-cases/payroll/ExportPayrollPeriodUseCase";
import GetPayrollUseCase from "@modules/payroll/core/app/use-cases/payroll/GetPayrollUseCase";
import GrossUpUseCase from "@modules/payroll/core/app/use-cases/payroll/GrossUpUseCase";
import ListMyPayrollsUseCase from "@modules/payroll/core/app/use-cases/payroll/ListMyPayrollsUseCase";
import ListPayrollsUseCase from "@modules/payroll/core/app/use-cases/payroll/ListPayrollsUseCase";
import MarkPayrollPaidUseCase from "@modules/payroll/core/app/use-cases/payroll/MarkPayrollPaidUseCase";
import PayrollPreflightUseCase from "@modules/payroll/core/app/use-cases/payroll/PayrollPreflightUseCase";
import PayrollTotalsUseCase from "@modules/payroll/core/app/use-cases/payroll/PayrollTotalsUseCase";
import RevertPayrollUseCase from "@modules/payroll/core/app/use-cases/payroll/RevertPayrollUseCase";
import ActorContext from "@shared/adapters/driver/http/ActorContext";
import { bodySchema, field } from "@shared/adapters/driver/http/validation";
import { Request, Response } from "express";

const PERMISSION_KEY = "payroll:manage";

export interface PayrollControllerUseCases {
    listPayrolls:         ListPayrollsUseCase;
    getPayroll:           GetPayrollUseCase;
    listMyPayrolls:       ListMyPayrollsUseCase;
    payrollTotals:        PayrollTotalsUseCase;
    payrollPreflight:     PayrollPreflightUseCase;
    exportPayrollPeriod:  ExportPayrollPeriodUseCase;
    grossUp:              GrossUpUseCase;
    approvePayroll:       ApprovePayrollUseCase;
    revertPayroll:        RevertPayrollUseCase;
    markPayrollPaid:      MarkPayrollPaidUseCase;
    permissions:          PermissionChecker;
}

const bodySchemaGrossUp = bodySchema({
    net:              field.number,
    payDate:          field.optionalDate,
    dependentsCount:  field.optionalNumber,
});

const VALID_STATUSES: PayslipStatus[] = ["draft", "approved", "paid"];

function parseStatus(raw: unknown): PayslipStatus | undefined {
    return typeof raw === "string" && (VALID_STATUSES as string[]).includes(raw) ? (raw as PayslipStatus) : undefined;
}

function parsePositiveInt(raw: unknown, fallback: number): number {
    const n = Number(raw);
    return Number.isInteger(n) && n > 0 ? n : fallback;
}

/** Controller nhóm endpoint Payroll (phiếu lương): xem/duyệt/thanh toán/gross-up. */
export default class PayrollController {
    public constructor(
        private readonly _useCases: PayrollControllerUseCases,
    ) {}

    public listPayrolls = async (req: Request, res: Response): Promise<void> => {
        const page = parsePositiveInt(req.query.page, 1);
        const limit = parsePositiveInt(req.query.limit, 20);
        const status = parseStatus(req.query.status);
        const filter = {
            ...(typeof req.query.payrollPeriodId === "string" ? { payrollPeriodId: req.query.payrollPeriodId } : {}),
            ...(typeof req.query.employeeId === "string" ? { employeeId: req.query.employeeId } : {}),
            ...(status != undefined ? { status } : {}),
        };
        const { items, total } = await this._useCases.listPayrolls.execute({ filter, page, limit });
        res.status(200).json({
            payrolls: items.map(PayslipPresenter.toDTO),
            meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
        });
    };

    public getPayroll = async (req: Request<{ payrollId: string }>, res: Response): Promise<void> => {
        const actorUserId = ActorContext.get(res);
        const isHrOrAdmin = await this._useCases.permissions.hasPermission(actorUserId, PERMISSION_KEY);
        const payslip = await this._useCases.getPayroll.execute({
            payslipId: req.params.payrollId,
            viewer: { userId: actorUserId, isHrOrAdmin },
        });
        res.status(200).json(PayslipPresenter.toDTO(payslip));
    };

    public listMyPayrolls = async (_req: Request, res: Response): Promise<void> => {
        const actorUserId = ActorContext.get(res);
        const mine = await this._useCases.listMyPayrolls.execute({ actorUserId });
        res.status(200).json({ payrolls: mine.map(m => ({ ...PayslipPresenter.toDTO(m.payslip), periodName: m.periodName })) });
    };

    public payrollTotals = async (req: Request<{ periodId: string }>, res: Response): Promise<void> => {
        const totals = await this._useCases.payrollTotals.execute({ periodId: req.params.periodId });
        res.status(200).json({ totals });
    };

    public payrollPreflight = async (req: Request<{ periodId: string }>, res: Response): Promise<void> => {
        const preflight = await this._useCases.payrollPreflight.execute({ periodId: req.params.periodId });
        res.status(200).json(preflight);
    };

    public exportPayrollPeriod = async (req: Request<{ periodId: string }>, res: Response): Promise<void> => {
        const csv = await this._useCases.exportPayrollPeriod.execute({ periodId: req.params.periodId });
        res.status(200).header("Content-Type", "text/csv").send(csv);
    };

    public grossUp = async (req: Request, res: Response): Promise<void> => {
        const body = bodySchemaGrossUp.parse(req.body);
        const isResident = typeof (req.body as Record<string, unknown>)?.isResident === "boolean"
            ? (req.body as Record<string, unknown>).isResident as boolean
            : undefined;
        const result = await this._useCases.grossUp.execute({
            ...body,
            ...(isResident != undefined ? { isResident } : {}),
        });
        res.status(200).json(result);
    };

    public approvePayroll = async (req: Request<{ periodId: string }>, res: Response): Promise<void> => {
        const employeeId = typeof req.body?.employeeId === "string" ? req.body.employeeId : undefined;
        const result = await this._useCases.approvePayroll.execute({
            periodId: req.params.periodId,
            approverUserId: ActorContext.get(res),
            ...(employeeId != undefined ? { employeeId } : {}),
        });
        res.status(200).json(result);
    };

    public revertPayroll = async (req: Request<{ payrollId: string }>, res: Response): Promise<void> => {
        await this._useCases.revertPayroll.execute({ payslipId: req.params.payrollId, actorUserId: ActorContext.get(res) });
        res.status(200).end();
    };

    public markPayrollPaid = async (req: Request<{ periodId: string }>, res: Response): Promise<void> => {
        const result = await this._useCases.markPayrollPaid.execute({ periodId: req.params.periodId, payerUserId: ActorContext.get(res) });
        res.status(200).json(result);
    };
}
