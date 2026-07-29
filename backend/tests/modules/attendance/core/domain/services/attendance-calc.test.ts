/// <reference types="jest" />
import { matchShifts, vnDateKey } from "@modules/attendance/core/domain/services/attendance-calc";
import { describe, expect, it } from "vitest";

function atVN(hh: number, mm: number): Date {
    // 2026-01-05 (Monday) tại giờ VN, biểu diễn dạng UTC (VN = UTC+7).
    return new Date(Date.UTC(2026, 0, 5, hh - 7, mm));
}

describe("matchShifts", () => {
    const morning   = { id: "morning",   startTime: "08:00", endTime: "12:00", breakMinutes: 0 };
    const afternoon = { id: "afternoon", startTime: "13:00", endTime: "17:00", breakMinutes: 0 };

    it("làm đủ cả hai ca => công 1.0, mỗi ca 0.5", () => {
        const result = matchShifts([morning, afternoon], atVN(8, 0), atVN(17, 0));
        expect(result.totalCong).toBe(1);
        expect(result.shifts.every(s => s.counted)).toBe(true);
        expect(result.shifts[0]?.congWeight).toBe(0.5);
    });

    it("chỉ làm ca sáng => công 0.5, ca chiều vắng", () => {
        const result = matchShifts([morning, afternoon], atVN(8, 0), atVN(12, 0));
        expect(result.totalCong).toBe(0.5);
        const afternoonResult = result.shifts.find(s => s.shiftId === "afternoon");
        expect(afternoonResult?.counted).toBe(false);
        expect(afternoonResult?.status).toBe("absent");
    });

    it("đi trễ không làm mất công (chỉ ghi nhận lateMinutes)", () => {
        const result = matchShifts([morning], atVN(8, 30), atVN(12, 0));
        const shift = result.shifts[0]!;
        expect(shift.counted).toBe(true);
        expect(shift.status).toBe("late");
        expect(shift.lateMinutes).toBe(30);
    });

    it("về sớm vượt ngưỡng (>120') làm mất công của ca", () => {
        const result = matchShifts([morning], atVN(8, 0), atVN(9, 30));
        const shift = result.shifts[0]!;
        expect(shift.counted).toBe(false);
        expect(shift.status).toBe("early_leave");
        expect(result.totalCong).toBe(0);
    });

    it("về sớm trong ngưỡng cho phép vẫn được tính công", () => {
        const result = matchShifts([morning], atVN(8, 0), atVN(11, 0));
        const shift = result.shifts[0]!;
        expect(shift.counted).toBe(true);
        expect(shift.earlyMinutes).toBeGreaterThan(0);
    });

    it("không check-in/out => tất cả ca vắng, công 0", () => {
        const result = matchShifts([morning, afternoon], null, null);
        expect(result.totalCong).toBe(0);
        expect(result.shifts.every(s => !s.counted)).toBe(true);
    });
});

describe("vnDateKey", () => {
    it("chuẩn hoá về nửa đêm UTC theo ngày lịch giờ VN", () => {
        const key = vnDateKey(atVN(23, 30));
        expect(key.getUTCHours()).toBe(0);
        expect(key.getUTCDate()).toBe(5);
    });
});
