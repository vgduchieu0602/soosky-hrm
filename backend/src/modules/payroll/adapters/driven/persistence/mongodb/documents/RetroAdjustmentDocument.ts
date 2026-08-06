/** Dạng document lưu trữ của aggregate `RetroAdjustment`. */
export default interface RetroAdjustmentDocument {
    _id:            string;
    employeeId:     string;
    kind:           string;
    amount:         number;
    taxable:        boolean;
    originPeriodId: string;
    payoutPeriodId: string;
    reason:         string;
    status:         string;
    createdBy:      string;
    createdAt:      Date;
    cancelledBy:    string | null;
    cancelledAt:    Date | null;
    cancelReason:   string | null;
}
