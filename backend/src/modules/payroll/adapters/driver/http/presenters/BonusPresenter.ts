import Bonus from "@modules/payroll/core/domain/entities/Bonus";

export interface BonusDTO {
    id:              string;
    employeeId:      string;
    payrollPeriodId: string;
    name:            string;
    amount:          number;
    isTaxable:       boolean;
    reason:          string | null;
    createdAt:       string;
}

const BonusPresenter = {
    toDTO(bonus: Bonus): BonusDTO {
        return {
            id:              bonus.id,
            employeeId:      bonus.employeeId,
            payrollPeriodId: bonus.payrollPeriodId,
            name:            bonus.name,
            amount:          bonus.amount,
            isTaxable:       bonus.isTaxable,
            reason:          bonus.reason,
            createdAt:       bonus.createdAt.toISOString(),
        };
    },
};

export default BonusPresenter;
