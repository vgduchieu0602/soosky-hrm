import EmployeeContract from "@modules/employee/core/domain/entities/EmployeeContract";

export interface EmployeeContractDTO {
    id:               string;
    employeeId:       string;
    contractType:     string;
    employmentStatus: string;
    contractNumber:   string;
    startDate:        string;
    endDate:          string | null;
    baseSalary:       number;
    currency:         string;
    fileUrl:          string | null;
    status:           string;
    createdAt:        string;
}

const EmployeeContractPresenter = {
    toDTO(contract: EmployeeContract): EmployeeContractDTO {
        return {
            id:               contract.id,
            employeeId:       contract.employeeId,
            contractType:     contract.contractType,
            employmentStatus: contract.employmentStatus,
            contractNumber:   contract.contractNumber,
            startDate:        contract.startDate.toISOString(),
            endDate:          contract.endDate?.toISOString() ?? null,
            baseSalary:       contract.baseSalary,
            currency:         contract.currency,
            fileUrl:          contract.fileUrl,
            status:           contract.status,
            createdAt:        contract.createdAt.toISOString(),
        };
    },
};

export default EmployeeContractPresenter;
