import TaxProfile from "@modules/payroll/core/domain/entities/TaxProfile";

export interface TaxProfileDTO {
    id:              string;
    employeeId:      string;
    isResident:      boolean;
    dependentsCount: number;
    insuranceAmount: number;
    effectiveDate:   string;
    endDate:         string | null;
    createdAt:       string;
}

const TaxProfilePresenter = {
    toDTO(taxProfile: TaxProfile): TaxProfileDTO {
        return {
            id:              taxProfile.id,
            employeeId:      taxProfile.employeeId,
            isResident:      taxProfile.isResident,
            dependentsCount: taxProfile.dependentsCount,
            insuranceAmount: taxProfile.insuranceAmount,
            effectiveDate:   taxProfile.effectiveDate.toISOString(),
            endDate:         taxProfile.endDate?.toISOString() ?? null,
            createdAt:       taxProfile.createdAt.toISOString(),
        };
    },
};

export default TaxProfilePresenter;
