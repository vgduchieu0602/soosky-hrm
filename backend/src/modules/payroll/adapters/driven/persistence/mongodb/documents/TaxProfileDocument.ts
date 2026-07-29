export default interface TaxProfileDocument {
    _id:             string;
    employeeId:      string;
    isResident:      boolean;
    dependentsCount: number;
    insuranceAmount: number;
    effectiveDate:   Date;
    endDate:         Date | null;
    createdAt:       Date;
}
