import AuditTrail from "@modules/employee/core/app/ports/AuditTrail";
import EmployeeContractRepo from "@modules/employee/core/app/ports/EmployeeContractRepo";
import PermissionChecker from "@modules/employee/core/app/ports/PermissionChecker";

const PERMISSION_KEY = "employee:manage";

export interface DeleteEmployeeContractInput {
    contractId:  string;
    actorUserId: string;
}

/**
 * Xoá một hợp đồng. Idempotent — xoá id không tồn tại không lỗi.
 *
 * @throws {AccessDeniedError} Actor không có quyền `employee:manage`.
 */
export default class DeleteEmployeeContractUseCase {
    public constructor(
        private readonly _permissions:  PermissionChecker,
        private readonly _contractRepo: EmployeeContractRepo,
        private readonly _auditTrail:   AuditTrail,
    ) {}

    public async execute(input: DeleteEmployeeContractInput): Promise<void> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        // Doc truoc khi xoa de nhat ky con giu duoc noi dung hop dong da mat.
        // Van idempotent: khong tim thay thi xoa van chay (no-op), bo qua audit.
        const contract = await this._contractRepo.getById(input.contractId);

        await this._contractRepo.deleteById(input.contractId);

        if (contract == undefined) return;

        await this._auditTrail.record({
            actorUserId: input.actorUserId,
            resource:    "employee_contract",
            action:      "delete",
            resourceId:  contract.id,
            changes:     {
                employeeId:       contract.employeeId,
                contractNumber:   contract.contractNumber,
                employmentStatus: contract.employmentStatus,
                baseSalary:       contract.baseSalary,
                startDate:        contract.startDate,
                endDate:          contract.endDate,
                status:           contract.status,
            },
        });
    }
}
