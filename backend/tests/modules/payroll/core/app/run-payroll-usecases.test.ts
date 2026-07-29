/// <reference types="jest" />
import AllowanceRepo from "@modules/payroll/core/app/ports/AllowanceRepo";
import AttendanceDirectory, { WorkdaySummary } from "@modules/payroll/core/app/ports/AttendanceDirectory";
import BonusRepo from "@modules/payroll/core/app/ports/BonusRepo";
import DeductionRepo from "@modules/payroll/core/app/ports/DeductionRepo";
import EmployeeDirectory, { EmployeeContractBasis } from "@modules/payroll/core/app/ports/EmployeeDirectory";
import PayrollPeriodRepo from "@modules/payroll/core/app/ports/PayrollPeriodRepo";
import PayslipRepo, { PayslipListFilter, PayslipTotalsRow } from "@modules/payroll/core/app/ports/PayslipRepo";
import PermissionChecker from "@modules/payroll/core/app/ports/PermissionChecker";
import SalaryPolicyRepo from "@modules/payroll/core/app/ports/SalaryPolicyRepo";
import TaxProfileRepo from "@modules/payroll/core/app/ports/TaxProfileRepo";
import UnitOfWork, { PayrollUoWContext } from "@modules/payroll/core/app/ports/UnitOfWork";
import RunPayrollForEmployeeUseCase from "@modules/payroll/core/app/use-cases/payroll/RunPayrollForEmployeeUseCase";
import RunPayrollForPeriodUseCase from "@modules/payroll/core/app/use-cases/payroll/RunPayrollForPeriodUseCase";
import Allowance from "@modules/payroll/core/domain/entities/Allowance";
import Bonus from "@modules/payroll/core/domain/entities/Bonus";
import Deduction from "@modules/payroll/core/domain/entities/Deduction";
import PayrollPeriod from "@modules/payroll/core/domain/entities/PayrollPeriod";
import Payslip, { PayslipStatus } from "@modules/payroll/core/domain/entities/Payslip";
import SalaryPolicy from "@modules/payroll/core/domain/entities/SalaryPolicy";
import TaxProfile from "@modules/payroll/core/domain/entities/TaxProfile";
import PeriodName from "@modules/payroll/core/domain/value-objects/PeriodName";
import AccessDeniedError from "@shared/core/app/errors/AccessDeniedError";
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
        const items = [...this._store.values()].filter(p =>
            (filter.payrollPeriodId == undefined || p.payrollPeriodId === filter.payrollPeriodId) &&
            (filter.employeeId == undefined || p.employeeId === filter.employeeId) &&
            (filter.status == undefined || p.status === filter.status));
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

const denyAllPermissions: PermissionChecker = {
    async assertPermission() { throw new AccessDeniedError(); },
    async hasPermission() { return false; },
};

function buildPolicy(overrides: Partial<Parameters<typeof SalaryPolicy.create>[0]> = {}): SalaryPolicy {
    return SalaryPolicy.create({
        id: "policy-1",
        effectiveFrom: new Date("2026-01-01"),
        baseSalaryReference: 2_340_000,
        regionalMinWage: 4_960_000,
        socialInsuranceSalary: 5_500_000,
        unionFeeRate: 1,
        unionFeeEnabled: true,
        taxEnabled: false,
        ...overrides,
    });
}

function buildPeriod(): PayrollPeriod {
    const period = PayrollPeriod.create({
        id: "period-1",
        name: PeriodName.create("2026-06"),
        startDate: new Date("2026-06-01"),
        endDate: new Date("2026-06-30"),
        payDate: new Date("2026-07-05"),
        standardWorkDays: 22,
        createdBy: "hr-1",
    });
    period.lockAttendance("hr-1");
    period.lockEvaluations("hr-1");
    return period;
}

describe("RunPayrollForEmployeeUseCase", () => {
    let periods: InMemoryPeriodRepo;
    let payslips: InMemoryPayslipRepo;
    let policies: InMemorySalaryPolicyRepo;
    let allowances: InMemoryAllowanceRepo;
    let bonuses: InMemoryBonusRepo;
    let deductions: InMemoryDeductionRepo;
    let taxProfiles: InMemoryTaxProfileRepo;
    let uow: InMemoryUnitOfWork;

    const fullAttendance: AttendanceDirectory = {
        async shiftExists() { return true; },
        async getWorkdaySummary(): Promise<WorkdaySummary> { return { actualWorkDays: 22, unpaidDays: 0 }; },
    };

    beforeEach(async () => {
        periods = new InMemoryPeriodRepo();
        payslips = new InMemoryPayslipRepo();
        policies = new InMemorySalaryPolicyRepo();
        allowances = new InMemoryAllowanceRepo();
        bonuses = new InMemoryBonusRepo();
        deductions = new InMemoryDeductionRepo();
        taxProfiles = new InMemoryTaxProfileRepo();
        uow = new InMemoryUnitOfWork(periods, payslips);

        await periods.save(buildPeriod());
        await policies.save(buildPolicy());
    });

    function buildUseCase(permissions: PermissionChecker, employeeDirectory: EmployeeDirectory, attendanceDirectory: AttendanceDirectory = fullAttendance) {
        return new RunPayrollForEmployeeUseCase(permissions, uow, employeeDirectory, attendanceDirectory, policies, allowances, bonuses, deductions, taxProfiles);
    }

    const officialEmployeeDirectory: EmployeeDirectory = {
        async employeeExists() { return true; },
        async listActiveEmployeeIds() { return ["emp-1"]; },
        async contractBasis(): Promise<EmployeeContractBasis | undefined> {
            return { contractId: "contract-1", employeeId: "emp-1", baseSalary: 20_000_000, employmentStatus: "official" };
        },
        async findEmployeeIdByUserId() { return undefined; },
    };

    it("từ chối khi actor không có quyền payroll:manage", async () => {
        const useCase = buildUseCase(denyAllPermissions, officialEmployeeDirectory);
        await expect(useCase.execute({ periodId: "period-1", employeeId: "emp-1", actorUserId: "user-1" }))
            .rejects.toThrow(AccessDeniedError);
    });

    it("tính đúng lương nhân viên chính thức đủ công (fixedInsuranceAmount=0 mặc định khi chưa có hồ sơ thuế)", async () => {
        const useCase = buildUseCase(allowAllPermissions, officialEmployeeDirectory);
        const payslip = await useCase.execute({ periodId: "period-1", employeeId: "emp-1", actorUserId: "hr-1" });

        expect(payslip.status).toBe("draft");
        expect(payslip.breakdown.proRatedBaseSalary).toBe(20_000_000);
        expect(payslip.breakdown.grossSalary).toBe(20_000_000);
        // Chưa có tax profile → fixedInsuranceAmount mặc định 0 (port nguyên quy tắc cũ).
        expect(payslip.breakdown.insurance).toBe(0);
        expect(payslip.breakdown.unionFee).toBe(Math.round(5_500_000 * 0.01));
        expect(payslip.netSalary).toBe(20_000_000 - Math.round(5_500_000 * 0.01));
    });

    it("dùng đúng BHXH cố định khi có hồ sơ thuế (577.500 theo ví dụ NV A)", async () => {
        await taxProfiles.save(TaxProfile.create({
            id: "tax-1", employeeId: "emp-1", isResident: true, dependentsCount: 0,
            insuranceAmount: 577_500, effectiveDate: new Date("2026-01-01"), endDate: null,
        }));
        const useCase = buildUseCase(allowAllPermissions, officialEmployeeDirectory);
        const payslip = await useCase.execute({ periodId: "period-1", employeeId: "emp-1", actorUserId: "hr-1" });

        expect(payslip.breakdown.insurance).toBe(577_500);
        expect(payslip.netSalary).toBe(20_000_000 - 577_500 - Math.round(5_500_000 * 0.01));
    });

    it("thử việc: lương hiệu lực = 85% lương HĐ, miễn BH/đoàn phí", async () => {
        const probationDirectory: EmployeeDirectory = {
            ...officialEmployeeDirectory,
            async contractBasis() { return { contractId: "c2", employeeId: "emp-1", baseSalary: 20_000_000, employmentStatus: "probation" }; },
        };
        const useCase = buildUseCase(allowAllPermissions, probationDirectory);
        const payslip = await useCase.execute({ periodId: "period-1", employeeId: "emp-1", actorUserId: "hr-1" });

        expect(payslip.breakdown.proRatedBaseSalary).toBe(17_000_000);
        expect(payslip.breakdown.insurance).toBe(0);
        expect(payslip.breakdown.unionFee).toBe(0);
        expect(payslip.netSalary).toBe(17_000_000);
    });

    it("báo lỗi ACTIVE_CONTRACT_NOT_FOUND khi nhân viên không có hợp đồng active", async () => {
        const noContractDirectory: EmployeeDirectory = { ...officialEmployeeDirectory, async contractBasis() { return undefined; } };
        const useCase = buildUseCase(allowAllPermissions, noContractDirectory);
        await expect(useCase.execute({ periodId: "period-1", employeeId: "emp-1", actorUserId: "hr-1" }))
            .rejects.toMatchObject({ code: "ACTIVE_CONTRACT_NOT_FOUND" });
    });

    it("báo lỗi PAY_ATT_NOT_LOCKED khi kỳ chưa chốt chấm công", async () => {
        const period = PayrollPeriod.create({
            id: "period-2", name: PeriodName.create("2026-07"), startDate: new Date("2026-07-01"),
            endDate: new Date("2026-07-31"), payDate: new Date("2026-08-05"), standardWorkDays: 22, createdBy: "hr-1",
        });
        await periods.save(period);
        const useCase = buildUseCase(allowAllPermissions, officialEmployeeDirectory);
        await expect(useCase.execute({ periodId: "period-2", employeeId: "emp-1", actorUserId: "hr-1" }))
            .rejects.toMatchObject({ code: "PAY_ATT_NOT_LOCKED" });
    });

    it("idempotent: chạy lại chỉ ghi đè phiếu draft, từ chối phiếu đã approved", async () => {
        const useCase = buildUseCase(allowAllPermissions, officialEmployeeDirectory);
        const first = await useCase.execute({ periodId: "period-1", employeeId: "emp-1", actorUserId: "hr-1" });
        first.approve("hr-1");
        await payslips.save(first);

        await expect(useCase.execute({ periodId: "period-1", employeeId: "emp-1", actorUserId: "hr-1" }))
            .rejects.toMatchObject({ code: "PAY_ALREADY_FINALIZED" });
    });
});

describe("RunPayrollForPeriodUseCase", () => {
    it("gom lỗi từng nhân viên, không chặn cả kỳ", async () => {
        const periods = new InMemoryPeriodRepo();
        const payslips = new InMemoryPayslipRepo();
        const policies = new InMemorySalaryPolicyRepo();
        const allowances = new InMemoryAllowanceRepo();
        const bonuses = new InMemoryBonusRepo();
        const deductions = new InMemoryDeductionRepo();
        const taxProfiles = new InMemoryTaxProfileRepo();
        const uow = new InMemoryUnitOfWork(periods, payslips);

        await periods.save(buildPeriod());
        await policies.save(buildPolicy());

        const employeeDirectory: EmployeeDirectory = {
            async employeeExists() { return true; },
            async listActiveEmployeeIds() { return ["emp-ok", "emp-no-contract"]; },
            async contractBasis(employeeId: string) {
                if (employeeId === "emp-ok") return { contractId: "c1", employeeId, baseSalary: 15_000_000, employmentStatus: "official" };
                return undefined;
            },
            async findEmployeeIdByUserId() { return undefined; },
        };
        const attendanceDirectory: AttendanceDirectory = {
            async shiftExists() { return true; },
            async getWorkdaySummary() { return { actualWorkDays: 22, unpaidDays: 0 }; },
        };

        const runForEmployee = new RunPayrollForEmployeeUseCase(allowAllPermissions, uow, employeeDirectory, attendanceDirectory, policies, allowances, bonuses, deductions, taxProfiles);
        const runForPeriod = new RunPayrollForPeriodUseCase(allowAllPermissions, employeeDirectory, runForEmployee);

        const result = await runForPeriod.execute({ periodId: "period-1", actorUserId: "hr-1" });

        expect(result.computed).toBe(1);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]?.employeeId).toBe("emp-no-contract");
    });
});
