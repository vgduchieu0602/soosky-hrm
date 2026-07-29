/// <reference types="jest" />
import { buildHolidayChecker, carryoverWindow, countWorkingDays, poolAnnualRemaining } from "@modules/attendance/core/domain/services/leave-calc";
import { describe, expect, it } from "vitest";

function d(y: number, m: number, day: number): Date {
    return new Date(Date.UTC(y, m - 1, day));
}

describe("countWorkingDays", () => {
    it("loại cuối tuần khỏi số ngày làm việc", () => {
        // 2026-01-05 (Mon) .. 2026-01-11 (Sun) => 5 ngày làm việc
        const days = countWorkingDays(d(2026, 1, 5), d(2026, 1, 11), false, () => false);
        expect(days).toBe(5);
    });

    it("nửa ngày rơi vào ngày làm việc => 0.5", () => {
        const days = countWorkingDays(d(2026, 1, 5), d(2026, 1, 5), true, () => false);
        expect(days).toBe(0.5);
    });

    it("nửa ngày rơi vào cuối tuần => 0 (không trừ nhầm phép)", () => {
        const days = countWorkingDays(d(2026, 1, 10), d(2026, 1, 10), true, () => false); // Sat
        expect(days).toBe(0);
    });

    it("loại ngày lễ khỏi số ngày làm việc", () => {
        const isHoliday = (day: Date) => day.getTime() === d(2026, 1, 6).getTime();
        const days = countWorkingDays(d(2026, 1, 5), d(2026, 1, 7), false, isHoliday);
        expect(days).toBe(2);
    });
});

describe("buildHolidayChecker", () => {
    it("khớp ngày lễ lặp lại theo mm-dd bất kể năm", () => {
        const isHoliday = buildHolidayChecker([{ date: d(2020, 9, 2), isRecurring: true }]);
        expect(isHoliday(d(2026, 9, 2))).toBe(true);
        expect(isHoliday(d(2026, 9, 3))).toBe(false);
    });

    it("ngày lễ cố định chỉ khớp đúng năm đó", () => {
        const isHoliday = buildHolidayChecker([{ date: d(2026, 4, 30), isRecurring: false }]);
        expect(isHoliday(d(2026, 4, 30))).toBe(true);
        expect(isHoliday(d(2027, 4, 30))).toBe(false);
    });
});

describe("carryoverWindow / poolAnnualRemaining", () => {
    it("bể phép năm cộng dồn trong 3 năm gần nhất", () => {
        const { from, to } = carryoverWindow(2026);
        expect(from).toBe(2024);
        expect(to).toBe(2026);
    });

    it("số phép còn lại = tổng entitled - tổng used, không âm", () => {
        const remaining = poolAnnualRemaining([
            { entitled: 12, used: 12 },
            { entitled: 12, used: 5 },
            { entitled: 12, used: 0 },
        ]);
        expect(remaining).toBe(19);
    });

    it("không trả về số âm khi used vượt entitled", () => {
        const remaining = poolAnnualRemaining([{ entitled: 5, used: 10 }]);
        expect(remaining).toBe(0);
    });
});
