/// <reference types="jest" />
import PayrollPeriodRepo from "@modules/payroll/core/app/ports/PayrollPeriodRepo";
import PayslipRepo, { PayslipListFilter, PayslipTotalsRow } from "@modules/payroll/core/app/ports/PayslipRepo";
import PermissionChecker from "@modules/payroll/core/app/ports/PermissionChecker";
import UnitOfWork, { PayrollUoWContext } from "@modules/payroll/core/app/ports/UnitOfWork";
import ApprovePayrollUseCase from "@modules/payroll/core/app/use-cases/payroll/ApprovePayrollUseCase";
import MarkPayrollPaidUseCase from "@modules/payroll/core/app/use-cases/payroll/MarkPayrollPaidUseCase";
import RevertPayrollUseCase from "@modules/payroll/core/app/use-cases/payroll/RevertPayrollUseCase";
import PayrollPeriod from "@modules/payroll/core/domain/entities/PayrollPeriod";
import Payslip, { PayslipStatus } from "@modules/payroll/core/domain/entities/Payslip";
import { PayrollApprovedEvent } from "@modules/payroll/core/domain/events/PayrollApprovedEvent";
import { PayrollPaidEvent } from "@modules/payroll/core/domain/events/PayrollPaidEvent";
import { ComputePayrollResult } from "@modules/payroll/core/domain/services/salary-calc";
import PeriodName from "@modules/payroll/core/domain/value-objects/PeriodName";
import AccessDeniedError from "@shared/core/app/errors/AccessDeniedError";
import DomainEvent from "@shared/core/domain/DomainEvent";
import EventBus from "@shared/core/domain/EventBus";
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
    async totalsForPeriod(periodId: string): Promise<PayslipTotalsRow[]> { return []; }
    async countByPeriod(periodId: string) { return [...this._store.values()].filter(p => p.payrollPeriodId === periodId).length; }
    async countByStatus(periodId: string, status: PayslipStatus) {
        return [...this._store.values()].filter(p => p.payrollPeriodId === periodId && p.status === status).length;
    }
    async save(payslip: Payslip) { this._store.set(payslip.id, payslip); }
}

class InMemoryUnitOfWork implements UnitOfWork {
    constructor(private readonly _periods: PayrollPeriodRepo, private readonly _payslips: PayslipRepo) {}
    async run<T>(work: (ctx: PayrollUoWContext) => Promise<T>): Promise<T> {
        return work({ periodRepo: this._periods, payslipRepo: this._payslips });
    }
}

class RecordingEventBus implements EventBus {
    readonly published: DomainEvent[] = [];
    async publish(events: DomainEvent[]) { this.published.push(...events); }
    subscribe() { /* not used in these tests */ }
}

const allowAllPermissions: PermissionChecker = {
    async assertPermission() { /* allow all in test */ },
    async hasPermission() { return true; },
};

const denyAllPermissions: PermissionChecker = {
    async assertPermission() { throw new AccessDeniedError(); },
    async hasPermission() { return false; },
};

const emptyBreakdown: ComputePayrollResult = {
    attendanceComponent: 0, performanceComponent: 0, goalComponent: 0, proRatedBaseSalary: 20_000_000,
    insuranceBase: 0, unemploymentInsuranceBase: 0, socialInsurance: 0, healthInsurance: 0, unemploymentInsurance: 0,
    insurance: 0, employerSocialInsurance: 0, employerHealthInsurance: 0, employerUnemploymentInsurance: 0, employerOccupationalInsurance: 0,
    baseSalary: 20_000_000, totalTaxableAllowances: 0, totalNonTaxableAllowances: 0, totalAllowances: 0,
    overtimePay: 0, overtimeNonTaxablePay: 0, totalBonuses: 0, grossSalary: 20_000_000, insurableSalary: 20_000_000,
    taxableIncome: 20_000_000, personalDeduction: 0, dependentDeduction: 0, dependentsCount: 0,
    taxableIncomeAfterDeduction: 0, tax: 0, unionFee: 0, otherDeductions: 0, totalDeductions: 0, netSalary: 20_000_000,
};

function buildDraftPayslip(id: string, periodId: string, employeeId: string): Payslip {
    return Payslip.compute({
        id, payrollPeriodId: periodId, employeeId,
        workdays: { standardWorkDays: 22, actualWorkDays: 22, unpaidDays: 0 },
        attendanceRatio: 1, performanceRatio: 100, goalRatio: 100,
        breakdown: emptyBreakdown,
    });
}

function buildOpenPeriod(id = "period-1"): PayrollPeriod {
    return PayrollPeriod.create({
        id, name: PeriodName.create("2026-06"), startDate: new Date("2026-06-01"), endDate: new Date("2026-06-30"),
        payDate: new Date("2026-07-05"), standardWorkDays: 22, createdBy: "hr-1",
    });
}

describe("ApprovePayrollUseCase", () => {
    let periods: InMemoryPeriodRepo;
    let payslips: InMemoryPayslipRepo;
    let uow: InMemoryUnitOfWork;
    let eventBus: RecordingEventBus;

    beforeEach(() => {
        periods = new InMemoryPeriodRepo();
        payslips = new InMemoryPayslipRepo();
        uow = new InMemoryUnitOfWork(periods, payslips);
        eventBus = new RecordingEventBus();
    });

    it("từ chối khi actor không có quyền payroll:manage", async () => {
        const useCase = new ApprovePayrollUseCase(denyAllPermissions, uow, eventBus);
        await expect(useCase.execute({ periodId: "period-1", approverUserId: "user-1" })).rejects.toThrow(AccessDeniedError);
    });

    it("duyệt toàn kỳ: draft -> approved, kỳ open -> processing, phát payroll.approved", async () => {
        await periods.save(buildOpenPeriod());
        await payslips.save(buildDraftPayslip("payslip-1", "period-1", "emp-1"));
        await payslips.save(buildDraftPayslip("payslip-2", "period-1", "emp-2"));

        const useCase = new ApprovePayrollUseCase(allowAllPermissions, uow, eventBus);
        const result = await useCase.execute({ periodId: "period-1", approverUserId: "hr-1" });

        expect(result.affected).toBe(2);
        const period = await periods.getById("period-1");
        expect(period?.status).toBe("processing");

        const payslip1 = await payslips.getById("payslip-1");
        expect(payslip1?.status).toBe("approved");
        expect(payslip1?.approvedBy).toBe("hr-1");

        expect(eventBus.published).toHaveLength(1);
        const event = eventBus.published[0] as PayrollApprovedEvent;
        expect(event.type).toBe("payroll.approved");
        expect(event.payload).toEqual({ periodId: "period-1", count: 2, approvedBy: "hr-1" });
    });

    it("báo lỗi PAY_NOTHING_TO_APPROVE khi không có phiếu draft", async () => {
        await periods.save(buildOpenPeriod());
        const useCase = new ApprovePayrollUseCase(allowAllPermissions, uow, eventBus);
        await expect(useCase.execute({ periodId: "period-1", approverUserId: "hr-1" }))
            .rejects.toMatchObject({ code: "PAY_NOTHING_TO_APPROVE" });
    });

    it("duyệt một nhân viên (employeeId) không chuyển trạng thái kỳ", async () => {
        await periods.save(buildOpenPeriod());
        await payslips.save(buildDraftPayslip("payslip-1", "period-1", "emp-1"));
        await payslips.save(buildDraftPayslip("payslip-2", "period-1", "emp-2"));

        const useCase = new ApprovePayrollUseCase(allowAllPermissions, uow, eventBus);
        await useCase.execute({ periodId: "period-1", approverUserId: "hr-1", employeeId: "emp-1" });

        const period = await periods.getById("period-1");
        expect(period?.status).toBe("open");
        expect((await payslips.getById("payslip-1"))?.status).toBe("approved");
        expect((await payslips.getById("payslip-2"))?.status).toBe("draft");
    });
});

describe("RevertPayrollUseCase", () => {
    it("hoàn tác approved -> draft", async () => {
        const payslips = new InMemoryPayslipRepo();
        const payslip = buildDraftPayslip("payslip-1", "period-1", "emp-1");
        payslip.approve("hr-1");
        await payslips.save(payslip);

        const useCase = new RevertPayrollUseCase(allowAllPermissions, payslips);
        await useCase.execute({ payslipId: "payslip-1", actorUserId: "hr-1" });

        const reverted = await payslips.getById("payslip-1");
        expect(reverted?.status).toBe("draft");
        expect(reverted?.approvedBy).toBeNull();
    });

    it("báo lỗi PAY_NOT_APPROVED khi phiếu đang draft", async () => {
        const payslips = new InMemoryPayslipRepo();
        await payslips.save(buildDraftPayslip("payslip-1", "period-1", "emp-1"));

        const useCase = new RevertPayrollUseCase(allowAllPermissions, payslips);
        await expect(useCase.execute({ payslipId: "payslip-1", actorUserId: "hr-1" }))
            .rejects.toMatchObject({ code: "PAY_NOT_APPROVED" });
    });
});

describe("MarkPayrollPaidUseCase", () => {
    it("thanh toán toàn kỳ: approved -> paid, kỳ khoá paid, phát payroll.paid", async () => {
        const periods = new InMemoryPeriodRepo();
        const payslips = new InMemoryPayslipRepo();
        const uow = new InMemoryUnitOfWork(periods, payslips);
        const eventBus = new RecordingEventBus();

        await periods.save(buildOpenPeriod());
        const payslip = buildDraftPayslip("payslip-1", "period-1", "emp-1");
        payslip.approve("hr-1");
        await payslips.save(payslip);

        const useCase = new MarkPayrollPaidUseCase(allowAllPermissions, uow, eventBus);
        const result = await useCase.execute({ periodId: "period-1", payerUserId: "admin-1" });

        expect(result.affected).toBe(1);
        expect((await periods.getById("period-1"))?.status).toBe("paid");
        expect((await payslips.getById("payslip-1"))?.status).toBe("paid");
        const event = eventBus.published[0] as PayrollPaidEvent;
        expect(event.type).toBe("payroll.paid");
    });

    it("báo lỗi PAY_DRAFT_REMAINING khi còn phiếu draft", async () => {
        const periods = new InMemoryPeriodRepo();
        const payslips = new InMemoryPayslipRepo();
        const uow = new InMemoryUnitOfWork(periods, payslips);
        const eventBus = new RecordingEventBus();

        await periods.save(buildOpenPeriod());
        await payslips.save(buildDraftPayslip("payslip-1", "period-1", "emp-1"));

        const useCase = new MarkPayrollPaidUseCase(allowAllPermissions, uow, eventBus);
        await expect(useCase.execute({ periodId: "period-1", payerUserId: "admin-1" }))
            .rejects.toMatchObject({ code: "PAY_DRAFT_REMAINING" });
    });
});
