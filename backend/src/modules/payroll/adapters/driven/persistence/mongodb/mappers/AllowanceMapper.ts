import AllowanceDocument from "@modules/payroll/adapters/driven/persistence/mongodb/documents/AllowanceDocument";
import Allowance from "@modules/payroll/core/domain/entities/Allowance";

const AllowanceMapper = {
    toDocument(allowance: Allowance): AllowanceDocument {
        return {
            _id:             allowance.id,
            employeeId:      allowance.employeeId,
            name:            allowance.name,
            type:            allowance.type,
            amount:          allowance.amount,
            isTaxable:       allowance.isTaxable,
            isInsuranceBase: allowance.isInsuranceBase,
            effectiveDate:   allowance.effectiveDate,
            endDate:         allowance.endDate,
            createdAt:       allowance.createdAt,
        };
    },

    toDomain(document: AllowanceDocument): Allowance {
        return Allowance.rehydrate({
            id:              document._id,
            employeeId:      document.employeeId,
            name:            document.name,
            type:            document.type,
            amount:          document.amount,
            isTaxable:       document.isTaxable,
            isInsuranceBase: document.isInsuranceBase,
            effectiveDate:   document.effectiveDate,
            endDate:         document.endDate,
            createdAt:       document.createdAt,
        });
    },
};

export default AllowanceMapper;
