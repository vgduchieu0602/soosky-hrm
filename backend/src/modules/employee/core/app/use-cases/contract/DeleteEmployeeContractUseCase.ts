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
    ) {}

    public async execute(input: DeleteEmployeeContractInput): Promise<void> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);
        await this._contractRepo.deleteById(input.contractId);
    }
}
