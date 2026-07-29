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
    ) {}

    public async execute(input: UpdateEmployeeContractInput): Promise<void> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const contract = await this._contractRepo.getById(input.contractId);
        if (contract == undefined) throw new EmployeeSubResourceNotFoundError();

        contract.update({
            employmentStatus: input.employmentStatus,
            endDate:          input.endDate,
            baseSalary:       input.baseSalary,
            fileUrl:          input.fileUrl,
            status:           input.status,
        });

        await this._contractRepo.save(contract);
    }
}
