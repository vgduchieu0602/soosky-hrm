/// <reference types="jest" />
import {
    computeAttendanceRatio,
    computeEffectiveBaseSalary,
    computeInsurance,
    computeOvertimePayBreakdown,
    computePayroll,
    computeProgressiveTax,
    grossUpFromNet,
    VN_INSURANCE_RATES,
    VN_PIT_BRACKETS,
} from "@modules/payroll/core/domain/services/salary-calc";
import { describe, expect, it } from "vitest";

// Số liệu tham chiếu từ share-docs/PAYROLL-FORMULA.md §7 — phải khớp TỪNG ĐỒNG.
describe("computePayroll — ví dụ nhân viên chính thức (PAYROLL-FORMULA.md §7)", () => {
    it("lương 30tr, đủ công/điểm, phụ cấp 2tr+730k, 1 người phụ thuộc, thuế bật", () => {
        const result = computePayroll({
            baseSalary: 30_000_000,
            attendanceRatio: 1,
            performanceRatio: 100,
            goalRatio: 100,
            totalTaxableAllowances: 2_000_000,
            totalNonTaxableAllowances: 730_000,
            insuranceBaseSalary: 30_000_000,
            socialHealthCeiling: 30_000_000 * 20,
            unemploymentCeiling: 30_000_000 * 20,
            personalDeduction: 11_000_000,
            dependentDeduction: 4_400_000,
            dependentsCount: 1,
            taxEnabled: true,
            isResident: true,
        });

        expect(result.proRatedBaseSalary).toBe(30_000_000);
        expect(result.totalAllowances).toBe(2_730_000);
        expect(result.grossSalary).toBe(32_730_000);
        expect(result.insurance).toBe(3_150_000);
        expect(result.taxableIncome).toBe(28_850_000);
        expect(result.taxableIncomeAfterDeduction).toBe(13_450_000);
        expect(result.tax).toBe(1_267_500);
        expect(result.netSalary).toBe(28_312_500);
    });
});

describe("computePayroll — ví dụ thực tập sinh (HUONG-DAN-TINH-LUONG.md §4)", () => {
    it("C1: đi làm 8/22 ngày — lương theo ngày công, không BH/thuế", () => {
        const result = computePayroll({
            baseSalary: 8_000_000,
            attendanceRatio: computeAttendanceRatio(8, 22),
            performanceRatio: 100,
            goalRatio: 100,
            prorateByAttendance: true,
            insuranceBaseSalary: 0,
            taxEnabled: false,
            socialHealthCeiling: 100_000_000,
            unemploymentCeiling: 100_000_000,
            personalDeduction: 11_000_000,
            dependentDeduction: 4_400_000,
        });

        expect(result.grossSalary).toBe(2_909_091);
        expect(result.insurance).toBe(0);
        expect(result.tax).toBe(0);
        expect(result.netSalary).toBe(2_909_091);
    });

    it("C2: đi làm đủ 22/22 ngày — hưởng đúng lương hợp đồng", () => {
        const result = computePayroll({
            baseSalary: 8_000_000,
            attendanceRatio: 1,
            performanceRatio: 100,
            goalRatio: 100,
            prorateByAttendance: true,
            insuranceBaseSalary: 0,
            taxEnabled: false,
            socialHealthCeiling: 100_000_000,
            unemploymentCeiling: 100_000_000,
            personalDeduction: 11_000_000,
            dependentDeduction: 4_400_000,
        });

        expect(result.grossSalary).toBe(8_000_000);
        expect(result.netSalary).toBe(8_000_000);
    });
});

describe("computePayroll — ví dụ thử việc (HUONG-DAN-TINH-LUONG.md §4)", () => {
    it("lương HĐ 20tr × 85% = 17tr, đủ công/điểm, miễn BH/đoàn phí/thuế", () => {
        const result = computePayroll({
            baseSalary: 20_000_000 * 0.85,
            attendanceRatio: 1,
            performanceRatio: 100,
            goalRatio: 100,
            insuranceBaseSalary: 0,
            unionFee: 0,
            taxEnabled: false,
            socialHealthCeiling: 100_000_000,
            unemploymentCeiling: 100_000_000,
            personalDeduction: 11_000_000,
            dependentDeduction: 4_400_000,
        });

        expect(result.proRatedBaseSalary).toBe(17_000_000);
        expect(result.grossSalary).toBe(17_000_000);
        expect(result.insurance).toBe(0);
        expect(result.netSalary).toBe(17_000_000);
    });
});

describe("computePayroll — nhân viên chính thức đủ công/đoàn phí (HUONG-DAN-TINH-LUONG.md §4 NV A)", () => {
    it("lương HĐ 20tr, mức BH cố định 577.500, đoàn phí 1% × 5.500.000 = 55.000, thuế tắt", () => {
        const result = computePayroll({
            baseSalary: 20_000_000,
            attendanceRatio: 1,
            performanceRatio: 100,
            goalRatio: 100,
            fixedInsuranceAmount: 577_500,
            unionFee: 55_000,
            taxEnabled: false,
            socialHealthCeiling: 100_000_000,
            unemploymentCeiling: 100_000_000,
            personalDeduction: 11_000_000,
            dependentDeduction: 4_400_000,
        });

        expect(result.grossSalary).toBe(20_000_000);
        expect(result.insurance).toBe(577_500);
        expect(result.unionFee).toBe(55_000);
        expect(result.tax).toBe(0);
        expect(result.netSalary).toBe(20_000_000 - 577_500 - 55_000);
    });
});

describe("computeEffectiveBaseSalary — quy tắc prorateByAttendance", () => {
    it("mặc định (prorateByAttendance=false): chỉ 20% chuyên cần theo công, hiệu suất/mục tiêu hưởng đủ", () => {
        const result = computeEffectiveBaseSalary({
            baseSalary: 10_000_000,
            attendanceRatio: 0,
            performanceRatio: 100,
            goalRatio: 100,
        });
        expect(result.attendanceComponent).toBe(0);
        expect(result.performanceComponent).toBe(6_000_000);
        expect(result.goalComponent).toBe(2_000_000);
        expect(result.proRatedBaseSalary).toBe(8_000_000);
    });

    it("prorateByAttendance=true: nghỉ không lương cả tháng (ratio=0) làm lương theo công về 0", () => {
        const result = computeEffectiveBaseSalary({
            baseSalary: 10_000_000,
            attendanceRatio: 0,
            performanceRatio: 100,
            goalRatio: 100,
            prorateByAttendance: true,
        });
        expect(result.proRatedBaseSalary).toBe(0);
    });
});

describe("computeInsurance — trần bảo hiểm", () => {
    it("áp trần khi lương vượt mức trần cấu hình", () => {
        const result = computeInsurance({
            grossSalary: 50_000_000,
            socialHealthCeiling: 40_000_000,
            unemploymentCeiling: 20_000_000,
        });
        expect(result.insuranceBase).toBe(40_000_000);
        expect(result.unemploymentInsuranceBase).toBe(20_000_000);
        expect(result.socialInsurance).toBe(Math.round(40_000_000 * 0.08));
        expect(result.unemploymentInsurance).toBe(Math.round(20_000_000 * 0.01));
    });

    it("dùng đúng tỷ lệ VN mặc định (NLĐ 10.5% / DN 21.5%)", () => {
        const result = computeInsurance({ grossSalary: 10_000_000, socialHealthCeiling: 100_000_000, unemploymentCeiling: 100_000_000 });
        const employeeTotal = VN_INSURANCE_RATES.employee.social + VN_INSURANCE_RATES.employee.health + VN_INSURANCE_RATES.employee.unemployment;
        expect(employeeTotal).toBe(10.5);
        expect(result.insurance).toBe(Math.round(10_000_000 * 0.105));
    });
});

describe("computeProgressiveTax — biểu thuế luỹ tiến VN", () => {
    it("thu nhập trong bậc 1 (≤5tr): 5%", () => {
        expect(computeProgressiveTax(3_000_000)).toBe(150_000);
    });

    it("thu nhập bắc qua nhiều bậc tính đúng theo biên (marginal)", () => {
        // 13.45tr: 5tr×5% + 5tr×10% + 3.45tr×15% = 250k+500k+517.5k = 1,267,500
        expect(computeProgressiveTax(13_450_000)).toBe(1_267_500);
    });

    it("thu nhập ≤ 0 → thuế 0", () => {
        expect(computeProgressiveTax(0)).toBe(0);
        expect(computeProgressiveTax(-500_000)).toBe(0);
    });

    it("biểu thuế có đúng 7 bậc 5%–35%", () => {
        expect(VN_PIT_BRACKETS).toHaveLength(7);
        expect(VN_PIT_BRACKETS[0]?.rate).toBe(5);
        expect(VN_PIT_BRACKETS[6]?.rate).toBe(35);
        expect(VN_PIT_BRACKETS[6]?.upTo).toBeNull();
    });
});

describe("computeOvertimePayBreakdown — OT miễn thuế phần vượt giờ thường", () => {
    it("hệ số 1.5 (ngày thường): 1.0x chịu thuế, 0.5x miễn thuế", () => {
        // baseSalary 22 ngày chuẩn → đơn giá giờ = 22,000,000/(22×8) = 125,000
        const result = computeOvertimePayBreakdown(22_000_000, 22, [{ hours: 2, dayType: "weekday" }]);
        expect(result.taxable).toBe(250_000);
        expect(result.nonTaxable).toBe(125_000);
        expect(result.total).toBe(375_000);
    });
});

describe("grossUpFromNet — đảo ngược net → gross khớp lại đúng net", () => {
    it("net=0 → gross=0", () => {
        expect(grossUpFromNet(0, { socialHealthCeiling: 1e9, unemploymentCeiling: 1e9, personalDeduction: 11_000_000, dependentDeduction: 4_400_000 }))
            .toEqual({ gross: 0, net: 0, insurance: 0, tax: 0, employerInsurance: 0, employerCost: 0 });
    });

    it("dò gross sao cho net tính lại xấp xỉ khớp mục tiêu (không thuế)", () => {
        const targetNet = 20_000_000;
        const result = grossUpFromNet(targetNet, {
            socialHealthCeiling: 1e9, unemploymentCeiling: 1e9,
            personalDeduction: 11_000_000, dependentDeduction: 4_400_000,
            taxEnabled: false,
        });
        expect(result.net).toBeGreaterThanOrEqual(targetNet);
        expect(result.net - targetNet).toBeLessThan(2);
        expect(result.gross).toBeGreaterThan(targetNet);
    });
});
