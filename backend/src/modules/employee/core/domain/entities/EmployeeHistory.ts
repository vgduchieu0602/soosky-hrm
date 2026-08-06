import AggregateRoot from "@shared/core/domain/AggregateRoot";

export const HISTORY_EVENTS = [
    "hired",
    "promotion",
    "transfer",
    "salary_change",
    "contract_renew",
    "info_update",
    "account_granted",
    "terminated",
] as const;
export type HistoryEvent = (typeof HISTORY_EVENTS)[number];

export interface EmployeeHistoryProps {
    id:             string;
    employeeId:     string;
    eventType:      HistoryEvent;
    fromValue:      Record<string, unknown> | null;
    toValue:        Record<string, unknown> | null;
    effectiveDate:  Date;
    note:           string | null;
    createdByUserId: string | null;
    createdAt:      Date;
}

/**
 * Dòng lịch sử của nhân viên — append-only: chỉ tạo mới và liệt kê, không có
 * use-case cập nhật/xoá. Được tạo tự động bởi các use-case khác (chuyển
 * phòng ban/vị trí, tạo hợp đồng, đổi trạng thái, ...).
 */
export default class EmployeeHistory extends AggregateRoot<string> {
    private constructor(
        public readonly id: string,
        public readonly employeeId: string,
        public readonly eventType: HistoryEvent,
        public readonly fromValue: Record<string, unknown> | null,
        public readonly toValue: Record<string, unknown> | null,
        public readonly effectiveDate: Date,
        public readonly note: string | null,
        public readonly createdByUserId: string | null,
        public readonly createdAt: Date,
    ) {
        super();
    }

    static create(props: Omit<EmployeeHistoryProps, "createdAt">): EmployeeHistory {
        return EmployeeHistory.rehydrate({ ...props, createdAt: new Date() });
    }

    static rehydrate(props: EmployeeHistoryProps): EmployeeHistory {
        return new EmployeeHistory(
            props.id, props.employeeId, props.eventType, props.fromValue, props.toValue,
            props.effectiveDate, props.note, props.createdByUserId, props.createdAt,
        );
    }
}
