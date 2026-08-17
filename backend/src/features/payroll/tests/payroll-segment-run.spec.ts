/// <reference types="jest" />
/**
 * Engine tính lương khi kỳ trải trên nhiều hợp đồng.
 *
 * Chạy `RunPayrollUseCases` thật với cổng giả, nên khẳng định được cả luồng:
 * tra hợp đồng theo ngày hiệu lực → chia đoạn → ngày công từng đoạn → cộng thành
 * phần lương. Điều được khoá: không lấy mức lương cuối kỳ nhân cho cả tháng, và
 * dữ liệu hợp đồng hỏng thì DỪNG chứ không đoán.
 */
import mongoose from 'mongoose';

import { RunPayrollUseCases } from '@features/payroll/application/payroll-run.usecases';
import type { AttendanceSummary } from '@features/payroll/domain/attendance-summary';

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
  absentDays: 0,
  incompleteDays: 0,
  actualWorkDays,
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
  probationPayRate?: number;
  /** Mức BHXH cố định HR nhập trên hồ sơ thuế. */
  fixedInsuranceAmount?: number;
  /** Khoảng làm việc của nhân viên; mặc định vào làm từ lâu, chưa nghỉ. */
  hireDate?: Date;
  terminationDate?: Date | null;
}

const rangeKey = (from: Date, to: Date) =>
  `${from.toISOString().slice(0, 10)}..${to.toISOString().slice(0, 10)}`;

function build(opts: Options) {
  const saved: { doc: unknown }[] = [];

  const standardFor = (from: Date, to: Date): number => {
    const key = rangeKey(from, to);
    if (opts.workDaysByRange && key in opts.workDaysByRange) return opts.workDaysByRange[key]!;
    // Mặc định: đếm ngày dương lịch, đủ để test số học cộng dồn.
    return Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
  };

  const useCases = new RunPayrollUseCases(
    { findById: async () => PERIOD } as never,
    {
      findExisting: async () => null,
      upsertComputed: async (_p: string, _e: string, doc: unknown) => {
        saved.push({ doc });
        return doc;
      },
    } as never,
    {
      findByIdLean: async () => ({
        _id: EMPLOYEE_ID,
        shiftId: null,
        salaryZone: 'zone1',
        hireDate: opts.hireDate ?? d('2020-01-01'),
        terminationDate: opts.terminationDate ?? null,
      }),
    } as never,
    {
      findActive: async () => opts.contracts[opts.contracts.length - 1] ?? null,
      findOverlapping: async () => opts.contracts,
    } as never,
    { workingDays: async () => null } as never,
    {
      effectiveAt: async () => ({
        _id: oid(),
        baseSalary: dec(2_340_000),
        insuranceCeilingMultiplier: 20,
        regionalMinWage: { zone1: 4_960_000 },
        personalDeduction: dec(11_000_000),
        dependentDeduction: dec(4_400_000),
        probationPayRate: opts.probationPayRate ?? 85,
        socialInsuranceSalary: dec(5_500_000),
        unionFeeEnabled: false,
        unionFeeRate: 0,
        salaryComponentWeights: opts.weights ?? { attendance: 20, performance: 60, goal: 20 },
      }),
    } as never,
    {
      findForEmployeePeriod: async () => ({
        _id: oid(),
        status: 'approved',
        performanceRatio: 100,
        goalRatio: 100,
      }),
    } as never,
    {
      findEffective: async () =>
        opts.fixedInsuranceAmount == null
          ? null
          : { insuranceAmount: opts.fixedInsuranceAmount, dependentsCount: 0, isResident: true },
    } as never,
    { findActiveForPeriod: async () => [] } as never,
    { findForPeriod: async () => [] } as never,
    { findActiveForPeriod: async () => [] } as never,
    {
      aggregatePeriod: async (_id: string, from: Date, to: Date) => {
        const key = rangeKey(from, to);
        const actual = opts.actualByRange?.[key] ?? standardFor(from, to);
        return emptySummary(actual);
      },
    } as never,
    { standardWorkDaysInRange: async (from: Date, to: Date) => standardFor(from, to) } as never,
    { withTransaction: async (work: (tx: unknown) => Promise<unknown>) => work('tx') } as never,
  );

  return { useCases, saved };
}

async function run(opts: Options) {
  const { useCases } = build(opts);
  return (await useCases.forEmployee(String(PERIOD_ID), String(EMPLOYEE_ID))) as never as {
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
      payRate: number;
      standardWorkDays: number;
      attendanceComponent: mongoose.Types.Decimal128;
      performanceComponent: mongoose.Types.Decimal128;
      goalComponent: mongoose.Types.Decimal128;
      segmentSalary: mongoose.Types.Decimal128;
      }[];
    };
  };
}

describe('một hợp đồng phủ cả kỳ (không đổi hành vi)', () => {
  it('ra đúng một đoạn và đủ 20/60/20 trên mức lương hợp đồng', async () => {
    const doc = await run({
      contracts: [contractSeed({ baseSalary: dec(30_000_000) })],
      workDaysByRange: { '2026-08-01..2026-08-31': 21 },
    });

    expect(doc.calculationSnapshot!.contracts).toHaveLength(1);
    expect(num(doc.attendanceComponent)).toBe(6_000_000);
    expect(num(doc.performanceComponent)).toBe(18_000_000);
    expect(num(doc.goalComponent)).toBe(6_000_000);
    expect(num(doc.proRatedBaseSalary)).toBe(30_000_000);
  });

  it('trọng số đổi sang 30/50/20 thì tiền đổi theo, không phải sửa code', async () => {
    const doc = await run({
      contracts: [contractSeed({ baseSalary: dec(30_000_000) })],
      workDaysByRange: { '2026-08-01..2026-08-31': 21 },
      weights: { attendance: 30, performance: 50, goal: 20 },
    });

    expect(num(doc.attendanceComponent)).toBe(9_000_000);
    expect(num(doc.performanceComponent)).toBe(15_000_000);
    expect(num(doc.goalComponent)).toBe(6_000_000);
  });
});

describe('thử việc → chính thức trong cùng kỳ', () => {
  const contracts = [
    contractSeed({ endDate: d('2026-08-10'), employmentStatus: 'probation', baseSalary: dec(10_000_000) }),
    contractSeed({ startDate: d('2026-08-11'), endDate: null, employmentStatus: 'official', baseSalary: dec(15_000_000) }),
  ];
  // 7 ngày công cho 01–10, 15 ngày công cho 11–31.
  const workDaysByRange = { '2026-08-01..2026-08-10': 7, '2026-08-11..2026-08-31': 15 };

  it('tạo hai đoạn với mức lương và tỷ lệ hưởng riêng', async () => {
    const doc = await run({ contracts, workDaysByRange });

    expect(doc.calculationSnapshot!.contracts).toHaveLength(2);
    expect(doc.calculationSnapshot!.contracts[0]).toMatchObject({ employmentStatus: 'probation', payRate: 0.85, standardWorkDays: 7 });
    expect(doc.calculationSnapshot!.contracts[1]).toMatchObject({ employmentStatus: 'official', payRate: 1, standardWorkDays: 15 });
    expect(num(doc.calculationSnapshot!.contracts[0]!.baseSalary)).toBe(10_000_000);
    expect(num(doc.calculationSnapshot!.contracts[1]!.baseSalary)).toBe(15_000_000);
  });

  it('đoạn thử việc chỉ ăn theo chấm công (100% trọng số chấm công)', async () => {
    const doc = await run({ contracts, workDaysByRange });

    // 10.000.000 × 85% = 8.500.000, làm đủ ngày công của đoạn → nguyên vẹn.
    expect(num(doc.calculationSnapshot!.contracts[0]!.segmentSalary)).toBe(8_500_000);
  });

  it('đoạn chính thức áp đủ 20/60/20 trên mức lương MỚI', async () => {
    const doc = await run({ contracts, workDaysByRange });

    expect(num(doc.calculationSnapshot!.contracts[1]!.segmentSalary)).toBe(15_000_000);
  });

  it('KHÔNG lấy mức lương cuối kỳ nhân cho cả tháng', async () => {
    const doc = await run({ contracts, workDaysByRange });

    expect(num(doc.proRatedBaseSalary)).toBe(8_500_000 + 15_000_000);
    // Nếu dùng sai (15m cho cả kỳ) sẽ ra đúng 15.000.000.
    expect(num(doc.proRatedBaseSalary)).not.toBe(15_000_000);
    // Hiệu suất/mục tiêu chỉ tính trên đoạn chính thức.
    expect(num(doc.performanceComponent)).toBe(9_000_000);
    expect(num(doc.goalComponent)).toBe(3_000_000);
  });

  it('vắng mặt ở một đoạn chỉ giảm tiền của đoạn đó', async () => {
    const doc = await run({
      contracts,
      workDaysByRange,
      // Đoạn chính thức chỉ làm 12/15 ngày.
      actualByRange: { '2026-08-01..2026-08-10': 7, '2026-08-11..2026-08-31': 12 },
    });

    // Đoạn thử việc nguyên vẹn.
    expect(num(doc.calculationSnapshot!.contracts[0]!.segmentSalary)).toBe(8_500_000);
    // Đoạn chính thức: chỉ phần chấm công (20%) bị cắt theo 12/15.
    expect(num(doc.calculationSnapshot!.contracts[1]!.attendanceComponent)).toBe(2_400_000);
  });

  it('còn ít nhất một đoạn chính thức thì vẫn thu bảo hiểm theo kỳ', async () => {
    const doc = await run({ contracts, workDaysByRange, fixedInsuranceAmount: 570_000 });

    // Không chia nhỏ theo ngày: quy định hiện hành thu theo kỳ.
    expect(num(doc.insurance)).toBe(570_000);
  });

  it('cả kỳ thử việc thì miễn bảo hiểm dù hồ sơ thuế có mức cố định', async () => {
    const doc = await run({
      contracts: [contractSeed({ employmentStatus: 'probation', baseSalary: dec(10_000_000) })],
      workDaysByRange: { '2026-08-01..2026-08-31': 21 },
      fixedInsuranceAmount: 570_000,
    });

    expect(num(doc.insurance)).toBe(0);
  });
});

describe('đổi mức lương giữa kỳ (cùng chính thức)', () => {
  it('dùng hai mức lương khác nhau cho hai đoạn', async () => {
    const doc = await run({
      contracts: [
        contractSeed({ endDate: d('2026-08-10'), baseSalary: dec(10_000_000) }),
        contractSeed({ startDate: d('2026-08-11'), baseSalary: dec(15_000_000) }),
      ],
      workDaysByRange: { '2026-08-01..2026-08-10': 7, '2026-08-11..2026-08-31': 15 },
    });

    expect(doc.calculationSnapshot!.contracts.map((s) => num(s.baseSalary))).toEqual([10_000_000, 15_000_000]);
    expect(num(doc.proRatedBaseSalary)).toBe(25_000_000);
    // Trường hiển thị lấy mức của đoạn cuối kỳ.
    expect(num(doc.baseSalary)).toBe(15_000_000);
  });
});

describe('cả kỳ thử việc / thực tập', () => {
  it('thử việc toàn kỳ: nền lương = 10m × 85% trước khi chia theo ngày công', async () => {
    const doc = await run({
      contracts: [contractSeed({ employmentStatus: 'probation', baseSalary: dec(10_000_000) })],
      workDaysByRange: { '2026-08-01..2026-08-31': 21 },
    });

    expect(num(doc.proRatedBaseSalary)).toBe(8_500_000);
    expect(num(doc.performanceComponent)).toBe(0);
    expect(num(doc.goalComponent)).toBe(0);
    expect(num(doc.insurance)).toBe(0);
  });

  it('tỷ lệ thử việc lấy từ chính sách, không phải hằng số 85', async () => {
    const doc = await run({
      contracts: [contractSeed({ employmentStatus: 'probation', baseSalary: dec(10_000_000) })],
      workDaysByRange: { '2026-08-01..2026-08-31': 21 },
      probationPayRate: 90,
    });

    expect(num(doc.proRatedBaseSalary)).toBe(9_000_000);
  });

  it('thực tập toàn kỳ giữ hành vi hiện tại: lương hợp đồng, không bảo hiểm', async () => {
    const doc = await run({
      contracts: [contractSeed({ employmentStatus: 'internship', baseSalary: dec(4_000_000) })],
      workDaysByRange: { '2026-08-01..2026-08-31': 21 },
    });

    expect(num(doc.proRatedBaseSalary)).toBe(4_000_000);
    expect(num(doc.insurance)).toBe(0);
  });
});

describe('dữ liệu hợp đồng hỏng thì DỪNG', () => {
  it('chồng ngày → PAY_CONTRACT_OVERLAP, không tạo bản lương', async () => {
    const { useCases, saved } = build({
      contracts: [
        contractSeed({ endDate: d('2026-08-15') }),
        contractSeed({ startDate: d('2026-08-10') }),
      ],
    });

    await expect(useCases.forEmployee(String(PERIOD_ID), String(EMPLOYEE_ID))).rejects.toMatchObject({
      statusCode: 409,
      code: 'PAY_CONTRACT_OVERLAP',
    });
    expect(saved).toEqual([]);
  });

  it('khoảng trống CÓ ngày công → PAY_CONTRACT_GAP', async () => {
    const { useCases, saved } = build({
      contracts: [
        contractSeed({ endDate: d('2026-08-10') }),
        contractSeed({ startDate: d('2026-08-15') }),
      ],
      workDaysByRange: { '2026-08-11..2026-08-14': 3 },
    });

    await expect(useCases.forEmployee(String(PERIOD_ID), String(EMPLOYEE_ID))).rejects.toMatchObject({
      statusCode: 409,
      code: 'PAY_CONTRACT_GAP',
    });
    expect(saved).toEqual([]);
  });

  it('khoảng trống chỉ rơi vào ngày nghỉ → vẫn tính lương bình thường', async () => {
    const doc = await run({
      contracts: [
        contractSeed({ endDate: d('2026-08-10'), baseSalary: dec(10_000_000) }),
        contractSeed({ startDate: d('2026-08-13'), baseSalary: dec(10_000_000) }),
      ],
      workDaysByRange: {
        '2026-08-11..2026-08-12': 0, // khoảng trống không có ngày công
        '2026-08-01..2026-08-10': 7,
        '2026-08-13..2026-08-31': 14,
      },
    });

    expect(doc.calculationSnapshot!.contracts).toHaveLength(2);
  });

  it('không có hợp đồng nào chồng kỳ → 404 như trước', async () => {
    const { useCases } = build({ contracts: [] });

    await expect(useCases.forEmployee(String(PERIOD_ID), String(EMPLOYEE_ID))).rejects.toThrow(
      /Active contract/,
    );
  });
});

describe('khoá tính lại', () => {
  it('bản đã duyệt không được tính lại', async () => {
    const useCases = new RunPayrollUseCases(
      { findById: async () => PERIOD } as never,
      { findExisting: async () => ({ status: 'approved' }) } as never,
      {} as never, {} as never, {} as never, {} as never, {} as never,
      {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never,
    );

    await expect(useCases.forEmployee(String(PERIOD_ID), String(EMPLOYEE_ID))).rejects.toMatchObject({
      code: 'PAY_ALREADY_FINALIZED',
    });
  });

  it('bản đã chi không được tính lại', async () => {
    const useCases = new RunPayrollUseCases(
      { findById: async () => PERIOD } as never,
      { findExisting: async () => ({ status: 'paid' }) } as never,
      {} as never, {} as never, {} as never, {} as never, {} as never,
      {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never,
    );

    await expect(useCases.forEmployee(String(PERIOD_ID), String(EMPLOYEE_ID))).rejects.toMatchObject({
      code: 'PAY_ALREADY_FINALIZED',
    });
  });

  it('bản nháp thì tính lại được', async () => {
    const { useCases, saved } = build({
      contracts: [contractSeed()],
      workDaysByRange: { '2026-08-01..2026-08-31': 21 },
    });

    await useCases.forEmployee(String(PERIOD_ID), String(EMPLOYEE_ID));
    await useCases.forEmployee(String(PERIOD_ID), String(EMPLOYEE_ID));

    expect(saved).toHaveLength(2);
  });
});

describe('phạm vi thuộc bảng lương theo khoảng làm việc', () => {
  it('vào làm giữa kỳ: chỉ tính từ ngày vào làm, KHÔNG báo thiếu hợp đồng', async () => {
    const doc = await run({
      hireDate: d('2026-08-15'),
      contracts: [contractSeed({ startDate: d('2026-08-15'), endDate: null, baseSalary: dec(15_000_000) })],
      workDaysByRange: { '2026-08-15..2026-08-31': 11 },
    });

    expect(doc.calculationSnapshot!.contracts).toHaveLength(1);
    expect(doc.calculationSnapshot!.contracts[0]!.standardWorkDays).toBe(11);
  });

  it('nghỉ giữa kỳ: chỉ tính đến ngày nghỉ, KHÔNG báo thiếu hợp đồng phần đuôi', async () => {
    const doc = await run({
      terminationDate: d('2026-08-20'),
      contracts: [contractSeed({ startDate: d('2026-01-01'), endDate: d('2026-08-20') })],
      workDaysByRange: { '2026-08-01..2026-08-20': 14 },
    });

    expect(doc.calculationSnapshot!.contracts).toHaveLength(1);
    expect(doc.calculationSnapshot!.contracts[0]!.standardWorkDays).toBe(14);
  });

  it('hợp đồng vẫn mở nhưng đã nghỉ giữa kỳ thì đoạn bị cắt tới ngày nghỉ', async () => {
    const doc = await run({
      terminationDate: d('2026-08-20'),
      contracts: [contractSeed({ startDate: d('2026-01-01'), endDate: null })],
      workDaysByRange: { '2026-08-01..2026-08-20': 14 },
    });

    expect(doc.calculationSnapshot!.contracts[0]!.standardWorkDays).toBe(14);
  });

  it('khoảng trống THẬT bên trong khoảng làm việc vẫn bị chặn', async () => {
    const { useCases } = build({
      hireDate: d('2026-08-01'),
      contracts: [
        contractSeed({ endDate: d('2026-08-10') }),
        contractSeed({ startDate: d('2026-08-15') }),
      ],
      workDaysByRange: { '2026-08-11..2026-08-14': 3 },
    });

    await expect(useCases.forEmployee(String(PERIOD_ID), String(EMPLOYEE_ID))).rejects.toMatchObject({
      code: 'PAY_CONTRACT_GAP',
    });
  });

  it('còn đi làm nhưng hợp đồng hết sớm → chặn khoảng đuôi (Case D)', async () => {
    const { useCases, saved } = build({
      contracts: [contractSeed({ startDate: d('2026-01-01'), endDate: d('2026-08-20') })],
      workDaysByRange: { '2026-08-01..2026-08-20': 14, '2026-08-21..2026-08-31': 7 },
    });

    await expect(useCases.forEmployee(String(PERIOD_ID), String(EMPLOYEE_ID))).rejects.toMatchObject({
      code: 'PAY_CONTRACT_GAP',
    });
    expect(saved).toEqual([]);
  });

  it('hợp đồng bắt đầu muộn hơn ngày vào làm → chặn khoảng đầu', async () => {
    const { useCases } = build({
      hireDate: d('2026-08-01'),
      contracts: [contractSeed({ startDate: d('2026-08-05'), endDate: null })],
      workDaysByRange: { '2026-08-01..2026-08-04': 2 },
    });

    await expect(useCases.forEmployee(String(PERIOD_ID), String(EMPLOYEE_ID))).rejects.toMatchObject({
      code: 'PAY_CONTRACT_GAP',
    });
  });

  it('vào làm sau khi kỳ kết thúc → không thuộc kỳ, không tạo dòng lương', async () => {
    const { useCases, saved } = build({
      hireDate: d('2026-09-01'),
      contracts: [contractSeed({ startDate: d('2026-09-01') })],
    });

    await expect(useCases.forEmployee(String(PERIOD_ID), String(EMPLOYEE_ID))).rejects.toMatchObject({
      code: 'PAY_OUT_OF_SCOPE',
    });
    expect(saved).toEqual([]);
  });

  it('đã nghỉ trước khi kỳ bắt đầu → không thuộc kỳ', async () => {
    const { useCases, saved } = build({
      terminationDate: d('2026-07-15'),
      contracts: [contractSeed({ endDate: d('2026-07-15') })],
    });

    await expect(useCases.forEmployee(String(PERIOD_ID), String(EMPLOYEE_ID))).rejects.toMatchObject({
      code: 'PAY_OUT_OF_SCOPE',
    });
    expect(saved).toEqual([]);
  });

  it('người đã nghỉ SAU kỳ vẫn tính lại được lương của kỳ cũ', async () => {
    const doc = await run({
      terminationDate: d('2026-09-30'),
      contracts: [contractSeed({ startDate: d('2026-01-01'), endDate: d('2026-09-30') })],
      workDaysByRange: { '2026-08-01..2026-08-31': 21 },
    });

    expect(doc.calculationSnapshot!.contracts).toHaveLength(1);
    expect(doc.calculationSnapshot!.contracts[0]!.standardWorkDays).toBe(21);
  });
});
