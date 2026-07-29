/**
 * Công cụ tính lương thuần (không phụ thuộc hạ tầng) — port 1:1 từ bản cũ
 * (feature-based) `shared/utils/salary.util.ts`. Mọi số tiền là số nguyên VNĐ
 * (không dùng Decimal128 — xem ghi chú lựa chọn ở `payroll-report.md`); làm
 * tròn `Math.round` ở TỪNG bước như bản gốc để giữ đúng kết quả tới từng đồng.
 *
 * Thứ tự tính: Lương theo công (20/60/20) → Gross → Bảo hiểm → Thuế TNCN → Net.
 * Xem `share-docs/PAYROLL-FORMULA.md` để đối chiếu công thức.
 */

// ---------------------------------------------------------------------------
// 1. Lương theo công — mô hình 20/60/20
// ---------------------------------------------------------------------------

export interface SalaryComponentWeights {
    /** % chuyên cần, mặc định 20 */
    attendance: number;
    /** % hiệu suất, mặc định 60 */
    performance: number;
    /** % mục tiêu, mặc định 20 */
    goal: number;
}

export const DEFAULT_COMPONENT_WEIGHTS: SalaryComponentWeights = {
    attendance:  20,
    performance: 60,
    goal:        20,
};

/** attendanceRatio từ ngày công thô; an toàn khi standardWorkDays = 0. */
export function computeAttendanceRatio(actualWorkDays: number, standardWorkDays: number): number {
    if (standardWorkDays <= 0) return 0;
    return actualWorkDays / standardWorkDays;
}

export interface EffectiveBaseInput {
    baseSalary:        number;
    /** actualWorkDays / standardWorkDays, đã chặn tối đa 1 */
    attendanceRatio:   number;
    /** 0–100 */
    performanceRatio:  number;
    /** 0–100 */
    goalRatio:         number;
    weights?:          SalaryComponentWeights | undefined;
    /**
     * `true` (mặc định bật theo chính sách): phần hiệu suất & mục tiêu CŨNG bị
     * nhân theo tỷ lệ ngày công — nghỉ không lương làm giảm TOÀN BỘ lương.
     * `false`: chỉ phần chuyên cần (20%) theo ngày công, hiệu suất/mục tiêu
     * hưởng đủ theo điểm bất kể ngày công.
     */
    prorateByAttendance?: boolean | undefined;
}

export interface EffectiveBaseResult {
    attendanceComponent:  number;
    performanceComponent: number;
    goalComponent:        number;
    proRatedBaseSalary:   number;
}

export function computeEffectiveBaseSalary(input: EffectiveBaseInput): EffectiveBaseResult {
    const weights = input.weights ?? DEFAULT_COMPONENT_WEIGHTS;
    const qualityAttendanceFactor = input.prorateByAttendance === true ? input.attendanceRatio : 1;

    const attendanceComponent = Math.round(
        (weights.attendance / 100) * input.baseSalary * input.attendanceRatio,
    );
    const performanceComponent = Math.round(
        (weights.performance / 100) * input.baseSalary * (input.performanceRatio / 100) * qualityAttendanceFactor,
    );
    const goalComponent = Math.round(
        (weights.goal / 100) * input.baseSalary * (input.goalRatio / 100) * qualityAttendanceFactor,
    );

    return {
        attendanceComponent,
        performanceComponent,
        goalComponent,
        proRatedBaseSalary: attendanceComponent + performanceComponent + goalComponent,
    };
}

// ---------------------------------------------------------------------------
// 2. Bảo hiểm bắt buộc (BHXH 8/17 · BHYT 1.5/3 · BHTN 1/1 · TNLĐ-BNN 0/0.5)
// ---------------------------------------------------------------------------

export interface InsuranceSideRates {
    social:        number;
    health:        number;
    unemployment:  number;
    /** TNLĐ-BNN, chỉ bên doanh nghiệp đóng */
    occupational?: number | undefined;
}

export interface InsuranceRates {
    employee: InsuranceSideRates;
    employer: InsuranceSideRates;
}

/** Tỷ lệ đóng BHXH/BHYT/BHTN theo luật VN (NLĐ 10.5% · DN 21.5%). */
export const VN_INSURANCE_RATES: InsuranceRates = {
    employee: { social: 8,  health: 1.5, unemployment: 1 },
    employer: { social: 17, health: 3,   unemployment: 1, occupational: 0.5 },
};

export interface InsuranceInput {
    grossSalary:          number;
    /** trần nền BHXH/BHYT, vd lương cơ sở × 20 */
    socialHealthCeiling:  number;
    /** trần nền BHTN, vd lương tối thiểu vùng × 20 */
    unemploymentCeiling:  number;
    rates?:               InsuranceRates | undefined;
}

export interface InsuranceResult {
    insuranceBase:                    number;
    unemploymentInsuranceBase:        number;
    socialInsurance:                  number;
    healthInsurance:                  number;
    unemploymentInsurance:            number;
    insurance:                        number;
    employerSocialInsurance:          number;
    employerHealthInsurance:          number;
    employerUnemploymentInsurance:    number;
    employerOccupationalInsurance:    number;
}

/** Dựng InsuranceResult từ một số tiền BHXH cố định HR nhập tay (không theo %). */
export function fixedInsuranceResult(amount: number): InsuranceResult {
    const a = Math.max(0, Math.round(amount));
    return {
        insuranceBase: 0,
        unemploymentInsuranceBase: 0,
        socialInsurance: a,
        healthInsurance: 0,
        unemploymentInsurance: 0,
        insurance: a,
        employerSocialInsurance: 0,
        employerHealthInsurance: 0,
        employerUnemploymentInsurance: 0,
        employerOccupationalInsurance: 0,
    };
}

export function computeInsurance(input: InsuranceInput): InsuranceResult {
    const rates = input.rates ?? VN_INSURANCE_RATES;
    const insuranceBase = Math.min(input.grossSalary, input.socialHealthCeiling);
    const unemploymentInsuranceBase = Math.min(input.grossSalary, input.unemploymentCeiling);

    const socialInsurance = Math.round((insuranceBase * rates.employee.social) / 100);
    const healthInsurance = Math.round((insuranceBase * rates.employee.health) / 100);
    const unemploymentInsurance = Math.round((unemploymentInsuranceBase * rates.employee.unemployment) / 100);

    return {
        insuranceBase,
        unemploymentInsuranceBase,
        socialInsurance,
        healthInsurance,
        unemploymentInsurance,
        insurance: socialInsurance + healthInsurance + unemploymentInsurance,
        employerSocialInsurance: Math.round((insuranceBase * rates.employer.social) / 100),
        employerHealthInsurance: Math.round((insuranceBase * rates.employer.health) / 100),
        employerUnemploymentInsurance: Math.round((unemploymentInsuranceBase * rates.employer.unemployment) / 100),
        employerOccupationalInsurance: Math.round((insuranceBase * (rates.employer.occupational ?? 0)) / 100),
    };
}

// ---------------------------------------------------------------------------
// 3. Thuế TNCN (biểu luỹ tiến từng phần theo tháng, VN)
// ---------------------------------------------------------------------------

export interface TaxBracket {
    /** Trần bậc thuế (VNĐ); null = không giới hạn (bậc cao nhất) */
    upTo: number | null;
    /** Thuế suất biên, % */
    rate: number;
}

export const VN_PIT_BRACKETS: TaxBracket[] = [
    { upTo: 5_000_000,  rate: 5 },
    { upTo: 10_000_000, rate: 10 },
    { upTo: 18_000_000, rate: 15 },
    { upTo: 32_000_000, rate: 20 },
    { upTo: 52_000_000, rate: 25 },
    { upTo: 80_000_000, rate: 30 },
    { upTo: null,       rate: 35 },
];

/**
 * Thuế luỹ tiến từng phần trên thu nhập ĐÃ trừ giảm trừ bản thân/người phụ
 * thuộc. Thu nhập ≤ 0 → thuế 0. Biểu thuế phải sắp xếp tăng dần.
 */
export function computeProgressiveTax(
    taxableIncomeAfterDeduction: number,
    brackets: TaxBracket[] = VN_PIT_BRACKETS,
): number {
    if (taxableIncomeAfterDeduction <= 0) return 0;

    let tax = 0;
    let lower = 0;
    for (const bracket of brackets) {
        const upper = bracket.upTo ?? Infinity;
        if (taxableIncomeAfterDeduction <= lower) break;
        const amountInBracket = Math.min(taxableIncomeAfterDeduction, upper) - lower;
        tax += (amountInBracket * bracket.rate) / 100;
        lower = upper;
    }
    return Math.round(tax);
}

// ---------------------------------------------------------------------------
// 4. Làm thêm giờ (OT) — hệ số theo luật VN. Công ty hiện TẮT OT
//    (overtimeEnabled=false ở bản cũ) nên payroll-run luôn truyền 0; hàm này
//    được giữ lại để sẵn sàng khi có nguồn giờ OT (không có trong phạm vi
//    module hiện tại — xem payroll-report.md).
// ---------------------------------------------------------------------------

export type OvertimeDayType = "weekday" | "weekend" | "holiday";

export const VN_OVERTIME_MULTIPLIER: Record<OvertimeDayType, number> = {
    weekday: 1.5,
    weekend: 2.0,
    holiday: 3.0,
};

export interface OvertimeEntry {
    hours:   number;
    dayType: OvertimeDayType;
}

/** Đơn giá giờ từ lương tháng (8h/ngày × số ngày công chuẩn). */
export function hourlyRate(baseSalary: number, standardWorkDays: number): number {
    if (standardWorkDays <= 0) return 0;
    return baseSalary / (standardWorkDays * 8);
}

export interface OvertimePayBreakdown {
    /** Toàn bộ lương OT cộng vào gross (chịu thuế + miễn thuế). */
    total:      number;
    /** Phần tương đương lương thường (đơn giá × 1 × giờ) — CHỊU thuế TNCN. */
    taxable:    number;
    /** Phần vượt trên lương thường — MIỄN thuế TNCN theo luật. */
    nonTaxable: number;
}

/** Lương OT tách phần chịu thuế / miễn thuế theo hệ số ngày. */
export function computeOvertimePayBreakdown(
    baseSalary: number,
    standardWorkDays: number,
    entries: OvertimeEntry[],
): OvertimePayBreakdown {
    const rate = hourlyRate(baseSalary, standardWorkDays);
    let taxable = 0;
    let nonTaxable = 0;
    for (const e of entries) {
        const multiplier = VN_OVERTIME_MULTIPLIER[e.dayType];
        taxable += rate * 1 * e.hours;
        nonTaxable += rate * (multiplier - 1) * e.hours;
    }
    taxable = Math.round(taxable);
    nonTaxable = Math.round(nonTaxable);
    return { total: taxable + nonTaxable, taxable, nonTaxable };
}

// ---------------------------------------------------------------------------
// 5. Ráp toàn bộ chuỗi tính lương: lương theo công → gross → bảo hiểm → thuế → net
// ---------------------------------------------------------------------------

export interface ComputePayrollInput {
    baseSalary:            number;
    attendanceRatio:       number;
    performanceRatio:      number;
    goalRatio:             number;
    weights?:              SalaryComponentWeights | undefined;
    prorateByAttendance?:  boolean | undefined;

    totalTaxableAllowances?:    number | undefined;
    totalNonTaxableAllowances?: number | undefined;
    /** Lương đóng BHXH cố định (mức công ty đăng ký), KHÔNG prorate theo công.
     *  Mặc định = lương theo công nếu bỏ trống; truyền 0 để miễn BH cả tháng. */
    insuranceBaseSalary?:       number | undefined;
    /** Phần phụ cấp có cờ `isInsuranceBase` — cộng vào nền BH cùng lương. */
    insuranceBaseAllowances?:   number | undefined;
    /** Số tiền BHXH cố định HR nhập tay — GHI ĐÈ cách tính theo %. */
    fixedInsuranceAmount?:      number | undefined;
    overtimePay?:               number | undefined;
    /** Phần overtimePay miễn thuế (xem `computeOvertimePayBreakdown`). */
    overtimeNonTaxablePay?:     number | undefined;
    totalBonuses?:              number | undefined;
    /** Phần totalBonuses miễn thuế. */
    totalNonTaxableBonuses?:    number | undefined;

    socialHealthCeiling:   number;
    unemploymentCeiling:   number;
    insuranceRates?:       InsuranceRates | undefined;

    personalDeduction:     number;
    dependentDeduction:    number;
    dependentsCount?:      number | undefined;
    taxBrackets?:          TaxBracket[] | undefined;
    /** Bật thuế TNCN. Mặc định TẮT (đang tắt theo cấu hình công ty hiện tại). */
    taxEnabled?:           boolean | undefined;
    /** Cư trú → luỹ tiến + giảm trừ; không cư trú → thuế phẳng, không giảm trừ. */
    isResident?:           boolean | undefined;
    nonResidentTaxRate?:   number | undefined;
    /** Đoàn phí công đoàn — khấu trừ cố định SAU thuế. */
    unionFee?:             number | undefined;
    /** Khấu trừ khác (tạm ứng, phạt…), sau thuế. `percentage` = % của gross. */
    deductions?:           { type: "fixed" | "percentage"; amount: number }[] | undefined;
}

export interface ComputePayrollResult extends EffectiveBaseResult, InsuranceResult {
    baseSalary:                  number;
    totalTaxableAllowances:      number;
    totalNonTaxableAllowances:   number;
    totalAllowances:             number;
    overtimePay:                 number;
    overtimeNonTaxablePay:       number;
    totalBonuses:                number;
    grossSalary:                 number;
    /** Lương thực sự chịu BH (trước khi áp trần). */
    insurableSalary:             number;
    taxableIncome:                number;
    personalDeduction:            number;
    dependentDeduction:           number;
    dependentsCount:              number;
    taxableIncomeAfterDeduction:  number;
    tax:                          number;
    unionFee:                     number;
    otherDeductions:              number;
    totalDeductions:              number;
    netSalary:                    number;
}

/**
 * Tính lương thuần một tháng, từ lương theo công tới net. Field layout khớp
 * `PayslipProps` để map thẳng lên payslip (sau khi làm tròn số nguyên VNĐ).
 */
export function computePayroll(input: ComputePayrollInput): ComputePayrollResult {
    const effective = computeEffectiveBaseSalary({
        baseSalary:          input.baseSalary,
        attendanceRatio:     input.attendanceRatio,
        performanceRatio:    input.performanceRatio,
        goalRatio:           input.goalRatio,
        weights:             input.weights,
        prorateByAttendance: input.prorateByAttendance,
    });

    const totalTaxableAllowances    = input.totalTaxableAllowances ?? 0;
    const totalNonTaxableAllowances = input.totalNonTaxableAllowances ?? 0;
    const totalAllowances           = totalTaxableAllowances + totalNonTaxableAllowances;
    const overtimePay               = input.overtimePay ?? 0;
    const overtimeNonTaxablePay     = Math.min(input.overtimeNonTaxablePay ?? 0, overtimePay);
    const totalBonuses              = input.totalBonuses ?? 0;

    const grossSalary = effective.proRatedBaseSalary + totalAllowances + overtimePay + totalBonuses;

    // Nền BHXH = lương công ty đăng ký (KHÔNG theo công) + phụ cấp tính BH;
    // computeInsurance áp trần sau đó. insuranceBaseSalary=0 → miễn BH cả tháng.
    const insurableSalary =
        (input.insuranceBaseSalary ?? effective.proRatedBaseSalary) + (input.insuranceBaseAllowances ?? 0);

    const insurance = input.fixedInsuranceAmount != null
        ? fixedInsuranceResult(input.fixedInsuranceAmount)
        : computeInsurance({
              grossSalary: insurableSalary,
              socialHealthCeiling: input.socialHealthCeiling,
              unemploymentCeiling: input.unemploymentCeiling,
              rates: input.insuranceRates,
          });

    const dependentsCount = input.dependentsCount ?? 0;
    const isResident = input.isResident !== false;

    // Thu nhập tính thuế: loại phụ cấp/thưởng miễn thuế + phần OT miễn thuế;
    // người cư trú được giảm trừ thêm bảo hiểm NLĐ (người không cư trú thì không).
    const assessableIncome =
        grossSalary - totalNonTaxableAllowances - (input.totalNonTaxableBonuses ?? 0) - overtimeNonTaxablePay;
    const taxableIncome = isResident ? assessableIncome - insurance.insurance : assessableIncome;

    let personalDeduction = 0;
    let totalDependentDeduction = 0;
    let taxableIncomeAfterDeduction = 0;
    let tax = 0;
    // Thuế TẮT mặc định (payroll giản lược): net = gross − BH − đoàn phí − khấu
    // trừ khác. Bật `taxEnabled` để chạy luỹ tiến/thuế phẳng như luật định.
    if (input.taxEnabled === true) {
        if (isResident) {
            personalDeduction = input.personalDeduction;
            totalDependentDeduction = input.dependentDeduction * dependentsCount;
            taxableIncomeAfterDeduction = Math.max(0, taxableIncome - personalDeduction - totalDependentDeduction);
            tax = computeProgressiveTax(taxableIncomeAfterDeduction, input.taxBrackets);
        } else {
            taxableIncomeAfterDeduction = Math.max(0, taxableIncome);
            const rate = input.nonResidentTaxRate ?? 20;
            tax = Math.round((taxableIncomeAfterDeduction * rate) / 100);
        }
    }

    const unionFee = input.unionFee ?? 0;
    const otherDeductions = Math.round(
        (input.deductions ?? []).reduce(
            (sum, d) => sum + (d.type === "percentage" ? (grossSalary * d.amount) / 100 : d.amount),
            0,
        ),
    );
    const totalDeductions = insurance.insurance + tax + unionFee + otherDeductions;
    // Net không bao giờ âm: khấu trừ vượt gross thì chặn ở 0 thay vì ra số âm.
    const netSalary = Math.max(0, grossSalary - insurance.insurance - tax - unionFee - otherDeductions);

    return {
        ...effective,
        ...insurance,
        insurableSalary,
        unionFee,
        baseSalary: input.baseSalary,
        totalTaxableAllowances,
        totalNonTaxableAllowances,
        totalAllowances,
        overtimePay,
        overtimeNonTaxablePay,
        totalBonuses,
        grossSalary,
        taxableIncome,
        personalDeduction,
        dependentDeduction: totalDependentDeduction,
        dependentsCount,
        taxableIncomeAfterDeduction,
        tax,
        otherDeductions,
        totalDeductions,
        netSalary,
    };
}

// ---------------------------------------------------------------------------
// 6. NET → GROSS gross-up (dò nhị phân, tái dùng computePayroll)
// ---------------------------------------------------------------------------

export interface GrossUpParams {
    socialHealthCeiling:  number;
    unemploymentCeiling:  number;
    personalDeduction:    number;
    dependentDeduction:   number;
    dependentsCount?:     number | undefined;
    taxEnabled?:          boolean | undefined;
    isResident?:          boolean | undefined;
    nonResidentTaxRate?:  number | undefined;
    taxBrackets?:         TaxBracket[] | undefined;
    insuranceRates?:      InsuranceRates | undefined;
    /** Lương công ty đăng ký đóng BHXH cố định (mức đóng BHXH). */
    insuranceBaseSalary?: number | undefined;
    /** Đoàn phí cố định, khấu trừ sau thuế. */
    unionFee?:            number | undefined;
}

export interface GrossUpResult {
    gross:            number;
    net:              number;
    insurance:        number;
    tax:              number;
    employerInsurance: number;
    /** Tổng chi phí công ty mỗi tháng = gross + BH doanh nghiệp. */
    employerCost:     number;
}

/** Chạy công cụ tính lương coi `gross` là lương tháng thuần. */
function netAtGross(gross: number, params: GrossUpParams): ComputePayrollResult {
    return computePayroll({
        baseSalary: gross,
        attendanceRatio: 1,
        performanceRatio: 100,
        goalRatio: 100,
        insuranceBaseSalary: params.insuranceBaseSalary ?? gross,
        unionFee: params.unionFee,
        taxEnabled: params.taxEnabled,
        socialHealthCeiling: params.socialHealthCeiling,
        unemploymentCeiling: params.unemploymentCeiling,
        personalDeduction: params.personalDeduction,
        dependentDeduction: params.dependentDeduction,
        dependentsCount: params.dependentsCount,
        isResident: params.isResident,
        nonResidentTaxRate: params.nonResidentTaxRate,
        taxBrackets: params.taxBrackets,
        insuranceRates: params.insuranceRates,
    });
}

/**
 * Đảo ngược phép tính lương: tìm lương gross sao cho net khớp `targetNet`. Net
 * tăng đơn điệu theo gross nên dò nhị phân hội tụ; kết quả làm tròn VNĐ nguyên.
 */
export function grossUpFromNet(targetNet: number, params: GrossUpParams): GrossUpResult {
    if (targetNet <= 0) {
        return { gross: 0, net: 0, insurance: 0, tax: 0, employerInsurance: 0, employerCost: 0 };
    }

    let lo = targetNet;
    let hi = targetNet * 3 + 1_000_000;
    for (let i = 0; i < 60 && hi - lo > 1; i += 1) {
        const mid = Math.floor((lo + hi) / 2);
        if (netAtGross(mid, params).netSalary < targetNet) lo = mid;
        else hi = mid;
    }

    const gross = hi;
    const r = netAtGross(gross, params);
    const employerInsurance =
        r.employerSocialInsurance + r.employerHealthInsurance + r.employerUnemploymentInsurance + r.employerOccupationalInsurance;

    return {
        gross,
        net: r.netSalary,
        insurance: r.insurance,
        tax: r.tax,
        employerInsurance,
        employerCost: gross + employerInsurance,
    };
}
