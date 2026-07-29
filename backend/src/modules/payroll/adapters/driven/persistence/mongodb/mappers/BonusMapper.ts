import BonusDocument from "@modules/payroll/adapters/driven/persistence/mongodb/documents/BonusDocument";
import Bonus from "@modules/payroll/core/domain/entities/Bonus";

const BonusMapper = {
    toDocument(bonus: Bonus): BonusDocument {
        return {
            _id:             bonus.id,
            employeeId:      bonus.employeeId,
            payrollPeriodId: bonus.payrollPeriodId,
            name:            bonus.name,
            amount:          bonus.amount,
            isTaxable:       bonus.isTaxable,
            reason:          bonus.reason,
            createdAt:       bonus.createdAt,
        };
    },

    toDomain(document: BonusDocument): Bonus {
        return Bonus.rehydrate({
            id:              document._id,
            employeeId:      document.employeeId,
            payrollPeriodId: document.payrollPeriodId,
            name:            document.name,
            amount:          document.amount,
            isTaxable:       document.isTaxable,
            reason:          document.reason,
            createdAt:       document.createdAt,
        });
    },
};

export default BonusMapper;
