import TaxProfileDocument from "@modules/payroll/adapters/driven/persistence/mongodb/documents/TaxProfileDocument";
import TaxProfile from "@modules/payroll/core/domain/entities/TaxProfile";

const TaxProfileMapper = {
    toDocument(taxProfile: TaxProfile): TaxProfileDocument {
        return {
            _id:             taxProfile.id,
            employeeId:      taxProfile.employeeId,
            isResident:      taxProfile.isResident,
            dependentsCount: taxProfile.dependentsCount,
            insuranceAmount: taxProfile.insuranceAmount,
            effectiveDate:   taxProfile.effectiveDate,
            endDate:         taxProfile.endDate,
            createdAt:       taxProfile.createdAt,
        };
    },

    toDomain(document: TaxProfileDocument): TaxProfile {
        return TaxProfile.rehydrate({
            id:              document._id,
            employeeId:      document.employeeId,
            isResident:      document.isResident,
            dependentsCount: document.dependentsCount,
            insuranceAmount: document.insuranceAmount,
            effectiveDate:   document.effectiveDate,
            endDate:         document.endDate,
            createdAt:       document.createdAt,
        });
    },
};

export default TaxProfileMapper;
