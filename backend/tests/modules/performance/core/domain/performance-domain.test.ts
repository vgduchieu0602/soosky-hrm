import CriteriaSet from "@modules/performance/core/domain/entities/CriteriaSet";
import PerformanceReview from "@modules/performance/core/domain/entities/PerformanceReview";
import { computeReviewTotals } from "@modules/performance/core/domain/services/score-calc";
import CriterionKind from "@modules/performance/core/domain/value-objects/CriterionKind";
import { describe, expect, it } from "vitest";

let counter = 0;
const nextId = (): string => `crit-${++counter}`;

function criteriaSet(): CriteriaSet {
    return CriteriaSet.create({ id: "cs-1", name: "Bộ tiêu chí 2026", description: null, createdBy: "hr-1" });
}

/** Hai tiêu chí mỗi nhóm, trọng số 60/40 — đủ để phân biệt bình quân gia quyền với bình quân thường. */
function threeKindCriteria() {
    return [
        { code: "KPI-1", name: "Doanh số", kind: CriterionKind.KPI, weight: 60 },
        { code: "KPI-2", name: "Chất lượng", kind: CriterionKind.KPI, weight: 40 },
        { code: "GOAL-1", name: "Mục tiêu quý", kind: CriterionKind.GOAL, weight: 100 },
        { code: "PERF-1", name: "Thái độ", kind: CriterionKind.PERFORMANCE, weight: 100 },
    ];
}

function review(criteriaVersion = 1): PerformanceReview {
    return PerformanceReview.create({
        id: "rv-1", cycleId: "cy-1", employeeId: "emp-1",
        reviewerUserId: "acc-manager", criteriaSetId: "cs-1", criteriaVersion,
    });
}

describe("CriteriaSet — phiên bản bất biến", () => {
    it("số phiên bản tự tăng, phiên bản cũ giữ nguyên khi phát hành bản mới", () => {
        const set = criteriaSet();

        const v1 = set.publishVersion({ criteria: threeKindCriteria(), publishedBy: "hr-1", newCriterionId: nextId });
        expect(v1.version).toBe(1);

        const v2 = set.publishVersion({
            criteria: [{ code: "KPI-9", name: "Chỉ tiêu mới", kind: CriterionKind.KPI, weight: 100 }],
            publishedBy: "hr-1",
            newCriterionId: nextId,
        });
        expect(v2.version).toBe(2);

        // Đây là chốt chặn cho yêu cầu "sửa tiêu chí không đổi lịch sử": bản 1
        // vẫn còn nguyên 4 tiêu chí sau khi bản 2 ra đời.
        expect(set.getVersion(1)?.criteria).toHaveLength(4);
        expect(set.getVersion(2)?.criteria).toHaveLength(1);
        expect(set.latestVersion?.version).toBe(2);
    });

    it("tổng trọng số trong MỘT nhóm phải bằng 100", () => {
        const set = criteriaSet();

        expect(() => set.publishVersion({
            criteria: [
                { code: "KPI-1", name: "A", kind: CriterionKind.KPI, weight: 60 },
                { code: "KPI-2", name: "B", kind: CriterionKind.KPI, weight: 30 },
            ],
            publishedBy: "hr-1",
            newCriterionId: nextId,
        })).toThrow(/sum to 100/);
    });

    it("chặn mã tiêu chí trùng và danh sách rỗng", () => {
        const set = criteriaSet();

        expect(() => set.publishVersion({
            criteria: [
                { code: "KPI-1", name: "A", kind: CriterionKind.KPI, weight: 50 },
                { code: "KPI-1", name: "B", kind: CriterionKind.KPI, weight: 50 },
            ],
            publishedBy: "hr-1",
            newCriterionId: nextId,
        })).toThrow(/Duplicated criterion code/);

        expect(() => set.publishVersion({ criteria: [], publishedBy: "hr-1", newCriterionId: nextId }))
            .toThrow(/at least one criterion/);
    });
});

describe("computeReviewTotals", () => {
    it("bình quân GIA QUYỀN theo từng nhóm", () => {
        const set = criteriaSet();
        const version = set.publishVersion({ criteria: threeKindCriteria(), publishedBy: "hr-1", newCriterionId: nextId });
        const [kpi1, kpi2, goal1, perf1] = version.criteria;

        const totals = computeReviewTotals(version.criteria, [
            { criterionId: kpi1!.id, score: 100 },
            { criterionId: kpi2!.id, score: 50 },
            { criterionId: goal1!.id, score: 80 },
            { criterionId: perf1!.id, score: 90 },
        ]);

        // 100*60% + 50*40% = 80 (bình quân thường sẽ ra 75)
        expect(totals.kpiScore).toBe(80);
        expect(totals.goalScore).toBe(80);
        expect(totals.performanceScore).toBe(90);
    });

    it("thiếu điểm một tiêu chí → lỗi, nêu rõ mã tiêu chí", () => {
        const set = criteriaSet();
        const version = set.publishVersion({ criteria: threeKindCriteria(), publishedBy: "hr-1", newCriterionId: nextId });
        const [kpi1] = version.criteria;

        expect(() => computeReviewTotals(version.criteria, [{ criterionId: kpi1!.id, score: 100 }]))
            .toThrow(/Missing scores for criteria/);
    });

    it("điểm cho tiêu chí không thuộc phiên bản → lỗi", () => {
        const set = criteriaSet();
        const version = set.publishVersion({ criteria: threeKindCriteria(), publishedBy: "hr-1", newCriterionId: nextId });

        expect(() => computeReviewTotals(version.criteria,
            version.criteria.map(c => ({ criterionId: c.id, score: 80 })).concat([{ criterionId: "la-hoac", score: 10 }])))
            .toThrow(/unknown criterion/);
    });

    it("nhóm không có tiêu chí nào → 100 (không xoá phần lương gắn nhóm đó)", () => {
        const set = criteriaSet();
        const version = set.publishVersion({
            criteria: [{ code: "KPI-1", name: "A", kind: CriterionKind.KPI, weight: 100 }],
            publishedBy: "hr-1",
            newCriterionId: nextId,
        });

        const totals = computeReviewTotals(version.criteria, [{ criterionId: version.criteria[0]!.id, score: 70 }]);

        expect(totals.kpiScore).toBe(70);
        expect(totals.goalScore).toBe(100);
        expect(totals.performanceScore).toBe(100);
    });
});

describe("PerformanceReview — vòng đời", () => {
    const totals = { kpiScore: 80, goalScore: 85, performanceScore: 90 };
    const scores = [{ criterionId: "c1", score: 80 }];

    it("đường đi đầy đủ: chấm → duyệt → xác nhận → khoá", () => {
        const rv = review();
        expect(rv.status).toBe("draft");

        rv.score({ scores, totals });
        expect(rv.status).toBe("submitted");
        expect(rv.totals).toEqual(totals);

        rv.approve("hr-1", "OK");
        expect(rv.status).toBe("approved");

        rv.acknowledge();
        expect(rv.status).toBe("acknowledged");

        const snapshot = rv.lock("hr-1");
        expect(rv.status).toBe("locked");
        expect(snapshot).toEqual(totals);
        expect(rv.lockedBy).toBe("hr-1");
    });

    it("không duyệt được phiếu chưa chấm; không khoá được phiếu chưa xác nhận", () => {
        const rv = review();
        expect(() => rv.approve("hr-1", null)).toThrow(/Cannot approve/);

        rv.score({ scores, totals });
        rv.approve("hr-1", null);
        expect(() => rv.lock("hr-1")).toThrow(/Cannot lock/);
    });

    it("phiếu đã khoá là BẤT BIẾN: không chấm lại, không duyệt lại, không khoá lại", () => {
        const rv = review();
        rv.score({ scores, totals });
        rv.approve("hr-1", null);
        rv.acknowledge();
        rv.lock("hr-1");

        expect(() => rv.score({ scores, totals })).toThrow(/Cannot score/);
        expect(() => rv.approve("hr-1", null)).toThrow(/Cannot approve/);
        expect(() => rv.lock("hr-1")).toThrow(/Cannot lock/);
        expect(() => rv.requestChanges("sửa lại")).toThrow(/Cannot request changes/);
    });

    it("khiếu nại: lý do bắt buộc và KHÔNG bị xoá khi HR xử lý", () => {
        const rv = review();
        rv.score({ scores, totals });
        rv.approve("hr-1", null);

        expect(() => rv.appeal("   ")).toThrow(/must not be empty/);

        rv.appeal("Điểm mục tiêu chưa tính dự án X");
        expect(rv.status).toBe("appealed");

        rv.resolveAppeal("Đã đối chiếu, giữ nguyên điểm", false);
        expect(rv.status).toBe("acknowledged");
        // Dấu vết của cả hai phía còn nguyên — cần khi có tranh chấp về sau.
        expect(rv.appealNote).toBe("Điểm mục tiêu chưa tính dự án X");
        expect(rv.hrNote).toBe("Đã đối chiếu, giữ nguyên điểm");
    });

    it("HR cho chấm lại thì phiếu về draft và mất dấu duyệt cũ", () => {
        const rv = review();
        rv.score({ scores, totals });
        rv.approve("hr-1", null);
        rv.appeal("Chưa đồng ý");

        rv.resolveAppeal("Cho chấm lại", true);
        expect(rv.status).toBe("draft");
        expect(rv.approvedAt).toBeNull();
        expect(rv.approvedBy).toBeNull();
    });

    it("điểm ngoài thang 0..100 bị chặn ngay ở domain", () => {
        const rv = review();
        expect(() => rv.score({ scores: [{ criterionId: "c1", score: 120 }], totals })).toThrow(/between 0 and 100/);
    });

    it("không đổi người chấm sau khi đã duyệt", () => {
        const rv = review();
        rv.score({ scores, totals });
        rv.approve("hr-1", null);

        expect(() => rv.assignReviewer("acc-khac")).toThrow(/Cannot reassign reviewer/);
    });
});
