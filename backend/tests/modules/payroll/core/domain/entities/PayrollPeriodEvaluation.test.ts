import PayrollPeriod from "@modules/payroll/core/domain/entities/PayrollPeriod";
import PeriodName from "@modules/payroll/core/domain/value-objects/PeriodName";
import { describe, expect, it } from "vitest";

function period(): PayrollPeriod {
    return PayrollPeriod.create({
        id:               "period-1",
        name:             PeriodName.create("2026-07"),
        startDate:        new Date("2026-07-01T00:00:00.000Z"),
        endDate:          new Date("2026-07-31T00:00:00.000Z"),
        payDate:          new Date("2026-08-05T00:00:00.000Z"),
        standardWorkDays: 22,
        createdBy:        "hr-1",
    });
}

describe("PayrollPeriod evaluations", () => {
    it("keeps manual performance and goal scores as two independent payroll inputs", () => {
        const payrollPeriod = period();

        payrollPeriod.upsertEvaluation({
            employeeId:       "emp-1",
            performanceScore: 75,
            goalScore:        90,
            updatedBy:        "manager-1",
        });

        expect(payrollPeriod.getEvaluation("emp-1")).toMatchObject({
            employeeId:       "emp-1",
            performanceScore: 75,
            goalScore:        90,
            updatedBy:        "manager-1",
        });
        expect(payrollPeriod.hasCompleteEvaluationFor("emp-1")).toBe(true);
    });

    it("rejects a score outside the 0–100 evaluation scale", () => {
        expect(() => period().upsertEvaluation({
            employeeId:       "emp-1",
            performanceScore: 101,
            goalScore:        90,
            updatedBy:        "manager-1",
        })).toThrow("between 0 and 100");
    });
});
