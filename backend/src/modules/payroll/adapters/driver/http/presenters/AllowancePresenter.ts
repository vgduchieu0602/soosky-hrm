import Allowance from "@modules/payroll/core/domain/entities/Allowance";

export interface AllowanceDTO {
    id:              string;
    employeeId:      string;
    name:            string;
    type:            string;
    amount:          number;
    isTaxable:       boolean;
    isInsuranceBase: boolean;
    effectiveDate:   string;
    endDate:         string | null;
    createdAt:       string;
}

const AllowancePresenter = {
    toDTO(allowance: Allowance): AllowanceDTO {
        return {
            id:              allowance.id,
            employeeId:      allowance.employeeId,
            name:            allowance.name,
            type:            allowance.type,
            amount:          allowance.amount,
            isTaxable:       allowance.isTaxable,
            isInsuranceBase: allowance.isInsuranceBase,
            effectiveDate:   allowance.effectiveDate.toISOString(),
            endDate:         allowance.endDate?.toISOString() ?? null,
            createdAt:       allowance.createdAt.toISOString(),
        };
    },
};

export default AllowancePresenter;
