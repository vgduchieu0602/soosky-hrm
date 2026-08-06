import PayrollVariance from "@modules/payroll/core/domain/entities/PayrollVariance";
import VarianceSignoffInvalidError from "@modules/payroll/core/domain/errors/VarianceSignoffInvalidError";
import { computePayroll } from "@modules/payroll/core/domain/services/salary-calc";
import { describe, expect, it } from "vitest";

const MONTH_BASE = {
    baseSalary:          20_000_000,
    attendanceRatio:     1,
    performanceRatio:    100,
    goalRatio:           100,
    socialHealthCeiling: 46_800_000,
    unemploymentCeiling: 99_200_000,
    personalDeduction:   11_000_000,
    dependentDeduction:  4_400_000,
    taxEnabled:          true,
    fixedInsuranceAmount: 0,
};

/**
 * Chạy song song hai phiên bản công thức.
 *
 * `v1` phải cho ra ĐÚNG hành vi trước khi có tách đoạn hợp đồng và hồi tố —
 * nếu không thì bảng đối soát so hai thứ không ai từng chạy, và mọi chênh lệch
 * đọc được đều vô nghĩa.
 */
describe("computePayroll — phiên bản engine", () => {
    it("v1 bỏ qua segments: dùng một mức lương cho cả kỳ", () => {
        const input = {
            ...MONTH_BASE,
            segments: [
                { baseSalary: 13_600_000, attendanceRatio: 0.5, periodShare: 0.5 },
                { baseSalary: 20_000_000, attendanceRatio: 0.5, periodShare: 0.5 },
            ],
        };

        const v1 = computePayroll(input, "v1");
        const v2 = computePayroll(input, "v2");

        // v1 = 20tr nguyên (không biết nửa tháng đầu chỉ hưởng 13.6tr).
        expect(v1.proRatedBaseSalary).toBe(20_000_000);
        expect(v2.proRatedBaseSalary).toBe(16_800_000);
        // Chênh lệch này chính là thứ bảng đối soát phải hiện ra.
        expect(v2.netSalary).toBeLessThan(v1.netSalary);
    });

    it("v1 bỏ qua hồi tố: truy lĩnh/truy thu không vào lương", () => {
        const input = {
            ...MONTH_BASE,
            totalRetroClaims:    3_000_000,
            totalRetroClawbacks: 1_000_000,
        };

        const v1 = computePayroll(input, "v1");
        const v2 = computePayroll(input, "v2");
        const plain = computePayroll(MONTH_BASE, "v1");

        expect(v1.totalRetroClaims).toBe(0);
        expect(v1.totalRetroClawbacks).toBe(0);
        expect(v1.netSalary).toBe(plain.netSalary);

        expect(v2.totalRetroClaims).toBe(3_000_000);
        expect(v2.netSalary).toBe(v1.netSalary + 3_000_000 - 1_000_000 - (v2.tax - v1.tax));
    });

    it("không có segments cũng không có hồi tố: hai phiên bản khớp tuyệt đối", () => {
        expect(computePayroll(MONTH_BASE, "v1")).toEqual(computePayroll(MONTH_BASE, "v2"));
    });
});

function buildVariance(): PayrollVariance {
    return PayrollVariance.detect({
        id:              "variance-1",
        payrollPeriodId: "period-1",
        employeeId:      "emp-1",
        baselineEngine:  "v1",
        targetEngine:    "v2",
        baselineNet:     18_000_000,
        targetNet:       16_500_000,
        fields:          [{ field: "netSalary", baseline: 18_000_000, target: 16_500_000 }],
        detectedBy:      "hr-1",
    });
}

describe("PayrollVariance — ký xác nhận chênh lệch", () => {
    it("diff = engine mới trừ engine cũ; chưa ký thì isSigned false", () => {
        const variance = buildVariance();
        expect(variance.diff).toBe(-1_500_000);
        expect(variance.isSigned).toBe(false);
    });

    it("ký phải kèm giải thích thực chất, không nhận 'ok'", () => {
        const variance = buildVariance();
        expect(() => variance.sign("hr-1", "ok")).toThrow(VarianceSignoffInvalidError);
        expect(() => variance.sign("hr-1", "   ")).toThrow(VarianceSignoffInvalidError);

        variance.sign("hr-1", "Nua dau thang con thu viec 85%, engine cu tinh nguyen luong chinh thuc");
        expect(variance.isSigned).toBe(true);
        expect(variance.signedBy).toBe("hr-1");
    });

    it("không ký hai lần", () => {
        const variance = buildVariance();
        variance.sign("hr-1", "Doi hop dong giua ky, engine cu khong tach doan");
        expect(() => variance.sign("hr-2", "Ky lai lan hai cho chac")).toThrow(VarianceSignoffInvalidError);
    });

    it("số chênh lệch ĐỔI thì chữ ký cũ mất hiệu lực", () => {
        const variance = buildVariance();
        variance.sign("hr-1", "Doi hop dong giua ky, engine cu khong tach doan");

        variance.redetect({
            baselineNet: 18_000_000, targetNet: 17_000_000,
            fields: [{ field: "netSalary", baseline: 18_000_000, target: 17_000_000 }],
            detectedBy: "hr-1",
        });

        // Lời giải thích cũ không được bảo lãnh cho con số mới.
        expect(variance.isSigned).toBe(false);
        expect(variance.explanation).toBeNull();
        expect(variance.diff).toBe(-1_000_000);
    });

    it("chạy lại đối soát mà số KHÔNG đổi thì giữ nguyên chữ ký", () => {
        const variance = buildVariance();
        variance.sign("hr-1", "Doi hop dong giua ky, engine cu khong tach doan");

        variance.redetect({
            baselineNet: 18_000_000, targetNet: 16_500_000,
            fields: [{ field: "netSalary", baseline: 18_000_000, target: 16_500_000 }],
            detectedBy: "hr-2",
        });

        expect(variance.isSigned).toBe(true);
        expect(variance.signedBy).toBe("hr-1");
        expect(variance.detectedBy).toBe("hr-2");
    });
});
