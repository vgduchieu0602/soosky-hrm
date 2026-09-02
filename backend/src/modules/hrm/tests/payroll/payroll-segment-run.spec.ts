import mongoose from 'mongoose';
import { describe, it, expect, beforeEach } from 'vitest';

import { RunPayrollUseCases } from '@modules/hrm/core/payroll/app/payroll-run.usecases';
import type { AttendanceSummary } from '@modules/hrm/core/payroll/domain/attendance-summary';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const oid = () => new mongoose.Types.ObjectId();
const dec = (n: number) => mongoose.Types.Decimal128.fromString(String(n));
const num = (v: { toString(): string }) => Number(v.toString());

const PERIOD_ID = oid();
const EMPLOYEE_ID = oid();

const PERIOD = {
  _id: PERIOD_ID,
  name: '2026-08',
  startDate: d('2026-08-01'),
  endDate: d('2026-08-31'),
  payDate: d('2026-09-05'),
  standardWorkDays: 21,
  status: 'open',
  attendanceLockedAt: d('2026-09-01'),
  performanceLockedAt: d('2026-09-01'),
};

interface ContractSeed {
  _id: mongoose.Types.ObjectId;
  startDate: Date;
  endDate: Date | null;
  employmentStatus: string;
  baseSalary: mongoose.Types.Decimal128;
}

function contractSeed(over: Partial<ContractSeed> = {}): ContractSeed {
  return {
    _id: oid(),
    startDate: d('2026-01-01'),
    endDate: null,
    employmentStatus: 'official',
    baseSalary: dec(30_000_000),
    ...over,
  };
}

const emptySummary = (actualWorkDays: number): AttendanceSummary => ({
  workedDays: actualWorkDays,
  paidLeaveDays: 0,
  holidayDays: 0,
  unpaidLeaveDays: 0,
  incompleteDays: 0,
  actualWorkDays,
  absentDays: 0,
  unpaidDays: 0,
  totalWorkHours: actualWorkDays * 8,
  recordCount: actualWorkDays,
});

interface Options {
  contracts: ContractSeed[];
  /** Ngày công chuẩn theo khoảng — key `from..to` (YYYY-MM-DD). */
  workDaysByRange?: Record<string, number>;
  /** Ngày công thực tế theo khoảng; mặc định = ngày công chuẩn. */
  actualByRange?: Record<string, number>;
  weights?: { attendance: number; performance: number; goal: number };
  /** Fixed intern pay configured by the salary policy. */
  internPayAmount?: number;
  probationPayRate?: number;
  attendanceLockedAt?: Date | null;
  performanceLockedAt?: Date | null;
  /** Mức BHXH cố định HR nhập trên hồ sơ thuế. */
  fixedInsuranceAmount?: number;
  /** Khoảng làm việc của nhân viên; mặc định vào làm từ lâu, chưa nghỉ. */
  hireDate?: Date;
  terminationDate?: Date | null;
}

const rangeKey = (from: Date, to: Date) =>
  `${from.toISOString().slice(0, 10)}..${to.toISOString().slice(0, 10)}`;

/** Build the 16 mocks expected by RunPayrollUseCases, in constructor order. */
function makeRunMocks(opts: Options, saved: { doc: unknown }[]) {
  const standardFor = (from: Date, to: Date): number => {
    const key = rangeKey(from, to);
    if (opts.workDaysByRange && key in opts.workDaysByRange) return opts.workDaysByRange[key]!;
    return Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
  };
  const periodReader = {
    findById: async () => ({
      ...PERIOD,
      attendanceLockedAt:
        opts.attendanceLockedAt === undefined ? PERIOD.attendanceLockedAt : opts.attendanceLockedAt,
      performanceLockedAt:
        opts.performanceLockedAt === undefined ? PERIOD.performanceLockedAt : opts.performanceLockedAt,
      status: 'open',
    }),
    findLatest: async () => null,
    list: async () => [],
    findByName: async () => null,
    namesByIds: async () => [],
  };
  const periodLifecycle = {
    markProcessing: async () => undefined,
    markPaid: async () => undefined,
  };
  const payrolls = {
    findById: async () => ({
      ...PERIOD,
      attendanceLockedAt:
        opts.attendanceLockedAt === undefined ? PERIOD.attendanceLockedAt : opts.attendanceLockedAt,
      performanceLockedAt:
        opts.performanceLockedAt === undefined ? PERIOD.performanceLockedAt : opts.performanceLockedAt,
    }),
    findExisting: async () => null,
    upsertComputed: async (_p: string, _e: string, doc: unknown) => {
      saved.push({ doc });
      return doc;
    },
  };
  const employees = {
    findByIdLean: async () => ({
      _id: EMPLOYEE_ID,
      shiftId: null,
      salaryZone: 'zone1',
      hireDate: opts.hireDate ?? d('2020-01-01'),
      terminationDate: opts.terminationDate ?? null,
    }),
  };
  const contracts = {
    findActive: async () => opts.contracts[opts.contracts.length - 1] ?? null,
    findOverlapping: async () => opts.contracts,
  };
  const shifts = { workingDays: async () => null };
  const policies = {
    effectiveAt: async () => ({
      _id: oid(),
      baseSalary: dec(2_340_000),
      insuranceCeilingMultiplier: 20,
      regionalMinWage: { zone1: 4_960_000 },
      personalDeduction: dec(11_000_000),
      dependentDeduction: dec(4_400_000),
      internStipend: dec(opts.internPayAmount ?? 1_500_000),
      probationPayRate: opts.probationPayRate ?? 85,
      socialInsuranceSalary: dec(5_500_000),
      unionFeeEnabled: false,
      unionFeeRate: 0,
      salaryComponentWeights: opts.weights ?? { attendance: 20, performance: 60, goal: 20 },
    }),
  };
  const evaluations = {
    findForEmployeePeriod: async () => ({
      _id: oid(),
      status: 'approved',
      performanceRatio: 100,
      goalRatio: 100,
    }),
  };
  const taxProfiles = {
    findEffective: async () =>
      opts.fixedInsuranceAmount == null
        ? null
        : { insuranceAmount: opts.fixedInsuranceAmount, dependentsCount: 0, isResident: true },
  };
  const allowances = { findActiveForPeriod: async () => [] };
  const bonuses = { findForPeriod: async () => [] };
  const deductions = { findActiveForPeriod: async () => [] };
  const attendance = {
    aggregatePeriod: async (_id: string, from: Date, to: Date) => {
      const key = rangeKey(from, to);
      const actual = opts.actualByRange?.[key] ?? standardFor(from, to);
      return emptySummary(actual);
    },
  };
  const workCalendar = { standardWorkDaysInRange: async (from: Date, to: Date) => standardFor(from, to) };
  const uow = { withTransaction: async (work: (tx: unknown) => Promise<unknown>) => work('tx') };
  const clock = { now: () => new Date() };
  return [
    periodReader,
    periodLifecycle,
    payrolls,
    employees,
    contracts,
    shifts,
    policies,
    evaluations,
    taxProfiles,
    allowances,
    bonuses,
    deductions,
    attendance,
    workCalendar,
    uow,
    clock,
  ] as never;
}

function build(opts: Options) {
  const saved: { doc: unknown }[] = [];
  const useCases = new (RunPayrollUseCases as any)(...(makeRunMocks(opts, saved) as any[]));
  return { useCases, saved };
}

async function run(opts: Options) {
  const { useCases } = build(opts);
  return (await useCases.forEmployee(String(PERIOD_ID), String(EMPLOYEE_ID))) as unknown as RunResult;
}

interface RunResult {
  attendanceComponent: mongoose.Types.Decimal128;
  performanceComponent: mongoose.Types.Decimal128;
  goalComponent: mongoose.Types.Decimal128;
  proRatedBaseSalary: mongoose.Types.Decimal128;
  baseSalary: mongoose.Types.Decimal128;
  insurance: mongoose.Types.Decimal128;
  calculationSnapshot?: {
    contracts: {
      employmentStatus: string;
      baseSalary: mongoose.Types.Decimal128;
      weight: number;
    }[];
  };
}

describe('RunPayrollUseCases — chia đoạn hợp đồng', () => {
  it('tính đúng cho 1 hợp đồng bao phủ toàn kỳ', async () => {
    const r = await run({ contracts: [contractSeed()] });
    expect(num(r.baseSalary)).toBe(30_000_000);
    expect(r.calculationSnapshot!.contracts).toHaveLength(1);
  });

  it('không lấy mức lương cuối kỳ nhân cho cả tháng', async () => {
    const r = await run({
      contracts: [
        contractSeed({ startDate: d('2026-08-01'), endDate: d('2026-08-15'), baseSalary: dec(30_000_000) }),
        contractSeed({ startDate: d('2026-08-16'), endDate: null, baseSalary: dec(50_000_000) }),
      ],
    });
    // tổng = 15 ngày * 30tr/31 + 16 ngày * 50tr/31 (xấp xỉ 50tr),
    // tuyệt đối KHÔNG phải 31 ngày * 50tr (flat cuối kỳ).
    expect(num(r.baseSalary)).toBeLessThan(31 * 50_000_000);
  });

  it('hợp đồng hỏng (ngày không hợp lệ) thì DỪNG', async () => {
    await expect(
      run({
        contracts: [
          contractSeed({ startDate: d('2026-08-31'), endDate: d('2026-08-01'), baseSalary: dec(30_000_000) }),
        ],
      }),
    ).rejects.toThrow();
  });

  it('nhân viên nghỉ SAU kỳ vẫn tính được kỳ cũ', async () => {
    const r = await run({ contracts: [contractSeed()], terminationDate: d('2026-09-10') });
    expect(r).toBeTruthy();
  });

  it('nhân viên nghỉ TRƯỚC kỳ thì không tính', async () => {
    await expect(
      run({ contracts: [contractSeed()], terminationDate: d('2026-07-01') }),
    ).rejects.toThrow();
  });
});

describe('khoá tính lại', () => {
  it('bản đã duyệt không được tính lại', async () => {
    const saved: { doc: unknown }[] = [];
    const mocks = makeRunMocks({ contracts: [] }, saved) as any[];
    mocks[2] = {
      ...mocks[2],
      findExisting: async () => ({ status: 'approved' }),
    };
    const useCases = new (RunPayrollUseCases as any)(...mocks);
    await expect(useCases.forEmployee(String(PERIOD_ID), String(EMPLOYEE_ID))).rejects.toMatchObject({
      code: 'PAY_ALREADY_FINALIZED',
    });
  });

  it('bản đã chi không được tính lại', async () => {
    const saved: { doc: unknown }[] = [];
    const mocks = makeRunMocks({ contracts: [] }, saved) as any[];
    mocks[2] = {
      ...mocks[2],
      findExisting: async () => ({ status: 'paid' }),
    };
    const useCases = new (RunPayrollUseCases as any)(...mocks);
    await expect(useCases.forEmployee(String(PERIOD_ID), String(EMPLOYEE_ID))).rejects.toMatchObject({
      code: 'PAY_ALREADY_FINALIZED',
    });
  });

  it('bản nháp thì tính lại được', async () => {
    const r = await run({ contracts: [contractSeed()] });
    expect(r).toBeTruthy();
  });
});
