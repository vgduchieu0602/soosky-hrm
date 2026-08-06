import AuditTrail from "@modules/employee/core/app/ports/AuditTrail";
import EmployeeSubResourceNotFoundError from "@modules/employee/core/app/errors/EmployeeSubResourceNotFoundError";
import EmployeeContractRepo from "@modules/employee/core/app/ports/EmployeeContractRepo";
import PermissionChecker from "@modules/employee/core/app/ports/PermissionChecker";
import { ContractStatus, EmploymentStatus } from "@modules/employee/core/domain/entities/EmployeeContract";

const PERMISSION_KEY = "employee:manage";

export interface UpdateEmployeeContractInput {
    contractId:        string;
    employmentStatus?: EmploymentStatus | undefined;
    endDate?: Date | null | undefined;
    baseSalary?: number | undefined;
    fileUrl?: string | null | undefined;
    status?: ContractStatus | undefined;
    actorUserId:       string;
}

/**
 * Cập nhật một hợp đồng lao động (trạng thái làm việc, ngày kết thúc, lương,
 * trạng thái hợp đồng).
 *
 * @throws {AccessDeniedError}               Actor không có quyền `employee:manage`.
 * @throws {EmployeeSubResourceNotFoundError} Hợp đồng không tồn tại.
 */
export default class UpdateEmployeeContractUseCase {
    public constructor(
        private readonly _permissions:  PermissionChecker,
        private readonly _contractRepo: EmployeeContractRepo,
        private readonly _auditTrail:   AuditTrail,
    ) {}

    public async execute(input: UpdateEmployeeContractInput): Promise<void> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const contract = await this._contractRepo.getById(input.contractId);
        if (contract == undefined) throw new EmployeeSubResourceNotFoundError();

        // Chup gia tri TRUOC khi goi update: entity doi tai cho (mutable), doc
        // sau khi update thi before/after se giong nhau.
        const before = {
            employmentStatus: contract.employmentStatus,
            endDate:          contract.endDate,
            baseSalary:       contract.baseSalary,
            fileUrl:          contract.fileUrl,
            status:           contract.status,
        };

        contract.update({
            employmentStatus: input.employmentStatus,
            endDate:          input.endDate,
            baseSalary:       input.baseSalary,
            fileUrl:          input.fileUrl,
            status:           input.status,
        });

        await this._contractRepo.save(contract);

        await this._auditTrail.record({
            actorUserId: input.actorUserId,
            resource:    "employee_contract",
            action:      "update",
            resourceId:  contract.id,
            changes:     {
                employeeId: contract.employeeId,
                before,
                after: {
                    employmentStatus: contract.employmentStatus,
                    endDate:          contract.endDate,
                    baseSalary:       contract.baseSalary,
                    fileUrl:          contract.fileUrl,
                    status:           contract.status,
                },
            },
        });
    }
}
