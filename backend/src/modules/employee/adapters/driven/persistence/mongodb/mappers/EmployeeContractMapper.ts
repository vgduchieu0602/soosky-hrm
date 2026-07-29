import EmployeeContractMongoDoc from "@modules/employee/adapters/driven/persistence/mongodb/documents/EmployeeContractMongoDoc";
import EmployeeContract, { ContractStatus, ContractType, EmploymentStatus } from "@modules/employee/core/domain/entities/EmployeeContract";

const EmployeeContractMapper = {
    toDocument(contract: EmployeeContract): EmployeeContractMongoDoc {
        return {
            _id:              contract.id,
            employeeId:       contract.employeeId,
            contractType:     contract.contractType,
            employmentStatus: contract.employmentStatus,
            contractNumber:   contract.contractNumber,
            startDate:        contract.startDate,
            endDate:          contract.endDate,
            baseSalary:       contract.baseSalary,
            currency:         contract.currency,
            fileUrl:          contract.fileUrl,
            status:           contract.status,
            createdAt:        contract.createdAt,
        };
    },

    toDomain(document: EmployeeContractMongoDoc): EmployeeContract {
        return EmployeeContract.rehydrate({
            id:               document._id,
            employeeId:       document.employeeId,
            contractType:     document.contractType as ContractType,
            employmentStatus: document.employmentStatus as EmploymentStatus,
            contractNumber:   document.contractNumber,
            startDate:        document.startDate,
            endDate:          document.endDate,
            baseSalary:       document.baseSalary,
            currency:         document.currency,
            fileUrl:          document.fileUrl,
            status:           document.status as ContractStatus,
            createdAt:        document.createdAt,
        });
    },
};

export default EmployeeContractMapper;
