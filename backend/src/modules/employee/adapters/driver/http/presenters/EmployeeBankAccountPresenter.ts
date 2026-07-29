import EmployeeBankAccount from "@modules/employee/core/domain/entities/EmployeeBankAccount";

export interface EmployeeBankAccountDTO {
    id:            string;
    employeeId:    string;
    bankName:      string;
    branch:        string | null;
    accountNumber: string;
    accountHolder: string;
    isPrimary:     boolean;
    createdAt:     string;
}

const EmployeeBankAccountPresenter = {
    toDTO(account: EmployeeBankAccount): EmployeeBankAccountDTO {
        return {
            id:            account.id,
            employeeId:    account.employeeId,
            bankName:      account.bankName,
            branch:        account.branch,
            accountNumber: account.accountNumber,
            accountHolder: account.accountHolder,
            isPrimary:     account.isPrimary,
            createdAt:     account.createdAt.toISOString(),
        };
    },
};

export default EmployeeBankAccountPresenter;
