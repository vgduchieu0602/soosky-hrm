import AuditTrail from "@modules/employee/core/app/ports/AuditTrail";
import ContractOverlapError from "@modules/employee/core/app/errors/ContractOverlapError";
import EmployeeNotFoundError from "@modules/employee/core/app/errors/EmployeeNotFoundError";
import EmployeeContractRepo from "@modules/employee/core/app/ports/EmployeeContractRepo";
import EmployeeHistoryRepo from "@modules/employee/core/app/ports/EmployeeHistoryRepo";
import EmployeeRepo from "@modules/employee/core/app/ports/EmployeeRepo";
import PermissionChecker from "@modules/employee/core/app/ports/PermissionChecker";
import EmployeeContract, { ContractStatus, ContractType, EmploymentStatus } from "@modules/employee/core/domain/entities/EmployeeContract";
import EmployeeHistory from "@modules/employee/core/domain/entities/EmployeeHistory";
import createUuidV7 from "@shared/core/domain/UuidV7";

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
 * @throws {ContractOverlapError}  Đã có hợp đồng active khác phủ khoảng thời gian này.
 */
/**
 * Hai khoảng thời gian có giao nhau không; `null` ở ngày kết thúc = vô thời hạn.
 * Dùng quy ước nửa mở phía sau: hợp đồng kết thúc đúng ngày hợp đồng sau bắt
 * đầu vẫn coi là chồng — thực tế hợp đồng mới nên bắt đầu từ ngày kế tiếp.
 */
function overlaps(startA: Date, endA: Date | null, startB: Date, endB: Date | null): boolean {
    const aEndsBeforeB = endA != null && endA < startB;
    const bEndsBeforeA = endB != null && endB < startA;
    return !aEndsBeforeB && !bEndsBeforeA;
}

export default class CreateEmployeeContractUseCase {
    public constructor(
        private readonly _permissions:   PermissionChecker,
        private readonly _employeeRepo:  EmployeeRepo,
        private readonly _contractRepo:  EmployeeContractRepo,
        private readonly _historyRepo:   EmployeeHistoryRepo,
        private readonly _auditTrail:    AuditTrail,
    ) {}

    public async execute(input: CreateEmployeeContractInput): Promise<CreateEmployeeContractOutput> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const employee = await this._employeeRepo.getById(input.employeeId);
        if (employee == undefined) throw new EmployeeNotFoundError();

        // Một nhân viên chỉ được có MỘT hợp đồng hiệu lực tại một thời điểm:
        // Payroll lấy `contractBasis` bằng cách tìm hợp đồng active đầu tiên phủ
        // ngày trả lương, nên hai hợp đồng chồng nhau khiến lương phụ thuộc thứ
        // tự bản ghi — sai mà rất khó phát hiện.
        const status = input.status ?? "active";
        if (status === "active") {
            const endDate  = input.endDate ?? null;
            const existing = await this._contractRepo.listByEmployeeId(input.employeeId);
            const conflict = existing.find(other =>
                other.status === "active"
                && overlaps(input.startDate, endDate, other.startDate, other.endDate),
            );
            if (conflict != undefined) throw new ContractOverlapError(conflict.contractNumber);
        }

        const contract = EmployeeContract.create({
            id:               createUuidV7(),
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

        // Nhân viên mới tạo ở trạng thái `onboarding`. Có hợp đồng ACTIVE nghĩa
        // là đã chính thức vào làm → chuyển sang `active`. Không có bước này thì
        // nhân viên đứng mãi ở `onboarding` và payroll (chỉ quét nhân viên
        // `active`) sẽ bỏ qua họ, tức là không ai được tính lương.
        if (contract.status === "active" && employee.status.value === "onboarding") {
            employee.activate();
            await this._employeeRepo.save(employee);
        }

        await this._historyRepo.save(EmployeeHistory.create({
            id:              createUuidV7(),
            employeeId:      input.employeeId,
            eventType:       "contract_renew",
            fromValue:       null,
            toValue:         { contractId: contract.id, contractNumber: contract.contractNumber, baseSalary: contract.baseSalary },
            effectiveDate:   contract.startDate,
            note:            null,
            createdByUserId: input.actorUserId,
        }));

        await this._auditTrail.record({
            actorUserId: input.actorUserId,
            resource:    "employee_contract",
            action:      "create",
            resourceId:  contract.id,
            changes:     {
                employeeId:       contract.employeeId,
                contractNumber:   contract.contractNumber,
                contractType:     contract.contractType,
                employmentStatus: contract.employmentStatus,
                baseSalary:       contract.baseSalary,
                startDate:        contract.startDate,
                endDate:          contract.endDate,
                status:           contract.status,
            },
        });

        return { contractId: contract.id };
    }
}
