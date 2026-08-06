import CriteriaSetInvalidError from "@modules/performance/core/domain/errors/CriteriaSetInvalidError";

/**
 * Nhóm của một tiêu chí. Ba nhóm này KHÔNG tuỳ ý mở rộng: chúng ánh xạ đúng ba
 * con số mà bảng lương cần (`performanceRatio`, `goalRatio`) và báo cáo KPI.
 * Thêm nhóm thứ tư nghĩa là phải quyết định nó vào lương thế nào trước.
 */
export default class CriterionKind {
    static readonly KPI         = new CriterionKind("kpi");
    static readonly GOAL        = new CriterionKind("goal");
    static readonly PERFORMANCE = new CriterionKind("performance");

    private static readonly ALL = [CriterionKind.KPI, CriterionKind.GOAL, CriterionKind.PERFORMANCE];

    private constructor(
        public readonly value: string,
    ) {}

    static create(raw: string): CriterionKind {
        const found = CriterionKind.ALL.find(kind => kind.value === raw.trim().toLowerCase());
        if (found == undefined) {
            throw new CriteriaSetInvalidError(`Invalid criterion kind: ${raw} (expected kpi | goal | performance)`);
        }
        return found;
    }

    equals(other: CriterionKind): boolean {
        return this.value === other.value;
    }
}
