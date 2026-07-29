/// <reference types="jest" />
import { createPayrollHttpRouter, PayrollHttpUseCases } from "@modules/payroll";
import AllowanceRepo from "@modules/payroll/core/app/ports/AllowanceRepo";
import AttendanceDirectory from "@modules/payroll/core/app/ports/AttendanceDirectory";
import BonusRepo from "@modules/payroll/core/app/ports/BonusRepo";
import DeductionRepo from "@modules/payroll/core/app/ports/DeductionRepo";
import EmployeeDirectory from "@modules/payroll/core/app/ports/EmployeeDirectory";
import PayrollPeriodRepo from "@modules/payroll/core/app/ports/PayrollPeriodRepo";
import PayslipRepo, { PayslipListFilter, PayslipTotalsRow } from "@modules/payroll/core/app/ports/PayslipRepo";
import PermissionChecker from "@modules/payroll/core/app/ports/PermissionChecker";
import SalaryPolicyRepo from "@modules/payroll/core/app/ports/SalaryPolicyRepo";
import TaxProfileRepo from "@modules/payroll/core/app/ports/TaxProfileRepo";
import UnitOfWork, { PayrollUoWContext } from "@modules/payroll/core/app/ports/UnitOfWork";
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
import UnlockEvaluationsUseCase from "@modules/payroll/core/app/use-cases/period/UnlockEvaluationsUseCase";
import UpdatePayrollPeriodUseCase from "@modules/payroll/core/app/use-cases/period/UpdatePayrollPeriodUseCase";
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
import RunPayrollForEmployeeUseCase from "@modules/payroll/core/app/use-cases/payroll/RunPayrollForEmployeeUseCase";
import RunPayrollForPeriodUseCase from "@modules/payroll/core/app/use-cases/payroll/RunPayrollForPeriodUseCase";
import CreateAllowanceUseCase from "@modules/payroll/core/app/use-cases/compensation/CreateAllowanceUseCase";
import CreateBonusUseCase from "@modules/payroll/core/app/use-cases/compensation/CreateBonusUseCase";
import CreateDeductionUseCase from "@modules/payroll/core/app/use-cases/compensation/CreateDeductionUseCase";
import CreateSalaryPolicyUseCase from "@modules/payroll/core/app/use-cases/compensation/CreateSalaryPolicyUseCase";
import DeleteAllowanceUseCase from "@modules/payroll/core/app/use-cases/compensation/DeleteAllowanceUseCase";
import DeleteBonusUseCase from "@modules/payroll/core/app/use-cases/compensation/DeleteBonusUseCase";
import DeleteDeductionUseCase from "@modules/payroll/core/app/use-cases/compensation/DeleteDeductionUseCase";
import ListAllowancesByEmployeeUseCase from "@modules/payroll/core/app/use-cases/compensation/ListAllowancesByEmployeeUseCase";
import ListBonusesByEmployeeUseCase from "@modules/payroll/core/app/use-cases/compensation/ListBonusesByEmployeeUseCase";
import ListDeductionsByEmployeeUseCase from "@modules/payroll/core/app/use-cases/compensation/ListDeductionsByEmployeeUseCase";
import ListSalaryPoliciesUseCase from "@modules/payroll/core/app/use-cases/compensation/ListSalaryPoliciesUseCase";
import ListTaxProfilesByEmployeeUseCase from "@modules/payroll/core/app/use-cases/compensation/ListTaxProfilesByEmployeeUseCase";
import UpdateAllowanceUseCase from "@modules/payroll/core/app/use-cases/compensation/UpdateAllowanceUseCase";
import UpdateBonusUseCase from "@modules/payroll/core/app/use-cases/compensation/UpdateBonusUseCase";
import UpdateDeductionUseCase from "@modules/payroll/core/app/use-cases/compensation/UpdateDeductionUseCase";
import UpsertTaxProfileUseCase from "@modules/payroll/core/app/use-cases/compensation/UpsertTaxProfileUseCase";
import Allowance from "@modules/payroll/core/domain/entities/Allowance";
import Bonus from "@modules/payroll/core/domain/entities/Bonus";
import Deduction from "@modules/payroll/core/domain/entities/Deduction";
import PayrollPeriod from "@modules/payroll/core/domain/entities/PayrollPeriod";
import Payslip, { PayslipStatus } from "@modules/payroll/core/domain/entities/Payslip";
import SalaryPolicy from "@modules/payroll/core/domain/entities/SalaryPolicy";
import TaxProfile from "@modules/payroll/core/domain/entities/TaxProfile";
import AccessTokenVerifier, { AuthenticatedActor } from "@shared/adapters/driver/http/ports/AccessTokenVerifier";
import EventBus from "@shared/core/domain/EventBus";
import express, { Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

class InMemoryPeriodRepo implements PayrollPeriodRepo {
    private readonly _store = new Map<string, PayrollPeriod>();
    async getById(id: string) { return this._store.get(id); }
    async getByName(name: string) { return [...this._store.values()].find(p => p.name.value === name); }
    async listAll() { return [...this._store.values()]; }
    async save(period: PayrollPeriod) { this._store.set(period.id, period); }
    async deleteById(id: string) { this._store.delete(id); }
}

class InMemoryPayslipRepo implements PayslipRepo {
    private readonly _store = new Map<string, Payslip>();
    async getById(id: string) { return this._store.get(id); }
    async findOne(periodId: string, employeeId: string) {
        return [...this._store.values()].find(p => p.payrollPeriodId === periodId && p.employeeId === employeeId);
    }
    async listByPeriod(periodId: string) { return [...this._store.values()].filter(p => p.payrollPeriodId === periodId); }
    async listByPeriodAndStatus(periodId: string, status: PayslipStatus, employeeId?: string) {
        return [...this._store.values()].filter(p => p.payrollPeriodId === periodId && p.status === status && (employeeId == undefined || p.employeeId === employeeId));
    }
    async listFinalizedByEmployee(employeeId: string) {
        return [...this._store.values()].filter(p => p.employeeId === employeeId && p.status !== "draft");
    }
    async paginate(filter: PayslipListFilter, page: number, limit: number) {
        const items = [...this._store.values()].filter(p => filter.payrollPeriodId == undefined || p.payrollPeriodId === filter.payrollPeriodId);
        return { items: items.slice((page - 1) * limit, page * limit), total: items.length };
    }
    async totalsForPeriod(periodId: string): Promise<PayslipTotalsRow[]> {
        const byStatus = new Map<PayslipStatus, PayslipTotalsRow>();
        for (const p of [...this._store.values()].filter(x => x.payrollPeriodId === periodId)) {
            const row = byStatus.get(p.status) ?? { status: p.status, count: 0, gross: 0, net: 0 };
            row.count += 1; row.gross += p.grossSalary; row.net += p.netSalary;
            byStatus.set(p.status, row);
        }
        return [...byStatus.values()];
    }
    async countByPeriod(periodId: string) { return [...this._store.values()].filter(p => p.payrollPeriodId === periodId).length; }
    async countByStatus(periodId: string, status: PayslipStatus) {
        return [...this._store.values()].filter(p => p.payrollPeriodId === periodId && p.status === status).length;
    }
    async save(payslip: Payslip) { this._store.set(payslip.id, payslip); }
}

class InMemoryAllowanceRepo implements AllowanceRepo {
    private readonly _store = new Map<string, Allowance>();
    async getById(id: string) { return this._store.get(id); }
    async listByEmployeeId(employeeId: string) { return [...this._store.values()].filter(a => a.employeeId === employeeId); }
    async save(a: Allowance) { this._store.set(a.id, a); }
    async deleteById(id: string) { this._store.delete(id); }
}

class InMemoryBonusRepo implements BonusRepo {
    private readonly _store = new Map<string, Bonus>();
    async getById(id: string) { return this._store.get(id); }
    async listByEmployeeId(employeeId: string) { return [...this._store.values()].filter(b => b.employeeId === employeeId); }
    async listForPeriod(employeeId: string, periodId: string) {
        return [...this._store.values()].filter(b => b.employeeId === employeeId && b.payrollPeriodId === periodId);
    }
    async save(b: Bonus) { this._store.set(b.id, b); }
    async deleteById(id: string) { this._store.delete(id); }
}

class InMemoryDeductionRepo implements DeductionRepo {
    private readonly _store = new Map<string, Deduction>();
    async getById(id: string) { return this._store.get(id); }
    async listByEmployeeId(employeeId: string) { return [...this._store.values()].filter(d => d.employeeId === employeeId); }
    async listApplicableForPeriod(employeeId: string, periodId: string, start: Date, end: Date) {
        return [...this._store.values()].filter(d => d.employeeId === employeeId && d.appliesToPeriod(periodId, start, end));
    }
    async save(d: Deduction) { this._store.set(d.id, d); }
    async deleteById(id: string) { this._store.delete(id); }
}

class InMemoryTaxProfileRepo implements TaxProfileRepo {
    private readonly _store = new Map<string, TaxProfile>();
    async listByEmployeeId(employeeId: string) { return [...this._store.values()].filter(t => t.employeeId === employeeId); }
    async findEffectiveAt(employeeId: string, date: Date) {
        return [...this._store.values()].find(t => t.employeeId === employeeId && t.isActiveAt(date));
    }
    async save(t: TaxProfile) { this._store.set(t.id, t); }
}

class InMemorySalaryPolicyRepo implements SalaryPolicyRepo {
    private readonly _store = new Map<string, SalaryPolicy>();
    async listAll() { return [...this._store.values()]; }
    async findEffectiveAt(date: Date) { return [...this._store.values()].find(p => p.effectiveFrom <= date); }
    async save(p: SalaryPolicy) { this._store.set(p.id, p); }
}

class InMemoryUnitOfWork implements UnitOfWork {
    constructor(private readonly _periods: PayrollPeriodRepo, private readonly _payslips: PayslipRepo) {}
    async run<T>(work: (ctx: PayrollUoWContext) => Promise<T>): Promise<T> {
        return work({ periodRepo: this._periods, payslipRepo: this._payslips });
    }
}

const allowAllPermissions: PermissionChecker = {
    async assertPermission() { /* allow all in test */ },
    async hasPermission() { return true; },
};

const employeeDirectory: EmployeeDirectory = {
    async employeeExists() { return true; },
    async listActiveEmployeeIds() { return ["emp-1"]; },
    async contractBasis() { return { contractId: "contract-1", employeeId: "emp-1", baseSalary: 20_000_000, employmentStatus: "official" }; },
    async findEmployeeIdByUserId(userId: string) { return userId === "user-emp-1" ? "emp-1" : undefined; },
};

const attendanceDirectory: AttendanceDirectory = {
    async shiftExists() { return true; },
    async getWorkdaySummary() { return { actualWorkDays: 22, unpaidDays: 0 }; },
};

const noopEventBus: EventBus = {
    async publish() { /* no-op in test */ },
    subscribe() { /* no-op in test */ },
};

function buildUseCases(): PayrollHttpUseCases {
    const periods = new InMemoryPeriodRepo();
    const payslips = new InMemoryPayslipRepo();
    const allowances = new InMemoryAllowanceRepo();
    const bonuses = new InMemoryBonusRepo();
    const deductions = new InMemoryDeductionRepo();
    const taxProfiles = new InMemoryTaxProfileRepo();
    const policies = new InMemorySalaryPolicyRepo();
    const uow = new InMemoryUnitOfWork(periods, payslips);

    const runPayrollForEmployee = new RunPayrollForEmployeeUseCase(
        allowAllPermissions, uow, employeeDirectory, attendanceDirectory, policies, allowances, bonuses, deductions, taxProfiles,
    );
    const runPayrollForPeriod = new RunPayrollForPeriodUseCase(allowAllPermissions, employeeDirectory, runPayrollForEmployee);

    return {
        permissions: allowAllPermissions,

        createPayrollPeriod: new CreatePayrollPeriodUseCase(allowAllPermissions, periods),
        updatePayrollPeriod: new UpdatePayrollPeriodUseCase(allowAllPermissions, periods),
        getPayrollPeriod: new GetPayrollPeriodUseCase(periods),
        listPayrollPeriods: new ListPayrollPeriodsUseCase(periods),
        closePayrollPeriod: new ClosePayrollPeriodUseCase(allowAllPermissions, periods, payslips),
        reopenPayrollPeriod: new ReopenPayrollPeriodUseCase(allowAllPermissions, periods, payslips),
        deletePayrollPeriod: new DeletePayrollPeriodUseCase(allowAllPermissions, periods, payslips),
        attendanceReadiness: new AttendanceReadinessUseCase(periods, employeeDirectory, attendanceDirectory),
        lockAttendance: new LockAttendanceUseCase(allowAllPermissions, periods, noopEventBus, { forPeriod: (periodId, actorUserId) => runPayrollForPeriod.execute({ periodId, actorUserId }) }),
        unlockAttendance: new UnlockAttendanceUseCase(allowAllPermissions, periods, payslips),
        evaluationReadiness: new EvaluationReadinessUseCase(periods, employeeDirectory),
        lockEvaluations: new LockEvaluationsUseCase(allowAllPermissions, periods, { forPeriod: (periodId, actorUserId) => runPayrollForPeriod.execute({ periodId, actorUserId }) }),
        unlockEvaluations: new UnlockEvaluationsUseCase(allowAllPermissions, periods, payslips),
        runPayrollForPeriod,
        runPayrollForEmployee,

        listPayrolls: new ListPayrollsUseCase(payslips),
        getPayroll: new GetPayrollUseCase(payslips, employeeDirectory),
        listMyPayrolls: new ListMyPayrollsUseCase(payslips, employeeDirectory, periods),
        payrollTotals: new PayrollTotalsUseCase(payslips),
        payrollPreflight: new PayrollPreflightUseCase(periods, employeeDirectory, policies),
        exportPayrollPeriod: new ExportPayrollPeriodUseCase(payslips),
        grossUp: new GrossUpUseCase(policies),
        approvePayroll: new ApprovePayrollUseCase(allowAllPermissions, uow, noopEventBus),
        revertPayroll: new RevertPayrollUseCase(allowAllPermissions, payslips),
        markPayrollPaid: new MarkPayrollPaidUseCase(allowAllPermissions, uow, noopEventBus),

        createAllowance: new CreateAllowanceUseCase(allowAllPermissions, allowances),
        updateAllowance: new UpdateAllowanceUseCase(allowAllPermissions, allowances),
        deleteAllowance: new DeleteAllowanceUseCase(allowAllPermissions, allowances),
        listAllowancesByEmployee: new ListAllowancesByEmployeeUseCase(allowances),

        createBonus: new CreateBonusUseCase(allowAllPermissions, bonuses),
        updateBonus: new UpdateBonusUseCase(allowAllPermissions, bonuses),
        deleteBonus: new DeleteBonusUseCase(allowAllPermissions, bonuses),
        listBonusesByEmployee: new ListBonusesByEmployeeUseCase(bonuses),

        createDeduction: new CreateDeductionUseCase(allowAllPermissions, deductions),
        updateDeduction: new UpdateDeductionUseCase(allowAllPermissions, deductions),
        deleteDeduction: new DeleteDeductionUseCase(allowAllPermissions, deductions),
        listDeductionsByEmployee: new ListDeductionsByEmployeeUseCase(deductions),

        upsertTaxProfile: new UpsertTaxProfileUseCase(allowAllPermissions, taxProfiles),
        listTaxProfilesByEmployee: new ListTaxProfilesByEmployeeUseCase(taxProfiles),

        createSalaryPolicy: new CreateSalaryPolicyUseCase(allowAllPermissions, policies),
        listSalaryPolicies: new ListSalaryPoliciesUseCase(policies),
    };
}

const fakeVerifier: AccessTokenVerifier = {
    async verify(token: string) { return token ? new AuthenticatedActor(token) : undefined; },
};

function buildApp(): Express {
    const useCases = buildUseCases();
    const app = express();
    app.use("/payroll", createPayrollHttpRouter(useCases, fakeVerifier));
    return app;
}

describe("Payroll HTTP", () => {
    let app: Express;

    beforeEach(() => {
        app = buildApp();
    });

    const auth = { Authorization: "Bearer hr-1" };

    it("401 khi thiếu token", async () => {
        await request(app).get("/payroll/periods").expect(401);
    });

    it("flow: tạo chính sách -> tạo kỳ -> chốt công + đánh giá (tự tính) -> duyệt -> thanh toán", async () => {
        await request(app).post("/payroll/policies").set(auth).send({
            effectiveFrom: "2026-01-01T00:00:00.000Z",
            baseSalaryReference: 2_340_000,
            regionalMinWage: 4_960_000,
            socialInsuranceSalary: 5_500_000,
        }).expect(201);

        const period = await request(app).post("/payroll/periods").set(auth).send({
            name: "2026-06",
            startDate: "2026-06-01T00:00:00.000Z",
            endDate: "2026-06-30T00:00:00.000Z",
            payDate: "2026-07-05T00:00:00.000Z",
            standardWorkDays: 22,
        }).expect(201);
        const periodId = period.body.periodId;
        expect(periodId).toBeTruthy();

        // Chốt chấm công trước (bắt buộc trước khi tính lương).
        await request(app).post(`/payroll/periods/${periodId}/lock-attendance`).set(auth).expect(200);

        // Chốt đánh giá — đủ cả hai chốt sẽ TỰ ĐỘNG chạy lương cả kỳ.
        const lockEval = await request(app).post(`/payroll/periods/${periodId}/lock-evaluations`).set(auth).expect(200);
        expect(lockEval.body.autoRunning).toBe(true);

        const listed = await request(app).get("/payroll/payrolls").set(auth).query({ payrollPeriodId: periodId }).expect(200);
        expect(listed.body.payrolls).toHaveLength(1);
        const payslip = listed.body.payrolls[0];
        expect(payslip.status).toBe("draft");
        expect(payslip.breakdown.grossSalary).toBe(20_000_000);

        // Duyệt toàn kỳ.
        const approved = await request(app).post(`/payroll/periods/${periodId}/approve`).set(auth).send({}).expect(200);
        expect(approved.body.affected).toBe(1);

        const periodAfterApprove = await request(app).get(`/payroll/periods/${periodId}`).set(auth).expect(200);
        expect(periodAfterApprove.body.status).toBe("processing");

        // Thanh toán.
        const paid = await request(app).post(`/payroll/periods/${periodId}/mark-paid`).set(auth).expect(200);
        expect(paid.body.affected).toBe(1);

        const periodAfterPay = await request(app).get(`/payroll/periods/${periodId}`).set(auth).expect(200);
        expect(periodAfterPay.body.status).toBe("paid");

        const payrollDetail = await request(app).get(`/payroll/payrolls/${payslip.id}`).set(auth).expect(200);
        expect(payrollDetail.body.status).toBe("paid");
    });

    it("409 PAY_ATT_NOT_LOCKED khi chạy lương trước khi chốt chấm công", async () => {
        await request(app).post("/payroll/policies").set(auth).send({
            effectiveFrom: "2026-01-01T00:00:00.000Z",
            baseSalaryReference: 2_340_000,
            regionalMinWage: 4_960_000,
            socialInsuranceSalary: 5_500_000,
        }).expect(201);
        const period = await request(app).post("/payroll/periods").set(auth).send({
            name: "2026-07",
            startDate: "2026-07-01T00:00:00.000Z",
            endDate: "2026-07-31T00:00:00.000Z",
            payDate: "2026-08-05T00:00:00.000Z",
        }).expect(201);

        await request(app).post(`/payroll/periods/${period.body.periodId}/run/emp-1`).set(auth)
            .expect(409).expect(res => expect(res.body.code).toBe("PAY_ATT_NOT_LOCKED"));
    });

    it("409 khi tên kỳ trùng", async () => {
        const body = {
            name: "2026-08",
            startDate: "2026-08-01T00:00:00.000Z",
            endDate: "2026-08-31T00:00:00.000Z",
            payDate: "2026-09-05T00:00:00.000Z",
        };
        await request(app).post("/payroll/periods").set(auth).send(body).expect(201);
        await request(app).post("/payroll/periods").set(auth).send(body)
            .expect(409).expect(res => expect(res.body.code).toBe("PAYROLL_PERIOD_NAME_CONFLICT"));
    });
});
