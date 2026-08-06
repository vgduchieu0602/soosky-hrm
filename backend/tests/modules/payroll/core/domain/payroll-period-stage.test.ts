import PayrollPeriod from "@modules/payroll/core/domain/entities/PayrollPeriod";
import PayrollStageInvalidError from "@modules/payroll/core/domain/errors/PayrollStageInvalidError";
import PeriodName from "@modules/payroll/core/domain/value-objects/PeriodName";
import { describe, expect, it } from "vitest";

/**
 * Quy trình 7 bước của kỳ lương.
 *
 * Điều được bảo vệ ở đây là THỨ TỰ: không duyệt trước khi HR soát, không chi trả
 * trước khi duyệt, và mọi lần đổi đầu vào (tính lại, mở khoá công) đều xoá các
 * xác nhận đã có thay vì để kỳ đứng ở bước cũ với số mới.
 */
function buildPeriod(): PayrollPeriod {
    return PayrollPeriod.create({
        id: "period-1", name: PeriodName.create("2026-06"),
        startDate: new Date("2026-06-01"), endDate: new Date("2026-06-30"),
        payDate: new Date("2026-07-05"), standardWorkDays: 22, createdBy: "hr-1",
    });
}

/** Đưa kỳ tới bước tính thử: chốt công + chốt đánh giá + đã chạy tính lương. */
function toTrial(period: PayrollPeriod, preparedBy = "hr-1"): PayrollPeriod {
    period.lockAttendance("hr-1");
    period.lockEvaluations("hr-1");
    period.markPrepared(preparedBy);
    return period;
}

describe("PayrollPeriod — quy trình 7 bước", () => {
    it("kỳ mới ở bước open; chốt công đưa sang đối soát; tính lương đưa sang tính thử", () => {
        const period = buildPeriod();
        expect(period.stage).toBe("open");

        period.lockAttendance("hr-1");
        expect(period.stage).toBe("reconciling");

        period.markPrepared("hr-1");
        expect(period.stage).toBe("trial");
    });

    it("không duyệt được khi HR chưa soát", () => {
        const period = toTrial(buildPeriod());
        expect(() => period.markApproved()).toThrow(PayrollStageInvalidError);

        period.markHrReviewed("hr-1");
        expect(period.stage).toBe("hr_reviewed");
        expect(period.hrReviewedBy).toBe("hr-1");

        period.markApproved();
        expect(period.stage).toBe("approved");
        // `status` cũ vẫn được giữ đồng bộ cho frontend đang đọc nó.
        expect(period.status).toBe("processing");
    });

    it("mark paid chỉ từ approved", () => {
        const period = toTrial(buildPeriod());
        expect(() => period.markPaid()).toThrow(PayrollStageInvalidError);

        period.markHrReviewed("hr-1");
        expect(() => period.markPaid()).toThrow(PayrollStageInvalidError);

        period.markApproved();
        period.markPaid();
        expect(period.stage).toBe("paid");
        expect(period.status).toBe("paid");
    });

    it("chốt kỳ chỉ sau khi lương đã duyệt", () => {
        const early = toTrial(buildPeriod());
        early.markHrReviewed("hr-1");
        expect(() => early.close("admin-1")).toThrow(PayrollStageInvalidError);

        early.markApproved();
        early.close("admin-1");
        expect(early.stage).toBe("closed");
        expect(early.status).toBe("closed");
    });

    it("tính lại xoá dấu HR đã soát — bảng lương mới phải soát lại", () => {
        const period = toTrial(buildPeriod());
        period.markHrReviewed("hr-1");

        period.markPrepared("hr-1");

        expect(period.stage).toBe("trial");
        expect(period.hrReviewedBy).toBeNull();
        expect(period.hrReviewedAt).toBeNull();
    });

    it("mở khoá công lùi kỳ về đối soát và xoá dấu đã soát", () => {
        const period = toTrial(buildPeriod());
        period.markHrReviewed("hr-1");
        period.markApproved();

        period.unlockAttendance();

        expect(period.stage).toBe("reconciling");
        expect(period.hrReviewedBy).toBeNull();
    });

    it("mở khoá cả công lẫn đánh giá đưa kỳ về hẳn open", () => {
        const period = toTrial(buildPeriod());
        period.unlockAttendance();
        period.unlockEvaluations();

        expect(period.stage).toBe("open");
    });

    it("mở lại kỳ đã chốt quay về bước tính thử, phải soát và duyệt lại", () => {
        const period = toTrial(buildPeriod());
        period.markHrReviewed("hr-1");
        period.markApproved();
        period.close("admin-1");

        period.reopen();

        expect(period.stage).toBe("trial");
        expect(period.status).toBe("open");
        expect(period.hrReviewedBy).toBeNull();
        expect(() => period.markApproved()).toThrow(PayrollStageInvalidError);
    });

    it("kỳ đã chi trả: tính lại không kéo bước về trial", () => {
        const period = toTrial(buildPeriod());
        period.markHrReviewed("hr-1");
        period.markApproved();
        period.markPaid();

        period.markPrepared("hr-1");

        expect(period.stage).toBe("paid");
    });
});
