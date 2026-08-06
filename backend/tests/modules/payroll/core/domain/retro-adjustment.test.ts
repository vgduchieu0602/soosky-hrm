import { computePayroll } from "@modules/payroll/core/domain/services/salary-calc";
import RetroAdjustment from "@modules/payroll/core/domain/entities/RetroAdjustment";
import RetroAdjustmentInvalidError from "@modules/payroll/core/domain/errors/RetroAdjustmentInvalidError";
import { describe, expect, it } from "vitest";

function buildAdjustment(overrides: Partial<Parameters<typeof RetroAdjustment.create>[0]> = {}) {
    return RetroAdjustment.create({
        id:             "retro-1",
        employeeId:     "emp-1",
        kind:           "claim",
        amount:         1_200_000,
        taxable:        true,
        originPeriodId: "period-10",
        payoutPeriodId: "period-11",
        reason:         "Tinh thieu phu cap thang 10",
        createdBy:      "hr-1",
        ...overrides,
    });
}

describe("RetroAdjustment", () => {
    it("số tiền luôn dương; chiều tiền do kind quyết định", () => {
        expect(() => buildAdjustment({ amount: -500_000 })).toThrow(RetroAdjustmentInvalidError);
        expect(() => buildAdjustment({ amount: 0 })).toThrow(RetroAdjustmentInvalidError);
    });

    it("bắt buộc có lý do", () => {
        expect(() => buildAdjustment({ reason: "   " })).toThrow(RetroAdjustmentInvalidError);
    });

    it("kỳ gốc phải khác kỳ chi trả — cùng kỳ thì đó là thưởng/khấu trừ thường", () => {
        expect(() => buildAdjustment({ originPeriodId: "period-11" })).toThrow(RetroAdjustmentInvalidError);
    });

    it("truy thu luôn không chịu thuế: khấu trừ sau thuế nên cờ taxable vô nghĩa", () => {
        const clawback = buildAdjustment({ kind: "clawback", taxable: true });
        expect(clawback.taxable).toBe(false);
    });

    it("huỷ giữ lại bản ghi kèm người huỷ + lý do, không huỷ hai lần", () => {
        const adjustment = buildAdjustment();
        adjustment.cancel("hr-2", "Nhap sai so tien");

        expect(adjustment.status).toBe("cancelled");
        expect(adjustment.isActive).toBe(false);
        expect(adjustment.cancelledBy).toBe("hr-2");
        expect(adjustment.cancelReason).toBe("Nhap sai so tien");

        expect(() => adjustment.cancel("hr-2", "lan hai")).toThrow(RetroAdjustmentInvalidError);
    });

    it("huỷ phải có lý do", () => {
        const adjustment = buildAdjustment();
        expect(() => adjustment.cancel("hr-2", "")).toThrow(RetroAdjustmentInvalidError);
    });
});

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

describe("computePayroll — hồi tố", () => {
    it("truy lĩnh cộng vào gross và CHỊU thuế ở kỳ nhận tiền", () => {
        const plain = computePayroll({ ...MONTH_BASE });
        const withClaim = computePayroll({ ...MONTH_BASE, totalRetroClaims: 3_000_000 });

        expect(withClaim.grossSalary).toBe(plain.grossSalary + 3_000_000);
        expect(withClaim.totalRetroClaims).toBe(3_000_000);
        // Thuế TNCN tính theo kỳ NHẬN tiền, nên truy lĩnh làm thuế tăng.
        expect(withClaim.tax).toBeGreaterThan(plain.tax);
        expect(withClaim.netSalary).toBeGreaterThan(plain.netSalary);
    });

    it("phần truy lĩnh miễn thuế không làm tăng thuế", () => {
        const plain = computePayroll({ ...MONTH_BASE });
        const nonTaxable = computePayroll({
            ...MONTH_BASE, totalRetroClaims: 3_000_000, totalNonTaxableRetroClaims: 3_000_000,
        });

        expect(nonTaxable.grossSalary).toBe(plain.grossSalary + 3_000_000);
        expect(nonTaxable.tax).toBe(plain.tax);
        expect(nonTaxable.netSalary).toBe(plain.netSalary + 3_000_000);
    });

    it("truy thu khấu trừ SAU thuế: net giảm đúng số, thuế không đổi", () => {
        const plain = computePayroll({ ...MONTH_BASE });
        const withClawback = computePayroll({ ...MONTH_BASE, totalRetroClawbacks: 2_000_000 });

        expect(withClawback.grossSalary).toBe(plain.grossSalary);
        // Thuế của kỳ gốc đã nộp trên số tiền đó; trừ trước thuế lần nữa = giảm thuế hai lần.
        expect(withClawback.tax).toBe(plain.tax);
        expect(withClawback.totalDeductions).toBe(plain.totalDeductions + 2_000_000);
        expect(withClawback.netSalary).toBe(plain.netSalary - 2_000_000);
    });

    it("truy thu vượt lương tháng: net chặn ở 0, không ra số âm", () => {
        const result = computePayroll({ ...MONTH_BASE, totalRetroClawbacks: 999_000_000 });
        expect(result.netSalary).toBe(0);
    });
});
