export default interface BonusDocument {
    _id:             string;
    employeeId:      string;
    payrollPeriodId: string;
    name:            string;
    amount:          number;
    isTaxable:       boolean;
    reason:          string | null;
    createdAt:       Date;
}
