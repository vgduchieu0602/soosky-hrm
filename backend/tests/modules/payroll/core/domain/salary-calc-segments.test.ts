import { computePayroll } from "@modules/payroll/core/domain/services/salary-calc";
import { describe, expect, it } from "vitest";

/**
 * Tách dòng theo hợp đồng khi đổi hợp đồng giữa kỳ.
 *
 * Điều quan trọng nhất được kiểm ở đây: bảo hiểm và THUẾ vẫn tính MỘT LẦN trên
 * tổng tháng. Nếu ai đó "tối giản" bằng cách tính lương từng đoạn rồi cộng cả
 * net lại, mỗi đoạn sẽ được một suất giảm trừ và một bậc thuế riêng → thiếu
 * thuế, và test này sẽ đỏ.
 */
const MONTH_BASE = {
    performanceRatio:    100,
    goalRatio:           100,
    socialHealthCeiling: 46_800_000,
    unemploymentCeiling: 99_200_000,
    personalDeduction:   11_000_000,
    dependentDeduction:  4_400_000,
    taxEnabled:          true,
    // Nền BH cố định để phần bảo hiểm không nhiễu vào phép so sánh.
    fixedInsuranceAmount: 0,
};

describe("computePayroll — đoạn hợp đồng", () => {
    it("không truyền segments: giữ nguyên hành vi cũ", () => {
        const result = computePayroll({
            ...MONTH_BASE,
            baseSalary:      20_000_000,
            attendanceRatio: 1,
        });

        expect(result.proRatedBaseSalary).toBe(20_000_000);
    });

    it("hai đoạn nửa tháng: lương theo công = tổng phần của từng đoạn", () => {
        // 11/22 ngày ở hợp đồng thử việc 16tr (đã áp 85% = 13.6tr),
        // 11/22 ngày ở hợp đồng chính thức 20tr.
        const result = computePayroll({
            ...MONTH_BASE,
            baseSalary:      20_000_000,   // chỉ để tham chiếu khi có segments
            attendanceRatio: 1,
            segments: [
                { baseSalary: 13_600_000, attendanceRatio: 0.5, periodShare: 0.5 },
                { baseSalary: 20_000_000, attendanceRatio: 0.5, periodShare: 0.5 },
            ],
        });

        // 13.6tr*0.5 + 20tr*0.5 = 16.8tr
        expect(result.proRatedBaseSalary).toBe(16_800_000);
    });

    it("một đoạn phủ cả kỳ cho ra ĐÚNG kết quả như không dùng segments", () => {
        const withoutSegments = computePayroll({
            ...MONTH_BASE, baseSalary: 20_000_000, attendanceRatio: 0.8,
        });
        const withOneSegment = computePayroll({
            ...MONTH_BASE, baseSalary: 20_000_000, attendanceRatio: 0.8,
            segments: [{ baseSalary: 20_000_000, attendanceRatio: 0.8, periodShare: 1 }],
        });

        expect(withOneSegment).toEqual(withoutSegments);
    });

    it("THUẾ tính một lần trên tổng tháng, KHÔNG cộng thuế từng đoạn", () => {
        const segmented = computePayroll({
            ...MONTH_BASE,
            baseSalary:      20_000_000,
            attendanceRatio: 1,
            segments: [
                { baseSalary: 20_000_000, attendanceRatio: 0.5, periodShare: 0.5 },
                { baseSalary: 20_000_000, attendanceRatio: 0.5, periodShare: 0.5 },
            ],
        });

        // Chia đôi cùng một mức lương thành hai đoạn thì tổng thu nhập không đổi,
        // nên thuế phải bằng đúng trường hợp một đoạn duy nhất.
        const single = computePayroll({
            ...MONTH_BASE, baseSalary: 20_000_000, attendanceRatio: 1,
        });

        expect(segmented.proRatedBaseSalary).toBe(single.proRatedBaseSalary);
        expect(segmented.tax).toBe(single.tax);
        expect(segmented.netSalary).toBe(single.netSalary);

        // Và thuế phải > 0 ở mức lương này — nếu bằng 0 thì phép so sánh trên
        // không chứng minh được gì.
        expect(single.tax).toBeGreaterThan(0);
    });

    it("mảng segments rỗng coi như không có segments", () => {
        const result = computePayroll({
            ...MONTH_BASE, baseSalary: 20_000_000, attendanceRatio: 1, segments: [],
        });

        expect(result.proRatedBaseSalary).toBe(20_000_000);
    });
});
