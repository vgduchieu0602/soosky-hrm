import EmployeeBankAccountMongoDoc from "@modules/employee/adapters/driven/persistence/mongodb/documents/EmployeeBankAccountMongoDoc";
import EmployeeBankAccount from "@modules/employee/core/domain/entities/EmployeeBankAccount";

const EmployeeBankAccountMapper = {
    toDocument(account: EmployeeBankAccount): EmployeeBankAccountMongoDoc {
        return {
            _id:           account.id,
            employeeId:    account.employeeId,
            bankName:      account.bankName,
            branch:        account.branch,
            accountNumber: account.accountNumber,
            accountHolder: account.accountHolder,
            isPrimary:     account.isPrimary,
            createdAt:     account.createdAt,
        };
    },

    toDomain(document: EmployeeBankAccountMongoDoc): EmployeeBankAccount {
        return EmployeeBankAccount.rehydrate({
            id:            document._id,
            employeeId:    document.employeeId,
            bankName:      document.bankName,
            branch:        document.branch,
            accountNumber: document.accountNumber,
            accountHolder: document.accountHolder,
            isPrimary:     document.isPrimary,
            createdAt:     document.createdAt,
        });
    },
};

export default EmployeeBankAccountMapper;
