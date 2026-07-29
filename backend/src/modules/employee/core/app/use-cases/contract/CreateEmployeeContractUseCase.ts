import EmployeeNotFoundError from "@modules/employee/core/app/errors/EmployeeNotFoundError";
import EmployeeContractRepo from "@modules/employee/core/app/ports/EmployeeContractRepo";
import EmployeeHistoryRepo from "@modules/employee/core/app/ports/EmployeeHistoryRepo";
import EmployeeRepo from "@modules/employee/core/app/ports/EmployeeRepo";
import PermissionChecker from "@modules/employee/core/app/ports/PermissionChecker";
import EmployeeContract, { ContractStatus, ContractType, EmploymentStatus } from "@modules/employee/core/domain/entities/EmployeeContract";
import EmployeeHistory from "@modules/employee/core/domain/entities/EmployeeHistory";
import { v7 as UUIDv7 } from "uuid";

const PERMISSION_KEY = "employee:manage";

export interface CreateEmployeeContractInput {
    employeeId:       string;
    contractType:     ContractType;
    employmentStatus: EmploymentStatus;
    contractNumber:   string;
    startDate:        Date;
    endDate?: Date | undefined;
    baseSalary:       number;
    currency?: string | undefined;
    fileUrl?: string | undefined;
    status?: ContractStatus | undefined;
    actorUserId:      string;
}

export interface CreateEmployeeContractOutput {
    contractId: string;
}

/**
 * Thêm hợp đồng lao động cho nhân viên. Tự động ghi một bản ghi
 * {@link EmployeeHistory} ("contract_renew").
 *
 * @throws {AccessDeniedError}     Actor không có quyền `employee:manage`.
 * @throws {EmployeeNotFoundError} Nhân viên không tồn tại.
 */
export default class CreateEmployeeContractUseCase {
    public constructor(
        private readonly _permissions:   PermissionChecker,
        private readonly _employeeRepo:  EmployeeRepo,
        private readonly _contractRepo:  EmployeeContractRepo,
        private readonly _historyRepo:   EmployeeHistoryRepo,
    ) {}

    public async execute(input: CreateEmployeeContractInput): Promise<CreateEmployeeContractOutput> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const employee = await this._employeeRepo.getById(input.employeeId);
        if (employee == undefined) throw new EmployeeNotFoundError();

        const contract = EmployeeContract.create({
            id:               UUIDv7(),
            employeeId:       input.employeeId,
            contractType:     input.contractType,
            employmentStatus: input.employmentStatus,
            contractNumber:   input.contractNumber,
            startDate:        input.startDate,
            endDate:          input.endDate ?? null,
            baseSalary:       input.baseSalary,
            currency:         input.currency ?? "VND",
            fileUrl:          input.fileUrl ?? null,
            status:           input.status ?? "active",
        });

        await this._contractRepo.save(contract);

        await this._historyRepo.save(EmployeeHistory.create({
            id:              UUIDv7(),
            employeeId:      input.employeeId,
            eventType:       "contract_renew",
            fromValue:       null,
            toValue:         { contractId: contract.id, contractNumber: contract.contractNumber, baseSalary: contract.baseSalary },
            effectiveDate:   contract.startDate,
            note:            null,
            createdByUserId: input.actorUserId,
        }));

        return { contractId: contract.id };
    }
}
