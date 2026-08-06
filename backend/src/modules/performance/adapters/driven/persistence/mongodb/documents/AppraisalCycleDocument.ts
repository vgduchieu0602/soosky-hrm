/** Dạng document lưu trữ của aggregate `AppraisalCycle`. */
export default interface AppraisalCycleDocument {
    _id:             string;
    name:            string;
    payrollPeriodId: string;
    criteriaSetId:   string;
    criteriaVersion: number;
    status:          string;
    createdBy:       string;
    createdAt:       Date;
    activatedAt:     Date | null;
    closedAt:        Date | null;
}
