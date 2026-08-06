import EmployeeNotFoundError from "@modules/employee/core/app/errors/EmployeeNotFoundError";
import EmployeeProfileRepo from "@modules/employee/core/app/ports/EmployeeProfileRepo";
import EmployeeRepo from "@modules/employee/core/app/ports/EmployeeRepo";
import PermissionChecker from "@modules/employee/core/app/ports/PermissionChecker";
import EmployeeProfile, { EmployeeProfileProps } from "@modules/employee/core/domain/entities/EmployeeProfile";
import createUuidV7 from "@shared/core/domain/UuidV7";

const PERMISSION_KEY = "employee:manage";

export type UpdateEmployeeProfileInput =
    & Partial<Omit<EmployeeProfileProps, "id" | "employeeId" | "createdAt">>
    & { employeeId: string; actorUserId: string; };

/**
 * Tạo mới (nếu chưa có) hoặc cập nhật hồ sơ cá nhân (1-1) của nhân viên —
 * upsert theo `employeeId`.
 *
 * @throws {AccessDeniedError}     Actor không có quyền `employee:manage`.
 * @throws {EmployeeNotFoundError} Nhân viên không tồn tại.
 */
export default class UpdateEmployeeProfileUseCase {
    public constructor(
        private readonly _permissions:  PermissionChecker,
        private readonly _employeeRepo: EmployeeRepo,
        private readonly _profileRepo:  EmployeeProfileRepo,
    ) {}

    public async execute(input: UpdateEmployeeProfileInput): Promise<void> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const employee = await this._employeeRepo.getById(input.employeeId);
        if (employee == undefined) throw new EmployeeNotFoundError();

        const existing = await this._profileRepo.getByEmployeeId(input.employeeId);

        if (existing == undefined) {
            const profile = EmployeeProfile.create({
                id:                createUuidV7(),
                employeeId:        input.employeeId,
                firstName:         input.firstName ?? employee.name.value,
                lastName:          input.lastName ?? "",
                middleName:        input.middleName ?? null,
                dateOfBirth:       input.dateOfBirth ?? null,
                gender:            input.gender ?? null,
                nationality:       input.nationality ?? null,
                maritalStatus:     input.maritalStatus ?? null,
                avatarUrl:         input.avatarUrl ?? null,
                personalEmail:     input.personalEmail ?? null,
                workEmail:         input.workEmail ?? null,
                phone:             input.phone ?? null,
                address:           input.address ?? null,
                socialInsuranceNo: input.socialInsuranceNo ?? null,
                taxCode:           input.taxCode ?? null,
                vehiclePlate:      input.vehiclePlate ?? null,
            });
            await this._profileRepo.save(profile);
            return;
        }

        existing.update(input);
        await this._profileRepo.save(existing);
    }
}
